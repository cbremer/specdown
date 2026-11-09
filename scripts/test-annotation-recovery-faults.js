// Stock Electron real IndexedDB fault, version and bounded-capacity probes.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), 'specdown-synthetic-faults-')
);
app.setPath('userData', profile);
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    await window.loadURL(
      process.env.SPECDOWN_RECOVERY_TEST_URL || 'http://127.0.0.1:5192'
    );
    const results = await window.webContents.executeJavaScript(`(async()=>{
   const api=await import('/src/features/annotation-recovery.js');const name='faults-'+crypto.randomUUID();const db=await api.recoveryOpen(name);let root=await db.read();root=await db.commit({type:'bind',id:'bind',source:'synthetic',label:'Synthetic',epoch:root.epoch,revision:0});const doc=root.documents[0];const phases=[];
   const selection=await api.recoveryArchive('{"a":{"0":"selected"}}');root=await db.read();await db.commit({type:'capture',id:'capture-selection',epoch:root.epoch,revision:root.revision,archive:selection});
   for(const type of ['add','associate','restore'])for(const phase of ['prepare','commit','ack']){
     const before=await db.read();const supplied=await api.recoveryArchive('{"restore-'+phase+'":{"0":"raw restore"}}');const cmd={type,id:'fault-'+type+'-'+phase,epoch:before.epoch,revision:before.revision,...(type==='restore'?{archives:[supplied]}:{documentId:doc.id,documentRevision:before.documents[0].revision,...(type==='associate'?{archiveId:selection.id,addresses:selection.occurrences.map(o=>o.address)}:{note:{text:'note '+phase}})})};
     const original=IDBObjectStore.prototype.put;
     IDBObjectStore.prototype.put=function(value,...args){const request=value?.requests?.at(-1);if(args[0]==='root'&&request?.id===cmd.id&&((phase==='prepare'&&request.status==='prepared')||(phase==='commit'&&request.status==='committed'&&!request.acknowledged)||(phase==='ack'&&request.acknowledged)))throw new DOMException('Synthetic quota at '+phase,'QuotaExceededError');return original.call(this,value,...args);};
     let error;try{await api.recoveryPreparedCommit(db,cmd);}catch(e){error=e.name;}finally{IDBObjectStore.prototype.put=original;}
     const after=await db.read();const measure=root=>type==='restore'?root.archives.length:root.documents[0].notes.length;const delta=measure(after)-measure(before);if(phase!=='ack'&&JSON.stringify({...after,requests:[]})!==JSON.stringify({...before,requests:[]}))throw Error('Failure changed active/archive state: '+type+' '+phase);
     if(!error||delta!==(phase==='ack'?1:0))throw Error('Fault state wrong: '+phase);
     if(phase==='ack'){await api.recoveryPreparedCommit(db,cmd);if(measure(await db.read())!==measure(after))throw Error('Ack retry duplicated');}
     else if(after.requests.some(r=>r.id===cmd.id))await db.acknowledge(cmd.id);
     phases.push({type,phase,error,delta});
   }
   // Replacement and its protective snapshot activate in the same transaction.
   const replacementPhases=[];
   for(const phase of ['prepare','commit','ack','protective-validation','concurrent-write']){
     const targetName='replace-'+phase+'-'+crypto.randomUUID();const target=await api.recoveryOpen(targetName);let before=await target.read();before=await target.commit({type:'bind',id:'old-bind',epoch:before.epoch,revision:before.revision,source:'old-source',label:'Old'});before=await target.commit({type:'add',id:'old-add',epoch:before.epoch,revision:before.revision,documentId:before.documents[0].id,documentRevision:0,note:{text:'keep unless explicitly replaced'}});before=await target.commit({type:'capture',id:'old-archive',epoch:before.epoch,revision:before.revision,archive:selection});
     const protective=await api.recoveryArchive(api.recoveryPrivateDescription(before));const incoming={schema:1,documents:[{id:'external',label:'Incoming',revision:0,notes:[{id:'external-note',text:'replacement note',revision:1}]}],operations:[]};const cmd={type:'replace',id:'replace-'+phase,epoch:before.epoch,revision:before.revision,protective:phase==='protective-validation'?{...protective,raw:'not the current snapshot'}:protective,incoming};
     let preserved=before;if(phase==='concurrent-write'){const other=await api.recoveryOpen(targetName);preserved=await other.commit({type:'edit',id:'other-window-edit',epoch:before.epoch,revision:before.revision,documentId:before.documents[0].id,documentRevision:before.documents[0].revision,noteId:before.documents[0].notes[0].id,text:'newer concurrent edit'});other.close();}
     const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){const request=value?.requests?.at(-1);if(args[0]==='root'&&request?.id===cmd.id&&((phase==='prepare'&&request.status==='prepared')||(phase==='commit'&&request.status==='committed'&&!request.acknowledged)||(phase==='ack'&&request.acknowledged)))throw new DOMException('Synthetic replacement quota '+phase,'QuotaExceededError');return put.call(this,value,...args);};
     let error;try{await api.recoveryPreparedCommit(target,cmd);}catch(e){error=e.name+': '+e.message;}finally{IDBObjectStore.prototype.put=put;}let after=await target.read();if(!error)throw Error('Replacement fault not exercised '+phase);
     if(phase==='ack'){
       if(after.epoch===before.epoch||after.documents[0].notes[0].text!=='replacement note'||after.bindings.length||!after.archives.some(a=>a.raw===protective.raw)||!after.archives.some(a=>a.id===selection.id))throw Error('Replacement/protective snapshot did not commit atomically');
       await api.recoveryPreparedCommit(target,cmd);const retry=await target.read();if(retry.operations.filter(o=>o.type==='replace').length!==1||retry.archives.filter(a=>a.id===protective.id).length!==1||retry.documents[0].notes.length!==1||retry.requests.some(r=>!r.acknowledged))throw Error('Replacement lost-ack retry duplicated effects');
     }else{if(JSON.stringify({...preserved,requests:[]})!==JSON.stringify({...after,requests:[]}))throw Error('Replacement fault changed current store '+phase);if(after.requests.some(r=>r.id===cmd.id))await target.acknowledge(cmd.id);}
     replacementPhases.push({phase,error,activeChanged:phase==='ack',protectiveCommitted:after.archives.some(a=>a.id===protective.id),retryDuplicate:false,...(phase==='concurrent-write'?{concurrentEditPreserved:after.documents[0].notes[0].text==='newer concurrent edit'}:{})});target.close();
   }
   const stable=JSON.stringify(await db.read());const get=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(key){if(key==='root')throw new DOMException('Synthetic read failure','UnknownError');return get.call(this,key);};let readRejected=false;try{await db.read();}catch{readRejected=true;}finally{IDBObjectStore.prototype.get=get;}if(!readRejected||JSON.stringify(await db.read())!==stable)throw Error('Read failure changed state');
   let cloneRejected=false;root=await db.read();try{await db.prepare({type:'add',id:'uncloneable',epoch:root.epoch,revision:root.revision,documentId:doc.id,documentRevision:root.documents[0].revision,note:{text:'draft',unsupported:()=>1}});}catch{cloneRejected=true;}if(!cloneRejected||JSON.stringify(await db.read())!==stable)throw Error('Serialization changed state');
   // Actual stale-open-connection version change, then fail-closed reopen.
   await new Promise((yes,no)=>{const request=indexedDB.open(name,2);request.onsuccess=()=>{request.result.close();yes();};request.onerror=()=>no(request.error);});
   let stale=false;try{await db.read();}catch{stale=true;}let future=false;try{await api.recoveryOpen(name);}catch{future=true;}if(!stale||!future)throw Error('Stale schema accepted');
   // An enrolled database with its root removed cannot silently enroll again.
   const missing='missing-'+crypto.randomUUID();const ready=await api.recoveryOpen(missing);ready.close();await new Promise((yes,no)=>{const request=indexedDB.open(missing,1);request.onsuccess=()=>{const native=request.result;const tx=native.transaction('authority','readwrite');tx.objectStore('authority').delete('root');tx.oncomplete=()=>{native.close();yes();};tx.onabort=()=>no(tx.error);};});let lost=false;try{await api.recoveryOpen(missing);}catch{lost=true;}if(!lost)throw Error('Missing root recreated');
   // More than old 2 MiB/2000-note limits and a 16 MiB opaque UTF-16 archive.
   const large=await api.recoveryArchive('x'.repeat(8*1024*1024));let big=api.recoveryEmpty();big=api.recoveryReduce(big,{type:'capture',id:'large',epoch:big.epoch,revision:0,archive:large});const packed=await api.recoveryPrivateBackup(big);const decoded=await api.recoveryRestoreFile(packed);const durable=await api.recoveryOpen('large-'+crypto.randomUUID());const empty=await durable.read();const restore={type:'restore',id:'large-restore',epoch:empty.epoch,revision:0,archives:decoded};await api.recoveryPreparedCommit(durable,restore);const restored=await durable.read();const second=await api.recoveryPrivateBackup(restored);if(!restored.archives.some(a=>a.raw===large.raw))throw Error('Large raw lost');
   durable.close();const oversized=new Uint8Array(api.RECOVERY_LIMITS.archiveBytes+1);let above=false;try{await api.recoveryArchive(oversized);}catch{above=true;}if(!above)throw Error('Above read ceiling accepted');
   return {phases,replacementPhases,readRejected,cloneRejected,stale,future,lost,capacity:{rawBytes:large.bytes.length,transportBytes:packed.length,restoredArchives:restored.archives.length,secondBackupBytes:second.length,aboveRejected:above},heap:performance.memory?.usedJSHeapSize};
  })()`);
    console.log(
      JSON.stringify(
        { electron: process.versions.electron, results, profile },
        null,
        2
      )
    );
    window.destroy();
    app.quit();
  } catch (error) {
    console.error(error);
    window.destroy();
    app.exit(1);
  }
});
