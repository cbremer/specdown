const { loadHTML, loadApp } = require('../helpers/loadApp');

const timeoutDiagram = `sequenceDiagram
    participant C as Client
    participant A as API
    actor W as Worker
    C->>A: Submit job
    A->>W: Run job
    alt Job completes
        W-->>A: Result
        A-->>C: Response
    else Worker times out
        A->>W: Cancel job
        A-->>C: Response
    end`;

let root;
function diagram(source, labels = []) {
  root.innerHTML =
    '<div class="diagram-container"><button>Expand</button><div class="diagram-wrapper"><svg></svg></div></div>';
  const svg = root.querySelector('svg');
  svg.setAttribute('data-mermaid-source', source);
  for (const label of labels) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('class', 'messageText');
    text.textContent = label;
    svg.appendChild(text);
  }
  return root.querySelector('button');
}

beforeEach(() => {
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  root = document.getElementById('markdown-content');
  window.getSelection().removeAllRanges();
});

test('source spans distinguish identical messages in different branches and retain actor aliases', () => {
  const steps = parseExplainSequence(timeoutDiagram);
  expect(
    steps.map((s) => [s.sender, s.recipient, s.message, s.branches])
  ).toEqual([
    ['Client', 'API', 'Submit job', []],
    ['API', 'Worker', 'Run job', []],
    ['Worker', 'API', 'Result', ['Job completes']],
    ['API', 'Client', 'Response', ['Job completes']],
    ['API', 'Worker', 'Cancel job', ['Worker times out']],
    ['API', 'Client', 'Response', ['Worker times out']],
  ]);
  expect(steps[3].start).toBeLessThan(steps[5].start);
  expect(steps[5].line).toBe(12);
  expect(timeoutDiagram.slice(steps[5].start, steps[5].end)).toBe(
    '        A-->>C: Response'
  );
});

test('a nested else retains its enclosing branch, then end restores unconditional delivery', () => {
  const steps = parseExplainSequence(
    'sequenceDiagram\nalt outer\nalt inner\nA->>B: Send\nelse other\nA->>B: Send\nend\nend\nA->>B: Send'
  );
  expect(steps.map((s) => s.branches)).toEqual([
    ['outer', 'inner'],
    ['outer', 'other'],
    [],
  ]);
});

test.each([
  'flowchart TD\nA-->B',
  'sequenceDiagram\nalt Timeout\nA->>B: Cancel',
  'sequenceDiagram\nelse Timeout\nA->>B: Cancel\nend',
  'sequenceDiagram\nloop Until ready\nA->>B: Retry\nend',
  'sequenceDiagram\nA->>B: First; B->>C: Second',
])(
  'unsupported Mermaid offers source instead of a misleading partial walkthrough',
  (source) => {
    const [scope] = captureExplainScopes(null, diagram(source));
    expect(scope.walkthrough).toBeUndefined();
    expect(scope.fallback).toMatch(/diagram source/i);
    expect(scope.excerpts.map((e) => e.text).join('')).toBe(source);
  }
);

test('SVG citations match the label occurrence and preserve the reading DOM', () => {
  const button = diagram(timeoutDiagram, [
    'Submit job',
    'Run job',
    'Result',
    'Response',
    'Cancel job',
    'Response',
  ]);
  const before = root.innerHTML;
  const [scope] = captureExplainScopes(null, button);
  expect(scope.kind).toBe('diagram');
  expect(scope.walkthrough[5].sourceId).not.toBe(scope.walkthrough[3].sourceId);
  scope.walkthrough[5].reveal();
  expect(window.getSelection().getRangeAt(0).startContainer).toBe(
    root.querySelectorAll('.messageText')[5]
  );
  expect(root.innerHTML).toBe(before);
});

