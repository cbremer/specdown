const { TextDecoder } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const createDOMPurify = require('dompurify');
const { loadHTML, loadApp } = require('../helpers/loadApp');

const realSanitizer = createDOMPurify(window);

describe('untrusted document boundaries', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
    DOMPurify.sanitize.mockImplementation((html, config) =>
      realSanitizer.sanitize(html, config)
    );
  });
  afterEach(() => DOMPurify.sanitize.mockImplementation((html) => html));

  it('uses real DOMPurify to prevent document labels, styles and IDs controlling app chrome', () => {
    const clicked = jest.fn();
    document
      .getElementById('ios-open-button')
      .addEventListener('click', clicked);
    const root = document.getElementById('markdown-content');
    root.innerHTML = sanitizeDocumentHtml(
      '<style>button{display:none}</style><label for="ios-open-button" style="position:fixed;inset:0">Open</label><div id="fullscreen-overlay" class="annotation-editor-backdrop" data-annot-id="fake">Fake</div>'
    );
    root.querySelectorAll('*').forEach((node) => node.click());
    expect(clicked).not.toHaveBeenCalled();
    expect(
      root.querySelector(
        'style,label,[style],[for],[data-annot-id],.annotation-editor-backdrop'
      )
    ).toBeNull();
    expect(root.querySelector('#fullscreen-overlay')).toBeNull();
    expect(
      root.querySelector('#user-content-fullscreen-overlay')
    ).not.toBeNull();
    expect(getFsOverlay()).toBe(document.getElementById('fullscreen-overlay'));
  });

  it('preserves comments, code highlighting and document-local anchor links', () => {
    const root = document.createElement('div');
    root.innerHTML = sanitizeDocumentHtml(
      '<!-- note --><h2 id="intro">Intro</h2><a href="#intro">Jump</a><pre><code class="language-js"><span class="hljs-keyword">const</span> x = 1;</code></pre>'
    );
    expect(root.innerHTML).toContain('<!-- note -->');
    expect(root.querySelector('code').className).toBe('language-js');
    expect(root.querySelector('span').className).toBe('hljs-keyword');
    expect(root.querySelector('a').hash).toBe('#user-content-intro');
    expect(root.querySelector('h2').id).toBe('user-content-intro');
  });

  it('removes file, cleartext and UNC resources before attachment', () => {
    const root = document.createElement('div');
    root.innerHTML = sanitizeDocumentHtml(
      '<img src="file:///private/secret"><img src="http://host/a"><img src="//host/a"><img srcset="https://host/a 1x"><img src="https://host/safe">'
    );
    expect(
      [...root.querySelectorAll('img')].filter((n) => n.hasAttribute('src'))
    ).toHaveLength(1);
    expect(root.querySelector('img[src]').src).toBe('https://host/safe');
    expect(root.querySelector('[srcset]')).toBeNull();
  });

  it('preserves disabled task-list checkboxes while rejecting other inputs', () => {
    const root = document.createElement('div');
    root.innerHTML = sanitizeDocumentHtml(
      '<input type="checkbox" checked><input type="text" value="fake"><input type="submit">'
    );
    expect(root.querySelectorAll('input')).toHaveLength(1);
    expect(root.querySelector('input').disabled).toBe(true);
    expect(root.querySelector('input').checked).toBe(true);
  });

  it('removes dialog and popover capabilities from document HTML', () => {
    const root = document.createElement('div');
    root.innerHTML = sanitizeDocumentHtml(
      '<dialog open>Fake dialog</dialog><div popover="auto" id="fake">Fake popover</div><input type="checkbox" popovertarget="fake" popovertargetaction="show" commandfor="fake" command="show-modal">'
    );
    expect(
      root.querySelector(
        'dialog,[popover],[popovertarget],[popovertargetaction],[command],[commandfor]'
      )
    ).toBeNull();
  });

  it('preserves sibling image paths and rejects absolute or traversing resources', () => {
    const root = document.createElement('div');
    root.innerHTML = sanitizeDocumentHtml(
      '<img src="images/chart.png"><img src="../secret.png"><img src="%2e%2e/secret.png"><img src="/private/secret.png">'
    );
    expect(
      [...root.querySelectorAll('img[src]')].map((node) =>
        node.getAttribute('src')
      )
    ).toEqual(['images/chart.png']);
  });

  it('rejects excessive DOM size and nesting before attaching content', () => {
    DOMPurify.sanitize.mockClear();
    expect(() => sanitizeDocumentHtml('<p>x</p>'.repeat(20001))).toThrow(
      /too many elements/
    );
    expect(DOMPurify.sanitize).not.toHaveBeenCalled();
    expect(() =>
      sanitizeDocumentHtml('<div>'.repeat(67) + 'x' + '</div>'.repeat(67))
    ).toThrow(/nested too deeply/);
  });

  it('does not reuse document-supplied annotation editor elements', () => {
    const fake = document.createElement('div');
    fake.id = 'annotation-editor-backdrop';
    document.getElementById('markdown-content').append(fake);
    const editor = ensureEditor();
    expect(editor).not.toBe(fake);
    expect(editor.querySelector('textarea')).not.toBeNull();
  });

  it('builds workspace trees for inherited object property names', () => {
    const tree = buildWorkspaceTree(
      ['__proto__', 'constructor', 'toString'].map((name) => ({
        name: 'a.md',
        relPath: name + '/a.md',
      }))
    );
    expect(tree.map((node) => node.name).sort()).toEqual(
      ['__proto__', 'constructor', 'toString'].sort()
    );
    expect(tree.every((node) => node.children[0].name === 'a.md')).toBe(true);
  });

  it('does not fingerprint unannotated documents during ordinary rendering', () => {
    const root = document.getElementById('markdown-content');
    root.innerHTML = '<p>one</p><p>two</p>';
    renderAnnotations('fresh.md');
    expect(root.querySelector('[data-annot-idx]')).toBeNull();
  });

  it('rejects oversized annotation imports atomically and deduplicates accepted notes', () => {
    const notes = Array.from({ length: 501 }, (_, i) => ({
      text: 'note ' + i,
      legacyIdx: i,
    }));
    const before = localStorage.getItem('specdown-annotations');
    expect(
      importAnnotations(
        JSON.stringify({ version: 2, files: { 'a.md': notes } })
      )
    ).toBe(false);
    expect(localStorage.getItem('specdown-annotations')).toBe(before);
    const accepted = JSON.stringify({
      version: 2,
      files: { 'a.md': notes.slice(0, 500) },
    });
    expect(importAnnotations(accepted)).toBe(true);
    expect(importAnnotations(accepted)).toBe(true);
    expect(annFileNotes('a.md')).toHaveLength(500);
  });

  it('bounds creator comment scanning for unfinished or long comment bodies', () => {
    const text = '<!-- Generated by ' + ' '.repeat(200000);
    const start = performance.now();
    expect(detectCreator(text)).toBeNull();
    expect(performance.now() - start).toBeLessThan(500);
  });

  it('preserves older annotations beyond the display cap during migration and edits', () => {
    const oldNotes = Array.from({ length: 503 }, (_, i) => ({
      id: 'old-' + i,
      text: 'note ' + i,
      legacyIdx: i,
      anchor: null,
    }));
    localStorage.setItem(
      'specdown-annotations',
      JSON.stringify({ version: 2, files: { 'large.md': oldNotes } })
    );
    document.getElementById('markdown-content').innerHTML = oldNotes
      .map((_, i) => '<p>paragraph ' + i + '</p>')
      .join('');
    renderAnnotations('large.md');
    expect(document.querySelectorAll('.annotation-badge')).toHaveLength(500);
    expect(annFileNotes('large.md')).toHaveLength(503);
    commitAnnotation({ id: 'old-502' }, 'edited final note');
    const persisted = JSON.parse(localStorage.getItem('specdown-annotations'))
      .files['large.md'];
    expect(persisted).toHaveLength(503);
    expect(persisted[502].text).toBe('edited final note');
    expect(persisted[501].text).toBe('note 501');
  });

  it.each(['length', 'quota'])(
    'keeps unsaved editor text when a note fails its %s limit',
    (failure) => {
      const root = document.getElementById('markdown-content');
      root.innerHTML = '<p>document paragraph</p>';
      renderAnnotations('editor.md');
      openAnnotationEditor({ element: root.querySelector('p') });
      const editor = ensureEditor();
      const text =
        failure === 'length' ? 'x'.repeat(16385) : 'important unsaved note';
      editor.querySelector('textarea').value = text;
      if (failure === 'quota')
        Storage.prototype.setItem.mockImplementationOnce(() => {
          throw new Error('quota');
        });
      editor.querySelector('.annotation-editor-save').click();
      expect(editor.style.display).toBe('flex');
      expect(editor.querySelector('textarea').value).toBe(text);
      expect(annFileNotes('editor.md')).toHaveLength(0);
    }
  );

  it('finishes document initialization when the diagram count exceeds its rendering budget', async () => {
    await renderMarkdown('# Old heading', 'old.md');
    const markdown =
      '# New heading\n' + '```mermaid\ngraph TD; A-->B\n```\n'.repeat(101);
    await renderMarkdown(markdown, 'new.md');
    expect(annotationKey).toBe('new.md');
    expect(state.tocEntries.map((entry) => entry.text)).toEqual([
      'New heading',
    ]);
    expect(
      document
        .getElementById('markdown-content')
        .querySelector('.mermaid-error').textContent
    ).toMatch(/source is shown/);
    expect(
      document.querySelectorAll('#markdown-content code.language-mermaid')
    ).toHaveLength(101);
  });

  it('refuses hidden control characters when copying code', () => {
    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const root = document.getElementById('markdown-content');
    root.innerHTML = '<pre><code>echo safe\u202E hidden</code></pre>';
    enhanceCodeBlocks(root);
    root.querySelector('button').click();
    expect(writeText).not.toHaveBeenCalled();
    delete navigator.clipboard;
  });
});

