const fs = require('fs');
const path = require('path');
const vm = require('vm');
const preloadSource = fs.readFileSync(
  path.join(__dirname, '../../desktop/preload.js'),
  'utf8'
);
function boot(url = 'file:///synthetic/index.html') {
  const ipcRenderer = { send: jest.fn(), on: jest.fn() };
  const contextBridge = { exposeInMainWorld: jest.fn() };
  vm.runInNewContext(preloadSource, {
    require: () => ({ ipcRenderer, contextBridge }),
    location: { href: url },
    process: {
      argv: ['--specdown-app-url=file:///synthetic/index.html'],
      platform: 'darwin',
    },
    URL,
    module: { exports: {} },
  });
  return {
    ipcRenderer,
    api: contextBridge.exposeInMainWorld.mock.calls[0]?.[1],
  };
}
test('isolated preload binds folder close/open/tree/relative/drop requests to the current page token', () => {
  const { ipcRenderer, api } = boot();
  const ready = ipcRenderer.on.mock.calls.find(
    ([channel]) => channel === 'workspace-ready'
  )[1];
  const token = '12345678-1234-1234-1234-123456789012';
  ready({}, { token });
  api.requestOpenFolder();
  api.requestCloseWorkspace();
  api.requestWorkspaceFile('/A/a.md', 'A');
  api.requestOpenRelative('/A/a.md', './b.md', 'A');
  api.openDroppedPath('/B');
  expect(ipcRenderer.send.mock.calls).toEqual([
    ['request-open-folder', { pageToken: token }],
    ['request-close-workspace', { pageToken: token }],
    [
      'request-workspace-file',
      { filePath: '/A/a.md', id: 'A', pageToken: token },
    ],
    [
      'request-open-relative',
      { fromPath: '/A/a.md', href: './b.md', id: 'A', pageToken: token },
    ],
    ['open-dropped-path', '/B', token],
  ]);
});
test('fresh preload cannot retain previous page capability; malformed ready token is cleared', () => {
  const { ipcRenderer, api } = boot();
  api.requestCloseWorkspace();
  const ready = ipcRenderer.on.mock.calls.find(
    ([channel]) => channel === 'workspace-ready'
  )[1];
  ready({}, { token: 'bad' });
  api.requestOpenFolder();
  expect(ipcRenderer.send.mock.calls).toEqual([
    ['request-close-workspace', { pageToken: null }],
    ['request-open-folder', { pageToken: null }],
  ]);
});
test('workspace close events expose only payload, not Electron event authority', () => {
  const { ipcRenderer, api } = boot();
  const callback = jest.fn();
  api.onWorkspaceClosed(callback);
  const closed = ipcRenderer.on.mock.calls.find(
    ([channel]) => channel === 'workspace-closed'
  )[1];
  closed({ sender: 'private' }, { generation: 7 });
  expect(callback.mock.calls).toEqual([[{ generation: 7 }]]);
});
test('untrusted page receives no workspace capability', () => {
  expect(boot('https://other.test').api).toBeUndefined();
});
