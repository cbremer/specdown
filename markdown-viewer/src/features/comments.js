// @ts-check
// HTML-comment visibility. Authored `<!-- … -->` comments are revealed in the
// preview as styled blocks (see core/utils.js revealHtmlComments + the
// DOMPurify `ADD_TAGS: ['#comment']` that lets them survive sanitization). This
// module owns the show/hide toggle: comments are shown by default, and the user
// can hide them for a clean reading view (preference persisted).

const COMMENTS_HIDDEN_KEY = 'specdown-hide-comments';

const cEl = (/** @type {string} */ id) => document.getElementById(id);

let commentsHidden = (() => {
  try {
    return localStorage.getItem(COMMENTS_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
})();

/** Apply the current visibility to the content + toggle button. */
function applyCommentsVisibility() {
  const content = cEl('markdown-content');
  if (content) content.classList.toggle('comments-hidden', commentsHidden);
  const btn = cEl('comments-toggle');
  if (btn) btn.classList.toggle('active', !commentsHidden); // active = showing
}

/** Toggle comment visibility and persist the choice. */
export function toggleComments() {
  commentsHidden = !commentsHidden;
  try {
    localStorage.setItem(COMMENTS_HIDDEN_KEY, commentsHidden ? '1' : '0');
  } catch {
    // non-critical
  }
  applyCommentsVisibility();
}

/**
 * Refresh the toolbar toggle for the current document: shown only when the doc
 * has revealed comments, with a count, and the visibility class re-applied.
 * Call after each render.
 */
export function refreshCommentsUI() {
  const content = cEl('markdown-content');
  const btn = cEl('comments-toggle');
  const count = content
    ? content.querySelectorAll('.html-comment-block').length
    : 0;
  if (btn) {
    btn.style.display = count > 0 ? '' : 'none';
    const countEl = btn.querySelector('.comments-toggle-count');
    if (countEl) countEl.textContent = String(count);
  }
  applyCommentsVisibility();
}

/** Wire the comments toggle button. */
export function setupComments() {
  const btn = cEl('comments-toggle');
  if (btn) btn.addEventListener('click', () => toggleComments());
}
