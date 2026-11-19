const { loadApp, loadHTML } = require('../helpers/loadApp');

describe('source editing safety', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('visualTheme', 'default');
    loadHTML(document);
    loadApp(document);
  });
  test('independent drafts preview and undo-to-baseline retain significant whitespace', async () => {
    createTab('a.md', '# A\r\n\r\n  tail  \r\n');
    const a = state.tabs[0];
    startSourceEditing();
    const input = document.querySelector('#source-editor-host textarea');
    input.value = '# changed\n  tail  \n';
    input.dispatchEvent(new Event('input'));
    expect(isSourceDirty(a)).toBe(true);
    createTab('a.md', '# other');
    startSourceEditing();
    expect(
      document.querySelector('#source-editor-host textarea:not([hidden])').value
    ).toBe('# other');
    await switchTab(a.id);
    expect(
      document.querySelector('#source-editor-host textarea:not([hidden])')
    ).toBe(input);
    input.value = '# A\n\n  tail  \n';
    input.dispatchEvent(new Event('input'));
    expect(isSourceDirty(a)).toBe(false);
    expect(sourceDraftText(a)).toBe('# A\r\n\r\n  tail  \r\n');
  });
  test('older save acknowledgment cannot clear newer typing; errors preserve recovery', async () => {
    createTab('a.md', '# A', '/tmp/a.md');
    startSourceEditing();
    const tab = state.tabs[0],
      input = document.querySelector('#source-editor-host textarea');
    input.value = '# B';
    input.dispatchEvent(new Event('input'));
    let finish;
    configureSourceEditor({
      save: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const saving = saveSourceDraft(tab);
    input.value = '# C';
    input.dispatchEvent(new Event('input'));
    finish({ status: 'saved' });
    expect(await saving).toBe(true);
    expect(tab.rawMarkdown).toBe('# B');
    expect(sourceDraftText(tab)).toBe('# C');
    expect(isSourceDirty(tab)).toBe(true);
    configureSourceEditor({
      save: async () => ({ status: 'error', message: 'Full disk' }),
    });
    expect(await saveSourceDraft(tab)).toBe(false);
    expect(sourceDraftText(tab)).toBe('# C');
    expect(localStorage.getItem('specdown.sourceDrafts.v1')).toContain('# C');
  });
  test('closing a dirty tab requires an explicit decision and failed saving prevents close', async () => {
    createTab('a.md', 'A');
    startSourceEditing();
    const input = document.querySelector('#source-editor-host textarea');
    input.value = 'B';
    input.dispatchEvent(new Event('input'));
    const closing = closeTab(state.activeTabId);
    expect(
      document.querySelector('[data-editor-choice="keep"]')
    ).not.toBeNull();
    document.querySelector('[data-editor-choice="keep"]').click();
    await closing;
    expect(state.tabs).toHaveLength(1);
  });
});

test('confirmed overwrite clears the resolved conflict and rechecks a second external version', async () => {
  localStorage.clear();
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  createTab('conflict.md', 'A', '/tmp/conflict.md');
  startSourceEditing();
  const tab = state.tabs[0],
    input = document.querySelector('#source-editor-host textarea');
  input.value = 'mine';
  input.dispatchEvent(new Event('input'));
  const expected = [];
  configureSourceEditor({
    save: async (_tab, _text, baseline) => {
      expected.push(baseline);
      return expected.length < 3
        ? { status: 'conflict', content: 'external ' + expected.length }
        : { status: 'saved' };
    },
  });
  const saving = saveSourceDraft(tab);
  await Promise.resolve();
  document.querySelector('[data-editor-choice=overwrite]').click();
  await Promise.resolve();
  await Promise.resolve();
  document.querySelector('[data-editor-choice=overwrite]').click();
  expect(await saving).toBe(true);
  expect(expected).toEqual(['A', 'external 1', 'external 2']);
  expect(document.getElementById('source-status').textContent).toBe(
    'No unsaved changes'
  );
});

test('restart recovery offers explicit restoration without saving or granting source access', async () => {
  localStorage.clear();
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  createTab('same.md', 'original', '/tmp/first.md');
  startSourceEditing();
  const input = document.querySelector('#source-editor-host textarea');
  input.value = 'recover me';
  input.dispatchEvent(new Event('input'));
  loadHTML(document);
  loadApp(document);
  expect(state.tabs).toHaveLength(0);
  const saving = jest.fn();
  configureSourceEditor({ save: saving });
  const restoring = restoreSourceDrafts();
  expect(state.tabs).toHaveLength(0);
  document.querySelector('[data-editor-choice=restore]').click();
  await restoring;
  expect(sourceDraftText(state.tabs[0])).toBe('recover me');
  expect(isSourceDirty(state.tabs[0])).toBe(true);
  expect(saving).not.toHaveBeenCalled();
});

test('a saved copy that cannot open never clears its retained source draft', async () => {
  localStorage.clear();
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  createTab('url.md', 'original');
  startSourceEditing();
  const tab = state.tabs[0],
    input = document.querySelector('#source-editor-host textarea');
  input.value = 'changed';
  input.dispatchEvent(new Event('input'));
  configureSourceEditor({
    save: async () => ({ status: 'saved', copied: true }),
    createTab: () => false,
  });
  expect(await saveSourceDraft(tab)).toBe(true);
  expect(sourceDraftText(tab)).toBe('changed');
  expect(isSourceDirty(tab)).toBe(true);
});

