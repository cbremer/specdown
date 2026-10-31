const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');

// Evaluate this isolated ESM leaf without importing the application's graph.
// No storage, DOM, fetch, native bridge, timers or crypto provider in its realm.
const source = fs.readFileSync(
  path.join(
    __dirname,
    '../../markdown-viewer/src/core/legacy-annotation-snapshot.js'
  ),
  'utf8'
);
const realm = { Uint8Array };
vm.runInNewContext(
  source.replace(/^export /gm, '') +
    '\nglobalThis.api = { inspectLegacyAnnotationSnapshot, LEGACY_SNAPSHOT_LIMITS, LEGACY_SNAPSHOT_HASH_DOMAIN };',
  realm
);
const {
  inspectLegacyAnnotationSnapshot: inspect,
  LEGACY_SNAPSHOT_LIMITS: limits,
  LEGACY_SNAPSHOT_HASH_DOMAIN: domain,
} = realm.api;
function sha256(chunks) {
  const hash = createHash('sha256');
  for (const chunk of chunks) hash.update(chunk);
  return new Uint8Array(hash.digest());
}
function independentDigest(raw) {
  const count = Buffer.alloc(8);
  count.writeBigUInt64LE(BigInt(raw.length));
  return createHash('sha256')
    .update(
      Buffer.from('SpecDown/annotation-legacy-snapshot/v1/utf16le\0', 'ascii')
    )
    .update(count)
    .update(Buffer.from(raw, 'utf16le'))
    .digest('hex');
}
const note = (text = 'saved', id = 'same-id') => ({
  id,
  text,
  anchor: null,
  legacyIdx: 0,
});
const v2 = (notes = [note()], extra = {}) =>
  JSON.stringify({
    version: 2,
    files: { 'doc.md': notes },
    ...extra,
  });
async function expectArchive(raw, reason) {
  const hash = jest.fn(sha256);
  const result = await inspect(raw, hash);
  expect(result).toEqual({
    status: 'archive-only',
    raw,
    reason,
    snapshot: null,
    inventory: null,
    sourceDocumentProvenance: 'unknown',
  });
  expect(hash).not.toHaveBeenCalled();
}

