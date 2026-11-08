const { loadHTML, loadApp } = require('../helpers/loadApp');
const { documentResponseBody } = require('../helpers/document-response');

describe('native URL entry bridge', () => {
  beforeEach(() => {
    window.iosNative = true;
    window.webkit = {
      messageHandlers: { specdown: { postMessage: jest.fn() } },
    };
    loadHTML(document);
    loadApp(document);
    global.fetch.mockClear();
  });
  afterEach(() => {
    delete window.iosNative;
    delete window.webkit;
  });
  it('opens a native form from the welcome control without fetching or focusing inline input', () => {
    document.getElementById('ios-open-url-button').click();
    expect(document.getElementById('inline-url-entry').hidden).toBe(true);
    expect(
      window.webkit.messageHandlers.specdown.postMessage
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'openURLInput',
        data: expect.objectContaining({ viewportWidth: window.innerWidth }),
      })
    );
    expect(document.activeElement.id).not.toBe('url-input');
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('returns validation errors directly to the native form', async () => {
    expect(await window.specdownSubmitURL('invalid', 'a')).toEqual({
      status: 'error',
      message: expect.stringMatching(/https/),
    });
    expect(document.getElementById('url-error').textContent).toBe('');
  });
  it('keeps Open File available and dismisses the opening choices with Escape', () => {
    createTab('existing.md', '# Existing');
    const button = document.getElementById('ios-open-button');
    button.click();
    expect(document.activeElement.id).toBe('ios-open-file-choice');
    document
      .getElementById('ios-open-sheet')
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    expect(document.getElementById('ios-open-sheet').style.display).toBe(
      'none'
    );
    expect(document.activeElement).toBe(button);
    button.click();
    window.webkit.messageHandlers.specdown.postMessage.mockClear();
    document.getElementById('ios-open-file-choice').click();
    expect(
      window.webkit.messageHandlers.specdown.postMessage
    ).toHaveBeenCalledWith({ action: 'openFilePicker' });
    expect(document.getElementById('ios-open-sheet').style.display).toBe(
      'none'
    );
    expect(state.tabs[0].rawMarkdown).toBe('# Existing');
  });
  it.each(['ios-open-button', 'tab-new'])(
    'opens a second URL from %s in the phone layout',
    async (control) => {
      window.setIOSLayoutMode('phone');
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          body: documentResponseBody('# First URL'),
        })
        .mockResolvedValueOnce({
          ok: true,
          body: documentResponseBody('# Second URL'),
        });
      expect(
        (
          await window.specdownSubmitURL(
            'https://example.com/first.md',
            'first'
          )
        ).status
      ).toBe('document');
      window.specdownFinishURL('first');
      expect(document.getElementById('drop-zone').style.display).toBe('none');
      expect(document.getElementById('ios-action-bar').style.display).not.toBe(
        'none'
      );
      window.webkit.messageHandlers.specdown.postMessage.mockClear();
      (control === 'tab-new'
        ? document.querySelector('#tab-bar .tab-new')
        : document.getElementById(control)
      ).click();
      const sheet = document.getElementById('ios-open-sheet');
      expect(sheet).not.toBeNull();
      expect(sheet.style.display).not.toBe('none');
      expect(sheet.textContent).toContain('Open File');
      document.getElementById('ios-open-url-choice').click();
      expect(sheet.style.display).toBe('none');
      expect(
        window.webkit.messageHandlers.specdown.postMessage
      ).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'openURLInput' })
      );
      expect(
        (
          await window.specdownSubmitURL(
            'https://example.com/second.md',
            'second'
          )
        ).status
      ).toBe('document');
      expect(state.tabs.map((tab) => tab.rawMarkdown)).toEqual([
        '# First URL',
        '# Second URL',
      ]);
      expect(document.getElementById('markdown-content').textContent).toContain(
        'Second URL'
      );
    }
  );
  it('drops a cancelled response and ignores cancellation for an older form', async () => {
    let finish;
    const accepted = jest.fn();
    configureFileLoading({ createTab: accepted });
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const pending = window.specdownSubmitURL(
      'https://example.com/a.md',
      'current'
    );
    await Promise.resolve();
    window.specdownCancelURL('old');
    expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(false);
    window.specdownCancelURL('current');
    expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(true);
    finish({ ok: true, body: documentResponseBody('# Late') });
    expect((await pending).status).toBe('stale');
    expect(accepted).not.toHaveBeenCalled();
  });
  it('waits for native dismissal before showing a repository, and drops a cancelled prepared chooser', async () => {
    const original = fetchGitHubRepoFiles;
    fetchGitHubRepoFiles = jest
      .fn()
      .mockResolvedValue([
        { path: 'a.md', url: '', rawUrl: 'https://example.com/a.md' },
      ]);
    try {
      expect(
        (await window.specdownSubmitURL('https://github.com/o/r', 'first'))
          .status
      ).toBe('repository');
      expect(document.getElementById('repo-browser-modal')).toBeNull();
      window.specdownCancelURL('first');
      window.specdownFinishURL('first');
      expect(document.getElementById('repo-browser-modal')).toBeNull();
      await window.specdownSubmitURL('https://github.com/o/r', 'second');
      window.specdownFinishURL('first');
      expect(document.getElementById('repo-browser-modal')).toBeNull();
      window.specdownFinishURL('second');
      expect(document.getElementById('repo-browser-modal').style.display).toBe(
        'flex'
      );
    } finally {
      fetchGitHubRepoFiles = original;
    }
  });
});
