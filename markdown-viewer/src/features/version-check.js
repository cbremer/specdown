// @ts-check
// Version label + update check against GitHub Releases. The version constants
// stay in main.js (scripts/sync-version.js rewrites APP_VERSION there on each
// release) and are passed in, so this module has no release-time coupling.

import { isDesktop, isIOSNative } from '../core/platform.js';
import { bridgeDesktopPlatform } from '../platform/bridge.js';

/**
 * Fill in the header version label.
 * @param {string} version
 * @param {string} label e.g. 'alpha'
 */
export function setupVersionInfo(version, label) {
  const versionLabel = document.getElementById('version-label');
  if (versionLabel) {
    versionLabel.textContent = 'v' + version + ' (' + label + ')';
  }
}

/**
 * Poll GitHub Releases and surface a "vX available" link when newer.
 * @param {{ version: string, repo: string, repoUrl: string }} opts
 */
export function checkForUpdates({ version, repo, repoUrl }) {
  if (isIOSNative) {
    return;
  }
  // On macOS desktop, electron-updater owns the update lifecycle (signed
  // builds auto-update); polling the GitHub API here would be redundant
  // traffic against an unauthenticated 60 req/hr/IP limit. Unsigned desktop
  // platforms (win32/linux) keep this check — it's their only update signal.
  if (isDesktop && bridgeDesktopPlatform() === 'darwin') {
    return;
  }
  const apiUrl = 'https://api.github.com/repos/' + repo + '/releases/latest';
  fetch(apiUrl)
    .then(function (response) {
      if (!response.ok) return null;
      return response.json();
    })
    .then(function (data) {
      if (!data || !data.tag_name) return;
      const latest = data.tag_name.replace(/^v/, '');
      if (latest !== version) {
        const updateEl = document.getElementById('version-update');
        if (updateEl) {
          const releaseUrl = data.html_url || repoUrl + '/releases/latest';
          const link = document.createElement('a');
          link.href = releaseUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'v' + latest + ' available';
          updateEl.textContent = '';
          updateEl.appendChild(link);
          updateEl.style.display = '';
        }
      }
    })
    .catch(function () {
      // Version check is non-critical; silently ignore failures
    });
}
