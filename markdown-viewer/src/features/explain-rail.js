// A thread belongs to one revision and one explicit source. The shared side
// rail owns tabs, viewport sizing and focus return.
import { captureDocumentContext } from '../core/document-context.js';
import { state } from '../core/state.js';
import {
  askExplain,
  explainAvailable,
  explainUnavailableReason,
} from '../platform/explain-provider.js';
import { copyToClipboard } from './code-copy.js';
import {
  captureExplainScopes,
  clearExplainMarks,
  clearExplainScopeMark,
  closeExplainSource,
} from './explain-source.js';
import {
  readAloudListen,
  readAloudStart,
  readAloudWalkthrough,
  readAloudStopWalkthrough,
} from './read-aloud.js';
import {
  activeSideRailTab,
  closeSideRail,
  getSideRailPanel,
  openSideRail,
  sideRailCompact,
} from './side-rail.js';
// @ts-expect-error -- Vite stylesheet import
import './explain-rail.css';

/** @typedef {ReturnType<typeof captureExplainScopes>[number]} ExplainRailScope */
/** @typedef {{role:'user'|'assistant',text:string}} ExplainRailMessage */
/** @type {ReturnType<typeof createExplainRail> | null} */
let explainRailSession = null;
let explainSourceListId = 0;

/** @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag @param {string} [className] @param {string} [text] */
function explainElement(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/** @param {string} label @param {() => void} action @param {string} [className] */
function explainButton(label, action, className = 'sd-turn-action') {
  const button = explainElement('button', className, label);
  button.type = 'button';
  button.addEventListener('click', action);
  return button;
}

function explainDeviceName() {
  if (
    /iPad/i.test(navigator.userAgent) ||
    (/Mac/i.test(navigator.platform) && navigator.maxTouchPoints > 1)
  )
    return 'iPad';
  if (/iPhone/i.test(navigator.userAgent)) return 'iPhone';
  return /Mac/i.test(navigator.platform) ? 'Mac' : 'device';
}

/** @param {ExplainRailScope[]} scopes @param {HTMLElement} panel @param {Range|null} originalSelection @param {Element|null} opener */
function createExplainRail(scopes, panel, originalSelection, opener) {
  const context = captureDocumentContext();
  const reader = context.root;
  let openingScroll = reader?.scrollTop || 0;
  const selection = originalSelection?.cloneRange() || null;
  let scope = scopes[0];
  /** @type {ExplainRailMessage[]} */
  let history = [];
  /** @type {AbortController|null} */
  let pending = null;
  let pendingQuestion = '';
  let stale = false;
  let disposed = false;
  /** @type {boolean|null} */
  let available = null;
  /** @type {HTMLElement|null} */
  let lastCitation = null;
  let peekScroll = 0;
  let peeking = false;

  const source = explainElement('div', 'sd-scope');
  const pickerField = explainElement('label', 'sd-scope-picker');
  const pickerLabel = explainElement('span');
  pickerLabel.setAttribute('aria-hidden', 'true');
  const arrow = explainElement('span', '', '▾');
  arrow.setAttribute('aria-hidden', 'true');
  const picker = explainElement('select');
  picker.id = 'explain-scope';
  picker.setAttribute('aria-label', 'Source');
  pickerField.append(pickerLabel, arrow, picker);
  const preview = explainElement('div', 'sd-scope-preview');
  source.append(pickerField, preview);

  const thread = explainElement('section', 'sd-thread');
  thread.setAttribute('aria-label', 'Conversation');
  const coverage = explainElement('p', 'sd-turn-status');
  const availability = explainElement('div', 'explain-capability');
  const walkthrough = explainElement('div', 'explain-walkthrough');
  const conversation = explainElement('div', 'explain-conversation');
  thread.append(coverage, availability, walkthrough, conversation);
  const form = explainElement('form', 'sd-composer');
  const field = explainElement('div', 'sd-composer-field');
  const input = explainElement('textarea', 'sd-composer-input');
  input.id = 'explain-question';
  input.rows = 1;
  input.placeholder = 'Ask a follow-up…';
  input.setAttribute('aria-label', 'Ask a follow-up');
  input.maxLength = 1000;
  input.autocomplete = 'off';
  input.enterKeyHint = 'send';
  const send = explainElement('button', 'sd-composer-send', '↑');
  send.type = 'submit';
  send.setAttribute('aria-label', 'Send');
  field.append(input, send);
  form.append(
    field,
    explainElement(
      'p',
      'sd-composer-note',
      `Generated on this ${explainDeviceName()} from the scope above. Check the sources.`
    )
  );
  const live = explainElement('span', 'source-visually-hidden');
  live.setAttribute('role', 'status');
  panel.replaceChildren(source, thread, form, live);

  const back = explainButton(
    '‹ Back to answer',
    () => {
      peeking = false;
      openSideRail('explain', {
        opener: opener instanceof HTMLElement ? opener : null,
        selection,
        scrollTop: openingScroll,
      });
      back.hidden = true;
      lastCitation?.focus({ preventScroll: true });
      thread.scrollTop = peekScroll;
    },
    'explain-return'
  );
  back.setAttribute('aria-label', 'Back to answer');
  back.hidden = true;
  document.body.append(back);

  function markScope() {
    if (!stale && activeSideRailTab() === 'explain') scope.mark();
  }

  /** @param {HTMLButtonElement} button @param {() => void} reveal */
  function revealFrom(button, reveal) {
    panel
      .querySelectorAll('[aria-current="true"]')
      .forEach((n) => n.removeAttribute('aria-current'));
    button.setAttribute('aria-current', 'true');
    if (sideRailCompact()) {
      peeking = true;
      peekScroll = thread.scrollTop;
      lastCitation = button;
      clearExplainScopeMark();
      closeSideRail(false);
      back.hidden = false;
      back.focus({ preventScroll: true });
    }
    reveal();
  }

  function updateComposer() {
    form.hidden = !available || stale || !scope.excerpts.length;
    send.disabled = !!pending || !input.value.trim();
  }

  function refreshPicker() {
    picker.replaceChildren(
      ...scopes.map((entry) => new Option(entry.label, entry.key))
    );
    picker.value = scope.key;
    const [kind, ...rest] = scope.label.split(' · ');
    pickerLabel.replaceChildren(
      explainElement(
        'span',
        'sd-scope-kind',
        kind + (rest.length ? ' · ' : '')
      ),
      rest.join(' · ')
    );
    preview.textContent = scope.preview;
    preview.title = scope.preview;
    coverage.textContent = scope.coverage || '';
    coverage.hidden = !scope.coverage;
  }

  function showAvailableActions() {
    availability.replaceChildren();
    availability.hidden = available === true;
    if (available === null) {
      availability.textContent = 'Checking on-device explanations…';
      return;
    }
    if (available) return;
    const why =
      explainUnavailableReason() ||
      'On-device explanations require Apple Intelligence on a supported Apple device.';
    availability.append(
      explainElement('h3', '', 'Explanations aren’t available here'),
      explainElement(
        'p',
        '',
        why + ` Your document stays on this ${explainDeviceName()}.`
      )
    );
    const actions = explainElement('div', 'sd-scope-actions');
    if (scope.excerpts.length && scope.kind !== 'diagram') {
      actions.append(
        explainButton(
          scope.kind === 'selection'
            ? 'Read selection aloud'
            : 'Read source aloud',
          () => {
            if (scope.kind === 'selection' && selection)
              readAloudStart(selection);
            else if (scope.kind === 'document' && reader) {
              const all = document.createRange();
              all.selectNodeContents(reader);
              readAloudStart(all);
            } else
              readAloudListen(scope.excerpts.map((e) => e.text).join('\n'));
          },
          'source-control'
        )
      );
    }
    const diagram = scopes.find((s) => s.kind === 'diagram');
    if (diagram && scope.kind !== 'diagram')
      actions.append(
        explainButton(
          'Walk through a diagram',
          () => selectScope(diagram),
          'source-control'
        )
      );
    availability.append(actions);
  }

  /** @param {Event} event */
  function highlightSpokenStep(event) {
    const index = /** @type {CustomEvent<{index:number|null}>} */ (event).detail
      .index;
    const previous = walkthrough.querySelector('[aria-current="step"]');
    previous?.removeAttribute('aria-current');
    if (index !== null) {
      const step = walkthrough.querySelectorAll('.explain-step')[index];
      if (step) {
        walkthrough
          .querySelector('[aria-current="true"]')
          ?.removeAttribute('aria-current');
        step.setAttribute('aria-current', 'step');
      }
    }
  }
  document.addEventListener('specdown-walkthrough-step', highlightSpokenStep);

  function showWalkthrough() {
    walkthrough.replaceChildren();
    const steps = scope.walkthrough;
    if (steps?.length) {
      const details = explainElement('details');
      details.open = available === false;
      const list = explainElement('ol');
      let previousBranch = '';
      for (const step of steps) {
        const row = explainElement('li');
        if (step.branchLabel && step.branchLabel !== previousBranch)
          row.append(
            explainElement('span', 'explain-branch', step.branchLabel)
          );
        previousBranch = step.branchLabel || '';
        const jump = explainButton(
          step.label || step.text,
          () => revealFrom(jump, step.reveal),
          'explain-step'
        );
        row.append(jump);
        list.append(row);
      }
      details.append(
        explainElement('summary', '', 'Source walkthrough'),
        explainButton('Listen to walkthrough', () =>
          readAloudWalkthrough(
            steps.map((step) => step.text),
            scope.label
          )
        ),
        list
      );
      walkthrough.append(details);
    } else if (scope.fallback || (!available && scope.excerpts.length)) {
      if (scope.fallback)
        walkthrough.append(
          explainElement('p', 'sd-turn-status', scope.fallback)
        );
      const details = explainElement('details');
      details.append(explainElement('summary', '', 'Source passages'));
      for (const excerpt of scope.excerpts) {
        const link = explainButton(
          excerpt.text,
          () => revealFrom(link, excerpt.reveal),
          'sd-source'
        );
        details.append(link);
      }
      walkthrough.append(details);
    }
    walkthrough.hidden = !walkthrough.childElementCount;
  }

  /** @param {ExplainRailScope} next */
  function selectScope(next) {
    if (scope.key === next.key) return;
    readAloudStopWalkthrough();
    if (pending) {
      pending.abort();
      pending = null;
      conversation.querySelector('.explain-pending')?.remove();
    }
    conversation
      .querySelectorAll('.explain-retry,.sd-scope-actions')
      .forEach((node) => node.remove());
    scope = next;
    if (!scopes.some((entry) => entry.key === next.key)) {
      const whole = scopes.findIndex((entry) => entry.kind === 'document');
      scopes.splice(whole < 0 ? scopes.length : whole, 0, next);
    }
    history = [];
    input.value = '';
    live.textContent = '';
    const kind =
      scope.kind === 'document'
        ? 'Whole document'
        : scope.label.split(' · ')[0];
    conversation.append(
      explainElement('div', 'sd-thread-divider', 'New thread · ' + kind)
    );
    refreshPicker();
    markScope();
    showAvailableActions();
    showWalkthrough();
    updateComposer();
    if (available && scope.excerpts.length) newTurn('');
    picker.focus({ preventScroll: true });
    thread.scrollTop = thread.scrollHeight;
  }
  picker.addEventListener('change', () => {
    const next = scopes.find((entry) => entry.key === picker.value);
    if (next) selectScope(next);
  });

  /** @param {HTMLElement} turn */
  function offerWiderScope(turn) {
    const whole = scopes.find((entry) => entry.kind === 'document');
    if (scope.kind === 'document' || !whole) return;
    const next =
      scope.containingSection ||
      (scope.kind === 'section'
        ? null
        : scopes.find((entry) => entry.key === scope.sectionKey)) ||
      whole;
    const label =
      next.kind === 'section'
        ? 'Use section: ' + next.label.replace(/^Section · /, '')
        : 'Use whole document';
    const actions = explainElement('div', 'sd-scope-actions');
    actions.append(
      explainButton(label, () => selectScope(next), 'source-control')
    );
    turn.append(actions);
  }

  /** @param {string} question */
  function newTurn(question) {
    if (pending || !available || stale || !scope.excerpts.length) return;
    const turnScope = scope;
    conversation.querySelector('.explain-retry')?.remove();
    const turn = explainElement('div', 'explain-turn');
    if (question)
      turn.append(explainElement('p', 'sd-turn-question', question));
    const response = explainElement('div', 'explain-response');
    turn.append(response);
    conversation.append(turn);

    function failed(/** @type {string} */ message) {
      const focused = response.contains(document.activeElement);
      const retry = explainButton(
        'Retry',
        () => {
          void run();
        },
        'sd-turn-action explain-retry'
      );
      response.replaceChildren(
        explainElement('p', 'sd-turn-status', message),
        retry
      );
      live.textContent = message;
      if (focused) retry.focus();
    }

    async function run() {
      if (pending || disposed || stale || scope !== turnScope) return;
      const request = new AbortController();
      pending = request;
      pendingQuestion = question;
      updateComposer();
      live.textContent = '';
      const writing = explainElement('div', 'explain-pending');
      const stop = explainButton('Stop', () => {
        request.abort();
        pending = null;
        failed('Explanation stopped.');
        updateComposer();
      });
      writing.append(
        explainElement('span', 'sd-turn-status', 'Writing an answer…'),
        stop
      );
      const focused = response.contains(document.activeElement);
      response.replaceChildren(writing);
      if (focused) stop.focus();
      try {
        const result = await askExplain(
          {
            question: question || 'Explain this source in plain language.',
            excerpts: turnScope.excerpts.map(({ id, text }) => ({ id, text })),
            history: history.map(({ role, text }) => ({
              role,
              text: text.slice(0, 1000),
            })),
          },
          request.signal
        );
        if (request.signal.aborted || disposed) return;
        const byId = new Map(
          turnScope.excerpts.map((excerpt) => [excerpt.id, excerpt])
        );
        const ids = new Set(result.sourceIds);
        const citations = [...ids].flatMap((id) => byId.get(id) || []);
        if (
          !Array.isArray(result.sourceIds) ||
          !result.text?.trim() ||
          (ids.size && !citations.length)
        ) {
          failed('This answer couldn’t be matched to the document.');
          return;
        }
        const nearEnd =
          thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
        const text = citations.length
          ? result.text.trim()
          : 'This source does not provide enough information to answer.';
        const answer = explainElement('p', 'explain-answer', text);
        const actions = explainElement('div', 'sd-turn-actions');
        const cards = explainElement('div', 'sd-sources');
        cards.id = 'explain-sources-' + ++explainSourceListId;
        cards.hidden = true;
        citations.forEach((excerpt, index) => {
          const number = index + 1;
          const label = `Source ${number}: ${excerpt.ariaLabel || excerpt.label}`;
          const cite = explainButton(
            String(number),
            () => revealFrom(cite, excerpt.reveal),
            'sd-cite'
          );
          cite.replaceChildren(
            explainElement('span', 'explain-cite-number', String(number))
          );
          cite.setAttribute('aria-label', label);
          answer.append(' ', cite);
          const card = explainButton(
            '',
            () => {
              revealFrom(card, excerpt.reveal);
              cite.setAttribute('aria-current', 'true');
            },
            'sd-source'
          );
          card.append(
            explainElement(
              'span',
              'sd-source-label',
              `${number} · ${excerpt.label}`
            ),
            explainElement('span', 'explain-quote', excerpt.text)
          );
          cards.append(card);
        });
        const copy = explainButton('Copy', async () => {
          try {
            await copyToClipboard(text);
            if (!disposed) live.textContent = 'Answer copied.';
          } catch {
            if (!disposed) live.textContent = 'Could not copy this answer.';
          }
        });
        actions.append(
          explainButton('Listen', () => readAloudListen(text)),
          copy
        );
        if (citations.length) {
          const toggle = explainButton(`Sources · ${citations.length}`, () => {
            cards.hidden = !cards.hidden;
            toggle.setAttribute('aria-expanded', String(!cards.hidden));
          });
          toggle.setAttribute('aria-expanded', 'false');
          toggle.setAttribute('aria-controls', cards.id);
          actions.append(toggle);
        }
        const hadStopFocus = document.activeElement === stop;
        response.replaceChildren(answer, actions, cards);
        if (!citations.length) offerWiderScope(response);
        if (question) history.push({ role: 'user', text: question });
        history.push({ role: 'assistant', text });
        history = history.slice(-6);
        live.textContent = text;
        if (hadStopFocus) input.focus({ preventScroll: true });
        if (nearEnd) thread.scrollTop = thread.scrollHeight;
      } catch (error) {
        if (!request.signal.aborted && !disposed)
          failed(
            error instanceof Error &&
              /matched to the document|linked to this source/.test(
                error.message
              )
              ? 'This answer couldn’t be matched to the document.'
              : 'The on-device explanation could not be completed. Try again.'
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

  /** @param {string} initialQuestion @param {boolean} [confirmScope] */
  function start(initialQuestion, confirmScope = false) {
    refreshPicker();
    markScope();
    showAvailableActions();
    showWalkthrough();
    updateComposer();
    void explainAvailable()
      .catch(() => false)
      .then((enabled) => {
        if (disposed || stale) return;
        available = enabled;
        showAvailableActions();
        showWalkthrough();
        updateComposer();
        if (enabled && confirmScope) {
          input.value =
            initialQuestion || 'Explain this source in plain language.';
          updateComposer();
          input.focus();
        } else if (enabled && scope.excerpts.length) newTurn(initialQuestion);
      });
  }

  /** @param {Event} event */
  function submit(event) {
    event.preventDefault();
    const question = input.value.trim();
    if (!question || pending || stale || !available) return;
    input.value = '';
    newTurn(question);
    thread.scrollTop = thread.scrollHeight;
    input.focus({ preventScroll: true });
  }
  form.addEventListener('submit', submit);
  input.addEventListener('input', updateComposer);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing)
      submit(event);
  });

  return {
    tabId: context.tabId,
    matches(/** @type {string} */ key) {
      if (stale) return context.tabId === captureDocumentContext().tabId;
      return scopes[0].key === key || scope.key === key;
    },
    start,
    open() {
      if (activeSideRailTab() === null && back.hidden)
        openingScroll = reader?.scrollTop || 0;
      openSideRail('explain', {
        opener: opener instanceof HTMLElement ? opener : null,
        selection,
        scrollTop: openingScroll,
      });
    },
    tabChanged() {
      if (activeSideRailTab() === 'explain') {
        markScope();
        back.hidden = true;
      } else if (peeking && activeSideRailTab() === null)
        clearExplainScopeMark();
      else {
        peeking = false;
        back.hidden = true;
        clearExplainMarks();
      }
    },
    invalidate() {
      // A tab change destroys both the sources and the previous conversation.
      // A same-file revision can keep just the interrupted question for a retry.
      if (
        context.tabId === null ||
        context.tabId !== captureDocumentContext().tabId ||
        (!pending && !stale)
      )
        return false;
      if (stale) return true;
      stale = true;
      pending?.abort();
      pending = null;
      history = [];
      const moveFocus = panel.contains(document.activeElement);
      clearExplainMarks();
      closeExplainSource();
      source.hidden = true;
      form.hidden = true;
      back.hidden = true;
      const message =
        'The document changed while this answer was being written, so it was discarded.';
      const notice = explainElement('p', 'explain-stale', message);
      const again = explainButton(
        'Ask again',
        () => {
          if (context.tabId !== captureDocumentContext().tabId) {
            resetExplainRail();
            return;
          }
          const now = captureExplainScopes(undefined, document.activeElement);
          if (
            reader?.hidden ||
            state.currentViewMode !== 'preview' ||
            !now.length
          ) {
            live.textContent = 'Open the document preview to ask again.';
            return;
          }
          // The reader explicitly chose the old scope. Never silently broaden
          // a lost selection into the current section or the whole document.
          const candidates = now.filter(
            (entry) => entry.kind === scope.kind && entry.label === scope.label
          );
          const current =
            candidates.length === 1 &&
            (scope.kind !== 'selection' ||
              candidates[0].preview === scope.preview)
              ? candidates[0]
              : null;
          if (current) now.splice(0, 0, ...now.splice(now.indexOf(current), 1));
          const question = pendingQuestion;
          this.dispose();
          const fresh = createExplainRail(now, panel, null, opener);
          explainRailSession = fresh;
          fresh.start(question, !current);
        },
        'source-control source-primary'
      );
      thread.replaceChildren(notice, again);
      live.textContent = message;
      if (moveFocus) again.focus({ preventScroll: true });
      return true;
    },
    dispose() {
      document.removeEventListener(
        'specdown-walkthrough-step',
        highlightSpokenStep
      );
      readAloudStopWalkthrough();
      disposed = true;
      pending?.abort();
      back.remove();
      panel.replaceChildren();
      clearExplainMarks();
      closeExplainSource();
    },
  };
}

/** @param {Range|null} [range] @param {Element|null} [focused] */
export function openExplainRail(range, focused = document.activeElement) {
  const panel = getSideRailPanel('explain');
  if (!panel) return;
  if (range === undefined) {
    const selection = window.getSelection();
    range =
      selection?.rangeCount && !selection.isCollapsed
        ? selection.getRangeAt(0)
        : null;
  }
  const scopes = captureExplainScopes(range, focused);
  if (!scopes.length) return;
  if (!explainRailSession?.matches(scopes[0].key)) {
    explainRailSession?.dispose();
    const opener =
      document.activeElement instanceof HTMLElement &&
      !document.activeElement.closest(
        '[hidden], [role="menu"], [role="dialog"]'
      ) &&
      document.activeElement !== document.body
        ? document.activeElement
        : focused;
    explainRailSession = createExplainRail(scopes, panel, range, opener);
    explainRailSession.start('');
  }
  explainRailSession.open();
}

/** Notes can be the first tab opened for this document. */
export function setupExplainRailTab() {
  document.addEventListener('specdown-rail-change', onExplainRailTabChanged);
}
function onExplainRailTabChanged() {
  if (activeSideRailTab() === 'explain' && !explainRailSession)
    openExplainRail();
  else explainRailSession?.tabChanged();
}

export function invalidateExplainRail() {
  const session = explainRailSession;
  if (!session?.invalidate()) resetExplainRail();
  else
    queueMicrotask(() => {
      // Some empty-state transitions clear the active tab after invalidation.
      if (
        session === explainRailSession &&
        session.tabId !== captureDocumentContext().tabId
      )
        resetExplainRail();
    });
}
export function resetExplainRail() {
  if (activeSideRailTab() === 'explain') closeSideRail(false);
  explainRailSession?.dispose();
  explainRailSession = null;
}
