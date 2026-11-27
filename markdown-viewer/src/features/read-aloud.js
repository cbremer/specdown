import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
import { speakReaderUtterance } from '../platform/speech.js';
import { showToast } from './toast.js';
// @ts-expect-error -- Vite stylesheet import
import './read-aloud.css';

/** @typedef {{text:string, range:Range|null, block?:Element}} ReadAloudSentence */
/** @typedef {{sessionId:string, queue:Iterator<ReadAloudSentence>, sentence:ReadAloudSentence, kind:'document'|'answer', paused:boolean, opener:HTMLElement|null, context:ReturnType<typeof captureDocumentContext>}} ReadAloudSession */
/** @typedef {{node:Text, offset:number, start:number, end:number}} NarrationSpan */

/** @type {ReadAloudSession|null} */
let readerSession = null;
/** @type {ReadAloudSession|null} */
let readerSavedDocument = null;
let readerSerial = 0;
let readerAttempt = 0;
let readerRate = 1;
let readerCancel = () => {};
/** @type {HTMLElement|null} */
let readerControlsHost = null;
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
 * @param {HTMLElement} root @param {Range|null} selection
 * @returns {Generator<ReadAloudSentence>}
 */
function* readAloudSentences(root, selection = null) {
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
      const range = document.createRange();
      range.setStart(
        first.node,
        first.offset + Math.max(0, start - first.start)
      );
      range.setEnd(
        last.node,
        last.offset + Math.min(last.end - last.start, end - last.start)
      );
      yield { text: buffer.slice(start, end), range };
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
    const diagram =
      node.classList.contains('diagram-container') ||
      (node.tagName === 'PRE' && !!node.querySelector('code.language-mermaid'));
    if (diagram || (node.tagName === 'PRE' && !selected)) {
      yield* flush();
      if (reached) {
        const range = document.createRange();
        range.selectNodeContents(node);
        yield {
          text: diagram ? 'Diagram.' : 'Code block.',
          range,
          block: node,
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
    CSS.highlights.set('read-aloud-sentence', new Highlight(range));
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
  const hadFocus = readerControls?.bar.contains(document.activeElement);
  const opener = readerSession?.opener;
  readerCancelSentence();
  readerSession = readerSavedDocument;
  readerSavedDocument = null;
  readerWatchContent();
  readerUpdateControls();
  if (restoreFocus && !readerSession && hadFocus) {
    const target =
      opener?.isConnected &&
      !opener.closest('[hidden], [inert]') &&
      opener !== document.body
        ? opener
        : readerControlsHost?.closest('aside')?.querySelector('button') ||
          document.getElementById('markdown-content');
    target?.focus({ preventScroll: true });
  }
}

function readerPlay() {
  readerCancelSentence();
  const session = readerSession;
  if (!session || !readerContextIsCurrent()) return readAloudReset();
  const sentence = session.sentence;
  session.paused = false;
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
        if (type === 'start') readerHighlight(sentence);
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
  readerPlay();
}

/** @param {Iterator<ReadAloudSentence>} queue @param {'document'|'answer'} kind */
function readerBegin(queue, kind) {
  const first = queue.next();
  if (first.done) {
    showToast('There is no text to read here.');
    return;
  }
  if (kind === 'answer' && readerSession?.kind === 'document') {
    readerSession.paused = true;
    readerSavedDocument = readerSession;
  }
  if (kind === 'document') readerSavedDocument = null;
  readerSession = {
    sessionId: 'read-' + Date.now().toString(36) + '-' + ++readerSerial,
    opener:
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    sentence: first.value,
    queue,
    kind,
    paused: false,
    context: captureDocumentContext(),
  };
  readerWatchContent();
  readerPlay();
}

/** @param {Range|null} [range] */
export function readAloudStart(range = null) {
  const root = document.getElementById('markdown-content');
  if (root) readerBegin(readAloudSentences(root, range), 'document');
}

/** @param {string} text */
export function readAloudListen(text) {
  function* sentences() {
    for (const [start, end] of readerSentenceOffsets(text))
      yield { text: text.slice(start, end), range: null };
  }
  readerBegin(sentences(), 'answer');
}

export function readAloudPause() {
  if (!readerSession || readerSession.paused) return;
  readerSession.paused = true;
  readerCancelSentence();
  readerUpdateControls();
}

export function readAloudResume() {
  if (readerSession?.paused) readerPlay();
}

export function readAloudStop() {
  readerFinish();
}

/** Called synchronously before any change of document or preview revision. */
export function readAloudReset() {
  readerSavedDocument = null;
  readerFinish(false);
}

/** @param {HTMLElement|null} slot */
export function readAloudMountControls(slot) {
  readerControlsHost = slot;
  readerUpdateControls();
}

function readerCreateControls() {
  const bar = document.createElement('div');
  bar.className = 'read-aloud-controls';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Read aloud');
  const label = document.createElement('span');
  label.className = 'read-aloud-label';
  label.setAttribute('role', 'status');
  /** @param {string} text @param {()=>void} action */
  function button(text, action) {
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = text;
    control.addEventListener('click', action);
    return control;
  }
  const pause = button('Pause', () =>
    readerSession?.paused ? readAloudResume() : readAloudPause()
  );
  const skip = button('Skip block', readerAdvance);
  const stop = button('Stop', readAloudStop);
  const rate = document.createElement('select');
  rate.setAttribute('aria-label', 'Reading speed');
  for (const speed of [0.75, 1, 1.25, 1.5, 2])
    rate.add(new Option(speed + '×', String(speed)));
  rate.value = String(readerRate);
  rate.addEventListener('change', () => {
    readerRate = Number(rate.value);
    if (readerSession && !readerSession.paused) readerPlay();
  });
  bar.append(label, pause, skip, stop, rate);
  return { bar, label, pause, skip };
}

function readerUpdateControls() {
  if (!readerSession) {
    readerControls?.bar.remove();
    readerControls = null;
    return;
  }
  readerControls ??= readerCreateControls();
  const { bar, label, pause, skip } = readerControls;
  const host = readerControlsHost?.isConnected
    ? readerControlsHost
    : document.getElementById('content-area');
  if (host && bar.parentElement !== host)
    host.insertBefore(bar, host.querySelector(':scope > .content-body'));
  const documentSession = readerSession.kind === 'document';
  const status = readerSession.paused
    ? 'Paused'
    : documentSession
      ? 'Reading document'
      : 'Reading explanation';
  if (label.textContent !== status) label.textContent = status;
  pause.textContent = readerSession.paused
    ? documentSession
      ? 'Resume document'
      : 'Resume'
    : 'Pause';
  skip.hidden = !readerSession.sentence.block;
}