test('a missing SVG mapping opens the original line with neighboring source and closes on invalidation', () => {
  const [scope] = captureExplainScopes(
    null,
    diagram(timeoutDiagram, ['Response'])
  );
  scope.walkthrough[5].reveal();
  const dialog = document.querySelector('.sd-modal');
  expect(dialog.querySelector('h2').textContent).toContain('Line 12');
  const mark = dialog.querySelector('mark');
  expect(mark.textContent.trim()).toBe('A-->>C: Response');
  expect(mark.previousSibling.textContent).toContain('else Worker times out');
  expect(mark.nextSibling.textContent).toBe('\n    end');
  invalidateDocumentContext();
  closeExplainSource();
  scope.walkthrough[3].reveal();
  expect(document.querySelector('.sd-modal')).toBeNull();
});

test('a cross-block selection preserves exact partial offsets and selected inline markup', () => {
  root.innerHTML =
    '<h2>Policy</h2><p>First <em>retry twice</em> here.</p><p>First <b>retry twice</b> here.</p><h2>Other</h2><p>Never include.</p>';
  const first = root.querySelector('em').firstChild;
  const second = root.querySelector('b').firstChild;
  const range = document.createRange();
  range.setStart(first, 2);
  range.setEnd(second, 4);
  const [selection, section, documentScope] = captureExplainScopes(range);
  expect(selection.label).toBe('Selection · Policy');
  expect(selection.excerpts.map((e) => e.text)).toEqual([
    'try twice here.',
    'First retr',
  ]);
  expect(section.excerpts.map((e) => e.text)).toEqual([
    'Policy',
    'First retry twice here.',
    'First retry twice here.',
  ]);
  expect(documentScope.excerpts.at(-1).text).toBe('Never include.');
  selection.excerpts[1].reveal();
  expect(window.getSelection().toString()).toBe('First retr');
  expect(window.getSelection().getRangeAt(0).endContainer).toBe(second);
  expect(window.getSelection().getRangeAt(0).endOffset).toBe(4);
  expect(captureExplainScopes(range)[0].excerpts[0].id).toBe(
    selection.excerpts[0].id
  );
  range.setStart(first, 3);
  expect(captureExplainScopes(range)[0].excerpts[0].id).not.toBe(
    selection.excerpts[0].id
  );
});

test('the containing section includes lower rank headings and excludes control labels', () => {
  root.innerHTML =
    '<h1>Top</h1><h2>Outer<span class="annotation-badge">1</span></h2><pre><code>a\n<span>b</span> = c</code><button class="code-copy-btn">Copy</button></pre><h3>Inner</h3><p>Child.</p><h2>Next</h2>';
  const [code, section, whole] = captureExplainScopes(
    null,
    root.querySelector('button')
  );
  expect(code.excerpts.map((e) => e.text)).toEqual(['a\n', 'b = c']);
  code.excerpts[1].reveal();
  expect(window.getSelection().getRangeAt(0).startContainer).toBe(
    root.querySelector('code span').firstChild
  );
  expect(section.label).toBe('Section · Outer');
  expect(section.excerpts.map((e) => e.text)).toEqual([
    'Outer',
    'a\n',
    'b = c',
    'Inner',
    'Child.',
  ]);
  expect(whole.excerpts.at(-1).text).toBe('Next');
});

test('the visible section is based on the reading viewport and a headingless document remains reachable', () => {
  root.innerHTML = '<h2>One</h2><p>Earlier</p><h2>Two</h2><p>Later</p>';
  for (const [i, el] of [...root.children].entries())
    el.getBoundingClientRect = () => ({
      height: 20,
      bottom: (i - 2) * 40 + 20,
    });
  expect(captureExplainScopes(null, null)[0].label).toBe('Section · Two');
  root.innerHTML = '<p>Read this<br>and this.</p>';
  expect(captureExplainScopes(null, null).map((s) => s.kind)).toEqual([
    'document',
  ]);
  expect(
    captureExplainScopes(null, null)[0].excerpts.map((e) => e.text)
  ).toEqual(['Read this', 'and this.']);
});

