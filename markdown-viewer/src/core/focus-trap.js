// @ts-check
// Minimal focus trap for modal surfaces (command palette, shortcuts sheet,
// presentation overlay, repo browser, iOS sheets). `aria-modal` alone does not
// stop Tab from walking into the background page — WCAG 2.4.3 requires the
// trap. Focus restoration to the opener stays the caller's job (most modals
// here already track `previouslyFocused`).

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Return only usable non-editable targets: closing must not reopen a keyboard.
 * @param {Element | null | undefined} target
 * @returns {target is HTMLElement}
 */
export function canRestoreNonEditableFocus(target) {
  if (
    !(target instanceof HTMLElement) ||
    !target.isConnected ||
    !target.matches('button, a[href], [tabindex]') ||
    target.matches('input, textarea, select, :disabled') ||
    target.closest(
      '[contenteditable]:not([contenteditable="false"]), [hidden], [inert]'
    )
  )
    return false;
  for (
    let node = /** @type {HTMLElement | null} */ (target);
    node;
    node = node.parentElement
  ) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

/**
 * Trap Tab / Shift+Tab inside `container` until released.
 * @param {HTMLElement} container
 * @returns {() => void} release function (idempotent)
 */
export function trapFocus(container) {
  /** @param {KeyboardEvent} e */
  const onKeydown = (e) => {
    if (e.key !== 'Tab') return;

    // No layout-based visibility filter (offsetParent is always null in jsdom
    // and the modals here are small, fully-visible surfaces) — only skip
    // elements explicitly marked hidden.
    const focusables = /** @type {HTMLElement[]} */ (
      Array.from(container.querySelectorAll(FOCUSABLE))
    ).filter((n) => !n.hasAttribute('hidden') && n.style.display !== 'none');
    if (focusables.length === 0) {
      // Nothing tabbable inside: keep focus pinned on the container itself.
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !container.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', onKeydown);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    container.removeEventListener('keydown', onKeydown);
  };
}
