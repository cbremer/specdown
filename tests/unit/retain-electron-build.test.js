const path = require('node:path');
const { execFileSync } = require('node:child_process');
jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }));

test('retains final Mac bundles and their own installer after packaging', () => {
  const {
    afterPack,
    afterAllArtifactBuild,
  } = require('../../scripts/retain-electron-build');
  const ci = process.env.CI;
  delete process.env.CI;
  try {
    const packager = {
      appInfo: { productFilename: 'SpecDown Store Beta' },
      info: { onArtifactCreated: jest.fn() },
    };
    const out = '/build/mas-universal';
    const pkg = path.join(out, 'SpecDown.pkg');
    const context = {
      packager,
      arch: 4,
      appOutDir: out,
      electronPlatformName: 'mas',
    };
    afterPack({ ...context, appOutDir: out + '-arm64-temp' });
    afterPack(context);
    const record = packager.info.onArtifactCreated.mock.calls[0][0];
    record({ packager, file: pkg, arch: 1 });
    record({ packager: {}, file: '/unrelated.zip', arch: 4 });
    expect(
      afterAllArtifactBuild({ artifactPaths: [pkg, '/unrelated.zip'] })
    ).toEqual([]);
    expect(execFileSync.mock.calls.map((call) => call[1].slice(1))).toEqual([
      [path.join(out, 'SpecDown Store Beta.app'), '--extra', pkg],
    ]);
  } finally {
    if (ci !== undefined) process.env.CI = ci;
  }
});
