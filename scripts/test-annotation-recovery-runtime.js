// Run with the installed Electron executable, never the production app profile:
// node_modules/.bin/electron scripts/test-annotation-recovery-runtime.js
// Requires a local Vite server (SPECDOWN_RECOVERY_TEST_URL, default port 5192).
const { app, BrowserWindow, ipcMain } = require('electron');
const { installRecoveryProbeData } = require('./helpers/recovery-probe-data');
const fs = require('fs');
const os = require('os');
const path = require('path');
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), 'specdown-synthetic-recovery-')
);
app.setPath('userData', profile);
const probeData = installRecoveryProbeData(ipcMain, profile);
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: probeData.preload,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    await window.loadURL(
      process.env.SPECDOWN_RECOVERY_TEST_URL || 'http://127.0.0.1:5192'
    );
    const result = await window.webContents.executeJavaScript(`(async()=>{
   const api=await import('/src/features/annotation-recovery.js');
   const name='synthetic-runtime-'+crypto.randomUUID();
   const one=await api.recoveryOpen(name);const two=await api.recoveryOpen(name);
   const before=await one.read();
   const archive=await api.recoveryArchive('{"README.md":{"01":"one","1":"two"}}');
   const capture={type:'capture',id:'capture',epoch:before.epoch,revision:before.revision,archive};
   const races=await Promise.allSettled([one.commit(capture),two.commit({...capture,id:'other',archive:await api.recoveryArchive('{"README.md":{"0":"other"}}')})]);
   if(races.filter(r=>r.status==='fulfilled').length!==1)throw Error('CAS race lost');
   let root=await one.read();
   root=await one.commit({type:'bind',id:'bind',epoch:root.epoch,revision:root.revision,source:'selection:synthetic',label:'README.md'});
   const doc=root.documents[0];
   const associate={type:'associate',id:'attach',epoch:root.epoch,revision:root.revision,archiveId:root.archives[0].id,addresses:root.archives[0].occurrences.map(o=>o.address),documentId:doc.id,documentRevision:doc.revision};
   root=await one.commit(associate);const retry=await two.commit(associate);
   if(retry.revision!==root.revision||retry.documents[0].notes.length!==2)throw Error('retry duplicated');
   const raw='\\ufeff\\r\\n{"text":"'+String.fromCharCode(0xd800)+'😀"}\\r\\n';
   const exact=await api.recoveryArchive(raw);const original=await api.recoveryArchive(new Uint8Array([255,254,0,216,99]));
   const packed=await api.recoveryPack([exact,original]);
   // Exercise actual file bytes: main saves and reselects the transport below.
   window.syntheticBackup=Array.from(packed);
   const restored=await api.recoveryUnpack(packed);
   if(restored[0].raw!==raw||restored[1].bytes.join()!=='255,254,0,216,99')throw Error('byte fidelity');
   const changed=packed.slice();changed[changed.length-1]^=1;
   let tamper=false;try{await api.recoveryUnpack(changed);}catch{tamper=true;}if(!tamper)throw Error('tamper accepted');
   const first=root.documents[0].notes[0];
   root=await one.commit({type:'edit',id:'edit',epoch:root.epoch,revision:root.revision,documentId:doc.id,documentRevision:root.documents[0].revision,noteId:first.id,text:'newer edit'});
   root=await one.commit({type:'undo',id:'undo',epoch:root.epoch,revision:root.revision,operationId:'attach'});
   if(root.documents[0].notes.length!==1||root.documents[0].notes[0].text!=='newer edit'||root.operations.at(-1).conflicts.length!==1)throw Error('undo erased newer work');
   // Abort during authoritative transaction; root and ledger must be identical.
   const stable=JSON.stringify(root);
   let failed=false;try{await one.commit({type:'add',id:'bad',epoch:root.epoch,revision:root.revision,documentId:doc.id,documentRevision:root.documents[0].revision,note:{text:'x'.repeat(16385)}});}catch{failed=true;}
   if(!failed||JSON.stringify(await two.read())!==stable)throw Error('failed transaction changed root');
   one.close();two.close();const reopened=await api.recoveryOpen(name);if(JSON.stringify(await reopened.read())!==stable)throw Error('restart lost state');
   reopened.close();
   return {race:races.map(r=>r.status),retryRevision:retry.revision,undoNotes:root.documents[0].notes.length,undoConflicts:root.operations.at(-1).conflicts.length,bytes:packed.length,epoch:root.epoch,database:name};
  })()`);
    const bytes = await window.webContents.executeJavaScript(
      'window.syntheticBackup'
    );
    const backup = path.join(profile, 'synthetic-recovery.sdr');
    fs.writeFileSync(backup, Buffer.from(bytes));
    const reselected = [...fs.readFileSync(backup)];
    probeData.set(window.webContents, 'reselected', reselected);
    const verified = await window.webContents.executeJavaScript(
      `(async()=>{const api=await import('/src/features/annotation-recovery.js');return (await api.recoveryUnpack(new Uint8Array(await window.recoveryProbeData.get('reselected')))).map(a=>({id:a.id,kind:a.kind,bytes:a.bytes.length,units:a.raw?.length}));})()`
    );
    console.log(
      JSON.stringify(
        {
          runtime: process.versions,
          evidence: result,
          reselected: verified,
          profile,
          backup,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    window.destroy();
    app.quit();
  }
});
