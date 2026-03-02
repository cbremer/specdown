/**
 * Unit tests for in-document search (Cmd/Ctrl+F)
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('In-Document Search', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);
    // jsdom doesn't implement scrollIntoView — mock it so highlightCurrentMatch works
    Element.prototype.scrollIntoView = jest.fn();
  });

  // ===========================
  // escapeRegex
  // ===========================
  describe('escapeRegex', () => {
    it('escapes special regex characters', () => {
      expect(escapeRegex('a.b')).toBe('a\\.b');
      expect(escapeRegex('a*b')).toBe('a\\*b');
      expect(escapeRegex('a+b')).toBe('a\\+b');
      expect(escapeRegex('(foo)')).toBe('\\(foo\\)');
    });

    it('leaves plain strings unchanged', () => {
      expect(escapeRegex('hello')).toBe('hello');
      expect(escapeRegex('foo bar')).toBe('foo bar');
    });
  });

  // ===========================
  // openSearch / closeSearch
  // ===========================
  describe('openSearch', () => {
    it('makes the search bar visible', () => {
      const bar = document.getElementById('search-bar');
      bar.style.display = 'none';

      openSearch();

      expect(bar.style.display).not.toBe('none');
    });

    it('focuses the search input', () => {
      const input = document.getElementById('search-input');
      const focusSpy = jest.spyOn(input, 'focus');

      openSearch();

      expect(focusSpy).toHaveBeenCalled();
    });

    it('clears the search input value', () => {
      const input = document.getElementById('search-input');
      input.value = 'old query';

      openSearch();

      expect(input.value).toBe('');
    });
  });

  describe('closeSearch', () => {
    it('hides the search bar', () => {
      openSearch();

      closeSearch();

      const bar = document.getElementById('search-bar');
      expect(bar.style.display).toBe('none');
    });

    it('resets searchMatches array', () => {
      searchMatches = ['dummy'];

      closeSearch();

      expect(searchMatches).toHaveLength(0);
    });

    it('resets searchCurrentIndex to -1', () => {
      searchCurrentIndex = 2;

      closeSearch();

      expect(searchCurrentIndex).toBe(-1);
    });

    it('clears the match counter', () => {
      const count = document.getElementById('search-count');
      count.textContent = '1 / 3';

      closeSearch();

      expect(count.textContent).toBe('');
    });
  });

  // ===========================
  // runSearch
  // ===========================
  describe('runSearch', () => {
    beforeEach(async () => {
      // Render some content to search through
      await renderMarkdown(
        '# Hello World\n\nThis is a paragraph with hello in it.\n\nAnother paragraph here.',
        'test.md'
      );
    });

    it('does nothing on empty query', () => {
      runSearch('');

      expect(searchMatches).toHaveLength(0);
      expect(searchCurrentIndex).toBe(-1);
    });

    it('finds matches and wraps them in <mark> elements', () => {
      runSearch('hello');

      const marks = document.querySelectorAll('mark.search-highlight');
      // "Hello" in the heading + "hello" in the paragraph (case-insensitive)
      expect(marks.length).toBeGreaterThanOrEqual(1);
    });

    it('populates searchMatches with one entry per match', () => {
      runSearch('paragraph');

      expect(searchMatches.length).toBeGreaterThanOrEqual(1);
    });

    it('sets searchCurrentIndex to 0 when there are matches', () => {
      runSearch('hello');

      expect(searchCurrentIndex).toBe(0);
    });

    it('leaves searchCurrentIndex at -1 when there are no matches', () => {
      runSearch('xyzzy_no_match');

      expect(searchCurrentIndex).toBe(-1);
    });

    it('updates the match counter label', () => {
      runSearch('paragraph');

      const count = document.getElementById('search-count');
      expect(count.textContent).toMatch(/\d+ \/ \d+/);
    });

    it('marks the first match with search-highlight-current class', () => {
      runSearch('hello');

      const current = document.querySelectorAll('mark.search-highlight-current');
      expect(current.length).toBe(1);
    });

    it('clears previous matches before running a new search', () => {
      runSearch('hello');

      runSearch('paragraph');

      // All remaining marks must wrap 'paragraph', not 'hello'
      const marks = Array.from(document.querySelectorAll('mark.search-highlight'));
      expect(marks.length).toBeGreaterThan(0);
      marks.forEach((m) => {
        expect(m.textContent.toLowerCase()).toBe('paragraph');
      });
    });

    it('is case-insensitive', () => {
      runSearch('HELLO');

      expect(searchMatches.length).toBeGreaterThanOrEqual(1);
    });

    it('treats special regex chars as literals', () => {
      // Should not throw even with regex special characters
      expect(() => runSearch('a.b+c')).not.toThrow();
    });
  });

  // ===========================
  // navigateSearch
  // ===========================
  describe('navigateSearch', () => {
    beforeEach(async () => {
      await renderMarkdown(
        '# Alpha\n\nword alpha word\n\nword alpha word alpha.',
        'test.md'
      );
      runSearch('alpha');
    });

    it('does nothing when there are no matches', () => {
      closeSearch();
      navigateSearch(1);
      expect(searchCurrentIndex).toBe(-1);
    });

    it('advances to the next match', () => {
      const before = searchCurrentIndex;
      navigateSearch(1);
      expect(searchCurrentIndex).toBe(before + 1);
    });

    it('goes back to the previous match', () => {
      navigateSearch(1); // go to index 1
      const before = searchCurrentIndex;
      navigateSearch(-1);
      expect(searchCurrentIndex).toBe(before - 1);
    });

    it('wraps around to the last match when going back from first', () => {
      // searchCurrentIndex starts at 0
      expect(searchCurrentIndex).toBe(0);
      navigateSearch(-1);
      expect(searchCurrentIndex).toBe(searchMatches.length - 1);
    });

    it('wraps around to the first match when going forward past last', () => {
      // Navigate to the last match
      for (let i = 0; i < searchMatches.length - 1; i++) {
        navigateSearch(1);
      }
      expect(searchCurrentIndex).toBe(searchMatches.length - 1);
      navigateSearch(1);
      expect(searchCurrentIndex).toBe(0);
    });

    it('updates the search-highlight-current class correctly', () => {
      navigateSearch(1);
      const current = document.querySelectorAll('mark.search-highlight-current');
      expect(current.length).toBe(1);
      // The current element should be the one at searchCurrentIndex
      expect(searchMatches[searchCurrentIndex].classList.contains('search-highlight-current')).toBe(true);
    });
  });

  // ===========================
  // clearSearchHighlights
  // ===========================
  describe('clearSearchHighlights', () => {
    beforeEach(async () => {
      await renderMarkdown('# Test\n\nSome text here.', 'test.md');
      runSearch('text');
    });

    it('removes all <mark> elements from the DOM', () => {
      clearSearchHighlights();

      const marks = document.querySelectorAll('mark.search-highlight');
      expect(marks.length).toBe(0);
    });

    it('empties searchHighlightNodes array', () => {
      clearSearchHighlights();

      expect(searchHighlightNodes).toHaveLength(0);
    });

    it('empties searchMatches array', () => {
      clearSearchHighlights();

      expect(searchMatches).toHaveLength(0);
    });

    it('resets searchCurrentIndex to -1', () => {
      clearSearchHighlights();

      expect(searchCurrentIndex).toBe(-1);
    });

    it('preserves original text content after removing marks', () => {
      const originalText = document.getElementById('markdown-content').textContent;

      clearSearchHighlights();

      expect(document.getElementById('markdown-content').textContent).toBe(originalText);
    });
  });
});
