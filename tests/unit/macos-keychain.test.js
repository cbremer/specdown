const fs = require('node:fs');
const vm = require('node:vm');
const { patchSource } = require('../../scripts/patch-macos-keychain');
const installedVersion = require('app-builder-lib/package.json').version;
const installed = fs.readFileSync(
  require.resolve('app-builder-lib/out/codeSign/macCodeSign.js'),
  'utf8'
);
const original = installed
  .replace(
    'importCerts(keychainFile, certPaths, cscPasswords, keychainPassword)',
    'importCerts(keychainFile, certPaths, cscPasswords)'
  )
  .replace(
    'importCerts(keychainFile, paths, keyPasswords, keychainPassword)',
    'importCerts(keychainFile, paths, keyPasswords)'
  )
  .replace(
    '"-k", keychainPassword, keychainFile]',
    '"-k", password, keychainFile]'
  );

async function signingCommands(source) {
  const calls = [];
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    process,
    require(id) {
      if (id === 'builder-util')
        return {
          exec: async (_binary, args) => {
            calls.push(args);
            return '';
          },
        };
      if (id === 'lazy-val') return { Lazy: class {} };
      if (id === './codesign')
        return { importCertificate: async (link) => link };
      if (['crypto', 'fs/promises', 'os', 'path'].includes(id))
        return require(id);
      return {};
    },
  });
  await exports.createKeychain({
    tmpDir: {},
    currentDir: '/test',
    cscLink: '/application.p12',
    cscKeyPassword: 'application-password',
    cscILink: '/installer.p12',
    cscIKeyPassword: 'installer-password',
  });
  return calls;
}

test.each([
  ['26.15.3 backport', () => patchSource(original, '26.15.3')],
  ['installed upstream fix', () => patchSource(installed, installedVersion)],
])(
  '%s uses the keychain password for ACLs and certificate passwords for import',
  async (_label, source) => {
    const calls = await signingCommands(source());
    const keychainPassword = calls.find(
      ([command]) => command === 'create-keychain'
    )[2];
    const partitions = calls.filter(
      ([command]) => command === 'set-key-partition-list'
    );
    expect(partitions).toHaveLength(2);
    for (const args of partitions)
      expect(args[args.indexOf('-k') + 1]).toBe(keychainPassword);
    expect(
      calls
        .filter(([command]) => command === 'import')
        .map((args) => args[args.indexOf('-P') + 1])
    ).toEqual(['application-password', 'installer-password']);
    const broken = await signingCommands(original);
    expect(
      broken.find(([command]) => command === 'set-key-partition-list')[6]
    ).not.toBe(broken.find(([command]) => command === 'create-keychain')[2]);
  }
);

test('clean install has the correction and reviewed versions are idempotent', () => {
  expect(installed).toBe(patchSource(original, '26.15.3'));
  expect(patchSource(installed, '26.15.3')).toBe(installed);
  expect(patchSource(installed, installedVersion)).toBe(installed);
});

test('26.18.1 verifies its upstream fix without modifying source', () => {
  const patched = patchSource(original, '26.15.3');
  expect(patchSource(patched, '26.18.1')).toBe(patched);
  expect(() => patchSource(original, '26.18.1')).toThrow('Unexpected');
  expect(() =>
    patchSource(
      patched.replace('cscPasswords, keychainPassword)', 'cscPasswords)'),
      '26.18.1'
    )
  ).toThrow('Unexpected');
  expect(() => patchSource(patched + patched, '26.18.1')).toThrow('Unexpected');
});

test('refuses dependency upgrades and unexpected or partially patched source', () => {
  expect(() => patchSource(original, '26.16.0')).toThrow('Review');
  expect(() => patchSource(installed, '26.18.2')).toThrow('Review');
  expect(() => patchSource('unknown source', '26.15.3')).toThrow('Unexpected');
  expect(() =>
    patchSource(
      original.replace('cscPasswords)', 'cscPasswords, keychainPassword)'),
      '26.15.3'
    )
  ).toThrow('Unexpected');
});
