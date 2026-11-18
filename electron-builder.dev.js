// Runnable local Dev app: isolated install/data identity and no updater feed.
const { build } = require('./package.json');
module.exports = {
  ...build,
  appId: 'com.specdown.desktop.dev',
  productName: 'SpecDown Dev',
  directories: { output: 'dist/development-edit-save' },
  extraMetadata: {
    name: 'specdown-dev',
    productName: 'SpecDown Dev',
    specdownChannel: 'development',
  },
  publish: null,
  mac: {
    ...build.mac,
    target: [{ target: 'dir', arch: ['arm64'] }],
    identity: null,
    artifactName: 'SpecDown-Dev-${version}-${arch}.${ext}',
  },
};
