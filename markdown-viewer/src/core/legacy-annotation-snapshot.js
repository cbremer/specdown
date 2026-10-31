// @ts-check
// Inert WK18 preparation. No production caller, storage, DOM, or native access.
// This inspects supplied annotation-store text; it does not migrate, associate,
// restore, or prove the identity/content of any source document.

export const LEGACY_SNAPSHOT_LIMITS = Object.freeze({
  codeUnits: 2 * 1024 * 1024,
  depth: 64,
  values: 100000,
  stringCodeUnits: 256 * 1024,
  collections: 1024,
  records: 10000,
  projectionCodeUnits: 4 * 1024 * 1024,
});

// Hash exactly: ASCII domain (including final NUL), unsigned 64-bit LE count
// of JS UTF-16 code units, then those code units in little-endian order. No
// Unicode normalization, UTF-8 replacement, BOM, or JSON reserialization.
export const LEGACY_SNAPSHOT_HASH_DOMAIN =
  'SpecDown/annotation-legacy-snapshot/v1/utf16le\0';
const legacySnapshotIdPrefix = 'legacy-snapshot-v1-sha256:';

/** @typedef {'corrupt'|'unsupported-version'|'duplicate-key'|'inspection-limit'|'hash-failed'} LegacyArchiveReason */
/** @typedef {{start:number,end:number} & ({kind:'object',entries:Map<string,LegacyJsonNode>}|{kind:'array',items:LegacyJsonNode[]}|{kind:'string',text:string}|{kind:'number',number:number}|{kind:'literal'})} LegacyJsonNode */
/** @typedef {{address:string, raw:string, text:string, recordId:string}} LegacyRecord */
/** @typedef {{address:string,label:string,records:LegacyRecord[]}} LegacyCollection */
/** @typedef {{algorithm:'SHA-256',domain:string,encoding:'UTF-16LE code units',digest:string,id:string}} LegacySnapshotDigest */
/** @typedef {{status:'archive-only',raw:string,reason:LegacyArchiveReason,snapshot:null,inventory:null,sourceDocumentProvenance:'unknown'}|{status:'supported',raw:string,version:1|2,snapshot:LegacySnapshotDigest,inventory:LegacyCollection[],sourceDocumentProvenance:'unknown'}} LegacySnapshotInspection */