describe('document resource limits', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  it('counts UTF-8 bytes and rejects oversized data before parsing', () => {
    expect(documentByteLength('aé😀')).toBe(7);
    expect(() => assertDocumentSize('é'.repeat(4 * 1024 * 1024 + 1))).toThrow(
      /8 MiB/
    );
    expect(() => assertDocumentComplexity('x\n'.repeat(20001))).toThrow(
      /complex/
    );
  });

  it('cancels a remote body as soon as streamed bytes exceed the cap', async () => {
    global.TextDecoder = TextDecoder;
    const reader = {
      read: jest.fn().mockResolvedValue({
        done: false,
        value: new Uint8Array(8 * 1024 * 1024 + 1),
      }),
      cancel: jest.fn(),
      releaseLock: jest.fn(),
    };
    await expect(
      readDocumentResponse({
        headers: { get: () => null },
        body: { getReader: () => reader },
      })
    ).rejects.toThrow(/8 MiB/);
    expect(reader.cancel).toHaveBeenCalledTimes(1);
    expect(reader.read).toHaveBeenCalledTimes(1);
    expect(reader.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('does not fetch insecure document URLs', async () => {
    await handleUrl('http://example.com/private.md');
    expect(fetch).not.toHaveBeenCalledWith(
      'http://example.com/private.md',
      expect.anything()
    );
  });

  it('blocks cleartext image/fetch destinations in CSP while retaining local self', () => {
    const html = fs.readFileSync(
      path.join(__dirname, '../../markdown-viewer/index.html'),
      'utf8'
    );
    const policy = html.match(
      /http-equiv="Content-Security-Policy" content="([^"]+)"/
    )[1];
    const directives = new Map(
      policy.split(';').map((directive) => {
        const [name, ...sources] = directive.trim().split(/\s+/);
        return [name, sources];
      })
    );
    for (const directive of ['img-src', 'connect-src']) {
      expect(directives.get(directive)).toContain('https:');
      expect(directives.get(directive)).toContain("'self'");
      expect(directives.get(directive)).not.toContain('http:');
      expect(directives.get(directive)).not.toContain('*');
    }
  });
});
