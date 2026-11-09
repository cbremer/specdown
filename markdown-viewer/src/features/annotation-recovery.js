// @ts-check
// Recovery authority: IndexedDB owns commits; every imported descriptor is data,
// never a permission grant. The legacy localStorage key is never written here.
export const RECOVERY_LIMITS = Object.freeze({
  archiveBytes: 32 * 1024 * 1024,
  transportBytes: 32 * 1024 * 1024,
  storeBytes: 96 * 1024 * 1024,
  manifestBytes: 256 * 1024,
  archives: 128,
  storeArchives: 256,
  occurrences: 20000,
  inventoryOccurrences: 60000,
  depth: 48,
  jsonTokens: 2000000,
  labelUnits: 512,
  addressKeyUnits: 128,
  noteUnits: 16384,
  page: 100,
});

/** @param {string} message @returns {never} */
function recoveryFail(message) {
  throw new Error(message);
}
export function recoveryUUID() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    ''
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
/** @param {any} value */
function recoveryRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** @param {string} raw */
function recoveryUTF16(raw) {
  const bytes = new Uint8Array(raw.length * 2);
  for (let i = 0; i < raw.length; i++) {
    const unit = raw.charCodeAt(i);
    bytes[i * 2] = unit & 255;
    bytes[i * 2 + 1] = unit >>> 8;
  }
  return bytes;
}
/** @param {Uint8Array} bytes */
function recoveryUnits(bytes) {
  if (bytes.length % 2) recoveryFail('Invalid UTF-16 code-unit length.');
  let raw = '';
  for (let start = 0; start < bytes.length; start += 8192) {
    const units = [];
    for (let i = start; i < Math.min(bytes.length, start + 8192); i += 2)
      units.push(bytes[i] | (bytes[i + 1] << 8));
    raw += String.fromCharCode(...units);
  }
  return raw;
}
/** @param {Uint8Array} bytes */
async function recoveryDigest(bytes) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    /** @type {BufferSource} */ (bytes)
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

/** Strict bounded JSON inventory. Reject duplicate decoded keys at every level
 * and numbers that could round during projection. Raw data remains untouched.
 * @param {string} raw @returns {any} */
function recoveryJSON(raw) {
  let pos = 0,
    tokens = 0;
  const skip = () => {
    while (/\s/.test(raw[pos] || '') && pos < raw.length) pos++;
  };
  const string = () => {
    const begin = pos++;
    while (pos < raw.length) {
      const c = raw[pos++];
      if (c === '\\') pos++;
      else if (c === '"') return JSON.parse(raw.slice(begin, pos));
    }
    return recoveryFail('Unterminated string.');
  };
  /** @param {number} depth */
  const value = (depth) => {
    if (++tokens > RECOVERY_LIMITS.jsonTokens || depth > RECOVERY_LIMITS.depth)
      recoveryFail('Inspection capacity exceeded.');
    skip();
    const c = raw[pos];
    if (c === '{') {
      pos++;
      skip();
      const keys = new Set();
      if (raw[pos] === '}') {
        pos++;
        return;
      }
      for (;;) {
        skip();
        if (raw[pos] !== '"') recoveryFail('Invalid object key.');
        const key = string();
        if (keys.has(key)) recoveryFail('Duplicate decoded key.');
        keys.add(key);
        skip();
        if (raw[pos++] !== ':') recoveryFail('Invalid object.');
        value(depth + 1);
        skip();
        const end = raw[pos++];
        if (end === '}') return;
        if (end !== ',') recoveryFail('Invalid object.');
      }
    }
    if (c === '[') {
      pos++;
      skip();
      if (raw[pos] === ']') {
        pos++;
        return;
      }
      for (;;) {
        value(depth + 1);
        skip();
        const end = raw[pos++];
        if (end === ']') return;
        if (end !== ',') recoveryFail('Invalid array.');
      }
    }
    if (c === '"') {
      string();
      return;
    }
    const literal =
      /^(true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
        raw.slice(pos)
      );
    if (!literal) recoveryFail('Invalid JSON value.');
    const token = /** @type {RegExpExecArray} */ (literal)[0];
    pos += token.length;
    if (/^-?\d/.test(token) && String(Number(token)) !== token)
      recoveryFail('Ambiguous numeric spelling.');
    if (
      /^-?\d/.test(token) &&
      (!Number.isFinite(Number(token)) ||
        (Number.isInteger(Number(token)) &&
          !Number.isSafeInteger(Number(token))))
    )
      recoveryFail('Unsafe numeric projection.');
  };
  value(0);
  skip();
  if (pos !== raw.length) recoveryFail('Trailing JSON data.');
  return JSON.parse(raw);
}

/** Opaque archives have no partial inventory.
 * @param {string} raw @returns {{status:string, occurrences:any[]}} */
export function recoveryInspect(raw) {
  try {
    const parsed = recoveryJSON(raw);
    if (!recoveryRecord(parsed)) recoveryFail('Unknown format.');
    const versioned = Object.hasOwn(parsed, 'version');
    if (versioned && (parsed.version !== 2 || !recoveryRecord(parsed.files)))
      recoveryFail('Unsupported schema.');
    const files = versioned ? parsed.files : parsed;
    // Private state snapshots are quarantined occurrences, never restored grants.
    if (
      parsed.schema === 1 &&
      Array.isArray(parsed.documents) &&
      Array.isArray(parsed.operations) &&
      Array.isArray(parsed.bindings)
    ) {
      const occurrences = [];
      for (let ordinal = 0; ordinal < parsed.documents.length; ordinal++) {
        const doc = parsed.documents[ordinal];
        if (
          !recoveryRecord(doc) ||
          typeof doc.label !== 'string' ||
          doc.label.length > RECOVERY_LIMITS.labelUnits ||
          !Array.isArray(doc.notes)
        )
          recoveryFail('Invalid private state.');
        for (let index = 0; index < doc.notes.length; index++) {
          const note = doc.notes[index];
          if (
            !recoveryRecord(note) ||
            typeof note.text !== 'string' ||
            occurrences.length >= RECOVERY_LIMITS.occurrences
          )
            recoveryFail('Invalid private occurrence.');
          occurrences.push({
            address: JSON.stringify(['document', ordinal, index]),
            label: doc.label,
            note,
          });
        }
      }
      return {
        status: 'supported private state; bindings quarantined',
        occurrences,
      };
    }
    const occurrences = [];
    for (const [label, notes] of Object.entries(files)) {
      if (label.length > RECOVERY_LIMITS.labelUnits)
        recoveryFail('Collection label exceeds bounded inspection capacity.');
      if (versioned ? !Array.isArray(notes) : !recoveryRecord(notes))
        recoveryFail('Invalid collection.');
      for (const [key, note] of Object.entries(notes)) {
        if (key.length > RECOVERY_LIMITS.addressKeyUnits)
          recoveryFail('Occurrence key exceeds bounded inspection capacity.');
        if (
          versioned
            ? !recoveryRecord(note) || typeof note.text !== 'string'
            : !/^\d+$/.test(key) ||
              !Number.isSafeInteger(Number(key)) ||
              typeof note !== 'string'
        )
          recoveryFail('Invalid occurrence.');
        if (versioned) {
          const a = note.anchor;
          if (
            (note.id !== undefined && typeof note.id !== 'string') ||
            (note.legacyIdx !== undefined &&
              (!Number.isSafeInteger(note.legacyIdx) || note.legacyIdx < -1)) ||
            (a !== undefined &&
              a !== null &&
              (!recoveryRecord(a) ||
                typeof a.fp !== 'string' ||
                (a.path !== undefined && typeof a.path !== 'string') ||
                (a.ordinal !== undefined &&
                  (!Number.isSafeInteger(a.ordinal) || a.ordinal < 0))))
          )
            recoveryFail('Corrupt known annotation fields.');
        }
        if (occurrences.length >= RECOVERY_LIMITS.occurrences)
          recoveryFail('Inspection capacity exceeded.');
        occurrences.push({
          address: JSON.stringify([label, key]),
          label,
          note: versioned
            ? note
            : { text: note, anchor: null, legacyIdx: Number(key) },
        });
      }
    }
    return { status: 'supported', occurrences };
  } catch (error) {
    return {
      status:
        'opaque: ' + (error instanceof Error ? error.message : 'invalid data'),
      occurrences: [],
    };
  }
}

