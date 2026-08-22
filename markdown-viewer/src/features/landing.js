// @ts-check
// Web-only empty-state showcase. Desktop and iOS keep the compact drop-zone.
// The nebula/starfield is a separate toggle (features/starfield.js) shared
// by every surface.
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
  '#starfield-canvas',
  '#starfield-cursor-core',
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
 * Clicks on showcase chrome must not open the file picker. The dashed
 * drop card (`.drop-zone-content`) and empty padding still browse.
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
}
