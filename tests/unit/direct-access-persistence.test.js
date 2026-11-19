const path = require('path');
const {
  createDirectAccess,
  DIRECT_GRANTS_KEY,
} = require('../../desktop/direct-access');

describe('direct desktop grant persistence failures', () => {
  const folder = path.resolve('synthetic-direct-grants');
  const file = path.join(folder, 'selected.md');
  const second = path.join(folder, 'second.md');
  const outside = path.resolve('synthetic-unselected', 'private.md');
  let data, store, fsModule, access, writeMode;

  beforeEach(() => {
    data = {};
    writeMode = 'success';
    store = {
      get: (key, fallback) => data[key] ?? fallback,
      set: jest.fn((key, value) => {
        if (writeMode === 'throw') throw new Error('synthetic write failure');
        if (writeMode === 'false') return false;
        if (writeMode === 'unacknowledged') return undefined;
        data[key] = value;
        return true;
      }),
    };
    fsModule = {
      realpathSync: jest.fn((target) => target),
      statSync: jest.fn((target) => ({
        isFile: () => target === file || target === second,
        isDirectory: () => target === folder,
      })),
    };
    access = createDirectAccess({ getStore: () => store, fsModule });
  });

  it.each([
    ['false', 'file'],
    ['throw', 'file'],
    ['unacknowledged', 'file'],
    ['false', 'folder'],
    ['throw', 'folder'],
    ['unacknowledged', 'folder'],
  ])(
    'retains a selected %s-write %s grant until a successful retry',
    (mode, kind) => {
      writeMode = mode;
      expect(
        access.noteUserIntent(kind === 'folder' ? folder : file, kind)
      ).toBe(true);
      expect(access.withAccess(file, (target) => target)).toEqual({
        ok: true,
        path: file,
        value: file,
      });
      expect(data[DIRECT_GRANTS_KEY]).toBeUndefined();
      expect(
        createDirectAccess({ getStore: () => store, fsModule }).hasGrant(file)
      ).toBe(false);
      expect(access.flushPendingGrants()).toBe(false);
      expect(access.hasGrant(file)).toBe(true);

      fsModule.realpathSync.mockClear();
      expect(access.withAccess(outside, jest.fn()).ok).toBe(false);
      expect(fsModule.realpathSync).not.toHaveBeenCalled();

      writeMode = 'success';
      expect(access.flushPendingGrants()).toBe(true);
      expect(
        createDirectAccess({ getStore: () => store, fsModule }).hasGrant(file)
      ).toBe(true);
      store.set.mockClear();
      expect(access.flushPendingGrants()).toBe(false);
      expect(store.set).not.toHaveBeenCalled();
    }
  );

  it('does not relax canonical-path checks for an unpersisted grant', () => {
    writeMode = 'false';
    expect(access.noteUserIntent(file, 'file')).toBe(true);
    fsModule.realpathSync.mockReturnValue(outside);
    expect(access.withAccess(file, jest.fn()).ok).toBe(false);
  });

  it.each(['false', 'throw'])(
    'forget removes a pending grant despite a %s write',
    (mode) => {
      writeMode = mode;
      expect(access.noteUserIntent(file, 'file')).toBe(true);
      expect(access.hasGrant(file)).toBe(true);
      expect(() => access.forget(file)).not.toThrow();
      expect(access.hasGrant(file)).toBe(false);
      expect(access.flushPendingGrants()).toBe(false);
      writeMode = 'success';
      access.flushPendingGrants();
      expect(
        createDirectAccess({ getStore: () => store, fsModule }).hasGrant(file)
      ).toBe(false);
    }
  );

  it('retries a failed forget without restoring the persisted grant', () => {
    expect(access.noteUserIntent(file, 'file')).toBe(true);
    writeMode = 'false';
    access.forget(file);
    expect(access.hasGrant(file)).toBe(false);
    expect(access.flushPendingGrants()).toBe(false);
    // The disk still has the old grant until a write succeeds.
    expect(
      createDirectAccess({ getStore: () => store, fsModule }).hasGrant(file)
    ).toBe(true);
    expect(access.noteUserIntent(second, 'file')).toBe(true);
    expect(access.hasGrant(second)).toBe(true);
    expect(access.hasGrant(file)).toBe(false);
    writeMode = 'success';
    expect(access.flushPendingGrants()).toBe(true);
    const restarted = createDirectAccess({ getStore: () => store, fsModule });
    expect(restarted.hasGrant(file)).toBe(false);
    expect(restarted.hasGrant(second)).toBe(true);
  });

  it('accepts a new explicit user selection after a failed forget', () => {
    access.noteUserIntent(file, 'file');
    writeMode = 'false';
    access.forget(file);
    expect(access.hasGrant(file)).toBe(false);
    expect(access.noteUserIntent(file, 'file')).toBe(true);
    expect(access.hasGrant(file)).toBe(true);
    writeMode = 'success';
    expect(access.flushPendingGrants()).toBe(true);
    expect(
      createDirectAccess({ getStore: () => store, fsModule }).hasGrant(file)
    ).toBe(true);
  });

  it('keeps multiple early grants retryable when the store becomes available', () => {
    let ready = null;
    const early = createDirectAccess({ getStore: () => ready, fsModule });
    expect(early.noteUserIntent(file, 'file')).toBe(true);
    expect(early.noteUserIntent(second, 'file')).toBe(true);
    expect(early.flushPendingGrants()).toBe(false);
    ready = store;
    writeMode = 'false';
    expect(early.flushPendingGrants()).toBe(false);
    expect(early.hasGrant(file)).toBe(true);
    expect(early.hasGrant(second)).toBe(true);
    writeMode = 'success';
    expect(early.flushPendingGrants()).toBe(true);
    expect(data[DIRECT_GRANTS_KEY].entries).toHaveLength(2);
  });
});
