// Separate install/data identities for local Store development and TestFlight.
// Production and the direct-download config are never mutated by this factory.
const production = require('../electron-builder.mas');
const permissions = require('./mas-package-permissions');

const channels = Object.freeze({
  development: {
    appId: 'com.mosaicpando.specdown.dev',
    productName: 'SpecDown Store Dev',
    packageName: 'specdown-store-dev',
    artifactName: 'SpecDown-Store-Dev-${version}-${arch}.${ext}',
    output: 'dist-mas/development',
    distributionProfile: 'SPECDOWN_MAS_DEV_DISTRIBUTION_PROFILE',
    developmentProfile: 'SPECDOWN_MAS_DEV_CHANNEL_PROFILE',
  },
  beta: {
    appId: 'com.mosaicpando.specdown.beta',
    productName: 'SpecDown Store Beta',
    packageName: 'specdown-store-beta',
    artifactName: 'SpecDown-Store-Beta-${version}-${arch}.${ext}',
    output: 'dist-mas/beta',
    distributionProfile: 'SPECDOWN_MAS_BETA_PROFILE',
    developmentProfile: 'SPECDOWN_MAS_BETA_DEV_PROFILE',
  },
});

function makeTestChannel(channel, env = process.env) {
  if (!Object.hasOwn(channels, channel)) {
    throw new Error('Expected development or beta MAS test channel');
  }
  const identity = channels[channel];
  const guard = permissions.forChannel(channel);
  const mac = {
    ...production.mac,
    entitlements: `build/entitlements.mas.${channel}.plist`,
    // Ordinary Dev packaging targets the sandbox development runtime. Beta's
    // default is a distribution package; local unsigned inspection explicitly
    // selects mas-dev and disables signing outside this source config.
    target: [
      {
        target: channel === 'development' ? 'mas-dev' : 'mas',
        arch: ['universal'],
      },
    ],
    artifactName: identity.artifactName,
    extendInfo: { ...production.mac.extendInfo, SpecDownChannel: channel },
  };
  return {
    ...production,
    appId: identity.appId,
    productName: identity.productName,
    // Electron takes its runtime name from packaged productName/name, not just
    // the outer bundle name. This separates userData and Chromium sessionData
    // even in a local unsigned run before macOS sandbox provisioning exists.
    extraMetadata: {
      ...production.extraMetadata,
      name: identity.packageName,
      productName: identity.productName,
      specdownChannel: channel,
    },
    directories: { output: identity.output },
    fileAssociations: production.fileAssociations.map((association) => ({
      ...association,
      rank: 'Alternate',
    })),
    afterSign: guard.afterSign,
    artifactBuildCompleted: guard.artifactBuildCompleted,
    mac,
    mas: {
      ...production.mas,
      ...mac,
      type: 'distribution',
      // An unprovisioned local smoke flag must never relax distribution.
      preAutoEntitlements: true,
      provisioningProfile: env[identity.distributionProfile] || undefined,
    },
    masDev: {
      ...production.masDev,
      ...mac,
      type: 'development',
      preAutoEntitlements: env.SPECDOWN_MAS_UNPROVISIONED !== '1',
      provisioningProfile: env[identity.developmentProfile] || undefined,
    },
  };
}

module.exports = { makeTestChannel };