test('limits cite contiguous coverage and preserve long diagram step navigation', () => {
  root.innerHTML =
    '<h2>Long section</h2><p>' + 'x'.repeat(7500) + '</p><h2>Last section</h2>';
  const whole = captureExplainScopes(null, null).at(-1);
  expect(whole.excerpts.every((e) => e.text.length <= 1000)).toBe(true);
  expect(
    whole.excerpts.reduce((n, e) => n + e.text.length, 0)
  ).toBeLessThanOrEqual(6000);
  expect(whole.coverage).toContain(
    'Coverage stops before the next passage in “Long section”'
  );
  const [longDiagram] = captureExplainScopes(
    null,
    diagram('sequenceDiagram\n' + 'A->>B: Again\n'.repeat(45))
  );
  expect(longDiagram.excerpts).toHaveLength(24);
  expect(longDiagram.walkthrough).toHaveLength(45);
  longDiagram.walkthrough.at(-1).reveal();
  expect(document.querySelector('.sd-modal h2').textContent).toContain(
    'Line 46'
  );
});

test('a citation for an earlier revision cannot select the replacement document', () => {
  root.innerHTML = '<p>Repeated text</p>';
  const [scope] = captureExplainScopes();
  invalidateDocumentContext();
  root.innerHTML = '<p>Repeated text</p>';
  scope.excerpts[0].reveal();
  expect(window.getSelection().rangeCount).toBe(0);
});

test('the picker exposes neighboring diagrams and code as lazy, distinctly named scopes', () => {
  diagram(timeoutDiagram);
  const figure = root.firstElementChild;
  figure.insertAdjacentHTML('beforebegin', '<h2>Worker lifecycle</h2>');
  root.append(figure.cloneNode(true));
  root.insertAdjacentHTML('beforeend', '<pre><code>let a = 7;</code></pre>');
  const parse = jest.spyOn(global, 'parseExplainSequence');
  try {
    const scopes = captureExplainScopes(null, null);
    expect(scopes.map((s) => s.label)).toEqual([
      'Section · Worker lifecycle',
      'Diagram · Worker lifecycle (1)',
      'Diagram · Worker lifecycle (2)',
      'Code block · Worker lifecycle',
      'Whole document',
    ]);
    expect(parse).not.toHaveBeenCalled();
    const second = scopes[2];
    expect(second.walkthrough).toHaveLength(6);
    expect(second.excerpts).toHaveLength(6);
    expect(parse).toHaveBeenCalledTimes(1);
    const [preferred] = captureExplainScopes(
      null,
      root.querySelectorAll('button')[1]
    );
    expect(preferred.key).toBe(second.key);
    expect(preferred.key).not.toBe(scopes[1].key);
    expect(parse).toHaveBeenCalledTimes(1);
    preferred.walkthrough[5].reveal();
    expect(document.querySelector('.sd-modal h2').textContent).toContain(
      'Line 12'
    );
  } finally {
    parse.mockRestore();
  }
});

test('an unfocused headingless document stays first even with identifiable diagrams and code', () => {
  diagram(timeoutDiagram);
  root.insertAdjacentHTML('beforeend', '<pre><code>x</code></pre>');
  expect(captureExplainScopes(null, null).map((s) => s.kind)).toEqual([
    'document',
    'diagram',
    'code',
  ]);
});

test('selection keys include the end boundary even beyond the provider budget', () => {
  root.innerHTML = '<p>' + 'x'.repeat(8000) + '</p>';
  const text = root.firstElementChild.firstChild;
  const range = document.createRange();
  range.setStart(text, 0);
  range.setEnd(text, 7000);
  const [first] = captureExplainScopes(range);
  range.setEnd(text, 8000);
  const [second] = captureExplainScopes(range);
  expect(first.excerpts.map((e) => e.id)).toEqual(
    second.excerpts.map((e) => e.id)
  );
  expect(first.key).not.toBe(second.key);
});
