#!/usr/bin/env node
// Build the Mac App Store bookmark module (desktop/native/mas-bookmarks) as one
// universal (arm64 + x64) binary: desktop/native/mas-bookmarks/masbookmarks.node.
//
// Only the MAS packaging scripts run this; the direct DMG/ZIP build and the
// tests never need it (desktop/mas-access.js loads it lazily, MAS only).
// node-gyp comes with electron-builder (via @electron/rebuild). Node-API is
// ABI-stable, so the binary does not need rebuilding per Electron patch.
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (process.platform !== 'darwin') {
  console.error('build-mas-native: the Mac App Store module can only be built on macOS.');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const moduleDir = path.join(root, 'desktop', 'native', 'mas-bookmarks');
const output = path.join(moduleDir, 'masbookmarks.node');
const electronVersion = require('electron/package.json').version;

let nodeGyp;
try {
  nodeGyp = require.resolve('node-gyp/bin/node-gyp.js');
} catch {
  console.error('build-mas-native: node-gyp not found (it ships with electron-builder). Run npm ci.');
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-mas-native-'));
const slices = [];
for (const arch of ['arm64', 'x64']) {
  execFileSync(
    process.execPath,
    [nodeGyp, 'rebuild', `--target=${electronVersion}`, `--arch=${arch}`,
      '--dist-url=https://electronjs.org/headers'],
    { cwd: moduleDir, stdio: 'inherit' }
  );
  const slice = path.join(tmp, `${arch}.node`);
  fs.copyFileSync(path.join(moduleDir, 'build', 'Release', 'masbookmarks.node'), slice);
  slices.push(slice);
}
execFileSync('lipo', ['-create', ...slices, '-output', output], { stdio: 'inherit' });
fs.rmSync(path.join(moduleDir, 'build'), { recursive: true, force: true });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`build-mas-native: wrote ${path.relative(root, output)}`);
execFileSync('lipo', ['-info', output], { stdio: 'inherit' });
