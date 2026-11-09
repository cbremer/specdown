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
  builds = [],
  channels = [],
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
        ...builds.map((value) => `--specdown-app-build=${value}`),
        ...channels.map((value) => `--specdown-app-channel=${value}`),
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

test.each([
  ['development', 'SpecDown — Development'],
  ['beta', 'SpecDown — Beta'],
  ['production', 'SpecDown'],
])('the real About dialog identifies the native %s build', (channel, title) => {
  const exposed = exposePreload({
    versions: ['1.0.2'],
    builds: ['235'],
    channels: [channel],
  });
  loadHTML(document);
  loadApp(document);
  window.specdownAppVersion = exposed.get('specdownAppVersion');
  window.specdownAppBuild = exposed.get('specdownAppBuild');
  window.specdownAppChannel = exposed.get('specdownAppChannel');
  try {
    setupVersionInfo('0.0.232');
    openAboutDialog();
    expect(document.getElementById('about-title').textContent).toBe(title);
    expect(document.getElementById('about-version').textContent).toBe(
      'Version 1.0.2 (build 235)'
    );
  } finally {
    closeAboutDialog();
    delete window.specdownAppVersion;
    delete window.specdownAppBuild;
    delete window.specdownAppChannel;
  }
});

test.each([
  { builds: ['235', '236'], channels: ['beta', 'development'] },
  { builds: ['235\n'], channels: ['beta\n'] },
  { builds: ['not-a-build'], channels: ['unknown'] },
])('ambiguous or malformed build metadata is not exposed (%p)', (options) => {
  const exposed = exposePreload(options);
  expect(exposed.has('specdownAppBuild')).toBe(false);
  expect(exposed.has('specdownAppChannel')).toBe(false);
});

test.each([false, null, 'true', 1])(
  'a non-MAS runtime (%p) gets no Store version even with the argument present',
  (mas) => {
    const exposed = exposePreload({ mas, builds: ['235'], channels: ['beta'] });
    expect(exposed.has('specdown')).toBe(true);
    expect(exposed.has('specdownAppVersion')).toBe(false);
    expect(exposed.has('specdownAppBuild')).toBe(false);
    expect(exposed.has('specdownAppChannel')).toBe(false);
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
