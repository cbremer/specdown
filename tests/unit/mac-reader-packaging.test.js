const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Arch } = require('builder-util/out/arch');
const { execFileSync } = require('node:child_process');
const base = require('../../package.json').build;
const mas = require('../../electron-builder.mas');

jest.mock('node:child_process', () => ({
  ...jest.requireActual('node:child_process'),
  execFileSync: jest.fn(),
}));
jest.mock('../../scripts/retain-electron-build', () => ({
  afterPack: jest.fn(),
}));

test.each([
  ['darwin', 'SpecDown Dev', Arch.x64, 'x86_64'],
  ['mas', 'SpecDown Store Dev', Arch.arm64, 'arm64'],
])(
  'compiles the shared provider into the %s app before signing',
  (platform, name, arch, cpu) => {
    const config = platform === 'mas' ? mas : base;
    const { afterPack } = require(
      path.join(__dirname, '../..', config.afterPack)
    );
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-reader-'));
    try {
      execFileSync.mockReset().mockReturnValueOnce(folder);
      afterPack({
        appOutDir: folder,
        packager: { appInfo: { productFilename: name } },
        arch,
        electronPlatformName: platform,
      });
      const [command, args] = execFileSync.mock.calls.at(-1);
      expect(command).toBe('xcrun');
      expect(args).toContain('swiftc');
      expect(args).toContain(cpu + '-apple-macos13.0');
      expect(args).toContain(
        path.join(
          __dirname,
          '../../ios/SpecDown/AppleIntelligenceServices.swift'
        )
      );
      expect(args).toContain(
        path.join(__dirname, '../../desktop/native/reader/ReaderHelper.swift')
      );
      expect(args.at(-1)).toBe(
        path.join(
          folder,
          name + '.app',
          'Contents',
          'Helpers',
          'SpecDownReader'
        )
      );
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  }
);

test('Windows, Linux and the final merged bundle skip the Mac compiler', () => {
  const { afterPack } = require('../../scripts/build-mac-reader');
  const retain = require('../../scripts/retain-electron-build');
  execFileSync.mockClear();
  for (const [platform, arch] of [
    ['win32', Arch.arm64],
    ['linux', Arch.x64],
    ['darwin', Arch.universal],
  ]) {
    const context = { electronPlatformName: platform, arch };
    afterPack(context);
    expect(retain.afterPack).toHaveBeenCalledWith(context);
  }
  expect(execFileSync).not.toHaveBeenCalled();
});
