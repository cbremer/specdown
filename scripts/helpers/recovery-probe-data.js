// Structured synthetic fixture transport; this is never loaded by the product.
const fs = require('fs');
const path = require('path');
const channel = 'specdown-synthetic-probe-data';
const preloadSource =
  "const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('recoveryProbeData',{get:key=>ipcRenderer.invoke('specdown-synthetic-probe-data',key)});";
function installRecoveryProbeData(ipcMain, profile) {
  const values = new Map();
  const preload = path.join(profile, 'probe-data-preload.cjs');
  fs.writeFileSync(preload, preloadSource, { mode: 0o600 });
  ipcMain.handle(channel, (event, key) => {
    const fixtures = values.get(event.sender.id);
    if (typeof key !== 'string' || !fixtures?.has(key))
      throw Error('Unknown synthetic fixture for this renderer');
    return fixtures.get(key);
  });
  return {
    preload,
    set(contents, key, value) {
      const id = contents.id;
      if (!values.has(id)) {
        values.set(id, new Map());
        contents.once('destroyed', () => values.delete(id));
      }
      values.get(id).set(key, value);
    },
  };
}
module.exports = { installRecoveryProbeData };
