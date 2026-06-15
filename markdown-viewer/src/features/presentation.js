// @ts-check
// Diagram presentation mode: a focused, full-screen step-through of every
// Mermaid diagram in the current document. Each diagram's already-rendered SVG
// is cloned into a fit-to-screen stage; prev/next (buttons or keyboard) walk the
// set. Self-contained — it doesn't touch the panzoom/fullscreen engine.

import { showToast } from './toast.js';

const el = (/** @type {string} */ id) => document.getElementById(id);

/** @type {HTMLElement | null} */
let presentationOverlay = null;
/** @type {SVGElement[]} */
let diagrams = [];
let slideIndex = 0;
/** @type {Element | null} */
let presentationPrevFocus = null;

/** Collect the rendered diagram SVGs in document order. */
function collectDiagrams() {
  const content = el('markdown-content');
  if (!content) return [];
  /** @type {SVGElement[]} */
  const found = [];
  content.querySelectorAll('.diagram-container').forEach((container) => {
    const svg = container.querySelector('svg');
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

function buildPresentationOverlay() {
  presentationOverlay = document.createElement('div');
  presentationOverlay.className = 'presentation-overlay';
  presentationOverlay.setAttribute('role', 'dialog');
  presentationOverlay.setAttribute('aria-modal', 'true');
  presentationOverlay.setAttribute('aria-label', 'Diagram presentation');
  presentationOverlay.tabIndex = -1;
  presentationOverlay.addEventListener('keydown', onPresentationKeydown);

  const stage = document.createElement('div');
  stage.className = 'presentation-stage';

  const nav = document.createElement('div');
  nav.className = 'presentation-nav';

  const prev = document.createElement('button');
  prev.className = 'presentation-prev';
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous diagram');
  prev.textContent = '‹';
  prev.addEventListener('click', presentPrev);

  const counter = document.createElement('span');
  counter.className = 'presentation-counter';

  const next = document.createElement('button');
  next.className = 'presentation-next';
  next.type = 'button';
  next.setAttribute('aria-label', 'Next diagram');
  next.textContent = '›';
  next.addEventListener('click', presentNext);

  const close = document.createElement('button');
  close.className = 'presentation-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Exit presentation');
  close.textContent = '✕';
  close.addEventListener('click', exitPresentation);

  nav.appendChild(prev);
  nav.appendChild(counter);
  nav.appendChild(next);
  nav.appendChild(close);

  presentationOverlay.appendChild(stage);
  presentationOverlay.appendChild(nav);
  document.body.appendChild(presentationOverlay);
  presentationOverlay.focus();
}

function renderSlide() {
  if (!presentationOverlay) return;
  const stage = presentationOverlay.querySelector('.presentation-stage');
  const counter = presentationOverlay.querySelector('.presentation-counter');
  const prev = /** @type {HTMLButtonElement | null} */ (presentationOverlay.querySelector('.presentation-prev'));
  const next = /** @type {HTMLButtonElement | null} */ (presentationOverlay.querySelector('.presentation-next'));
  if (!stage) return;

  stage.innerHTML = '';
  const svg = diagrams[slideIndex];
  if (svg) {
    const clone = /** @type {SVGElement} */ (svg.cloneNode(true));
    // Strip inline sizing/transform left by panzoom so CSS fit takes over.
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    clone.removeAttribute('style');
    stage.appendChild(clone);
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

export function exitPresentation() {
  if (!presentationOverlay) return;
  if (presentationOverlay.parentNode) presentationOverlay.parentNode.removeChild(presentationOverlay);
  presentationOverlay = null;
  diagrams = [];
  slideIndex = 0;
  if (presentationPrevFocus && typeof (/** @type {HTMLElement} */ (presentationPrevFocus)).focus === 'function') {
    (/** @type {HTMLElement} */ (presentationPrevFocus)).focus();
  }
  presentationPrevFocus = null;
}

/** @param {KeyboardEvent} e */
function onPresentationKeydown(e) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
    e.preventDefault();
    presentNext();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
    e.preventDefault();
    presentPrev();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    exitPresentation();
  }
}
