// Light/dark theme. The mermaid re-render on theme change lives in the render
// core (main.js), so it's supplied via configureTheme to avoid a back-import.

import { state } from '../core/state.js';
import { syncIOSChrome } from '../platform/ios-chrome.js';

const el = (id) => document.getElementById(id);

let reRenderDiagrams = () => {};

/** Wire the render-core callback used when the theme changes. */
export function configureTheme(deps) {
  if (deps && typeof deps.reRenderDiagrams === 'function') {
    reRenderDiagrams = deps.reRenderDiagrams;
  }
}

export function setupTheme() {
  document.documentElement.setAttribute('data-theme', state.currentTheme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const themeToggle = el('theme-toggle');
  if (!themeToggle) return;
  const icon = themeToggle.querySelector('.theme-icon');
  if (icon) icon.textContent = state.currentTheme === 'light' ? '🌙' : '☀️';
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.currentTheme);
  localStorage.setItem('theme', state.currentTheme);
  updateThemeIcon();
  syncIOSChrome();
  // Re-render mermaid diagrams with the new theme
  const contentArea = el('content-area');
  if (contentArea && contentArea.style.display !== 'none') {
    reRenderDiagrams();
  }
}

export function toggleTheme() {
  state.currentTheme = state.currentTheme === 'light' ? 'dark' : 'light';
  applyTheme();
}

// iOS API: called by the Swift shell to set the theme externally.
window.setTheme = function (theme) {
  state.currentTheme = theme;
  applyTheme();
};
