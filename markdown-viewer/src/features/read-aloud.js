import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
import { iconSvg } from '../core/icons.js';
import { setBrandNarrationProgress } from '../core/brand-moments.js';
import { speakReaderUtterance } from '../platform/speech.js';
import { showToast } from './toast.js';
// @ts-expect-error -- Vite stylesheet import
import './read-aloud.css';

/** @typedef {{text:string, range:Range|null, block?:Element, section?:string, step?:number}} ReadAloudSentence */
/** @typedef {{sessionId:string, queue:Iterator<ReadAloudSentence>, sentence:ReadAloudSentence, kind:'document'|'answer'|'walkthrough', position:number, total:number|null, title:string, returning:boolean, paused:boolean, opener:HTMLElement|null, context:ReturnType<typeof captureDocumentContext>}} ReadAloudSession */
/** @typedef {{node:Text, offset:number, start:number, end:number}} NarrationSpan */

/** @type {ReadAloudSession|null} */
let readerSession = null;
/** @type {ReadAloudSession|null} */
let readerSavedDocument = null;
let readerSerial = 0;
let readerAttempt = 0;
let readerRate = 1;
/** @type {number|null} */
let readerWalkthroughIndex = null;

/** The rail highlights a source step only while that step is being spoken.
 * A step may contain several sentences. @param {number|null} index */
function readerAnnounceStep(index) {
  if (readerWalkthroughIndex === index) return;
  readerWalkthroughIndex = index;
  document.dispatchEvent(
    new CustomEvent('specdown-walkthrough-step', { detail: { index } })
  );
}
let readerCancel = () => {};
let readerScrollGraceUntil = 0;
let readerFollowTimer = 0;
let readerExpectedScroll = NaN;
/** @type {ReturnType<typeof readerCreateControls>|null} */
let readerControls = null;
let readerClearHighlight = () => {};
/** @type {MutationObserver|null} */
let readerContentObserver = null;

// Keep native IPC and individual speech-engine requests bounded. Offsets
// remain UTF-16 offsets throughout, as required by DOM Range.
const readerUtteranceLimit = 500;
const readerSegmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'sentence' })
    : null;

/** @param {string} text @returns {Generator<{index:number,segment:string}>} */
function* readerSegments(text) {
  if (readerSegmenter) yield* readerSegmenter.segment(text);
  else {
    for (const match of text.matchAll(
      /[^.!?。！？]+[.!?。！？]*|[.!?。！？]+/gu
    ))
      yield { index: match.index, segment: match[0] };
  }
}

/** @param {string} text @returns {Generator<[number,number]>} */
function* readerSentenceOffsets(text) {
  for (const part of readerSegments(text)) {
    const end = part.index + part.segment.length;
    let start = part.index;
    while (start < end) {
      let stop = Math.min(end, start + readerUtteranceLimit);
      if (stop < end) {
        const lastBreak = text.slice(start, stop).search(/\s+\S*$/u);
        if (lastBreak > 0) stop = start + lastBreak;
        else if (/[\uDC00-\uDFFF]/.test(text.charAt(stop))) stop--;
      }
      const raw = text.slice(start, stop);
      const trimmed = raw.trim();
      if (trimmed) {
        const offset = start + raw.indexOf(trimmed);
        yield [offset, offset + trimmed.length];
      }
      start = stop;
    }
  }
}

/** Traverse one rendered block at a time. Long documents allocate ranges
 * only as they are spoken. Retain the iterator and current sentence on pause.
 * @param {HTMLElement} root @param {Range|null} selection @param {boolean} [measure]
 * @returns {Generator<ReadAloudSentence>}
 */
