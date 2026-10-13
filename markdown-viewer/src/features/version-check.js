// @ts-check
// Version label + update check against GitHub Releases. The version constants
// stay in main.js (scripts/sync-version.js rewrites APP_VERSION there on each
// release) and are passed in, so this module has no release-time coupling.

import { isDesktop, isIOSNative } from '../core/platform.js';
import {
  bridgeDesktopPlatform,
  bridgeDistribution,
} from '../platform/bridge.js';

let versionCheckCurrent = '';
/** @type {{ version: string, url: string } | null} */
let versionCheckUpdate = null;

/**
 * Record the running version (shown in the About dialog, not the header).
 * @param {string} version
 */
export function setupVersionInfo(version) {
  versionCheckCurrent = version;
}

export function getAppVersion() {
  return versionCheckCurrent;
}

/** @returns {{ version: string, url: string } | null} */
export function getAvailableUpdate() {
  return versionCheckUpdate;
}

/**
 * Poll GitHub Releases and surface a "vX available" link when newer.
 * @param {{ version: string, repo: string, repoUrl: string }} opts
 */
export function checkForUpdates({ version, repo, repoUrl }) {
  // Store builds (iOS app, Mac App Store) are updated by the App Store; a
  // GitHub release poll there would be misleading UI and unneeded traffic.
  if (isIOSNative || bridgeDistribution() === 'mas') {
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
        versionCheckUpdate = {
          version: latest,
          url: data.html_url || repoUrl + '/releases/latest',
        };
        // Surface it quietly: a dot on the ⋮ toggle and a hint on the About item.
        const versionCheckToggle =
          document.getElementById('header-more-toggle');
        if (versionCheckToggle) versionCheckToggle.classList.add('has-update');
        const versionCheckAbout = document.getElementById('about-button');
        if (versionCheckAbout)
          versionCheckAbout.textContent = 'About SpecDown (update available)';
      }
    })
    .catch(function () {
      // Version check is non-critical; silently ignore failures
    });
}
