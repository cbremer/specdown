const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createAnnotationIdentity,
} = require('../../desktop/annotation-identity');
let directory;
beforeEach(() => {
  directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'specdown-synthetic-identity-')
  );
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
test('I04/I05/I06/T05: durable logical-location identity survives reopen without filename or digest merging', () => {
  const file = path.join(directory, 'identity.sqlite');
  const registry = createAnnotationIdentity(file);
  const first = registry.afterAuthorizedRead('/synthetic/A.md');
  expect(first).toEqual(
    expect.objectContaining({
      authorityId: expect.any(String),
      sourceToken: expect.any(String),
    })
  );
  expect(registry.afterAuthorizedRead('/synthetic/A.md')).toEqual(first);
  expect(registry.afterAuthorizedRead('/synthetic/B.md')).not.toEqual(first);
  registry.close();
  const reopened = createAnnotationIdentity(file);
  expect(reopened.afterAuthorizedRead('/synthetic/A.md')).toEqual(first);
  reopened.close();
});
test('I05: file-bookmark move, vacated-location reuse and repeated collision reads preserve independent stable identities', () => {
  const file = path.join(directory, 'identity.sqlite');
  const registry = createAnnotationIdentity(file);
  const keyA = require('crypto').randomUUID(),
    keyB = require('crypto').randomUUID(),
    keyNew = require('crypto').randomUUID();
  const read = (location, key) =>
    registry.afterAuthorizedRead(location, {
      sourceKind: 'file-bookmark',
      grantKey: key,
    });
  const a = read('/synthetic/old.md', keyA),
    b = read('/synthetic/destination.md', keyB);
  expect(read('/synthetic/moved.md', keyA)).toEqual(a);
  const newcomer = read('/synthetic/old.md', keyNew);
  expect(newcomer.sourceToken).not.toBe(a.sourceToken);
  expect(read('/synthetic/moved.md', keyA)).toEqual(a);
  const collision = read('/synthetic/destination.md', keyA);
  expect(collision.requiresReconnect).toBe(true);
  expect([a.sourceToken, b.sourceToken]).not.toContain(collision.sourceToken);
  expect(read('/synthetic/destination.md', keyA)).toEqual(collision);
  expect(read('/synthetic/destination.md', keyB).sourceToken).not.toBe(
    b.sourceToken
  );
  registry.close();
  const reopened = createAnnotationIdentity(file);
  expect(
    reopened.afterAuthorizedRead('/synthetic/destination.md', {
      sourceKind: 'file-bookmark',
      grantKey: keyA,
    })
  ).toEqual(collision);
  reopened.close();
});
test('T05: corrupt or inaccessible registries never recreate authority or prevent content reading', () => {
  const file = path.join(directory, 'identity.sqlite');
  fs.writeFileSync(file, 'future/corrupt raw data');
  const registry = createAnnotationIdentity(file);
  expect(registry.afterAuthorizedRead('/synthetic/A.md')).toBeNull();
  expect(fs.readFileSync(file, 'utf8')).toBe('future/corrupt raw data');
});
test('T05: lost enrolled registry never creates another authority', () => {
  const file = path.join(directory, 'identity.sqlite');
  const first = createAnnotationIdentity(file);
  expect(first.afterAuthorizedRead('/synthetic/A.md')).not.toBeNull();
  first.close();
  fs.unlinkSync(file);
  const lost = createAnnotationIdentity(file);
  expect(lost.afterAuthorizedRead('/synthetic/A.md')).toBeNull();
  expect(fs.existsSync(file)).toBe(false);
});
test.each(['authority', 'source'])(
  'T05: malformed %s rows fail closed without advertising durable IDs',
  (kind) => {
    const file = path.join(directory, 'identity.sqlite');
    const registry = createAnnotationIdentity(file);
    registry.afterAuthorizedRead('/synthetic/A.md');
    registry.close();
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(file);
    db.exec(
      kind === 'authority'
        ? "UPDATE authority SET id='bad'"
        : "UPDATE sources SET token='bad'"
    );
    db.close();
    const corrupt = createAnnotationIdentity(file);
    expect(corrupt.afterAuthorizedRead('/synthetic/A.md')).toBeNull();
  }
);
test('T05: registry persistence failure permits no fabricated successful source binding', () => {
  const registry = createAnnotationIdentity(
    path.join(directory, 'missing', 'identity.sqlite')
  );
  expect(registry.afterAuthorizedRead('/synthetic/A.md')).toBeNull();
});
test('T04/T05: an already-open native connection rejects a future registry version changed by another process', () => {
  const file = path.join(directory, 'identity.sqlite');
  const registry = createAnnotationIdentity(file);
  expect(registry.afterAuthorizedRead('/synthetic/A.md')).not.toBeNull();
  const { DatabaseSync } = require('node:sqlite');
  const other = new DatabaseSync(file);
  other.exec('PRAGMA user_version=7');
  other.close();
  expect(registry.afterAuthorizedRead('/synthetic/A.md')).toBeNull();
  const check = new DatabaseSync(file);
  expect(check.prepare('PRAGMA user_version').get().user_version).toBe(7);
  check.close();
  registry.close();
});
test('I06 — revoking/regranting a synthetic capability does not delete or transfer native source identity', () => {
  const { createDirectAccess } = require('../../desktop/direct-access');
  const source = path.join(directory, 'README.md');
  fs.writeFileSync(source, 'Body');
  const registry = createAnnotationIdentity(
    path.join(directory, 'identity.sqlite')
  );
  const access = createDirectAccess();
  access.noteUserIntent(source, 'file');
  const first = access.withAccess(source, (p) => {
    fs.readFileSync(p);
    return registry.afterAuthorizedRead(p);
  }).value;
  access.forget(source);
  const read = jest.fn();
  expect(access.withAccess(source, read).ok).toBe(false);
  expect(read).not.toHaveBeenCalled();
  access.noteUserIntent(source, 'file');
  expect(
    access.withAccess(source, (p) => {
      fs.readFileSync(p);
      return registry.afterAuthorizedRead(p);
    }).value
  ).toEqual(first);
  registry.close();
});
test.each([false, true])(
  'T05: preexisting zero-byte registry stays untouched (enrolled=%s)',
  (enrolled) => {
    const file = path.join(directory, 'identity.sqlite');
    if (enrolled) {
      const initial = createAnnotationIdentity(file);
      initial.afterAuthorizedRead('/synthetic/a.md');
      initial.close();
    }
    fs.writeFileSync(file, '');
    const registry = createAnnotationIdentity(file);
    expect(registry.afterAuthorizedRead('/synthetic/a.md')).toBeNull();
    expect(fs.readFileSync(file)).toHaveLength(0);
    registry.close();
  }
);