function* readAloudSentences(root, selection = null, measure = false) {
  const selected =
    selection &&
    !selection.collapsed &&
    root.contains(selection.commonAncestorContainer)
      ? selection
      : null;
  const top = root.getBoundingClientRect().top;
  /** @type {Element|undefined} */
  let fromHeading;
  if (!selected) {
    for (const heading of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
      // With no layout (e.g. a hidden pane), start at the beginning.
      const rect = heading.getBoundingClientRect();
      if (!rect.height || rect.top > top + 1) break;
      fromHeading = heading;
    }
  }
  let section = '';
  if (selected) {
    for (const heading of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
      if (selected.comparePoint(heading, 0) > 0) break;
      if (
        selected.comparePoint(heading, 0) < 0 ||
        heading.contains(selected.startContainer)
      )
        section = heading.textContent?.trim() || section;
    }
  }
  let reached = !fromHeading;
  let buffer = '';
  /** @type {NarrationSpan[]} */
  let spans = [];
  /** @returns {Generator<ReadAloudSentence>} */
  function* flush() {
    let cursor = 0;
    for (const [start, end] of readerSentenceOffsets(buffer)) {
      while (spans[cursor]?.end <= start) cursor++;
      const first = spans[cursor];
      while (spans[cursor]?.end < end) cursor++;
      const last = spans[cursor];
      if (!first || !last) continue;
      if (measure) {
        yield { text: '', range: null };
        continue;
      }
      const range = document.createRange();
      range.setStart(
        first.node,
        first.offset + Math.max(0, start - first.start)
      );
      range.setEnd(
        last.node,
        last.offset + Math.min(last.end - last.start, end - last.start)
      );
      yield { text: buffer.slice(start, end), range, section };
    }
    buffer = '';
    spans = [];
  }
  /** @param {Node} node @returns {Generator<ReadAloudSentence>} */
  function* visit(node) {
    if (selected && !selected.intersectsNode(node)) return;
    if (node instanceof Text) {
      if (!reached) return;
      const start =
        selected?.startContainer === node ? selected.startOffset : 0;
      const end =
        selected?.endContainer === node ? selected.endOffset : node.length;
      if (end > start) {
        const offset = buffer.length;
        buffer += node.data.slice(start, end);
        spans.push({ node, offset: start, start: offset, end: buffer.length });
      }
      return;
    }
    if (
      !(node instanceof Element) ||
      node.matches(
        'script,style,textarea,input,button,select,svg,[hidden],[aria-hidden="true"],.mermaid-error,.comments-hidden .html-comment-block'
      )
    )
      return;
    if (node === fromHeading) reached = true;
    if (node.matches('h1,h2,h3,h4,h5,h6'))
      section = node.textContent?.trim() || section;
    const diagram =
      node.classList.contains('diagram-container') ||
      (node.tagName === 'PRE' && !!node.querySelector('code.language-mermaid'));
    if (diagram || (node.tagName === 'PRE' && !selected)) {
      yield* flush();
      if (reached) {
        const range = measure ? null : document.createRange();
        range?.selectNodeContents(node);
        yield {
          text: diagram ? 'Diagram.' : 'Code block.',
          range,
          block: node,
          section,
        };
      }
      return;
    }
    if (node.tagName === 'BR') {
      buffer += ' ';
      return;
    }
    const block = node.matches(
      'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,div,td,th,dt,dd,figcaption,section,article'
    );
    if (block && buffer) yield* flush();
    for (const child of node.childNodes) yield* visit(child);
    if (block && buffer) yield* flush();
  }
  yield* visit(root);
  yield* flush();
}

/** Paint text without splitting its text nodes. Older WebViews lacking
 * Custom Highlights draw clipped rectangles without disturbing selection.
 * @param {ReadAloudSentence} item
 */
