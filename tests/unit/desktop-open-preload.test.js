const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('the isolated preload carries only receipt and acceptance back to main', () => {
  const ipcRenderer = { send: jest.fn(), on: jest.fn() };
  const contextBridge = { exposeInMainWorld: jest.fn() };
  const url = 'file:///synthetic/index.html';
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../../desktop/preload.js'), 'utf8'),
    {
      require: () => ({ ipcRenderer, contextBridge }),
      location: { href: url },
      process: { argv: [`--specdown-app-url=${url}`], platform: 'darwin' },
      URL,
      module: { exports: {} },
    }
  );
  const api = contextBridge.exposeInMainWorld.mock.calls[0][1];
  api.reportFileOpenResult('receipt', true, '/untrusted/ignored.md');
  expect(ipcRenderer.send.mock.calls).toEqual([
    ['file-open-result', { receipt: 'receipt', accepted: true }],
  ]);
  const callback = jest.fn();
  api.onFileOpened(callback);
  const payload = {
    filename: 'A.md',
    filePath: '/synthetic/A.md',
    content: '# A',
    openReceipt: 'receipt',
  };
  ipcRenderer.on.mock.calls.find(([name]) => name === 'file-opened')[1](
    { sender: 'native-only' },
    payload
  );
  expect(callback.mock.calls).toEqual([[payload]]);
});
