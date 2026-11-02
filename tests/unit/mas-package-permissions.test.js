// Real synthetic files only. No signing identity, user profile or app is used.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }));
const { execFileSync } = require('node:child_process');
const guard = require('../../scripts/mas-package-permissions');

const PROFILE = './SpecDown.app/Contents/embedded.provisionprofile';
const bom = () =>
  [
    '.\t0\t0/0',
    './SpecDown.app\t40755\t0/0',
    './SpecDown.app/Contents\t40755\t0/0',
    `${PROFILE}\t100644\t0/0\t12\t42`,
    './SpecDown.app/Contents/._embedded.provisionprofile\t100644\t0/0\t0\t0',
    './SpecDown.app/Contents/Info.plist\t100644\t0/0\t5\t42',
    './SpecDown.app/Contents/MacOS\t40755\t0/0',
    './SpecDown.app/Contents/MacOS/SpecDown\t100755\t0/0\t5\t42',
    './SpecDown.app/Contents/Current\t120755\t0/0\t5\t42\tMacOS',
    './SpecDown.app/Contents/._Current\t120755\t0/0\t0\t0',
  ].join('\n') + '\n';

describe('embedded public profile', () => {
  let root, app, profile, input;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-profile-test-'));
    app = path.join(root, 'SpecDown.app');
    fs.mkdirSync(path.join(app, 'Contents'), { recursive: true, mode: 0o755 });
    profile = path.join(app, 'Contents/embedded.provisionprofile');
    input = path.join(root, 'private-source.provisionprofile');
    fs.writeFileSync(input, 'SYNTHETIC PUBLIC PROFILE', { mode: 0o600 });
    fs.copyFileSync(input, profile);
    fs.chmodSync(profile, 0o600);
    execFileSync.mockReset();
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('changes only the embedded copy to 0644, preserving private source bytes and mode', () => {
    const old = fs.readFileSync(input);
    expect(guard.normalizeEmbeddedProfile(app)).toMatchObject({
      previousMode: 0o600,
      mode: 0o644,
    });
    expect(fs.statSync(profile).mode & 0o7777).toBe(0o644);
    expect(fs.readFileSync(profile)).toEqual(old);
    expect(fs.statSync(input).mode & 0o7777).toBe(0o600);
    expect(fs.readFileSync(input)).toEqual(old);
    expect(guard.normalizeEmbeddedProfile(app).previousMode).toBe(0o644);
  });

  it.each(['symlink', 'hardlink'])(
    'rejects a %s to the private source without chmodding it',
    (kind) => {
      fs.unlinkSync(profile);
      (kind === 'symlink' ? fs.symlinkSync : fs.linkSync)(input, profile);
      expect(() => guard.normalizeEmbeddedProfile(app)).toThrow();
      expect(fs.statSync(input).mode & 0o7777).toBe(0o600);
    }
  );

  it('rejects a linked Contents directory', () => {
    fs.renameSync(path.join(app, 'Contents'), path.join(root, 'outside'));
    fs.symlinkSync(path.join(root, 'outside'), path.join(app, 'Contents'));
    expect(() => guard.normalizeEmbeddedProfile(app)).toThrow('real directory');
    expect(
      fs.statSync(path.join(root, 'outside/embedded.provisionprofile')).mode &
        0o7777
    ).toBe(0o600);
  });

  it('requires the profile except for explicit local unprovisioned mode', () => {
    fs.unlinkSync(profile);
    expect(() => guard.normalizeEmbeddedProfile(app)).toThrow();
    expect(guard.normalizeEmbeddedProfile(app, true).profile).toBe(
      'absent-local-unprovisioned'
    );
  });

  it('checks every other bundle file rather than silently changing its mode', () => {
    guard.normalizeEmbeddedProfile(app);
    fs.writeFileSync(path.join(app, 'Contents/private-resource'), 'fixture', {
      mode: 0o600,
    });
    expect(() => guard.validateAppPermissions(app)).toThrow('not publicly');
    expect(
      fs.statSync(path.join(app, 'Contents/private-resource')).mode & 0o7777
    ).toBe(0o600);
  });

  it('accepts internal links, rejects links outside the bundle and nontraversable directories', () => {
    guard.normalizeEmbeddedProfile(app);
    const alias = path.join(app, 'Contents/alias');
    fs.symlinkSync('embedded.provisionprofile', alias);
    expect(guard.validateAppPermissions(app).links).toBe(1);
    fs.unlinkSync(alias);
    fs.symlinkSync('../../private-source.provisionprofile', alias);
    expect(() => guard.validateAppPermissions(app)).toThrow('escaping');
    fs.unlinkSync(alias);
    fs.chmodSync(path.join(app, 'Contents'), 0o744);
    expect(() => guard.validateAppPermissions(app)).toThrow('not publicly');
  });

  function context(target = 'mas') {
    return {
      electronPlatformName: 'mas',
      appOutDir: root,
      targets: [{ name: target }],
      packager: {
        config: { appId: 'com.mosaicpando.specdown', masDev: {} },
        appInfo: { productFilename: 'SpecDown' },
      },
    };
  }

  it('runs read-only strict signature verification after normalization and fails if it fails', () => {
    execFileSync.mockImplementation((command, args) => {
      expect(command).toBe('/usr/bin/codesign');
      expect(args).toEqual(['--verify', '--deep', '--strict', app]);
      expect(fs.statSync(profile).mode & 0o7777).toBe(0o644);
      throw new Error('signature verification failed');
    });
    expect(() => guard.afterSign(context())).toThrow(
      'signature verification failed'
    );
    expect(execFileSync).toHaveBeenCalledTimes(1);
  });

  it('does not touch direct builds, and permits missing profiles only on explicit local mas-dev', () => {
    guard.afterSign({ electronPlatformName: 'darwin' });
    expect(execFileSync).not.toHaveBeenCalled();
    expect(fs.statSync(profile).mode & 0o7777).toBe(0o600);
    fs.unlinkSync(profile);
    const local = context('mas-dev');
    local.packager.config.masDev.preAutoEntitlements = false;
    expect(() => guard.afterSign(local)).not.toThrow();
    const store = context();
    store.packager.config.masDev.preAutoEntitlements = false;
    expect(() => guard.afterSign(store)).toThrow();
  });
});

