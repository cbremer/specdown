const { app, BrowserWindow, ipcMain } = require('electron');
const { installRecoveryProbeData } = require('./helpers/recovery-probe-data');
const fs = require('fs');
const os = require('os');
const path = require('path');
const profile = process.argv[2],
  mode = process.argv[3];
if (
  !profile ||
  !profile.startsWith(os.tmpdir()) ||
  fs.readFileSync(path.join(profile, 'synthetic-probe'), 'utf8') !== 'recovery'
)
  throw Error('Disposable profile required');
app.setPath('userData', profile);
const probeData = installRecoveryProbeData(ipcMain, profile);
const preload = probeData.preload;
fs.appendFileSync(
  preload,
  "contextBridge.exposeInMainWorld('recoveryProbe',{crash:()=>ipcRenderer.sendSync('synthetic-crash-now'),baseline:value=>ipcRenderer.sendSync('synthetic-baseline',value)});"
);
ipcMain.on('synthetic-crash-now', () => process.kill(process.pid, 'SIGKILL'));
ipcMain.on('synthetic-baseline', (event, value) => {
  if (typeof value !== 'string' || value.length > 1024 * 1024)
    throw Error('Invalid synthetic baseline');
  const descriptor = fs.openSync(
    path.join(profile, 'cleanup-baseline.json'),
    'w'
  );
  try {
    fs.writeFileSync(descriptor, value);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  event.returnValue = true;
});
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  try {
    window.webContents.on('console-message', (_event, details) => {
      if (details?.level === 'error') console.error(details.message);
    });
    probeData.set(window.webContents, 'mode', mode);
    probeData.set(
      window.webContents,
      'baseline',
      mode === 'resume-discarded'
        ? JSON.parse(
            fs.readFileSync(path.join(profile, 'cleanup-baseline.json'), 'utf8')
          )
        : null
    );
    await window.loadURL(
      process.env.SPECDOWN_RECOVERY_TEST_URL || 'http://127.0.0.1:5192'
    );
    // Drive the configured application graph through public entry points. Vite
    // can retain timestamp-qualified modules after HMR; importing bare source
    // paths here would create a second, unconfigured tabs/annotation graph.
    await window.webContents.executeJavaScript(`(async()=>{
      window.probeCrashMode=await window.recoveryProbeData.get('mode');
      window.probeUntil=async(predicate,label)=>{for(let i=0;i<400;i++){if(await predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+label);};
      window.probeReadRoot=()=>new Promise((yes,no)=>{const request=indexedDB.open('specdown-annotation-recovery-v1',1);request.onerror=()=>no(request.error);request.onupgradeneeded=()=>{request.transaction.abort();no(Error('Expected previously enrolled annotation authority'));};request.onsuccess=()=>{const db=request.result;const tx=db.transaction('authority','readonly');const get=tx.objectStore('authority').get('root');let value;get.onsuccess=()=>{value=get.result;};tx.oncomplete=()=>{db.close();yes(value);};tx.onabort=()=>{db.close();no(tx.error);};};});
      window.probeCleanupBaseline=await window.recoveryProbeData.get('baseline');
    })()`);
    await window.webContents.executeJavaScript(
      `window.probeUntil(()=>typeof window.loadFileContent==='function','public load API')`
    );
    if (!mode.startsWith('resume')) {
      await window.webContents.executeJavaScript(`(async()=>{
    const discarding=window.probeCrashMode==='discarded';const originalRaw='{"archive":{"0":"keep original archive"}}';if(discarding)localStorage.setItem('specdown-annotations',originalRaw);
    const accepted=window.loadFileContent(discarding?'Body\\n\\nSecond body':'Body','Synthetic crash.md');if(!accepted)throw Error('Public load rejected synthetic source');
    await window.probeUntil(async()=>{const p=document.querySelector('#markdown-content p');const button=document.getElementById('annotation-toggle');if(!p||!button?.dataset.annotationIdentity)return false;const root=await window.probeReadRoot();return root?.documents?.some(d=>d.sourceRevision)&&root.requests.every(r=>r.acknowledged);},'rendered accepted source and annotation authority');
    document.getElementById('annotation-toggle').click();
    if(discarding){
      await window.probeUntil(async()=>(await window.probeReadRoot()).archives.some(a=>a.raw===originalRaw),'committed original archive');
      document.querySelector('#markdown-content p').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));await window.probeUntil(()=>document.querySelector('#annotation-editor-backdrop textarea'),'baseline editor');const baselineEditor=document.querySelector('#annotation-editor-backdrop');baselineEditor.querySelector('textarea').value='keep committed';baselineEditor.querySelector('.annotation-editor-save').click();
      await window.probeUntil(async()=>{const root=await window.probeReadRoot();return root.documents.flatMap(d=>d.notes).length===1&&root.requests.every(r=>r.acknowledged);},'committed baseline note');
      const root=await window.probeReadRoot();window.recoveryProbe.baseline(JSON.stringify({notes:root.documents.flatMap(d=>d.notes),archives:root.archives,bindings:root.bindings,revision:root.revision}));
    }
    const put=IDBObjectStore.prototype.put;let armed=true,intentId=null;
    IDBObjectStore.prototype.put=function(value,key){
      const request=value?.requests?.at(-1);
      if(discarding&&intentId&&request?.id===intentId&&request.status==='committed')throw new DOMException('Retain prepared draft for explicit discard','QuotaExceededError');
      const result=put.call(this,value,key);
      if(key==='root'&&request?.status==='prepared'&&request.command?.type==='add'&&request.command.note?.text==='durable once')intentId=request.id;
      if(armed && key==='root' && intentId && request?.id===intentId && request.status===(discarding?'abandoned':window.probeCrashMode)){armed=false;this.transaction.addEventListener('complete',()=>window.recoveryProbe.crash(),{once:true});}
      return result;
    };
    document.querySelectorAll('#markdown-content p')[discarding?1:0].dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
    await window.probeUntil(()=>document.querySelector('#annotation-editor-backdrop textarea'),'actual editor');
    const editor=document.querySelector('#annotation-editor-backdrop');editor.querySelector('textarea').value='durable once';editor.querySelector('.annotation-editor-save').click();
    if(discarding){
      await window.probeUntil(async()=>(await window.probeReadRoot()).requests.some(r=>r.id===intentId&&r.status==='prepared'),'retained failed draft');
      document.querySelector('.annotation-editor-cancel').click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',metaKey:true,bubbles:true}));await window.probeUntil(()=>document.querySelector('.command-palette'),'cleanup recovery command');const item=[...document.querySelectorAll('.command-palette-item')].find(e=>e.textContent.includes('Unassigned notes and recovery'));if(!item)throw Error('Recovery command missing');item.dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));item.click();
      const label='Discard uncommitted request (keep original archives)';await window.probeUntil(()=>[...document.querySelectorAll('button')].some(b=>b.textContent===label),'explicit discard action');[...document.querySelectorAll('button')].find(b=>b.textContent===label).click();
    }
   })()`);
      await new Promise((_, reject) =>
        setTimeout(() => reject(Error('Crash boundary not reached')), 20000)
      );
    } else {
      const result = await window.webContents.executeJavaScript(`(async()=>{
     const before=await window.probeReadRoot();
     if(window.probeCrashMode==='resume-discarded'){const baseline=window.probeCleanupBaseline;const current={notes:before.documents.flatMap(d=>d.notes),archives:before.archives,bindings:before.bindings,revision:before.revision};if(JSON.stringify(current)!==JSON.stringify(baseline))throw Error('Discard cleanup changed committed notes/archives/bindings');const abandoned=before.requests.filter(r=>r.status==='abandoned');if(abandoned.length!==1||!abandoned[0].acknowledged||abandoned[0].command!==undefined||before.requests.some(r=>!r.acknowledged))throw Error('Cleanup receipt or staging was not durable');return {priorStatus:'abandoned',notes:current.notes.map(n=>n.text),archives:current.archives.length,originalRawExact:current.archives.some(a=>a.raw==='{"archive":{"0":"keep original archive"}}'),activeRevisionUnchanged:true,stagingCommandRemoved:true,acknowledged:true,publicEntry:true,configuredRecoveryCommand:true};}
     const request=before.requests.find(r=>!r.acknowledged);if(!request)throw Error('Durable request lost across process restart');
     document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',metaKey:true,bubbles:true}));
     await window.probeUntil(()=>document.querySelector('.command-palette'),'configured command palette');
     const item=[...document.querySelectorAll('.command-palette-item')].find(e=>e.textContent.includes('Unassigned notes and recovery'));if(!item)throw Error('Configured global recovery command missing');item.dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));item.click();
     const label=request.status==='prepared' ? 'Resume original prepared request' : 'Acknowledge retained request';
     await window.probeUntil(()=>[...document.querySelectorAll('button')].some(b=>b.textContent===label),'visible crash recovery action');
     [...document.querySelectorAll('button')].find(b=>b.textContent===label).click();
     await window.probeUntil(async()=>(await window.probeReadRoot()).requests.every(r=>r.acknowledged),'durable recovery acknowledgement');
     const current=await window.probeReadRoot();const notes=current.documents.flatMap(d=>d.notes);if(notes.length!==1||notes[0].text!=='durable once'||current.operations.filter(o=>o.type==='add').length!==1)throw Error('Duplicate or missing editor save');return {priorStatus:request.status,notes:notes.map(n=>n.text),addOperations:current.operations.filter(o=>o.type==='add').length,acknowledged:current.requests.every(r=>r.acknowledged),sessionReceipt:sessionStorage.getItem('specdown-recovery-pending-v1'),publicEntry:true,configuredRecoveryCommand:true};
   })()`);
      fs.writeFileSync(
        path.join(profile, 'result.json'),
        JSON.stringify(result)
      );
      window.destroy();
      app.quit();
    }
  } catch (error) {
    console.error(error);
    window.destroy();
    app.exit(1);
  }
});
