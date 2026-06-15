// @ts-check
// Recent files: remember recently-opened documents and offer one-click re-open
// from the empty-state drop zone. Persisted in localStorage.
//
// Scope: URLs only. Browser-picked local files can't be reopened by path (the
// File System Access security model), so they're intentionally not recorded —
// only things the app can actually re-fetch (URLs, incl. GitHub raw links).

const RECENT_KEY = 'specdown-recent-files';
const RECENT_MAX = 8;
const el = (/** @type {string} */ id) => document.getElementById(id);

/**
 * @typedef {object} RecentEntry
 * @property {'url'} type
 * @property {string} ref The re-openable reference (the URL).
 * @property {string} title Display label.
 */

/** @type {RecentEntry[]} */
let recentEntries = loadRecent();
/** @type {(entry: RecentEntry) => void} */
let selectRecent = () => {};

function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function persistRecent() {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentEntries));
  } catch (e) {
    // quota / unavailable — non-critical
  }
}

/** @param {{ onSelect?: (entry: RecentEntry) => void }} [deps] */
export function configureRecentFiles(deps) {
  if (deps && typeof deps.onSelect === 'function') selectRecent = deps.onSelect;
}

/** @returns {RecentEntry[]} */
export function getRecentFiles() {
  return recentEntries.slice();
}

/**
 * Record a freshly-opened document at the top of the recents (most-recent-first,
 * de-duplicated by ref, capped).
 * @param {{ type?: 'url', ref: string, title?: string }} entry
 */
export function recordRecentFile(entry) {
  if (!entry || !entry.ref) return;
  recentEntries = recentEntries.filter((e) => e.ref !== entry.ref);
  recentEntries.unshift({ type: 'url', ref: entry.ref, title: entry.title || entry.ref });
  if (recentEntries.length > RECENT_MAX) {
    recentEntries = recentEntries.slice(0, RECENT_MAX);
  }
  persistRecent();
}

export function clearRecentFiles() {
  recentEntries = [];
  persistRecent();
}

/**
 * Session restore: re-open the most recently opened document via the configured
 * `onSelect`. No-op when there's nothing to restore. Callers gate this to the
 * web surface (the native shells have their own session handling).
 */
export function restoreLastSession() {
  if (recentEntries.length > 0) {
    selectRecent(recentEntries[0]);
  }
}

/** Render the recents into the drop-zone section, hiding it when empty. */
export function renderRecentFiles() {
  const section = el('recent-files-section');
  const list = el('recent-files-list');
  if (!section || !list) return;

  list.innerHTML = '';
  if (recentEntries.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  for (const entry of recentEntries) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'recent-file-item';
    btn.textContent = entry.title;
    btn.title = entry.ref;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectRecent(entry);
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
}
