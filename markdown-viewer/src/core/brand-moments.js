// @ts-check
// C+ brand moments: SpecDown's default look on every surface (web, desktop,
// Mac App Store, iOS, iPadOS). Adds the reading-progress brand bar; the rest
// is CSS (the "C+ brand moments" section of styles.css) plus the SpecDown
// diagram style for diagrams that opt in with BRAND_DIAGRAM_MARKER.
//
// Spec: docs/project-design-system/2026-11-19-spec-brand-moments-cplus.md
//
// Names are prefixed (brandMoments…) because the Jest eval harness shares one
// global scope between modules.

/** Mermaid comment line that opts a diagram into the SpecDown diagram style. */
export const BRAND_DIAGRAM_MARKER = '%% specdown:brand';

/**
 * Mermaid theme for the SpecDown diagram style.
 * @param {boolean} dark
 */
export function brandDiagramThemeVariables(dark) {
  return dark
    ? {
        darkMode: true,
        background: '#1a1a1a',
        primaryColor: '#163034',
        primaryBorderColor: '#00a3bf',
        primaryTextColor: '#e6e6e6',
        secondaryColor: '#3f2922',
        secondaryBorderColor: '#ff7a4d',
        secondaryTextColor: '#e6e6e6',
        tertiaryColor: '#2a2a2a',
        tertiaryBorderColor: '#444444',
        tertiaryTextColor: '#e6e6e6',
        lineColor: '#00a3bf',
        textColor: '#e6e6e6',
      }
    : {
        darkMode: false,
        background: '#ffffff',
        primaryColor: '#e6f6f9',
        primaryBorderColor: '#007a90',
        primaryTextColor: '#1a1a1a',
        secondaryColor: '#ffefea',
        secondaryBorderColor: '#c2410c',
        secondaryTextColor: '#1a1a1a',
        tertiaryColor: '#f5f5f5',
        tertiaryBorderColor: '#dddddd',
        tertiaryTextColor: '#1a1a1a',
        lineColor: '#007a90',
        textColor: '#1a1a1a',
      };
}

/**
 * Source to hand Mermaid for one diagram. Unchanged unless the diagram opts in
 * with BRAND_DIAGRAM_MARKER (our bundled samples do; users' Markdown doesn't)
 * and sets no init directive of its own (an author's theme always wins).
 * @param {string} code
 * @param {boolean} dark
 * @returns {string}
 */
export function brandDiagramSource(code, dark) {
  if (!code.split('\n').some((line) => line.trim() === BRAND_DIAGRAM_MARKER))
    return code;
  if (/%%\{\s*init/.test(code)) return code;
  const brandDirective = {
    theme: 'base',
    themeVariables: brandDiagramThemeVariables(dark),
  };
  return `%%{init: ${JSON.stringify(brandDirective)}}%%\n${code}`;
}

/** @type {number | null} */
let brandMomentsFrame = null;
let brandMomentsReady = false;

function brandMomentsUpdateProgress() {
  brandMomentsFrame = null;
  const bar = document.getElementById('brand-bar');
  if (!bar) return;
  const content = document.getElementById('markdown-content');
  const area = document.getElementById('content-area');
  let progress = 1;
  if (content && area && area.style.display !== 'none') {
    const scrollable = content.scrollHeight - content.clientHeight;
    progress =
      scrollable > 0
        ? Math.min(1, Math.max(0, content.scrollTop / scrollable))
        : 1;
  }
  bar.style.setProperty('--brand-reading-progress', String(progress));
}

function brandMomentsScheduleProgress() {
  if (brandMomentsFrame !== null) return;
  brandMomentsFrame = requestAnimationFrame(brandMomentsUpdateProgress);
}

/**
 * Add the brand bar and keep its reading-progress fill in step with the
 * document's scroll. Safe to call more than once.
 */
export function setupBrandMoments() {
  if (brandMomentsReady) return;
  brandMomentsReady = true;

  const container = document.querySelector('.app-container');
  if (container && !document.getElementById('brand-bar')) {
    const bar = document.createElement('div');
    bar.id = 'brand-bar';
    bar.className = 'brand-bar';
    bar.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('div');
    fill.className = 'brand-bar-fill';
    bar.appendChild(fill);
    container.prepend(bar);
  }

  const content = document.getElementById('markdown-content');
  if (content) {
    content.addEventListener('scroll', brandMomentsScheduleProgress, {
      passive: true,
    });
    // A new document (or switching to the empty state) replaces content
    // without a scroll event; re-measure when the content changes.
    new MutationObserver(brandMomentsScheduleProgress).observe(content, {
      childList: true,
    });
  }
  const area = document.getElementById('content-area');
  if (area) {
    new MutationObserver(brandMomentsScheduleProgress).observe(area, {
      attributes: true,
      attributeFilter: ['style'],
    });
  }
  window.addEventListener('resize', brandMomentsScheduleProgress);
  brandMomentsUpdateProgress();
}