describe('whole installer BOM gate', () => {
  it('accepts public root-owned payload including executable, safe link and AppleDouble companion', () => {
    expect(guard.validateBom(bom())).toEqual({
      records: 10,
      files: 4,
      links: 2,
    });
  });

  it.each([
    [
      'restricted profile',
      (s) => s.replace(`${PROFILE}\t100644`, `${PROFILE}\t100600`),
    ],
    [
      'restricted companion',
      (s) =>
        s.replace(
          '._embedded.provisionprofile\t100644',
          '._embedded.provisionprofile\t100600'
        ),
    ],
    [
      'unrelated unreadable resource',
      (s) => s.replace('Info.plist\t100644', 'Info.plist\t100640'),
    ],
    [
      'untraversable directory',
      (s) => s.replace('MacOS\t40755', 'MacOS\t40744'),
    ],
    ['non-root ownership', (s) => s.replace('0/0', '501/20')],
    [
      'writable resource',
      (s) => s.replace('Info.plist\t100644', 'Info.plist\t100666'),
    ],
    [
      'setuid executable',
      (s) => s.replace('SpecDown\t100755', 'SpecDown\t104755'),
    ],
    ['unsafe path', (s) => s.replace('Info.plist', '../outside')],
    ['extra payload', (s) => s + './Other.app\t40755\t0/0\n'],
    ['duplicate path', (s) => s + './SpecDown.app\t40755\t0/0\n'],
    [
      'unsupported socket',
      (s) => s.replace('Info.plist\t100644', 'Info.plist\t140644'),
    ],
    ['escaping link', (s) => s.replace('\tMacOS\n', '\t../../outside\n')],
    ['absolute link', (s) => s.replace('\tMacOS\n', '\t/private/secret\n')],
    [
      'missing profile',
      (s) =>
        s
          .split('\n')
          .filter((line) => !line.startsWith(PROFILE + '\t'))
          .join('\n'),
    ],
    ['malformed mode', (s) => s.replace('100644', 'not-octal')],
    ['missing root', (s) => s.replace('.\t0\t0/0\n', '')],
  ])('rejects %s', (_name, transform) => {
    expect(() => guard.validateBom(transform(bom()))).toThrow();
  });
});

