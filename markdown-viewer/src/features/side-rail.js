// @ts-check
// @ts-expect-error -- Vite stylesheet import
import './side-rail.css';
import { isIOSNative } from '../core/platform.js';
import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
import { canRestoreNonEditableFocus } from '../core/focus-trap.js';

/** @typedef {'explain'|'notes'} SideRailTab */
/** @typedef {{opener?:Element|null, selection?:Range|null, scrollTop?:number}} SideRailOptions */
/** @type {SideRailTab|null} */
let selectedRailTab = null;
/** @type {(() => void)|null} */
let releaseRailLayout = null;
/** @type {{opener:Element|null,selection:Range|null,top:number,left:number,context:ReturnType<typeof captureDocumentContext>}|null} */
let railReturn = null;
/** @type {Animation|null} */
let railAnimation = null;
let preferredRailWidth = 360;
const railSetup = new WeakSet();

export function activeSideRailTab() {
  return selectedRailTab;
}
/** @param {SideRailTab} tab */
export function getSideRailPanel(tab) {
  return document.getElementById(
    tab === 'explain' ? 'explain-rail' : 'annotation-panel'
  );
}
export function sideRailCompact() {
  return (
    window.matchMedia?.('(max-width: 699.98px)').matches ??
    window.innerWidth < 700
  );
}

/** @param {HTMLElement} rail */
function sizeSideRail(rail) {
  const host = rail.parentElement;
  const width = host?.getBoundingClientRect().width || window.innerWidth;
  const sidebars = Array.from(host?.children || []).filter(
    (el) => el !== rail && el.id !== 'content-main'
  );
  const occupied = sidebars.reduce(
    (v, el) => v + el.getBoundingClientRect().width,
    0
  );
  // At intermediate widths preserve document space, down to the narrowest
  // rail a 700px window with a 480px document can accommodate.
  const max = Math.max(220, Math.min(480, Math.floor(width - occupied - 480)));
  const min = Math.min(320, max);
  const effective = Math.min(max, Math.max(min, preferredRailWidth));
  rail.style.setProperty('--sd-rail-effective-width', effective + 'px');
  const handle = rail.querySelector('.sd-rail-resize');
  handle?.setAttribute('aria-valuemin', String(min));
  handle?.setAttribute('aria-valuemax', String(max));
  handle?.setAttribute('aria-valuenow', String(effective));
  const view = window.visualViewport;
  if (view && host) {
    rail.style.setProperty('--sd-rail-viewport-top', view.offsetTop + 'px');
    rail.style.setProperty('--sd-rail-viewport-height', view.height + 'px');
    rail.style.setProperty(
      '--sd-rail-available-height',
      Math.max(
        0,
        view.height + view.offsetTop - host.getBoundingClientRect().top
      ) + 'px'
    );
  }
}

/** @param {HTMLElement} rail @param {number} width @param {boolean} persist */
function updateRailWidth(rail, width, persist) {
  preferredRailWidth = Math.max(320, Math.min(480, Math.round(width)));
  sizeSideRail(rail);
  if (persist) {
    try {
      localStorage.setItem('specdown.railWidth', String(preferredRailWidth));
    } catch {}
  }
}

