const path = require('node:path');
const { spawnSync } = require('node:child_process');
const targets = [
  ['darwin', 'arm64'],
  ['darwin', 'x64'],
  ['mas', 'arm64'],
  ['mas', 'x64'],
  ['linux', 'arm64'],
  ['linux', 'x64'],
  ['win32', 'arm64'],
  ['win32', 'x64'],
];

const probe = (...args) =>
  spawnSync(
    process.execPath,
    [path.join(__dirname, '../helpers/electron-integrity-probe.js'), ...args],
    { encoding: 'utf8', timeout: 15000 }
  );

describe('packager checksum configuration', () => {
  it.each(targets)(
    'verifies %s/%s with the checksum-list endpoint unavailable',
    (platform, arch) => {
      const result = probe(platform, arch);
      expect({ status: result.status, error: result.stderr.trim() }).toEqual({
        status: 0,
        error: '',
      });
      expect(result.stdout.trim()).toBe('Archive and cache verified');
    }
  );

  it('rejects a damaged archive instead of skipping verification', () => {
    const result = probe('darwin', 'arm64', 'damaged');
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/checksum.*did not match/i);
  });
});
