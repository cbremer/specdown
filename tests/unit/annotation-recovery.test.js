/** Synthetic stores only. Reducer tests complement actual IndexedDB runtime checks. */
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const vm = require('vm');
const { TextEncoder, TextDecoder } = require('util');
const structuredClone = require('v8').deserialize
  ? (value) => require('v8').deserialize(require('v8').serialize(value))
  : null;
let recovery;
beforeAll(() => {
  const code = fs
    .readFileSync(
      path.join(
        __dirname,
        '../../markdown-viewer/src/features/annotation-recovery.js'
      ),
      'utf8'
    )
    .replace(/^export /gm, '');
  const sandbox = {
    crypto: webcrypto,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    ArrayBuffer,
    DataView,
    structuredClone,
    console,
    URL,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code +
      '\nglobalThis.api={recoveryRepresentationBytes,recoveryEmpty,recoveryPrepare,recoveryReduce,recoveryArchive,recoveryInspect,recoveryPack,recoveryUnpack,recoverySource,recoveryExchange,recoveryPrivateDescription,recoveryPrivateBackup,recoveryRestoreFile,RECOVERY_LIMITS};',
    sandbox
  );
  recovery = sandbox.api;
});
test('I01/I02: same filename and bytes never identify browser selections; requested URLs retain significant components', () => {
  expect(recovery.recoverySource({})).not.toBe(recovery.recoverySource({}));
  expect(
    recovery.recoverySource({ url: 'https://example.com/A?q=1&b=2#x' })
  ).toBe('url:https://example.com/A?q=1&b=2');
  expect(
    recovery.recoverySource({ url: 'https://example.com/A?q=1&b=2' })
  ).not.toBe(recovery.recoverySource({ url: 'https://example.com/a?q=1&b=2' }));
});
test('A02/B04: duplicate decoded keys and unsafe numbers remain opaque, exact v1 keys and repeated v2 notes survive', async () => {
  const v1 = await recovery.recoveryArchive(
    '{"README.md":{"01":"a","1":"b"},"__proto__":{}}'
  );
  expect(v1.occurrences.map((n) => n.address)).toEqual([
    '["README.md","1"]',
    '["README.md","01"]',
  ]);
  for (const raw of [
    '{"a":1,"\\u0061":2}',
    '{"version":2,"files":{},"n":9007199254740993}',
    '{"version":3,"files":{}}',
    '{bad',
  ]) {
    expect((await recovery.recoveryArchive(raw)).occurrences).toEqual([]);
  }
  const repeated = await recovery.recoveryArchive(
    '{"version":2,"files":{"a":[{"id":"x","text":""},{"id":"x","text":""}]}}'
  );
  expect(repeated.occurrences).toHaveLength(2);
});
test('B01/B02/B05: real transport retains raw UTF16 units and bytes; tamper/truncation rejected', async () => {
  const raw = '\ufeff\r\n {"x":"\ud800😀"}\r\n';
  const archives = [
    await recovery.recoveryArchive(raw),
    await recovery.recoveryArchive(new Uint8Array([0xff, 0xfe, 0, 0xd8, 99])),
  ];
  const packed = await recovery.recoveryPack(archives);
  const restored = await recovery.recoveryUnpack(packed);
  expect(restored[0].raw).toBe(raw);
  expect(Array.from(restored[1].bytes)).toEqual([0xff, 0xfe, 0, 0xd8, 99]);
  const tampered = packed.slice();
  tampered[tampered.length - 1] ^= 1;
  await expect(recovery.recoveryUnpack(tampered)).rejects.toThrow();
  await expect(recovery.recoveryUnpack(packed.slice(0, -1))).rejects.toThrow();
});
test('A01/A05/U01/U02/T01/T04: atomic operation retry, stale epochs, newer edits and unrelated notes survive undo', async () => {
  let root = recovery.recoveryEmpty();
  const archive = await recovery.recoveryArchive(
    '{"README.md":{"01":"one","1":"two"}}'
  );
  const apply = (command) => {
    root = recovery.recoveryReduce(root, {
      epoch: root.epoch,
      revision: root.revision,
      ...command,
    });
    return root;
  };
  apply({ type: 'capture', id: 'capture', archive });
  apply({ type: 'bind', id: 'bind', source: 'browser:a', label: 'README.md' });
  const doc = root.bindings[0].documentId;
  const expected = { epoch: root.epoch, revision: root.revision };
  const attach = {
    type: 'associate',
    id: 'attach',
    archiveId: archive.id,
    addresses: [archive.occurrences[0].address],
    documentId: doc,
    documentRevision: 0,
  };
  apply(attach);
  expect(root.documents[0].notes).toHaveLength(1);
  expect(recovery.recoveryReduce(root, { ...expected, ...attach })).toEqual(
    root
  );
  expect(() =>
    recovery.recoveryReduce(root, { ...expected, type: 'bind', id: 'stale' })
  ).toThrow(/conflict/i);
  expect(() =>
    recovery.recoveryReduce(root, {
      epoch: 'old',
      revision: root.revision,
      type: 'bind',
      id: 'aba',
    })
  ).toThrow(/conflict/i);
  const note = root.documents[0].notes[0];
  apply({
    type: 'edit',
    id: 'edit',
    documentId: doc,
    documentRevision: 1,
    noteId: note.id,
    text: 'newer',
  });
  apply({ type: 'undo', id: 'undo', operationId: 'attach' });
  expect(root.documents[0].notes[0].text).toBe('newer');
  expect(root.operations.find((o) => o.id === 'undo').conflicts).toHaveLength(
    1
  );
  expect(root.archives[0].raw).toBe(archive.raw);
});
test('A04/A05/B09/T02: failed selection, altered operation and oversize edits preserve every record', async () => {
  const a = await recovery.recoveryArchive(
    JSON.stringify({
      version: 2,
      files: {
        a: [
          { text: 'small', future: { color: 'blue' } },
          { text: 'x'.repeat(16385) },
        ],
      },
    })
  );
  let root = recovery.recoveryEmpty();
  const commit = (c) =>
    (root = recovery.recoveryReduce(root, {
      epoch: root.epoch,
      revision: root.revision,
      ...c,
    }));
  commit({ type: 'capture', id: 'a', archive: a });
  commit({ type: 'bind', id: 'b', source: 'source', label: 'a' });
  const doc = root.documents[0];
  const associate = {
    type: 'associate',
    id: 'c',
    archiveId: a.id,
    addresses: a.occurrences.map((o) => o.address),
    documentId: doc.id,
    documentRevision: 0,
  };
  commit(associate);
  const before = structuredClone(root);
  expect(() => commit({ ...associate, addresses: [] })).toThrow(/reused/);
  expect(root).toEqual(before);
  expect(() =>
    commit({
      type: 'edit',
      id: 'too-big',
      documentId: doc.id,
      documentRevision: 1,
      noteId: root.documents[0].notes[1].id,
      text: 'x'.repeat(16385),
    })
  ).toThrow(/Unsupported edit/);
  expect(root).toEqual(before);
  commit({
    type: 'edit',
    id: 'small',
    documentId: doc.id,
    documentRevision: 1,
    noteId: root.documents[0].notes[0].id,
    text: 'updated',
  });
  expect(root.documents[0].notes[0].future).toEqual({ color: 'blue' });
  expect(root.documents[0].notes[1].text).toHaveLength(16385);
  expect(root.archives[0].raw).toBe(a.raw);
});
test('B07/B10: restore batch is unassigned and atomic if a later claimed archive conflicts', async () => {
  const one = await recovery.recoveryArchive('{"a":{"0":"one"}}', 'claim');
  const two = await recovery.recoveryArchive('{"b":{"0":"two"}}', 'claim');
  const root = recovery.recoveryEmpty();
  const command = {
    type: 'restore',
    id: 'restore',
    epoch: root.epoch,
    revision: 0,
    archives: [one],
  };
  const restored = recovery.recoveryReduce(root, command);
  expect(restored.archives).toHaveLength(1);
  expect(restored.bindings).toHaveLength(0);
  expect(restored.documents).toHaveLength(0);
  expect(() =>
    recovery.recoveryReduce(root, { ...command, archives: [one, two] })
  ).toThrow(/Conflicting/);
  expect(root.archives).toHaveLength(0);
});
test('B08: portable exchange preview explicitly drops private bindings, IDs, raw archives and opaque extensions', () => {
  const root = recovery.recoveryEmpty();
  root.documents = [
    {
      id: 'private',
      label: '/private/README.md',
      notes: [
        {
          id: 'n',
          text: 'note',
          unknown: { secret: 'path' },
          anchor: { fp: 'a', private: 's' },
        },
      ],
    },
  ];
  root.bindings = [{ source: '/private/file' }];
  const exchange = recovery.recoveryExchange(root);
  expect(exchange.summary).toMatch(/lossy/);
  expect(exchange.value.files['Collection 1'][0]).toEqual({
    text: 'note',
    anchor: null,
    legacyIdx: -1,
  });
  expect(JSON.stringify(exchange.value)).not.toMatch(/private|secret|unknown/);
});
test('B10/T04: explicit replace preserves protective snapshot and all archives, resets epoch, never grants imported bindings', async () => {
  let root = recovery.recoveryEmpty();
  root = recovery.recoveryReduce(root, {
    type: 'bind',
    id: 'bind',
    source: 'current',
    label: 'Current',
    epoch: root.epoch,
    revision: 0,
  });
  const snapshot = await recovery.recoveryArchive(
    recovery.recoveryPrivateDescription(root)
  );
  const incoming = {
    schema: 1,
    documents: [
      {
        id: 'imported',
        label: 'Incoming',
        notes: [{ id: 'old', text: 'restored' }],
      },
    ],
    bindings: [{ source: '/private/untrusted', documentId: 'imported' }],
  };
  const replaced = recovery.recoveryReduce(root, {
    type: 'replace',
    id: 'replace',
    epoch: root.epoch,
    revision: root.revision,
    protective: snapshot,
    incoming,
  });
  expect(replaced.epoch).not.toBe(root.epoch);
  expect(replaced.bindings).toEqual([]);
  expect(replaced.archives[0].raw).toBe(snapshot.raw);
  expect(replaced.documents[0].notes[0].text).toBe('restored');
  expect(replaced.documents[0].id).not.toBe('imported');
  expect(() =>
    recovery.recoveryReduce(root, {
      type: 'replace',
      id: 'replace',
      epoch: root.epoch,
      revision: root.revision,
      protective: { ...snapshot, raw: 'wrong' },
      incoming,
    })
  ).toThrow(/protective/i);
  expect(root.bindings).toHaveLength(1);
});
test('B02/B04: successful SDR restore retains original container bytes and unknown manifest fields across another private backup', async () => {
  const archive = await recovery.recoveryArchive('{"a":{"0":"note"}}');
  const original = await recovery.recoveryPack([archive]);
  const length = new DataView(original.buffer).getUint32(4, true);
  const manifest = JSON.parse(
    new TextDecoder().decode(original.slice(8, 8 + length))
  );
  manifest.future = { secret: 'opaque metadata' };
  const header = new TextEncoder().encode(
    ' \r\n' + JSON.stringify(manifest, null, 1) + '\n'
  );
  const input = new Uint8Array(
    8 + header.length + original.length - 8 - length
  );
  input.set([83, 68, 82, 49]);
  new DataView(input.buffer).setUint32(4, header.length, true);
  input.set(header, 8);
  input.set(original.slice(8 + length), 8 + header.length);
  const restored = await recovery.recoveryRestoreFile(input);
  expect(Array.from(restored.at(-1).bytes)).toEqual(Array.from(input));
  expect(restored.at(-1).containerRecipe).toBeDefined();
  let root = recovery.recoveryEmpty();
  root = recovery.recoveryReduce(root, {
    type: 'restore',
    id: 'restore',
    archives: restored,
    epoch: root.epoch,
    revision: 0,
  });
  const again = await recovery.recoveryRestoreFile(
    await recovery.recoveryPrivateBackup(root)
  );
  expect(
    again.some(
      (a) =>
        a.id === restored.at(-1).id && a.bytes.every((b, i) => b === input[i])
    )
  ).toBe(true);
});
test('B07/U02: private restore remaps usable occurrence/operation history and historical undo preserves edited notes', async () => {
  let root = recovery.recoveryEmpty();
  const apply = (command) =>
    (root = recovery.recoveryReduce(root, {
      epoch: root.epoch,
      revision: root.revision,
      ...command,
    }));
  const archive = await recovery.recoveryArchive(
    '{"a":{"0":"unchanged","1":"edited"}}'
  );
  apply({ type: 'capture', id: 'capture', archive });
  apply({
    type: 'bind',
    id: 'bind',
    source: 'original-private-location',
    label: 'a',
  });
  const originalDoc = root.documents[0];
  apply({
    type: 'associate',
    id: 'attach',
    archiveId: archive.id,
    addresses: archive.occurrences.map((o) => o.address),
    documentId: originalDoc.id,
    documentRevision: 0,
  });
  apply({
    type: 'edit',
    id: 'edit',
    documentId: originalDoc.id,
    documentRevision: 1,
    noteId: root.documents[0].notes[1].id,
    text: 'newer edit',
  });
  const backup = await recovery.recoveryPrivateBackup(root);
  const restored = await recovery.recoveryRestoreFile(backup);
  const privateState = restored.find((a) =>
    a.status.startsWith('supported private state')
  );
  let empty = recovery.recoveryEmpty();
  const protective = await recovery.recoveryArchive(
    recovery.recoveryPrivateDescription(empty)
  );
  empty = recovery.recoveryReduce(empty, {
    type: 'replace',
    id: 'replace',
    epoch: empty.epoch,
    revision: 0,
    protective,
    incoming: JSON.parse(privateState.raw),
  });
  expect(empty.bindings).toHaveLength(0);
  const restoredAttach = empty.operations.find(
    (o) => o.restoredScope && o.type === 'associate'
  );
  expect(restoredAttach.created[0].noteId).toBe(empty.documents[0].notes[0].id);
  empty = recovery.recoveryReduce(empty, {
    type: 'undo',
    id: 'historical-undo',
    operationId: restoredAttach.id,
    epoch: empty.epoch,
    revision: empty.revision,
  });
  expect(empty.documents[0].notes.map((n) => n.text)).toEqual(['newer edit']);
  expect(empty.operations.at(-1).conflicts).toHaveLength(1);
});
test('B06: accepted archive-count boundary reserves complete private snapshot and retained containers', async () => {
  let root = recovery.recoveryEmpty();
  const archives = await Promise.all(
    Array.from({ length: 126 }, (_, i) => recovery.recoveryArchive(`{bad${i}`))
  );
  root = recovery.recoveryReduce(root, {
    type: 'restore',
    id: 'batch-boundary',
    archives,
    epoch: root.epoch,
    revision: 0,
  });
  const packed = await recovery.recoveryPrivateBackup(root);
  expect(await recovery.recoveryUnpack(packed)).toHaveLength(127);
  const extra = await recovery.recoveryArchive('{bad-extra');
  expect(() =>
    recovery.recoveryReduce(root, {
      type: 'capture',
      id: 'extra',
      archive: extra,
      epoch: root.epoch,
      revision: root.revision,
    })
  ).toThrow(/capacity/);
});
test.each(['id', 'legacyIdx', 'anchor'])(
  'B04: malformed known %s makes the entire raw archive opaque',
  async (field) => {
    const note = { id: 'n', text: 'keep', legacyIdx: 0, anchor: null };
    note[field] =
      field === 'id'
        ? 42
        : field === 'legacyIdx'
          ? 0.5
          : { fp: 'x', ordinal: -1 };
    const raw = JSON.stringify({
      version: 2,
      files: { a: [{ text: 'valid' }, note] },
    });
    const archive = await recovery.recoveryArchive(raw);
    expect(archive.occurrences).toEqual([]);
    expect(archive.raw).toBe(raw);
  }
);
test.each([
  'index',
  'offset',
  'units',
  'inventoryCount',
  'total',
  'chunks',
  'depth',
])(
  'B05: false %s manifest metadata is rejected before activation',
  async (field) => {
    const archive = await recovery.recoveryArchive('{"a":{"0":"note"}}');
    const packed = await recovery.recoveryPack([archive]);
    const length = new DataView(packed.buffer).getUint32(4, true);
    const manifest = JSON.parse(
      new TextDecoder().decode(packed.slice(8, 8 + length))
    );
    if (field === 'total') manifest.total++;
    else if (field === 'chunks') manifest.chunks++;
    else if (field === 'depth') {
      manifest.extension = {};
      let node = manifest.extension;
      for (let i = 0; i < 50; i++) {
        node.child = {};
        node = node.child;
      }
    } else manifest.entries[0][field]++;
    const header = new TextEncoder().encode(JSON.stringify(manifest));
    const forged = new Uint8Array(
      8 + header.length + packed.length - 8 - length
    );
    forged.set([83, 68, 82, 49]);
    new DataView(forged.buffer).setUint32(4, header.length, true);
    forged.set(header, 8);
    forged.set(packed.slice(8 + length), 8 + header.length);
    await expect(recovery.recoveryUnpack(forged)).rejects.toThrow();
  }
);
test('B07/B10/U02: repeated occupied protected replacement exports recoverable history without activating superseded lineage', async () => {
  const withNote = (label) => {
    let root = recovery.recoveryEmpty();
    root = recovery.recoveryReduce(root, {
      type: 'bind',
      id: 'bind-' + label,
      source: 'source-' + label,
      label,
      epoch: root.epoch,
      revision: 0,
    });
    return recovery.recoveryReduce(root, {
      type: 'add',
      id: 'add-' + label,
      epoch: root.epoch,
      revision: root.revision,
      documentId: root.documents[0].id,
      documentRevision: 0,
      note: { text: 'note ' + label },
    });
  };
  const replace = async (root, incoming, id) =>
    recovery.recoveryReduce(root, {
      type: 'replace',
      id,
      epoch: root.epoch,
      revision: root.revision,
      protective: await recovery.recoveryArchive(
        recovery.recoveryPrivateDescription(root)
      ),
      incoming,
    });
  const first = withNote('A');
  let current = await replace(first, withNote('B'), 'replace-first');
  const protectiveA = current.archives.find(
    (a) => a.raw === recovery.recoveryPrivateDescription(first)
  );
  expect(protectiveA).toBeDefined();
  for (const occupied of [false, true]) {
    const backup = await recovery.recoveryPrivateBackup(current);
    const archives = await recovery.recoveryRestoreFile(backup);
    const state = archives.find(
      (a) =>
        a.status.startsWith('supported private state') &&
        JSON.parse(a.raw).documents[0]?.label === 'B'
    );
    let target = occupied ? withNote('C') : recovery.recoveryEmpty();
    target = recovery.recoveryReduce(target, {
      type: 'restore',
      id: 'stage-' + occupied,
      epoch: target.epoch,
      revision: target.revision,
      archives,
    });
    current = await replace(
      target,
      JSON.parse(state.raw),
      'replace-' + occupied
    );
    expect(current.documents[0].notes[0].text).toBe('note B');
    expect(current.bindings).toEqual([]);
    expect(current.archives.some((a) => a.raw === protectiveA.raw)).toBe(true);
  }
  const activeAdd = current.operations.find(
    (o) => o.type === 'add' && !o.retiredInArchive
  );
  const retired = current.operations.find(
    (o) => o.type === 'add' && o.retiredInArchive
  );
  expect(activeAdd).toBeDefined();
  expect(retired).toBeDefined();
  expect(() =>
    recovery.recoveryReduce(current, {
      type: 'undo',
      id: 'retired-undo',
      epoch: current.epoch,
      revision: current.revision,
      operationId: retired.id,
    })
  ).toThrow(/protective archive/);
  current = recovery.recoveryReduce(current, {
    type: 'undo',
    id: 'active-undo',
    epoch: current.epoch,
    revision: current.revision,
    operationId: activeAdd.id,
  });
  expect(current.documents[0].notes).toEqual([]);
  expect(current.archives.some((a) => a.raw === protectiveA.raw)).toBe(true);
});
test.each(['missing', 'unrelated'])(
  'B05/B07: retired history requires its verified protective snapshot and original operation (%s)',
  async (kind) => {
    const root = recovery.recoveryEmpty();
    const unrelated = await recovery.recoveryArchive(
      recovery.recoveryPrivateDescription(root)
    );
    const incoming = {
      ...recovery.recoveryEmpty(),
      operations: [
        {
          id: 'forged',
          type: 'add',
          signature: 'forged',
          created: [{ documentId: 'missing', noteId: 'missing', revision: 1 }],
          retiredOperationId: 'forged',
          retiredInArchive:
            kind === 'missing' ? 'sha256:missing' : unrelated.id,
        },
      ],
    };
    const protective = await recovery.recoveryArchive(
      recovery.recoveryPrivateDescription(root)
    );
    expect(() =>
      recovery.recoveryReduce(
        { ...root, archives: kind === 'unrelated' ? [unrelated] : [] },
        {
          type: 'replace',
          id: 'invalid',
          epoch: root.epoch,
          revision: root.revision,
          protective:
            kind === 'unrelated'
              ? {
                  ...protective,
                  raw: recovery.recoveryPrivateDescription({
                    ...root,
                    archives: [unrelated],
                  }),
                }
              : protective,
          incoming,
        }
      )
    ).toThrow(/protected history/);
  }
);
test('B06/B10: protected activation references retained immutable bytes without copying incoming state into its request or signature', async () => {
  const incoming = await recovery.recoveryArchive(
    JSON.stringify({
      schema: 1,
      epoch: 'external',
      revision: 0,
      documents: [
        {
          id: 'external',
          label: 'Recovered',
          revision: 0,
          notes: [
            {
              id: 'n',
              text: 'original private content',
              revision: 1,
              capacityBytes: 0,
              extension: '雪"'.repeat(200),
            },
          ],
        },
      ],
      bindings: [],
      archives: [],
      operations: [],
      requests: [],
    })
  );
  let root = recovery.recoveryEmpty();
  root = recovery.recoveryReduce(root, {
    type: 'capture',
    id: 'retained',
    epoch: root.epoch,
    revision: 0,
    archive: incoming,
  });
  const protective = await recovery.recoveryArchive(
    recovery.recoveryPrivateDescription(root)
  );
  const command = {
    type: 'replace',
    id: 'activate',
    epoch: root.epoch,
    revision: root.revision,
    protective,
    incomingArchiveId: incoming.id,
  };
  const prepared = recovery.recoveryPrepare(root, command);
  expect(prepared.requests[0].command.incoming).toBeUndefined();
  const activated = recovery.recoveryReduce(prepared, command);
  expect(activated.documents[0].notes[0].text).toBe('original private content');
  expect(activated.documents[0].notes[0].capacityBytes).toBe(0);
  expect(activated.documents[0].notes[0].extension).toBe('雪"'.repeat(200));
  const roundtrip = await recovery.recoveryRestoreFile(
    await recovery.recoveryPrivateBackup(activated)
  );
  expect(roundtrip.find((a) => a.id === incoming.id).raw).toBe(incoming.raw);
  expect(activated.operations.at(-1).signature).not.toContain(
    'original private content'
  );
  expect(activated.archives.find((a) => a.id === incoming.id).raw).toBe(
    incoming.raw
  );
  expect(() =>
    recovery.recoveryReduce(root, {
      ...command,
      id: 'missing',
      incomingArchiveId: 'missing',
    })
  ).toThrow(/retained supported/);
});

test('B06: unknown capacityBytes metadata cannot impersonate a locally owned virtual byte descriptor', () => {
  const note = {
    text: 'note',
    capacityBytes: 0,
    extension: '雪"'.repeat(200),
  };
  const descriptor = { length: 10 };
  const owned = new WeakSet([descriptor]);
  const projected = { bytes: descriptor, note };
  const actual = { bytes: new Uint8Array(10), note };
  expect(recovery.recoveryRepresentationBytes(projected, owned)).toBe(
    recovery.recoveryRepresentationBytes(actual)
  );
  expect(
    recovery.recoveryRepresentationBytes(projected, owned)
  ).toBeGreaterThan(800);
  expect(
    recovery.recoveryRepresentationBytes(
      { ...projected, note: { ...note, extension: '' } },
      owned
    )
  ).toBeLessThan(recovery.recoveryRepresentationBytes(projected, owned));
});
