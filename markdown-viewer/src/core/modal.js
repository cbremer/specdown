// @ts-check
// Shared modal dialog: the design system's Modal (Dialog variant), see
// design-system/components/Modal/README.md. Builds the scrim, panel, header
// (title + close button), scrolling body and an optional footer, and wires the
// three dismissals every modal must support: Escape, the close button and a
// click on the scrim. The caller owns open/close state, the focus trap and
// focus restoration, exactly as before; this only removes the duplicated DOM.
//
// Names are prefixed (sdModal…) because the test harness evals every module at
// global scope, where module-private names can collide.

import { iconSvg } from './icons.js';

/**
 * @typedef {object} SdModalOptions
 * @property {string} title Visible title; also names the dialog.
 * @property {string} [titleId] id for the title element (aria-labelledby target).
 * @property {'sm' | 'md' | 'lg'} [size] Panel width: small, medium (default) or large.
 * @property {string} [scrimClass] Extra class on the scrim (a stable hook).
 * @property {string} [dialogClass] Extra class on the panel (a stable hook).
 * @property {() => void} onClose Called for Escape, the close button and a scrim click.
 */

/**
 * @typedef {object} SdModal
 * @property {HTMLDivElement} scrim
 * @property {HTMLDivElement} dialog
 * @property {HTMLHeadingElement} title
 * @property {HTMLDivElement} body
 * @property {() => HTMLDivElement} footer Creates the footer on first call.
 */

let sdModalCount = 0;

/**
 * Build a modal. The caller appends `scrim` to the document, traps focus in it
 * and focuses `dialog` (or a field inside it).
 * @param {SdModalOptions} options
 * @returns {SdModal}
 */
export function createSdModal(options) {
  const sdModalTitleId = options.titleId || `sd-modal-title-${++sdModalCount}`;

  const scrim = document.createElement('div');
  scrim.className = ['sd-scrim', options.scrimClass].filter(Boolean).join(' ');
  scrim.addEventListener('mousedown', (event) => {
    if (event.target === scrim) options.onClose();
  });

  const dialog = document.createElement('div');
  const sizeClass =
    options.size === 'sm' || options.size === 'lg'
      ? `sd-modal--${options.size}`
      : '';
  dialog.className = ['sd-modal', sizeClass, options.dialogClass]
    .filter(Boolean)
    .join(' ');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', sdModalTitleId);
  dialog.tabIndex = -1;
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      options.onClose();
    }
  });

  const header = document.createElement('div');
  header.className = 'sd-modal-header';

  const title = document.createElement('h2');
  title.id = sdModalTitleId;
  title.className = 'sd-modal-title';
  title.textContent = options.title;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'sd-modal-close';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = iconSvg('x');
  close.addEventListener('click', () => options.onClose());

  header.appendChild(title);
  header.appendChild(close);

  const body = document.createElement('div');
  body.className = 'sd-modal-body';

  dialog.appendChild(header);
  dialog.appendChild(body);
  scrim.appendChild(dialog);

  /** @type {HTMLDivElement | null} */
  let sdModalFooter = null;
  const footer = () => {
    if (!sdModalFooter) {
      sdModalFooter = document.createElement('div');
      sdModalFooter.className = 'sd-modal-footer';
      dialog.appendChild(sdModalFooter);
    }
    return sdModalFooter;
  };

  return { scrim, dialog, title, body, footer };
}