/** @param {string|Uint8Array} input @param {string} [claim] */
export async function recoveryArchive(input, claim) {
  if (
    claim !== undefined &&
    claim !== null &&
    (typeof claim !== 'string' || claim.length > 256)
  )
    recoveryFail('Invalid archive claim.');
  if (
    (typeof input === 'string' ? input.length * 2 : input.length) >
    RECOVERY_LIMITS.archiveBytes
  )
    recoveryFail(
      'Unsupported capacity: archive exceeds 32 MiB. Source is unchanged.'
    );
  const kind = typeof input === 'string' ? 'utf16le-units' : 'original-bytes';
  const bytes =
    typeof input === 'string' ? recoveryUTF16(input) : input.slice();
  if (bytes.length > RECOVERY_LIMITS.archiveBytes)
    recoveryFail(
      'Unsupported capacity: archive exceeds 32 MiB. Source is unchanged.'
    );
  const digest = await recoveryDigest(bytes);
  let raw = typeof input === 'string' ? input : null;
  let diagnostics = '';
  if (raw === null) {
    try {
      if (bytes[0] === 0xff && bytes[1] === 0xfe)
        raw = recoveryUnits(bytes.slice(2));
      else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        const swapped = bytes.slice(2);
        for (let i = 0; i + 1 < swapped.length; i += 2)
          [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
        raw = recoveryUnits(swapped);
      } else raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      diagnostics = 'Decoded preview only; original bytes retained.';
    } catch {
      diagnostics = 'Undecodable; retained as opaque original bytes.';
    }
  }
  const inspected =
    raw === null
      ? { status: 'opaque: undecodable', occurrences: [] }
      : recoveryInspect(raw);
  return {
    id: `sha256:${kind}:${digest}`,
    claim: claim || null,
    kind,
    digest,
    bytes,
    raw: typeof input === 'string' ? input : null,
    diagnostics,
    previewText: typeof input === 'string' ? null : raw,
    ...inspected,
  };
}

/** Shared exact manifest encoding, with fixed-width SHA-256 strings. No hashing
 * or asynchronous work is needed inside an IndexedDB transaction.
 * @param {any[]} entries @param {number} total */
function recoveryManifest(entries, total) {
  return new TextEncoder().encode(
    JSON.stringify({
      format: 'specdown-private-recovery',
      version: 1,
      chunks: entries.length,
      digestAlgorithm: 'sha256',
      entries,
      total,
    })
  );
}
/** A bounded single-file binary transport. Manifest is ASCII JSON; payloads are
 * exact bytes, with per-payload SHA-256, explicit order/offset/length and totals.
 * @param {any[]} archives */
export async function recoveryPack(archives) {
  if (archives.length > RECOVERY_LIMITS.archives)
    recoveryFail('Too many archives.');
  let offset = 0;
  const entries = [];
  for (const archive of archives) {
    if (
      Object.prototype.toString.call(archive.bytes) !== '[object Uint8Array]' ||
      archive.bytes.length > RECOVERY_LIMITS.archiveBytes
    )
      recoveryFail('Unsupported archive capacity.');
    entries.push({
      kind: archive.kind,
      index: entries.length,
      units: archive.kind === 'utf16le-units' ? archive.bytes.length / 2 : null,
      inventoryCount: archive.status?.startsWith('supported')
        ? archive.occurrences.length
        : null,
      offset,
      length: archive.bytes.length,
      digest: await recoveryDigest(archive.bytes),
      claim: archive.claim,
    });
    offset += archive.bytes.length;
  }
  const manifest = recoveryManifest(entries, offset);
  const size = 8 + manifest.length + offset;
  if (
    manifest.length > RECOVERY_LIMITS.manifestBytes ||
    size > RECOVERY_LIMITS.transportBytes
  )
    recoveryFail(
      'Unsupported capacity: backup exceeds 32 MiB transport. Export fewer archives.'
    );
  const result = new Uint8Array(size);
  result.set([83, 68, 82, 49]);
  new DataView(result.buffer).setUint32(4, manifest.length, true);
  result.set(manifest, 8);
  for (let i = 0; i < archives.length; i++)
    result.set(archives[i].bytes, 8 + manifest.length + entries[i].offset);
  return result;
}
/** @param {Uint8Array} bytes */
export async function recoveryUnpack(bytes) {
  if (
    bytes.length > RECOVERY_LIMITS.transportBytes ||
    bytes.length < 8 ||
    String.fromCharCode(...bytes.slice(0, 4)) !== 'SDR1'
  )
    recoveryFail('Unsupported or invalid backup.');
  const length = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  ).getUint32(4, true);
  if (length > RECOVERY_LIMITS.manifestBytes || 8 + length > bytes.length)
    recoveryFail('Invalid manifest length.');
  const manifest = recoveryJSON(
    new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(8, 8 + length))
  );
  if (
    manifest.format !== 'specdown-private-recovery' ||
    manifest.version !== 1 ||
    manifest.digestAlgorithm !== 'sha256' ||
    !Array.isArray(manifest.entries) ||
    manifest.chunks !== manifest.entries.length ||
    manifest.entries.length > RECOVERY_LIMITS.archives ||
    manifest.total !== bytes.length - 8 - length
  )
    recoveryFail('Invalid manifest.');
  if (
    manifest.entries.reduce(
      (/** @type {number} */ sum, /** @type {any} */ entry) =>
        sum + (entry.inventoryCount ?? 0),
      0
    ) > RECOVERY_LIMITS.inventoryOccurrences
  )
    recoveryFail(
      'Declared inventory amplification exceeds capacity. Preserve the input as an opaque file.'
    );
  let offset = 0;
  const archives = [];
  for (const entry of manifest.entries) {
    if (
      entry.index !== archives.length ||
      entry.units !==
        (entry.kind === 'utf16le-units' ? entry.length / 2 : null) ||
      !(
        entry.claim === null ||
        (typeof entry.claim === 'string' && entry.claim.length <= 256)
      ) ||
      !Number.isSafeInteger(entry.length) ||
      entry.length < 0 ||
      entry.length > RECOVERY_LIMITS.archiveBytes ||
      entry.offset !== offset ||
      !['utf16le-units', 'original-bytes'].includes(entry.kind) ||
      offset + entry.length > manifest.total
    )
      recoveryFail('Invalid payload order or capacity.');
    const payload = bytes.slice(
      8 + length + offset,
      8 + length + offset + entry.length
    );
    if ((await recoveryDigest(payload)) !== entry.digest)
      recoveryFail('Backup integrity check failed.');
    const archive = await recoveryArchive(
      entry.kind === 'utf16le-units' ? recoveryUnits(payload) : payload,
      entry.claim
    );
    if (
      entry.inventoryCount !==
      (archive.status.startsWith('supported')
        ? archive.occurrences.length
        : null)
    )
      recoveryFail('Contradictory inventory count.');
    if (
      archives.reduce((n, a) => n + a.occurrences.length, 0) +
        archive.occurrences.length >
      RECOVERY_LIMITS.inventoryOccurrences
    )
      recoveryFail(
        'Inventory amplification exceeds capacity. Original file unchanged.'
      );
    archives.push(archive);
    offset += entry.length;
  }
  if (offset !== manifest.total) recoveryFail('Contradictory backup totals.');
  return archives;
}

