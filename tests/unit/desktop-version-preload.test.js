const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

const viewerUrl = 'file:///synthetic/index.html';
const preloadSource = fs.readFileSync(
  path.join(__dirname, '../../desktop/preload.js'),
  'utf8'
);

function exposePreload({
  mas = true,
  href = viewerUrl,
  versions = ['1.0.1'],
} = {}) {
  const exposed = new Map();
  vm.runInNewContext(preloadSource, {
    require: () => ({
      contextBridge: {
        exposeInMainWorld: (key, value) => exposed.set(key, value),
      },
      ipcRenderer: { on: jest.fn() },
    }),
    location: { href },
    process: {
      mas,
      platform: 'darwin',
      argv: [
        `--specdown-app-url=${viewerUrl}`,
        ...versions.map((value) => `--specdown-app-version=${value}`),
      ],
    },
    URL,
    module: { exports: {} },
  });
  return exposed;
}

test('the trusted MAS preload exposes the native version used by the real About dialog', () => {
  const exposed = exposePreload();
  expect(exposed.get('specdown').distribution).toBe('mas');
  expect(exposed.get('specdownAppVersion')).toBe('1.0.1');
  loadHTML(document);
  loadApp(document);
  window.specdownAppVersion = exposed.get('specdownAppVersion');
  try {
    setupVersionInfo('0.0.228');
    openAboutDialog();
    expect(document.getElementById('about-version').textContent).toBe(
      'Version 1.0.1 (0.0.228)'
    );
  } finally {
    closeAboutDialog();
    delete window.specdownAppVersion;
  }
});

test.each([false, null, 'true', 1])(
  'a non-MAS runtime (%p) gets no Store version even with the argument present',
  (mas) => {
    const exposed = exposePreload({ mas });
    expect(exposed.has('specdown')).toBe(true);
    expect(exposed.has('specdownAppVersion')).toBe(false);
  }
);

test.each(['https://example.test/index.html', 'file:///synthetic/other.html'])(
  'an untrusted page %s gets neither bridge nor Store version',
  (href) => expect(exposePreload({ href }).size).toBe(0)
);

test.each([
  [],
  ['1.0.1', '1.0.1'],
  ['1.0.1', '2.0.0'],
  [''],
  ['1'],
  ['1.0'],
  ['1.0.1.228'],
  ['1.0.1-beta'],
  ['10000.0.1'],
  [' 1.0.1'],
  ['1.0.1\n'],
  ['1.0.1 --specdown-app-url=file:///other'],
])(
  'missing, ambiguous or malformed version arguments %p are ignored',
  (...versions) => {
    const exposed = exposePreload({ versions });
    expect(exposed.has('specdown')).toBe(true);
    expect(exposed.has('specdownAppVersion')).toBe(false);
  }
);
