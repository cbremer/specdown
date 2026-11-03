const { TextEncoder, TextDecoder } = require('util');
const v8 = require('v8');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.structuredClone = (value) => v8.deserialize(v8.serialize(value));
Object.defineProperty(global.crypto, 'subtle', {
  configurable: true,
  value: require('crypto').webcrypto.subtle,
});
// Disposable transactional authority for UI tests. Real IndexedDB serialization,
// cross-window races, quota and restart are covered by the runtime probe.
function installAnnotationAuthority({ collections = {} } = {}) {
  let root = recoveryEmpty();
  const apply = (command) => {
    root = recoveryReduce(root, {
      epoch: root.epoch,
      revision: root.revision,
      id: crypto.randomUUID(),
      ...command,
    });
    return root;
  };
  for (const [label, notes] of Object.entries(collections)) {
    apply({
      type: 'bind',
      source: `url:https://synthetic.test/${encodeURIComponent(label)}`,
      label,
    });
    const doc = root.documents.at(-1);
    doc.notes = notes.map((note, index) => ({
      ...note,
      id: note.id || 'fixture-' + index,
      revision: root.revision,
    }));
    doc.revision = notes.length ? 1 : 0;
  }
  const adapter = {
    read: async () => structuredClone(root),
    prepare: async (command) => {
      root = recoveryPrepare(root, command);
      return structuredClone(root);
    },
    acknowledge: async (id) => {
      root = recoveryAcknowledge(root, id);
      return structuredClone(root);
    },
    commit: async (command) => {
      root = recoveryReduce(root, command);
      return structuredClone(root);
    },
  };
  annAuthorityOpening = Promise.resolve(adapter);
  annAuthority = adapter;
  annRoot = root;
  return { read: () => root, apply, adapter };
}
module.exports = { installAnnotationAuthority };
