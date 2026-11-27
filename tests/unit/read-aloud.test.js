const { loadHTML, loadApp } = require('../helpers/loadApp');

const pane = () => document.getElementById('markdown-content');
const strip = () => document.querySelector('.sd-transport');
const flushSpeech = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function browserVoice(voices = [{ localService: true, lang: 'en-US' }]) {
  const engine = Object.assign(new EventTarget(), {
    speak: jest.fn(),
    cancel: jest.fn(),
    getVoices: jest.fn(() => voices),
  });
  window.speechSynthesis = engine;
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  return engine;
}

beforeEach(() => {
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  window.CSS ??= {};
  window.CSS.highlights = new Map();
  window.Highlight = class {
    constructor(range) {
      this.range = range;
    }
  };
});

afterEach(() => {
  readAloudReset();
  delete window.speechSynthesis;
  delete window.SpeechSynthesisUtterance;
  delete window.iosNative;
  delete window.webkit;
  delete window.specdown;
  delete window.Highlight;
  delete window.CSS.highlights;
  jest.useRealTimers();
});

test('reads only the exact cross-block selection including repeated inline text', () => {
  pane().innerHTML =
    '<p>Stop <em>here</em>. Stop <b>here</b>.</p><p>Last line ends.</p>';
  const range = document.createRange();
  range.setStart(pane().querySelector('em').firstChild, 1);
  range.setEnd(pane().lastChild.firstChild, 4);
  const items = [...readAloudSentences(pane(), range)];
  expect(items.map((i) => i.text)).toEqual(['ere.', 'Stop here.', 'Last']);
  expect(items.map((i) => i.range.toString())).toEqual(
    items.map((i) => i.text)
  );
  expect(items[1].range.intersectsNode(pane().querySelector('b'))).toBe(true);
  expect(items[1].range.intersectsNode(pane().querySelector('em'))).toBe(false);
});

test('reads from the current visible section and announces a skippable block', async () => {
  pane().innerHTML =
    '<h1>First</h1><p>Before.</p><h2>Second</h2><pre><code>example()</code><button>Copy</button></pre><p>Next.</p>';
  const headings = pane().querySelectorAll('h1,h2');
  headings[0].getBoundingClientRect = () => ({ top: -100, height: 25 });
  headings[1].getBoundingClientRect = () => ({ top: -10, height: 25 });
  const synth = browserVoice();
  readAloudStart();
  const speak = () => synth.speak.mock.lastCall[0];
  expect(speak().text).toBe('Second');
  speak().onend();
  await flushSpeech();
  expect(speak().text).toBe('Code block.');
  speak().onstart();
  await flushSpeech();
  expect(pane().querySelector('pre').classList).toContain('read-aloud-block');
  strip().querySelector('[aria-label="Skip code block"]').click();
  expect(speak().text).toBe('Next.');
  expect(pane().querySelector('pre').classList).not.toContain(
    'read-aloud-block'
  );
  speak().onend();
  await flushSpeech();
  expect(strip()).toBeNull();
});

test('answer playback returns to the saved document occurrence and ignores stale events', async () => {
  pane().innerHTML = '<p>Repeat.</p><p>Repeat.</p>';
  const synth = browserVoice();
  const speak = () => synth.speak.mock.lastCall[0];
  readAloudStart();
  speak().onend();
  await flushSpeech();
  const staleEnd = speak().onend;
  const rail = document.getElementById('rail-playback-chip');
  expect(rail.hidden).toBe(true);
  readAloudListen('An answer.');
  staleEnd();
  await flushSpeech();
  expect(speak().text).toBe('An answer.');
  expect(document.getElementById('content-main').contains(strip())).toBe(true);
  expect(strip().querySelector('.sd-transport-meta').textContent).toBe(
    'Document paused at sentence 2'
  );
  speak().onend();
  await flushSpeech();
  expect(strip().querySelector('.primary').getAttribute('aria-label')).toBe(
    'Resume'
  );

  strip().querySelector('button').click();
  speak().onstart();
  await flushSpeech();
  expect(speak().text).toBe('Repeat.');
  expect(CSS.highlights.get('read-aloud-sentence').range.startContainer).toBe(
    pane().lastElementChild.firstChild
  );
  const lateStart = speak().onstart;
  invalidateDocumentContext();
  lateStart();
  await flushSpeech();
  expect(strip()).toBeNull();
  expect(CSS.highlights.size).toBe(0);
});

