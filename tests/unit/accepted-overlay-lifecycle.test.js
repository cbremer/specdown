const { loadHTML, loadApp } = require('../helpers/loadApp');

const overlayLifecycleRoot = () => document.getElementById('markdown-content');
const overlayLifecycleFullscreen = () =>
  document.getElementById('fullscreen-overlay');
const overlayLifecycleFlush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const overlayLifecycleMarkdown = (name) => `<p>Body ${name}</p>`;
// Synthetic output of Mermaid's post-sanitization rendering, not authored HTML.
const overlayLifecycleDiagrams = (name) =>
  [0, 1]
    .map(
      (i) =>
        `<div class="diagram-container"><button class="diagram-expand">Expand</button>` +
        `<div class="diagram-wrapper" id="wrapper-${name}-${i}"><svg viewBox="0 0 100 50"><text>${name}-${i}</text></svg></div></div>`
    )
    .join('');
async function overlayLifecycleDocument(name) {
  createTab(
    `${name}.md`,
    overlayLifecycleMarkdown(name),
    `/synthetic/${name}.md`
  );
  await overlayLifecycleFlush();
  overlayLifecycleRoot().insertAdjacentHTML(
    'beforeend',
    overlayLifecycleDiagrams(name)
  );
  return state.tabs.find((tab) => tab.id === state.activeTabId);
}
function overlayLifecycleOpen(kind, name = 'A') {
  if (!overlayLifecycleRoot().querySelector('.diagram-container'))
    overlayLifecycleRoot().insertAdjacentHTML(
      'beforeend',
      overlayLifecycleDiagrams(name)
    );
  if (kind === 'fullscreen') openFullscreen(`${name}-0`);
  else startPresentation();
  return kind === 'fullscreen'
    ? overlayLifecycleFullscreen()
    : document.querySelector('.presentation-overlay');
}
function overlayLifecycleExpectClosed() {
  expect(overlayLifecycleFullscreen().style.display).toBe('none');
  expect(overlayLifecycleFullscreen().panzoomInstance).toBeFalsy();
  expect(
    overlayLifecycleFullscreen().querySelector(
      '.fullscreen-diagram-wrapper svg'
    )
  ).toBeNull();
  expect(isPresentationOpen()).toBe(false);
  expect(document.querySelector('.presentation-overlay')).toBeNull();
}
const overlayLifecycleRefresh = (content) =>
  window.specdown.onFileChanged.mock.calls[0][0]({
    filename: 'A.md',
    filePath: '/synthetic/A.md',
    content,
  });

beforeEach(() => {
  jest.useFakeTimers();
  window.specdown = {
    isDesktop: true,
    onFileChanged: jest.fn(),
    watchFile: jest.fn(),
    unwatchFile: jest.fn(),
    saveSession: jest.fn(),
  };
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
});
afterEach(() => {
  closeCommandPalette();
  closeFullscreen();
  exitPresentation();
  jest.clearAllTimers();
  jest.useRealTimers();
  delete window.specdown;
});

