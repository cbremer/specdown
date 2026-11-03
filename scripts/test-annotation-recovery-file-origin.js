// Stock Electron, production Vite bundle, real preload, synthetic native grant,
// durable identity registry and actual file:// IndexedDB/download transport.
const { app, BrowserWindow } = require('electron');
const { pathToFileURL } = require('url');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDirectAccess } = require('../desktop/direct-access');
const { createAnnotationIdentity } = require('../desktop/annotation-identity');
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), 'specdown-synthetic-file-origin-')
);
app.setPath('userData', profile);
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../desktop/preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [
        '--specdown-app-url=' +
          pathToFileURL(
            path.join(__dirname, '../markdown-viewer/dist/index.html')
          ).href,
      ],
    },
  });
  const source = path.join(profile, 'README.md');
  const backup = path.join(profile, 'native-private.sdr');
  fs.writeFileSync(source, 'Native synthetic paragraph');
  let download;
  window.webContents.session.on('will-download', (_event, item) => {
    item.setSavePath(backup);
    download = new Promise((yes, no) =>
      item.once('done', (_e, state) =>
        state === 'completed' ? yes(state) : no(Error(state))
      )
    );
  });
  try {
    await window.loadFile(
      path.join(__dirname, '../markdown-viewer/dist/index.html')
    );
    const access = createDirectAccess();
    access.noteUserIntent(source, 'file');
    const registry = createAnnotationIdentity(
      path.join(profile, 'identity.sqlite')
    );
    const document = access.withAccess(source, (resolved) => ({
      content: fs.readFileSync(resolved, 'utf8'),
      annotationSource: registry.afterAuthorizedRead(resolved),
    }));
    if (!document.ok || !document.value.annotationSource)
      throw Error('Authorized native identity unavailable');
    window.webContents.send('file-opened', {
      filename: 'README.md',
      filePath: source,
      ...document.value,
      openReceipt: 'synthetic-receipt',
    });
    await window.webContents.executeJavaScript(
      `window.probeReadRoot=()=>new Promise((yes,no)=>{const request=indexedDB.open('specdown-annotation-recovery-v1',1);request.onerror=()=>no(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('authority','readonly');const get=tx.objectStore('authority').get('root');get.onsuccess=()=>yes(get.result);get.onerror=()=>no(get.error);tx.oncomplete=()=>db.close();};});void 0;`
    );
    const evaluate = (expression) =>
      window.webContents.executeJavaScript(`(async()=>(${expression}))()`);
    async function until(expression) {
      for (let i = 0; i < 200; i++) {
        if (await evaluate(expression)) return;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw Error('Timed out ' + expression);
    }
    await until(
      "document.querySelector('#markdown-content p') && (await window.probeReadRoot())?.documents?.[0]?.sourceRevision"
    );
    await evaluate(
      `(()=>{document.getElementById('annotation-toggle').click();document.querySelector('#markdown-content p').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));const editor=document.getElementById('annotation-editor-backdrop');if(!editor)throw Error('Native editor unavailable');editor.querySelector('textarea').value='native durable note';editor.querySelector('.annotation-editor-save').click();})()`
    );
    await until(
      '(await window.probeReadRoot()).documents[0].notes.length===1 && (await window.probeReadRoot()).requests.every(r=>r.acknowledged)'
    );
    const saved = await evaluate(
      `(async()=>{const root=await window.probeReadRoot();return {protocol:location.protocol,isDesktop:window.specdown.isDesktop,source:root.bindings[0].source,notes:root.documents[0].notes.map(n=>n.text),requests:root.requests.map(r=>({status:r.status,acknowledged:r.acknowledged}))};})()`
    );
    if (
      !saved.source.includes(document.value.annotationSource.authorityId) ||
      !saved.source.includes(document.value.annotationSource.sourceToken)
    )
      throw Error('Native read descriptor lost');
    await evaluate(
      `(()=>{document.querySelector('.tab-close').click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',metaKey:true,bubbles:true}));})()`
    );
    await until("document.querySelector('.command-palette')");
    await evaluate(
      `(()=>{const item=[...document.querySelectorAll('.command-palette-item')].find(e=>e.textContent.includes('Unassigned notes and recovery'));if(!item)throw Error('Global recovery command missing after closing source');item.dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));item.click();})()`
    );
    await until(
      "[...document.querySelectorAll('button')].some(b=>b.textContent==='Export private backup')"
    );
    await evaluate(
      `[...document.querySelectorAll('button')].find(b=>b.textContent==='Export private backup').click()`
    );
    for (let i = 0; i < 200 && !download; i++)
      await new Promise((r) => setTimeout(r, 20));
    if (!download) throw Error('Native download not initiated');
    await download;
    const bytes = fs.readFileSync(backup);
    if (bytes.subarray(0, 4).toString() !== 'SDR1')
      throw Error('Invalid native backup');
    await evaluate(
      `[...document.querySelectorAll('button')].find(b=>b.textContent==='Restore backup or raw file').click()`
    );
    window.webContents.debugger.attach('1.3');
    const tree =
      await window.webContents.debugger.sendCommand('DOM.getDocument');
    const input = await window.webContents.debugger.sendCommand(
      'DOM.querySelector',
      {
        nodeId: tree.root.nodeId,
        selector: 'input[type=file][accept=".sdr,.json,.bin,.utf16le"]',
      }
    );
    await window.webContents.debugger.sendCommand('DOM.setFileInputFiles', {
      nodeId: input.nodeId,
      files: [backup],
    });
    await until(
      "document.querySelector('[aria-label=\"Unassigned notes and recovery\"] [role=status]').textContent.includes('Verified file archived')"
    );
    const restored = await evaluate(
      `(async()=>{const root=await window.probeReadRoot();return {documents:root.documents.length,bindings:root.bindings.length,archives:root.archives.length,container:root.archives.filter(a=>a.containerRecipe).length,notes:root.documents[0].notes.length};})()`
    );
    console.log(
      JSON.stringify(
        {
          electron: process.versions.electron,
          saved,
          download: { backup, bytes: bytes.length },
          restored,
          profile,
        },
        null,
        2
      )
    );
    registry.close();
    window.destroy();
    app.quit();
  } catch (error) {
    console.error(error);
    window.destroy();
    app.exit(1);
  }
});
