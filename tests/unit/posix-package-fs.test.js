const { createPosixFs } = require('../helpers/posix-package-fs');

// Independent model controls: assert underlying filesystem semantics, rather
// than asking the permission guard whether its own fixtures are acceptable.
describe('POSIX package filesystem model', () => {
  let fs;
  beforeEach(() => {
    fs = createPosixFs();
    fs.writeFileSync('/tmp/source', 'source bytes', { mode: 0o600 });
  });

  it('hardlink aliases share inode, bytes, mode and link count', () => {
    fs.linkSync('/tmp/source', '/tmp/alias');
    expect(fs.statSync('/tmp/alias').ino).toBe(fs.statSync('/tmp/source').ino);
    expect(fs.statSync('/tmp/source').nlink).toBe(2);
    fs.chmodSync('/tmp/alias', 0o644);
    expect(fs.statSync('/tmp/source').mode & 0o7777).toBe(0o644);
    fs.writeFileSync('/tmp/alias', 'changed through alias');
    expect(fs.readFileSync('/tmp/source', 'utf8')).toBe(
      'changed through alias'
    );
    fs.unlinkSync('/tmp/alias');
    expect(fs.statSync('/tmp/source').nlink).toBe(1);
  });

  it('open descriptors retain an unlinked inode across pathname replacement', () => {
    const fd = fs.openSync('/tmp/source', fs.constants.O_RDONLY);
    const original = fs.fstatSync(fd);
    fs.unlinkSync('/tmp/source');
    fs.writeFileSync('/tmp/source', 'new bytes', { mode: 0o600 });
    fs.fchmodSync(fd, 0o644);
    expect(fs.fstatSync(fd)).toMatchObject({ ino: original.ino, nlink: 0 });
    expect(fs.fstatSync(fd).mode & 0o7777).toBe(0o644);
    expect(original.mode & 0o7777).toBe(0o600); // stat is a snapshot
    expect(fs.statSync('/tmp/source').ino).not.toBe(original.ino);
    expect(fs.statSync('/tmp/source').mode & 0o7777).toBe(0o600);
    expect(fs.readFileSync('/tmp/source', 'utf8')).toBe('new bytes');
    fs.closeSync(fd);
    expect(() => fs.fstatSync(fd)).toThrow('EBADF');
  });

  it('distinguishes link metadata, followed stat and O_NOFOLLOW rejection', () => {
    fs.symlinkSync('source', '/tmp/link');
    expect(fs.lstatSync('/tmp/link').isSymbolicLink()).toBe(true);
    expect(fs.statSync('/tmp/link').isFile()).toBe(true);
    expect(fs.realpathSync('/tmp/link')).toBe('/tmp/source');
    expect(fs.readlinkSync('/tmp/link')).toBe('source');
    expect(() => fs.openSync('/tmp/link', fs.constants.O_NOFOLLOW)).toThrow(
      'ELOOP'
    );
    fs.chmodSync('/tmp/link', 0o644);
    expect(fs.statSync('/tmp/source').mode & 0o7777).toBe(0o644);
    fs.symlinkSync('cycle', '/tmp/cycle');
    expect(() => fs.realpathSync('/tmp/cycle')).toThrow('ELOOP');
  });

  it('resolves directory links and escapes independently of the bundle guard', () => {
    fs.mkdirSync('/tmp/app/Contents', { recursive: true });
    fs.symlinkSync('../../source', '/tmp/app/Contents/outside');
    fs.symlinkSync('app/Contents', '/tmp/contents');
    expect(fs.realpathSync('/tmp/contents/outside')).toBe('/tmp/source');
    expect(fs.lstatSync('/tmp/contents').isDirectory()).toBe(false);
    expect(fs.statSync('/tmp/contents').isDirectory()).toBe(true);
    fs.rmSync('/tmp/app', { recursive: true });
    expect(fs.readFileSync('/tmp/source', 'utf8')).toBe('source bytes');
  });

  it('copies bytes without sharing inode or permission changes', () => {
    fs.copyFileSync('/tmp/source', '/tmp/copy');
    expect(fs.statSync('/tmp/copy').ino).not.toBe(
      fs.statSync('/tmp/source').ino
    );
    fs.chmodSync('/tmp/copy', 0o644);
    fs.writeFileSync('/tmp/copy', 'new');
    expect(fs.statSync('/tmp/source').mode & 0o7777).toBe(0o600);
    expect(fs.readFileSync('/tmp/source', 'utf8')).toBe('source bytes');
  });
});
