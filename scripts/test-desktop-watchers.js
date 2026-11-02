// Real filesystem regression checks, isolated from Electron and user data.
// Each child loads the production main module with only native UI surfaces
// replaced. Chokidar, file grants, document reads and fs.watchFile stay real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { execFile } = require('node:child_process');
const { once } = require('node:events');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');

const modes = ['native', 'polling', 'mas-polling'];

async function waitFor(predicate, label, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, `Timed out: ${label}`);
    await delay(25);
  }
}

function loadMain(fixture, mode, delivered) {
  const handlers = new Map();
  const forbidden = () => {
    throw new Error('Native UI or owner data access is forbidden in this test');
  };
  const electron = {
    app: {
      name: 'SpecDown Watcher Test',
      whenReady: () => new Promise(() => {}),
      on: () => {},
      getPath: forbidden,
      addRecentDocument: forbidden,
    },
    BrowserWindow: Object.assign(forbidden, { getAllWindows: () => [] }),
    Menu: { buildFromTemplate: (value) => value, setApplicationMenu: () => {} },
    dialog: { showOpenDialog: forbidden, showMessageBox: forbidden },
    ipcMain: {
      on: (name, handler) => handlers.set(name, handler),
      handle: () => {},
    },
    globalShortcut: {},
    shell: {},
  };
  const filename = path.resolve(__dirname, '../desktop/main.js');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const realRequire = loaded.require.bind(loaded);
  loaded.require = (name) => {
    if (name === 'electron') return electron;
    // MAS-style host polling uses session grants. No bookmark addon, keychain,
    // provisioned sandbox, saved owner grants or native application is used.
    if (name === './mas-access')
      return { ...realRequire(name), loadMasNative: () => null };
    return realRequire(name);
  };
  process.mas = mode === 'mas-polling';
  process.env.SPECDOWN_WATCH_POLLING = mode === 'polling' ? '1' : '0';
  // Test-only accessors are appended in memory, never to shipped source.
  loaded._compile(
    fs.readFileSync(filename, 'utf8') +
      `
module.exports.watcherTest = {
  dirWatchers,
  attach(window, testStore) {
    mainWindow = window;
    store = testStore;
    workspacePageToken = 'watcher-test-page';
  }
};`,
    filename
  );
  const main = loaded.exports;
  const frame = { url: main.APP_INDEX_URL, detached: false, send: () => {} };
  const wc = {
    mainFrame: frame,
    isDestroyed: () => false,
    isLoadingMainFrame: () => false,
    send: (channel, value) => {
      if (channel === 'file-changed') delivered.push(value);
    },
  };
  const saved = new Map([
    ['session', { tabs: [{ filePath: path.join(fixture, 'a.md') }] }],
    ['syntheticNotes', [{ text: 'Retain this note' }]],
  ]);
  main.watcherTest.attach(
    { webContents: wc },
    {
      get: (key, fallback) => (saved.has(key) ? saved.get(key) : fallback),
      set: (key, value) => saved.set(key, value),
    }
  );
  return {
    main,
    saved,
    closeFolder: () =>
      handlers.get('request-close-workspace')(
        { sender: wc, senderFrame: frame },
        { pageToken: 'watcher-test-page' }
      ),
  };
}

