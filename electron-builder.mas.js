// electron-builder configuration for the Mac App Store build (AS-026).
//
// Separate from package.json "build" on purpose: that config is the Developer
// ID DMG/ZIP channel (appId com.specdown.desktop, GitHub auto-update) and must
// stay untouched. This file reuses its shared parts and overrides identity,
// signing and packaging for the Store:
//
//   npm run desktop:mas-dev   development-signed, sandboxed, runs locally
//   npm run desktop:mas       Store-signed .pkg for upload (does not run locally)
//
// The bundle ID must equal the iOS app's (universal purchase, decision D02).
// Entitlement justification: docs/project-appstore/mas-interface.md.
//
// Environment:
//   SPECDOWN_MAS_PROFILE       Mac App Store provisioning profile (.provisionprofile)
//   SPECDOWN_MAS_DEV_PROFILE   Mac Development provisioning profile for mas-dev
//   SPECDOWN_MAS_UNPROVISIONED=1  local sandbox smoke test without a profile:
//                                 skips the profile-only application-identifier
//                                 entitlements so the app can launch. Never for
//                                 a build that leaves this Mac.

const base = require('./package.json').build;

const TEAM_ID = '582YQWPT9G';
const APP_ID = 'com.mosaicpando.specdown';
const unprovisioned = process.env.SPECDOWN_MAS_UNPROVISIONED === '1';

const shared = {
  category: 'public.app-category.developer-tools',
  icon: 'build/icon.icns',
  entitlements: 'build/entitlements.mas.plist',
  entitlementsInherit: 'build/entitlements.mas.inherit.plist',
  // MAS builds are not hardened-runtime signed; the sandbox is the boundary.
  hardenedRuntime: false,
  // @electron/osx-sign inserts application-identifier / team-identifier from
  // the provisioning profile; they make an unprovisioned app unlaunchable.
  preAutoEntitlements: !unprovisioned,
  // Electron 44's framework is built for macOS 13.0 (LC_BUILD_VERSION minos)
  // and its own Info.plist says 13.0; a lower value would let macOS 12 users
  // install a build that cannot launch.
  minimumSystemVersion: '13.0',
  // The bookmark module is built universal already (scripts/build-mas-native.js).
  x64ArchFiles: '**/masbookmarks.node',
  extendInfo: {
    ElectronTeamID: TEAM_ID,
    // No proprietary encryption: HTTPS via the OS/Chromium only (exempt).
    ITSAppUsesNonExemptEncryption: false,
  },
};

module.exports = {
  ...base,
  appId: APP_ID,
  productName: 'SpecDown',
  directories: { output: 'dist-mas' },
  // The bookmark module ships only here; its sources and build tree do not.
  files: [
    ...base.files.filter((pattern) => pattern !== '!desktop/native/**'),
    '!desktop/native/mas-bookmarks/{build,binding.gyp,bookmarks.mm}',
    '!desktop/native/mas-bookmarks/build/**',
    // Never loaded in this channel (distribution.js); keep it out of the bundle.
    '!node_modules/electron-updater{,/**}',
  ],
  // No update feed in the Store build (Guideline 2.4.5): no app-update.yml.
  publish: null,
  mac: {
    ...shared,
    target: [{ target: 'mas', arch: ['universal'] }],
    artifactName: 'SpecDown-${version}-${arch}.${ext}',
  },
  mas: {
    ...shared,
    type: 'distribution',
    provisioningProfile: process.env.SPECDOWN_MAS_PROFILE || undefined,
  },
  masDev: {
    ...shared,
    type: 'development',
    provisioningProfile: process.env.SPECDOWN_MAS_DEV_PROFILE || undefined,
  },
  dmg: undefined,
  win: undefined,
  nsis: undefined,
  linux: undefined,
};
