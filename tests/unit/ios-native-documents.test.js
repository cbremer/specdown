const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('native document view authority', () => {
  beforeEach(() => {
    localStorage.clear();
    window.iosNative = true;
    window.webkit = {
      messageHandlers: { specdown: { postMessage: jest.fn() } },
    };
    loadHTML(document);
    loadApp(document);
  });
  afterEach(() => {
    delete window.iosNative;
    delete window.webkit;
  });
  it('retains native source metadata across tabs and gives each accepted view a new token', async () => {
    window.loadFileContent('<p>A</p>', 'README.md', { id: 'native-a' });
    expect(state.tabs[0].sourceMeta.nativeDocument.id).toBe('native-a');
    const first = getIOSDocumentView();
    window.loadFileContent('<p>B</p>', 'README.md', { id: 'native-b' });
    const second = getIOSDocumentView();
    await switchTab(state.tabs[0].id);
    const third = getIOSDocumentView();
    expect(first.id).toBe('native-a');
    expect(second.id).toBe('native-b');
    expect(third.id).toBe('native-a');
    expect(third.token).not.toBe(first.token);
    expect(isIOSDocumentViewCurrent(first)).toBe(false);
    expect(isIOSDocumentViewCurrent(third)).toBe(true);
  });
  it('does not let URL normalization erase a traversal attempt', () => {
    window.loadFileContent('<img src="../private.png">', 'a.md', {
      id: 'doc-a',
    });
    expect(
      document.querySelector('#markdown-content img').getAttribute('src')
    ).toBeNull();
  });
  it('rejects a provider response at JS acceptance after the user changes views', () => {
    window.loadFileContent('<p>A</p>', 'a.md', { id: 'doc-a' });
    const token = getIOSDocumentView().token;
    window.loadFileContent('<p>B</p>', 'b.md', { id: 'doc-b' });
    expect(
      window.loadFileContent('<p>Late A</p>', 'late.md', {
        id: 'late',
        expectedToken: token,
      })
    ).toBe(false);
    expect(state.tabs).toHaveLength(2);
    expect(
      state.tabs.find((tab) => tab.id === state.activeTabId).filename
    ).toBe('b.md');
  });
  it('marks only a synchronous native acceptance as owned, never a later tab navigation', async () => {
    const initial = getIOSDocumentView().token;
    const first = window.specdownLoadNativeDocument('<p>A</p>', 'a.md', {
      id: 'native-a',
      deliveryID: 'delivery-a',
      expectedToken: initial,
    });
    expect(first.accepted).toBe(true);
    expect(first.token).toBe(getIOSDocumentView().token);
    expect(first.openIDs).toEqual(['native-a']);
    expect(
      window.webkit.messageHandlers.specdown.postMessage
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'documentViewChanged',
        data: expect.objectContaining({ deliveryID: 'delivery-a' }),
      })
    );
    const second = window.specdownLoadNativeDocument('<p>B</p>', 'b.md', {
      id: 'native-b',
      deliveryID: 'delivery-b',
      expectedToken: first.token,
    });
    expect(second.accepted).toBe(true);
    window.webkit.messageHandlers.specdown.postMessage.mockClear();
    await switchTab(state.tabs[0].id);
    expect(
      window.webkit.messageHandlers.specdown.postMessage
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'documentViewChanged',
        data: expect.objectContaining({ id: 'native-a', deliveryID: null }),
      })
    );
    expect(
      window.specdownLoadNativeDocument('<p>Stale</p>', 'stale.md', {
        id: 'stale',
        deliveryID: 'stale',
        expectedToken: second.token,
      }).accepted
    ).toBe(false);
  });
  it('quarantines relative document images behind a separate per-view native scheme', () => {
    window.loadFileContent(
      '<img src="./diagram.png"><img src="https://example.test/a.png">',
      'a.md',
      { id: 'doc-a' }
    );
    const images = document.querySelectorAll('#markdown-content img');
    expect(images[0].getAttribute('src')).toMatch(/^specdown-resource:\/\//);
    expect(images[0].getAttribute('src')).toContain('diagram.png');
    expect(images[1].getAttribute('src')).toBe('https://example.test/a.png');
  });
});
