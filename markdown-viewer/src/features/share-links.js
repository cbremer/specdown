// @ts-check
// Open existing diagram deep links on load as a one-diagram document.
// The unsupported outgoing copy-link action is no longer offered.
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

export function checkForDiagramLink() {
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('diagram');
    if (!encoded) return;
    if (encoded.length > MAX_DIAGRAM_URL_PARAM_LENGTH) return;
    const source = decodeURIComponent(
      escape(atob(decodeURIComponent(encoded)))
    );
    if (!source) return;

    // Synthesize a one-diagram markdown document
    const md = '```mermaid\n' + source + '\n```\n';
    openTabFromShare('shared-diagram.md', md);
  } catch {
    // Silently ignore malformed deep links
  }
}
