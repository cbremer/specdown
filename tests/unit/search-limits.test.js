const { loadHTML, loadApp } = require('../helpers/loadApp');

const findLimitRoot = () => document.getElementById('markdown-content');
const findLimitCount = () => document.getElementById('search-count');
const findLimitMarks = () =>
  findLimitRoot().querySelectorAll('mark.search-highlight');

beforeEach(() => {
  localStorage.setItem('visualTheme', 'default');
  loadHTML(document);
  loadApp(document);
  Element.prototype.scrollIntoView = jest.fn();
});

test.each([999, 1000, 1001])(
  'Find highlights at most 1000 of %i literal matches',
  (matches) => {
    const text = 'prefix ' + 'a'.repeat(matches) + ' untouched suffix';
    findLimitRoot().textContent = text;
    const create = jest.spyOn(document, 'createElement');
    try {
      runSearch('a');
      const highlighted = Math.min(matches, 1000);
      expect(findLimitMarks()).toHaveLength(highlighted);
      expect(
        create.mock.calls.filter(([name]) => name === 'mark')
      ).toHaveLength(highlighted);
      expect(findLimitCount().textContent).toBe(
        `1 / ${highlighted}${matches > 1000 ? '+' : ''}`
      );
      expect(findLimitRoot().textContent).toBe(text);
      clearSearchHighlights();
      expect(findLimitRoot().textContent).toBe(text);
      expect(findLimitMarks()).toHaveLength(0);
    } finally {
      create.mockRestore();
    }
  }
);

test('the first overflow match is detected without allocating its mark', () => {
  findLimitRoot().textContent = 'a'.repeat(1001);
  const originalCreate = document.createElement.bind(document);
  let marksCreated = 0;
  const create = jest
    .spyOn(document, 'createElement')
    .mockImplementation((name, ...args) => {
      if (name === 'mark' && ++marksCreated > 1000) {
        throw new Error('Synthetic stop: attempted highlight 1001');
      }
      return originalCreate(name, ...args);
    });
  try {
    expect(() => runSearch('a')).not.toThrow();
    expect(marksCreated).toBe(1000);
    expect(findLimitCount().textContent).toBe('1 / 1000+');
  } finally {
    create.mockRestore();
  }
});

test('the highlight cap is global across nodes and preserves the overflow suffix and later nodes', () => {
  findLimitRoot().innerHTML =
    '<p>' +
    'word '.repeat(600) +
    '</p><p><em>' +
    'WORD '.repeat(401) +
    '</em>suffix &amp; &lt;literal&gt;</p><p id="synthetic-later">word after limit</p>';
  const originalHtml = findLimitRoot().innerHTML;
  const originalText = findLimitRoot().textContent;
  const laterTextNode = document.getElementById('synthetic-later').firstChild;
  runSearch('word');
  expect(findLimitMarks()).toHaveLength(1000);
  expect(findLimitRoot().querySelectorAll('em mark')).toHaveLength(400);
  expect(document.getElementById('synthetic-later').firstChild).toBe(
    laterTextNode
  );
  expect(findLimitRoot().textContent).toBe(originalText);
  expect(findLimitCount().textContent).toBe('1 / 1000+');
  clearSearchHighlights();
  expect(findLimitRoot().innerHTML).toBe(originalHtml);
});

test('overflow beginning in another node leaves that entire node unchanged', () => {
  findLimitRoot().innerHTML =
    '<p>' + 'x'.repeat(1000) + '</p><p id="synthetic-overflow">x tail</p>';
  const overflow = document.getElementById('synthetic-overflow');
  const textNode = overflow.firstChild;
  runSearch('x');
  expect(findLimitMarks()).toHaveLength(1000);
  expect(overflow.firstChild).toBe(textNode);
  expect(overflow.textContent).toBe('x tail');
  expect(findLimitCount().textContent).toBe('1 / 1000+');
});

test('an exact cap followed only by nonmatches is not described as truncated', () => {
  findLimitRoot().innerHTML =
    '<p>' + 'x'.repeat(1000) + '</p><p>no further hits</p>';
  runSearch('x');
  expect(findLimitMarks()).toHaveLength(1000);
  expect(findLimitCount().textContent).toBe('1 / 1000');
  expect(findLimitCount().getAttribute('aria-label')).toBe('Match 1 of 1000');
  expect(findLimitCount().hasAttribute('title')).toBe(false);
});

test('truncated results explain the limit accessibly and navigation wraps only within shown matches', () => {
  findLimitRoot().textContent = 'x'.repeat(1001);
  runSearch('x');
  expect(findLimitCount().getAttribute('role')).toBe('status');
  expect(findLimitCount().getAttribute('aria-live')).toBe('polite');
  expect(findLimitCount().getAttribute('aria-atomic')).toBe('true');
  expect(findLimitCount().getAttribute('aria-label')).toBe(
    'Match 1 of the first 1000 matches. More matches are not highlighted.'
  );
  expect(findLimitCount().title).toBe(
    'Showing the first 1000 matches. More matches are not highlighted.'
  );
  navigateSearch(-1);
  expect(findLimitCount().textContent).toBe('1000 / 1000+');
  expect(
    findLimitRoot().querySelectorAll('.search-highlight-current')
  ).toHaveLength(1);
  expect(
    findLimitMarks()[999].classList.contains('search-highlight-current')
  ).toBe(true);
  navigateSearch(1);
  expect(findLimitCount().textContent).toBe('1 / 1000+');
  expect(
    findLimitMarks()[0].classList.contains('search-highlight-current')
  ).toBe(true);
});

test.each(['clear', 'empty query', 'close', 'new search'])(
  '%s removes stale truncation state and preserves source text',
  (action) => {
    const text = 'x'.repeat(1001) + ' unique';
    findLimitRoot().textContent = text;
    runSearch('x');
    if (action === 'clear') clearSearchHighlights();
    else if (action === 'empty query') runSearch('');
    else if (action === 'close') closeSearch();
    else runSearch('unique');
    expect(findLimitRoot().textContent).toBe(text);
    expect(findLimitCount().textContent).toBe(
      action === 'new search' ? '1 / 1' : ''
    );
    expect(findLimitCount().title).toBe('');
    expect(findLimitCount().getAttribute('aria-label') || '').not.toContain(
      'first 1000'
    );
    expect(findLimitMarks()).toHaveLength(action === 'new search' ? 1 : 0);
  }
);

test('literal matching and existing composed/decomposed accent behavior remain unchanged', () => {
  findLimitRoot().textContent =
    'a.b+c[?] A.B+C[?] axbbbc? café CAFÉ cafe\u0301';
  runSearch('a.b+c[?]');
  expect([...findLimitMarks()].map((mark) => mark.textContent)).toEqual([
    'a.b+c[?]',
    'A.B+C[?]',
  ]);
  runSearch('café');
  expect([...findLimitMarks()].map((mark) => mark.textContent)).toEqual([
    'café',
    'CAFÉ',
  ]);
  runSearch('cafe\u0301');
  expect([...findLimitMarks()].map((mark) => mark.textContent)).toEqual([
    'cafe\u0301',
  ]);
});

test('diagram text remains excluded from the result limit', () => {
  findLimitRoot().innerHTML =
    '<div class="diagram-wrapper">' + 'x'.repeat(1001) + '</div><p>x</p>';
  runSearch('x');
  expect(findLimitMarks()).toHaveLength(1);
  expect(
    findLimitRoot().querySelector('.diagram-wrapper').childNodes
  ).toHaveLength(1);
  expect(findLimitCount().textContent).toBe('1 / 1');
});
