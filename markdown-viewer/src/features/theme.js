// @ts-check
// Theme: light / dark / auto (system). The mermaid re-render on theme change
// lives in the render core (main.js), so it's supplied via configureTheme to
// avoid a back-import.
//
// `state.themePreference` is the persisted user choice ('light' | 'dark' |
// 'auto'); `state.currentTheme` is the resolved theme actually applied. An
// 'auto' preference follows the OS via `prefers-color-scheme` and live-updates
// when the system switches while in auto mode.

import { state } from '../core/state.js';
import { iconSvg } from '../core/icons.js';
import { syncIOSChrome } from '../platform/ios-chrome.js';

const el = (/** @type {string} */ id) => document.getElementById(id);

// Click order for the toggle button: light → dark → auto → light.
/** @type {Array<'light' | 'dark' | 'auto'>} */
const THEME_ORDER = ['light', 'dark', 'auto'];

/** @type {() => void} */
let reRenderDiagrams = () => {};

/**
 * Wire the render-core callback used when the theme changes.
 * @param {{ reRenderDiagrams?: Function }} [deps]
 */
export function configureTheme(deps) {
  if (deps && typeof deps.reRenderDiagrams === 'function') {
    reRenderDiagrams = /** @type {() => void} */ (deps.reRenderDiagrams);
  }
}

function systemPrefersDark() {
  return !!(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/**
 * Resolve a preference to the concrete theme to apply.
 * @param {'light' | 'dark' | 'auto'} preference
 * @returns {'light' | 'dark'}
 */
function resolveTheme(preference) {
  if (preference === 'auto') return systemPrefersDark() ? 'dark' : 'light';
  return preference === 'dark' ? 'dark' : 'light';
}

function updateThemeIcon() {
  const themeToggle = el('theme-toggle');
  if (!themeToggle) return;
  const preference = state.themePreference;

  const icon = themeToggle.querySelector('.theme-icon');
  if (icon) {
    const name = preference === 'auto' ? 'auto' : preference === 'dark' ? 'sun' : 'moon';
    icon.setAttribute('data-icon', name);
    icon.innerHTML = iconSvg(name);
  }

  // Keep the accessible name + tooltip in step with the 3-way cycle, naming
  // both the current mode and what a click switches to next.
  const label =
    preference === 'auto'
      ? 'Theme: system (click for light)'
      : preference === 'dark'
        ? 'Theme: dark (click for system)'
        : 'Theme: light (click for dark)';
  themeToggle.setAttribute('aria-label', label);
  themeToggle.setAttribute('title', label);
}

/**
 * Resolve + apply the current preference: set the data-theme attribute, refresh
 * the icon, sync iOS chrome, and re-render visible diagrams.
 * @param {boolean} persist Whether to write the preference to localStorage.
 */
function applyTheme(persist) {
  state.currentTheme = resolveTheme(state.themePreference);
  document.documentElement.setAttribute('data-theme', state.currentTheme);
  if (persist) localStorage.setItem('theme', state.themePreference);
  updateThemeIcon();
  syncIOSChrome();
  // Re-render mermaid diagrams with the new theme
  const contentArea = el('content-area');
  if (contentArea && contentArea.style.display !== 'none') {
    reRenderDiagrams();
  }
}

export function setupTheme() {
  applyTheme(false);

  // While in auto mode, follow live OS scheme changes.
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (state.themePreference === 'auto') applyTheme(false);
    };
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
    } else if (mq.addListener) {
      // Safari < 14 fallback
      mq.addListener(onChange);
    }
  }
}

export function toggleTheme() {
  const idx = THEME_ORDER.indexOf(state.themePreference);
  state.themePreference = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
  applyTheme(true);
}

// iOS API: called by the Swift shell to set the theme externally.
window.setTheme = function (theme) {
  state.themePreference = THEME_ORDER.find((t) => t === theme) || 'light';
  applyTheme(true);
};