describe.each(['fullscreen', 'presentation'])(
  '%s accepted-view lifecycle',
  (kind) => {
    test.each([
      'new document',
      'raw',
      'raw switch',
      'close to raw',
      'empty',
      'preview refresh',
      'raw refresh',
    ])('%s clears old diagram state synchronously', async (transition) => {
      const a = await overlayLifecycleDocument('A');
      let b;
      if (transition === 'raw switch' || transition === 'close to raw') {
        b = await overlayLifecycleDocument('B');
        toggleViewMode();
        await switchTab(a.id);
      }
      const overlay = overlayLifecycleOpen(kind);
      const active = document.activeElement;
      const blur = jest.spyOn(active, 'blur');
      let completion;
      if (transition === 'new document')
        createTab('B.md', overlayLifecycleMarkdown('B'));
      else if (transition === 'raw') toggleViewMode();
      else if (transition === 'raw switch') completion = switchTab(b.id);
      else if (transition === 'close to raw' || transition === 'empty')
        completion = closeTab(a.id);
      else {
        // A raw tab can carry a leftover clone from the previous view. The
        // incoming refresh must validate first and then clear that clone too.
        if (transition === 'raw refresh') a.viewMode = 'raw';
        completion = overlayLifecycleRefresh('<p>Accepted replacement</p>');
      }
      overlayLifecycleExpectClosed();
      expect(overlay.contains(document.activeElement)).toBe(false);
      if (kind === 'fullscreen') expect(blur).toHaveBeenCalledTimes(1);
      await completion;
    });

    test.each(['new document', 'preview refresh', 'raw refresh', 'tab cap'])(
      'rejected %s preserves the current instance and focus',
      async (request) => {
        const a = await overlayLifecycleDocument('A');
        if (request === 'tab cap') {
          for (let i = 0; i < 9; i++)
            await overlayLifecycleDocument(`other-${i}`);
          await switchTab(a.id);
        }
        const overlay = overlayLifecycleOpen(kind);
        const focus = document.activeElement;
        const context = captureDocumentContext();
        if (request === 'new document')
          expect(createTab('bad.md', 'x'.repeat(65537))).toBe(false);
        else if (request === 'tab cap')
          expect(createTab('extra.md', 'Valid input')).toBe(false);
        else {
          if (request === 'raw refresh') a.viewMode = 'raw';
          await overlayLifecycleRefresh('x'.repeat(65537));
        }
        expect(isDocumentContextCurrent(context)).toBe(true);
        expect(document.activeElement).toBe(focus);
        expect(
          kind === 'fullscreen' ? overlay.style.display : isPresentationOpen()
        ).toBe(kind === 'fullscreen' ? 'flex' : true);
      }
    );

    test('newer palette draft and focus survive accepted replacement', async () => {
      await overlayLifecycleDocument('A');
      overlayLifecycleOpen(kind);
      openCommandPalette();
      const input = document.querySelector('.command-palette-input');
      input.value = 'Unsubmitted palette text';
      createTab('B.md', overlayLifecycleMarkdown('B'));
      overlayLifecycleExpectClosed();
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe('Unsubmitted palette text');
      await overlayLifecycleFlush();
      expect(document.activeElement).toBe(input);
    });

    test('inactive close, background refresh and same-tab switch preserve the overlay', async () => {
      const b = await overlayLifecycleDocument('B');
      const a = await overlayLifecycleDocument('A');
      const overlay = overlayLifecycleOpen(kind);
      await window.specdown.onFileChanged.mock.calls[0][0]({
        filename: 'B.md',
        filePath: '/synthetic/B.md',
        content: '<p>Background B</p>',
      });
      await switchTab(a.id);
      await closeTab(b.id);
      expect(
        kind === 'fullscreen' ? overlay.style.display : isPresentationOpen()
      ).toBe(kind === 'fullscreen' ? 'flex' : true);
      expect(document.activeElement).toBe(overlay);
    });

    test.each(['resolve', 'reject'])(
      'late old render %s cannot close the new document overlay',
      async (finish) => {
        await overlayLifecycleDocument('A');
        let settle;
        const pending = new Promise((resolve, reject) => {
          settle = finish === 'resolve' ? resolve : reject;
        });
        global.processMermaidDiagrams = jest
          .fn()
          .mockImplementationOnce(() => pending)
          .mockResolvedValue(undefined);
        const rendering = renderMarkdown(overlayLifecycleMarkdown('A'), 'A.md');
        await overlayLifecycleDocument('B');
        const overlay = overlayLifecycleOpen(kind, 'B');
        settle(finish === 'reject' ? new Error('Late old failure') : undefined);
        await rendering;
        expect(
          kind === 'fullscreen' ? overlay.style.display : isPresentationOpen()
        ).toBe(kind === 'fullscreen' ? 'flex' : true);
        expect(document.activeElement).toBe(overlay);
      }
    );
  }
);

