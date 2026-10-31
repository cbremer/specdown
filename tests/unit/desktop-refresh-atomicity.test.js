const { loadHTML, loadApp } = require('../helpers/loadApp');

const refreshRoot = () => document.getElementById('markdown-content');
const flushRefresh = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const refreshPayload = (name, content = `<p>Visible ${name}</p>`) => ({
  filename: `${name}.md`,
  filePath: `/synthetic/${name}.md`,
  content,
});
const rejectedRefresh = () => refreshPayload('A', 'x'.repeat(65537));
const deliverRefresh = (payload) =>
  window.specdown.onFileChanged.mock.calls[0][0](payload);
async function openRefreshDocument(name) {
  window.specdown.onFileOpened.mock.calls[0][0](refreshPayload(name));
  await flushRefresh();
  return state.tabs.find((tab) => tab.id === state.activeTabId);
}

beforeEach(() => {
  localStorage.setItem('visualTheme', 'default');
  window.specdown = {
    isDesktop: true,
    onFileOpened: jest.fn(),
    onFileChanged: jest.fn(),
    onCloseTab: jest.fn(),
    watchFile: jest.fn(),
    unwatchFile: jest.fn(),
    saveSession: jest.fn(),
    requestRefreshFile: jest.fn(),
  };
  loadHTML(document);
  loadApp(document);
});
afterEach(() => {
  delete window.specdown;
});

test('a rejected watched update preserves A before switching to B and back', async () => {
  const a = await openRefreshDocument('A');
  const before = JSON.stringify(state.tabs);
  const context = captureDocumentContext();
  refreshRoot().scrollTop = 71;
  await deliverRefresh(rejectedRefresh());
  expect(JSON.stringify(state.tabs)).toBe(before);
  expect(refreshRoot().textContent).toBe('Visible A');
  expect(state.currentRawMarkdown).toBe('<p>Visible A</p>');
  expect(refreshRoot().scrollTop).toBe(71);
  expect(isDocumentContextCurrent(context)).toBe(true);
  expect(document.querySelector('.watch-toggle-label').textContent).toBe(
    'Live'
  );
  await openRefreshDocument('B');
  await switchTab(a.id);
  expect(document.querySelector('.tab-active .tab-filename').textContent).toBe(
    'A.md'
  );
  expect(document.getElementById('file-name').textContent).toBe('A.md');
  expect(refreshRoot().textContent).toBe('Visible A');
});

test('a rejected background update leaves every copy and its unseen flag intact', async () => {
  const first = await openRefreshDocument('A');
  await openRefreshDocument('A');
  await openRefreshDocument('B');
  const before = JSON.stringify(state.tabs);
  const context = captureDocumentContext();
  await deliverRefresh(rejectedRefresh());
  expect(JSON.stringify(state.tabs)).toBe(before);
  expect(refreshRoot().textContent).toBe('Visible B');
  expect(isDocumentContextCurrent(context)).toBe(true);
  await switchTab(first.id);
  expect(refreshRoot().textContent).toBe('Visible A');
});

test('manual refresh rejection retains the accepted source and does not report Updated', async () => {
  const a = await openRefreshDocument('A');
  refreshActiveFileFromDisk();
  expect(window.specdown.requestRefreshFile).toHaveBeenCalledWith(
    '/synthetic/A.md'
  );
  await deliverRefresh(rejectedRefresh());
  expect(a.rawMarkdown).toBe('<p>Visible A</p>');
  expect(document.querySelector('.watch-toggle-label').textContent).toBe(
    'Live'
  );
  expect(document.querySelector('.toast-error').textContent).toMatch(
    /This document/
  );
});

test('rejected raw-view refresh preserves raw DOM, tab source and generation', async () => {
  const a = await openRefreshDocument('A');
  toggleViewMode();
  const before = refreshRoot().innerHTML;
  const context = captureDocumentContext();
  await deliverRefresh(rejectedRefresh());
  expect(a.rawMarkdown).toBe('<p>Visible A</p>');
  expect(refreshRoot().innerHTML).toBe(before);
  expect(isDocumentContextCurrent(context)).toBe(true);
  expect(document.querySelector('.watch-toggle-label').textContent).toBe(
    'Live'
  );
});