test('voice discovery waits for a local voice and handles interruptions and rate changes', async () => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  pane().innerHTML = '<p>Local reading.</p>';
  const synth = browserVoice([]);
  const speak = () => synth.speak.mock.lastCall[0];
  readAloudStart();
  expect(synth.speak).not.toHaveBeenCalled();
  const local = { localService: true, lang: 'en-US' };
  synth.getVoices.mockReturnValue([
    { localService: false, lang: 'en-US' },
    local,
  ]);
  synth.dispatchEvent(new Event('voiceschanged'));
  expect(speak().voice).toBe(local);
  speak().onpause();
  await flushSpeech();
  expect(strip().querySelector('.primary').getAttribute('aria-label')).toBe(
    'Resume'
  );
  strip().querySelector('button').click();
  const oldEnd = speak().onend;
  const rate = strip().querySelector('.read-aloud-rate');
  rate.click();
  rate.click();
  expect(speak().rate).toBe(1.5);
  oldEnd();
  await flushSpeech();
  expect(strip().querySelector('.primary').getAttribute('aria-label')).toBe(
    'Pause'
  );
});

test('a service-backed voice alone never receives text, and a silent engine times out', async () => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  pane().textContent = 'Private sentence.';
  const synth = browserVoice([{ localService: false, lang: 'en-US' }]);
  readAloudStart();
  jest.advanceTimersByTime(3000);
  await flushSpeech();
  expect(synth.speak).not.toHaveBeenCalled();
  expect(strip()).toBeNull();
  expect(document.querySelector('.toast-region').textContent).toContain(
    'Install an offline voice'
  );
  synth.getVoices.mockReturnValue([{ localService: true, lang: 'en-US' }]);
  readAloudStart();
  jest.advanceTimersByTime(6100);
  await flushSpeech();
  expect(synth.cancel).toHaveBeenCalledTimes(1);
  expect(strip()).toBeNull();
});

test('iOS uses matching native IDs and resumes an interrupted sentence with a fresh ID', async () => {
  pane().innerHTML = '<p>Read this.</p>';
  window.iosNative = true;
  const send = jest.fn();
  window.webkit = { messageHandlers: { specdown: { postMessage: send } } };
  readAloudStart();
  const { command } = send.mock.lastCall[0];
  expect(send.mock.lastCall[0].action).toBe('readerSpeech');
  window.specdownSpeechEvent({ ...command, sentenceId: 'stale', type: 'end' });
  window.specdownSpeechEvent({ ...command, type: 'interrupted' });
  await flushSpeech();
  expect(strip().querySelector('.primary').getAttribute('aria-label')).toBe(
    'Resume'
  );
  expect(send.mock.lastCall[0].command.action).toBe('stop');
  readAloudResume();
  expect(send.mock.lastCall[0].command).toMatchObject({
    action: 'speak',
    text: 'Read this.',
  });
  expect(send.mock.lastCall[0].command.sentenceId).not.toEqual(
    command.sentenceId
  );
});

test.each(['no voices', 'startup error', 'silent engine'])(
  'Windows uses its local host on %s, then keeps it for the session',
  async (failure) => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    pane().innerHTML = '<p>One. Two.</p>';
    const synth = browserVoice(failure === 'no voices' ? [] : undefined);
    let notify;
    const native = jest.fn(() => Promise.resolve(true));
    window.specdown = {
      platform: 'win32',
      readerSpeech: native,
      onReaderSpeechEvent(fn) {
        notify = fn;
        return () => {};
      },
    };
    readAloudStart();
    expect(native).not.toHaveBeenCalled();
    if (failure === 'startup error')
      synth.speak.mock.lastCall[0].onerror({ error: 'synthesis-failed' });
    else jest.advanceTimersByTime(failure === 'no voices' ? 2600 : 6100);
    await flushSpeech();
    expect(native.mock.lastCall[0]).toMatchObject({
      action: 'speak',
      text: 'One.',
    });
    notify({ ...native.mock.lastCall[0], type: 'end' });
    await flushSpeech();
    expect(native.mock.lastCall[0]).toMatchObject({
      action: 'speak',
      text: 'Two.',
    });
  }
);