describe('installer hook wiring', () => {
  let root, pkg;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-pkg-test-'));
    pkg = path.join(root, 'fixture.pkg');
    fs.writeFileSync(pkg, 'synthetic package');
    execFileSync.mockReset();
    execFileSync.mockImplementation((command, args) => {
      if (command === '/usr/sbin/pkgutil') {
        expect(args.slice(0, 2)).toEqual(['--expand', pkg]);
        fs.mkdirSync(path.join(args[2], 'com.mosaicpando.specdown.pkg'), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(args[2], 'Distribution'),
          '<installer-gui-script/>'
        );
        const component = path.join(args[2], 'com.mosaicpando.specdown.pkg');
        fs.writeFileSync(
          path.join(component, 'PackageInfo'),
          '<pkg-info identifier="com.mosaicpando.specdown" install-location="/Applications"/>'
        );
        for (const name of ['Bom', 'Payload'])
          fs.writeFileSync(path.join(component, name), 'synthetic');
        return '';
      }
      expect(command).toBe('/usr/bin/lsbom');
      return bom();
    });
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('validates all records and removes its scratch expansion without modifying the package', () => {
    expect(guard.validateInstaller(pkg).records).toBe(10);
    expect(fs.readdirSync(root)).toEqual(['fixture.pkg']);
    expect(fs.readFileSync(pkg, 'utf8')).toBe('synthetic package');
  });

  it('rejects tool failures and cleans scratch output', () => {
    execFileSync.mockImplementation(() => {
      throw new Error('expand failed');
    });
    expect(() => guard.validateInstaller(pkg)).toThrow('expand failed');
    expect(fs.readdirSync(root)).toEqual(['fixture.pkg']);
  });

  it('rejects an added component or installer scripts instead of checking one BOM only', () => {
    const original = execFileSync.getMockImplementation();
    execFileSync.mockImplementation((command, args) => {
      const result = original(command, args);
      if (command === '/usr/sbin/pkgutil')
        fs.mkdirSync(path.join(args[2], 'second.pkg'));
      return result;
    });
    expect(() => guard.validateInstaller(pkg)).toThrow('components');
  });

  it.each(['scripts', 'install-location', 'BOM-mode'])(
    'fails closed for %s after extraction',
    (problem) => {
      const original = execFileSync.getMockImplementation();
      execFileSync.mockImplementation((command, args) => {
        const result = original(command, args);
        if (command === '/usr/sbin/pkgutil') {
          const component = path.join(args[2], 'com.mosaicpando.specdown.pkg');
          if (problem === 'scripts')
            fs.mkdirSync(path.join(component, 'Scripts'));
          if (problem === 'install-location')
            fs.writeFileSync(
              path.join(component, 'PackageInfo'),
              '<pkg-info identifier="com.mosaicpando.specdown" install-location="/Library"/>'
            );
        }
        if (command === '/usr/bin/lsbom' && problem === 'BOM-mode')
          return result.replace('100644', '100600');
        return result;
      });
      expect(() => guard.validateInstaller(pkg)).toThrow();
      expect(fs.readdirSync(root)).toEqual(['fixture.pkg']);
    }
  );

  it('is mandatory in MAS config only; direct config has no hook', () => {
    const config = require('../../electron-builder.mas');
    expect(config.afterSign).toBe(guard.afterSign);
    expect(config.artifactBuildCompleted).toBe(guard.artifactBuildCompleted);
    expect(require('../../package.json').build.afterSign).toBeUndefined();
    expect(
      require('../../package.json').build.artifactBuildCompleted
    ).toBeUndefined();
    guard.artifactBuildCompleted({ file: 'preview.zip' });
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('runs against a locked builder that awaits MAS afterSign before installer creation and the artifact gate before publication', () => {
    const manifest = require.resolve('app-builder-lib/package.json');
    expect(JSON.parse(fs.readFileSync(manifest, 'utf8')).version).toBe(
      '26.18.1'
    );
    const base = path.dirname(manifest);
    const mac = fs.readFileSync(path.join(base, 'out/macPackager.js'), 'utf8');
    const pack = mac.slice(
      mac.indexOf('async packMasTargets('),
      mac.indexOf('async packMacTargets(')
    );
    const signed = pack.indexOf('const signed = await this.signMas(');
    const after = pack.indexOf('await this.info.emitAfterSign(packContext)');
    const installer = pack.indexOf('await this.createMasInstaller(');
    expect(signed).toBeGreaterThan(-1);
    expect(after).toBeGreaterThan(signed);
    expect(installer).toBeGreaterThan(after);
    const packager = fs.readFileSync(
      path.join(base, 'out/packager.js'),
      'utf8'
    );
    expect(packager).toContain(
      'await this.eventEmitter.emit("artifactBuildCompleted", event);\n        await this.emitArtifactCreated(event);'
    );
  });
});