function readerHighlight(item) {
  readerClearHighlight();
  readerClearHighlight = () => {};
  if (item.block) {
    item.block.classList.add('read-aloud-block');
    readerClearHighlight = () =>
      item.block?.classList.remove('read-aloud-block');
    return;
  }
  const range = item.range;
  if (!range) return;
  if (window.CSS?.highlights && window.Highlight) {
    const mark = new Highlight(range);
    // Keep the spoken sentence visible inside the rail's broader scope mark.
    mark.priority = 1;
    CSS.highlights.set('read-aloud-sentence', mark);
    readerClearHighlight = () => CSS.highlights.delete('read-aloud-sentence');
    return;
  }
  const root = document.getElementById('markdown-content');
  if (!root || !range.getClientRects) return;
  const overlay = document.createElement('div');
  overlay.className = 'read-aloud-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);
  const paint = () => {
    overlay.replaceChildren();
    const pane = root.getBoundingClientRect();
    for (const rect of range.getClientRects()) {
      const left = Math.max(pane.left, rect.left);
      const top = Math.max(pane.top, rect.top);
      const width = Math.min(pane.right, rect.right) - left;
      const height = Math.min(pane.bottom, rect.bottom) - top;
      if (width <= 0 || height <= 0) continue;
      const mark = document.createElement('span');
      mark.className = 'read-aloud-sentence';
      Object.assign(mark.style, {
        left: left + 'px',
        top: top + 'px',
        width: width + 'px',
        height: height + 'px',
      });
      overlay.append(mark);
    }
  };
  paint();
  window.addEventListener('scroll', paint, true);
  window.addEventListener('resize', paint);
  readerClearHighlight = () => {
    overlay.remove();
    window.removeEventListener('scroll', paint, true);
    window.removeEventListener('resize', paint);
  };
}

/** @param {ReadAloudSentence} sentence */
function readerFollowSentence(sentence) {
  if (Date.now() < readerScrollGraceUntil || readerControls?.bar.hidden) return;
  const root = readerSession?.context.root;
  const box =
    sentence.block?.getBoundingClientRect() ||
    sentence.range?.getBoundingClientRect?.();
  if (!root || !box?.height) return;
  const pane = root.getBoundingClientRect();
  const height = pane.height - (readerControls?.bar.offsetHeight || 0);
  if (height <= 0) return;
  const center = box.top + Math.min(box.height, height / 3) / 2 - pane.top;
  if (center < height / 3 || center > (height * 2) / 3) {
    root.scrollTop += center - height / 2;
    readerExpectedScroll = root.scrollTop;
  }
}

function readerPauseFollowing() {
  readerScrollGraceUntil = Date.now() + 4000;
  window.clearTimeout(readerFollowTimer);
  readerFollowTimer = window.setTimeout(() => {
    if (readerSession && !readerSession.paused)
      readerFollowSentence(readerSession.sentence);
  }, 4000);
}

function readerCancelSentence() {
  readerAttempt++;
  readerCancel();
  readerCancel = () => {};
  readerClearHighlight();
  readerClearHighlight = () => {};
}

/** Search and diagram enhancement can replace rendered text within the
 * same revision. Its old text nodes no longer identify sentence boundaries.
 * @param {MutationRecord[]} records
 */
function readerTextReplaced(records) {
  return records.some(
    (record) =>
      (record.type === 'characterData' &&
        record.target.nodeValue !== record.oldValue) ||
      record.removedNodes.length > 0
  );
}

function readerWatchContent() {
  readerContentObserver?.disconnect();
  readerContentObserver = null;
  const root = readerSession?.context.root;
  if (!root || (readerSession?.kind !== 'document' && !readerSavedDocument))
    return;
  readerContentObserver = new MutationObserver((records) => {
    if (readerTextReplaced(records)) readAloudReset();
  });
  readerContentObserver.observe(root, {
    subtree: true,
    childList: true,
    characterDataOldValue: true,
  });
}

function readerContextIsCurrent() {
  return (
    readerSession &&
    isDocumentContextCurrent(readerSession.context) &&
    !readerTextReplaced(readerContentObserver?.takeRecords() || [])
  );
}