/** @param {HTMLElement} rail */
function setupSideRail(rail) {
  if (railSetup.has(rail)) return;
  railSetup.add(rail);
  try {
    const raw = Number(localStorage.getItem('specdown.railWidth'));
    preferredRailWidth =
      Number.isFinite(raw) && raw >= 320 && raw <= 480 ? raw : 360;
  } catch {
    preferredRailWidth = 360;
  }
  const handle = /** @type {HTMLElement} */ (
    rail.querySelector('.sd-rail-resize')
  );
  let pointer = -1;
  const dragWidth = (/** @type {PointerEvent} */ e) =>
    rail.getBoundingClientRect().right - e.clientX;
  handle.addEventListener('pointerdown', (e) => {
    if (e.button || sideRailCompact()) return;
    pointer = e.pointerId;
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  handle.addEventListener('pointermove', (e) => {
    if (pointer === e.pointerId) updateRailWidth(rail, dragWidth(e), false);
  });
  handle.addEventListener('pointerup', (e) => {
    if (pointer === e.pointerId) updateRailWidth(rail, dragWidth(e), true);
    pointer = -1;
  });
  handle.addEventListener('lostpointercapture', () => {
    pointer = -1;
  });
  handle.addEventListener('dblclick', () => updateRailWidth(rail, 360, true));
  handle.addEventListener('keydown', (e) => {
    const width = Number(handle.getAttribute('aria-valuenow'));
    const steps = new Map([
      ['ArrowLeft', width + 16],
      ['ArrowRight', width - 16],
      ['Home', 320],
      ['End', Number(handle.getAttribute('aria-valuemax'))],
    ]);
    const next = steps.get(e.key);
    if (next === undefined || sideRailCompact()) return;
    e.preventDefault();
    updateRailWidth(rail, next, true);
  });
  for (const tab of /** @type {const} */ (['explain', 'notes'])) {
    const button = document.getElementById('rail-' + tab + '-tab');
    if (!button) continue;
    button.hidden = tab === 'notes' && isIOSNative;
    button.addEventListener('click', () => openSideRail(tab));
    button.addEventListener('keydown', (e) => {
      if (
        isIOSNative ||
        !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)
      )
        return;
      e.preventDefault();
      const target =
        e.key === 'Home'
          ? 'explain'
          : e.key === 'End'
            ? 'notes'
            : tab === 'notes'
              ? 'explain'
              : 'notes';
      openSideRail(target);
    });
  }
  rail
    .querySelector('.sd-rail-close')
    ?.addEventListener('click', () => closeSideRail());
  rail.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault();
      e.stopPropagation();
      closeSideRail();
      return;
    }
    if (e.key !== 'Tab' || !sideRailCompact()) return;
    const nodes = [
      ...rail.querySelectorAll(
        'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex],summary,a[href]'
      ),
    ].filter(
      (el) =>
        el instanceof HTMLElement &&
        el.tabIndex >= 0 &&
        el !== handle &&
        !el.closest('[hidden],[inert]') &&
        getComputedStyle(el).display !== 'none' &&
        (!el.closest('details:not([open])') ||
          el.matches('details:not([open]) > summary'))
    );
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    const wrap =
      e.shiftKey && document.activeElement === first
        ? last
        : !e.shiftKey && document.activeElement === last
          ? first
          : null;
    if (wrap instanceof HTMLElement) {
      e.preventDefault();
      wrap.focus();
    }
  });
}

/** Keep only the compact rail accessible while leaving overlay note editors usable. @param {HTMLElement} rail */
function watchSideRail(rail) {
  /** @type {Set<HTMLElement>} */
  const isolated = new Set();
  const release = () => {
    for (const sibling of isolated) sibling.removeAttribute('inert');
    isolated.clear();
  };
  const layout = () => {
    sizeSideRail(rail);
    release();
    if (!sideRailCompact()) {
      rail.removeAttribute('aria-modal');
      rail.removeAttribute('role');
      return;
    }
    rail.setAttribute('role', 'dialog');
    rail.setAttribute('aria-modal', 'true');
    for (
      let el = /** @type {HTMLElement|null} */ (rail);
      el && el !== document.body;
      el = el.parentElement
    ) {
      for (const node of el.parentElement?.children || []) {
        if (
          node instanceof HTMLElement &&
          node !== el &&
          !node.hasAttribute('inert') &&
          !['toast-region', 'annotation-editor-backdrop'].includes(node.id)
        ) {
          node.setAttribute('inert', '');
          isolated.add(node);
        }
      }
    }
    if (document.activeElement?.closest('[inert]')) {
      const active = rail.querySelector('[aria-selected="true"]');
      if (active instanceof HTMLElement) active.focus({ preventScroll: true });
    }
  };
  layout();
  const resize =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => sizeSideRail(rail))
      : null;
  if (rail.parentElement) resize?.observe(rail.parentElement);
  for (const id of ['workspace-sidebar', 'toc-sidebar']) {
    const node = document.getElementById(id);
    if (node) resize?.observe(node);
  }
  window.addEventListener('resize', layout);
  const fit = () => sizeSideRail(rail);
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);
  return () => {
    release();
    resize?.disconnect();
    window.removeEventListener('resize', layout);
    window.visualViewport?.removeEventListener('resize', fit);
    window.visualViewport?.removeEventListener('scroll', fit);
    rail.removeAttribute('aria-modal');
    rail.removeAttribute('role');
  };
}

