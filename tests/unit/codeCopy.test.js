/**
 * Unit tests for code-block copy buttons.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

function makeContainer(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

describe('Code block copy buttons', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  it('adds one copy button per code block', () => {
    const container = makeContainer(
      '<pre><code>one()</code></pre><p>text</p><pre><code>two()</code></pre>'
    );
    enhanceCodeBlocks(container);

    const buttons = container.querySelectorAll('.code-copy-btn');
    expect(buttons.length).toBe(2);
    expect(buttons[0].getAttribute('aria-label')).toBe('Copy code to clipboard');
  });

  it('does not add a button to a <pre> without a <code> child', () => {
    const container = makeContainer('<pre>raw text, no code element</pre>');
    enhanceCodeBlocks(container);
    expect(container.querySelector('.code-copy-btn')).toBeNull();
  });

  it('is idempotent (no duplicate buttons on re-enhance)', () => {
    const container = makeContainer('<pre><code>x()</code></pre>');
    enhanceCodeBlocks(container);
    enhanceCodeBlocks(container);
    expect(container.querySelectorAll('.code-copy-btn').length).toBe(1);
  });

  it('copies the code text to the clipboard on click', async () => {
    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const container = makeContainer('<pre><code>console.log("hi")</code></pre>');
    enhanceCodeBlocks(container);

    const button = container.querySelector('.code-copy-btn');
    button.dispatchEvent(new Event('click', { bubbles: true }));

    expect(writeText).toHaveBeenCalledWith('console.log("hi")');

    // Button flashes feedback then resets.
    await Promise.resolve();
    expect(button.textContent).toBe('Copied');

    delete navigator.clipboard;
  });
});
