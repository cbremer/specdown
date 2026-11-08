// Stock Electron bounded compound-capacity measurement. Disposable data only.
const { app, BrowserWindow } = require('electron');
const { createHash } = require('crypto');
const fs = require('fs'),
  os = require('os'),
  path = require('path');
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), 'specdown-synthetic-capacity-')
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
    const backup = path.join(profile, 'capacity-private.sdr');
    let downloaded;
    window.webContents.session.once('will-download', (_event, item) => {
      item.setSavePath(backup);
      downloaded = new Promise((yes, no) =>
        item.once('done', (_done, state) =>
          state === 'completed'
            ? yes()
            : no(Error('Synthetic capacity download ' + state))
        )
      );
    });
    const result = await window.webContents.executeJavaScript(
      process.argv.includes('--inventory')
        ? `(async()=>{
      const api=await import('/src/features/annotation-recovery.js');const db=await api.recoveryOpen('inventory-'+crypto.randomUUID());let root=await db.read();
      const source=await api.recoveryArchive(JSON.stringify({schema:1,epoch:'external',revision:0,documents:[{id:'imported',label:'Inventory',revision:0,notes:Array.from({length:20000},(_,i)=>({id:'n'+i,text:'',revision:1}))}],bindings:[],archives:[],operations:[],requests:[]}));
      await api.recoveryPreparedCommit(db,{type:'capture',id:'inventory-capture',epoch:root.epoch,revision:0,archive:source});root=await db.read();await api.recoveryPreparedCommit(db,{type:'replace',id:'inventory-initial-activate',epoch:root.epoch,revision:root.revision,protective:await api.recoveryArchive(api.recoveryPrivateDescription(root)),incomingArchiveId:source.id});root=await db.read();
      if(root.documents[0].notes.length!==20000||root.archives.reduce((n,a)=>n+a.occurrences.length,0)!==20000)throw Error('Supported20k-active/20k-archive boundary not retained');const before=api.recoveryPrivateDescription(root);let activeAbove=false,inventoryAdmissionAbove=false;
      try{await db.commit({type:'add',id:'one-active-above',epoch:root.epoch,revision:root.revision,documentId:root.documents[0].id,documentRevision:root.documents[0].revision,note:{text:'one above'}});}catch(e){activeAbove=e.message.includes('capacity');}
      const extra=await api.recoveryArchive(JSON.stringify({extra:Object.fromEntries(Array.from({length:20000},(_,i)=>[String(i),'']))}));try{await db.commit({type:'capture',id:'20k-active-40k-archive-admission',epoch:root.epoch,revision:root.revision,archive:extra});}catch(e){inventoryAdmissionAbove=e.message.includes('capacity');}
      const after=await db.read();if(!activeAbove||!inventoryAdmissionAbove||api.recoveryPrivateDescription(after)!==before)throw Error('Above-count admission mutated supported boundary');const packed=await api.recoveryPrivateBackup(after),staged=await api.recoveryRestoreFile(packed);const target=await api.recoveryOpen('inventory-staged-'+crypto.randomUUID());let recovered=await target.read();await api.recoveryPreparedCommit(target,{type:'restore',id:'inventory-staged-restore',epoch:recovered.epoch,revision:0,archives:staged});recovered=await target.read();const stageOccurrences=recovered.archives.reduce((n,a)=>n+a.occurrences.length,0);const state=staged.find(a=>a.privateState&&a.status.startsWith('supported private state')&&JSON.parse(a.raw).documents.length);
      await api.recoveryPreparedCommit(target,{type:'replace',id:'inventory-protected-activate',epoch:recovered.epoch,revision:recovered.revision,protective:await api.recoveryArchive(api.recoveryPrivateDescription(recovered)),incomingArchiveId:state.id});recovered=await target.read();if(recovered.documents[0].notes.length!==20000||recovered.archives.reduce((n,a)=>n+a.occurrences.length,0)!==40000)throw Error('Protected recovery lost boundary inventory');const next=await api.recoveryPrivateBackup(recovered),again=await api.recoveryRestoreFile(next);if(again.reduce((n,a)=>n+a.occurrences.length,0)!==60000)throw Error('Protected recovery next backup lost occurrences');target.close();db.close();
      const pure=await api.recoveryOpen('pure-archives-'+crypto.randomUUID());let pureRoot=await pure.read();for(let j=0;j<3;j++){const archive=await api.recoveryArchive(JSON.stringify({['pure'+j]:Object.fromEntries(Array.from({length:20000},(_,i)=>[String(i),'']))}));await api.recoveryPreparedCommit(pure,{type:'capture',id:'pure-'+j,epoch:pureRoot.epoch,revision:pureRoot.revision,archive});pureRoot=await pure.read();}const pureBefore=api.recoveryPrivateDescription(pureRoot);let pureAbove=false;try{await pure.commit({type:'capture',id:'pure-above',epoch:pureRoot.epoch,revision:pureRoot.revision,archive:await api.recoveryArchive('{"extra":{"0":"one above"}}')});}catch(e){pureAbove=e.message.includes('60,000');}if(!pureAbove||api.recoveryPrivateDescription(await pure.read())!==pureBefore)throw Error('60k pure archive threshold changed state');const purePacked=await api.recoveryPrivateBackup(pureRoot),pureArchives=await api.recoveryRestoreFile(purePacked);const pureTarget=await api.recoveryOpen('pure-target-'+crypto.randomUUID());let pureStaged=await pureTarget.read();await api.recoveryPreparedCommit(pureTarget,{type:'restore',id:'pure-stage',epoch:pureStaged.epoch,revision:0,archives:pureArchives});pureStaged=await pureTarget.read();const pureState=pureArchives.find(a=>a.privateState&&a.status.startsWith('supported private state'));await api.recoveryPreparedCommit(pureTarget,{type:'replace',id:'pure-activate',epoch:pureStaged.epoch,revision:pureStaged.revision,protective:await api.recoveryArchive(api.recoveryPrivateDescription(pureStaged)),incomingArchiveId:pureState.id});const pureFinal=await pureTarget.read();if(pureFinal.documents.length||pureFinal.archives.reduce((n,a)=>n+a.occurrences.length,0)!==60000)throw Error('Pure60k protected activation failed');pure.close();pureTarget.close();return {active:20000,originalArchived:20000,stageOccurrences,protectedArchived:40000,protectedActive:20000,nextBackupOccurrences:again.reduce((n,a)=>n+a.occurrences.length,0),activeAbove,inventoryAdmissionAbove,pureArchived:60000,pureAbove,pureProtected:true,unchanged:true,backupBytes:packed.length,nextBackupBytes:next.length,pureBackupBytes:purePacked.length,heapSample:performance.memory?.usedJSHeapSize};
    })()`
        : `(async()=>{
   const api=await import('/src/features/annotation-recovery.js');const db=await api.recoveryOpen('capacity-'+crypto.randomUUID());const empty=await db.read();
   const tiny=await api.recoveryArchive(new Uint8Array([255]));const base={type:'capture',id:'capacity-capture',epoch:empty.epoch,revision:0,archive:tiny};
   const committed=api.recoveryReduce(api.recoveryPrepare(empty,base),base);const descriptionBytes=api.recoveryPrivateDescription(committed).length*2;
   const maximum=api.RECOVERY_LIMITS.transportBytes-api.RECOVERY_LIMITS.manifestBytes-8-descriptionBytes;
   const archive=await api.recoveryArchive(new Uint8Array(maximum).fill(255));const command={...base,archive};await api.recoveryPreparedCommit(db,command);const captured=await db.read();
   const larger=await api.recoveryArchive(new Uint8Array(maximum+1).fill(255));let aboveRejected=false;try{const cmd={...base,archive:larger};api.recoveryReduce(api.recoveryPrepare(empty,cmd),cmd);}catch(e){aboveRejected=e.message.includes('transport capacity');}if(!aboveRejected)throw Error('Next byte above capture threshold accepted');
   const overflow=await api.recoveryOpen('one-byte-above-'+crypto.randomUUID());const overflowEmpty=await overflow.read();let durableAboveRejected=false;try{await api.recoveryPreparedCommit(overflow,{...base,epoch:overflowEmpty.epoch,archive:larger});}catch(e){durableAboveRejected=e.message.includes('transport capacity');}const overflowAfter=await overflow.read();if(!durableAboveRejected||overflowAfter.archives.length||overflowAfter.revision!==0)throw Error('One-byte-above durable capture changed active state');overflow.close();
   const rawTarget=await api.recoveryOpen('raw-restore-'+crypto.randomUUID());const rawEmpty=await rawTarget.read();let rawRestoreAboveRejected=false;try{await api.recoveryPreparedCommit(rawTarget,{type:'restore',id:'capacity-capture',epoch:rawEmpty.epoch,revision:0,archives:[larger],verifiedContainer:true});}catch(e){rawRestoreAboveRejected=e.message.includes('transport capacity');}const rawAfter=await rawTarget.read();if(!rawRestoreAboveRejected||rawAfter.archives.length||rawAfter.revision!==0)throw Error('Raw restore or spoofed imported flag bypassed conservative capture headroom');rawTarget.close();
   const packed=await api.recoveryPrivateBackup(captured);const restored=await api.recoveryRestoreFile(packed);const target=await api.recoveryOpen('capacity-restored-'+crypto.randomUUID());const targetRoot=await target.read();let restoreError=null;try{await api.recoveryPreparedCommit(target,{type:'restore',id:'capacity-restore',epoch:targetRoot.epoch,revision:0,archives:restored});}catch(e){restoreError=e.message;}
   const fileDigest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',packed))).map(b=>b.toString(16).padStart(2,'0')).join('');window.probeCapacityPacked=packed;window.probeCapacityOriginal={id:archive.id,digest:archive.digest,length:archive.bytes.length};db.close();target.close();
   return {maximum,descriptionBytes,packedBytes:packed.length,fileDigest,aboveRejected,durableAboveRejected,rawRestoreAboveRejected,restoreError,restoredArchives:restored.length,heapSample:performance.memory?.usedJSHeapSize};
  })()`
    );
    if (!process.argv.includes('--inventory')) {
      await window.webContents.executeJavaScript(
        `(()=>{const url=URL.createObjectURL(new Blob([window.probeCapacityPacked],{type:'application/octet-stream'}));const a=document.createElement('a');a.href=url;a.download='capacity-private.sdr';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);window.probeCapacityPacked=null;})()`
      );
      for (let i = 0; i < 200 && !downloaded; i++)
        await new Promise((r) => setTimeout(r, 20));
      if (!downloaded) throw Error('Capacity download not initiated');
      await downloaded;
      const file = fs.readFileSync(backup);
      if (
        file.length !== result.packedBytes ||
        createHash('sha256').update(file).digest('hex') !== result.fileDigest
      )
        throw Error('Actual downloaded capacity bytes differ');
      await window.webContents.executeJavaScript(
        `(()=>{window.probeCapacitySelected=new Promise((yes,no)=>{const input=document.createElement('input');input.type='file';input.id='capacity-reselect';input.addEventListener('change',async()=>{try{const api=await import('/src/features/annotation-recovery.js');const bytes=new Uint8Array(await input.files[0].arrayBuffer());const archives=await api.recoveryRestoreFile(bytes);const original=archives.find(a=>a.id===window.probeCapacityOriginal.id);if(!original||original.digest!==window.probeCapacityOriginal.digest||original.bytes.length!==window.probeCapacityOriginal.length||!original.bytes.every(b=>b===255))throw Error('Original opaque bytes changed after file reselection');const name='file-reselected-'+crypto.randomUUID();let db=await api.recoveryOpen(name);const root=await db.read();await db.prepare({type:'restore',id:'file-reselected-restore',epoch:root.epoch,revision:0,archives});db.close();db=await api.recoveryOpen(name);const pending=(await db.read()).requests.find(r=>r.id==='file-reselected-restore');await db.commit(pending.command);await db.acknowledge(pending.id);const restored=await db.read();if(!restored.archives.some(a=>a.id===original.id))throw Error('Reselected original not committed');const next=await api.recoveryPrivateBackup(restored);const again=await api.recoveryRestoreFile(next);if(!again.some(a=>a.id===original.id&&a.bytes.length===original.bytes.length&&a.bytes.every(b=>b===255)))throw Error('Next complete backup lost original opaque bytes');db.close();yes({actualFile:true,opaqueBytesExact:true,reopenedPreparedReceipt:true,archives:restored.archives.length,nextBackupBytes:next.length,nextBackupExact:true,heapSample:performance.memory?.usedJSHeapSize});}catch(error){no(error);}});document.body.append(input);});})()`
      );
      window.webContents.debugger.attach('1.3');
      const { root } =
        await window.webContents.debugger.sendCommand('DOM.getDocument');
      const { nodeId } = await window.webContents.debugger.sendCommand(
        'DOM.querySelector',
        { nodeId: root.nodeId, selector: '#capacity-reselect' }
      );
      await window.webContents.debugger.sendCommand('DOM.setFileInputFiles', {
        nodeId,
        files: [backup],
      });
      result.reselected = await window.webContents.executeJavaScript(
        'window.probeCapacitySelected'
      );
      window.webContents.debugger.detach();
    }
    console.log(
      JSON.stringify(
        { electron: process.versions.electron, profile, result },
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