/** Durable logical source location; imported metadata never calls this.
 * Browser File selections intentionally get a new source each time.
 * @param {{url?:string,bookmarkId?:string,savedCopyId?:string,filePath?:string,sample?:string}} metadata */
export function recoverySource(metadata) {
  if (metadata.bookmarkId)
    return `saved:${metadata.savedCopyId || metadata.bookmarkId}`;
  if (metadata.sample) return `bundle:${metadata.sample}`;
  if (metadata.url) {
    const url = new URL(metadata.url);
    if (url.protocol !== 'https:') return `selection:${recoveryUUID()}`;
    url.hash = '';
    return `url:${url.href}`;
  }
  return `selection:${recoveryUUID()}`;
}
export function recoveryEmpty() {
  return {
    schema: 1,
    epoch: recoveryUUID(),
    revision: 0,
    documents: /** @type {any[]} */ ([]),
    bindings: /** @type {any[]} */ ([]),
    archives: /** @type {any[]} */ ([]),
    operations: /** @type {any[]} */ ([]),
    requests: /** @type {any[]} */ ([]),
  };
}
/** @param {any} command */
function recoveryOperationSignature(command) {
  return JSON.stringify({
    ...command,
    protective: command.protective ? { id: command.protective.id } : undefined,
    epoch: undefined,
    revision: undefined,
    archive: command.archive
      ? { id: command.archive.id, claim: command.archive.claim }
      : undefined,
    archives: command.archives?.map((/** @type {any} */ a) => ({
      id: a.id,
      claim: a.claim,
    })),
  });
}

// This capability is issued only by successful full SDR verification. File
// metadata/command flags cannot create it. Prepare persists its binding in the
// local request journal, so crash resume does not rely on an in-memory marker.
/** @param {any} value */
function recoveryLocalProof(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value
    )
  );
}
const recoveryVerifiedRestoreInputs = new WeakMap();
/** @param {any[]} archives */
function recoveryRestoreFingerprint(archives) {
  return JSON.stringify(
    archives.map((a) => ({
      id: a.id,
      kind: a.kind,
      length: a.bytes.length,
      digest: a.digest,
      claim: a.claim,
      privateState: a.privateState,
      containerRecipe: a.containerRecipe,
    }))
  );
}
/** @param {any} current @param {any} command */
function recoveryNeedsCaptureReserve(current, command) {
  if (command.type === 'replace' && command.incomingArchiveId) {
    const archive = current.archives.find(
      (/** @type {any} */ a) => a.id === command.incomingArchiveId
    );
    return !archive?.privateState;
  }
  if (command.type !== 'restore')
    return ['capture', 'add', 'edit', 'associate', 'replace'].includes(
      command.type
    );
  const fingerprint = recoveryRestoreFingerprint(command.archives || []);
  const verifiedInput = recoveryVerifiedRestoreInputs.get(command.archives);
  const journal = current.requests?.find(
    (/** @type {any} */ r) =>
      r.id === command.id && r.signature === recoveryOperationSignature(command)
  );
  return (
    verifiedInput !== fingerprint &&
    !recoveryLocalProof(journal?.verifiedContainer)
  );
}
/** Durable prepared request, separate from active-data revision. The next real
 * transaction reads the current root and preserves every prepared request.
 * @param {any} current @param {any} command */
export function recoveryPrepare(current, command) {
  const previous = current.requests?.find(
    (/** @type {any} */ r) => r.id === command.id
  );
  const signature = recoveryOperationSignature(command);
  if (previous) {
    if (previous.signature !== signature)
      recoveryFail('Operation ID reused for another prepared request.');
    if (previous.status !== 'committed') {
      if (
        current.epoch !== command.epoch ||
        current.revision !== command.revision ||
        (command.guard && !command.guard())
      )
        recoveryFail(
          'Prepared request target or revision changed. Draft retained.'
        );
    }
    return current;
  }
  if (
    current.epoch !== command.epoch ||
    current.revision !== command.revision ||
    (command.guard && !command.guard())
  )
    recoveryFail(
      'Prepared request target or revision changed. Draft retained.'
    );
  const root = structuredClone(current);
  root.requests ||= [];
  if (root.requests.length >= 10000)
    recoveryFail(
      'Recovery request history capacity reached. No history was removed.'
    );
  const verifiedContainer =
    command.type === 'restore' && !recoveryNeedsCaptureReserve(current, command)
      ? recoveryUUID()
      : undefined;
  root.requests.push({
    verifiedContainer,
    id: command.id,
    status: 'prepared',
    acknowledged: false,
    signature,
    command: structuredClone({ ...command, guard: undefined }),
  });
  recoveryCheckBudget(root, recoveryNeedsCaptureReserve(root, command));
  return root;
}
/** @param {any} current @param {string} id */
export function recoveryAcknowledge(current, id) {
  const root = structuredClone(current);
  const request = root.requests?.find((/** @type {any} */ r) => r.id === id);
  if (!request) recoveryFail('Prepared request unavailable.');
  request.acknowledged = true;
  if (request.status === 'prepared') {
    request.status = 'abandoned';
    request.command = undefined;
  }
  recoveryCheckBudget(root);
  return root;
}
/** Count all preserved metadata; only locally owned descriptor identities may
 * stand in for typed payload bytes during the future-recovery projection.
 * @param {any} value @param {WeakSet<object>|null} [virtualByteObjects] @param {number} [depth] @returns {number} */
