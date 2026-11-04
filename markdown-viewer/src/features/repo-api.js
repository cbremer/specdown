// @ts-check
// Public-only GitHub listing. No credentials, supplied API URLs, or redirects.
// Trees are not paginated: a truncated recursive tree is retried as bounded
// nonrecursive traversal. Never advertise an incomplete result as a full list.

/** @typedef {{ owner: string, repo: string, refs: string[] }} RepoTarget */
/** @typedef {{path: string, url: string, rawUrl: string}} PublicRepoFile */
const repoApiLimits = Object.freeze({
  requests: 32,
  bytes: 8 * 1024 * 1024,
  entries: 20000,
  files: 2000,
  refCandidates: 8,
});

/** @param {string} text */
function repoApiHasControls(text) {
  return Array.from(text).some(
    (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127
  );
}

/** @param {string} input @returns {RepoTarget | null} */
export function parsePublicRepoUrl(input) {
  try {
    const url = new URL(input);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      repoApiHasControls(input) ||
      /[\\\s]/.test(input)
    )
      return null;
    const parts = url.pathname
      .replace(/\/$/, '')
      .split('/')
      .slice(1)
      .map(decodeURIComponent);
    const owner = parts[0];
    const repo = parts[1]?.replace(/\.git$/, '');
    if (
      !owner ||
      !repo ||
      !/^[A-Za-z0-9-]+$/.test(owner) ||
      !/^[A-Za-z0-9_.-]+$/.test(repo) ||
      repo === '.' ||
      repo === '..'
    )
      return null;
    if (parts.length === 2) return { owner, repo, refs: [] };
    if (parts[2] !== 'tree' || parts.length < 4) return null;
    const refs = parts.slice(3);
    if (
      refs.some(
        (p) =>
          !p ||
          p.split('/').some((s) => !s || s === '.' || s === '..') ||
          repoApiHasControls(p) ||
          /\\/.test(p)
      )
    )
      return null;
    return { owner, repo, refs };
  } catch {
    return null;
  }
}

/** @param {unknown} value @returns {string} */
function repoApiSha(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40,64}$/.test(value))
    throw new Error('GitHub returned an invalid revision.');
  return value;
}

/** @param {unknown} value @returns {string} */
function repoApiPath(value) {
  if (
    typeof value !== 'string' ||
    value.length > 4096 ||
    repoApiHasControls(value) ||
    /\\/.test(value) ||
    value.split('/').some((s) => !s || s === '.' || s === '..')
  )
    throw new Error('GitHub returned an invalid file path.');
  return value;
}