class LegacySnapshotInspectionError extends Error {
  /** @param {LegacyArchiveReason} reason */
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

/** A bounded JSON grammar reader. Map preserves occurrence order and safely
 * handles prototype-shaped names. Check decoded keys before accepting values;
 * JSON.parse alone would silently discard duplicate keys, including escapes.
 * @param {string} raw
 * @returns {LegacyJsonNode}
 */
function legacySnapshotParse(raw) {
  let offset = 0;
  let values = 0;
  const fail = () => {
    throw new LegacySnapshotInspectionError('corrupt');
  };
  const whitespace = () => {
    while (' \t\r\n'.includes(raw[offset] || '\0')) offset += 1;
  };
  const readString = () => {
    const start = offset;
    if (raw[offset++] !== '"') return fail();
    while (offset < raw.length) {
      if (offset - start - 1 > LEGACY_SNAPSHOT_LIMITS.stringCodeUnits)
        throw new LegacySnapshotInspectionError('inspection-limit');
      const code = raw.charCodeAt(offset++);
      if (code < 0x20) return fail();
      if (code === 0x22) {
        // JSON.parse validates escape syntax and decodes equivalent key forms.
        try {
          return /** @type {string} */ (JSON.parse(raw.slice(start, offset)));
        } catch {
          return fail();
        }
      }
      if (code === 0x5c) offset += 1;
    }
    return fail();
  };

  /** @param {number} depth @returns {LegacyJsonNode} */
  const readValue = (depth) => {
    if (
      ++values > LEGACY_SNAPSHOT_LIMITS.values ||
      depth > LEGACY_SNAPSHOT_LIMITS.depth
    )
      throw new LegacySnapshotInspectionError('inspection-limit');
    whitespace();
    const start = offset;
    const char = raw[offset];
    if (char === '"') {
      const text = readString();
      return { kind: 'string', text, start, end: offset };
    }
    if (char === '{' || char === '[') {
      offset += 1;
      const closing = char === '{' ? '}' : ']';
      /** @type {Map<string,LegacyJsonNode>} */
      const entries = new Map();
      /** @type {LegacyJsonNode[]} */
      const items = [];
      whitespace();
      if (raw[offset] !== closing) {
        while (true) {
          if (char === '{') {
            whitespace();
            const key = readString();
            if (entries.has(key))
              throw new LegacySnapshotInspectionError('duplicate-key');
            whitespace();
            if (raw[offset++] !== ':') return fail();
            entries.set(key, readValue(depth + 1));
          } else {
            items.push(readValue(depth + 1));
          }
          whitespace();
          if (raw[offset] !== ',') break;
          offset += 1;
        }
      }
      if (raw[offset++] !== closing) return fail();
      return char === '{'
        ? { kind: 'object', entries, start, end: offset }
        : { kind: 'array', items, start, end: offset };
    }
    for (const literal of ['true', 'false', 'null']) {
      if (raw.startsWith(literal, offset)) {
        offset += literal.length;
        return { kind: 'literal', start, end: offset };
      }
    }
    const numberPattern = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    numberPattern.lastIndex = offset;
    const number = numberPattern.exec(raw);
    if (!number) return fail();
    offset += number[0].length;
    return { kind: 'number', number: Number(number[0]), start, end: offset };
  };

  const root = readValue(0);
  whitespace();
  if (offset !== raw.length) fail();
  return root;
}

/** Interpret schema integers without IEEE-754 rounding or underflow turning a
 * fractional/future value into a supported index/version. Unknown numeric
 * metadata is preserved in raw, not interpreted by this inventory.
 * @param {LegacyJsonNode | undefined} node @param {string} raw
 * @returns {number|null}
 */
function legacySnapshotInteger(node, raw) {
  if (node?.kind !== 'number') return null;
  const parts = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(
    raw.slice(node.start, node.end)
  );
  if (!parts) return null;
  const digits = (parts[2] + (parts[3] || '')).replace(/^0+/, '');
  if (!digits) return 0;
  const significant = digits.replace(/0+$/, '');
  const zeroCount =
    Number(parts[4] || 0) -
    (parts[3]?.length || 0) +
    digits.length -
    significant.length;
  if (
    !Number.isSafeInteger(zeroCount) ||
    zeroCount < 0 ||
    significant.length + zeroCount > 16
  )
    return null;
  const value = Number(parts[1] + significant + '0'.repeat(zeroCount));
  return Number.isSafeInteger(value) ? value : null;
}

/** @param {LegacyJsonNode | undefined} node @param {number} minimum @param {string} raw */
function legacySnapshotIsIndex(node, minimum, raw) {
  const value = legacySnapshotInteger(node, raw);
  return value !== null && value >= minimum;
}

/** @param {LegacyJsonNode} note @param {string} raw */
function legacySnapshotIsNote(note, raw) {
  if (note.kind !== 'object') return false;
  const anchor = note.entries.get('anchor');
  return (
    note.entries.get('id')?.kind === 'string' &&
    note.entries.get('text')?.kind === 'string' &&
    legacySnapshotIsIndex(note.entries.get('legacyIdx'), -1, raw) &&
    !!anchor &&
    ((anchor.kind === 'literal' &&
      raw.slice(anchor.start, anchor.end) === 'null') ||
      (anchor.kind === 'object' &&
        anchor.entries.get('fp')?.kind === 'string' &&
        anchor.entries.get('path')?.kind === 'string' &&
        legacySnapshotIsIndex(anchor.entries.get('ordinal'), 0, raw)))
  );
}

/** JSON Pointer token, preserving exact decoded v1 keys ("01" is not "1").
 * @param {string} token
 */
function legacySnapshotPointer(token) {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Validate everything before returning any inventory. Raw slices are the
 * authoritative note payload; decoded text is a display projection only.
 * Unknown root/note/anchor metadata and numeric spellings remain in raw.
 * @param {LegacyJsonNode} root @param {string} raw
 * @returns {{version:1|2, inventory:LegacyCollection[]}}
 */
function legacySnapshotInventory(root, raw) {
  if (root.kind !== 'object')
    throw new LegacySnapshotInspectionError('corrupt');
  const versionNode = root.entries.get('version');
  if (versionNode && legacySnapshotInteger(versionNode, raw) !== 2)
    throw new LegacySnapshotInspectionError('unsupported-version');
  const version = versionNode ? 2 : 1;
  const files = version === 2 ? root.entries.get('files') : root;
  if (files?.kind !== 'object')
    throw new LegacySnapshotInspectionError('corrupt');
  if (files.entries.size > LEGACY_SNAPSHOT_LIMITS.collections)
    throw new LegacySnapshotInspectionError('inspection-limit');
  /** @type {LegacyCollection[]} */
  const inventory = [];
  let recordCount = 0;
  let projectionUnits = 0;
  /** Count all projected strings, including repeated addresses/IDs, before
   * constructing them. A long label repeated in thousands of notes must not
   * amplify a small input into a multi-gigabyte inventory.
   * @param {number} units
   */
  const reserveProjection = (units) => {
    projectionUnits += units;
    if (projectionUnits > LEGACY_SNAPSHOT_LIMITS.projectionCodeUnits)
      throw new LegacySnapshotInspectionError('inspection-limit');
  };
  for (const [label, collection] of files.entries) {
    const address = `${version === 2 ? '/files' : ''}/${legacySnapshotPointer(label)}`;
    reserveProjection(label.length + address.length);
    /** @type {LegacyRecord[]} */
    const records = [];
    /** @type {Iterable<[string,LegacyJsonNode]>} */
    let entries;
    if (version === 1 && collection.kind === 'object')
      entries = collection.entries;
    else if (version === 2 && collection.kind === 'array')
      entries = collection.items.map((node, i) => [String(i), node]);
    else throw new LegacySnapshotInspectionError('corrupt');
    for (const [key, node] of entries) {
      if (++recordCount > LEGACY_SNAPSHOT_LIMITS.records)
        throw new LegacySnapshotInspectionError('inspection-limit');
      if (version === 1) {
        if (
          !/^\d+$/.test(key) ||
          !Number.isSafeInteger(Number(key)) ||
          node.kind !== 'string'
        )
          throw new LegacySnapshotInspectionError('corrupt');
      } else if (!legacySnapshotIsNote(node, raw)) {
        throw new LegacySnapshotInspectionError('corrupt');
      }
      const textNode = node.kind === 'object' ? node.entries.get('text') : node;
      if (textNode?.kind !== 'string')
        throw new LegacySnapshotInspectionError('corrupt');
      const recordKey = legacySnapshotPointer(key);
      const addressUnits = address.length + 1 + recordKey.length;
      reserveProjection(
        addressUnits * 2 +
          legacySnapshotIdPrefix.length +
          64 +
          1 +
          node.end -
          node.start +
          textNode.text.length
      );
      records.push({
        address: `${address}/${recordKey}`,
        recordId: '', // Filled only after complete validation and hashing.
        raw: raw.slice(node.start, node.end),
        text: textNode.text,
      });
    }
    inventory.push({ address, label, records });
  }
  return { version, inventory };
}

/** @param {string} raw @returns {Generator<Uint8Array>} */
function* legacySnapshotHashChunks(raw) {
  yield Uint8Array.from(LEGACY_SNAPSHOT_HASH_DOMAIN, (char) =>
    char.charCodeAt(0)
  );
  const length = new Uint8Array(8);
  let remaining = raw.length;
  for (let i = 0; i < length.length; i += 1) {
    length[i] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }
  yield length;
  const chunkUnits = 32768;
  for (let offset = 0; offset < raw.length; offset += chunkUnits) {
    const count = Math.min(chunkUnits, raw.length - offset);
    const chunk = new Uint8Array(count * 2);
    for (let i = 0; i < count; i += 1) {
      const code = raw.charCodeAt(offset + i);
      chunk[i * 2] = code & 0xff;
      chunk[i * 2 + 1] = code >>> 8;
    }
    yield chunk;
  }
}

/**
 * Inspect an explicitly supplied legacy annotation snapshot; never reads a
 * live store. Archive-only results retain raw exactly and contain NO partial
 * inventory/digest. Inspection limits are distinct from the live app's limits.
 *
 * The injected trusted hasher MUST consume every chunk in order and return the
 * 32 SHA-256 bytes, using a collision-resistant SHA-256 implementation. This
 * function verifies consumption/length, not the provider's cryptography. It
 * never accepts a preclaimed backup/source ID. Hash only fully inspected
 * supported data; oversized/ambiguous/future/corrupt inputs never invoke it.
 *
 * @param {string} raw Exact JS string, including whitespace/lone surrogates.
 * @param {(chunks: Iterable<Uint8Array>) => Promise<Uint8Array>|Uint8Array} sha256
 * @returns {Promise<LegacySnapshotInspection>}
 */
export async function inspectLegacyAnnotationSnapshot(raw, sha256) {
  if (typeof raw !== 'string')
    throw new TypeError('Expected raw annotation text.');
  /** @param {LegacyArchiveReason} reason @returns {LegacySnapshotInspection} */
  const archived = (reason) => ({
    status: 'archive-only',
    raw,
    reason,
    snapshot: null,
    inventory: null,
    sourceDocumentProvenance: 'unknown',
  });
  if (raw.length > LEGACY_SNAPSHOT_LIMITS.codeUnits)
    return archived('inspection-limit');
  let inspected;
  try {
    inspected = legacySnapshotInventory(legacySnapshotParse(raw), raw);
  } catch (error) {
    return archived(
      error instanceof LegacySnapshotInspectionError ? error.reason : 'corrupt'
    );
  }
  let digest;
  try {
    let consumed = false;
    function* chunks() {
      yield* legacySnapshotHashChunks(raw);
      consumed = true;
    }
    const result = await sha256(chunks());
    if (!consumed || !(result instanceof Uint8Array) || result.length !== 32)
      return archived('hash-failed');
    digest = Array.from(result, (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
  } catch {
    return archived('hash-failed');
  }
  const id = `${legacySnapshotIdPrefix}${digest}`;
  for (const collection of inspected.inventory)
    for (const record of collection.records)
      record.recordId = `${id}#${record.address}`;
  return {
    status: 'supported',
    raw,
    version: inspected.version,
    snapshot: {
      algorithm: 'SHA-256',
      domain: LEGACY_SNAPSHOT_HASH_DOMAIN,
      encoding: 'UTF-16LE code units',
      digest,
      id,
    },
    inventory: inspected.inventory,
    sourceDocumentProvenance: 'unknown',
  };
}