test('bounded utterances retain Unicode across a very long sentence', () => {
  pane().textContent = 'z'.repeat(499) + '😀' + 'z'.repeat(800);
  const items = [...readAloudSentences(pane())];
  expect(items.map((i) => i.text).join('')).toBe(pane().textContent);
  expect(
    items.every((i) => i.text.length <= 500 && !/[\uD800-\uDBFF]$/.test(i.text))
  ).toBe(true);
});

test.each([
  ['switch tabs', () => createTab('Other.md', '<p>Other text.</p>')],
  ['edit source', () => startSourceEditing()],
  ['rerender', () => renderMarkdown('<p>Edited text.</p>', 'Read.md')],
])(
  '%s stops playback and rejects the old completion',
  async (_label, replace) => {
    createTab('Read.md', '<p>Active sentence. Next sentence.</p>');
    const synth = browserVoice();
    readAloudStart();
    const utterance = synth.speak.mock.lastCall[0];
    const oldEnd = utterance.onend;
    utterance.onstart();
    await flushSpeech();
    expect(CSS.highlights.size).toBe(1);
    replace();
    oldEnd();
    await flushSpeech();
    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(CSS.highlights.size).toBe(0);
    expect(strip()).toBeNull();
  }
);

test('replacing source text nodes during playback invalidates the retained range', async () => {
  const synth = browserVoice();
  pane().innerHTML = '<p>Current text. Following text.</p>';
  readAloudStart();
  const oldEnd = synth.speak.mock.lastCall[0].onend;
  pane()
    .querySelector('p')
    .firstChild.replaceWith(document.createTextNode('Changed.'));
  oldEnd();
  await flushSpeech();
  expect(strip()).toBeNull();
  expect(synth.speak).toHaveBeenCalledTimes(1);
});

test('a long document creates only the current sentence range at startup', () => {
  browserVoice();
  pane().textContent = 'One sentence. '.repeat(4000);
  const range = jest.spyOn(document, 'createRange');
  try {
    readAloudStart();
    expect(range).toHaveBeenCalledTimes(1);
  } finally {
    range.mockRestore();
  }
});

test('transport identifies the section, queue position and brand progress', async () => {
  pane().innerHTML = '<h2>Retry policy</h2><p>Try again. Stop here.</p>';
  const synth = browserVoice();
  readAloudToggle();
  expect(strip().closest('#content-main')).not.toBeNull();
  expect(strip().querySelector('.sd-transport-title').textContent).toBe(
    'Reading · Retry policy'
  );
  expect(strip().querySelector('.sd-transport-meta').textContent).toBe(
    'Sentence 1 of 3'
  );
  synth.speak.mock.lastCall[0].onend();
  await flushSpeech();
  expect(strip().querySelector('.sd-transport-meta').textContent).toBe(
    'Sentence 2 of 3'
  );
  expect(
    Number(
      document
        .getElementById('brand-bar')
        .style.getPropertyValue('--brand-reading-progress')
    )
  ).toBeCloseTo(2 / 3);
  readAloudToggle();
  expect(strip().querySelector('.primary').getAttribute('aria-label')).toBe(
    'Resume'
  );
  readAloudToggle();
  strip()
    .querySelector('.primary')
    .dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
  expect(strip()).toBeNull();
});

test('compact rail chip pauses, returns to the saved sentence, and yields to the floating bar on close', async () => {
  const original = window.matchMedia;
  window.matchMedia = () => ({ matches: true, addEventListener: () => {} });
  try {
    document.body.classList.add('side-rail-open');
    pane().textContent = 'Current sentence.';
    const synth = browserVoice();
    readAloudStart();
    const chip = document.getElementById('rail-playback-chip');
    expect(strip().hidden).toBe(true);
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toBe('Reading');
    chip.click();
    expect(chip.textContent).toBe('Paused');
    chip.click();
    readAloudListen('Answer.');
    synth.speak.mock.lastCall[0].onend();
    await flushSpeech();
    expect(chip.textContent).toBe('Resume document');
    chip.click();
    expect(synth.speak.mock.lastCall[0].text).toBe('Current sentence.');
    document.body.classList.remove('side-rail-open');
    document.dispatchEvent(new CustomEvent('specdown-rail-change'));
    expect(strip().hidden).toBe(false);
    expect(chip.hidden).toBe(true);
  } finally {
    document.body.classList.remove('side-rail-open');
    window.matchMedia = original;
  }
});

