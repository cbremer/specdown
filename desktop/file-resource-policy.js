// File subresources must not turn document markup into arbitrary local or UNC
// requests. This is independent of sanitization: relative paths, redirects and
// CSS URLs all pass through the Electron session boundary.
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

function resourceIsInside(root, target) {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function createFileResourcePolicy(
  bundleDirectory,
  hasDocumentGrant = () => true,
  withImageAccess = (target, read) => ({ ok: true, value: read(target) })
) {
  const bundlePath = path.resolve(bundleDirectory);
  let bundleRealPath;
  try {
    bundleRealPath = fs.realpathSync(bundlePath);
  } catch {
    /* Fail closed when the bundle is missing. */
  }
  const documentDirectories = new Map();
  const printFiles = new Set();
  const sessions = new WeakSet();
  const imageExtensions = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.avif',
    '.svg',
    '.bmp',
    '.ico',
  ]);
  function allows(details) {
    let url;
    try {
      url = new URL(details.url);
    } catch {
      return false;
    }
    if (url.protocol !== 'file:') return true;
    if (url.hostname) return false; // Reject network shares before filesystem APIs.
    let target;
    try {
      target = fileURLToPath(url);
    } catch {
      return false;
    }
    if (/^[\\/]{2}/.test(target)) return false;
    if (printFiles.has(target) && details.resourceType === 'mainFrame')
      return true;
    const normalized = path.resolve(target);
    const inBundle =
      resourceIsInside(bundlePath, normalized) ||
      (bundleRealPath && resourceIsInside(bundleRealPath, normalized));
    const candidateDirectories = [];
    if (
      details.resourceType === 'image' &&
      imageExtensions.has(path.extname(normalized).toLowerCase())
    ) {
      for (const [document, directory] of documentDirectories) {
        if (
          !resourceIsInside(directory.path, normalized) &&
          !resourceIsInside(directory.realPath, normalized)
        )
          continue;
        // A forgotten grant must not leave sibling-image access behind. This
        // probes only the already-granted document, never the requested path.
        if (hasDocumentGrant(document))
          candidateDirectories.push(directory.realPath);
        else documentDirectories.delete(document);
      }
    }
    // MAS must not even probe arbitrary paths: TCC can block instead of fail.
    if (!inBundle && !candidateDirectories.length) return false;
    try {
      if (inBundle) {
        const real = fs.realpathSync(normalized);
        return !!bundleRealPath && resourceIsInside(bundleRealPath, real);
      }
      // MAS requires an image/folder grant of its own: choosing a Markdown
      // file grants no sibling access. The adapter acquires that grant before
      // canonicalization and never invokes the callback for ungranted images.
      const access = withImageAccess(normalized, (grantedPath) => {
        const real = fs.realpathSync(grantedPath);
        return candidateDirectories.some((directory) =>
          resourceIsInside(directory, real)
        );
      });
      return access.ok && access.value;
    } catch {
      return false;
    }
  }
  return {
    allows,
    noteDocument(filePath) {
      if (!hasDocumentGrant(filePath)) return;
      try {
        const directory = path.dirname(filePath);
        documentDirectories.set(filePath, {
          path: path.resolve(directory),
          realPath: path.dirname(fs.realpathSync(filePath)),
        });
      } catch {
        /* Missing document. */
      }
    },
    allowPrintFile: (filePath) => printFiles.add(filePath),
    forgetPrintFile: (filePath) => printFiles.delete(filePath),
    install(session) {
      if (sessions.has(session)) return;
      session.webRequest.onBeforeRequest((details, callback) =>
        callback({ cancel: !allows(details) })
      );
      sessions.add(session);
    },
  };
}
module.exports = { createFileResourcePolicy };