describe('lossless, unassociated legacy inventory', () => {
  test('v1 preserves occurrence order, exact keys, empty text and labels', async () => {
    const raw = ' \n{"README.md":{"01":"","1":"same","0":"same"},"empty":{}}\t';
    const result = await inspect(raw, sha256);
    expect(result.status).toBe('supported');
    expect(result.version).toBe(1);
    expect(result.raw).toBe(raw);
    expect(result.sourceDocumentProvenance).toBe('unknown');
    expect(result.inventory.map((c) => c.label)).toEqual([
      'README.md',
      'empty',
    ]);
    expect(result.inventory[1].records).toEqual([]);
    expect(
      result.inventory[0].records.map((r) => [r.address, r.text, r.raw])
    ).toEqual([
      ['/README.md/01', '', '""'],
      ['/README.md/1', 'same', '"same"'],
      ['/README.md/0', 'same', '"same"'],
    ]);
    expect(
      new Set(result.inventory[0].records.map((r) => r.recordId)).size
    ).toBe(3);
  });

  test('v2 keeps duplicate IDs/identical notes by array occurrence and raw fields', async () => {
    const first =
      '{ "id":"same", "text":"", "anchor":{"fp":"x","path":"y","ordinal":0,"future":9007199254740993}, "legacyIdx":0, "extra":{"color":"yellow"} }';
    const raw =
      '{"version":2,"files":{"doc.md":[' +
      first +
      ',' +
      first +
      ']},"unknown":{"future":1e999}}';
    const result = await inspect(raw, sha256);
    expect(result.status).toBe('supported');
    expect(result.version).toBe(2);
    expect(result.raw).toBe(raw);
    const records = result.inventory[0].records;
    expect(records.map((r) => r.address)).toEqual([
      '/files/doc.md/0',
      '/files/doc.md/1',
    ]);
    expect(records.map((r) => r.raw)).toEqual([first, first]);
    expect(records.map((r) => r.text)).toEqual(['', '']);
    expect(records[0].recordId).not.toBe(records[1].recordId);
  });

  test('prototype-shaped names and JSON pointer escapes are ordinary data', async () => {
    const raw =
      '{"__proto__":{"0":"a"},"constructor":{"0":"b"},"toString":{"0":"c"},"a/b~c":{"0":"d"},"":{"0":"e"}}';
    const result = await inspect(raw, sha256);
    expect(result.status).toBe('supported');
    expect(result.inventory.map((c) => c.label)).toEqual([
      '__proto__',
      'constructor',
      'toString',
      'a/b~c',
      '',
    ]);
    expect(result.inventory.map((c) => c.records[0].address)).toEqual([
      '/__proto__/0',
      '/constructor/0',
      '/toString/0',
      '/a~1b~0c/0',
      '//0',
    ]);
    expect(Object.prototype.polluted).toBeUndefined();
  });

  test('v2 unknown prototype-shaped fields remain in raw without object assignment', async () => {
    const raw =
      '{"version":2,"__proto__":{"polluted":true},"files":{"__proto__":[{"id":"n","text":"","anchor":null,"legacyIdx":-1,"__proto__":{"polluted":true}}]}}';
    const result = await inspect(raw, sha256);
    expect(result.status).toBe('supported');
    expect(result.raw).toBe(raw);
    expect(result.inventory[0].records[0].raw).toContain('"__proto__"');
    expect(Object.prototype.polluted).toBeUndefined();
  });

  test.each(['{}', '{"version":2,"files":{}}'])(
    'empty supported snapshot: %s',
    async (raw) => {
      expect((await inspect(raw, sha256)).inventory).toEqual([]);
    }
  );

  test('preserves grandfathered >500-note collections and >16384-character text', async () => {
    const notes = Array.from({ length: 501 }, (_, i) =>
      note(i ? 'same' : 'x'.repeat(16385))
    );
    const raw = v2(notes);
    const result = await inspect(raw, sha256);
    expect(result.status).toBe('supported');
    expect(result.inventory[0].records).toHaveLength(501);
    expect(result.inventory[0].records[0].text).toHaveLength(16385);
    expect(result.raw).toBe(raw);
  });
});