/** @param {boolean} [restoreFocus] */
function readerFinish(restoreFocus = true) {
  readerAnnounceStep(null);
  const chipFocused =
    !!readerControls?.chip && readerControls.chip === document.activeElement;
  const hadFocus =
    chipFocused || readerControls?.bar.contains(document.activeElement);
  const opener = readerSession?.opener;
  readerCancelSentence();
  readerSession = readerSavedDocument;
  if (readerSession) readerSession.returning = true;
  readerSavedDocument = null;
  readerWatchContent();
  readerUpdateControls();
  if (restoreFocus && !readerSession && hadFocus) {
    const target =
      opener?.isConnected &&
      !opener.closest('[hidden], [inert]') &&
      opener !== document.body
        ? opener
        : document.getElementById('markdown-content');
    const railTab = chipFocused
      ? document.querySelector('.sd-rail [role="tab"][aria-selected="true"]')
      : null;
    (railTab instanceof HTMLElement ? railTab : target)?.focus({
      preventScroll: true,
    });
  }
}

function readerPlay() {
  readerCancelSentence();
  const session = readerSession;
  if (!session || !readerContextIsCurrent()) return readAloudReset();
  const sentence = session.sentence;
  session.paused = false;
  session.returning = false;
  readerUpdateControls();
  const attempt = readerAttempt;
  readerCancel = speakReaderUtterance(
    {
      sessionId: session.sessionId,
      sentenceId: String(attempt),
      text: sentence.text,
      rate: readerRate,
    },
    (type, message) =>
      queueMicrotask(() => {
        // Errors and voice discovery can be synchronous. Defer event delivery
        // until the disposer for this exact utterance has been installed.
        if (attempt !== readerAttempt || session !== readerSession) return;
        if (!readerContextIsCurrent()) return readAloudReset();
        if (type === 'start') {
          readerAnnounceStep(sentence.step ? sentence.step - 1 : null);
          readerHighlight(sentence);
          readerFollowSentence(sentence);
        }
        if (type === 'end') readerAdvance();
        if (type === 'interrupted') readAloudPause();
        if (type === 'error') {
          readerFinish();
          showToast(
            message || 'Check your system voice settings and try again.',
            { type: 'warning', duration: 8000 }
          );
        }
      })
  );
}

function readerAdvance() {
  if (!readerSession) return;
  if (!readerContextIsCurrent()) return readAloudReset();
  const next = readerSession.queue.next();
  if (next.done) return readerFinish();
  readerSession.sentence = next.value;
  readerSession.position++;
  readerPlay();
}

/** @param {Iterator<ReadAloudSentence>} queue @param {ReadAloudSession['kind']} kind
 * @param {string} [title] @param {number|null} [total] */
function readerBegin(queue, kind, title = '', total = null) {
  const first = queue.next();
  if (first.done) {
    showToast('There is no text to read here.');
    return;
  }
  readerAnnounceStep(null);
  if (kind !== 'document' && readerSession?.kind === 'document') {
    readerSession.paused = true;
    readerSavedDocument = readerSession;
  }
  if (kind === 'document') {
    readerSavedDocument = null;
    readerScrollGraceUntil = 0;
    window.clearTimeout(readerFollowTimer);
  }
  /** @type {ReadAloudSession} */
  const session = {
    sessionId: 'read-' + Date.now().toString(36) + '-' + ++readerSerial,
    opener:
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    sentence: first.value,
    queue,
    kind,
    title,
    total,
    position: 1,
    returning: false,
    paused: false,
    context: captureDocumentContext(),
  };
  readerSession = session;
  readerWatchContent();
  readerPlay();
  return session;
}

/** Count in short slices. Speech can begin immediately, even on a large
 * document. Counting does not allocate DOM ranges. @param {ReadAloudSession} session
 * @param {Iterator<ReadAloudSentence>} items */
