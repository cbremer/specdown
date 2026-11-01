// @ts-check
// Diagram presentation mode: a focused, full-screen step-through of every
// Mermaid diagram in the current document. Each diagram's already-rendered SVG
// is cloned into a stage with pan/zoom (via the bundled Panzoom); prev/next
// (buttons or keyboard) walk the set.

import { trapFocus, canRestoreNonEditableFocus } from '../core/focus-trap.js';
import Panzoom from '@panzoom/panzoom';
import { showToast } from './toast.js';

/** @typedef {import('@panzoom/panzoom').PanzoomObject} PanzoomObject */

const el = (/** @type {string} */ id) => document.getElementById(id);

/** @type {HTMLElement | null} */
let presentationOverlay = null;
/** @type {SVGElement[]} */
let diagrams = [];
let slideIndex = 0;
/** @type {Element | null} */
let presentationPrevFocus = null;
/** @type {(() => void) | null} */
let presentationReleaseTrap = null;
/** @type {PanzoomObject | null} */
let slidePanzoom = null;

/** Collect the rendered diagram SVGs in document order. */
function collectDiagrams() {
  const content = el('markdown-content');
  if (!content) return [];
  /** @type {SVGElement[]} */
  const found = [];
  content.querySelectorAll('.diagram-container').forEach((container) => {
    // Scope to the wrapper: the container's controls come FIRST and contain
    // SVG icon buttons (reset/share/fullscreen), so a bare 'svg' query
    // returns the reset icon — which is how presentation mode ended up
    // showing a giant loop-arrow instead of the diagram.
    const svg = container.querySelector('.diagram-wrapper svg');
    if (svg) found.push(/** @type {SVGElement} */ (svg));
  });
  return found;
}

/** True when the current document has at least one diagram to present. */
export function hasPresentableDiagrams() {
  return collectDiagrams().length > 0;
}

export function isPresentationOpen() {
  return presentationOverlay !== null;
}

export function startPresentation() {
  if (presentationOverlay) return;
  diagrams = collectDiagrams();
  if (diagrams.length === 0) {
    showToast('No diagrams to present in this document.', { type: 'info' });
    return;
  }
  slideIndex = 0;
  presentationPrevFocus = document.activeElement;
  buildPresentationOverlay();
  renderSlide();
}

/**
 * @param {string} className
 * @param {string} label
 * @param {string} ariaLabel
 * @param {() => void} onClick
 * @returns {HTMLButtonElement}
 */
function navButton(className, label, ariaLabel, onClick) {
  const owner = presentationOverlay;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.setAttribute('aria-label', ariaLabel);
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!owner?.isConnected || presentationOverlay !== owner) return;
    onClick();
  });
  return button;
}

function buildPresentationOverlay() {
  presentationOverlay = document.createElement('div');
  const owner = presentationOverlay;
  presentationOverlay.className = 'presentation-overlay';
  presentationOverlay.setAttribute('role', 'dialog');
  presentationOverlay.setAttribute('aria-modal', 'true');
  presentationOverlay.setAttribute('aria-label', 'Diagram presentation');
  presentationOverlay.tabIndex = -1;
  presentationOverlay.addEventListener('keydown', onPresentationKeydown);

  const stage = document.createElement('div');
  stage.className = 'presentation-stage';
  // Wheel zoom on the stage drives the current slide's panzoom.
  stage.addEventListener(
    'wheel',
    (e) => {
      if (presentationOverlay === owner && owner.isConnected && slidePanzoom) {
        e.preventDefault();
        slidePanzoom.zoomWithWheel(e);
      }
    },
    { passive: false }
  );

  const nav = document.createElement('div');
  nav.className = 'presentation-nav';

  const prev = navButton(
    'presentation-prev',
    '‹',
    'Previous diagram',
    presentPrev
  );
  const counter = document.createElement('span');
  counter.className = 'presentation-counter';
  const next = navButton('presentation-next', '›', 'Next diagram', presentNext);

  const zoomOut = navButton('presentation-zoom-out', '−', 'Zoom out', () => {
    if (slidePanzoom) slidePanzoom.zoomOut();
  });
  const zoomFit = navButton('presentation-zoom-fit', '⤢', 'Reset zoom', () => {
    if (slidePanzoom) slidePanzoom.reset();
  });
  const zoomIn = navButton('presentation-zoom-in', '+', 'Zoom in', () => {
    if (slidePanzoom) slidePanzoom.zoomIn();
  });

  const close = navButton(
    'presentation-close',
    '✕',
    'Exit presentation',
    exitPresentation
  );

  nav.appendChild(prev);
  nav.appendChild(counter);
  nav.appendChild(next);
  nav.appendChild(zoomOut);
  nav.appendChild(zoomFit);
  nav.appendChild(zoomIn);
  nav.appendChild(close);

  presentationOverlay.appendChild(stage);
  presentationOverlay.appendChild(nav);
  document.body.appendChild(presentationOverlay);
  presentationReleaseTrap = trapFocus(presentationOverlay);
  presentationOverlay.focus({ preventScroll: true });
}

