// Disposable Chrome DevTools target only; launch Chrome with its own synthetic
// profile and remote-debugging-port=9302. No existing browser sessions are read.
const fs = require('fs');
const path = require('path');
const os = require('os');
const downloads = fs.mkdtempSync(
  path.join(os.tmpdir(), 'specdown-synthetic-download-')
);
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((yes, no) => {
    ws.onopen = yes;
    ws.onerror = no;
  });
  let next = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      const call = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) call.reject(new Error(JSON.stringify(msg.error)));
      else call.resolve(msg.result);
    }
  };
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++next;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      }),
    close: () => ws.close(),
  };
}
async function main() {
  const version = await (
    await fetch('http://127.0.0.1:9302/json/version')
  ).json();
  const browser = await connect(version.webSocketDebuggerUrl);
  async function pageFor(context) {
    const target = await browser.send('Target.createTarget', {
      url: process.env.SPECDOWN_RECOVERY_TEST_URL || 'http://127.0.0.1:5192',
      browserContextId: context.browserContextId,
    });
    const tabs = await (await fetch('http://127.0.0.1:9302/json/list')).json();
    return {
      target,
      client: await connect(
        tabs.find((t) => t.id === target.targetId).webSocketDebuggerUrl
      ),
    };
  }
  async function evaluate(page, expression) {
    const reply = await page.client.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (reply.exceptionDetails)
      throw Error(
        reply.exceptionDetails.exception?.description ||
          reply.exceptionDetails.text
      );
    return reply.result.value;
  }
  async function call(page, functionDeclaration, args = []) {
    const global = await page.client.send('Runtime.evaluate', {
      expression: 'globalThis',
    });
    const reply = await page.client.send('Runtime.callFunctionOn', {
      objectId: global.result.objectId,
      functionDeclaration,
      arguments: args.map((value) => ({ value })),
      awaitPromise: true,
      returnByValue: true,
    });
    if (reply.exceptionDetails)
      throw Error(
        reply.exceptionDetails.exception?.description ||
          reply.exceptionDetails.text
      );
    return reply.result.value;
  }
  async function openRecovery(page) {
    await evaluate(
      page,
      "document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',metaKey:true,bubbles:true}))"
    );
    await until(page, "document.querySelector('.command-palette')");
    await evaluate(
      page,
      "(()=>{const item=[...document.querySelectorAll('.command-palette-item')].find(e=>e.textContent.includes('Unassigned notes and recovery'));if(!item)throw Error('Configured recovery command missing');item.dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));item.click();})()"
    );
    await until(page, "document.querySelector('#annotation-recovery-body')");
  }
  async function until(page, expression) {
    for (let i = 0; i < 150; i++) {
      if (await evaluate(page, expression)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error('Timed out ' + expression);
  }
  async function click(page, text) {
    await call(
      page,
      "function(text){const button=[...document.querySelectorAll('button')].filter(b=>b.textContent===text).at(-1);if(!button)throw Error('Missing button '+text);button.click();}",
      [text]
    );
  }
  const firstContext = await browser.send('Target.createBrowserContext');
  const first = await pageFor(firstContext);
  await until(first, "document.readyState==='complete'");
  await browser.send('Browser.setDownloadBehavior', {
    browserContextId: firstContext.browserContextId,
    behavior: 'allow',
    downloadPath: downloads,
    eventsEnabled: true,
  });
  await until(first, "typeof window.loadFileContent==='function'");
  await call(
    first,
    "function(opaque){localStorage.setItem('visualTheme','default');localStorage.setItem('specdown-annotations','{\"README.md\":{\"01\":\"one\",\"1\":\"two\"}}');window.exactOpaque=opaque;if(!window.loadFileContent('Synthetic target paragraph','README.md'))throw Error('Public synthetic load rejected');}",
    ['\ufeff\r\n {"x":"\ud800\ud83d\ude00"}\r\n']
  );
  await until(
    first,
    "document.querySelector('#markdown-content p') && document.getElementById('annotation-toggle').dataset.annotationIdentity"
  );
  await openRecovery(first);
  await call(
    first,
    "function(){localStorage.setItem('specdown-annotations',window.exactOpaque);}"
  );
  await click(first, 'Capture legacy notes');
  await until(
    first,
    "document.querySelector('[aria-label=\"Unassigned notes and recovery\"] [role=status]').textContent.includes('Exact legacy snapshot preserved')"
  );
  await until(
    first,
    "[...document.querySelectorAll('#annotation-recovery-body button')].some(b=>b.textContent.includes('2 occurrences'))"
  );
  await evaluate(
    first,
    "[...document.querySelectorAll('#annotation-recovery-body button')].find(b=>b.textContent.includes('2 occurrences')).click()"
  );
  await evaluate(
    first,
    "document.querySelectorAll('#annotation-recovery-body input[type=checkbox]').forEach(b=>b.click())"
  );
  await click(first, 'Associate selected copies with captured target');
  await until(
    first,
    "document.querySelector('[aria-label=\"Unassigned notes and recovery\"] [role=status]').textContent.includes('Selected copies committed')"
  );
  await click(first, 'Edit copy');
  await evaluate(
    first,
    "document.querySelector('#annotation-recovery-body textarea:not([placeholder])').value='newer edit'"
  );
  await click(first, 'Save edit');
  await until(
    first,
    "document.querySelector('[aria-label=\"Unassigned notes and recovery\"] [role=status]').textContent.includes('Edit committed')"
  );
  await click(first, 'Export private backup');
  let backup;
  for (let i = 0; i < 150; i++) {
    backup = fs.readdirSync(downloads).find((n) => n.endsWith('.sdr'));
    if (backup) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!backup) throw Error('Download absent');
  const file = path.join(downloads, backup);
  const bytes = fs.readFileSync(file);
  if (bytes.subarray(0, 4).toString() !== 'SDR1') throw Error('Wrong download');
  await evaluate(
    first,
    "[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Undo associate ')).click()"
  );
  await until(
    first,
    "document.querySelector('[aria-label=\"Unassigned notes and recovery\"] [role=status]').textContent.includes('Undo preserved 1')"
  );
  const active = await evaluate(
    first,
    "(async()=>{const db=await(await import('/src/features/annotation-recovery.js')).recoveryOpen();const root=await db.read();db.close();return {notes:root.documents.flatMap(d=>d.notes).map(n=>n.text),rawExact:root.archives.some(a=>a.raw===window.exactOpaque),legacyExact:localStorage.getItem('specdown-annotations')===window.exactOpaque};})()"
  );
  const secondContext = await browser.send('Target.createBrowserContext');
  const second = await pageFor(secondContext);
  await until(second, "document.readyState==='complete'");
  await browser.send('Browser.setDownloadBehavior', {
    browserContextId: secondContext.browserContextId,
    behavior: 'allow',
    downloadPath: downloads,
    eventsEnabled: true,
  });
  await openRecovery(second);
  await click(second, 'Restore backup or raw file');
  await second.client.send('DOM.enable');
  const dom = await second.client.send('DOM.getDocument');
  const input = await second.client.send('DOM.querySelector', {
    nodeId: dom.root.nodeId,
    selector: 'input[type=file][accept=".sdr,.json,.bin,.utf16le"]',
  });
  await second.client.send('DOM.setFileInputFiles', {
    nodeId: input.nodeId,
    files: [file],
  });
  await until(
    second,
    "document.querySelector('[aria-label=\"Unassigned notes and recovery\"] [role=status]').textContent.includes('Verified file archived')"
  );
  const staged = await evaluate(
    second,
    "(async()=>{const db=await(await import('/src/features/annotation-recovery.js')).recoveryOpen();const root=await db.read();db.close();window.containerId=root.archives.find(a=>a.containerRecipe).id;return {archives:root.archives.length,documents:root.documents.length,bindings:root.bindings.length,opaque:root.archives.some(a=>a.raw?.includes(String.fromCharCode(0xd800)))};})()"
  );
  await evaluate(
    second,
    "(()=>{const row=[...document.querySelectorAll('#annotation-recovery-body button')].find(b=>b.textContent.startsWith(window.containerId.slice(0,35))).parentElement;[...row.querySelectorAll('button')].find(b=>b.textContent==='Export original').click();})()"
  );
  let original;
  for (let i = 0; i < 150; i++) {
    original = fs
      .readdirSync(downloads)
      .find((n) => n === 'specdown-original.bin');
    if (original) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (
    !original ||
    !fs.readFileSync(path.join(downloads, original)).equals(bytes)
  )
    throw Error('Original whole container bytes changed');
  await evaluate(
    second,
    "[...document.querySelectorAll('#annotation-recovery-body button')].find(b=>b.textContent.includes('supported private state')).click()"
  );
  await click(second, 'Preview explicit store replacement');
  await click(second, 'Confirm protected store replacement');
  await until(
    second,
    "document.querySelector('[aria-label=\"Unassigned notes and recovery\"] [role=status]').textContent.includes('Replacement committed')"
  );
  await evaluate(
    second,
    "[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Undo associate ')).click()"
  );
  await until(
    second,
    "document.querySelector('[aria-label=\"Unassigned notes and recovery\"] [role=status]').textContent.includes('Undo preserved 1')"
  );
  const recovered = await evaluate(
    second,
    "(async()=>{const db=await(await import('/src/features/annotation-recovery.js')).recoveryOpen();const root=await db.read();db.close();return {notes:root.documents.flatMap(d=>d.notes).map(n=>n.text),bindings:root.bindings.length,historicalAssociations:root.operations.filter(o=>o.restoredScope&&o.type==='associate').length,conflicts:root.operations.at(-1).conflicts.length};})()"
  );
  if (
    active.notes.join() !== 'newer edit' ||
    !active.rawExact ||
    !active.legacyExact ||
    staged.documents !== 0 ||
    staged.bindings !== 0 ||
    !staged.opaque ||
    recovered.notes.join() !== 'newer edit' ||
    recovered.bindings !== 0 ||
    recovered.historicalAssociations !== 1
  )
    throw Error('Unexpected recovered state');
  const screenshot = await second.client.send('Page.captureScreenshot', {
    format: 'png',
  });
  const preview = path.join(downloads, 'recovery-history.png');
  fs.writeFileSync(preview, Buffer.from(screenshot.data, 'base64'));
  console.log(
    JSON.stringify(
      {
        browser: version.Browser,
        active,
        download: { file, bytes: bytes.length, originalExact: true },
        staged,
        recovered,
        preview,
      },
      null,
      2
    )
  );
  await browser.send('Target.disposeBrowserContext', {
    browserContextId: firstContext.browserContextId,
  });
  await browser.send('Target.disposeBrowserContext', {
    browserContextId: secondContext.browserContextId,
  });
  first.client.close();
  second.client.close();
  browser.close();
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
