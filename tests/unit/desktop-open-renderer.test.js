const { loadHTML, loadApp } = require('../helpers/loadApp');
const ackPayload = (content = '<p>Accepted</p>') => ({
  content,
  filename: 'Accepted.md',
  filePath: '/synthetic/Accepted.md',
  openReceipt: 'synthetic-receipt',
});
const ackOpen = (payload) =>
  window.specdown.onFileOpened.mock.calls[0][0](payload);
beforeEach(() => {
  localStorage.setItem('visualTheme', 'default');
  window.specdown = {
    isDesktop: true,
    onFileOpened: jest.fn(),
    onFileChanged: jest.fn(),
    onCloseTab: jest.fn(),
    watchFile: jest.fn(),
    saveSession: jest.fn(),
    reportFileOpenResult: jest.fn(),
  };
  loadHTML(document);
  loadApp(document);
});
afterEach(() => {
  delete window.specdown;
});

test('valid tab admission reports true and preserves accepted renderer recents', () => {
  ackOpen(ackPayload());
  expect(window.specdown.reportFileOpenResult.mock.calls).toEqual([
    ['synthetic-receipt', true],
  ]);
  expect(state.tabs).toHaveLength(1);
  expect(state.currentRawMarkdown).toBe('<p>Accepted</p>');
  expect(document.getElementById('markdown-content').textContent).toBe(
    'Accepted'
  );
});

test.each(['line-limit', 'parse', 'sanitize', 'tab-cap'])(
  '%s refusal reports false and preserves the accepted document',
  (reason) => {
    ackOpen(ackPayload());
    const before = JSON.stringify(state.tabs);
    window.specdown.reportFileOpenResult.mockClear();
    if (reason === 'parse')
      marked.parse.mockImplementationOnce(() => {
        throw new Error('Parse');
      });
    if (reason === 'sanitize')
      DOMPurify.sanitize.mockImplementationOnce(() => {
        throw new Error('Sanitize');
      });
    if (reason === 'tab-cap')
      while (state.tabs.length < 50)
        state.tabs.push({ ...state.tabs[0], id: state.tabs.length + 1 });
    const tabSnapshot = JSON.stringify(state.tabs);
    ackOpen(
      ackPayload(reason === 'line-limit' ? 'x'.repeat(65537) : '<p>Refused</p>')
    );
    expect(window.specdown.reportFileOpenResult.mock.calls).toEqual([
      ['synthetic-receipt', false],
    ]);
    expect(JSON.stringify(state.tabs)).toBe(
      reason === 'tab-cap' ? tabSnapshot : before
    );
    expect(state.currentRawMarkdown).toBe('<p>Accepted</p>');
    expect(document.getElementById('markdown-content').textContent).toBe(
      'Accepted'
    );
  }
);

test('admission does not wait for asynchronous Mermaid completion', () => {
  mermaid.render.mockImplementationOnce(() => new Promise(() => {}));
  ackOpen(
    ackPayload(
      '<pre><code class="language-mermaid">graph TD; A--&gt;B</code></pre>'
    )
  );
  expect(window.specdown.reportFileOpenResult.mock.calls).toEqual([
    ['synthetic-receipt', true],
  ]);
  expect(state.tabs).toHaveLength(1);
});