describe('complete inspection before any inventory or hashing', () => {
  test.each([
    ['', 'corrupt'],
    ['{', 'corrupt'],
    ['null', 'corrupt'],
    ['[]', 'corrupt'],
    ['{"x":{"0":"kept"},"x":{"1":"also kept"}}', 'duplicate-key'],
    ['{"doc":{"1":"a","\\u0031":"b"}}', 'duplicate-key'],
    ['{"version":2,"files":{},"meta":{"a":1,"\\u0061":2}}', 'duplicate-key'],
    ['{"version":2,"files":{},"meta":[{"a":1,"a":2}]}', 'duplicate-key'],
    ['{"version":2,"files":{},"__proto__":1,"__proto__":2}', 'duplicate-key'],
    ['{"version":3,"files":{}}', 'unsupported-version'],
    ['{"version":1,"files":{}}', 'unsupported-version'],
    ['{"version":"2","files":{}}', 'unsupported-version'],
    ['{"version":{"0":"ambiguous v1 filename"}}', 'unsupported-version'],
    ['{"version":2}', 'corrupt'],
    ['{"version":2,"files":[]}', 'corrupt'],
    ['{"doc":{"-1":"a"}}', 'corrupt'],
    ['{"doc":{"9007199254740993":"a"}}', 'corrupt'],
    ['{"doc":{"0":1}}', 'corrupt'],
    ['{"doc":{"0":"a"},}', 'corrupt'],
    ['{"doc":{"0":"a",}}', 'corrupt'],
    ['{"doc":{"0":"a"}}false', 'corrupt'],
    ['{"doc":{"0":"\\x41"}}', 'corrupt'],
    ['{"doc":{"0":"\n"}}', 'corrupt'],
    ['{"doc":{"0":"unterminated}}', 'corrupt'],
    ['{"version":2,"files":{},"meta":01}', 'corrupt'],
    ['{"version":2,"files":{},"meta":+1}', 'corrupt'],
    ['{"version":2,"files":{},"meta":[1,]}', 'corrupt'],
  ])('archives %s (%s)', expectArchive);

  test.each([
    { text: 'missing id', anchor: null, legacyIdx: 0 },
    { ...note(), text: 1 },
    { ...note(), id: null },
    { ...note(), anchor: false },
    { ...note(), anchor: {} },
    { ...note(), anchor: { fp: '', path: '', ordinal: -1 } },
    { ...note(), anchor: { fp: '', path: '', ordinal: 0.5 } },
    { ...note(), legacyIdx: -2 },
    { ...note(), legacyIdx: 1.5 },
  ])(
    'a malformed later note prevents partial supported inventory',
    async (bad) => {
      await expectArchive(v2([note('valid first'), bad]), 'corrupt');
    }
  );

  test('object keys may repeat in different objects', async () => {
    expect(
      (
        await inspect(
          v2([note(), note()], { meta: [{ a: 1 }, { a: 2 }] }),
          sha256
        )
      ).status
    ).toBe('supported');
  });

  test('length limit precedes parsing and hasher invocation', async () => {
    await expectArchive(' '.repeat(limits.codeUnits + 1), 'inspection-limit');
  });
  test('string limit applies to unknown metadata', async () => {
    await expectArchive(
      v2([], { extra: 'x'.repeat(limits.stringCodeUnits + 1) }),
      'inspection-limit'
    );
  });
  test('string limit also applies to keys before allocating decoded keys', async () => {
    await expectArchive(
      '{"' + 'x'.repeat(limits.stringCodeUnits + 1) + '":{}}',
      'inspection-limit'
    );
  });
  test('depth limit includes unknown metadata', async () => {
    await expectArchive(
      '{"version":2,"files":{},"extra":' +
        '['.repeat(limits.depth) +
        '0' +
        ']'.repeat(limits.depth) +
        '}',
      'inspection-limit'
    );
  });
  test('depth boundary still accepts a fully inspected supported snapshot', async () => {
    const raw =
      '{"version":2,"files":{},"extra":' +
      '['.repeat(limits.depth - 1) +
      '0' +
      ']'.repeat(limits.depth - 1) +
      '}';
    expect((await inspect(raw, sha256)).status).toBe('supported');
  });
  test('value count bounds unknown arrays', async () => {
    await expectArchive(
      v2([], { extra: Array(limits.values).fill(null) }),
      'inspection-limit'
    );
  });
  test('collection limit returns no partial inventory', async () => {
    const files = Object.fromEntries(
      Array.from({ length: limits.collections + 1 }, (_, i) => ['doc' + i, {}])
    );
    await expectArchive(JSON.stringify(files), 'inspection-limit');
  });
  test('record limit returns no partial inventory', async () => {
    const notes = Object.fromEntries(
      Array.from({ length: limits.records + 1 }, (_, i) => [String(i), ''])
    );
    await expectArchive(JSON.stringify({ doc: notes }), 'inspection-limit');
  });
});

