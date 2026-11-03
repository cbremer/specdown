const path = require('node:path');
const { loadHTML, loadApp } = require('../helpers/loadApp');

// Use the installed parser's UMD distribution because the CommonJS Jest runner
// cannot import its ESM entry. The production renderer/configuration and
// sanitizer below still come from loadApp's actual application module graph.
const { Marked } = require(
  path.join(
    path.dirname(require.resolve('marked/package.json')),
    'lib/marked.umd.js'
  )
);
const createDOMPurify = require('dompurify');
const realHighlight = require('highlight.js/lib/common');
const originalDependencies = {
  marked: global.marked,
  DOMPurify: global.DOMPurify,
  hljs: global.hljs,
};

const flushRealRender = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const rendered = () => document.getElementById('markdown-content');

beforeEach(() => {
  global.marked = new Marked();
  global.DOMPurify = createDOMPurify(window);
  global.hljs = realHighlight;
  window.iosNative = true;
  window.webkit = {
    messageHandlers: { specdown: { postMessage: jest.fn() } },
  };
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
});

afterEach(() => {
  Object.assign(global, originalDependencies);
  delete window.iosNative;
  delete window.webkit;
});

async function openRealMarkdown(markdown, name = 'synthetic.md') {
  const accepted = window.loadFileContent(markdown, name);
  await flushRealRender();
  return accepted;
}

