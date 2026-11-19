// Real Electron UI/IPC + synthetic files and an isolated profile. The save
// chooser is deterministic; native chooser interaction remains owner acceptance.
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const assert = require('assert/strict');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-edit-probe-'));
app.setName('SpecDown Editing Probe');
app.setPath('userData', path.join(fixture, 'profile'));
process.env.SPECDOWN_DISABLE_UPDATER = '1';
const filename = path.resolve(__dirname, '../desktop/main.js');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(
  fs.readFileSync(filename, 'utf8') +
    '\nmodule.exports.probeOpen = openFileByPath;',
  filename
);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label) {
  const deadline = Date.now() + 15000;
  while (!(await check())) {
    assert.ok(Date.now() < deadline, 'Timed out: ' + label);
    await delay(50);
  }
}
app.whenReady().then(async () => {
  try {
    await until(() => BrowserWindow.getAllWindows().length, 'window');
    const win = BrowserWindow.getAllWindows()[0];
    const js = (code) => win.webContents.executeJavaScript(code, true);
    win.webContents.on('console-message', (event) => {
      if (event.level === 'error') console.log('renderer:', event.message);
    });
    win.webContents.on('render-process-gone', (_e, details) =>
      console.log('renderer gone', details)
    );
    await until(
      async () => await js("typeof window.loadFileContent==='function'"),
      'viewer'
    );
    const original = '# Original\r\n\r\n  tail  \r\n';
    const target = path.join(fixture, 'source.md');
    fs.writeFileSync(target, original);
    loaded.exports.fileAccess.noteUserIntent(target, 'file');
    assert.equal(loaded.exports.probeOpen(target), true);
    await until(
      async () =>
        await js(
          "document.getElementById('file-name').textContent==='source.md'"
        ),
      'open'
    );
    const originalIdentity =
      loaded.exports.readMarkdownFile(target).annotationSource;
    const edit = async (text) => {
      await js(
        "if(document.getElementById('source-editor-host').hidden) document.getElementById(document.getElementById('source-editor-bar').hidden?'source-edit':'source-source').click()"
      );
      await js(
        `(()=>{const input=document.querySelector('#source-editor-host textarea:not([hidden])'); input.focus(); input.select(); document.execCommand('insertText',false,${JSON.stringify(text)});})()`
      );
    };
    await edit('# Changed');
    assert.equal(
      await js(
        "!!document.getElementById('source-editor-bar').closest('.content-header')"
      ),
      true
    );
    assert.equal(
      await js(
        "document.getElementById('source-save').getBoundingClientRect().height"
      ),
      32
    );
    assert.equal(
      await js(
        "document.querySelector('#source-more svg').getBoundingClientRect().width"
      ),
      16
    );
    await js("document.execCommand('undo')");
    assert.equal(
      await js("document.getElementById('source-status').textContent"),
      'No unsaved changes'
    );
    await js("document.execCommand('redo')");
    assert.equal(
      await js("document.getElementById('source-status').textContent"),
      'Unsaved changes'
    );
    await js(
      "document.querySelector('#source-editor-host textarea:not([hidden])').value='# Changed\\n\\n  tail  \\n'; document.querySelector('#source-editor-host textarea:not([hidden])').dispatchEvent(new Event('input')); document.getElementById('source-preview').click()"
    );
    await until(
      async () =>
        await js(
          "document.getElementById('markdown-content').textContent.includes('Changed')"
        ),
      'preview'
    );
    await js("document.getElementById('source-save').click()");
    await until(
      () => fs.readFileSync(target, 'utf8') === '# Changed\r\n\r\n  tail  \r\n',
      'saved bytes'
    );
    await until(
      async () =>
        await js(
          "document.getElementById('source-status').textContent==='No unsaved changes'"
        ),
      'save acknowledgment'
    );
    assert.deepEqual(
      loaded.exports.readMarkdownFile(target).annotationSource,
      originalIdentity
    );
    await edit('# My draft');
    fs.writeFileSync(target, '# External');
    await js("document.getElementById('source-save').click()");
    await until(
      async () =>
        await js("!!document.querySelector('[data-editor-choice=overwrite]')"),
      'conflict'
    );
    assert.equal(fs.readFileSync(target, 'utf8'), '# External');
    await js(
      "document.querySelector('[data-editor-choice=overwrite]').click()"
    );
    await until(
      () => fs.readFileSync(target, 'utf8') === '# My draft',
      'explicit overwrite'
    );
    await until(
      async () =>
        await js(
          "document.getElementById('source-status').textContent==='No unsaved changes'"
        ),
      'acknowledgment'
    );
    await edit('# Recover me');
    await js(
      "document.getElementById('source-more').click(); document.getElementById('source-return').click()"
    );
    await until(
      async () =>
        await js(
          "document.getElementById('source-editor-bar').hidden && document.getElementById('source-edit').textContent==='Resume editing'"
        ),
      'return to reading'
    );
    assert.equal(fs.readFileSync(target, 'utf8'), '# My draft');
    assert.equal(
      await js(
        "localStorage.getItem('specdown.sourceDrafts.v1').includes('# Recover me')"
      ),
      true
    );
    await js("document.getElementById('source-edit').click()");
    assert.equal(
      await js(
        "document.querySelector('#source-editor-host textarea:not([hidden])').value"
      ),
      '# Recover me'
    );
    win.webContents.once('will-prevent-unload', (event) =>
      event.preventDefault()
    );
    win.webContents.reload();
    await until(
      async () =>
        await js(
          "typeof window.loadFileContent==='function' && !document.getElementById('source-recover').hidden"
        ),
      'restart recovery'
    );
    assert.equal(fs.readFileSync(target, 'utf8'), '# My draft');
    await js("document.getElementById('source-recover').click()");
    await until(
      async () =>
        await js("!!document.querySelector('[data-editor-choice=restore]')"),
      'restore choice'
    );
    await js("document.querySelector('[data-editor-choice=restore]').click()");
    await until(
      async () =>
        await js(
          "document.querySelector('#source-editor-host textarea:not([hidden])')?.value==='# Recover me'"
        ),
      'recovered draft'
    );
    const copy = path.join(fixture, 'copy.md');
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: copy });
    await js("document.getElementById('source-save-as').click()");
    await until(() => fs.existsSync(copy), 'copy saved');
    assert.notEqual(
      loaded.exports.readMarkdownFile(copy).annotationSource?.sourceToken,
      originalIdentity?.sourceToken
    );
    assert.equal(fs.readFileSync(copy, 'utf8'), '# Recover me');
    assert.equal(fs.readFileSync(target, 'utf8'), '# My draft');
    await until(
      async () =>
        await js(
          "document.getElementById('file-name').textContent==='copy.md'"
        ),
      'independent saved copy'
    );
    await edit('# canceled destination');
    dialog.showSaveDialog = async () => ({ canceled: true });
    await js("document.getElementById('source-save-as').click()");
    await delay(200);
    assert.equal(
      await js("document.getElementById('source-status').textContent"),
      'Unsaved changes'
    );
    assert.equal(fs.readFileSync(copy, 'utf8'), '# Recover me');
    await edit('# Mermaid\n\n```mermaid\ngraph TD\n A-->B\n```\n');
    await js("document.getElementById('source-preview').click()");
    await until(
      async () =>
        await js(
          "!!document.querySelector('#markdown-content svg[data-mermaid-source]')"
        ),
      'real Mermaid preview'
    );
    await js(
      "document.getElementById('source-more').click(); document.getElementById('source-cancel').click()"
    );
    const discardLayout = await js(
      "(()=>{ const d=document.querySelector('dialog[open]'), r=d.getBoundingClientRect(), s=getComputedStyle(d); return {left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height, viewportWidth:innerWidth, viewportHeight:innerHeight, padding:parseFloat(s.padding)}; })()"
    );
    assert.ok(
      discardLayout.padding >= 16,
      'Confirmation needs interior spacing'
    );
    assert.ok(
      Math.abs(
        discardLayout.left -
          (discardLayout.viewportWidth - discardLayout.width) / 2
      ) <= 2,
      'Confirmation must be horizontally centered'
    );
    assert.ok(
      Math.abs(
        discardLayout.top -
          (discardLayout.viewportHeight - discardLayout.height) / 2
      ) <= 2,
      'Confirmation must be vertically centered'
    );
    await js("document.querySelector('[data-editor-choice=keep]').click()");
    assert.equal(
      await js("document.getElementById('source-status').textContent"),
      'Unsaved changes'
    );
    await js(
      "document.getElementById('source-more').click(); document.getElementById('source-cancel').click(); document.querySelector('[data-editor-choice=discard]').click()"
    );
    await until(
      async () =>
        await js(
          "document.getElementById('source-editor-bar').hidden && document.getElementById('markdown-content').textContent.includes('Recover me')"
        ),
      'discard restores saved reading view'
    );
    assert.equal(fs.readFileSync(copy, 'utf8'), '# Recover me');
    const screenshot = path.join(fixture, 'desktop-preview.png');
    fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
    console.log(
      JSON.stringify({
        result: 'PASS',
        cases: [
          'open/edit',
          'native undo/redo',
          'draft preview',
          'save/reopen bytes',
          'conflict/explicit overwrite',
          'restart/explicit recovery',
          'independent Save As',
          'canceled destination',
          'real Mermaid',
        ],
        screenshot,
      })
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
