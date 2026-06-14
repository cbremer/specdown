// GitHub repo file browser: accept a github.com/<owner>/<repo> URL and show a
// list of the repo's markdown files to pick from.
//
// Decoupled from the rest of the app via dependency injection — the caller
// supplies the URL-error UI hooks and the file-selection handler.

import { escapeHtml } from '../core/utils.js';

/**
 * Fetch the markdown files for a GitHub repo URL via the Search API.
 * @returns {Promise<Array<{path,url,rawUrl}>|null>} files, [] if none, or null
 *   when the URL isn't a recognized repo URL / the fetch failed.
 */
export async function fetchGitHubRepoFiles(repoUrl) {
  // Match: https://github.com/<owner>/<repo>
  const repoPattern = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/;
  const match = repoUrl.match(repoPattern);
  if (!match) return null;

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');

  // Use GitHub Search API to find .md files (avoids full tree traversal)
  const apiUrl = `https://api.github.com/search/code?q=extension:md+repo:${owner}/${repo}&per_page=100`;

  try {
    const resp = await fetch(apiUrl, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.items || data.items.length === 0) return [];

    return data.items.map((item) => ({
      path: item.path,
      url: item.html_url,
      rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${item.path}`,
    }));
  } catch (e) {
    return null;
  }
}

/**
 * Handle a repo URL: fetch its markdown files and present the browser.
 * @param {string} url
 * @param {{ clearError: Function, showError: Function, onSelectFile: Function }} hooks
 * @returns {Promise<boolean>} true if handled as a repo URL (caller should stop).
 */
export async function handleRepoUrl(url, { clearError, showError, onSelectFile }) {
  clearError();
  const files = await fetchGitHubRepoFiles(url);
  if (files === null) {
    // Not a repo URL or fetch failed — fall through to normal URL handling
    return false;
  }
  if (files.length === 0) {
    showError('No markdown files found in this repository.');
    return true;
  }

  showRepoBrowser(files, url, onSelectFile);
  return true;
}

function showRepoBrowser(files, repoUrl, onSelectFile) {
  let modal = document.getElementById('repo-browser-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'repo-browser-modal';
    modal.className = 'repo-browser-modal';
    document.body.appendChild(modal);
  }

  const repoName = repoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');

  modal.innerHTML = `
        <div class="repo-browser-content">
            <div class="repo-browser-header">
                <span class="repo-browser-title">${escapeHtml(repoName)}</span>
                <button class="repo-browser-close" title="Close">&#10005;</button>
            </div>
            <div class="repo-browser-search">
                <input type="text" class="repo-browser-filter" placeholder="Filter files..." autocomplete="off">
            </div>
            <ul class="repo-browser-list">
                ${files
                  .map(
                    (f) => `
                    <li class="repo-browser-item" data-raw-url="${escapeHtml(f.rawUrl)}">
                        <span class="repo-file-icon">📄</span>
                        <span class="repo-file-path">${escapeHtml(f.path)}</span>
                    </li>
                `
                  )
                  .join('')}
            </ul>
        </div>
    `;
  modal.style.display = 'flex';

  modal.querySelector('.repo-browser-close').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  const filterInput = modal.querySelector('.repo-browser-filter');
  filterInput.addEventListener('input', () => {
    const q = filterInput.value.toLowerCase();
    modal.querySelectorAll('.repo-browser-item').forEach((item) => {
      const path = item.querySelector('.repo-file-path').textContent.toLowerCase();
      item.style.display = path.includes(q) ? '' : 'none';
    });
  });
  filterInput.focus();

  modal.querySelectorAll('.repo-browser-item').forEach((item) => {
    item.addEventListener('click', () => {
      const rawUrl = item.getAttribute('data-raw-url');
      modal.style.display = 'none';
      onSelectFile(rawUrl);
    });
  });
}
