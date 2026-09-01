// @ts-check
// Preview-host script, exported ONLY as a string.
//
// The Jest eval harness inlines relative imports at parent global scope. If
// this module had top-level listeners or a bare `onMessage`, it would collide
// and run inside the app origin. The executable copy lives on
// `html-preview-host.js` (loaded as `'self'` of the host page). Tests assert
// the two stay in sync.
//
// After `document.write` the host page is replaced by the rewritten document,
// so chrome shortcuts inside the iframe are not forwarded. Click the filename
// (or any SpecDown chrome) to return focus for ⌘K / ⌘F / ⌘P / `?` / Esc.

export const htmlHostInlineSource = [
  '(function htmlHostBoot() {',
  "  'use strict';",
  '  function htmlHostOnMessage(event) {',
  '    if (event.source !== window.parent) return;',
  '    var data = event.data;',
  "    if (!data || typeof data !== 'object') return;",
  "    if (data.type !== 'specdown-load') return;",
  "    if (typeof data.html !== 'string') return;",
  '    document.open();',
  '    document.write(data.html);',
  '    document.close();',
  '  }',
  "  window.addEventListener('message', htmlHostOnMessage);",
  '})();',
  '',
].join('\n');
