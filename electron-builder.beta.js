// Local direct Mac Beta uses a separate install identity and Electron data directory.
const dev = require('./electron-builder.dev');
module.exports = {
  ...dev,
  appId: 'com.specdown.desktop.beta',
  productName: 'SpecDown Desktop Beta',
  directories: { output: 'dist/direct-beta' },
  extraMetadata: {
    name: 'specdown-desktop-beta',
    productName: 'SpecDown Desktop Beta',
    specdownChannel: 'beta',
  },
  mac: {
    ...dev.mac,
    identity: '-',
    artifactName: 'SpecDown-Desktop-Beta-${version}-${arch}.${ext}',
  },
};
