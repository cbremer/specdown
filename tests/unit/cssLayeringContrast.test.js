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

/** WCAG 2 contrast ratio between two #rrggbb colours. */
function contrastRatio(a, b) {
  const luminance = (hex) => {
    const channels = [1, 3, 5].map(
      (i) => parseInt(hex.slice(i, i + 2), 16) / 255
    );
    const [r, g, bl] = channels.map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Literal `#rrggbb` value of `property` in a rule body. */
function hexValue(body, property) {
  const match = new RegExp(
    `(?:^|[;\\s])${property}:\\s*(#[0-9a-fA-F]{6})\\b`
  ).exec(body);
  if (!match) throw new Error(`no #rrggbb ${property} in rule`);
  return match[1];
}

describe('search highlight contrast', () => {
  const cases = [
    ['dark-theme match', '[data-theme="dark"] mark.search-highlight'],
    ['current match', 'mark.search-highlight-current'],
    [
      'dark-theme current match',
      '[data-theme="dark"] mark.search-highlight-current',
    ],
  ];

  it.each(cases)('keeps %s text at 4.5:1 or better', (_label, selector) => {
    const body = ruleBody(mainCss, selector);
    const ratio = contrastRatio(
      hexValue(body, 'color'),
      hexValue(body, 'background-color')
    );
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the dark-theme current match a different fill from other matches', () => {
    // The current mark also has .search-highlight, whose dark rule is more
    // specific than mark.search-highlight-current; without its own dark rule
    // the current match would turn the same amber as every other match.
    const match = hexValue(
      ruleBody(mainCss, '[data-theme="dark"] mark.search-highlight'),
      'background-color'
    );
    const current = hexValue(
      ruleBody(mainCss, '[data-theme="dark"] mark.search-highlight-current'),
      'background-color'
    );
    expect(current.toLowerCase()).not.toBe(match.toLowerCase());
  });
});

describe('stylesheet contrast', () => {
  it('sets note editor Save text from text-on-accent, never literal white', () => {
    const body = ruleBody(mainCss, '.annotation-editor-save');
    expect(body).toMatch(/color:\s*var\(--text-on-accent\)/);
    expect(body).not.toMatch(/(?:^|[^-])color:\s*(?:white|#fff\b|#ffffff\b)/i);
  });
});
