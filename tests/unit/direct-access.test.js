const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createDirectAccess,
  DIRECT_GRANTS_KEY,
} = require('../../desktop/direct-access');

describe('direct desktop file capabilities', () => {
  let root, outside, file, access, data, store;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-capability-'));
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-outside-'));
    file = path.join(root, 'chosen.md');
    fs.writeFileSync(file, '# chosen');
    fs.writeFileSync(path.join(outside, 'secret.md'), '# secret');
    data = { recentFiles: [file], session: { tabs: [{ filePath: file }] } };
    store = {
      get: (k, fallback) => data[k] ?? fallback,
      set: (k, v) => {
        data[k] = v;
      },
    };
    access = createDirectAccess({ getStore: () => store });
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  it('never probes or reads an ungranted path, even one in renderer session/recents', async () => {
    const stat = jest.spyOn(fs, 'realpathSync');
    const read = jest.fn();
    expect(access.withAccess(file, read).ok).toBe(false);
    expect((await access.withAccessAsync(file, read)).ok).toBe(false);
    expect(access.hold(file)).toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(stat).not.toHaveBeenCalled();
    stat.mockRestore();
  });
  it('persists picker grants separately, allowing current content after restart', () => {
    expect(access.noteUserIntent(file, 'file')).toBe(true);
    expect(data[DIRECT_GRANTS_KEY].entries).toHaveLength(1);
    const restarted = createDirectAccess({ getStore: () => store });
    expect(
      restarted.withAccess(file, (p) => fs.readFileSync(p, 'utf8')).value
    ).toBe('# chosen');
    restarted.forget(file);
    expect(restarted.hasGrant(file)).toBe(false);
  });
  it('permits chosen workspace descendants but rejects traversal and symlink escapes', () => {
    access.noteUserIntent(root, 'folder');
    expect(access.hasGrant(file)).toBe(true);
    expect(access.hasGrant(path.join(outside, 'secret.md'))).toBe(false);
    const link = path.join(root, 'secret.md');
    fs.symlinkSync(path.join(outside, 'secret.md'), link);
    expect(access.withAccess(link, jest.fn()).ok).toBe(false);
  });
  it('rejects a chosen file replaced with a symlink to a different file', () => {
    access.noteUserIntent(file, 'file');
    fs.unlinkSync(file);
    fs.symlinkSync(path.join(outside, 'secret.md'), file);
    expect(access.hasGrant(file)).toBe(false);
  });
  it('persists early Finder grants once the store exists', () => {
    let ready = null;
    const early = createDirectAccess({ getStore: () => ready });
    early.noteUserIntent(file, 'file');
    expect(early.hasGrant(file)).toBe(true);
    ready = store;
    expect(early.flushPendingGrants()).toBe(true);
    expect(createDirectAccess({ getStore: () => store }).hasGrant(file)).toBe(
      true
    );
  });
});