/** @param {SideRailTab|null} tab */
function syncRailToggles(tab) {
  for (const [selector, active] of /** @type {const} */ ([
    ['#annotation-list-toggle,#ios-annotations-button', tab === 'notes'],
    ['[data-reader-action="explain"],#ios-explain', tab === 'explain'],
  ])) {
    for (const node of document.querySelectorAll(selector)) {
      node.classList.toggle('active', active);
      node.setAttribute('aria-expanded', String(active));
      node.setAttribute('aria-controls', 'side-rail');
    }
  }
}

/** @param {HTMLElement} rail @param {boolean} opening */
function animateSideRail(rail, opening) {
  railAnimation?.cancel();
  railAnimation = null;
  if (
    !rail.animate ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
    return;
  const frames = [
    { transform: 'translateX(100%)' },
    { transform: 'translateX(0)' },
  ];
  railAnimation = rail.animate(opening ? frames : frames.reverse(), {
    duration: 200,
    easing: 'ease-out',
  });
  if (!opening)
    railAnimation.onfinish = () => {
      if (!selectedRailTab) rail.hidden = true;
    };
}

/** @param {SideRailTab} tab @param {SideRailOptions} [options] */
export function openSideRail(tab, options = {}) {
  const rail = document.getElementById('side-rail');
  const reader = document.getElementById('markdown-content');
  if (!rail || !reader || (isIOSNative && tab === 'notes')) return;
  setupSideRail(rail);
  const previous = selectedRailTab;
  if (previous === tab) return;
  if (!previous) {
    const sel = window.getSelection();
    const range =
      options.selection === undefined && sel?.rangeCount
        ? sel.getRangeAt(0)
        : options.selection;
    railReturn = {
      context: captureDocumentContext(),
      opener: options.opener ?? document.activeElement,
      selection:
        range && reader.contains(range.commonAncestorContainer)
          ? range.cloneRange()
          : null,
      top: options.scrollTop ?? reader.scrollTop,
      left: reader.scrollLeft,
    };
  }
  selectedRailTab = tab;
  rail.hidden = false;
  rail.removeAttribute('inert');
  document.body.classList.add('side-rail-open');
  for (const name of /** @type {const} */ (['explain', 'notes'])) {
    const button = document.getElementById('rail-' + name + '-tab');
    button?.setAttribute('aria-selected', String(tab === name));
    button?.setAttribute('tabindex', tab === name ? '0' : '-1');
    const panel = getSideRailPanel(name);
    if (panel) panel.hidden = tab !== name;
  }
  if (!previous) {
    releaseRailLayout = watchSideRail(rail);
    animateSideRail(rail, true);
  }
  syncRailToggles(tab);
  document
    .getElementById('rail-' + tab + '-tab')
    ?.focus({ preventScroll: true });
  document.dispatchEvent(
    new CustomEvent('specdown-rail-change', { detail: { tab, previous } })
  );
}

export function closeSideRail(restore = true) {
  const previous = selectedRailTab;
  const rail = document.getElementById('side-rail');
  if (!previous || !rail) return;
  selectedRailTab = null;
  releaseRailLayout?.();
  releaseRailLayout = null;
  document.body.classList.remove('side-rail-open');
  syncRailToggles(null);
  rail.setAttribute('inert', '');
  animateSideRail(rail, false);
  if (!railAnimation) rail.hidden = true;
  const reader = document.getElementById('markdown-content');
  if (restore && railReturn && reader) {
    const target = [
      railReturn.opener,
      document.getElementById('ios-more-button'),
      document.getElementById('overflow-toggle'),
      reader,
    ].find(canRestoreNonEditableFocus);
    target?.focus({ preventScroll: true });
    if (isDocumentContextCurrent(railReturn.context)) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      if (
        railReturn.selection &&
        reader.contains(railReturn.selection.commonAncestorContainer)
      )
        selection?.addRange(railReturn.selection);
      reader.scrollTop = railReturn.top;
      reader.scrollLeft = railReturn.left;
    }
  }
  railReturn = null;
  document.dispatchEvent(
    new CustomEvent('specdown-rail-change', { detail: { tab: null, previous } })
  );
}
