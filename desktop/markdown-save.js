// Called only inside a current file-access capability. No path is a grant.
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const maxSaveBytes = 8 * 1024 * 1024;
function readSaveSource(target, io) {
  const fd = io.openSync(
    target,
    fs.constants.O_RDONLY | fs.constants.O_NONBLOCK
  );
  try {
    const stat = io.fstatSync(fd);
    if (!stat.isFile() || stat.size > maxSaveBytes)
      throw Error('Choose an available Markdown file up to 8 MiB.');
    const bytes = Buffer.alloc(maxSaveBytes + 1);
    const size = io.readSync(fd, bytes, 0, bytes.length, 0);
    if (size > maxSaveBytes) throw Error('Source exceeds 8 MiB.');
    return { content: bytes.subarray(0, size).toString('utf8'), stat };
  } finally {
    io.closeSync(fd);
  }
}
function cleanupSaveStage(staged, io, sandbox) {
  if (io.existsSync(staged)) io.unlinkSync(staged);
  if (sandbox) {
    try {
      io.rmdirSync(path.dirname(staged));
    } catch {
      // Foundation owns this temporary directory. A cleanup failure does not
      // change whether the selected document was already saved.
    }
  }
}
function saveExistingMarkdown(target, content, expected, io = fs, sandbox) {
  if (
    typeof content !== 'string' ||
    Buffer.byteLength(content) > maxSaveBytes ||
    typeof expected !== 'string'
  )
    throw Error('Markdown must be 8 MiB or smaller.');
  // Resolve symlinks only after access was granted, and preserve the selected item.
  const resolved = io.realpathSync(target);
  // A .md destination can be a symlink to the Word input.
  if (['.docx', '.pdf'].includes(path.extname(resolved).toLowerCase())) {
    return {
      status: 'error',
      message:
        'Choose a Markdown destination separate from the imported document.',
    };
  }
  const original = readSaveSource(resolved, io);
  if (original.content !== expected)
    return { status: 'conflict', content: original.content };
  io.accessSync(resolved, fs.constants.W_OK);
  const directory = sandbox
    ? sandbox.replacementDirectory(resolved)
    : path.dirname(resolved);
  const staged = path.join(directory, `.specdown-save-${randomUUID()}.tmp`);
  try {
    io.writeFileSync(staged, content, {
      encoding: 'utf8',
      flag: 'wx',
      flush: true,
      mode: original.stat.mode & 0o777,
    });
    const latest = readSaveSource(resolved, io);
    if (
      latest.content !== expected ||
      latest.stat.ino !== original.stat.ino ||
      latest.stat.mtimeMs !== original.stat.mtimeMs
    )
      return { status: 'conflict', content: latest.content };
    // Synchronous final compare/rename: no app task or provider callback interleaves.
    // Filesystems do not provide cross-process compare-and-swap; see acceptance notes.
    io.renameSync(staged, resolved);
    return { status: 'saved' };
  } finally {
    cleanupSaveStage(staged, io, sandbox);
  }
}
function saveMarkdownCopy(target, content, io = fs, sandbox) {
  if (typeof content !== 'string' || Buffer.byteLength(content) > maxSaveBytes)
    throw Error('Markdown must be 8 MiB or smaller.');
  if (io.existsSync(target))
    return saveExistingMarkdown(
      target,
      content,
      readSaveSource(target, io).content,
      io,
      sandbox
    );
  // Foundation may create an empty file when asked about a nonexistent URL.
  // Use the existing parent as the volume hint to preserve exclusive creation.
  const parent = path.dirname(target);
  const directory = sandbox ? sandbox.replacementDirectory(parent) : parent;
  const staged = path.join(directory, `.specdown-copy-${randomUUID()}.tmp`);
  try {
    io.writeFileSync(staged, content, {
      encoding: 'utf8',
      flag: 'wx',
      flush: true,
      mode: 0o600,
    });
    if (sandbox) sandbox.commitNewFile(staged, target);
    else io.linkSync(staged, target); // Atomic no-clobber creation; EEXIST retains the draft.
    return { status: 'saved' };
  } finally {
    cleanupSaveStage(staged, io, sandbox);
  }
}
module.exports = { saveExistingMarkdown, saveMarkdownCopy };