test.each(['win32', 'darwin'])(
  'T05: %s enrollment fsyncs marker and uses supported directory durability',
  (platform) => {
    // Exercise both platform branches on every host. Windows cannot open a
    // directory fd, so model only that POSIX syscall; marker I/O remains real.
    const originalOpen = fs.openSync,
      originalSync = fs.fsyncSync,
      originalClose = fs.closeSync,
      directoryFd = Symbol('synthetic POSIX directory descriptor');
    const open = jest
        .spyOn(fs, 'openSync')
        .mockImplementation((name, ...args) =>
          name === directory ? directoryFd : originalOpen(name, ...args)
        ),
      sync = jest.spyOn(fs, 'fsyncSync').mockImplementation((fd) => {
        if (fd !== directoryFd) originalSync(fd);
      }),
      close = jest.spyOn(fs, 'closeSync').mockImplementation((fd) => {
        if (fd !== directoryFd) originalClose(fd);
      });
    const file = path.join(directory, 'identity.sqlite');
    const registry = createAnnotationIdentity(file, { platform });
    try {
      expect(
        registry.afterAuthorizedRead(path.join(directory, 'file.md'))
      ).not.toBeNull();
      expect(sync).toHaveBeenCalledTimes(platform === 'win32' ? 1 : 2);
      expect(
        open.mock.calls.filter((call) => call[0] === directory)
      ).toHaveLength(platform === 'win32' ? 0 : 1);
    } finally {
      registry.close();
      open.mockRestore();
      sync.mockRestore();
      close.mockRestore();
    }
  }
);
test('T05: POSIX directory sync failure fails closed', () => {
  const original = fs.openSync;
  const open = jest
    .spyOn(fs, 'openSync')
    .mockImplementation((name, ...args) => {
      if (name === directory) throw Error('directory sync unavailable');
      return original(name, ...args);
    });
  const registry = createAnnotationIdentity(
    path.join(directory, 'identity.sqlite'),
    { platform: 'darwin' }
  );
  try {
    expect(
      registry.afterAuthorizedRead(path.join(directory, 'file.md'))
    ).toBeNull();
  } finally {
    registry.close();
    open.mockRestore();
  }
});