function recoveryRepresentationBytes(
  value,
  virtualByteObjects = null,
  depth = 0
) {
  if (depth > 96) recoveryFail('Stored data nesting exceeds capacity.');
  if (virtualByteObjects?.has(value)) return value.length;
  if (typeof value === 'string') return value.length * 2;
  if (Object.prototype.toString.call(value) === '[object Uint8Array]')
    return value.byteLength;
  if (!value || typeof value !== 'object') return 8;
  return Object.entries(value).reduce(
    (n, [key, child]) =>
      n +
      key.length * 2 +
      recoveryRepresentationBytes(child, virtualByteObjects, depth + 1),
    64
  );
}
/** Conservative whole-root in-memory budget, counting exact string units and
 * typed payload bytes without expanding them into JSON number arrays.
 * @param {any} root @param {boolean} [reserveManifest] @param {boolean} [projected] @param {WeakSet<object>|null} [virtualByteObjects] */
function recoveryCheckBudget(
  root,
  reserveManifest = false,
  projected = false,
  virtualByteObjects = null
) {
  if (
    root.archives.length > RECOVERY_LIMITS.storeArchives ||
    root.documents.reduce(
      (/** @type {number} */ count, /** @type {any} */ doc) =>
        count + doc.notes.length,
      0
    ) > RECOVERY_LIMITS.occurrences ||
    root.archives.some(
      (/** @type {any} */ archive) =>
        archive.occurrences.length > RECOVERY_LIMITS.occurrences ||
        !Number.isSafeInteger(archive.bytes?.length) ||
        archive.bytes.length > RECOVERY_LIMITS.archiveBytes ||
        (!projected &&
          Object.prototype.toString.call(archive.bytes) !==
            '[object Uint8Array]')
    )
  )
    recoveryFail('Store/archive capacity exceeded. Nothing was changed.');

  if (
    root.documents.reduce(
      (/** @type {number} */ n, /** @type {any} */ d) => n + d.notes.length,
      0
    ) +
      root.archives.reduce(
        (/** @type {number} */ n, /** @type {any} */ a) =>
          n + a.occurrences.length,
        0
      ) >
    RECOVERY_LIMITS.inventoryOccurrences
  )
    recoveryFail(
      'Combined active/archive inventory exceeds 60,000 occurrences. Nothing was truncated.'
    );
  const description = recoveryPrivateDescription(root);
  const payloads = root.archives.filter(
    (/** @type {any} */ a) => !a.containerRecipe && !a.privateState
  );
  // Fresh raw capture keeps conservative recovery headroom. Verified restore
  // and subsequent reads/mutations use the actual next encoded backup: its
  // retained wrapper/history already consumes real metadata and must not also
  // be charged a second hypothetical maximum manifest. No imported flag selects
  // this policy, and the hard transport/manifest/representation limits remain.
  const stateInventory = recoveryInspect(description);
  const entries = [];
  let total = 0;
  for (const archive of [
    ...payloads,
    {
      kind: 'utf16le-units',
      bytes: { length: description.length * 2 },
      status: stateInventory.status,
      occurrences: stateInventory.occurrences,
      claim: null,
    },
  ]) {
    if (
      !Number.isSafeInteger(archive.bytes.length) ||
      archive.bytes.length < 0 ||
      archive.bytes.length > RECOVERY_LIMITS.archiveBytes
    )
      recoveryFail('Unsupported archive capacity.');
    entries.push({
      kind: archive.kind,
      index: entries.length,
      units: archive.kind === 'utf16le-units' ? archive.bytes.length / 2 : null,
      inventoryCount: archive.status?.startsWith('supported')
        ? archive.occurrences.length
        : null,
      offset: total,
      length: archive.bytes.length,
      digest: '0'.repeat(64),
      claim: archive.claim,
    });
    total += archive.bytes.length;
  }
  const actualManifest = recoveryManifest(entries, total);
  if (
    entries.length > RECOVERY_LIMITS.archives ||
    actualManifest.length > RECOVERY_LIMITS.manifestBytes ||
    total +
      (reserveManifest
        ? RECOVERY_LIMITS.manifestBytes
        : actualManifest.length) +
      8 >
      RECOVERY_LIMITS.transportBytes
  )
    recoveryFail(
      'Complete private backup would exceed transport capacity. Nothing was committed or evicted.'
    );
  if (
    recoveryRepresentationBytes(root, projected ? virtualByteObjects : null) >
    RECOVERY_LIMITS.storeBytes
  )
    recoveryFail(
      'Store capacity exceeded (96 MiB including raw, projections, pending requests and retained history). Nothing was evicted.'
    );
  if (reserveManifest && !projected)
    recoveryCheckFutureRecovery(root, description, stateInventory);
}

/** Prove one complete future backup → fresh staging → protected activation.
 * This projection keeps every current archive/history and uses length-only byte
 * descriptors, so it allocates no payload copies and performs no asynchronous
 * hashing inside the real transaction. Exported/imported data cannot select it.
 * @param {any} source @param {string} description @param {any} inventory */
function recoveryCheckFutureRecovery(source, description, inventory) {
  const virtualBytes = (/** @type {number} */ length) => ({
    length,
  });
  const archives = source.archives.map((/** @type {any} */ a) => ({
    ...a,
    bytes: virtualBytes(a.bytes.length),
  }));
  const snapshot = (
    /** @type {string} */ raw,
    /** @type {string} */ digit,
    /** @type {any} */ inspected
  ) => ({
    id: 'sha256:utf16le-units:' + digit.repeat(64),
    kind: 'utf16le-units',
    digest: digit.repeat(64),
    bytes: virtualBytes(raw.length * 2),
    raw,
    claim: null,
    previewText: null,
    diagnostics: '',
    ...inspected,
  });
  const state = {
    ...snapshot(description, 'f', inventory),
    privateState: true,
  };
  const payloads = [
    ...archives.filter(
      (/** @type {any} */ a) => !a.containerRecipe && !a.privateState
    ),
    state,
  ];
  let total = 0;
  const entries = payloads.map(
    (/** @type {any} */ a, /** @type {number} */ index) => {
      const entry = {
        kind: a.kind,
        index,
        units: a.kind === 'utf16le-units' ? a.bytes.length / 2 : null,
        inventoryCount: a.status.startsWith('supported')
          ? a.occurrences.length
          : null,
        offset: total,
        length: a.bytes.length,
        digest: a.digest,
        claim: a.claim,
      };
      total += a.bytes.length;
      return entry;
    }
  );
  const manifest = recoveryManifest(entries, total),
    prefix = new Uint8Array(8 + manifest.length);
  prefix.set([83, 68, 82, 49]);
  new DataView(prefix.buffer).setUint32(4, manifest.length, true);
  prefix.set(manifest, 8);
  const container = {
    id: 'sha256:original-bytes:' + 'f'.repeat(64),
    kind: 'original-bytes',
    digest: 'f'.repeat(64),
    bytes: virtualBytes(prefix.length + total),
    raw: null,
    claim: null,
    previewText: null,
    diagnostics: 'Verified recovery container; original bytes retained.',
    status: 'opaque: verified recovery container',
    occurrences: [],
    containerRecipe: {
      prefix: Array.from(prefix),
      parts: payloads.map((/** @type {any} */ a) => a.id),
      total: prefix.length + total,
    },
  };
  const stageArchives = [
    ...archives.map((/** @type {any} */ a) =>
      a.status.startsWith('supported private state')
        ? { ...a, privateState: true }
        : a
    ),
    state,
    container,
  ];
  const apply = (/** @type {any} */ current, /** @type {any} */ command) => {
    const signature = recoveryOperationSignature(command);
    const prepared = {
      ...current,
      requests: [
        ...current.requests,
        {
          id: command.id,
          status: 'prepared',
          signature,
          acknowledged: false,
          command,
          verifiedContainer: recoveryUUID(),
        },
      ],
    };
    const result = recoveryApply(prepared, command, true);
    result.requests.find(
      (/** @type {any} */ r) => r.id === command.id
    ).acknowledged = true;
    return result;
  };
  const empty = recoveryEmpty();
  const staged = apply(empty, {
    type: 'restore',
    id: 'future-stage-' + recoveryUUID(),
    epoch: empty.epoch,
    revision: 0,
    archives: stageArchives,
  });
  const protectiveRaw = recoveryPrivateDescription(staged),
    protective = snapshot(protectiveRaw, 'e', recoveryInspect(protectiveRaw));
  const activated = apply(staged, {
    type: 'replace',
    id: 'future-replace-' + recoveryUUID(),
    epoch: staged.epoch,
    revision: staged.revision,
    protective,
    incomingArchiveId: state.id,
  });
  try {
    const virtualByteObjects = new WeakSet(
      activated.archives.map((/** @type {any} */ archive) => archive.bytes)
    );
    recoveryCheckBudget(activated, false, true, virtualByteObjects);
  } catch (error) {
    recoveryFail(
      'Future complete recovery capacity exceeded. Nothing was committed or evicted. ' +
        (error instanceof Error ? error.message : 'Unsupported capacity.')
    );
  }
}

