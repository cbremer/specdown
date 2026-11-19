/** Bounded, memory-only hostile restore inputs. Never opens an annotation store. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');
const { TextEncoder, TextDecoder } = require('util');
let recovery;
let digest;
beforeEach(() => {
  digest = jest.fn((...args) => webcrypto.subtle.digest(...args));
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
    crypto: { subtle: { digest } },
    TextEncoder,
    TextDecoder,
    Uint8Array,
    DataView,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    code +
      '\nglobalThis.api={recoveryArchive,recoveryPack,recoveryRestoreFile,RECOVERY_LIMITS};',
    sandbox
  );
  recovery = sandbox.api;
});

const privateRaw = (archives = [], nonce = '') =>
  JSON.stringify({
    schema: 1,
    documents: [],
    operations: [],
    bindings: [],
    archives,
    nonce,
  });
const metadata = (archive) => ({
  privateState: true,
  kind: archive.kind,
  id: archive.id,
  raw: archive.raw,
  embeddedBytes: archive.raw === null ? Array.from(archive.bytes) : undefined,
});
async function packStates(groups) {
  return recovery.recoveryPack(
    await Promise.all(
      groups.map((entries, i) =>
        recovery.recoveryArchive(privateRaw(entries, String(i)))
      )
    )
  );
}
async function expectPreflightFailure(bytes, error, topLevelStates = 1) {
  const before = Uint8Array.from(bytes);
  digest.mockClear();
  await expect(recovery.recoveryRestoreFile(bytes)).rejects.toThrow(error);
  // Each manifest payload is checked and inventoried once. No nested archive or
  // retained wrapper may be hashed after its aggregate preflight fails.
  expect(digest).toHaveBeenCalledTimes(topLevelStates * 2);
  expect(bytes).toEqual(before);
}

test('rejects nested unique archive expansion before hashing embedded history', async () => {
  const entries = await Promise.all(
    Array.from({ length: 257 }, (_, i) =>
      recovery.recoveryArchive(privateRaw([], String(i)))
    )
  );
  await expectPreflightFailure(
    await packStates([entries.map(metadata)]),
    /Expanded archive count.*capacity/
  );
});

test('aggregate metadata work is bounded across private states, including duplicate references', async () => {
  const archive = await recovery.recoveryArchive(privateRaw());
  const group = Array.from({ length: 513 }, () => metadata(archive));
  await expectPreflightFailure(
    await packStates([group, group]),
    /metadata count.*capacity/,
    2
  );
});

test('an invalid later descriptor rejects before even the first valid nested archive is hashed', async () => {
  const archive = await recovery.recoveryArchive(privateRaw());
  await expectPreflightFailure(
    await packStates([[metadata(archive), null]]),
    /Invalid embedded archive metadata/
  );
});

test.each([null, {}, 'not an array'])(
  'rejects non-array nested metadata %p before nested work',
  async (entries) => {
    await expectPreflightFailure(
      await packStates([entries]),
      /Invalid embedded archive metadata/
    );
  }
);

test.each([
  { kind: 'original-bytes', raw: null, embeddedBytes: 1024 },
  { kind: 'original-bytes', raw: null, embeddedBytes: [0, 256] },
  { kind: 'utf16le-units', raw: null },
  { kind: 'unknown', raw: 'hello' },
])(
  'validates nested payload shape before typed-array allocation: %p',
  async (changes) => {
    const archive = await recovery.recoveryArchive(privateRaw());
    await expectPreflightFailure(
      await packStates([[{ ...metadata(archive), ...changes }]]),
      /Invalid embedded archive payload/
    );
  }
);

test('preflights cumulative recipe bytes before any retained-container allocation', async () => {
  const archive = await recovery.recoveryArchive(new Uint8Array([1]));
  const recipe = { prefix: [], parts: [archive.id], total: 32 * 1024 * 1024 };
  const entry = { id: archive.id, containerRecipe: recipe };
  // No large buffers are constructed: declared work already exceeds 96 MiB once
  // the supplied backup and its top-level state are included.
  await expectPreflightFailure(
    await packStates([[entry, entry, entry]]),
    /bytes exceed restore capacity/
  );
});

test('accepts the unique archive boundary and preserves first-seen ordering', async () => {
  const embedded = await Promise.all(
    Array.from({ length: 254 }, (_, i) =>
      recovery.recoveryArchive(privateRaw([], String(i)))
    )
  );
  const outer = await recovery.recoveryArchive(
    privateRaw(embedded.map(metadata), 'outer')
  );
  const bytes = await recovery.recoveryPack([outer]);
  const restored = await recovery.recoveryRestoreFile(bytes);
  expect(restored).toHaveLength(256);
  expect(restored.slice(0, -1).map((a) => a.id)).toEqual([
    outer.id,
    ...embedded.map((a) => a.id),
  ]);
  expect(restored.at(-1).bytes).toEqual(bytes);
});

test('repeated references have a separate work budget and do not consume unique archive slots', async () => {
  const archive = await recovery.recoveryArchive(privateRaw());
  const groups = [
    Array.from({ length: 512 }, () => metadata(archive)),
    Array.from({ length: 512 }, () => metadata(archive)),
  ];
  const bytes = await packStates(groups);
  const restored = await recovery.recoveryRestoreFile(bytes);
  expect(restored).toHaveLength(4);
  expect(restored.filter((a) => a.id === archive.id)).toHaveLength(1);
  expect(restored.at(-1).bytes).toEqual(bytes);
});

test('duplicate archive IDs still verify payload integrity instead of trusting an existing match', async () => {
  const archive = await recovery.recoveryArchive(privateRaw());
  const altered = { ...metadata(archive), raw: privateRaw([], 'tampered') };
  await expect(
    recovery.recoveryRestoreFile(
      await packStates([[metadata(archive), altered]])
    )
  ).rejects.toThrow(/integrity mismatch/);
});

test('shared recipes preserve their exact bytes once and reject a tampered duplicate', async () => {
  const payload = await recovery.recoveryArchive('{"a":{"0":"note"}}');
  const original = await recovery.recoveryPack([payload]);
  const first = await recovery.recoveryRestoreFile(original);
  const container = first.at(-1);
  const descriptor = {
    id: container.id,
    containerRecipe: container.containerRecipe,
  };
  const state = await recovery.recoveryArchive(
    privateRaw([descriptor, descriptor])
  );
  const restored = await recovery.recoveryRestoreFile(
    await recovery.recoveryPack([payload, state])
  );
  expect(restored.filter((a) => a.id === container.id)).toHaveLength(1);
  expect(restored.find((a) => a.id === container.id).bytes).toEqual(original);
  const altered = {
    ...descriptor,
    containerRecipe: {
      ...descriptor.containerRecipe,
      prefix: [...descriptor.containerRecipe.prefix],
    },
  };
  altered.containerRecipe.prefix[0] ^= 1;
  const badState = await recovery.recoveryArchive(
    privateRaw([descriptor, altered])
  );
  await expect(
    recovery.recoveryRestoreFile(
      await recovery.recoveryPack([payload, badState])
    )
  ).rejects.toThrow(/Retained container digest mismatch/);
});
