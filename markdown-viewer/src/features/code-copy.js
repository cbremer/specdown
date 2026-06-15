// @ts-check
// Copy-to-clipboard buttons on rendered code blocks. After each render, every
// `<pre><code>` gets a hover "Copy" button that copies the block's text. Works
// on all surfaces; the button is excluded from print output.

const COPIED_RESET_MS = 1500;

/**
 * Copy text to the clipboard, with a legacy fallback for non-secure contexts.
 * @param {string} text
 * @returns {Promise<void>}
 */
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback: a temporary off-screen textarea + execCommand.
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Add a copy button to every code block inside `container`.
 * @param {HTMLElement} container
 */
export function enhanceCodeBlocks(container) {
  if (!container) return;
  container.querySelectorAll('pre').forEach((pre) => {
    const code = pre.querySelector('code');
    if (!code) return;
    // Idempotent: skip if already enhanced.
    if (pre.querySelector('.code-copy-btn')) return;
    pre.classList.add('has-code-copy');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy-btn';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code to clipboard');

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(code.textContent || '').then(
        () => flash(button, 'Copied'),
        () => flash(button, 'Failed')
      );
    });

    pre.appendChild(button);
  });
}

/**
 * Briefly show feedback text on the button, then restore "Copy".
 * @param {HTMLButtonElement} button
 * @param {string} label
 */
function flash(button, label) {
  button.textContent = label;
  button.classList.add('is-copied');
  setTimeout(() => {
    button.textContent = 'Copy';
    button.classList.remove('is-copied');
  }, COPIED_RESET_MS);
}
