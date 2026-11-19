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
    const word = path.join(fixture, 'Report.docx');
    const wordBytes = fs.readFileSync(
      path.join(__dirname, '../tests/fixtures/word-import.docx')
    );
    fs.writeFileSync(word, wordBytes);
    let offeredWord = false;
    dialog.showOpenDialog = async (_window, options) => {
      offeredWord = options.filters.some((filter) =>
        filter.extensions.includes('docx')
      );
      return { canceled: false, filePaths: [word] };
    };
    await js("document.getElementById('browse-button').click()");
    await until(
      async () =>
        await js(
          "document.querySelector('#markdown-content h1')?.textContent==='Synthetic heading'"
        ),
      'DOCX reading view from Open File'
    );
    assert.ok(offeredWord);
    await js("document.getElementById('source-edit').click()");
    const imported = await js(
      "document.querySelector('#source-editor-host textarea:not([hidden])').value"
    );
    assert.match(imported, /INSERTED/);
    assert.doesNotMatch(imported, /DELETED/);
    assert.match(imported, /Cell two/);
    await edit(imported + 'Edited on desktop');
    const wordOutput = path.join(fixture, 'Report.md');
    const alias = path.join(fixture, 'linked.md');
    fs.symlinkSync(word, alias);
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: alias });
    await js("document.getElementById('source-save').click()");
    await until(
      async () =>
        await js(
          "document.getElementById('source-status').textContent==='Unsaved changes'"
        ),
      'Word alias rejected and draft retained'
    );
    assert.deepEqual(fs.readFileSync(word), wordBytes);
    let suggestedName;
    dialog.showSaveDialog = async (_window, options) => {
      suggestedName = options.defaultPath;
      return { canceled: false, filePath: wordOutput };
    };
    assert.equal(
      await js("document.getElementById('source-save').textContent"),
      'Save as Markdown…'
    );
    await js("document.getElementById('source-save').click()");
    await until(
      () => fs.existsSync(wordOutput),
      'Word edits saved as Markdown'
    );
    assert.equal(suggestedName, 'Report.md');
    assert.equal(
      fs.readFileSync(wordOutput, 'utf8'),
      imported + 'Edited on desktop'
    );
    assert.deepEqual(fs.readFileSync(word), wordBytes);
    for (const kind of ['text', 'columns', 'mixed', 'scanned']) {
      const name = 'pdf-' + kind + '.pdf';
      const pdf = path.join(fixture, name);
      const pdfBytes = fs.readFileSync(
        path.join(__dirname, '../tests/fixtures', name)
      );
      fs.writeFileSync(pdf, pdfBytes);
      let offeredPdf = false;
      dialog.showOpenDialog = async (_window, options) => {
        offeredPdf = options.filters.some((filter) =>
          filter.extensions.includes('pdf')
        );
        return { canceled: false, filePaths: [pdf] };
      };
      await js("document.getElementById('browse-button').click()");
      if (kind === 'scanned') {
        await until(
          async () =>
            await js(
              "document.getElementById('toast-region')?.textContent.includes('has no selectable text. Run OCR')"
            ),
          'scanned PDF explanation'
        );
        assert.equal(
          await js("document.getElementById('file-name').textContent"),
          'pdf-mixed.md'
        );
        continue;
      }
      await until(
        async () =>
          (await js("document.getElementById('file-name').textContent")) ===
          name,
        'PDF reading view: ' + kind
      );
      assert.ok(offeredPdf);
      await js("document.getElementById('source-edit').click()");
      const source = await js(
        "document.querySelector('#source-editor-host textarea:not([hidden])').value"
      );
      assert.match(source, /Project review notes/);
      if (kind === 'columns') {
        for (const text of [
          'Left column first',
          'Left column second',
          'Right column first',
          'Right column second',
          'Account',
          'Amount',
          'Research',
          '150',
        ])
          assert.ok(source.includes(text));
        assert.ok(
          source.indexOf('Left column second') <
            source.indexOf('Right column first')
        );
        continue;
      }
      if (kind === 'text') {
        assert.doesNotMatch(source, /OCR/);
        continue;
      }
      assert.match(source, /Page 2 has no selectable text.*OCR/);
      assert.ok(
        source.indexOf('Page 2') < source.indexOf('Final selectable paragraph')
      );
      await edit(source + 'Edited PDF text');
      const output = path.join(fixture, 'pdf-mixed.md');
      dialog.showSaveDialog = async (_window, options) => {
        assert.equal(options.defaultPath, 'pdf-mixed.md');
        return { canceled: false, filePath: output };
      };
      await js("document.getElementById('source-save').click()");
      await until(
        async () =>
          await js(
            "document.getElementById('file-name').textContent==='pdf-mixed.md'"
          ),
        'PDF to Markdown copy'
      );
      assert.equal(fs.readFileSync(output, 'utf8'), source + 'Edited PDF text');
      assert.deepEqual(fs.readFileSync(pdf), pdfBytes);
    }
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
          'text, mixed and scanned PDFs; export edited Markdown',
          'Open File DOCX to independent Markdown copy',
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
