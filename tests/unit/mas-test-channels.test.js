const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }));
const { execFileSync } = require('node:child_process');
const { makeTestChannel } = require('../../scripts/mas-test-channel-config');
const permissions = require('../../scripts/mas-package-permissions');

const channels = [
  ['development', 'dev', 'SpecDown Store Dev'],
  ['beta', 'beta', 'SpecDown Store Beta'],
];
function bom(name) {
  return (
    [
      '.\t0\t0/0',
      `./${name}.app\t40755\t0/0`,
      `./${name}.app/Contents\t40755\t0/0`,
      `./${name}.app/Contents/embedded.provisionprofile\t100644\t0/0\t12\t42`,
    ].join('\n') + '\n'
  );
}

describe('separate Store test channels', () => {
  it.each(channels)(
    '%s isolates runtime metadata, helpers and entitlement groups',
    (channel, suffix, name) => {
      const config = makeTestChannel(channel, {});
      expect(config.appId).toBe(`com.mosaicpando.specdown.${suffix}`);
      expect(config.productName).toBe(name);
      expect(config.extraMetadata.productName).toBe(name);
      expect(config.extraMetadata.name).toBe(`specdown-store-${suffix}`);
      expect(config.extraMetadata.specdownChannel).toBe(channel);
      expect(config.extraMetadata.version).toBe('1.0.1');
      expect(config.buildVersion).toBe('230');
      expect(config.publish).toBeNull();
      expect(config.files).toContain('!node_modules/electron-updater{,/**}');
      expect(config.mac.extendInfo.SpecDownChannel).toBe(channel);
      expect(config.mac.extendInfo.ElectronTeamID).toBe('582YQWPT9G');
      expect(config.mac.artifactName).not.toContain(' ');
      expect(config.mac.entitlements).toBe(config.mas.entitlements);
      expect(config.masDev.entitlements).toBe(config.mas.entitlements);
      const entitlements = fs.readFileSync(
        path.join(__dirname, '../..', config.mas.entitlements),
        'utf8'
      );
      expect(entitlements).toContain(
        `<string>582YQWPT9G.com.mosaicpando.specdown.${suffix}</string>`
      );
      expect(entitlements).not.toContain(
        '<string>582YQWPT9G.com.mosaicpando.specdown</string>'
      );
      expect(entitlements.match(/<string>/g)).toHaveLength(1);
      expect(
        config.fileAssociations.every((item) => item.rank === 'Alternate')
      ).toBe(true);
    }
  );

  it('never inherits a production profile or weakens distribution for local smoke', () => {
    const env = {
      SPECDOWN_MAS_PROFILE: 'production',
      SPECDOWN_MAS_DEV_PROFILE: 'production-dev',
      SPECDOWN_MAS_UNPROVISIONED: '1',
    };
    for (const [channel] of channels) {
      const config = makeTestChannel(channel, env);
      expect(config.mas.provisioningProfile).toBeUndefined();
      expect(config.masDev.provisioningProfile).toBeUndefined();
      expect(config.mas.preAutoEntitlements).toBe(true);
      expect(config.masDev.preAutoEntitlements).toBe(false);
    }
    const beta = makeTestChannel('beta', {
      SPECDOWN_MAS_BETA_PROFILE: 'beta-store',
      SPECDOWN_MAS_BETA_DEV_PROFILE: 'beta-dev',
    });
    expect(beta.mas.provisioningProfile).toBe('beta-store');
    expect(beta.masDev.provisioningProfile).toBe('beta-dev');
  });

  it('leaves production and direct identities, version, profiles and hooks unchanged', () => {
    const production = require('../../electron-builder.mas');
    const before = JSON.stringify(production);
    const direct = require('../../package.json').build;
    const directBefore = JSON.stringify(direct);
    makeTestChannel('development', {});
    makeTestChannel('beta', {});
    expect(JSON.stringify(production)).toBe(before);
    expect(JSON.stringify(direct)).toBe(directBefore);
    expect(production.appId).toBe('com.mosaicpando.specdown');
    expect(production.productName).toBe('SpecDown');
    expect(production.extraMetadata).toEqual({ version: '1.0.1' });
    expect(production.afterSign).toBe(permissions.afterSign);
    expect(direct.appId).toBe('com.specdown.desktop');
    expect(direct.productName).toBe('Specdown Desktop');
  });

  it.each(['production', '', '../beta', 'toString', 'constructor'])(
    'test factory rejects %j',
    (value) => {
      expect(() => makeTestChannel(value)).toThrow();
    }
  );

  it.each(channels)(
    '%s retains installer checks and rejects mixed channel payloads',
    (channel, suffix, name) => {
      const guard = permissions.forChannel(channel);
      expect(guard.validateBom(bom(name)).records).toBe(4);
      expect(() => guard.validateBom(bom('SpecDown'))).toThrow(
        'unexpected installer payload'
      );
      expect(() => permissions.validateBom(bom(name))).toThrow(
        'unexpected installer payload'
      );
      expect(() =>
        guard.validateBom(bom(name).replace('100644', '100600'))
      ).toThrow('not publicly');
      expect(() =>
        guard.afterSign({
          electronPlatformName: 'mas',
          packager: { config: { appId: 'com.mosaicpando.specdown' } },
        })
      ).toThrow('unexpected MAS app');
      const root = fs.mkdtempSync(
        path.join(os.tmpdir(), 'specdown-channel-pkg-')
      );
      const pkg = path.join(root, 'fixture.pkg');
      fs.writeFileSync(pkg, 'synthetic');
      let packageId = `com.mosaicpando.specdown.${suffix}`;
      execFileSync.mockImplementation((command, args) => {
        if (command === '/usr/sbin/pkgutil') {
          const component = path.join(
            args[2],
            `com.mosaicpando.specdown.${suffix}.pkg`
          );
          fs.mkdirSync(component, { recursive: true });
          fs.writeFileSync(path.join(args[2], 'Distribution'), 'synthetic');
          fs.writeFileSync(
            path.join(component, 'PackageInfo'),
            `<pkg-info identifier="${packageId}" install-location="/Applications"/>`
          );
          for (const file of ['Bom', 'Payload'])
            fs.writeFileSync(path.join(component, file), 'synthetic');
          return '';
        }
        return bom(name);
      });
      try {
        expect(guard.validateInstaller(pkg).records).toBe(4);
        packageId = 'com.mosaicpando.specdown';
        expect(() => guard.validateInstaller(pkg)).toThrow('identity');
        expect(fs.readdirSync(root)).toEqual(['fixture.pkg']);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
        execFileSync.mockReset();
      }
    }
  );
});
