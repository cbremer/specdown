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

// macOS package permissions have POSIX semantics. The model runs every security
// assertion on every host; only the additional real-kernel integration needs POSIX.
const {
  embeddedProfileContract,
} = require('../helpers/embedded-profile-contract');
const {
  createPosixFs,
  loadPermissionGuard,
} = require('../helpers/posix-package-fs');

describe('embedded public profile (portable POSIX model)', () => {
  embeddedProfileContract(() => {
    const model = createPosixFs();
    const run = jest.fn();
    return {
      fs: model,
      path: path.posix,
      os: { tmpdir: () => '/tmp' },
      guard: loadPermissionGuard(model, run),
      execFileSync: run,
    };
  });
});

(process.platform === 'win32' ? describe.skip : describe)(
  'embedded public profile (real POSIX filesystem)',
  () => {
    embeddedProfileContract(() => ({ fs, path, os, guard, execFileSync }));
  }
);

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