/** @param {string} repoUrl @returns {Promise<PublicRepoFile[] | null>} */
export async function fetchGitHubRepoFiles(repoUrl) {
  const target = parsePublicRepoUrl(repoUrl);
  if (!target) return null;
  if (target.refs.length > repoApiLimits.refCandidates)
    throw new Error(
      'This repository URL exceeds the branch/path lookup limit. Open a raw Markdown file URL instead.'
    );
  const { owner, repo } = target;
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  let requests = 0;
  let bytes = 0;
  const signal = AbortSignal.timeout(30000);
  /** @param {string} suffix @param {number[]} [allowed] @returns {Promise<any>} */
  async function request(suffix, allowed = []) {
    if (++requests > repoApiLimits.requests)
      throw new Error(
        'This repository exceeds the browsing request limit. Open a raw Markdown file URL instead.'
      );
    const response = await fetch(base + suffix, {
      credentials: 'omit',
      redirect: 'error',
      signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (allowed.includes(response.status)) {
      await response.body?.cancel();
      return { status: response.status };
    }
    if (!response.ok && response.status !== 422) {
      await response.body?.cancel();
      if (response.status === 403 || response.status === 429)
        throw new Error(
          'GitHub rate limit reached or access restricted. Try later, or open a raw Markdown file URL.'
        );
      if (response.status === 404)
        throw new Error(
          'This public repository or branch is unavailable. Check its URL; private repositories are not supported.'
        );
      throw new Error(
        `GitHub could not list this repository (HTTP ${response.status}). Try again later.`
      );
    }
    const declared = Number(response.headers.get('content-length'));
    if (declared > repoApiLimits.bytes - bytes) {
      await response.body?.cancel();
      throw new Error(
        'This repository listing is too large. Open a raw Markdown file URL instead.'
      );
    }
    if (!response.body)
      throw new Error('GitHub returned an unreadable listing.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let text = '';
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > repoApiLimits.bytes)
          throw new Error(
            'This repository listing exceeds the size limit. Open a raw Markdown file URL instead.'
          );
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
      const data = JSON.parse(text);
      if (response.status === 422) {
        if (
          suffix.startsWith('/commits/') &&
          typeof data.message === 'string' &&
          data.message.startsWith('No commit found for SHA:')
        )
          return { status: 404 };
        throw new Error(
          'GitHub rejected this repository request (validation failed). Check its URL.'
        );
      }
      return data;
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  let revision;
  let prefix = '';
  if (target.refs.length) {
    // GitHub tree URLs are ambiguous for slash-containing refs. Longest valid
    // ref wins; only a missing-ref response permits a shorter candidate. A rate limit does
    // not silently select another branch.
    for (let n = target.refs.length; n > 0; n--) {
      const ref = target.refs.slice(0, n).join('/');
      const result = await request(
        `/commits/${encodeURIComponent(ref)}`,
        [404]
      );
      if (result.status === 404) continue;
      revision = result;
      prefix = target.refs.slice(n).join('/');
      break;
    }
    if (!revision)
      throw new Error(
        'This public repository branch is unavailable. Check its URL.'
      );
  } else {
    const metadata = await request('');
    if (
      typeof metadata.default_branch !== 'string' ||
      !metadata.default_branch ||
      metadata.default_branch.length > 1024
    )
      throw new Error('GitHub returned invalid repository metadata.');
    revision = await request(
      `/commits/${encodeURIComponent(metadata.default_branch)}`,
      [409]
    );
    if (revision.status === 409) return [];
  }
  const commit = repoApiSha(revision.sha);
  const root = repoApiSha(revision.commit?.tree?.sha);
  const recursive = await request(`/git/trees/${root}?recursive=1`);
  /** @type {PublicRepoFile[]} */
  const files = [];
  let entries = 0;
  /** @param {any} data @param {string} parent @param {boolean} descend */
  function collect(data, parent, descend) {
    if (!Array.isArray(data.tree) || typeof data.truncated !== 'boolean')
      throw new Error('GitHub returned an invalid repository listing.');
    if (data.truncated)
      throw new Error(
        'GitHub returned an incomplete listing; this repository is too large. Open a raw Markdown file URL instead.'
      );
    /** @type {{sha:string, prefix:string}[]} */
    const children = [];
    for (const item of data.tree) {
      if (++entries > repoApiLimits.entries)
        throw new Error(
          'This repository exceeds the entry limit. Open a raw Markdown file URL instead.'
        );
      const path = parent + repoApiPath(item.path);
      if (descend && item.type === 'tree')
        children.push({ sha: repoApiSha(item.sha), prefix: path + '/' });
      if (
        item.type !== 'blob' ||
        !['100644', '100755'].includes(item.mode) ||
        !/\.(?:md|markdown)$/i.test(path) ||
        (prefix && !path.startsWith(prefix + '/'))
      )
        continue;
      if (files.length >= repoApiLimits.files)
        throw new Error(
          'This repository exceeds the Markdown file limit. Open a raw Markdown file URL instead.'
        );
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      files.push({
        path,
        url: `https://github.com/${owner}/${repo}/blob/${commit}/${encodedPath}`,
        rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${commit}/${encodedPath}`,
      });
    }
    return children;
  }
  if (recursive.truncated === true) {
    const pending = [{ sha: root, prefix: '' }];
    // Iterative traversal bounds stack use and requests even for very deep or
    // very wide trees; GitHub's tree endpoint has no next-page cursor.
    for (let n = 0; n < pending.length; n++) {
      const node = pending[n];
      const data = await request(`/git/trees/${node.sha}`);
      pending.push(...collect(data, node.prefix, true));
      if (pending.length > repoApiLimits.requests)
        throw new Error(
          'This repository exceeds the browsing limit. Open a raw Markdown file URL instead.'
        );
    }
  } else collect(recursive, '', false);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