test('a single accepted replacement clears both stacked diagram surfaces without refocusing the opener', async () => {
  await overlayLifecycleDocument('A');
  const expand = overlayLifecycleRoot().querySelector('.diagram-expand');
  expand.focus();
  overlayLifecycleOpen('fullscreen');
  overlayLifecycleOpen('presentation');
  const focus = jest.spyOn(expand, 'focus');
  createTab('B.md', overlayLifecycleMarkdown('B'));
  overlayLifecycleExpectClosed();
  expect(focus).not.toHaveBeenCalled();
  await overlayLifecycleFlush();
});

test.each(['next', 'zoom', 'close', 'wheel'])(
  'retained old presentation %s callback cannot affect a reopened instance',
  async (action) => {
    await overlayLifecycleDocument('A');
    const old = overlayLifecycleOpen('presentation');
    const target = old.querySelector(
      action === 'next'
        ? '.presentation-next'
        : action === 'zoom'
          ? '.presentation-zoom-in'
          : action === 'close'
            ? '.presentation-close'
            : '.presentation-stage'
    );
    exitPresentation();
    const current = overlayLifecycleOpen('presentation');
    const instance = Panzoom.mock.results.at(-1).value;
    const scale = instance.getScale();
    if (action === 'wheel')
      target.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -1, bubbles: true, cancelable: true })
      );
    else target.click();
    expect(document.querySelector('.presentation-overlay')).toBe(current);
    expect(current.querySelector('.presentation-counter').textContent).toBe(
      '1 / 2'
    );
    expect(instance.getScale()).toBe(scale);
    expect(instance.destroyed).toBe(false);
  }
);

test.each([
  ['replacement', 'load'],
  ['replacement', 'error'],
  ['reopen', 'load'],
  ['reopen', 'error'],
])(
  'late minimap %s/%s cannot repaint a new instance or leak its URL',
  async (transition, finish) => {
    const images = [];
    const previousImage = global.Image;
    global.Image = class {
      constructor() {
        images.push(this);
      }
    };
    const context = { clearRect: jest.fn(), drawImage: jest.fn() };
    const getContext = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context);
    let urlIndex = 0;
    const previousCreateURL = URL.createObjectURL;
    const previousRevokeURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => `blob:overlay-${++urlIndex}`);
    const revokeURL = (URL.revokeObjectURL = jest.fn());
    try {
      await overlayLifecycleDocument('A');
      overlayLifecycleOpen('fullscreen');
      jest.advanceTimersByTime(20);
      const old = images.at(-1);
      const late = finish === 'load' ? old.onload : old.onerror;
      if (transition === 'replacement') await overlayLifecycleDocument('B');
      else closeFullscreen();
      expect(revokeURL).toHaveBeenCalledWith(old.src);
      overlayLifecycleOpen(
        'fullscreen',
        transition === 'replacement' ? 'B' : 'A'
      );
      jest.advanceTimersByTime(20);
      const current = images.at(-1);
      current.onload();
      expect(context.drawImage).toHaveBeenCalledTimes(1);
      expect(context.drawImage.mock.calls[0][0]).toBe(current);
      late();
      expect(context.clearRect).toHaveBeenCalledTimes(1);
      expect(context.drawImage).toHaveBeenCalledTimes(1);
      expect(revokeURL.mock.calls.map(([url]) => url)).toEqual([
        old.src,
        current.src,
      ]);
    } finally {
      closeFullscreen();
      global.Image = previousImage;
      getContext.mockRestore();
      if (previousCreateURL) URL.createObjectURL = previousCreateURL;
      else delete URL.createObjectURL;
      if (previousRevokeURL) URL.revokeObjectURL = previousRevokeURL;
      else delete URL.revokeObjectURL;
    }
  }
);