test.each(['parse', 'sanitize'])(
  '%s rejection changes no matching tab',
  async (stage) => {
    await openRefreshDocument('A');
    const before = JSON.stringify(state.tabs);
    const parser = stage === 'parse' ? marked.parse : DOMPurify.sanitize;
    parser.mockImplementationOnce(() => {
      throw new Error('Synthetic refresh refusal');
    });
    await deliverRefresh(refreshPayload('A', '<p>Refused</p>'));
    expect(JSON.stringify(state.tabs)).toBe(before);
    expect(refreshRoot().textContent).toBe('Visible A');
    expect(document.querySelector('.watch-toggle-label').textContent).toBe(
      'Live'
    );
  }
);

test('accepted refresh prepares once, updates all copies, and preserves active scroll', async () => {
  const first = await openRefreshDocument('A');
  const active = await openRefreshDocument('A');
  refreshRoot().scrollTop = 87;
  marked.parse.mockClear();
  DOMPurify.sanitize.mockClear();
  await deliverRefresh(refreshPayload('A', '<h1>Updated A</h1>'));
  expect(marked.parse).toHaveBeenCalledTimes(1);
  expect(DOMPurify.sanitize).toHaveBeenCalledTimes(1);
  expect(first.rawMarkdown).toBe('<h1>Updated A</h1>');
  expect(active.rawMarkdown).toBe(first.rawMarkdown);
  expect(first.hasUnseenChanges).toBe(true);
  expect(active.hasUnseenChanges).toBe(false);
  expect(refreshRoot().textContent).toBe('Updated A');
  expect(refreshRoot().scrollTop).toBe(87);
  expect(document.querySelector('.watch-toggle-label').textContent).toBe(
    'Updated'
  );
});

test('accepted background update appears when that tab is selected', async () => {
  const a = await openRefreshDocument('A');
  await openRefreshDocument('B');
  await deliverRefresh(refreshPayload('A', '<p>Accepted A update</p>'));
  expect(refreshRoot().textContent).toBe('Visible B');
  expect(a.hasUnseenChanges).toBe(true);
  await switchTab(a.id);
  expect(refreshRoot().textContent).toBe('Accepted A update');
});

test('a renderer failure after preparation does not pulse successful refresh', async () => {
  await openRefreshDocument('A');
  global.processMermaidDiagrams = jest
    .fn()
    .mockRejectedValue(new Error('Synthetic renderer failure'));
  await deliverRefresh(refreshPayload('A', '<p>Accepted input</p>'));
  expect(document.querySelector('.watch-toggle-label').textContent).toBe(
    'Live'
  );
  expect(document.querySelector('.toast-error').textContent).toMatch(
    /Error rendering/
  );
});

test('rejected new desktop opens do not record renderer recents or start watches', async () => {
  await openRefreshDocument('A');
  const recentBefore = localStorage.getItem('specdown-recent-files');
  window.specdown.watchFile.mockClear();
  window.specdown.saveSession.mockClear();
  window.specdown.onFileOpened.mock.calls[0][0](
    refreshPayload('B', 'x'.repeat(65537))
  );
  expect(state.tabs).toHaveLength(1);
  expect(refreshRoot().textContent).toBe('Visible A');
  expect(localStorage.getItem('specdown-recent-files')).toBe(recentBefore);
  expect(window.specdown.watchFile).not.toHaveBeenCalled();
  expect(window.specdown.saveSession).not.toHaveBeenCalled();
});

test('tab-limit refusal also leaves renderer recents unchanged', async () => {
  for (let i = 0; i < 10; i++) await openRefreshDocument(String(i));
  const recentBefore = localStorage.getItem('specdown-recent-files');
  window.specdown.onFileOpened.mock.calls[0][0](refreshPayload('Overflow'));
  expect(state.tabs).toHaveLength(10);
  expect(localStorage.getItem('specdown-recent-files')).toBe(recentBefore);
});