describe('real Marked and DOMPurify through document admission/rendering', () => {
  test('native images decode URI filenames once before encoding the authority transport', async () => {
    expect(window.loadFileContent('![Space](./my%20diagram.png)', 'synthetic.md', {id:'native-synthetic'})).toBe(true);
    await flushRealRender();
    const image = rendered().querySelector('img');
    expect(image.getAttribute('src')).toMatch(/^specdown-resource:\/\//);
    expect(image.getAttribute('src')).toContain('my%20diagram.png');
    expect(image.getAttribute('src')).not.toContain('%2520');
  });
  test('renders GFM tables, task lists, strikethrough, links and soft breaks', async () => {
    expect(
      await openRealMarkdown(
        [
          '# Readable',
          '',
          '| Name | Value |',
          '| --- | --- |',
          '| A | 1 |',
          '',
          '- [x] Checked',
          '- [ ] Unchecked',
          '',
          '~~Old~~ and https://example.com',
          '',
          'first line',
          'second line',
        ].join('\n')
      )
    ).toBe(true);
    expect(rendered().querySelector('tbody td').textContent).toBe('A');
    const inputs = [...rendered().querySelectorAll('input')];
    expect(inputs).toHaveLength(2);
    expect(inputs.every((input) => input.disabled)).toBe(true);
    expect(inputs.map((input) => input.checked)).toEqual([true, false]);
    expect(rendered().querySelector('del').textContent).toBe('Old');
    expect(rendered().querySelector('a').href).toBe('https://example.com/');
    expect(rendered().querySelector('br')).not.toBeNull();
    expect(state.tocEntries.map((entry) => entry.text)).toEqual(['Readable']);
  });

  test('reveals plain authored comments and drops comments containing active HTML', async () => {
    await openRealMarkdown(
      '# Safe\n\n<!-- review note -->\n\n<!-- <img src=x onerror=alert(1)> -->'
    );
    const comment = rendered().querySelector('.html-comment-block');
    expect(comment).not.toBeNull();
    expect(comment.textContent).toContain('review note');
    expect(rendered().querySelectorAll('.html-comment-block')).toHaveLength(1);
    expect(rendered().querySelector('img')).toBeNull();
  });

  test('removes raw active elements, styling, actions and app-control identity', async () => {
    await openRealMarkdown(
      [
        '# Safe',
        '',
        '<style>body{display:none}</style>',
        '<script>alert(1)</script>',
        '<form id="file-input"><label for="open-file">Open</label><button>Run</button>',
        '<input type="text" value="unsafe"><textarea>value</textarea></form>',
        '<iframe src="https://example.com"></iframe><object data="x"></object>',
        '<svg onload="alert(1)"><text>fake</text></svg><math><mi>x</mi></math>',
        '<p id="content-area" class="fullscreen-overlay language-js" style="position:fixed"',
        ' data-action="close-tab" hidden autofocus onclick="alert(1)">Kept text</p>',
      ].join('\n')
    );
    expect(
      rendered().querySelector(
        'script,style,form,label,button,input,textarea,iframe,object,svg,math'
      )
    ).toBeNull();
    const paragraph = rendered().querySelector('#user-content-content-area');
    expect(paragraph.textContent).toBe('Kept text');
    expect(paragraph.className).toBe('language-js');
    for (const name of [
      'style',
      'data-action',
      'hidden',
      'autofocus',
      'onclick',
    ]) {
      expect(paragraph.hasAttribute(name)).toBe(false);
    }
    expect(document.getElementById('content-area')).not.toBe(paragraph);
  });

  test.each([
    '[script](javascript:alert%281%29)',
    '[encoded](java&#x73;cript:alert%281%29)',
    '[insecure](http://example.com)',
    '[local](file:///tmp/synthetic.md)',
    '[protocol](//example.com)',
  ])('does not activate unsafe Markdown URL %s', async (markdown) => {
    await openRealMarkdown(markdown);
    expect(rendered().querySelector('a[href]')).toBeNull();
  });

  test('retains HTTPS and relative links while namespacing document fragments', async () => {
    await openRealMarkdown(
      '[secure](https://example.com/a) [relative](../other.md) [section](#details)\n\n<h2 id="details">Details</h2>'
    );
    expect(
      [...rendered().querySelectorAll('a')].map((a) => a.getAttribute('href'))
    ).toEqual([
      'https://example.com/a',
      '../other.md',
      '#user-content-details',
    ]);
    expect(rendered().querySelector('h2').id).toBe('user-content-details');
  });

  test('removes insecure and escaping image sources without dropping alt text', async () => {
    await openRealMarkdown(
      '![secure](https://example.com/a.png)\n\n![http](http://example.com/a.png)\n\n![escape](../a.png)\n\n<img alt="set" src="https://example.com/b.png" srcset="https://example.com/c.png 2x">'
    );
    const images = [...rendered().querySelectorAll('img')];
    expect(images.map((img) => img.getAttribute('src'))).toEqual([
      'https://example.com/a.png',
      null,
      null,
      'https://example.com/b.png',
    ]);
    expect(images.map((img) => img.alt)).toEqual([
      'secure',
      'http',
      'escape',
      'set',
    ]);
    expect(images.every((img) => !img.hasAttribute('srcset'))).toBe(true);
  });

  test('keeps fenced source literal and preserves real syntax highlighting', async () => {
    await openRealMarkdown(
      '```javascript\nconst html = "<script>unsafe</script>";\n```\n\n```unknown\n<img onerror="alert(1)"> & raw\n```'
    );
    const code = [...rendered().querySelectorAll('pre code')];
    expect(code).toHaveLength(2);
    expect(code[0].textContent).toBe('const html = "<script>unsafe</script>";');
    expect(code[0].querySelector('.hljs-keyword')).not.toBeNull();
    expect(code[1].textContent).toBe('<img onerror="alert(1)"> & raw');
    expect(rendered().querySelector('script,img')).toBeNull();
  });

  test('passes Mermaid fence text unchanged to diagram processing', async () => {
    const pending = [];
    global.processMermaidDiagrams = jest.fn(() => {
      pending.push(
        rendered().querySelector('code.language-mermaid').textContent
      );
      return Promise.resolve();
    });
    await openRealMarkdown(
      '```mermaid\nflowchart TD\n  A["<safe> & value"] --> B\n```'
    );
    expect(pending).toEqual(['flowchart TD\n  A["<safe> & value"] --> B']);
    expect(rendered().querySelector('safe')).toBeNull();
  });

  test('does not let a fence info string create active attributes', async () => {
    await openRealMarkdown('```unknown" onclick="alert(1)\nplain code\n```');
    expect(rendered().querySelector('[onclick]')).toBeNull();
    expect(rendered().querySelector('code').textContent).toBe('plain code');
  });

  test('keeps nested image alt formatting as text inside the enclosing link', async () => {
    await openRealMarkdown(
      '[![**bold** and `code`](https://example.com/a.png)](https://example.com/outer)'
    );
    const link = rendered().querySelector('a');
    expect(link.getAttribute('href')).toBe('https://example.com/outer');
    expect(link.querySelector('img').alt).toBe('bold and code');
    expect(link.querySelector('strong,code')).toBeNull();
  });

  test('retains no-space hash text inside a list item and nested quote structure', async () => {
    await openRealMarkdown(
      '- first\n  #not-a-heading\n\n> outer\n>\n> - nested\n>   continuation'
    );
    expect(rendered().querySelector('li').textContent).toContain(
      '#not-a-heading'
    );
    expect(rendered().querySelector('h1')).toBeNull();
    expect(rendered().querySelector('blockquote li').textContent).toContain(
      'continuation'
    );
  });

  test('preserves escaped markup and decodes character references only once', async () => {
    await openRealMarkdown(
      '&amp;#x3C;script&amp;#x3E;\n\n`<img onerror=x>`\n\n**bold** _emphasis_'
    );
    expect(rendered().textContent).toContain('&#x3C;script&#x3E;');
    expect(rendered().querySelector('script,img')).toBeNull();
    expect(rendered().querySelector('strong').textContent).toBe('bold');
    expect(rendered().querySelector('em').textContent).toBe('emphasis');
  });

  test('sanitizes malformed HTML nesting before it reaches the live document', async () => {
    await openRealMarkdown(
      '<div><p>Kept<table><tr><td><img src=x onerror=alert(1)></div></td></tr></table>\n\n<script>alert(2)</script>'
    );
    expect(rendered().textContent).toContain('Kept');
    expect(rendered().querySelector('[onerror],script')).toBeNull();
    expect(document.getElementById('content-area').contains(rendered())).toBe(
      true
    );
  });

  test('accepts an empty Markdown file as an empty tab without erasing an earlier tab', async () => {
    await openRealMarkdown('# Earlier', 'earlier.md');
    expect(await openRealMarkdown('', 'empty.md')).toBe(true);
    expect(state.tabs.map((tab) => [tab.filename, tab.rawMarkdown])).toEqual([
      ['earlier.md', '# Earlier'],
      ['empty.md', ''],
    ]);
    expect(rendered().textContent).toBe('');
    expect(rendered().childElementCount).toBe(0);
  });

  test.each([
    ['byte limit', () => 'x'.repeat(8 * 1024 * 1024 + 1)],
    ['UTF-8 byte limit', () => ('é'.repeat(60000) + '\n').repeat(71)],
    ['line length', () => 'x'.repeat(65537)],
    ['line count', () => 'x\n'.repeat(20001)],
    ['markup count', () => '<b>x</b>'.repeat(20001)],
    ['DOM nesting', () => '<div>'.repeat(66) + 'x' + '</div>'.repeat(66)],
  ])(
    'rejects %s while preserving the accepted document and context',
    async (_label, input) => {
      await openRealMarkdown(
        '# Accepted\n\n| A | B |\n| - | - |\n| 1 | 2 |',
        'accepted.md'
      );
      rendered().scrollTop = 37;
      const before = {
        tabs: JSON.stringify(state.tabs),
        active: state.activeTabId,
        next: state.nextTabId,
        html: rendered().innerHTML,
        raw: state.currentRawMarkdown,
        context: captureDocumentContext(),
      };
      expect(await openRealMarkdown(input(), 'rejected.md')).toBe(false);
      expect(JSON.stringify(state.tabs)).toBe(before.tabs);
      expect(state.activeTabId).toBe(before.active);
      expect(state.nextTabId).toBe(before.next);
      expect(state.currentRawMarkdown).toBe(before.raw);
      expect(rendered().innerHTML).toBe(before.html);
      expect(rendered().scrollTop).toBe(37);
      expect(isDocumentContextCurrent(before.context)).toBe(true);
    }
  );

  test('a rejected document cannot invalidate an admitted pending render', async () => {
    let finish;
    global.processMermaidDiagrams = jest.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    expect(window.loadFileContent('# Accepted', 'accepted.md')).toBe(true);
    const context = captureDocumentContext();
    expect(window.loadFileContent('x'.repeat(65537), 'rejected.md')).toBe(
      false
    );
    finish();
    await flushRealRender();
    expect(isDocumentContextCurrent(context)).toBe(true);
    expect(state.tocEntries.map((entry) => entry.text)).toEqual(['Accepted']);
    expect(state.tabs).toHaveLength(1);
  });

  test('a stale async completion cannot overwrite a newer admitted document', async () => {
    let finishFirst;
    global.processMermaidDiagrams = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          })
      )
      .mockResolvedValue(undefined);
    expect(window.loadFileContent('# Earlier', 'earlier.md')).toBe(true);
    expect(await openRealMarkdown('# Newer\n\nNew body', 'newer.md')).toBe(
      true
    );
    const html = rendered().innerHTML;
    finishFirst();
    await flushRealRender();
    expect(rendered().innerHTML).toBe(html);
    expect(state.tocEntries.map((entry) => entry.text)).toEqual(['Newer']);
    expect(document.getElementById('file-name').textContent).toBe('newer.md');
  });
});
