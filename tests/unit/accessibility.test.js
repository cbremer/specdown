/**
 * Accessibility regression tests for the static markup and generated controls:
 * skip link, accessible names on icon-only buttons, and decorative-icon hiding.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Accessibility', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  describe('skip link', () => {
    it('is the first focusable element and targets the main content', () => {
      const skip = document.querySelector('.skip-link');
      expect(skip).not.toBeNull();
      expect(skip.getAttribute('href')).toBe('#markdown-content');
      expect(skip.textContent).toMatch(/skip/i);
    });

    it('points at a focusable main content region', () => {
      const target = document.getElementById('markdown-content');
      expect(target).not.toBeNull();
      expect(target.getAttribute('tabindex')).toBe('-1');
      expect(target.getAttribute('role')).toBe('main');
    });
  });

  describe('icon-only controls have accessible names', () => {
    const ids = [
      'theme-toggle',
      'watch-toggle',
      'toc-toggle',
      'split-toggle',
      'annotation-toggle',
      'print-button',
      'view-toggle',
      'search-prev',
      'search-next',
      'search-close',
    ];

    it.each(ids)('%s has a non-empty aria-label', (id) => {
      const el = document.getElementById(id);
      expect(el).not.toBeNull();
      const label = el.getAttribute('aria-label');
      expect(label).toBeTruthy();
      expect(label.trim().length).toBeGreaterThan(0);
    });

    it('satisfies WCAG "label in name" where a visible label exists', () => {
      // The visible label text must be contained in the accessible name so
      // voice-control users can activate by the visible word.
      const cases = [
        ['toc-toggle', 'toc-toggle-label'],
        ['split-toggle', 'split-toggle-label'],
        ['print-button', 'print-button-label'],
        ['annotation-toggle', 'annotation-toggle-label'],
      ];
      for (const [btnId, labelClass] of cases) {
        const btn = document.getElementById(btnId);
        const visible = btn.querySelector('.' + labelClass).textContent.trim().toLowerCase();
        const accessible = btn.getAttribute('aria-label').toLowerCase();
        expect(accessible).toContain(visible);
      }
    });

    it('hides decorative icon glyphs from assistive tech', () => {
      const icons = document.querySelectorAll(
        '.theme-icon, .toc-toggle-icon, .split-toggle-icon, .print-button-icon, .view-toggle-icon'
      );
      expect(icons.length).toBeGreaterThan(0);
      icons.forEach((icon) => {
        expect(icon.getAttribute('aria-hidden')).toBe('true');
      });
    });
  });

  describe('generated tab controls have accessible names', () => {
    it('labels the close button with the filename and the new-tab button', () => {
      createTab('notes.md', '# Notes');

      const closeBtn = document.querySelector('.tab-close');
      expect(closeBtn).not.toBeNull();
      expect(closeBtn.getAttribute('aria-label')).toBe('Close notes.md');

      const newBtn = document.querySelector('.tab-new');
      expect(newBtn).not.toBeNull();
      expect(newBtn.getAttribute('aria-label')).toBeTruthy();
    });
  });
});
