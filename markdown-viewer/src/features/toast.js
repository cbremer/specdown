// @ts-check
// Accessible, auto-dismissing toast notifications.
//
// Replaces blocking `alert()` calls: alert() steals focus, halts execution,
// can't be styled or themed, and is announced inconsistently by screen readers.
// Each toast is appended to a shared region and carries `role="status"` (polite)
// or, for errors, `role="alert"` (assertive) so assistive tech announces it
// without trapping focus. Toasts auto-dismiss and are click-to-dismiss.

/** @typedef {'info' | 'success' | 'warning' | 'error'} ToastType */

/** Default visible durations (ms) per type; errors linger longest. */
const DEFAULT_DURATIONS = /** @type {Record<ToastType, number>} */ ({
  info: 3000,
  success: 2500,
  warning: 4000,
  error: 5000,
});

/**
 * Get (or lazily create) the shared toast region appended to <body>.
 * @returns {HTMLElement}
 */
function getRegion() {
  let region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.className = 'toast-region';
    document.body.appendChild(region);
  }
  return region;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {{ type?: ToastType, duration?: number, action?: { label: string, onClick: () => void } }} [options]
 * @returns {HTMLElement} the created toast element
 */
export function showToast(message, options = {}) {
  const type = options.type || 'info';
  const region = getRegion();

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  // role="alert" is assertive (interrupts); role="status" is polite. Errors
  // warrant an immediate announcement, everything else stays polite.
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const action = options.action;
  if (action) {
    // An actionable toast (e.g. "Update ready · Restart now") keeps the label in
    // its own span so the button is a distinct, clickable target.
    toast.classList.add('toast-has-action');
    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = message;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = action.label;
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      action.onClick();
      dismissToast(toast);
    });
    toast.append(text, button);
  } else {
    toast.textContent = message;
  }
  toast.addEventListener('click', () => dismissToast(toast));
  region.appendChild(toast);

  const duration = options.duration != null ? options.duration : DEFAULT_DURATIONS[type];
  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }

  return toast;
}

/**
 * Remove a toast from the DOM.
 * @param {HTMLElement} toast
 */
export function dismissToast(toast) {
  if (toast && toast.parentNode) {
    toast.parentNode.removeChild(toast);
  }
}