describe('exact snapshot digest and occurrence identity', () => {
  test('aggregate output budget rejects long-name occurrence amplification before hashing', async () => {
    const raw = JSON.stringify({
      version: 2,
      files: {
        ['x'.repeat(200000)]: Array(10000).fill(note('t')),
      },
    });
    expect(raw.length).toBeLessThan(limits.codeUnits);
    await expectArchive(raw, 'inspection-limit');
  });

  test.each(['2.0000000000000001', '1.99999999999999999'])(
    'rounded version %s remains unsupported',
    async (version) => {
      await expectArchive(
        '{"version":' + version + ',"files":{}}',
        'unsupported-version'
      );
    }
  );

  test.each(['1e-9999', '9007199254740991.1', '-1.0000000000000001'])(
    'fractional/underflowed index %s is not silently rounded',
    async (index) => {
      const raw = v2().replace('"legacyIdx":0', '"legacyIdx":' + index);
      await expectArchive(raw, 'corrupt');
    }
  );

  test.each(['2.0', '20e-1', '0.2e1'])(
    'exact decimal version %s stays supported',
    async (version) => {
      const raw = v2().replace('"version":2', '"version":' + version);
      expect((await inspect(raw, sha256)).status).toBe('supported');
    }
  );

  test.each(['0e-99999', '1.0', '100e-2', '9007199254740991'])(
    'exact safe schema integer %s stays supported',
    async (index) => {
      const raw = v2().replace('"legacyIdx":0', '"legacyIdx":' + index);
      expect((await inspect(raw, sha256)).status).toBe('supported');
    }
  );

  test('domain, count and code units match independent Node SHA-256 encoding', async () => {
    const raw = '{"doc":{"0":"🎵\\u0061"}}\n';
    const result = await inspect(raw, sha256);
    expect(result.snapshot).toEqual({
      algorithm: 'SHA-256',
      domain,
      encoding: 'UTF-16LE code units',
      digest: independentDigest(raw),
      id: 'legacy-snapshot-v1-sha256:' + independentDigest(raw),
    });
    expect(result.inventory[0].records[0].recordId).toBe(
      result.snapshot.id + '#/doc/0'
    );
  });

  test('lone surrogates, escaped spellings and replacement characters stay distinct', async () => {
    const strings = [
      '\ud800',
      '\ud801',
      '\udc00',
      '\ufffd',
      '\\ud800',
      '\\ufffd',
      '😀',
    ];
    const results = await Promise.all(
      strings.map((s) => inspect('{"doc":{"0":"' + s + '"}}', sha256))
    );
    expect(results.every((r) => r.status === 'supported')).toBe(true);
    expect(new Set(results.map((r) => r.snapshot.digest)).size).toBe(
      strings.length
    );
    results.forEach((r) => {
      expect(r.snapshot.digest).toBe(independentDigest(r.raw));
    });
  });

  test('whitespace and raw escapes are part of snapshot identity, retry is stable', async () => {
    const raw = '{"doc":{"0":"a"}}';
    const first = await inspect(raw, sha256);
    expect(await inspect(raw, sha256)).toEqual(first);
    expect((await inspect(raw + '\n', sha256)).snapshot.id).not.toBe(
      first.snapshot.id
    );
    expect(
      (await inspect('{"doc":{"0":"\\u0061"}}', sha256)).snapshot.id
    ).not.toBe(first.snapshot.id);
  });

  test('hash chunk boundaries do not change exact raw encoding', async () => {
    const raw = v2([note('x'.repeat(32767) + '\ud800🎵' + 'y'.repeat(32768))]);
    const lengths = [];
    const result = await inspect(raw, (chunks) => {
      function* observe() {
        for (const chunk of chunks) {
          lengths.push(chunk.length);
          yield chunk;
        }
      }
      return sha256(observe());
    });
    expect(result.snapshot.digest).toBe(independentDigest(raw));
    expect(Math.max(...lengths)).toBeLessThanOrEqual(65536);
    expect(lengths.length).toBeGreaterThan(3);
  });

  test.each([
    () => {
      throw new Error('offline provider');
    },
    async () => {
      throw new Error('provider rejected');
    },
    () => new Uint8Array(32), // Did not consume the input.
    (chunks) => {
      Array.from(chunks);
      return new Uint8Array(31);
    },
    (chunks) => {
      Array.from(chunks);
      return 'f'.repeat(64);
    },
    (chunks) => {
      chunks[Symbol.iterator]().next();
      return new Uint8Array(32);
    },
  ])(
    'hasher failure never returns partial inventory or claimed identity',
    async (hash) => {
      const raw = v2();
      expect(await inspect(raw, hash)).toEqual({
        status: 'archive-only',
        raw,
        reason: 'hash-failed',
        snapshot: null,
        inventory: null,
        sourceDocumentProvenance: 'unknown',
      });
    }
  );

  test('non-text input is rejected without touching the hashing provider', async () => {
    const hash = jest.fn(sha256);
    await expect(inspect(null, hash)).rejects.toThrow(
      'Expected raw annotation text.'
    );
    expect(hash).not.toHaveBeenCalled();
  });
});