/** Persist the actual consumer's operation ID before starting its commit. A
 * lost acknowledgement is reconciled against the ledger; crash/restart leaves
 * the original request available for explicit resume in global recovery.
 * @param {any} authority @param {any} command */
export async function recoveryPreparedCommit(authority, command) {
  await authority.prepare(command);
  try {
    await authority.commit(command);
  } catch (error) {
    const current = await authority.read();
    const op = current.operations.find(
      (/** @type {any} */ o) =>
        o.id === command.id &&
        o.signature === recoveryOperationSignature(command)
    );
    if (!op) throw error;
  }
  return await authority.acknowledge(command.id);
}

/** The deterministic mutation runs synchronously inside the IDB read-write
 * transaction, after authoritative read. No digest/parse/UI awaits in a commit.
 * @param {ReturnType<typeof recoveryEmpty>} current @param {any} command */
export function recoveryReduce(current, command) {
  return recoveryApply(current, command);
}
/** @param {ReturnType<typeof recoveryEmpty>} current @param {any} command @param {boolean} [projected] */
function recoveryApply(current, command, projected = false) {
  if (current.schema !== 1) recoveryFail('Unsupported database schema.');
  const signature = recoveryOperationSignature(command);
  if (
    current.requests?.some(
      (/** @type {any} */ r) => r.id === command.id && r.status === 'abandoned'
    )
  )
    recoveryFail(
      'This prepared request was explicitly discarded. Prepare a new operation; draft retained.'
    );
  const repeated = current.operations.find((op) => op.id === command.id);
  // Operation IDs are session-generated capabilities, never imported from files.
  if (repeated) {
    if (repeated.signature !== signature)
      recoveryFail('Operation ID reused for a different request.');
    return current;
  }
  if (current.epoch !== command.epoch)
    recoveryFail('Store epoch conflict. Reload recovery.');
  if (command.guard && !command.guard())
    recoveryFail(
      'Target changed. Refresh preview; draft and selection retained.'
    );
  if (current.revision !== command.revision)
    recoveryFail(
      'Store revision conflict. Refresh the preview; your draft has been kept.'
    );
  if (typeof command.id !== 'string' || !command.id)
    recoveryFail('Operation ID required.');
  const root = structuredClone(current);
  const op = {
    signature,
    id: command.id,
    type: command.type,
    revision: current.revision + 1,
    created: /** @type {any[]} */ ([]),
    conflicts: /** @type {string[]} */ ([]),
    before: /** @type {any} */ (null),
    after: /** @type {any} */ (null),
    undone: false,
  };
  const document = root.documents.find((doc) => doc.id === command.documentId);
  const checkDocument = () => {
    if (!document || document.revision !== command.documentRevision)
      recoveryFail('Document revision conflict. Refresh preview.');
  };
  if (command.type === 'capture' || command.type === 'restore') {
    const archives =
      command.type === 'capture' ? [command.archive] : command.archives;
    if (
      !Array.isArray(archives) ||
      archives.length > RECOVERY_LIMITS.storeArchives
    )
      recoveryFail('Invalid restore batch.');
    for (const archive of archives) {
      if (
        archive.claim &&
        root.archives.some(
          (a) => a.claim === archive.claim && a.id !== archive.id
        )
      )
        recoveryFail(
          'Conflicting backup ID: original archives were preserved.'
        );
      if (!root.archives.some((a) => a.id === archive.id))
        root.archives.push(archive);
    }
  } else if (command.type === 'replace') {
    const protectiveRaw = recoveryPrivateDescription({
      ...current,
      requests: current.requests?.filter(
        (/** @type {any} */ r) => r.id !== command.id
      ),
    });
    if (!command.protective || command.protective.raw !== protectiveRaw)
      recoveryFail(
        'Verified protective snapshot is required. Current data unchanged.'
      );
    const retained = command.incomingArchiveId
      ? root.archives.find((a) => a.id === command.incomingArchiveId)
      : null;
    if (
      command.incomingArchiveId &&
      (!retained || !retained.status.startsWith('supported private state'))
    )
      recoveryFail('Select a retained supported private-state archive.');
    const incoming = retained
      ? recoveryJSON(retained.raw || retained.previewText || '')
      : command.incoming;
    if (
      !recoveryRecord(incoming) ||
      incoming.schema !== 1 ||
      !Array.isArray(incoming.documents)
    )
      recoveryFail('Select a supported private-state archive.');
    root.archives.push(command.protective);
    const scope = recoveryUUID();
    const docMap = new Map();
    const noteMap = new Map();
    const operationMap = new Map();
    // The protective snapshot owns superseded documents and their usable history.
    // Keep their receipts for retry/conflict detection, but never map old effects
    // onto the replacement's document namespace or offer them as current undo.
    for (const previous of root.operations) {
      if (!previous.retiredInArchive) {
        previous.retiredInArchive = command.protective.id;
        previous.retiredOperationId = previous.id;
      }
    }
    root.documents = [];
    root.bindings = [];
    for (const source of incoming.documents) {
      if (
        !recoveryRecord(source) ||
        typeof source.id !== 'string' ||
        docMap.has(source.id) ||
        typeof source.label !== 'string' ||
        !Array.isArray(source.notes)
      )
        recoveryFail(
          'Ambiguous replacement collection; raw archive preserved.'
        );
      const id = recoveryUUID();
      docMap.set(source.id, id);
      const doc = {
        ...source,
        id,
        importedScope: scope,
        revision: 0,
        notes: /** @type {any[]} */ ([]),
      };
      for (const note of source.notes) {
        const key = JSON.stringify([source.id, note.id]);
        if (
          !recoveryRecord(note) ||
          typeof note.id !== 'string' ||
          typeof note.text !== 'string' ||
          noteMap.has(key)
        )
          recoveryFail('Ambiguous historical note ID; raw archive preserved.');
        const id = recoveryUUID();
        noteMap.set(key, id);
        doc.notes.push({
          ...note,
          id,
          revision: `restored:${scope}:${note.revision}`,
          importedLineage: { documentId: source.id, noteId: note.id },
        });
      }
      root.documents.push(doc);
    }
    const historical = Array.isArray(incoming.operations)
      ? incoming.operations
      : [];
    for (const original of historical) {
      if (
        typeof original.id !== 'string' ||
        operationMap.has(original.id) ||
        !Array.isArray(original.created)
      )
        recoveryFail('Unsupported private history; raw archive preserved.');
      operationMap.set(original.id, recoveryUUID());
    }
    for (const original of historical) {
      if (original.retiredInArchive) {
        const protectedArchive = root.archives.find(
          (a) => a.id === original.retiredInArchive
        );
        if (
          typeof original.retiredInArchive !== 'string' ||
          typeof original.retiredOperationId !== 'string' ||
          !protectedArchive?.status.startsWith('supported private state') ||
          typeof protectedArchive.raw !== 'string'
        )
          recoveryFail('Missing verified protected history archive.');
        const protectedState = recoveryJSON(protectedArchive.raw);
        const protectedOperation = protectedState.operations?.find(
          (/** @type {any} */ item) => item.id === original.retiredOperationId
        );
        if (
          !protectedOperation ||
          protectedOperation.type !== original.type ||
          JSON.stringify(protectedOperation.created) !==
            JSON.stringify(original.created) ||
          JSON.stringify(protectedOperation.before) !==
            JSON.stringify(original.before) ||
          JSON.stringify(protectedOperation.after) !==
            JSON.stringify(original.after)
        )
          recoveryFail('Unresolved protected history operation.');
        root.operations.push({
          ...original,
          id: operationMap.get(original.id),
          signature: `restored:${original.signature}`,
          restoredScope: scope,
        });
        continue;
      }
      for (const binding of [original.before, original.after])
        if (
          binding &&
          (!recoveryRecord(binding) ||
            typeof binding.source !== 'string' ||
            !docMap.has(binding.documentId))
        )
          recoveryFail(
            'Unresolved private binding history; original archive retained.'
          );
      if (
        original.created.some(
          (/** @type {any} */ effect) =>
            !recoveryRecord(effect) || !docMap.has(effect.documentId)
        )
      )
        recoveryFail(
          'Unresolved private occurrence history; original archive retained.'
        );
      const mapBinding = (/** @type {any} */ binding) =>
        binding
          ? {
              ...binding,
              source: `quarantined:${scope}:${binding.source}`,
              documentId: docMap.get(binding.documentId),
              revision: `restored:${scope}:${binding.revision}`,
            }
          : null;
      root.operations.push({
        ...original,
        id: operationMap.get(original.id),
        signature: `restored:${original.signature}`,
        restoredScope: scope,
        created: original.created.map((/** @type {any} */ effect) => ({
          ...effect,
          documentId: docMap.get(effect.documentId),
          noteId: noteMap.get(
            JSON.stringify([effect.documentId, effect.noteId])
          ),
          revision: `restored:${scope}:${effect.revision}`,
        })),
        before: mapBinding(original.before),
        after: mapBinding(original.after),
        bindingMappingRequired: !!original.after,
      });
    }
    for (const doc of root.documents)
      for (const note of doc.notes)
        if (note.lineage?.operationId)
          note.lineage = {
            ...note.lineage,
            operationId:
              operationMap.get(note.lineage.operationId) ||
              note.lineage.operationId,
          };
    root.epoch = recoveryUUID();
  } else if (command.type === 'bind') {
    if (
      typeof command.label !== 'string' ||
      command.label.length > RECOVERY_LIMITS.labelUnits
    )
      recoveryFail(
        'Document label exceeds annotation capacity. Source content and existing notes are unchanged.'
      );
    if (
      typeof command.source !== 'string' ||
      !command.source ||
      command.source.length > 65536
    )
      recoveryFail('Source descriptor exceeds annotation capacity.');
    if (root.bindings.some((binding) => binding.source === command.source))
      return current;
    const id = recoveryUUID();
    root.documents.push({ id, label: command.label, revision: 0, notes: [] });
    const binding = {
      source: command.source,
      documentId: id,
      revision: op.revision,
    };
    root.bindings.push(binding);
    op.after = binding;
  } else if (command.type === 'observe') {
    checkDocument();
    if (document.sourceRevision === command.sourceRevision) return current;
    document.sourceRevision = command.sourceRevision;
    document.revision++;
  } else if (command.type === 'associate') {
    checkDocument();
    const archive = root.archives.find((a) => a.id === command.archiveId);
    if (
      !archive ||
      !Array.isArray(command.addresses) ||
      !command.addresses.length ||
      new Set(command.addresses).size !== command.addresses.length
    )
      recoveryFail('Select distinct archived occurrences.');
    for (const address of command.addresses) {
      const occurrence = archive.occurrences.find(
        (/** @type {any} */ n) => n.address === address
      );
      if (!occurrence) recoveryFail('Occurrence is unavailable.');
      const id = recoveryUUID();
      const note = {
        ...occurrence.note,
        sourceFields: occurrence.note,
        id,
        revision: op.revision,
        lineage: { archiveId: archive.id, address, operationId: op.id },
      };
      document.notes.push(note);
      op.created.push({
        documentId: document.id,
        noteId: id,
        revision: op.revision,
      });
    }
    document.revision++;
  } else if (command.type === 'edit') {
    checkDocument();
    if (
      typeof command.text !== 'string' ||
      command.text.length > RECOVERY_LIMITS.noteUnits
    )
      recoveryFail(
        'Unsupported edit: maximum 16,384 code units. Draft retained.'
      );
    const note = document.notes.find(
      (/** @type {any} */ n) => n.id === command.noteId
    );
    if (!note) recoveryFail('Note changed or deleted.');
    if (command.text) {
      note.text = command.text;
      note.revision = op.revision;
    } else document.notes.splice(document.notes.indexOf(note), 1);
    document.revision++;
  } else if (command.type === 'add') {
    checkDocument();
    if (
      typeof command.note.text !== 'string' ||
      command.note.text.length > RECOVERY_LIMITS.noteUnits
    )
      recoveryFail('Unsupported edit: maximum 16,384 code units.');
    const id = recoveryUUID();
    document.notes.push({ ...command.note, id, revision: op.revision });
    document.revision++;
    op.created.push({
      documentId: document.id,
      noteId: id,
      revision: op.revision,
    });
  } else if (command.type === 'reconnect') {
    checkDocument();
    const binding = root.bindings.find((b) => b.source === command.source);
    op.before = binding ? { ...binding } : null;
    op.after = {
      source: command.source,
      explicit: true,
      documentId: document.id,
      revision: op.revision,
    };
    if (binding) Object.assign(binding, op.after);
    else root.bindings.push(op.after);
    if (command.mapHistory) {
      const history = root.operations.filter(
        (o) =>
          o.restoredScope === document.importedScope &&
          o.type === 'reconnect' &&
          o.after?.documentId === document.id &&
          !o.undone &&
          o.bindingMappingRequired
      );
      const latest = history.at(-1);
      if (latest) {
        latest.after = {
          ...latest.after,
          source: command.source,
          explicit: true,
          revision: op.revision,
        };
        if (latest.before)
          latest.before = { ...latest.before, source: command.source };
        latest.bindingMappingRequired = false;
      }
    }
  } else if (command.type === 'undo') {
    const original = root.operations.find((o) => o.id === command.operationId);
    if (!original) recoveryFail('Operation history unavailable.');
    if (original.retiredInArchive)
      recoveryFail(
        'This history belongs to a protective archive. Restore that snapshot explicitly before undo.'
      );
    if (original.undone) return current;
    for (const created of original.created) {
      const doc = root.documents.find((d) => d.id === created.documentId);
      const index =
        doc?.notes.findIndex(
          (/** @type {any} */ n) => n.id === created.noteId
        ) ?? -1;
      if (index >= 0 && doc.notes[index].revision === created.revision) {
        doc.notes.splice(index, 1);
        doc.revision++;
      } else op.conflicts.push(created.noteId);
    }
    if (original.after) {
      const binding = root.bindings.find(
        (b) => b.source === original.after.source
      );
      if (binding?.revision === original.after.revision) {
        if (original.before)
          Object.assign(binding, { ...original.before, revision: op.revision });
        else root.bindings.splice(root.bindings.indexOf(binding), 1);
      } else op.conflicts.push(original.after.source);
    }
    original.undone = true;
  } else recoveryFail('Unknown recovery operation.');
  if (
    root.archives.length > RECOVERY_LIMITS.storeArchives ||
    root.documents.reduce((n, d) => n + d.notes.length, 0) >
      RECOVERY_LIMITS.occurrences
  )
    recoveryFail('Store capacity exceeded. No data changed.');
  root.revision = op.revision;
  root.operations.push(op);
  const request = root.requests?.find((r) => r.id === command.id);
  if (request) {
    request.status = 'committed';
    request.resultRevision = root.revision;
    request.command = undefined;
  }
  if (!projected)
    recoveryCheckBudget(root, recoveryNeedsCaptureReserve(root, command));
  return root;
}