async function checkMode(mode) {
  const fixture = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-watchers-'))
  );
  const delivered = [];
  const checks = [];
  const a = path.join(fixture, 'a.md');
  const b = path.join(fixture, 'b.md');
  fs.writeFileSync(a, '# Original A');
  fs.writeFileSync(b, '# Original B');
  const { main, saved, closeFolder } = loadMain(fixture, mode, delivered);
  const allNativeWatchers = new Set();
  const watcherErrors = [];
  const checkpoint = (name) => checks.push(name);
  const changed = async (
    file,
    content,
    operation = () => fs.writeFileSync(file, content)
  ) => {
    const start = delivered.length;
    operation();
    await waitFor(
      () =>
        delivered
          .slice(start)
          .some(
            (value) => value.filePath === file && value.content === content
          ),
      `${mode}: ${content}`
    );
  };
  const quiet = async (operation) => {
    const start = delivered.length;
    operation();
    // Covers the production MAS 1000ms and Chokidar 500ms poll intervals.
    await delay(1500);
    assert.equal(
      delivered.length,
      start,
      `${mode}: unexpected document notification`
    );
  };
  const ready = async () => {
    if (mode === 'mas-polling') {
      await delay(1100);
      return;
    }
    const watcher = main.watcherTest.dirWatchers.get(fixture).watcher;
    allNativeWatchers.add(watcher);
    watcher.on('error', (error) => watcherErrors.push(error.message));
    assert.equal(
      watcher.options.backend,
      mode === 'polling' ? 'polling' : 'auto'
    );
    assert.equal(
      watcher.options.pollingInterval,
      mode === 'polling' ? 500 : 100
    );
    assert.equal(watcher.options.depth, 0);
    await once(watcher, 'ready', { signal: AbortSignal.timeout(8000) });
  };
  try {
    main.watchFile(a);
    assert.equal(main.watchers.size + main.pollWatchers.size, 0);
    checkpoint('ungranted file cannot start a watcher');
    for (const file of [a, b]) main.fileAccess.noteUserIntent(file, 'file');
    main.watchFile(a);
    main.watchFile(b);
    const oldWatcher =
      mode === 'mas-polling'
        ? null
        : main.watcherTest.dirWatchers.get(fixture).watcher;
    await ready();
    if (mode === 'mas-polling') {
      assert.equal(main.watcherTest.dirWatchers.size, 0);
      assert.equal(main.pollWatchers.size, 2);
    } else {
      assert.equal(main.watcherTest.dirWatchers.size, 1);
      assert.equal(main.watchers.size, 2);
    }
    checkpoint('correct backend and shared directory subscription');
    assert.equal(delivered.length, 0);
    checkpoint('initial files do not trigger refresh');
    await changed(a, '# In place');
    checkpoint('in-place write delivers complete document');
    for (let i = 0; i < 3; i++) {
      const content = `# Atomic replacement ${i}`;
      await changed(a, content, () => {
        const temporary = path.join(fixture, `replacement-${i}.tmp`);
        fs.writeFileSync(temporary, content);
        fs.renameSync(temporary, a);
      });
    }
    checkpoint('three same-path atomic inode replacements keep watching');
    await quiet(() => fs.unlinkSync(a));
    await changed(a, '# Recreated after delete');
    checkpoint('deleted file stays quiet and recreation resumes');
    const moved = path.join(fixture, 'moved.md');
    await quiet(() => {
      fs.renameSync(a, moved);
      fs.writeFileSync(moved, '# Moved away');
    });
    await changed(a, '# Replacement at original path');
    checkpoint('move does not retarget a tab; original path can return');
    main.fileAccess.noteUserIntent(fixture, 'folder');
    main.openWorkspace(fixture);
    assert.equal(main.workspaceRoots.size, 1);
    const beforeClose = JSON.stringify([...saved]);
    closeFolder();
    assert.equal(main.workspaceRoots.size, 0);
    assert.equal(JSON.stringify([...saved]), beforeClose);
    await changed(a, '# Still live after Close Folder');
    checkpoint(
      'real Close Folder IPC preserves session, notes and active file watcher'
    );
    await quiet(() => {
      fs.writeFileSync(path.join(fixture, 'unwatched.md'), '# Not an open tab');
      fs.mkdirSync(path.join(fixture, 'nested'));
      fs.writeFileSync(
        path.join(fixture, 'nested', 'a.md'),
        '# Nested basename'
      );
    });
    checkpoint('unwatched sibling and nested basename do not refresh a tab');
    main.unwatchFile(a);
    await changed(b, '# Remaining shared subscription');
    checkpoint('closing one tab preserves the other file subscription');
    main.unwatchFile(b);
    assert.equal(main.watchers.size + main.pollWatchers.size, 0);
    // Reopen immediately, while the previous Chokidar close may be in flight.
    main.watchFile(a);
    if (oldWatcher)
      assert.notEqual(
        main.watcherTest.dirWatchers.get(fixture).watcher,
        oldWatcher
      );
    await ready();
    await changed(a, '# Fresh watcher after reopen');
    checkpoint('close/reopen creates a fresh functioning watcher');
    main.unwatchFile(a);
    await Promise.all([...allNativeWatchers].map((watcher) => watcher.close()));
    await quiet(() => fs.writeFileSync(a, '# Closed watchers stay closed'));
    assert.deepEqual(watcherErrors, []);
    checkpoint('final close stops delivery and releases subscriptions');
    return {
      mode,
      node: process.version,
      platform: process.platform,
      checks,
      passed: true,
    };
  } finally {
    for (const file of [...main.watchers.keys(), ...main.pollWatchers.keys()])
      main.unwatchFile(file);
    await Promise.all([...allNativeWatchers].map((watcher) => watcher.close()));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

async function run() {
  if (process.argv[2] === '--mode') {
    assert.ok(modes.includes(process.argv[3]));
    console.log(JSON.stringify(await checkMode(process.argv[3])));
    return;
  }
  const environment = { ...process.env };
  for (const key of Object.keys(environment))
    if (key.startsWith('CHOKIDAR_')) delete environment[key];
  const results = await Promise.all(
    modes.map(async (mode) => {
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [__filename, '--mode', mode],
        {
          env: environment,
          timeout: 60000,
          maxBuffer: 1024 * 1024,
        }
      );
      return JSON.parse(stdout.trim().split('\n').at(-1));
    })
  );
  console.log(JSON.stringify({ passed: true, results }, null, 2));
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
