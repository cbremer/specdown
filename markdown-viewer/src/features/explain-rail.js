// The DOM and conversation belong to one captured document revision. Closing the
// panel hides that session; resetExplainRail disposes it at the render boundary.
import { canRestoreNonEditableFocus } from '../core/focus-trap.js';
import {
  askExplain,
  explainAvailable,
  explainUnavailableReason,
} from '../platform/explain-provider.js';
import { captureExplainScopes, closeExplainSource } from './explain-source.js';
import { readAloudListen, readAloudMountControls } from './read-aloud.js';
// @ts-expect-error -- Vite stylesheet import
import './explain-rail.css';

/** @typedef {ReturnType<typeof captureExplainScopes>[number]} ExplainRailScope */
/** @typedef {{role:'user'|'assistant', text:string}} ExplainRailMessage */
/** @type {ReturnType<typeof createExplainRail> | null} */
let explainRailSession = null;

/** @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag @param {string} [text] @returns {HTMLElementTagNameMap[K]} */
function explainElement(tag, text = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

/** @param {string} label @param {() => void} action */
function explainButton(label, action) {
  const button = explainElement('button', label);
  button.type = 'button';
  button.className = 'source-control';
  button.addEventListener('click', action);
  return button;
}

/** @param {ExplainRailScope[]} scopes @param {HTMLElement} host @param {HTMLElement} reader */
function createExplainRail(scopes, host, reader) {
  const panel = explainElement('aside');
  panel.id = 'explain-rail';
  panel.setAttribute('aria-labelledby', 'explain-title');
  panel.hidden = true;
  const header = explainElement('header');
  const title = explainElement('h2', 'Explain');
  title.id = 'explain-title';
  title.tabIndex = -1;
  const close = explainButton('Close', () => dismiss());
  close.setAttribute('aria-label', 'Close explanation');
  header.append(title, close);

  const body = explainElement('div');
  body.className = 'explain-body';
  const scopeLabel = explainElement('label', 'Source');
  scopeLabel.htmlFor = 'explain-scope';
  const picker = explainElement('select');
  picker.id = scopeLabel.htmlFor;
  scopes.forEach((entry, index) =>
    picker.add(new Option(entry.label, String(index)))
  );
  const coverage = explainElement('p');
  const sources = explainElement('div');
  const availability = explainElement('p', 'Checking on-device explanations…');
  const conversation = explainElement('section');
  conversation.setAttribute('aria-label', 'Conversation');
  const broaden = explainButton('Use whole document', () => {
    picker.value = String(
      scopes.findIndex((entry) => entry.kind === 'document')
    );
    selectScope();
    picker.focus();
  });
  body.append(
    scopeLabel,
    picker,
    coverage,
    availability,
    sources,
    conversation,
    broaden
  );

  const form = explainElement('form');
  const questionLabel = explainElement('label', 'Ask a follow-up…');
  questionLabel.htmlFor = 'explain-question';
  const input = explainElement('input');
  input.type = 'text';
  input.id = questionLabel.htmlFor;
  input.maxLength = 1000;
  input.autocomplete = 'off';
  input.enterKeyHint = 'send';
  const send = explainElement('button', 'Send');
  send.className = 'source-control source-primary';
  send.type = 'submit';
  form.hidden = true;
  form.append(questionLabel, input, send);
  const playback = explainElement('div');
  playback.id = 'explain-playback';
  const live = explainElement('div');
  live.className = 'source-visually-hidden';
  live.setAttribute('role', 'status');
  panel.append(header, body, playback, form, live);
  host.append(panel);
  const back = explainButton('Back to explanation', () => show(lastCitation));
  back.classList.add('explain-return');
  back.hidden = true;
  const location = explainElement('span');
  location.id = 'explain-source-location';
  location.className = 'source-visually-hidden';
  back.setAttribute('aria-describedby', location.id);
  host.before(back, location);

  let scope = scopes[0];
  /** @type {ExplainRailMessage[]} */
  let history = [];
  /** @type {AbortController | null} */
  let pending = null;
  /** @type {HTMLElement | null} */
  let lastCitation = null;
  /** @type {Element | null} */
  let opener = null;
  /** @type {Range | null} */
  let range = null;
  let scrollTop = 0;
  let scrollLeft = 0;
  let disposed = false;
  let available = false;
  const compact = window.matchMedia?.('(max-width: 767px)');
  /** @type {Set<HTMLElement>} */
  const inertSiblings = new Set();

  function layout() {
    for (const element of inertSiblings) element.removeAttribute('inert');
    inertSiblings.clear();
    panel.removeAttribute('role');
    panel.removeAttribute('aria-modal');
    if (panel.hidden || !compact?.matches) return;
    // The compact rail covers the reader. Isolate only sibling subtrees so
    // controls in the rail remain reachable with VoiceOver and an external keyboard.
    for (
      let node = /** @type {HTMLElement | null} */ (panel);
      node && node !== document.body;
      node = node.parentElement
    ) {
      for (const sibling of node.parentElement?.children || []) {
        if (
          sibling !== node &&
          sibling.id !== 'toast-region' &&
          sibling instanceof HTMLElement &&
          !sibling.hasAttribute('inert')
        ) {
          sibling.setAttribute('inert', '');
          inertSiblings.add(sibling);
        }
      }
    }
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    if (!panel.contains(document.activeElement))
      title.focus({ preventScroll: true });
  }

  function fitKeyboard() {
    const view = window.visualViewport;
    if (!view || panel.hidden) return;
    panel.style.setProperty('--explain-viewport-top', view.offsetTop + 'px');
    panel.style.setProperty('--explain-viewport-height', view.height + 'px');
    const remaining =
      view.height + view.offsetTop - host.getBoundingClientRect().top;
    panel.style.setProperty(
      '--explain-available-height',
      Math.max(0, remaining) + 'px'
    );
  }

  /** @param {HTMLElement | null} [focus] */
  function show(focus = null) {
    back.hidden = true;
    location.textContent = '';
    panel.hidden = false;
    readAloudMountControls(playback);
    layout();
    fitKeyboard();
    (focus?.isConnected ? focus : title).focus({ preventScroll: true });
  }

  function hide() {
    panel.hidden = true;
    readAloudMountControls(null);
    layout();
  }

  function dismiss() {
    hide();
    back.hidden = true;
    const target = [
      opener,
      document.getElementById('ios-more-button'),
      document.getElementById('overflow-toggle'),
      reader,
    ].find(canRestoreNonEditableFocus);
    target?.focus({ preventScroll: true });
    // Safari may collapse the document selection when the composer receives focus.
    const selection = window.getSelection();
    selection?.removeAllRanges();
    if (range && reader.contains(range.commonAncestorContainer))
      selection?.addRange(range);
    reader.scrollTop = scrollTop;
    reader.scrollLeft = scrollLeft;
  }

  /** @param {string} label @param {() => void} reveal @param {string} [description] */
  function sourceButton(label, reveal, description = label) {
    const button = explainButton(label, () => {
      if (compact?.matches) {
        lastCitation = button;
        hide();
        location.textContent = description;
        back.hidden = false;
        back.focus({ preventScroll: true });
      }
      reveal();
    });
    button.classList.add('explain-source-link');
    return button;
  }

  function showSources() {
    sources.replaceChildren();
    if (scope.fallback) sources.append(explainElement('p', scope.fallback));
    if (scope.walkthrough?.length) {
      const steps = explainElement('details');
      steps.open = true;
      const list = explainElement('ol');
      const walkthrough = scope.walkthrough;
      for (const step of walkthrough) {
        const item = explainElement('li');
        item.append(sourceButton(step.text, step.reveal));
        list.append(item);
      }
      steps.append(
        explainElement('summary', 'Source walkthrough'),
        explainButton('Listen to walkthrough', () =>
          readAloudListen(walkthrough.map((step) => step.text).join('\n'))
        ),
        list
      );
      sources.append(steps);
    } else if (scope.excerpts.length) {
      const preview = explainElement('details');
      preview.append(explainElement('summary', 'Source passages'));
      const first = scope.excerpts[0].text;
      const quote = explainElement(
        'blockquote',
        first.length > 180 ? first.slice(0, 180).trimEnd() + '…' : first
      );
      for (const [index, excerpt] of scope.excerpts.entries()) {
        preview.append(
          sourceButton(`${index + 1}. ${excerpt.text}`, excerpt.reveal)
        );
      }
      sources.append(
        quote,
        preview,
        explainButton('Listen to source', () =>
          readAloudListen(
            scope.excerpts.map((excerpt) => excerpt.text).join('\n')
          )
        )
      );
    }
  }

  function updateComposer() {
    form.hidden = !available || !scope.excerpts.length;
    send.disabled = !!pending || !input.value.trim();
  }

  function selectScope() {
    pending?.abort();
    pending = null;
    scope = scopes[picker.selectedIndex];
    history = [];
    conversation.replaceChildren();
    input.value = '';
    live.textContent = '';
    coverage.textContent = scope.coverage || '';
    coverage.hidden = !scope.coverage;
    broaden.hidden =
      scope.kind === 'document' ||
      !scopes.some((entry) => entry.kind === 'document');
    showSources();
    updateComposer();
    if (available && scope.excerpts.length) newTurn('');
  }

  /** @param {string} question */
  function newTurn(question) {
    if (pending || !available || !scope.excerpts.length) return;
    conversation.querySelector('.explain-retry')?.remove();
    const turn = explainElement('div');
    turn.className = 'explain-turn';
    if (question) turn.append(explainElement('h3', question));
    const answer = explainElement('p');
    const actions = explainElement('div');
    actions.className = 'explain-actions';
    turn.append(answer, actions);
    conversation.append(turn);

    function failed(/** @type {string} */ message) {
      answer.textContent = message;
      live.textContent = message;
      const retry = explainButton('Retry', () => {
        void run();
      });
      retry.classList.add('explain-retry');
      const hadFocus = actions.contains(document.activeElement);
      actions.replaceChildren(retry);
      if (hadFocus) retry.focus({ preventScroll: true });
    }

    async function run() {
      if (pending) return;
      const request = new AbortController();
      pending = request;
      updateComposer();
      live.textContent = '';
      answer.textContent = 'Reading the source…';
      const stop = explainButton('Stop', () => {
        request.abort();
        pending = null;
        failed('Explanation stopped.');
        updateComposer();
      });
      const retryFocused = actions.contains(document.activeElement);
      actions.replaceChildren(stop);
      if (retryFocused) stop.focus({ preventScroll: true });
      try {
        const excerpts = scope.excerpts.map(({ id, text }) => ({ id, text }));
        const result = await askExplain(
          {
            question: question || 'Explain this source in plain language.',
            excerpts,
            history: history
              .slice(-6)
              .map(({ role, text }) => ({ role, text: text.slice(0, 1000) })),
          },
          request.signal
        );
        if (request.signal.aborted || disposed) return;
        const byId = new Map(
          scope.excerpts.map((excerpt) => [excerpt.id, excerpt])
        );
        if (
          !Array.isArray(result.sourceIds) ||
          result.sourceIds.some((id) => !byId.has(id)) ||
          !result.text?.trim()
        ) {
          failed('The explanation could not be linked to this source.');
          return;
        }
        const nearEnd =
          body.scrollHeight - body.clientHeight - body.scrollTop < 80;
        const text = result.sourceIds.length
          ? result.text.trim()
          : 'This source does not provide enough information to answer.';
        answer.textContent = text;
        live.textContent = text;
        const stopFocused = document.activeElement === stop;
        actions.replaceChildren();
        for (const id of new Set(result.sourceIds)) {
          const excerpt = byId.get(id);
          if (!excerpt) continue;
          const number = scope.excerpts.indexOf(excerpt) + 1;
          const citation = sourceButton(
            `Source ${number}`,
            excerpt.reveal,
            excerpt.text
          );
          citation.setAttribute(
            'aria-label',
            `Source ${number}. ${excerpt.text.slice(0, 120)}`
          );
          actions.append(citation);
        }
        actions.append(explainButton('Listen', () => readAloudListen(text)));
        if (question) history.push({ role: 'user', text: question });
        history.push({ role: 'assistant', text });
        history = history.slice(-6);
        if (stopFocused) input.focus({ preventScroll: true });
        if (nearEnd) body.scrollTop = body.scrollHeight;
      } catch {
        if (!request.signal.aborted && !disposed)
          failed(
            'The on-device explanation could not be completed. Try again.'
          );
      } finally {
        if (pending === request) {
          pending = null;
          updateComposer();
        }
      }
    }
    void run();
  }

  picker.addEventListener('change', selectScope);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question || pending || !available) return;
    input.value = '';
    newTurn(question);
    body.scrollTop = body.scrollHeight;
    input.focus({ preventScroll: true });
  });
  input.addEventListener('input', updateComposer);
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.isComposing) {
      event.preventDefault();
      dismiss();
    }
    if (compact?.matches && event.key === 'Tab') {
      // Closed source previews contain buttons, and unavailable models hide the
      // form. Limit the wrap to controls the browser can actually reach.
      const controls = Array.from(
        panel.querySelectorAll(
          'button:enabled, select:enabled, input:enabled, summary'
        )
      ).filter((node) => {
        if (node.closest('[hidden]')) return false;
        const closed = node.closest('details:not([open])');
        return !closed || node === closed.querySelector('summary');
      });
      const first = controls[0];
      const last = controls.at(-1);
      const active = document.activeElement;
      let destination;
      if (event.shiftKey && (active === first || active === title))
        destination = last;
      if (!event.shiftKey && active === last) destination = first;
      if (destination instanceof HTMLElement) {
        event.preventDefault();
        destination.focus();
      }
    }
    if (compact?.matches) event.stopPropagation();
  });
  compact?.addEventListener?.('change', layout);
  window.visualViewport?.addEventListener('resize', fitKeyboard);
  window.visualViewport?.addEventListener('scroll', fitKeyboard);
  selectScope();
  void Promise.resolve()
    .then(() => explainAvailable())
    .catch(() => false)
    .then((enabled) => {
      if (disposed) return;
      available = enabled;
      availability.hidden = enabled;
      availability.textContent = enabled
        ? ''
        : (explainUnavailableReason() ||
            'On-device explanations are unavailable here.') +
          ' You can still explore the source.';
      updateComposer();
      if (enabled && scope.excerpts.length) newTurn('');
    });

  return {
    /** @param {string} key */
    matches(key) {
      return key === scopes[0].key || key === scope.key;
    },
    /** @param {Range|null} selection @param {Element|null} focus */
    open(selection, focus) {
      if (panel.hidden && back.hidden) {
        range = selection?.cloneRange() || null;
        opener = canRestoreNonEditableFocus(document.activeElement)
          ? document.activeElement
          : focus;
        scrollTop = reader.scrollTop;
        scrollLeft = reader.scrollLeft;
      }
      show();
    },
    dispose() {
      disposed = true;
      pending?.abort();
      if (!panel.hidden) hide();
      compact?.removeEventListener?.('change', layout);
      window.visualViewport?.removeEventListener('resize', fitKeyboard);
      window.visualViewport?.removeEventListener('scroll', fitKeyboard);
      panel.remove();
      back.remove();
      location.remove();
    },
  };
}

/** @param {Range|null} [range] @param {Element|null} [focused] */
export function openExplainRail(range, focused = document.activeElement) {
  const reader = document.getElementById('markdown-content');
  const host = reader?.closest('.content-body');
  if (!reader || !(host instanceof HTMLElement)) return;
  if (range === undefined) {
    const selected = window.getSelection();
    range =
      selected?.rangeCount && !selected.isCollapsed
        ? selected.getRangeAt(0)
        : null;
  }
  const scopes = captureExplainScopes(range, focused);
  if (!scopes.length) return;
  if (!explainRailSession?.matches(scopes[0].key)) {
    resetExplainRail();
    explainRailSession = createExplainRail(scopes, host, reader);
  }
  explainRailSession.open(range, focused);
}

export function resetExplainRail() {
  closeExplainSource();
  explainRailSession?.dispose();
  explainRailSession = null;
}