test('walkthrough labels track source steps even when a step spans several sentences', async () => {
  const synth = browserVoice();
  const events = [];
  const listener = (e) => events.push(e.detail.index);
  document.addEventListener('specdown-walkthrough-step', listener);
  try {
    readAloudWalkthrough(
      ['One.', 'Two. Still two.', 'Three.'],
      'Job sequence',
      1
    );
    expect(strip().querySelector('.sd-transport-title').textContent).toBe(
      'Walkthrough · Job sequence'
    );
    const speak = () => synth.speak.mock.lastCall[0];
    speak().onstart();
    await flushSpeech();
    expect(events).toEqual([1]);
    speak().onend();
    await flushSpeech();
    expect(strip().querySelector('.sd-transport-meta').textContent).toBe(
      'Step 2 of 3'
    );
    speak().onend();
    await flushSpeech();
    speak().onstart();
    await flushSpeech();
    expect(strip().querySelector('.sd-transport-meta').textContent).toBe(
      'Step 3 of 3'
    );
    readAloudStopWalkthrough();
    expect(events).toEqual([1, 2, null]);
  } finally {
    document.removeEventListener('specdown-walkthrough-step', listener);
  }
});

test('rate menu opens on context click and long press and supports keyboard selection', () => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  browserVoice();
  pane().textContent = 'Sentence.';
  readAloudStart();
  const rate = strip().querySelector('.read-aloud-rate');
  const menu = strip().querySelector('[role=menu]');
  rate.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
  );
  expect(menu.hidden).toBe(false);
  document.activeElement.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'End', bubbles: true })
  );
  document.activeElement.click();
  expect(rate.textContent).toBe('2×');
  rate.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
  jest.advanceTimersByTime(510);
  rate.dispatchEvent(new MouseEvent('pointerup'));
  rate.click();
  expect(menu.hidden).toBe(false);
  expect(rate.textContent).toBe('2×');
});

test('manual scrolling suspends sentence centering for four seconds', async () => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  const synth = browserVoice();
  pane().textContent = 'One. Two.';
  pane().getBoundingClientRect = () => ({
    top: 0,
    bottom: 300,
    left: 0,
    right: 600,
    height: 300,
    width: 600,
  });
  const old = Range.prototype.getBoundingClientRect;
  Range.prototype.getBoundingClientRect = () => ({ top: 500, height: 20 });
  try {
    readAloudStart();
    synth.speak.mock.lastCall[0].onstart();
    await flushSpeech();
    expect(pane().scrollTop).toBe(360);
    pane().dispatchEvent(new Event('wheel'));
    pane().scrollTop = 100;
    synth.speak.mock.lastCall[0].onend();
    await flushSpeech();
    synth.speak.mock.lastCall[0].onstart();
    await flushSpeech();
    jest.advanceTimersByTime(3999);
    expect(pane().scrollTop).toBe(100);
    jest.advanceTimersByTime(1);
    expect(pane().scrollTop).toBe(460);
  } finally {
    if (old) Range.prototype.getBoundingClientRect = old;
    else delete Range.prototype.getBoundingClientRect;
  }
});

test.each([
  [
    'no-voice',
    'Read aloud needs a voice. Add one in System Settings → Accessibility → Spoken Content.',
  ],
  [
    undefined,
    'Speech could not start. Check your system voice settings and try again.',
  ],
])(
  'Mac speech error reason %s shows matching guidance and dismisses the transport',
  async (reason, message) => {
    pane().textContent = 'Hello.';
    let notify;
    const native = jest.fn(() => Promise.resolve(true));
    window.specdown = {
      platform: 'darwin',
      readerSpeech: native,
      onReaderSpeechEvent(fn) {
        notify = fn;
        return () => {};
      },
    };
    readAloudStart();
    notify({ ...native.mock.lastCall[0], type: 'error', reason });
    await flushSpeech();
    expect(document.querySelector('.toast-region').textContent).toBe(message);
    expect(strip()).toBeNull();
  }
);