/** Validate an existing local authority without repairing or recreating it.
 * @param {any} root @param {any} enrollment */
function recoveryValidateAuthority(root, enrollment) {
  if (
    !recoveryRecord(root) ||
    root.schema !== 1 ||
    typeof root.epoch !== 'string' ||
    !Number.isSafeInteger(root.revision) ||
    root.revision < 0 ||
    !['documents', 'bindings', 'archives', 'operations', 'requests'].every(
      (key) => Array.isArray(root[key])
    ) ||
    enrollment?.schema !== 1 ||
    enrollment.epoch !== root.epoch
  )
    recoveryFail(
      'Annotation authority is missing, corrupt or unsupported. Restore from recovery; no data was changed.'
    );
  const ids = new Set();
  const sources = new Set();
  for (const doc of root.documents) {
    if (
      !recoveryRecord(doc) ||
      typeof doc.id !== 'string' ||
      ids.has(doc.id) ||
      !Array.isArray(doc.notes) ||
      !Number.isSafeInteger(doc.revision)
    )
      recoveryFail('Corrupt document registry.');
    ids.add(doc.id);
  }
  for (const binding of root.bindings) {
    if (
      !recoveryRecord(binding) ||
      typeof binding.source !== 'string' ||
      sources.has(binding.source) ||
      !ids.has(binding.documentId) ||
      !Number.isSafeInteger(binding.revision)
    )
      recoveryFail('Corrupt binding registry.');
    sources.add(binding.source);
  }
  const requests = new Set();
  for (const request of root.requests) {
    if (
      !recoveryRecord(request) ||
      typeof request.id !== 'string' ||
      requests.has(request.id) ||
      !['prepared', 'committed', 'abandoned'].includes(request.status) ||
      typeof request.signature !== 'string' ||
      typeof request.acknowledged !== 'boolean' ||
      (request.verifiedContainer !== undefined &&
        !recoveryLocalProof(request.verifiedContainer)) ||
      (request.status === 'prepared' &&
        (!recoveryRecord(request.command) || request.command.id !== request.id))
    )
      recoveryFail(
        'Corrupt prepared-request journal. Original storage is unchanged.'
      );
    requests.add(request.id);
  }
  recoveryCheckBudget(root);
}

