const { waitForAnnotationContext } = require('../helpers/annotationReadiness');
const { loadHTML, loadApp } = require('../helpers/loadApp');
const {
  installAnnotationAuthority,
} = require('../helpers/annotationAuthority');
let fixture;
beforeEach(() => {
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  fixture = installAnnotationAuthority();
});
const command = (type, extra = {}) => ({
  type,
  id: crypto.randomUUID(),
  epoch: fixture.read().epoch,
  revision: fixture.read().revision,
  ...extra,
});
const mutate = (type, extra = {}) => fixture.apply(command(type, extra));
async function archiveFixture() {
  const archive = await recoveryArchive(
    '{"README.md":{"01":"first","1":"second"},"empty":{}}'
  );
  mutate('capture', { archive });
  return archive;
}
function binding(source = 'synthetic:a', label = 'README.md') {
  mutate('bind', { source, label });
  return fixture.read().documents.at(-1);
}
test('I03 — captured browser identity survives metadata edits; independent equal Files never share it', () => {
  const a = { sourceMeta: { size: 4, lastModified: 1 }, filename: 'README.md' },
    b = { sourceMeta: { size: 4, lastModified: 1 }, filename: 'README.md' };
  const captured = annotationSourceForTab(a);
  a.sourceMeta.url = 'https://example.test/README.md';
  expect(annotationSourceForTab(a)).toBe(captured);
  expect(annotationSourceForTab(b)).not.toBe(captured);
});
test('I04 — native content descriptor, rather than renderer path or filename, determines source binding', () => {
  const token = {
    authorityId: crypto.randomUUID(),
    sourceToken: crypto.randomUUID(),
  };
  expect(
    annotationSourceForTab({
      filePath: '/a/README.md',
      sourceMeta: { annotationSource: token },
    })
  ).toBe(
    annotationSourceForTab({
      filePath: '/moved/README.md',
      sourceMeta: { annotationSource: token },
    })
  );
  expect(
    annotationSourceForTab({ filePath: '/a/README.md', sourceMeta: null })
  ).not.toBe(
    annotationSourceForTab({ filePath: '/a/README.md', sourceMeta: null })
  );
});
test('I08 — bundle namespace and independent generated shares never alias user sample names', () => {
  const bundle = annotationSourceForTab({
    sourceMeta: { sample: 'sample.md' },
  });
  expect(
    annotationSourceForTab({ filename: 'sample.md', sourceMeta: null })
  ).not.toBe(bundle);
  expect(annotationSourceForTab({ filename: 'shared-diagram.md' })).not.toBe(
    annotationSourceForTab({ filename: 'shared-diagram.md' })
  );
});
test('I09 — explicit split/reconnect preserves both collections at a logical location', () => {
  const first = binding();
  const second = binding('synthetic:split');
  mutate('reconnect', {
    source: 'synthetic:a',
    documentId: second.id,
    documentRevision: 0,
  });
  expect(fixture.read().documents.map((d) => d.id)).toContain(first.id);
  expect(
    fixture.read().bindings.find((b) => b.source === 'synthetic:a').documentId
  ).toBe(second.id);
});
test('A01 — mixed legacy bucket subsets copy into two targets with unchanged archive multiplicity', async () => {
  const archive = await archiveFixture();
  const a = binding(),
    b = binding('synthetic:b');
  mutate('associate', {
    archiveId: archive.id,
    addresses: [archive.occurrences[0].address],
    documentId: a.id,
    documentRevision: 0,
  });
  mutate('associate', {
    archiveId: archive.id,
    addresses: [archive.occurrences[1].address],
    documentId: b.id,
    documentRevision: 0,
  });
  expect(
    fixture.read().documents.map((d) => d.notes.map((n) => n.text))
  ).toEqual([['second'], ['first']]);
  expect(fixture.read().archives[0].occurrences).toHaveLength(2);
  expect(fixture.read().archives[0].raw).toBe(archive.raw);
});
test('A03 — preview separates matched, ambiguous, positional-only and unresolved anchors', () => {
  const root = document.getElementById('markdown-content');
  root.innerHTML = '<p>Unique</p><p>Repeated</p><p>Repeated</p>';
  const context = annContext(root);
  recoveryUITarget = { context: captureDocumentContext() };
  expect(
    recoveryUIAnchorStatus({ anchor: annAnchorFor(context, 0), legacyIdx: 0 })
  ).toMatch(/^matched/);
  expect(
    recoveryUIAnchorStatus({ anchor: annAnchorFor(context, 1), legacyIdx: 1 })
  ).toBe('ambiguous');
  expect(recoveryUIAnchorStatus({ anchor: null, legacyIdx: 0 })).toBe(
    'positional only'
  );
  expect(recoveryUIAnchorStatus({ anchor: null, legacyIdx: 99 })).toBe(
    'unresolved'
  );
});
test('A04 — transaction-time guard rejects a view changed after preview without changing active state', async () => {
  const archive = await archiveFixture();
  const doc = binding();
  const before = JSON.stringify(fixture.read());
  expect(() =>
    mutate('associate', {
      archiveId: archive.id,
      addresses: [archive.occurrences[0].address],
      documentId: doc.id,
      documentRevision: 0,
      guard: () => false,
    })
  ).toThrow(/Target changed/);
  expect(JSON.stringify(fixture.read())).toBe(before);
});
test('U01 — simple associate/reconnect undo and retry affect only unchanged operation effects', async () => {
  const archive = await archiveFixture();
  const a = binding(),
    b = binding('synthetic:b');
  const attach = command('associate', {
    archiveId: archive.id,
    addresses: [archive.occurrences[0].address],
    documentId: a.id,
    documentRevision: 0,
  });
  fixture.apply(attach);
  mutate('undo', { operationId: attach.id });
  expect(
    fixture.read().documents.find((d) => d.id === a.id).notes
  ).toHaveLength(0);
  const reconnect = command('reconnect', {
    source: 'synthetic:a',
    documentId: b.id,
    documentRevision: 0,
  });
  fixture.apply(reconnect);
  mutate('undo', { operationId: reconnect.id });
  expect(
    fixture.read().bindings.find((x) => x.source === 'synthetic:a').documentId
  ).toBe(a.id);
  const before = JSON.stringify(fixture.read());
  mutate('undo', { operationId: reconnect.id });
  expect(JSON.stringify(fixture.read())).toBe(before);
});
test('U02 — deleting one copy and independently associating another survives undo of the first attach', async () => {
  const archive = await archiveFixture();
  const doc = binding();
  const attach = command('associate', {
    archiveId: archive.id,
    addresses: [archive.occurrences[0].address],
    documentId: doc.id,
    documentRevision: 0,
  });
  fixture.apply(attach);
  let current = fixture.read().documents[0];
  mutate('edit', {
    documentId: doc.id,
    documentRevision: current.revision,
    noteId: current.notes[0].id,
    text: '',
  });
  current = fixture.read().documents[0];
  mutate('associate', {
    archiveId: archive.id,
    addresses: [archive.occurrences[0].address],
    documentId: doc.id,
    documentRevision: current.revision,
  });
  mutate('undo', { operationId: attach.id });
  expect(fixture.read().documents[0].notes).toHaveLength(1);
  expect(fixture.read().operations.at(-1).conflicts).toHaveLength(1);
});
test('T02 — unsupported serialization/nesting cannot commit even a prepared request', () => {
  const doc = binding();
  const cycle = {};
  cycle.self = cycle;
  const before = JSON.stringify(fixture.read());
  expect(() =>
    recoveryPrepare(
      fixture.read(),
      command('add', {
        documentId: doc.id,
        documentRevision: 0,
        note: { text: 'draft', extension: cycle },
      })
    )
  ).toThrow(/nesting|circular/i);
  expect(JSON.stringify(fixture.read())).toBe(before);
});
test('T06 — old-version legacy writes become additional immutable candidates without overwriting either version', async () => {
  localStorage.setItem('specdown-annotations', '{"a":{"0":"old"}}');
  await annLoadAuthority();
  localStorage.setItem('specdown-annotations', '{"a":{"0":"downgrade edit"}}');
  await annLoadAuthority();
  expect(fixture.read().archives.map((a) => a.raw)).toEqual([
    '{"a":{"0":"old"}}',
    '{"a":{"0":"downgrade edit"}}',
  ]);
  expect(localStorage.getItem('specdown-annotations')).toBe(
    '{"a":{"0":"downgrade edit"}}'
  );
});
test('B03/V02 — more than 2000 occurrences survive backup; closed collections are paged without opening a source', async () => {
  const raw = JSON.stringify({
    version: 2,
    files: {
      'large.md': Array.from({ length: 2003 }, (_, i) => ({
        id: 'repeated',
        text: 'note ' + i,
        legacyIdx: i,
        anchor: null,
      })),
    },
  });
  const archive = await recoveryArchive(raw);
  mutate('capture', { archive });
  const doc = binding();
  mutate('associate', {
    archiveId: archive.id,
    addresses: archive.occurrences.map((o) => o.address),
    documentId: doc.id,
    documentRevision: 0,
  });
  recoveryUIAuthority = Promise.resolve(fixture.adapter);
  await openAnnotationRecovery();
  expect(
    [...document.querySelectorAll('button')].some(
      (b) => b.textContent === 'Next collection page'
    )
  ).toBe(true);
  expect(
    (await recoveryUnpack(await recoveryPrivateBackup(fixture.read())))[0]
      .occurrences
  ).toHaveLength(2003);
});
test.each([
  '{"version":2,"version":3,"files":{}}',
  '{"version":2,"files":{},"x":{"a":1,"\\u0061":2}}',
  '{"version":2,"files":{},"n":1.0000000000000000001}',
  '{"version":7,"files":{}}',
])('B04 — ambiguous/future data remains completely opaque: %s', async (raw) => {
  const archive = await recoveryArchive(raw);
  expect(archive.status).toMatch(/^opaque/);
  expect(archive.occurrences).toEqual([]);
  expect(archive.raw).toBe(raw);
});
test('I07 — equal filename/content browser selections can save independent explicit copies', async () => {
  createTab('README.md', 'Body');
  await waitForAnnotationContext();
  bookmarkCurrentFile();
  closeBookmarks();
  createTab('README.md', 'Body');
  await waitForAnnotationContext();
  bookmarkCurrentFile();
  expect(getBookmarks()).toHaveLength(2);
  expect(getBookmarks()[0].annotationCopyId).not.toBe(
    getBookmarks()[1].annotationCopyId
  );
});
test('I02 — requested URL case, slash, query ordering and raw/blob provenance remain distinct without a network probe', () => {
  const before = fetch.mock.calls.length;
  const source = recoverySource({
    url: 'https://EXAMPLE.test/Case/a/?b=2&a=1#fragment',
  });
  expect(source).toBe('url:https://example.test/Case/a/?b=2&a=1');
  for (const url of [
    'https://example.test/case/a/?b=2&a=1',
    'https://example.test/Case/a?b=2&a=1',
    'https://example.test/Case/a/?a=1&b=2',
  ])
    expect(recoverySource({ url })).not.toBe(source);
  expect(
    recoverySource({ url: 'https://github.com/o/r/blob/main/README.md' })
  ).not.toBe(
    recoverySource({
      url: 'https://raw.githubusercontent.com/o/r/main/README.md',
    })
  );
  expect(fetch.mock.calls.length).toBe(before);
});
test('I07 — two independently selected equal copies retain separate notes after a renderer restart and explicit reopen', async () => {
  const saved = fixture;
  const ids = [];
  for (const text of ['first notes', 'second notes']) {
    createTab('README.md', '<p>Body</p>');
    await waitForAnnotationContext();
    await renderAnnotations('README.md');
    expect(
      await commitAnnotation(
        { element: document.querySelector('#markdown-content p') },
        text
      )
    ).toBe(true);
    await bookmarkCurrentFile();
    ids.push(getBookmarks().at(-1).id);
    closeBookmarks();
    showDropZone();
  }
  expect(ids[0]).not.toBe(ids[1]);
  loadHTML(document);
  loadApp(document);
  annAuthorityOpening = Promise.resolve(saved.adapter);
  annAuthority = saved.adapter;
  annRoot = await saved.adapter.read();
  for (let i = 0; i < ids.length; i++) {
    await recallBookmark(ids[i]);
    await waitForAnnotationContext();
    await renderAnnotations('README.md');
    expect(annFileNotes(annotationKey).map((n) => n.text)).toEqual([
      i === 0 ? 'first notes' : 'second notes',
    ]);
    showDropZone();
  }
});
test('U01/B03/V02 — operation history pages reach and undo an older retained operation without changing newer collections', async () => {
  mutate('bind', {
    id: 'oldest-operation',
    source: 'oldest-source',
    label: 'Oldest',
  });
  for (let i = 0; i < 101; i++) binding('later-source-' + i, 'Later ' + i);
  recoveryUIAuthority = Promise.resolve(fixture.adapter);
  await openAnnotationRecovery();
  const button = (label) =>
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent === label
    );
  expect(button('Undo bind oldest-o')).toBeUndefined();
  expect(button('Older history page')).toBeDefined();
  button('Older history page').click();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(button('Undo bind oldest-o')).toBeDefined();
  button('Undo bind oldest-o').click();
  for (let i = 0; i < 40; i++) await Promise.resolve();
  expect(
    fixture.read().bindings.some((b) => b.source === 'oldest-source')
  ).toBe(false);
  expect(fixture.read().bindings).toHaveLength(101);
  expect(fixture.read().documents).toHaveLength(102);
});