test('failed close-save keeps the draft and explicit discard permits close', async () => {
  localStorage.clear();
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  createTab('failure.md', 'original');
  startSourceEditing();
  const tab = state.tabs[0],
    input = document.querySelector('#source-editor-host textarea');
  input.value = 'changed';
  input.dispatchEvent(new Event('input'));
  configureSourceEditor({
    save: async () => ({ status: 'error', message: 'Permission lost' }),
  });
  const closing = closeTab(tab.id);
  document.querySelector('[data-editor-choice=save]').click();
  await closing;
  expect(state.tabs).toContain(tab);
  expect(sourceDraftText(tab)).toBe('changed');
  const discard = closeTab(tab.id);
  document.querySelector('[data-editor-choice=discard]').click();
  await discard;
  expect(state.tabs).toHaveLength(0);
});

test('live updates leave the active and background dirty drafts intact', async () => {
  localStorage.clear();
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  createTab('same.md', 'A', '/tmp/same.md');
  startSourceEditing();
  const a = state.tabs[0],
    first = document.querySelector('#source-editor-host textarea');
  first.value = 'first draft';
  first.dispatchEvent(new Event('input'));
  createTab('same.md', 'A', '/tmp/same.md');
  startSourceEditing();
  const b = state.tabs[1],
    second = document.querySelector(
      '#source-editor-host textarea:not([hidden])'
    );
  second.value = 'second draft';
  second.dispatchEvent(new Event('input'));
  expect(protectSourceDraft(a, 'external')).toBe(true);
  expect(protectSourceDraft(b, 'external')).toBe(true);
  await switchTab(a.id);
  expect(first.value).toBe('first draft');
  expect(second.value).toBe('second draft');
  expect(a.rawMarkdown).toBe('A');
  expect(b.rawMarkdown).toBe('A');
  expect(document.getElementById('source-status').textContent).toContain(
    'Source changed'
  );
});

test('the contextual editor reuses the document header and keeps reading separate from preview', async () => {
  localStorage.clear();
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  createTab('context.md', '# Original');
  const edit = document.getElementById('source-edit');
  const bar = document.getElementById('source-editor-bar');
  expect(bar.closest('.content-header')).not.toBeNull();
  expect(bar.hidden).toBe(true);
  expect(edit.hidden).toBe(false);
  edit.click();
  const tab = state.tabs[0],
    input = document.querySelector('#source-editor-host textarea');
  input.value = '# Draft';
  input.dispatchEvent(new Event('input'));
  document.getElementById('source-preview').click();
  await Promise.resolve();
  expect(bar.hidden).toBe(false);
  expect(
    document.getElementById('source-preview').getAttribute('aria-pressed')
  ).toBe('true');
  expect(document.getElementById('source-editor-host').hidden).toBe(true);
  document.getElementById('source-more').click();
  document.getElementById('source-return').click();
  await Promise.resolve();
  expect(bar.hidden).toBe(true);
  expect(edit.textContent).toContain('Resume');
  expect(sourceDraftText(tab)).toBe('# Draft');
  expect(localStorage.getItem('specdown.sourceDrafts.v1')).toContain('# Draft');
  edit.click();
  expect(
    document.querySelector('#source-editor-host textarea:not([hidden])')
  ).toBe(input);
  expect(input.value).toBe('# Draft');
});

test('editor More has keyboard dismissal without leaving the draft workspace', () => {
  localStorage.clear();
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  createTab('menu.md', '# Original');
  startSourceEditing();
  document.getElementById('source-more').click();
  expect(
    document.getElementById('source-more').getAttribute('aria-expanded')
  ).toBe('true');
  document.getElementById('source-menu').dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
  );
  expect(document.getElementById('source-menu').hidden).toBe(true);
  expect(document.getElementById('source-editor-bar').hidden).toBe(false);
});

test('explicit discard offers a small confirmation, cancel retains the draft, and discard restores reading', async () => {
  localStorage.clear();
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  createTab('discard.md', '# Saved');
  startSourceEditing();
  const input = document.querySelector('#source-editor-host textarea');
  input.value = '# Unsaved';
  input.dispatchEvent(new Event('input'));
  document.getElementById('source-more').click();
  document.getElementById('source-cancel').click();
  const confirmation = document.querySelector('dialog');
  expect(confirmation.querySelector('h2').textContent).toBe('Discard changes?');
  expect(
    [...confirmation.querySelectorAll('button')].map((b) => b.textContent)
  ).toEqual(['Cancel', 'Discard changes']);
  confirmation.querySelector('[data-editor-choice=keep]').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(document.querySelector('#source-editor-host textarea')).toBe(input);
  expect(input.value).toBe('# Unsaved');
  expect(localStorage.getItem('specdown.sourceDrafts.v1')).toContain(
    '# Unsaved'
  );
  document.getElementById('source-more').click();
  document.getElementById('source-cancel').click();
  document.querySelector('[data-editor-choice=discard]').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (
    let attempt = 0;
    attempt < 100 && document.activeElement?.id !== 'source-edit';
    attempt++
  )
    await new Promise((resolve) => setTimeout(resolve, 10));
  expect(document.activeElement.id).toBe('source-edit');
  expect(document.getElementById('source-editor-bar').hidden).toBe(true);
  expect(document.getElementById('markdown-content').textContent).toContain(
    'Saved'
  );
  expect(localStorage.getItem('specdown.sourceDrafts.v1')).not.toContain(
    '# Unsaved'
  );
});