function readerCountSentences(session, items) {
  let count = 0;
  function batch() {
    if (session !== readerSession && session !== readerSavedDocument) return;
    for (let i = 0; i < 128; i++) {
      if (items.next().done) {
        session.total = count;
        readerUpdateControls();
        return;
      }
      count++;
    }
    window.setTimeout(batch, 0);
  }
  batch();
}

/** @param {Range|null} [range] */
export function readAloudStart(range = null) {
  const root = document.getElementById('markdown-content');
  if (!root) return;
  const session = readerBegin(
    readAloudSentences(root, range),
    'document',
    range ? 'Selection' : 'Document'
  );
  if (session)
    readerCountSentences(session, readAloudSentences(root, range, true));
}

/** @param {Range|null} [range] */
export function readAloudToggle(range = null) {
  if (!readerSession) readAloudStart(range);
  else if (readerSession.paused) readAloudResume();
  else readAloudPause();
}

/** @param {string} text @param {number} [step] */
function* readerTextQueue(text, step) {
  for (const [start, end] of readerSentenceOffsets(text))
    yield { text: text.slice(start, end), range: null, step };
}

/** @param {string} text */
export function readAloudListen(text) {
  const session = readerBegin(readerTextQueue(text), 'answer');
  if (session) readerCountSentences(session, readerTextQueue(text));
}

/** @param {string[]} steps @param {string} [title] @param {number} [startIndex] */
export function readAloudWalkthrough(steps, title = 'Diagram', startIndex = 0) {
  function* queue() {
    for (let i = Math.max(0, startIndex); i < steps.length; i++)
      yield* readerTextQueue(steps[i], i + 1);
  }
  readerBegin(queue(), 'walkthrough', title, steps.length);
}

export function readAloudPause() {
  if (!readerSession || readerSession.paused) return;
  readerSession.paused = true;
  readerAnnounceStep(null);
  readerCancelSentence();
  readerUpdateControls();
}

export function readAloudResume() {
  if (readerSession?.paused) readerPlay();
}

export function readAloudStopWalkthrough() {
  if (readerSession?.kind === 'walkthrough') readAloudStop();
}

export function readAloudStop() {
  readerFinish();
}

/** Called synchronously before any change of document or preview revision. */
export function readAloudReset() {
  readerSavedDocument = null;
  readerFinish(false);
}

/** Restore the saved document immediately, even mid-answer. */
function readerResumeDocument() {
  if (readerSavedDocument) readerFinish(false);
  readAloudResume();
}

