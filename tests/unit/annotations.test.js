const { loadHTML, loadApp } = require('../helpers/loadApp');
const {
  installAnnotationAuthority,
} = require('../helpers/annotationAuthority');
const {
  waitForAnnotationState,
  waitForAnnotationContext,
} = require('../helpers/annotationReadiness');
let fixture;
beforeEach(() => {
  loadHTML(document);
  loadApp(document);
  fixture = installAnnotationAuthority();
});
async function open(
  name = 'doc.md',
  text = '<p>Alpha</p><p>Beta</p>',
  meta = { url: 'https://synthetic.test/doc.md' }
) {
  createTab(name, text, null, meta);
  await waitForAnnotationContext();
  return document.getElementById('markdown-content');
}
test('filename buckets are captured unchanged but never attached to an unrelated accepted source', async () => {
  const raw = '{"README.md":{"0":"private legacy"}}';
  localStorage.setItem('specdown-annotations', raw);
  await open('README.md');
  await annLoadAuthority();
  expect(localStorage.getItem('specdown-annotations')).toBe(raw);
  expect(fixture.read().archives[0].raw).toBe(raw);
  expect(fixture.read().documents.every((d) => d.notes.length === 0)).toBe(
    true
  );
  expect(document.querySelector('.annotation-badge')).toBeNull();
});
test('I01: browser selections with equal filenames have separate committed document collections', async () => {
  const root = await open('README.md', '<p>First</p>', {});
  expect(
    await commitAnnotation({ element: root.querySelector('p') }, 'first')
  ).toBe(true);
  const first = annotationKey;
  await open('README.md', '<p>First</p>', {});
  expect(annotationKey).not.toBe(first);
  expect(annFileNotes(annotationKey)).toEqual([]);
});
test('I02: a requested URL reopens its collection while another URL with the same filename does not', async () => {
  const root = await open();
  await commitAnnotation({ element: root.querySelector('p') }, 'URL note');
  const first = annotationKey;
  await open();
  expect(annotationKey).toBe(first);
  expect(annFileNotes(first)).toHaveLength(1);
  await open('doc.md', '<p>Alpha</p>', { url: 'https://other.test/doc.md' });
  expect(annotationKey).not.toBe(first);
});
test('anchors follow reordered text without rewriting originals or guessed badges', async () => {
  const root = await open();
  await commitAnnotation({ element: root.querySelectorAll('p')[1] }, 'note');
  const before = JSON.stringify(fixture.read());
  root.innerHTML = '<p>Beta</p><p>Alpha</p>';
  await renderAnnotations('doc.md');
  expect(
    root.querySelector('p').querySelector('.annotation-badge')
  ).not.toBeNull();
  expect(JSON.stringify(fixture.read())).toBe(before);
  root.innerHTML = '<p>Beta changed</p><p>Alpha</p>';
  await renderAnnotations('doc.md');
  expect(root.querySelector('.annotation-badge')).toBeNull();
  expect(annFileNotes(annotationKey)[0].text).toBe('note');
});
test('heading paths distinguish duplicate text', async () => {
  const root = await open(
    'doc.md',
    '<h2>First</h2><p>same</p><h2>Second</h2><p>same</p>'
  );
  await commitAnnotation({ element: root.querySelectorAll('p')[1] }, 'second');
  await renderAnnotations('doc.md');
  expect(
    root.querySelectorAll('p')[0].querySelector('.annotation-badge')
  ).toBeNull();
  expect(
    root.querySelectorAll('p')[1].querySelector('.annotation-badge')
  ).not.toBeNull();
});
test('real editor commits only on acknowledgement, keeps draft on conflict, and preserves unrelated work', async () => {
  const root = await open();
  openAnnotationEditor({ element: root.querySelector('p') });
  const editor = document.getElementById('annotation-editor-backdrop');
  editor.querySelector('textarea').value = 'draft';
  fixture.apply({ type: 'bind', source: 'unrelated', label: 'other' });
  editor.querySelector('.annotation-editor-save').click();
  await waitForAnnotationState(() =>
    document.body.textContent.includes(
      'Prepared request target or revision changed'
    )
  );
  expect(editor.style.display).toBe('flex');
  expect(editor.querySelector('textarea').value).toBe('draft');
  expect(fixture.read().documents.flatMap((d) => d.notes)).toHaveLength(0);
});
test('panel lists notes and deleting last note commits without touching legacy data', async () => {
  const root = await open();
  await commitAnnotation({ element: root.querySelector('p') }, 'saved');
  expect(document.querySelector('.annotation-list-note').textContent).toBe(
    'saved'
  );
  expect(document.querySelector('.annotation-list-count').textContent).toBe(
    '1'
  );
  document.querySelector('.annotation-list-delete').click();
  await waitForAnnotationState(
    () =>
      annFileNotes(annotationKey).length === 0 &&
      document.getElementById('annotation-list-toggle').style.display === 'none'
  );
  expect(annFileNotes(annotationKey)).toHaveLength(0);
  expect(document.getElementById('annotation-list-toggle').style.display).toBe(
    'none'
  );
});
test('mode and badges use in-app UI and textContent', async () => {
  const root = await open();
  toggleAnnotationMode();
  expect(annotationMode).toBe(true);
  root
    .querySelector('p')
    .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  expect(document.querySelector('.annotation-editor-input')).not.toBeNull();
  const p = root.querySelector('p');
  attachAnnotationBadge(
    p,
    {
      id: 'n',
      text: '<img src=x onerror=alert(1)>',
      anchor: null,
      legacyIdx: 0,
    },
    false
  );
  expect(p.querySelector('img')).toBeNull();
  expect(p.getAttribute('data-annot-id')).toBe('n');
  detachAnnotationHandlers();
  expect(root.querySelector('.annotatable')).toBeNull();
});

test.each([
  null,
  {
    authorityId: 'a7ce6a62-3987-461c-a6a1-2872415fd992',
    sourceToken: 'cefd9b56-f66c-45ee-8569-3495803f15b4',
    requiresReconnect: true,
  },
])(
  'I06: accepted native unavailable or conflicting identity visibly offers global recovery (%j)',
  async (annotationSource) => {
    createTab('native.md', '<p>Alpha</p>', '/synthetic/native.md', {
      annotationSource,
    });
    await waitForAnnotationContext();
    expect(document.body.textContent).toContain(
      annotationSource
        ? 'conflicting source continuity'
        : 'native note identity is unavailable'
    );
    expect(document.body.textContent).toContain('Open note recovery');
    expect(fixture.read().documents).toHaveLength(1);
  }
);
