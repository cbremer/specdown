// @ts-check
// Web-only empty-state showcase. Desktop and iOS keep the compact drop-zone.
//
// Named uniquely (landing* prefixes): the test harness
// (tests/helpers/loadApp.js) flattens every module to global scope.

import { isDesktop, isIOSNative } from '../core/platform.js';
import { showToast } from './toast.js';
import { renderStandaloneMermaid } from './diagrams.js';

const landingEl = (/** @type {string} */ id) => document.getElementById(id);

const LANDING_SECTION_IDS = [
  'landing-hero',
  'web-sample-section',
  'landing-diagram-host',
  'landing-pillars',
  'landing-desktop',
];

const LANDING_SHOWCASE_SAMPLE = 'diagram-showcase.md';
const LANDING_ALLOWED_SAMPLES = new Set([
  'sample.md',
  'sample-with-mermaid.md',
  LANDING_SHOWCASE_SAMPLE,
]);

/** Canned architecture diagram for the web empty state (LinkedIn aha). */
const LANDING_MERMAID_SOURCE = `flowchart LR
  drop[Drop a spec] --> view[Read it]
  view --> zoom[Pan and zoom diagrams]
  zoom --> present[Present the room]`;

const LANDING_CLICK_IGNORE_SELECTOR = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'label',
  '.url-section',
  '.recent-files-section',
  '.sample-section',
  '.landing-interactive',
  '.diagram-container',
  '.landing-hero',
  '#landing-space-canvas',
  '#landing-cursor-core',
].join(', ');

/** @type {(filename: string, content?: string, filePath?: string | null, sourceMeta?: import('../core/state.js').TabSourceMeta | null) => void} */
let openTabFromLanding = () => {};

/**
 * @param {{ createTab?: Function }} [deps]
 */
export function configureLanding(deps) {
  if (deps && typeof deps.createTab === 'function') {
    openTabFromLanding = /** @type {typeof openTabFromLanding} */ (
      deps.createTab
    );
  }
}

/** Web browser surface (not Electron, not iOS WKWebView). */
export function isWebLandingSurface() {
  return !isDesktop && !isIOSNative;
}

/**
 * Clicks on showcase chrome must not open the file picker. The drop card
 * (`.landing-drop-core`) and empty padding still browse.
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
export function isLandingDropClickIgnored(target) {
  if (!(target instanceof Element)) return false;
  return !!target.closest(LANDING_CLICK_IGNORE_SELECTOR);
}

/**
 * Fetch a bundled sample on the web surface. iOS uses the native bridge
 * instead (see requestBundledSampleIfAvailable).
 * @param {string} sampleName
 */
export async function openLandingBundledSample(sampleName) {
  if (!LANDING_ALLOWED_SAMPLES.has(sampleName)) return;
  try {
    const url = new URL(`./samples/${sampleName}`, window.location.href).href;
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) {
      showToast('Could not load the sample document.', { type: 'error' });
      return;
    }
    const markdown = await response.text();
    openTabFromLanding(sampleName, markdown, null, { url });
  } catch {
    showToast('Could not load the sample document.', { type: 'error' });
  }
}

/**
 * Render the canned Mermaid into `#landing-diagram`. Skipped when the host has
 * no layout box (jsdom) so init does not pull in the Mermaid engine under test.
 * @param {boolean} [force]
 */
export async function renderLandingMermaidDiagram(force) {
  const host = landingEl('landing-diagram');
  if (!host) return;
  if (!force) {
    const box = host.getBoundingClientRect();
    if (box.width < 1) return;
  }
  await renderStandaloneMermaid(
    host,
    LANDING_MERMAID_SOURCE,
    'landing-diagram'
  );
}

/** Reveal showcase sections and kick off the live diagram (web only). */
export function setupWebLanding() {
  if (!isWebLandingSurface()) return;
  const dropZone = landingEl('drop-zone');
  if (dropZone) dropZone.classList.add('web-showcase');
  for (const id of LANDING_SECTION_IDS) {
    const node = landingEl(id);
    if (node) node.hidden = false;
  }
  void renderLandingMermaidDiagram();
  setupLandingSpaceField();
}

/**
 * Starfield + cursor gravity well for the web empty state. Stars spring back
 * to a home position but part around the pointer, leaving a void bubble.
 * Skipped when the canvas has no layout box (jsdom) or the user prefers
 * reduced motion — CSS nebula still paints.
 */