function readerCreateControls() {
  const anchor = document.createElement('div');
  anchor.className = 'read-aloud-anchor';
  const bar = document.createElement('div');
  bar.className = 'sd-transport';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Read aloud');
  const abort = new AbortController();
  const options = { signal: abort.signal };
  /** @param {string} label @param {string} style @param {()=>void} fn */
  function button(label, style, fn) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = style;
    el.textContent = label;
    el.addEventListener('click', fn, options);
    return el;
  }
  const pause = button('Pause', 'sd-transport-button primary', () =>
    readAloudToggle()
  );
  const stop = button('Stop', 'sd-transport-button', readAloudStop);
  stop.innerHTML = iconSvg('stop');
  stop.setAttribute('aria-label', 'Stop');
  stop.title = 'Stop';
  const divider = document.createElement('span');
  divider.className = 'sd-transport-divider';
  const label = document.createElement('div');
  label.className = 'sd-transport-label';
  const title = document.createElement('span');
  title.className = 'sd-transport-title';
  title.setAttribute('role', 'status');
  const meta = document.createElement('span');
  meta.className = 'sd-transport-meta';
  label.append(title, meta);
  const skip = button('Skip', 'sd-transport-pill', readerAdvance);
  const resume = button(
    'Resume document',
    'sd-transport-pill',
    readerResumeDocument
  );
  const speeds = [0.75, 1, 1.25, 1.5, 2];
  const rate = button('', 'sd-transport-pill read-aloud-rate', () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    setRate(speeds[(speeds.indexOf(readerRate) + 1) % speeds.length]);
  });
  const menu = document.createElement('div');
  menu.className = 'read-aloud-rate-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Playback rate');
  rate.setAttribute('aria-haspopup', 'menu');
  rate.setAttribute('aria-expanded', 'false');
  function closeMenu() {
    menu.hidden = true;
    rate.setAttribute('aria-expanded', 'false');
  }
  function showMenu() {
    menu.hidden = false;
    rate.setAttribute('aria-expanded', 'true');
    const selected = menu.querySelector('[aria-checked="true"]');
    if (selected instanceof HTMLButtonElement)
      selected.focus({ preventScroll: true });
  }
  /** @param {number} speed */
  function setRate(speed) {
    readerRate = speed;
    closeMenu();
    if (readerSession && !readerSession.paused) readerPlay();
    else readerUpdateControls();
  }
  for (const speed of speeds) {
    const option = button(speed + '×', 'sd-transport-pill', () => {
      setRate(speed);
      rate.focus({ preventScroll: true });
    });
    option.setAttribute('role', 'menuitemradio');
    option.dataset.speed = String(speed);
    menu.append(option);
  }
  let pressTimer = 0;
  let suppressClick = false;
  rate.addEventListener(
    'pointerdown',
    (e) => {
      suppressClick = false;
      if (e.button === 0)
        pressTimer = window.setTimeout(() => {
          suppressClick = true;
          showMenu();
        }, 500);
    },
    options
  );
  for (const event of ['pointerup', 'pointercancel', 'pointerleave'])
    rate.addEventListener(event, () => clearTimeout(pressTimer), options);
  rate.addEventListener(
    'contextmenu',
    (e) => {
      e.preventDefault();
      clearTimeout(pressTimer);
      showMenu();
    },
    options
  );
  rate.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        showMenu();
      }
    },
    options
  );
  menu.addEventListener(
    'keydown',
    (e) => {
      const buttons = Array.from(menu.querySelectorAll('button'));
      const index = buttons.indexOf(
        /** @type {HTMLButtonElement} */ (document.activeElement)
      );
      const next = {
        ArrowDown: (index + 1) % buttons.length,
        ArrowUp: (index - 1 + buttons.length) % buttons.length,
        Home: 0,
        End: buttons.length - 1,
      }[e.key];
      if (next !== undefined) {
        e.preventDefault();
        buttons[next].focus();
      }
    },
    options
  );
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.target instanceof Node && !bar.contains(e.target)) closeMenu();
    },
    options
  );
  bar.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        readAloudStop();
      }
    },
    options
  );
  bar.append(pause, stop, divider, label, skip, resume, rate, menu);
  anchor.append(bar);
  const host = document.getElementById('content-main');
  const pane = document.getElementById('markdown-content');
  const actionBar = document.getElementById('ios-action-bar');
  host?.append(anchor);
  const compact = window.matchMedia?.('(max-width: 699.98px)');
  const chip = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('rail-playback-chip')
  );
  chip?.addEventListener('click', () => readAloudToggle(), options);
  function layout() {
    const compactRail =
      !!compact?.matches && document.body.classList.contains('side-rail-open');
    if (chip) chip.hidden = !compactRail;
    bar.hidden = compactRail;
    if (compactRail || !host || !pane) return;
    // The preview can share content-main with a horizontal or vertical raw pane.
    const parent = host.getBoundingClientRect(),
      rect = pane.getBoundingClientRect();
    const actionTop = actionBar?.getClientRects().length
      ? actionBar.getBoundingClientRect().top
      : Infinity;
    Object.assign(anchor.style, {
      left: rect.left - parent.left + 'px',
      top: rect.top - parent.top + 'px',
      width: rect.width + 'px',
      height: Math.max(0, Math.min(rect.bottom, actionTop) - rect.top) + 'px',
    });
  }
  compact?.addEventListener?.('change', layout, options);
  document.addEventListener('specdown-rail-change', layout, options);
  window.addEventListener('resize', layout, options);
  const observer =
    typeof ResizeObserver === 'function' ? new ResizeObserver(layout) : null;
  for (const el of [pane, host, actionBar]) if (el) observer?.observe(el);
  const passive = { ...options, passive: true };
  pane?.addEventListener('wheel', readerPauseFollowing, passive);
  pane?.addEventListener('touchmove', readerPauseFollowing, passive);
  pane?.addEventListener(
    'scroll',
    () => {
      if (pane.scrollTop !== readerExpectedScroll) readerPauseFollowing();
      readerExpectedScroll = NaN;
    },
    passive
  );
  layout();
  return {
    bar,
    pause,
    title,
    meta,
    skip,
    resume,
    rate,
    menu,
    chip,
    destroy() {
      clearTimeout(pressTimer);
      clearTimeout(readerFollowTimer);
      observer?.disconnect();
      abort.abort();
      if (chip) chip.hidden = true;
      anchor.remove();
    },
  };
}

