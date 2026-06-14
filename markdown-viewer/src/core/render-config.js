// marked + mermaid configuration. Pure setup — no callbacks back into the app.

import { marked } from 'marked';
import mermaid from 'mermaid';
import hljs from 'highlight.js';
import { state } from './state.js';

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export function configureMarked() {
  // Use marked.use() which integrates overrides without replacing the renderer.
  marked.use({
    breaks: true,
    gfm: true,
    renderer: {
      // marked v16+ passes the code token object ({ text, lang, ... }) to
      // renderer methods rather than positional (code, lang) args.
      code({ text: code, lang }) {
        // Guard against non-string code or missing hljs
        if (typeof code !== 'string') return false;
        if (lang && typeof hljs !== 'undefined' && hljs.getLanguage(lang)) {
          try {
            const highlighted = hljs.highlight(code, { language: lang }).value;
            return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
          } catch (err) {
            console.error('Highlight error:', err);
          }
        }
        const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre><code class="language-${lang || ''}">${escaped}</code></pre>`;
      },
    },
  });
}

export function getMermaidConfig() {
  return {
    startOnLoad: false,
    theme: state.currentTheme === 'dark' ? 'dark' : 'default',
    securityLevel: 'strict',
    fontFamily: FONT_FAMILY,
    // Render node labels as SVG <text> rather than <foreignObject> HTML.
    // Mermaid 11 defaults to HTML labels; our DOMPurify pass strips the
    // foreignObject, so shapes render but the label text disappears. SVG text
    // survives sanitization (this matches Mermaid 10's behavior).
    htmlLabels: false,
    flowchart: { htmlLabels: false },
  };
}

export function configureMermaid() {
  mermaid.initialize(getMermaidConfig());
}