function setupLandingSpaceField() {
  const dropZone = landingEl('drop-zone');
  if (!dropZone) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'landing-space-canvas';
  canvas.className = 'landing-space-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  dropZone.insertBefore(canvas, dropZone.firstChild);

  const cursorCore = document.createElement('div');
  cursorCore.id = 'landing-cursor-core';
  cursorCore.className = 'landing-cursor-core';
  cursorCore.setAttribute('aria-hidden', 'true');
  cursorCore.innerHTML =
    '<span class="landing-cursor-ring"></span><span class="landing-cursor-dot"></span>';
  dropZone.insertBefore(cursorCore, canvas.nextSibling);

  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  if (!ctx || reduceMotion) return;
  if (dropZone.getBoundingClientRect().width < 1) return;

  const landingSpaceZone = dropZone;
  const landingSpaceCtx = ctx;

  const LANDING_SPACE_STAR_COUNT = 120;
  const LANDING_SPACE_WARP_RADIUS = 140;
  /** @type {{ x: number, y: number, homeX: number, homeY: number, r: number, tw: number, drift: number }[]} */
  const landingSpaceStars = [];
  const landingSpaceMouse = { x: -9999, y: -9999 };
  const landingSpaceCore = { x: -9999, y: -9999 };
  let landingSpaceW = 0;
  let landingSpaceH = 0;
  let landingSpaceDpr = 1;

  function landingSpaceResize() {
    const box = landingSpaceZone.getBoundingClientRect();
    landingSpaceW = Math.max(1, Math.floor(box.width));
    landingSpaceH = Math.max(1, Math.floor(box.height));
    landingSpaceDpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(landingSpaceW * landingSpaceDpr);
    canvas.height = Math.floor(landingSpaceH * landingSpaceDpr);
    canvas.style.width = landingSpaceW + 'px';
    canvas.style.height = landingSpaceH + 'px';
    canvas.style.top = landingSpaceZone.scrollTop + 'px';
    landingSpaceCtx.setTransform(landingSpaceDpr, 0, 0, landingSpaceDpr, 0, 0);
  }

  function landingSpaceSeed() {
    landingSpaceStars.length = 0;
    for (let i = 0; i < LANDING_SPACE_STAR_COUNT; i++) {
      const x = Math.random() * landingSpaceW;
      const y = Math.random() * landingSpaceH;
      landingSpaceStars.push({
        x,
        y,
        homeX: x,
        homeY: y,
        r: Math.random() * 1.6 + 0.4,
        tw: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.15,
      });
    }
  }

  function landingSpacePalette() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark
      ? {
          star: 'rgba(220, 235, 255, 0.9)',
          warm: 'rgba(255, 140, 90, 0.85)',
          link: 'rgba(122, 184, 245, 0.16)',
        }
      : {
          star: 'rgba(22, 58, 99, 0.42)',
          warm: 'rgba(224, 90, 42, 0.8)',
          link: 'rgba(31, 107, 184, 0.2)',
        };
  }

  function landingSpaceTick() {
    requestAnimationFrame(landingSpaceTick);
    if (landingSpaceZone.style.display === 'none') return;

    const box = landingSpaceZone.getBoundingClientRect();
    if (box.width !== landingSpaceW || box.height !== landingSpaceH) {
      landingSpaceResize();
    }
    canvas.style.top = landingSpaceZone.scrollTop + 'px';

    landingSpaceCore.x += (landingSpaceMouse.x - landingSpaceCore.x) * 0.18;
    landingSpaceCore.y += (landingSpaceMouse.y - landingSpaceCore.y) * 0.18;
    cursorCore.style.top = landingSpaceZone.scrollTop + 'px';
    cursorCore.style.transform =
      'translate(' +
      landingSpaceCore.x +
      'px, ' +
      landingSpaceCore.y +
      'px) translate(-50%, -50%)';

    const palette = landingSpacePalette();
    landingSpaceCtx.clearRect(0, 0, landingSpaceW, landingSpaceH);

    for (const star of landingSpaceStars) {
      star.homeX += star.drift;
      if (star.homeX < 0) star.homeX = landingSpaceW;
      if (star.homeX > landingSpaceW) star.homeX = 0;

      const dx = star.x - landingSpaceCore.x;
      const dy = star.y - landingSpaceCore.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      if (dist < LANDING_SPACE_WARP_RADIUS) {
        const force = Math.pow(1 - dist / LANDING_SPACE_WARP_RADIUS, 2) * 14;
        star.x += (dx / dist) * force;
        star.y += (dy / dist) * force;
      } else {
        star.x += (star.homeX - star.x) * 0.045;
        star.y += (star.homeY - star.y) * 0.045;
      }
      star.tw += 0.02;
    }

    landingSpaceCtx.lineWidth = 1;
    landingSpaceCtx.strokeStyle = palette.link;
    for (let i = 0; i < landingSpaceStars.length; i++) {
      const a = landingSpaceStars[i];
      for (let j = i + 1; j < landingSpaceStars.length; j++) {
        const b = landingSpaceStars[j];
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        if (gap > 78) continue;
        const midX = (a.x + b.x) / 2 - landingSpaceCore.x;
        const midY = (a.y + b.y) / 2 - landingSpaceCore.y;
        if (Math.hypot(midX, midY) < LANDING_SPACE_WARP_RADIUS * 0.7) continue;
        landingSpaceCtx.globalAlpha = (1 - gap / 78) * 0.7;
        landingSpaceCtx.beginPath();
        landingSpaceCtx.moveTo(a.x, a.y);
        landingSpaceCtx.lineTo(b.x, b.y);
        landingSpaceCtx.stroke();
      }
    }
    landingSpaceCtx.globalAlpha = 1;

    for (const star of landingSpaceStars) {
      const near = Math.hypot(
        star.x - landingSpaceCore.x,
        star.y - landingSpaceCore.y
      );
      const flicker = 0.55 + Math.sin(star.tw) * 0.45;
      landingSpaceCtx.beginPath();
      landingSpaceCtx.fillStyle =
        near < LANDING_SPACE_WARP_RADIUS * 1.15 ? palette.warm : palette.star;
      landingSpaceCtx.globalAlpha = flicker;
      landingSpaceCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      landingSpaceCtx.fill();
    }
    landingSpaceCtx.globalAlpha = 1;
  }

  landingSpaceResize();
  landingSpaceSeed();

  landingSpaceZone.addEventListener(
    'pointermove',
    (event) => {
      const zoneBox = landingSpaceZone.getBoundingClientRect();
      landingSpaceMouse.x = event.clientX - zoneBox.left;
      landingSpaceMouse.y = event.clientY - zoneBox.top;
    },
    { passive: true }
  );
  landingSpaceZone.addEventListener(
    'pointerleave',
    () => {
      landingSpaceMouse.x = -9999;
      landingSpaceMouse.y = -9999;
    },
    { passive: true }
  );

  requestAnimationFrame(landingSpaceTick);
  window.addEventListener('resize', landingSpaceResize);
}