function readerUpdateControls() {
  if (!readerSession) {
    readerControls?.destroy();
    readerControls = null;
    setBrandNarrationProgress(null);
    return;
  }
  const session = readerSession;
  readerControls ??= readerCreateControls();
  const { pause, title, meta, skip, resume, rate, menu, chip } = readerControls;
  const verb = session.paused ? 'Resume' : 'Pause';
  if (pause.getAttribute('aria-label') !== verb) {
    pause.innerHTML = iconSvg(session.paused ? 'play' : 'pause');
    pause.setAttribute('aria-label', verb);
    pause.title = verb;
  }
  const block = session.sentence.block;
  const n = session.sentence.step || session.position;
  const indexText = String(n) + (session.total ? ' of ' + session.total : '');
  let heading =
    (session.paused ? 'Paused · ' : 'Reading · ') +
    (session.sentence.section || session.title);
  let detail = 'Sentence ' + indexText;
  if (session.kind === 'answer') {
    heading = session.paused ? 'Answer · Paused' : 'Answer · Listening';
    if (readerSavedDocument)
      detail = 'Document paused at sentence ' + readerSavedDocument.position;
  } else if (session.kind === 'walkthrough') {
    heading = 'Walkthrough · ' + session.title;
    detail = 'Step ' + indexText;
  } else if (block) {
    heading = session.sentence.section || session.title;
    detail =
      session.sentence.text === 'Diagram.'
        ? 'Next: diagram'
        : 'Next: code block';
  }
  if (title.textContent !== heading) title.textContent = heading;
  meta.textContent = detail;
  skip.hidden = !block;
  skip.setAttribute(
    'aria-label',
    session.sentence.text === 'Diagram.' ? 'Skip diagram' : 'Skip code block'
  );
  resume.hidden = !readerSavedDocument && !session.returning;
  rate.textContent = readerRate + '×';
  rate.setAttribute('aria-label', 'Playback rate, ' + readerRate + '×');
  rate.title = 'Cycle playback rate. Right-click or hold to choose.';
  for (const choice of menu.querySelectorAll('button'))
    choice.setAttribute(
      'aria-checked',
      String(Number(choice.dataset.speed) === readerRate)
    );
  if (chip) {
    const text = session.returning
      ? 'Resume document'
      : session.paused
        ? 'Paused'
        : 'Reading';
    chip.innerHTML = iconSvg(session.paused ? 'play' : 'pause');
    chip.append(document.createTextNode(text));
    chip.setAttribute(
      'aria-label',
      session.returning
        ? 'Resume document'
        : (session.paused ? 'Resume' : 'Pause') + ' reading'
    );
  }
  setBrandNarrationProgress(
    session.total ? Math.min(1, n / session.total) : null
  );
}