/** IndexedDB is shared by windows in the same origin/storage partition only.
 * Private profiles, desktop channels and browser origins are independent.
 * No localStorage fallback and no timed locks. Version changes close stale DBs.
 * @param {string} [name] */
export function recoveryOpen(name = 'specdown-annotation-recovery-v1') {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Transactional annotation storage is unavailable.'));
      return;
    }
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = (event) => {
      if (event.oldVersion !== 0) {
        request.transaction?.abort();
        return;
      }
      const table = request.result.createObjectStore('authority');
      const root = recoveryEmpty();
      table.put(root, 'root');
      table.put({ schema: 1, epoch: root.epoch }, 'enrollment');
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(
        new Error('Close older SpecDown windows to open recovery storage.')
      );
    request.onsuccess = () => {
      const db = request.result;
      let closed = false;
      db.onversionchange = () => {
        closed = true;
        db.close();
      };
      /** @param {any} [command] */
      const transact = (command) =>
        new Promise((yes, no) => {
          if (closed) {
            no(new Error('Storage version changed. Reload this window.'));
            return;
          }
          const tx = db.transaction(
            'authority',
            command ? 'readwrite' : 'readonly'
          );
          const table = tx.objectStore('authority');
          /** @type {any} */
          let result;
          /** @type {any} */
          let failure;
          const read = table.get('root');
          read.onsuccess = () => {
            try {
              const current = read.result;
              const marker = table.get('enrollment');
              marker.onsuccess = () => {
                try {
                  recoveryValidateAuthority(current, marker.result);
                  if (command?.type === 'initialize' || !command)
                    result = current;
                  else {
                    result =
                      command.type === 'prepare-request'
                        ? recoveryPrepare(current, command.request)
                        : command.type === 'ack-request'
                          ? recoveryAcknowledge(current, command.requestId)
                          : recoveryReduce(current, command);
                    if (result !== current) {
                      table.put(result, 'root');
                      if (result.epoch !== current.epoch)
                        table.put(
                          { schema: 1, epoch: result.epoch },
                          'enrollment'
                        );
                    }
                  }
                } catch (error) {
                  failure = error;
                  tx.abort();
                }
              };
            } catch (error) {
              failure = error;
              tx.abort();
            }
          };
          tx.oncomplete = () => yes(result);
          tx.onabort = () =>
            no(
              failure ||
                tx.error ||
                new Error('Transaction aborted. No changes committed.')
            );
          tx.onerror = () => {};
        });
      transact({ type: 'initialize' }).then(
        () =>
          resolve({
            read: () => transact(),
            commit: transact,
            prepare: (/** @type {any} */ request) =>
              transact({ type: 'prepare-request', request }),
            acknowledge: (/** @type {string} */ requestId) =>
              transact({ type: 'ack-request', requestId }),
            close: () => {
              closed = true;
              db.close();
            },
          }),
        reject
      );
    };
  });
}

