// Two actual renderer windows, same disposable partition and IndexedDB authority.
const { app, BrowserWindow, ipcMain } = require('electron');
const { installRecoveryProbeData } = require('./helpers/recovery-probe-data');
const fs = require('fs');
const os = require('os');
const path = require('path');
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), 'specdown-synthetic-windows-')
);
app.setPath('userData', profile);
const probeData = installRecoveryProbeData(ipcMain, profile);
app.whenReady().then(async () => {
  const windows = [0, 1].map(
    () =>
      new BrowserWindow({
        show: false,
        webPreferences: {
          preload: probeData.preload,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      })
  );
  try {
    await Promise.all(
      windows.map((w) =>
        w.loadURL(
          process.env.SPECDOWN_RECOVERY_TEST_URL || 'http://127.0.0.1:5192'
        )
      )
    );
    const name = 'two-windows-' + Date.now();
    windows.forEach((w) => probeData.set(w.webContents, 'database', name));
    await Promise.all(
      windows.map((w) =>
        w.webContents.executeJavaScript(
          `(async()=>{window.api=await import('/src/features/annotation-recovery.js');window.store=await api.recoveryOpen(await window.recoveryProbeData.get('database'));})()`
        )
      )
    );
    const setup = await windows[0].webContents.executeJavaScript(
      `(async()=>{let r=await store.read();const write=async command=>{r=await store.commit({...command,epoch:r.epoch,revision:r.revision});};const archive=await api.recoveryArchive('{"README.md":{"0":"a","1":"b"}}');await write({type:'capture',id:'capture',archive});await write({type:'bind',id:'bindA',source:'synthetic:A',label:'A'});await write({type:'bind',id:'bindB',source:'synthetic:B',label:'B'});await write({type:'add',id:'originalB',documentId:r.documents[1].id,documentRevision:0,note:{text:'original'}});return {epoch:r.epoch,revision:r.revision,archiveId:archive.id,address:archive.occurrences[0].address,a:r.documents[0].id,b:r.documents[1].id,noteB:r.documents[1].notes[0].id};})()`
    );
    const attempts = [];
    async function race(commands) {
      const shared = await windows[0].webContents.executeJavaScript(
        '(async()=>{const r=await store.read();return {epoch:r.epoch,revision:r.revision,revisions:Object.fromEntries(r.documents.map(d=>[d.id,d.revision]))};})()'
      );
      windows.forEach((w, i) =>
        probeData.set(w.webContents, 'race', {
          draft: commands[i].text || 'selected occurrence',
          command: {
            ...commands[i],
            epoch: shared.epoch,
            revision: shared.revision,
            documentRevision: shared.revisions[commands[i].documentId],
          },
        })
      );
      const results = await Promise.allSettled(
        windows.map((w) =>
          w.webContents.executeJavaScript(
            `(async()=>{const fixture=await window.recoveryProbeData.get('race');window.draft=fixture.draft;window.command=fixture.command;await api.recoveryPreparedCommit(store,command);return 'committed';})()`
          )
        )
      );
      if (results.filter((r) => r.status === 'fulfilled').length !== 1)
        throw Error('Expected one CAS winner');
      const loser = results.findIndex((r) => r.status === 'rejected');
      const retained =
        await windows[loser].webContents.executeJavaScript('window.draft');
      await windows[loser].webContents.executeJavaScript(
        `(async()=>{const r=await store.read();command={...command,epoch:r.epoch,revision:r.revision,documentRevision:command.documentId ? r.documents.find(d=>d.id===command.documentId).revision : undefined};await api.recoveryPreparedCommit(store,command);})()`
      );
      attempts.push({
        outcomes: results.map((r) => r.status),
        loserDraft: retained,
      });
    }
    await race([
      {
        type: 'associate',
        id: 'attachA',
        documentId: setup.a,
        archiveId: setup.archiveId,
        addresses: [setup.address],
      },
      {
        type: 'edit',
        id: 'editB',
        documentId: setup.b,
        noteId: setup.noteB,
        text: 'unrelated edit',
      },
    ]);
    await race([
      { type: 'undo', id: 'undoA', operationId: 'attachA' },
      {
        type: 'edit',
        id: 'laterB',
        documentId: setup.b,
        noteId: setup.noteB,
        text: 'later unrelated edit',
      },
    ]);
    probeData.set(windows[0].webContents, 'setup', setup);
    const final = await windows[0].webContents.executeJavaScript(
      `(async()=>{const setup=await window.recoveryProbeData.get('setup');const r=await store.read();return {a:r.documents.find(d=>d.id===setup.a).notes.length,b:r.documents.find(d=>d.id===setup.b).notes[0].text,rawOccurrences:r.archives[0].occurrences.length,attachCount:r.operations.filter(o=>o.id==='attachA').length,undoCount:r.operations.filter(o=>o.id==='undoA').length};})()`
    );
    if (
      final.a !== 0 ||
      final.b !== 'later unrelated edit' ||
      final.attachCount !== 1 ||
      final.undoCount !== 1 ||
      final.rawOccurrences !== 2
    )
      throw Error('Concurrent operation lost work');
    console.log(
      JSON.stringify(
        { electron: process.versions.electron, attempts, final, profile },
        null,
        2
      )
    );
    windows.forEach((w) => w.destroy());
    app.quit();
  } catch (error) {
    console.error(error);
    windows.forEach((w) => w.destroy());
    app.exit(1);
  }
});
