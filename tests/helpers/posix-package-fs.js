// A deliberately small POSIX filesystem for Mac package permission contracts.
// Directory entries name shared inodes; open descriptors retain inode identity
// across unlink/replace, and symlinks are resolved independently from lstat.
// This models filesystem mechanisms, not the package guard's expected results.
const hostFs = require('node:fs');
const hostPath = require('node:path');
const vm = require('node:vm');
const path = hostPath.posix;

function createPosixFs() {
  const entries = new Map();
  const descriptors = new Map();
  let nextInode = 1;
  let nextDescriptor = 10;
  let nextTemporary = 1;
  const constants = { O_RDONLY: 0, O_NOFOLLOW: 0x20000 };
  const types = { directory: 0o040000, file: 0o100000, link: 0o120000 };
  const fail = (code) => {
    throw Object.assign(new Error(code), { code });
  };
  function inode(kind, mode, data) {
    return { kind, mode, data, ino: nextInode++, dev: 1, nlink: 1 };
  }
  entries.set('/', inode('directory', 0o755));
  entries.set('/tmp', inode('directory', 0o755));

  function lookup(name, followFinal = true, depth = 0) {
    if (depth > 40) fail('ELOOP');
    const pieces = path.resolve('/', name).split('/').filter(Boolean);
    let current = '/';
    for (let i = 0; i < pieces.length; i++) {
      current = path.join(current, pieces[i]);
      const node = entries.get(current);
      if (!node) fail('ENOENT');
      if (node.kind === 'link' && (followFinal || i < pieces.length - 1)) {
        return lookup(
          path.resolve(
            path.dirname(current),
            node.data,
            ...pieces.slice(i + 1)
          ),
          followFinal,
          depth + 1
        );
      }
      if (i < pieces.length - 1 && node.kind !== 'directory') fail('ENOTDIR');
    }
    return { name: current, node: entries.get(current) };
  }
  function destination(name) {
    const parent = lookup(path.dirname(name));
    if (parent.node.kind !== 'directory') fail('ENOTDIR');
    return path.join(parent.name, path.basename(name));
  }
  function snapshot(node) {
    return {
      mode: types[node.kind] | node.mode,
      ino: node.ino,
      dev: node.dev,
      nlink: node.nlink,
      isFile: () => node.kind === 'file',
      isDirectory: () => node.kind === 'directory',
      isSymbolicLink: () => node.kind === 'link',
    };
  }
  function descriptor(fd) {
    if (!descriptors.has(fd)) fail('EBADF');
    return descriptors.get(fd);
  }
  const fs = {
    constants,
    lstatSync: (name) => snapshot(lookup(name, false).node),
    statSync: (name) => snapshot(lookup(name).node),
    realpathSync: (name) => lookup(name).name,
    readlinkSync(name) {
      const { node } = lookup(name, false);
      if (node.kind !== 'link') fail('EINVAL');
      return node.data;
    },
    mkdirSync(name, options = {}) {
      const normalized = path.resolve('/', name);
      if (options.recursive && !entries.has(path.dirname(normalized)))
        fs.mkdirSync(path.dirname(normalized), options);
      const target = destination(normalized);
      if (entries.has(target)) {
        if (options.recursive && entries.get(target).kind === 'directory')
          return;
        fail('EEXIST');
      }
      entries.set(target, inode('directory', options.mode ?? 0o755));
    },
    mkdtempSync(prefix) {
      const name = `${prefix}${nextTemporary++}`;
      fs.mkdirSync(name, { mode: 0o700 });
      return name;
    },
    writeFileSync(name, data, options = {}) {
      const target = destination(name);
      const node = entries.has(target) ? lookup(target).node : null;
      if (node && node.kind !== 'file') fail('EISDIR');
      const bytes = Buffer.from(data);
      if (node) node.data = bytes;
      else entries.set(target, inode('file', options.mode ?? 0o644, bytes));
    },
    readFileSync(name, encoding) {
      const { node } = lookup(name);
      if (node.kind !== 'file') fail('EISDIR');
      return encoding ? node.data.toString(encoding) : Buffer.from(node.data);
    },
    copyFileSync(source, target) {
      const { node } = lookup(source);
      fs.writeFileSync(target, fs.readFileSync(source), { mode: node.mode });
    },
    chmodSync(name, mode) {
      lookup(name).node.mode = mode;
    },
    symlinkSync(target, name) {
      const dest = destination(name);
      if (entries.has(dest)) fail('EEXIST');
      entries.set(dest, inode('link', 0o777, target));
    },
    linkSync(source, target) {
      const { node } = lookup(source);
      const dest = destination(target);
      if (entries.has(dest)) fail('EEXIST');
      node.nlink++;
      entries.set(dest, node);
    },
    unlinkSync(name) {
      const { name: target, node } = lookup(name, false);
      node.nlink--;
      entries.delete(target);
    },
    renameSync(source, target) {
      const old = lookup(source, false).name;
      const dest = destination(target);
      if (entries.has(dest)) fs.unlinkSync(dest);
      const moved = [...entries].filter(
        ([key]) => key === old || key.startsWith(`${old}/`)
      );
      for (const [key] of moved) entries.delete(key);
      for (const [key, node] of moved)
        entries.set(dest + key.slice(old.length), node);
    },
    readdirSync(name) {
      const dir = lookup(name);
      if (dir.node.kind !== 'directory') fail('ENOTDIR');
      return [...entries.keys()]
        .filter((key) => key !== dir.name && path.dirname(key) === dir.name)
        .map((key) => path.basename(key));
    },
    openSync(name, flags) {
      const { node } = lookup(name, !(flags & constants.O_NOFOLLOW));
      if (node.kind === 'link') fail('ELOOP');
      const fd = nextDescriptor++;
      descriptors.set(fd, node);
      return fd;
    },
    fstatSync: (fd) => snapshot(descriptor(fd)),
    fchmodSync(fd, mode) {
      descriptor(fd).mode = mode;
    },
    closeSync(fd) {
      descriptor(fd);
      descriptors.delete(fd);
    },
    rmSync(name, options = {}) {
      let target;
      try {
        target = lookup(name, false).name;
      } catch (error) {
        if (options.force && error.code === 'ENOENT') return;
        throw error;
      }
      const children = [...entries.keys()].filter((key) =>
        key.startsWith(`${target}/`)
      );
      if (children.length && !options.recursive) fail('ENOTEMPTY');
      for (const key of [...children, target].sort(
        (a, b) => b.length - a.length
      ))
        fs.unlinkSync(key);
    },
  };
  return fs;
}

// Load the actual guard with test-only core dependencies. No production seam,
// global filesystem mock, signing invocation, or private profile is involved.
function loadPermissionGuard(fs, execFileSync) {
  const filename = hostPath.resolve(
    __dirname,
    '../../scripts/mas-package-permissions.js'
  );
  const module = { exports: {} };
  const dependencies = {
    'node:fs': fs,
    'node:path': path,
    'node:child_process': { execFileSync },
  };
  const requireFixture = (name) => {
    if (!(name in dependencies))
      throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  };
  vm.runInNewContext(
    hostFs.readFileSync(filename, 'utf8'),
    {
      module,
      exports: module.exports,
      require: requireFixture,
      console,
    },
    { filename }
  );
  return module.exports;
}

module.exports = { createPosixFs, loadPermissionGuard };