function destroySlidePanzoom() {
  if (slidePanzoom) {
    try {
      slidePanzoom.destroy();
    } catch {
      // ignore
    }
    slidePanzoom = null;
  }
}

function renderSlide() {
  if (!presentationOverlay) return;
  const stage = presentationOverlay.querySelector('.presentation-stage');
  const counter = presentationOverlay.querySelector('.presentation-counter');
  const prev = /** @type {HTMLButtonElement | null} */ (
    presentationOverlay.querySelector('.presentation-prev')
  );
  const next = /** @type {HTMLButtonElement | null} */ (
    presentationOverlay.querySelector('.presentation-next')
  );
  if (!stage) return;

  destroySlidePanzoom();
  stage.innerHTML = '';
  const svg = diagrams[slideIndex];
  if (svg) {
    const clone = /** @type {SVGElement} */ (svg.cloneNode(true));
    // Strip inline sizing/transform left by panzoom so CSS fit takes over.
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    clone.removeAttribute('style');
    stage.appendChild(clone);
    slidePanzoom = Panzoom(clone, {
      maxScale: 8,
      minScale: 0.5,
      step: 0.3,
      cursor: 'grab',
    });
  }

  if (counter) counter.textContent = `${slideIndex + 1} / ${diagrams.length}`;
  if (prev) prev.disabled = slideIndex === 0;
  if (next) next.disabled = slideIndex === diagrams.length - 1;
}

export function presentNext() {
  if (slideIndex < diagrams.length - 1) {
    slideIndex += 1;
    renderSlide();
  }
}

export function presentPrev() {
  if (slideIndex > 0) {
    slideIndex -= 1;
    renderSlide();
  }
}

/** @param {{ restoreFocus?: boolean }} [options] */
export function exitPresentation({ restoreFocus = true } = {}) {
  if (!presentationOverlay) return;
  const ownedFocus = presentationOverlay.contains(document.activeElement);
  if (presentationReleaseTrap) presentationReleaseTrap();
  presentationReleaseTrap = null;
  presentationOverlay.removeEventListener('keydown', onPresentationKeydown);
  destroySlidePanzoom();
  if (presentationOverlay.parentNode)
    presentationOverlay.parentNode.removeChild(presentationOverlay);
  presentationOverlay = null;
  diagrams = [];
  slideIndex = 0;
  // A newer dialog may own focus while presentation is closed. Otherwise,
  // return to a usable non-text opener without resurrecting its keyboard.
  if (restoreFocus && ownedFocus) {
    const target = canRestoreNonEditableFocus(presentationPrevFocus)
      ? presentationPrevFocus
      : el('markdown-content');
    if (canRestoreNonEditableFocus(target))
      target.focus({ preventScroll: true });
  }
  presentationPrevFocus = null;
}

/** @param {KeyboardEvent} e */
function onPresentationKeydown(e) {
  if (
    e.defaultPrevented ||
    !presentationOverlay?.contains(document.activeElement)
  )
    return;
  if (e.key === 'Tab' && document.activeElement === presentationOverlay) {
    // Enter from tabindex=-1 through the currently enabled nav controls;
    // the shared trap handles wrapping once a control owns focus.
    const controls = /** @type {NodeListOf<HTMLButtonElement>} */ (
      presentationOverlay.querySelectorAll('button:not([disabled])')
    );
    const target = controls[e.shiftKey ? controls.length - 1 : 0];
    e.preventDefault();
    target?.focus({ preventScroll: true });
    return;
  }
  // Let Space activate a focused button instead of advancing the slide.
  if (
    e.key === ' ' &&
    e.target instanceof Element &&
    e.target.closest('button')
  )
    return;
  if (
    e.key === 'ArrowRight' ||
    e.key === 'ArrowDown' ||
    e.key === 'PageDown' ||
    e.key === ' '
  ) {
    e.preventDefault();
    presentNext();
  } else if (
    e.key === 'ArrowLeft' ||
    e.key === 'ArrowUp' ||
    e.key === 'PageUp'
  ) {
    e.preventDefault();
    presentPrev();
  } else if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    if (slidePanzoom) slidePanzoom.zoomIn();
  } else if (e.key === '-') {
    e.preventDefault();
    if (slidePanzoom) slidePanzoom.zoomOut();
  } else if (e.key === '0') {
    e.preventDefault();
    if (slidePanzoom) slidePanzoom.reset();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    exitPresentation();
  }
}
