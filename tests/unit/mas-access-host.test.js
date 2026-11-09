// Real host filesystem paths; POSIX bookmark fixtures live in mas-access.test.js.
const path = require('path');
const { createMasAccess } = require('../../desktop/mas-access');
function makeStore(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: jest.fn((key, fallback) => (key in data ? data[key] : fallback)),
    set: jest.fn((key, value) => {
      data[key] = value;
      return true;
    }),
  };
}

/** Fake native module: sandbox-like semantics for bookmarks. */
function makeNative() {
  const live = new Set(); // paths with a live sandbox extension (user intent)
  const moved = new Map(); // old path -> new path
  const active = new Map(); // access id -> path
  let nextId = 1;
  const native = {
    live,
    moved,
    active,
    createBookmark: jest.fn((p) => {
      if (!live.has(p) && ![...active.values()].includes(p)) {
        throw new Error('Could not open() the item');
      }
      return `b64:${p}`;
    }),
    startAccess: jest.fn((b64) => {
      const original = b64.slice(4);
      const now = moved.get(original) || original;
      const id = nextId++;
      active.set(id, now);
      return { id, path: now, stale: now !== original, ok: true };
    }),
    stopAccess: jest.fn((id) => active.delete(id)),
  };
  return native;
}

test('I04/I05: held polling re-resolves moved A instead of pairing reused old-path B bytes with A identity', () => {
  const fs = require('fs'),
    os = require('os');
  const {
    createAnnotationIdentity,
  } = require('../../desktop/annotation-identity');
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'specdown-synthetic-held-')
  );
  const old = path.join(directory, 'old.md'),
    moved = path.join(directory, 'moved.md');
  fs.writeFileSync(old, 'A');
  const native = makeNative(),
    store = makeStore(),
    access = createMasAccess({ getStore: () => store, native });
  native.live.add(old);
  access.noteUserIntent(old, 'file');
  const registry = createAnnotationIdentity(
    path.join(directory, 'identity.sqlite')
  );
  const reader = (resolved, continuity) => ({
    content: fs.readFileSync(resolved, 'utf8'),
    source: registry.afterAuthorizedRead(
      resolved,
      continuity.afterRead(resolved)
    ),
  });
  const first = access.withAccess(old, reader).value;
  const held = access.hold(old);
  fs.renameSync(old, moved);
  fs.writeFileSync(old, 'B');
  native.moved.set(old, moved);
  const refreshed = access.withAccess(old, reader, held).value;
  expect(refreshed.content).toBe('A');
  expect(refreshed.source).toEqual(first.source);
  expect(held.path).toBe(moved);
  native.live.add(old);
  native.moved.delete(old);
  access.noteUserIntent(old, 'file');
  const replacement = access.withAccess(old, reader).value;
  expect(replacement.content).toBe('B');
  expect(replacement.source.sourceToken).not.toBe(first.source.sourceToken);
  // The held A bookmark was refreshed to its new path before B reused the old path.
  const again = access.withAccess(old, reader, held).value;
  expect(again.content).toBe('A');
  expect(again.source).toEqual(first.source);
  held.release();
  expect(native.active.size).toBe(0);
  registry.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
