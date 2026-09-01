// @ts-check
// Compile-time flag for the HTML document runtime.
//
// Vite `define` replaces `__HTML_DOCUMENTS_ENABLED__` with a boolean
// literal (`true` in `--mode html`, `false` otherwise) so an HTML-on
// renderer cannot drift from a forgotten env var. `.env.html` sets
// `VITE_HTML_DOCUMENTS=true` for the same mode.
//
// Electron main is not Vite-bundled — it reads process.env in
// `htmlDocumentsEnabledMain` (desktop/main.js). `desktop:html` exports
// `VITE_HTML_DOCUMENTS=true` so main and renderer cannot disagree.
//
// The Jest eval harness (tests/helpers/loadApp.js) inlines this module
// at global scope, where `import.meta` is a SyntaxError. Read the
// define-replaced identifier and `process.env` — never a lone
// `import.meta.env`.

/**
 * Whether this build compiled the HTML-documents runtime on.
 * Default is false (production-shaped). Session 01 will gate open
 * paths on this; Session 00 only exposes the helper.
 * @returns {boolean}
 */
export function htmlDocumentsEnabled() {
  const htmlDocumentsEnabledFlag =
    typeof __HTML_DOCUMENTS_ENABLED__ !== 'undefined' &&
    __HTML_DOCUMENTS_ENABLED__ === true;
  if (htmlDocumentsEnabledFlag) return true;
  const htmlDocumentsEnabledNodeProc =
    typeof globalThis !== 'undefined'
      ? /** @type {{ process?: { env?: Record<string, string | undefined> } }} */ (
          globalThis
        ).process
      : undefined;
  return (
    !!htmlDocumentsEnabledNodeProc &&
    !!htmlDocumentsEnabledNodeProc.env &&
    htmlDocumentsEnabledNodeProc.env.VITE_HTML_DOCUMENTS === 'true'
  );
}
