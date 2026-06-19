/**
 * Unit tests for HTML-comment reveal + the show/hide toggle.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('HTML comments', () => {
  beforeEach(() => {
    localStorage.clear();
    loadHTML(document);
    loadApp(document);
  });

  describe('revealHtmlComments', () => {
    it('turns an HTML comment into a labeled, styled block', () => {
      const div = document.createElement('div');
      div.innerHTML = 'before<!-- secret note -->after';
      revealHtmlComments(div);

      const block = div.querySelector('.html-comment-block');
      expect(block).not.toBeNull();
      expect(block.querySelector('.html-comment-label').textContent).toBe('comment');
      expect(block.querySelector('.html-comment-body').textContent).toBe('secret note');
    });

    it('ignores empty comments', () => {
      const div = document.createElement('div');
      div.innerHTML = 'x<!--   -->y';
      revealHtmlComments(div);
      expect(div.querySelector('.html-comment-block')).toBeNull();
    });
  });

  describe('toggle', () => {
    it('shows the toolbar toggle with a count when the doc has comments', () => {
      const mc = document.getElementById('markdown-content');
      mc.innerHTML = '<div class="html-comment-block">a</div><div class="html-comment-block">b</div>';
      refreshCommentsUI();

      const btn = document.getElementById('comments-toggle');
      expect(btn.style.display).not.toBe('none');
      expect(btn.querySelector('.comments-toggle-count').textContent).toBe('2');
    });

    it('hides the toggle when there are no comments', () => {
      document.getElementById('markdown-content').innerHTML = '<p>nothing</p>';
      refreshCommentsUI();
      expect(document.getElementById('comments-toggle').style.display).toBe('none');
    });

    it('toggling hides the comment blocks and persists the choice', () => {
      const mc = document.getElementById('markdown-content');
      mc.innerHTML = '<div class="html-comment-block">a</div>';
      refreshCommentsUI();
      expect(mc.classList.contains('comments-hidden')).toBe(false); // shown by default

      toggleComments();
      expect(mc.classList.contains('comments-hidden')).toBe(true);
      expect(localStorage.getItem('specdown-hide-comments')).toBe('1');

      toggleComments();
      expect(mc.classList.contains('comments-hidden')).toBe(false);
      expect(localStorage.getItem('specdown-hide-comments')).toBe('0');
    });
  });

  it('reveals comments end-to-end through renderMarkdown', async () => {
    await renderMarkdown('# Title\n\n<!-- hidden body -->', 'doc.md');

    const mc = document.getElementById('markdown-content');
    const block = mc.querySelector('.html-comment-block');
    expect(block).not.toBeNull();
    expect(block.textContent).toContain('hidden body');
    expect(document.getElementById('comments-toggle').style.display).not.toBe('none');
  });

  describe('iOS More-sheet controls', () => {
    it('Toggle Comments button flips comment visibility', () => {
      const mc = document.getElementById('markdown-content');
      mc.innerHTML = '<div class="html-comment-block">a</div>';
      refreshCommentsUI();
      expect(mc.classList.contains('comments-hidden')).toBe(false);

      document.getElementById('ios-comments-button').dispatchEvent(new Event('click', { bubbles: true }));
      expect(mc.classList.contains('comments-hidden')).toBe(true);
    });

    it('Annotations button opens the annotations panel', () => {
      localStorage.setItem('specdown-annotations', JSON.stringify({ 'doc.md': { 0: 'n' } }));
      const mc = document.getElementById('markdown-content');
      mc.innerHTML = '<p>Zero</p>';
      renderAnnotations('doc.md');

      document.getElementById('ios-annotations-button').dispatchEvent(new Event('click', { bubbles: true }));
      expect(document.getElementById('annotation-panel').classList.contains('open')).toBe(true);
    });
  });
});
