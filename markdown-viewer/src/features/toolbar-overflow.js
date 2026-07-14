// @ts-check
// Toolbar overflow menu: the "⋮" button is visible at every width and its menu
// is the COMPLETE list of document actions — the toolbar keeps only the
// high-frequency shortcuts (Contents, Split, Annotate, Present, Search)
// visible, and everything else (`.overflow-only` buttons: Watch, Workspace
// files, author comments, annotations list, Print, Raw) lives here. Menu items
// are thin proxies that `.click()` the real toolbar buttons, so there is no
// duplicated action logic — whatever the buttons do, the menu does. A button
// whose inline style is display:none is feature-gated off (e.g. Present with
// no diagrams, Watch outside desktop) and is skipped.

const el = (/** @type {string} */ id) => document.getElementById(id);

/** @type {Array<{ targetId: string, label: string }>} */
const OVERFLOW_ACTIONS = [
  { targetId: 'watch-toggle', label: 'Watch file for changes' },
  { targetId: 'workspace-toggle', label: 'Workspace files' },
  { targetId: 'toc-toggle', label: 'Table of contents' },
  { targetId: 'split-toggle', label: 'Split view' },
  { targetId: 'annotation-toggle', label: 'Annotate' },
  { targetId: 'annotation-list-toggle', label: 'Annotations list' },
  { targetId: 'comments-toggle', label: 'Show author comments' },
  { targetId: 'present-button', label: 'Present diagrams' },
  { targetId: 'print-button', label: 'Print / Save as PDF' },
  { targetId: 'view-toggle', label: 'Toggle raw / preview' },
];

/** @type {HTMLElement | null} */
let menu = null;

export function isOverflowMenuOpen() {
  return menu !== null;
}

export function openOverflowMenu() {
  if (menu) return;
  const toggle = el('overflow-toggle');
  if (!toggle) return;

  const built = document.createElement('div');
  built.className = 'overflow-menu';
  built.setAttribute('role', 'menu');

  for (const action of OVERFLOW_ACTIONS) {
    const target = el(action.targetId);
    if (!target) continue;
    // Skip actions whose button is inline-hidden (e.g. Present with no diagrams).
    if (target.style.display === 'none') continue;
    const item = document.createElement('button');
    item.className = 'overflow-menu-item';
    item.setAttribute('role', 'menuitem');
    item.textContent = action.label;
    item.addEventListener('click', () => {
      closeOverflowMenu();
      const proxied = el(action.targetId);
      if (proxied) proxied.click();
    });
    built.appendChild(item);
  }

  // Anchor inside the toolbar so it positions under the toggle.
  (toggle.parentElement || document.body).appendChild(built);
  menu = built;
  toggle.setAttribute('aria-expanded', 'true');

  // Defer so the opening click doesn't immediately close it.
  setTimeout(() => document.addEventListener('click', onOutsideClick), 0);
}

export function closeOverflowMenu() {
  if (!menu) return;
  if (menu.parentNode) menu.parentNode.removeChild(menu);
  menu = null;
  const toggle = el('overflow-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', onOutsideClick);
}

export function toggleOverflowMenu() {
  if (menu) {
    closeOverflowMenu();
  } else {
    openOverflowMenu();
  }
}

/** @param {Event} e */
function onOutsideClick(e) {
  const toggle = el('overflow-toggle');
  const target = /** @type {Node} */ (e.target);
  if (menu && !menu.contains(target) && toggle && !toggle.contains(target)) {
    closeOverflowMenu();
  }
}

export function setupToolbarOverflow() {
  const toggle = el('overflow-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleOverflowMenu();
  });
}
