/**
 * Guards two stylesheet rules that green behaviour tests cannot see:
 * toasts must stack above every dialog/overlay, and the note editor's
 * primary button must take its text colour from the theme-aware token.
 */
const fs = require('fs');
const path = require('path');

const viewerRoot = path.join(__dirname, '..', '..', 'markdown-viewer');
const stylesheets = [
  'styles.css',
  'bookmarks.css',
  path.join('src', 'features', 'source-editor.css'),
].map((file) => ({
  file,
  css: fs.readFileSync(path.join(viewerRoot, file), 'utf8'),
}));
const mainCss = stylesheets[0].css;

/** Body of the first top-level rule whose selector is exactly `selector`. */
function ruleBody(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`rule not found: ${selector}`);
  return match[1];
}

describe('stylesheet layering', () => {
  it('stacks toasts above every other fixed layer in the viewer', () => {
    const toastBody = ruleBody(mainCss, '.toast-region');
    const toastZ = Number(/z-index:\s*(\d+)/.exec(toastBody)[1]);

    const others = [];
    for (const { file, css } of stylesheets) {
      for (const match of css.matchAll(/z-index:\s*(\d+)/g)) {
        others.push({ file, z: Number(match[1]) });
      }
    }
    const above = others.filter(({ z }) => z > toastZ);

    expect(above).toEqual([]);
    // At least the dialogs that sit at 10020 today must be below toasts.
    expect(toastZ).toBeGreaterThan(10020);
  });
});

describe('stylesheet contrast', () => {
  it('sets note editor Save text from text-on-accent, never literal white', () => {
    const body = ruleBody(mainCss, '.annotation-editor-save');
    expect(body).toMatch(/color:\s*var\(--text-on-accent\)/);
    expect(body).not.toMatch(/(?:^|[^-])color:\s*(?:white|#fff\b|#ffffff\b)/i);
  });
});
