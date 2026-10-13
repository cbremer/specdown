/**
 * Mac App Store packaging (electron-builder.mas.js + build/entitlements.mas*)
 * versus the untouched Developer ID channel (package.json "build").
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const pkg = require('../../package.json');

function loadMasConfig(env = {}) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  let config;
  jest.isolateModules(() => {
    config = require('../../electron-builder.mas.js');
  });
  process.env = saved;
  return config;
}

/** Keys of a flat plist <dict> (enough for our entitlement files). */
function plistKeys(file) {
  // The plists' comments never contain <key> tags, so no comment handling.
  const xml = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return [...xml.matchAll(/<key>([^<]+)<\/key>/g)].map((m) => m[1]);
}

describe('Mac App Store build config', () => {
  const mas = loadMasConfig();

  it('uses the universal-purchase bundle ID shared with the iOS app (D02)', () => {
    expect(mas.appId).toBe('com.mosaicpando.specdown');
    expect(mas.productName).toBe('SpecDown');
  });

  it('declares category, export compliance and the Electron team ID', () => {
    for (const target of [mas.mac, mas.mas, mas.masDev]) {
      expect(target.category).toBe('public.app-category.developer-tools');
      expect(target.extendInfo.ITSAppUsesNonExemptEncryption).toBe(false);
      expect(target.extendInfo.ElectronTeamID).toBe('582YQWPT9G');
      expect(target.entitlements).toBe('build/entitlements.mas.plist');
      expect(target.entitlementsInherit).toBe(
        'build/entitlements.mas.inherit.plist'
      );
      expect(target.hardenedRuntime).toBe(false);
    }
    expect(mas.mas.type).toBe('distribution');
    expect(mas.masDev.type).toBe('development');
  });

  it('has no update feed and does not bundle electron-updater', () => {
    expect(mas.publish).toBeNull();
    expect(mas.files).toContain('!node_modules/electron-updater{,/**}');
  });

  it('builds only Mac App Store targets, into its own output folder', () => {
    expect(mas.mac.target).toEqual([{ target: 'mas', arch: ['universal'] }]);
    expect(mas.directories.output).toBe('dist-mas');
    expect(mas.dmg).toBeUndefined();
    expect(mas.win).toBeUndefined();
    expect(mas.linux).toBeUndefined();
  });

  it('ships the native bookmark module but not its sources', () => {
    expect(mas.files).not.toContain('!desktop/native/**');
    expect(mas.files).toContain(
      '!desktop/native/mas-bookmarks/{build,binding.gyp,bookmarks.mm}'
    );
    expect(mas.mac.x64ArchFiles).toBe('**/masbookmarks.node');
  });

  it('only skips profile entitlements for an explicit unprovisioned local smoke build', () => {
    expect(mas.masDev.preAutoEntitlements).toBe(true);
    const local = loadMasConfig({ SPECDOWN_MAS_UNPROVISIONED: '1' });
    expect(local.masDev.preAutoEntitlements).toBe(false);
  });

  it('takes provisioning profiles from the environment', () => {
    const withProfiles = loadMasConfig({
      SPECDOWN_MAS_PROFILE: '/p/store.provisionprofile',
      SPECDOWN_MAS_DEV_PROFILE: '/p/dev.provisionprofile',
    });
    expect(withProfiles.mas.provisioningProfile).toBe(
      '/p/store.provisionprofile'
    );
    expect(withProfiles.masDev.provisioningProfile).toBe(
      '/p/dev.provisionprofile'
    );
  });

  it('requires the macOS version the bundled Electron actually supports', () => {
    // On macOS, read the Electron runtime's own floor so an Electron upgrade
    // can't drift; CI on Linux has no Electron.app and checks the constant.
    const electronPlist = path.join(
      ROOT,
      'node_modules/electron/dist/Electron.app/Contents/Info.plist'
    );
    const electronMin = fs.existsSync(electronPlist)
      ? fs
          .readFileSync(electronPlist, 'utf8')
          .match(
            /<key>LSMinimumSystemVersion<\/key>\s*<string>([^<]+)<\/string>/
          )
      : null;
    const floor = electronMin ? electronMin[1] : '13.0';
    for (const target of [mas.mac, mas.mas, mas.masDev]) {
      expect(target.minimumSystemVersion).toBe(floor);
    }
    expect(floor).toBe('13.0');
  });

  it('has an artifact name without spaces', () => {
    expect(mas.mac.artifactName).not.toMatch(/ /);
  });
});

describe('MAS entitlements stay minimal', () => {
  it('main app: sandbox, user-selected files, bookmarks, network client, print, app group', () => {
    expect(plistKeys('build/entitlements.mas.plist').sort()).toEqual(
      [
        'com.apple.security.app-sandbox',
        'com.apple.security.application-groups',
        'com.apple.security.files.bookmarks.app-scope',
        'com.apple.security.files.user-selected.read-write',
        'com.apple.security.network.client',
        'com.apple.security.print',
      ].sort()
    );
    const xml = fs.readFileSync(
      path.join(ROOT, 'build/entitlements.mas.plist'),
      'utf8'
    );
    expect(xml).toContain(
      '<string>582YQWPT9G.com.mosaicpando.specdown</string>'
    );
  });

  it('helpers: inherit the sandbox only', () => {
    expect(plistKeys('build/entitlements.mas.inherit.plist').sort()).toEqual([
      'com.apple.security.app-sandbox',
      'com.apple.security.inherit',
    ]);
  });
});

describe('Developer ID (direct) channel is unchanged', () => {
  const direct = pkg.build;

  it('keeps its own identity, targets and GitHub update feed', () => {
    expect(direct.appId).toBe('com.specdown.desktop');
    expect(direct.productName).toBe('Specdown Desktop');
    expect(direct.mac.target).toEqual(['dmg', 'zip']);
    expect(direct.mac.entitlements).toBe('build/entitlements.mac.plist');
    expect(direct.mac.hardenedRuntime).toBe(true);
    expect(direct.publish).toEqual([
      { provider: 'github', owner: 'cbremer', repo: 'specdown' },
    ]);
  });

  it('does not ship the MAS-only native module', () => {
    expect(direct.files).toContain('!desktop/native/**');
  });
});
