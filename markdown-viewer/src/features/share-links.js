// @ts-check
// Shareable diagram deep links: copy a link that encodes a Mermaid diagram's
// source, and open such a link on load as a one-diagram document.
//
// Opening a shared link creates a tab, which lives in the tabs core (main.js),
// so that is supplied via configureShareLinks.

const MAX_DIAGRAM_URL_PARAM_LENGTH = 65536;

// Named uniquely (not a bare `openTab`) to avoid colliding with file-loading.js
// under the flat-eval test harness, which shares module-top bindings at global
// scope. See the matching note in file-loading.js.
/** @type {(filename: string, markdown?: string, filePath?: string | null) => void} */
let openTabFromShare = () => {};

/** @param {{ createTab?: Function }} [deps] */
export function configureShareLinks(deps) {
  if (deps && typeof deps.createTab === 'function') {
    openTabFromShare = /** @type {typeof openTabFromShare} */ (deps.createTab);
  }
}

function showShareToast() {
  const shareToast = document.getElementById('share-toast');
  if (!shareToast) return;
  shareToast.style.display = '';
  setTimeout(() => {
    shareToast.style.display = 'none';
  }, 2500);
}

/** @param {string} diagramId */
export function shareDiagramLink(diagramId) {
  const wrapper = document.getElementById('wrapper-' + diagramId);
  if (!wrapper) return;
  const svgEl = wrapper.querySelector('svg');
  if (!svgEl) return;
  const source = svgEl.getAttribute('data-mermaid-source');
  if (!source) return;

  const encoded = btoa(unescape(encodeURIComponent(source)));
  const shareUrl = window.location.origin + window.location.pathname + '?diagram=' + encodeURIComponent(encoded);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareUrl).then(() => showShareToast());
  } else {
    // Fallback: select from a temporary textarea
    const ta = document.createElement('textarea');
    ta.value = shareUrl;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showShareToast();
  }
}

export function checkForDiagramLink() {
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('diagram');
    if (!encoded) return;
    if (encoded.length > MAX_DIAGRAM_URL_PARAM_LENGTH) return;
    const source = decodeURIComponent(escape(atob(decodeURIComponent(encoded))));
    if (!source) return;

    // Synthesize a one-diagram markdown document
    const md = '```mermaid\n' + source + '\n```\n';
    openTabFromShare('shared-diagram.md', md);
  } catch {
    // Silently ignore malformed deep links
  }
}
