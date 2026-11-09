const { loadHTML, loadApp } = require('../helpers/loadApp');
const {
  installAnnotationAuthority,
} = require('../helpers/annotationAuthority');
let fixture;
const {
  waitForAnnotationState: waitFor,
  waitForAnnotationContext: waitForDocument,
} = require('../helpers/annotationReadiness');
beforeEach(() => {
  loadHTML(document);
  loadApp(document);
  fixture = installAnnotationAuthority();
});
test.each([
  '{bad',
  '{"version":99,"future":"\\ud800"}',
  '{"a":1,"\\u0061":2}',
  '{"version":2,"files":{"README.md":[{"text":"same","future":{"x":1}},{"text":"same"}]}}',
  '{"__proto__":{"01":"a","1":"b"},"empty":{}}',
])('raw legacy/import data is preserved unassigned: %s', async (raw) => {
  localStorage.setItem('specdown-annotations', raw);
  expect(await importAnnotations(raw)).toBe(true);
  const root = fixture.read();
  expect(root.archives[0].raw).toBe(raw);
  expect(root.documents).toHaveLength(0);
  expect(root.bindings).toHaveLength(0);
  expect(localStorage.getItem('specdown-annotations')).toBe(raw);
  expect(getAnnotationsJSON()).toBe(raw);
  expect(await importAnnotations(raw)).toBe(true);
  expect(fixture.read().archives).toHaveLength(1);
});
test('transaction failure leaves draft and all archives unchanged, without success acknowledgement', async () => {
  createTab('a.md', '<p>Body</p>');
  await waitForDocument();
  openAnnotationEditor({
    element: document.querySelector('#markdown-content p'),
  });
  const before = JSON.stringify(fixture.read());
  const editor = document.querySelector('#annotation-editor-backdrop');
  editor.querySelector('textarea').value = 'draft';
  fixture.adapter.commit = async () => {
    throw new Error('QuotaExceededError: no transaction committed');
  };
  editor.querySelector('.annotation-editor-save').click();
  await waitFor(
    () =>
      fixture.read().requests.some((r) => r.status === 'prepared') &&
      document.body.textContent.includes(
        'QuotaExceededError: no transaction committed'
      )
  );
  expect(JSON.stringify({ ...fixture.read(), requests: [] })).toBe(before);
  expect(fixture.read().requests[0].command.note.text).toBe('draft');
  expect(editor.style.display).toBe('flex');
  expect(editor.querySelector('textarea').value).toBe('draft');
});
test('unknown note metadata and grandfathered large records survive small-note edits', async () => {
  const archive = await recoveryArchive(
    JSON.stringify({
      version: 2,
      files: {
        'a.md': [
          { text: 'small', extra: { keep: true } },
          { text: 'x'.repeat(16385) },
        ],
      },
    })
  );
  fixture.apply({ type: 'capture', archive });
  fixture.apply({
    type: 'bind',
    source: 'url:https://synthetic.test/a.md',
    label: 'a.md',
  });
  let doc = fixture.read().documents[0];
  fixture.apply({
    type: 'associate',
    archiveId: archive.id,
    addresses: archive.occurrences.map((o) => o.address),
    documentId: doc.id,
    documentRevision: 0,
  });
  createTab('a.md', '<p>Body</p>', null, {
    url: 'https://synthetic.test/a.md',
  });
  await waitForDocument();
  doc = fixture.read().documents[0];
  expect(await commitAnnotation({ id: doc.notes[0].id }, 'updated')).toBe(true);
  doc = fixture.read().documents[0];
  expect(doc.notes[0].extra).toEqual({ keep: true });
  expect(doc.notes[1].text).toHaveLength(16385);
  expect(fixture.read().archives[0].raw).toBe(archive.raw);
  expect(
    await commitAnnotation({ id: doc.notes[1].id }, 'y'.repeat(16385))
  ).toBe(false);
  expect(doc.notes[1].text).toHaveLength(16385);
});
test('an unavailable transactional backend never falls back to legacy localStorage writes', async () => {
  localStorage.setItem('specdown-annotations', '{"a.md":{"0":"keep"}}');
  annAuthorityOpening = Promise.reject(new Error('unavailable'));
  annAuthorityOpening.catch(() => {});
  expect(await importAnnotations('{"b":{"0":"new"}}')).toBe(false);
  expect(localStorage.getItem('specdown-annotations')).toBe(
    '{"a.md":{"0":"keep"}}'
  );
  expect(fixture.read().documents).toHaveLength(0);
});
test('T03/A05: active editor retries an acknowledged-lost transaction by the same persisted operation ID', async () => {
  createTab('a.md', '<p>Body</p>');
  await waitForDocument();
  const real = fixture.adapter.commit;
  let first = true;
  fixture.adapter.commit = async (command) => {
    const result = await real(command);
    if (first) {
      first = false;
      throw new Error('Acknowledgement lost after commit');
    }
    return result;
  };
  openAnnotationEditor({
    element: document.querySelector('#markdown-content p'),
  });
  const editor = document.querySelector('#annotation-editor-backdrop');
  editor.querySelector('textarea').value = 'once';
  editor.querySelector('.annotation-editor-save').click();
  await waitFor(
    () =>
      editor.style.display === 'none' &&
      fixture
        .read()
        .requests.some((r) => r.status === 'committed' && r.acknowledged)
  );
  expect(fixture.read().documents.flatMap((d) => d.notes)).toHaveLength(1);
  expect(editor.style.display).toBe('none');
  expect(fixture.read().requests[0]).toEqual(
    expect.objectContaining({ status: 'committed', acknowledged: true })
  );
});

test('document readiness waits for a deferred binding commit', async () => {
  const original = fixture.adapter.commit;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  fixture.adapter.commit = async (command) => {
    if (command.type === 'bind') await gate;
    return original(command);
  };
  createTab('deferred.md', '<p>Body</p>');
  let ready = false;
  const waiting = waitForDocument().then(() => {
    ready = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(ready).toBe(false);
  release();
  await waiting;
  expect(annotationKey).toBe(fixture.read().documents[0].id);
});
