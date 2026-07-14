// @ts-check
// Command palette (Cmd/Ctrl+K): a searchable list of every app action, with
// fuzzy filtering and full keyboard navigation. Commands are registered by the
// entry module so this stays decoupled from the features it invokes.
//
// The palette DOM is built on open and torn down on close, so there's no stale
// selection state between invocations. It's an ARIA combobox + listbox dialog.

import { trapFocus } from '../core/focus-trap.js';

/**
 * @typedef {object} Command
 * @property {string} id
 * @property {string} title
 * @property {string} [hint] Right-aligned shortcut/hint text.
 * @property {string[]} [keywords] Extra terms the fuzzy filter also matches.
 * @property {() => void} run
 * @property {() => boolean} [isAvailable] Hide the command when this returns false.
 */

/** @type {Command[]} */
let registry = [];

/** @type {HTMLElement | null} */
let overlay = null;
/** @type {HTMLInputElement | null} */
let input = null;
/** @type {HTMLElement | null} */
let listEl = null;
/** @type {Command[]} */
let visible = [];
let selectedIndex = 0;
/** @type {Element | null} */
let previouslyFocused = null;
/** @type {(() => void) | null} */
let releaseTrap = null;

/**
 * Register the set of commands the palette offers. Replaces any prior set.
 * @param {Command[]} commands
 */
export function registerCommands(commands) {
  registry = Array.isArray(commands) ? commands.slice() : [];
}

/**
 * Fuzzy subsequence score of `query` against `text`. Returns -1 for no match,
 * otherwise a score that rewards consecutive and start-of-string matches.
 * @param {string} query
 * @param {string} text
 * @returns {number}
 */
export function fuzzyScore(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (q === '') return 0;
  let qi = 0;
  let score = 0;
  let lastMatch = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += lastMatch === ti - 1 ? 2 : 1; // consecutive bonus
      if (ti === 0) score += 3; // start-of-string bonus
      lastMatch = ti;
      qi++;
    }
  }
  return qi === q.length ? score : -1;
}

/**
 * Filter + rank the available commands for a query (pure; used by the UI and
 * directly by tests).
 * @param {Command[]} commands
 * @param {string} query
 * @returns {Command[]}
 */
export function filterCommands(commands, query) {
  const available = commands.filter((c) => !c.isAvailable || c.isAvailable());
  if (!query) return available;
  return available
    .map((command) => {
      let best = fuzzyScore(query, command.title);
      for (const kw of command.keywords || []) {
        best = Math.max(best, fuzzyScore(query, kw));
      }
      return { command, score: best };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.command);
}

export function isCommandPaletteOpen() {
  return overlay !== null;
}

function renderList() {
  if (!listEl || !input) return;
  const list = listEl;
  const field = input;
  list.innerHTML = '';

  if (visible.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'command-palette-empty';
    empty.textContent = 'No matching commands';
    list.appendChild(empty);
    field.removeAttribute('aria-activedescendant');
    return;
  }

  visible.forEach((command, i) => {
    const item = document.createElement('li');
    item.className = 'command-palette-item' + (i === selectedIndex ? ' is-selected' : '');
    item.id = 'command-palette-option-' + i;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', i === selectedIndex ? 'true' : 'false');

    const title = document.createElement('span');
    title.className = 'command-palette-item-title';
    title.textContent = command.title;
    item.appendChild(title);

    if (command.hint) {
      const hint = document.createElement('span');
      hint.className = 'command-palette-item-hint';
      hint.textContent = command.hint;
      item.appendChild(hint);
    }

    item.addEventListener('mousemove', () => {
      selectedIndex = i;
      updateSelection();
    });
    item.addEventListener('click', () => runSelected());

    list.appendChild(item);
  });

  updateSelection();
}

function updateSelection() {
  if (!listEl || !input) return;
  const field = input;
  const items = listEl.querySelectorAll('.command-palette-item');
  items.forEach((item, i) => {
    const isSel = i === selectedIndex;
    item.classList.toggle('is-selected', isSel);
    item.setAttribute('aria-selected', isSel ? 'true' : 'false');
    if (isSel) {
      field.setAttribute('aria-activedescendant', item.id);
      if (typeof (/** @type {HTMLElement} */ (item)).scrollIntoView === 'function') {
        (/** @type {HTMLElement} */ (item)).scrollIntoView({ block: 'nearest' });
      }
    }
  });
}

/** @param {number} delta */
function moveSelection(delta) {
  if (visible.length === 0) return;
  selectedIndex = (selectedIndex + delta + visible.length) % visible.length;
  updateSelection();
}

function runSelected() {
  const command = visible[selectedIndex];
  closeCommandPalette();
  if (command && typeof command.run === 'function') {
    command.run();
  }
}

function onInput() {
  if (!input) return;
  visible = filterCommands(registry, input.value.trim());
  selectedIndex = 0;
  renderList();
}

/** @param {KeyboardEvent} e */
function onKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    moveSelection(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveSelection(-1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    runSelected();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeCommandPalette();
  }
}

export function openCommandPalette() {
  if (overlay) return;
  previouslyFocused = document.activeElement;

  overlay = document.createElement('div');
  overlay.className = 'command-palette-overlay';
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closeCommandPalette();
  });

  const dialog = document.createElement('div');
  dialog.className = 'command-palette';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Command palette');

  input = document.createElement('input');
  input.className = 'command-palette-input';
  input.type = 'text';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', 'command-palette-list');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('placeholder', 'Type a command…');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');
  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeydown);

  listEl = document.createElement('ul');
  listEl.className = 'command-palette-list';
  listEl.id = 'command-palette-list';
  listEl.setAttribute('role', 'listbox');

  dialog.appendChild(input);
  dialog.appendChild(listEl);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  visible = filterCommands(registry, '');
  selectedIndex = 0;
  renderList();
  releaseTrap = trapFocus(overlay);
  input.focus();
}

export function closeCommandPalette() {
  if (!overlay) return;
  if (releaseTrap) releaseTrap();
  releaseTrap = null;
  if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  overlay = null;
  input = null;
  listEl = null;
  visible = [];
  selectedIndex = 0;
  // Restore focus to wherever it was before the palette opened.
  if (previouslyFocused && typeof (/** @type {HTMLElement} */ (previouslyFocused)).focus === 'function') {
    (/** @type {HTMLElement} */ (previouslyFocused)).focus();
  }
  previouslyFocused = null;
}

/** Open the palette if closed, close it if open. */
export function toggleCommandPalette() {
  if (overlay) {
    closeCommandPalette();
  } else {
    openCommandPalette();
  }
}