/** Portable exchange is deliberately lossy. The caller shows this preview and
 * obtains explicit confirmation before producing a file.
 * @param {ReturnType<typeof recoveryEmpty>} root */
export function recoveryExchange(root) {
  const files = Object.create(null);
  root.documents.forEach((doc, index) => {
    files[`Collection ${index + 1}`] = doc.notes.map(
      (/** @type {any} */ note) => ({
        text: note.text,
        anchor: null,
        legacyIdx: -1,
      })
    );
  });
  return {
    summary:
      'Portable exchange is lossy: note text only; labels, paths, URLs, IDs, anchors, archives, history and opaque extensions are excluded.',
    value: { version: 2, files },
  };
}

/** Export raw payloads exactly once. A retained imported container is described
 * by its exact prefix and verified payload references, preserving unknown
 * manifest bytes without recursive duplication of the same file contents.
 * @param {any} root */
export function recoveryPrivateDescription(root) {
  const archives = root.archives.map((/** @type {any} */ a) => ({
    ...a,
    bytes: undefined,
    raw: a.privateState ? a.raw : undefined,
    embeddedBytes:
      a.privateState && a.raw === null ? Array.from(a.bytes) : undefined,
    previewText: undefined,
    occurrences: undefined,
  }));
  const requests = root.requests?.map((/** @type {any} */ request) => ({
    ...request,
    command: request.command
      ? {
          ...request.command,
          archive: request.command.archive
            ? { id: request.command.archive.id }
            : undefined,
          archives: request.command.archives?.map((/** @type {any} */ a) => ({
            id: a.id,
          })),
          protective: request.command.protective
            ? { id: request.command.protective.id }
            : undefined,
        }
      : undefined,
  }));
  return JSON.stringify({ ...root, archives, requests }, (key, value) =>
    key === 'bytes' &&
    Object.prototype.toString.call(value) === '[object Uint8Array]'
      ? undefined
      : value
  );
}
/** @param {any} root */
export async function recoveryPrivateBackup(root) {
  if (root.requests?.some((/** @type {any} */ r) => r.status === 'prepared'))
    recoveryFail(
      'Resolve or explicitly discard prepared requests before exporting a complete private backup. Current data and drafts remain stored.'
    );
  const state = await recoveryArchive(recoveryPrivateDescription(root));
  return recoveryPack([
    ...root.archives.filter(
      (/** @type {any} */ a) => !a.containerRecipe && !a.privateState
    ),
    state,
  ]);
}
/** Container bytes/recipe are the evidence; a decoded binary preview is only a
 * redundant allocation and is never an annotation inventory.
 * @param {any} original @param {any} recipe */
function recoveryContainerEnvelope(original, recipe) {
  return {
    ...original,
    previewText: null,
    diagnostics: 'Verified recovery container; original bytes retained.',
    status: 'opaque: verified recovery container',
    occurrences: [],
    containerRecipe: recipe,
  };
}
/** A successful restore always retains the entire supplied file, including its
 * unknown manifest fields and exact spelling, alongside verified projections.
 * @param {Uint8Array} bytes */
export async function recoveryRestoreFile(bytes) {
  const contents = (await recoveryUnpack(bytes)).map((a) =>
    a.status.startsWith('supported private state')
      ? { ...a, privateState: true }
      : a
  );
  /** @type {any[]} */
  const all = [...contents];
  for (const state of contents) {
    if (!state.status.startsWith('supported private state')) continue;
    const parsed = recoveryJSON(state.raw || state.previewText || '');
    for (const metadata of parsed.archives || []) {
      if (!metadata.privateState) continue;
      const embedded = await recoveryArchive(
        metadata.raw !== null && metadata.kind === 'utf16le-units'
          ? metadata.raw
          : new Uint8Array(metadata.embeddedBytes),
        metadata.claim
      );
      if (embedded.id !== metadata.id)
        recoveryFail('Embedded private history integrity mismatch.');
      if (all.some((a) => a.id === embedded.id)) continue;
      if (
        all.reduce((n, a) => n + a.occurrences.length, 0) +
          embedded.occurrences.length >
        RECOVERY_LIMITS.inventoryOccurrences
      )
        recoveryFail(
          'Embedded inventory exceeds capacity. Preserve the input opaque.'
        );
      if (!all.some((a) => a.id === embedded.id))
        all.push({ ...embedded, privateState: true });
    }
    for (const metadata of parsed.archives || []) {
      const recipe = metadata.containerRecipe;
      if (!recipe) continue;
      if (
        !Array.isArray(recipe.prefix) ||
        recipe.prefix.length > RECOVERY_LIMITS.manifestBytes + 8 ||
        !recipe.prefix.every(
          (/** @type {any} */ b) => Number.isInteger(b) && b >= 0 && b <= 255
        ) ||
        !Array.isArray(recipe.parts) ||
        recipe.parts.length > RECOVERY_LIMITS.archives ||
        !Number.isSafeInteger(recipe.total) ||
        recipe.total > RECOVERY_LIMITS.transportBytes
      )
        recoveryFail('Invalid retained container recipe.');
      const payloads = recipe.parts.map((/** @type {string} */ id) =>
        all.find((a) => a.id === id)
      );
      if (
        payloads.some((/** @type {any} */ a) => !a) ||
        recipe.prefix.length +
          payloads.reduce(
            (/** @type {number} */ n, /** @type {any} */ a) =>
              n + a.bytes.length,
            0
          ) !==
          recipe.total
      )
        recoveryFail('Missing retained container payload.');
      const original = new Uint8Array(recipe.total);
      original.set(recipe.prefix);
      let offset = recipe.prefix.length;
      for (const payload of payloads) {
        original.set(payload.bytes, offset);
        offset += payload.bytes.length;
      }
      const archive = await recoveryArchive(original, metadata.claim);
      if (archive.id !== metadata.id)
        recoveryFail('Retained container digest mismatch.');
      all.push(recoveryContainerEnvelope(archive, recipe));
    }
  }
  const length = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  ).getUint32(4, true);
  const original = await recoveryArchive(bytes);
  all.push(
    recoveryContainerEnvelope(original, {
      prefix: Array.from(bytes.slice(0, 8 + length)),
      parts: contents.map((a) => a.id),
      total: bytes.length,
    })
  );
  const verified = all.filter(
    (archive, index) => all.findIndex((a) => a.id === archive.id) === index
  );
  recoveryVerifiedRestoreInputs.set(
    verified,
    recoveryRestoreFingerprint(verified)
  );
  return verified;
}

/** Source revision evidence: exact JavaScript UTF-16 units, not document identity.
 * @param {string} raw */
export async function recoveryContentRevision(raw) {
  return 'sha256:utf16le-units:' + (await recoveryDigest(recoveryUTF16(raw)));
}
