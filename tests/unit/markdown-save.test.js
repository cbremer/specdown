const fs = require('fs');
const os = require('os');
const path = require('path');

describe('safe Markdown file writes', () => {
  let folder, target;
  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-save-'));
    target = path.join(folder, 'test.md');
    fs.writeFileSync(target, 'A\r\n  tail  \r\n');
  });
  afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));
  test('compares the source before writing and returns the new external version', () => {
    const { saveExistingMarkdown } = require('../../desktop/markdown-save');
    expect(saveExistingMarkdown(target, 'draft', 'wrong')).toEqual({
      status: 'conflict',
      content: 'A\r\n  tail  \r\n',
    });
    expect(fs.readFileSync(target, 'utf8')).toBe('A\r\n  tail  \r\n');
    expect(
      saveExistingMarkdown(target, 'B\r\n  tail  \r\n', 'A\r\n  tail  \r\n')
        .status
    ).toBe('saved');
    expect(fs.readFileSync(target, 'utf8')).toBe('B\r\n  tail  \r\n');
  });
  test('a failed replacement retains the original and cleans the staged file', () => {
    const { saveExistingMarkdown } = require('../../desktop/markdown-save');
    const faulty = Object.create(fs);
    faulty.renameSync = () => {
      throw Error('disk full');
    };
    expect(() =>
      saveExistingMarkdown(target, 'B', 'A\r\n  tail  \r\n', faulty)
    ).toThrow('disk full');
    expect(fs.readFileSync(target, 'utf8')).toBe('A\r\n  tail  \r\n');
    expect(fs.readdirSync(folder)).toEqual(['test.md']);
  });
});

test('copy creation does not overwrite a destination created after selection', () => {
  const { saveMarkdownCopy } = require('../../desktop/markdown-save');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-copy-')),
    target = path.join(folder, 'copy.md');
  try {
    const racing = Object.create(fs);
    racing.linkSync = (staged, destination) => {
      fs.writeFileSync(destination, 'external');
      fs.linkSync(staged, destination);
    };
    expect(() => saveMarkdownCopy(target, 'copy', racing)).toThrow();
    expect(fs.readFileSync(target, 'utf8')).toBe('external');
    expect(fs.readdirSync(folder)).toEqual(['copy.md']);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test('Store saves stage outside a file-only grant for new copies and later edits', () => {
  const {
    saveMarkdownCopy,
    saveExistingMarkdown,
  } = require('../../desktop/markdown-save');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-store-save-'));
  const target = path.join(folder, 'copy.md');
  const sandbox = {
    replacementDirectory: jest.fn(() =>
      fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-stage-'))
    ),
    commitNewFile: (from, to) => fs.renameSync(from, to),
  };
  const io = Object.create(fs);
  io.writeFileSync = (file, ...args) => {
    if (path.dirname(file) === folder) throw Error('outside the file grant');
    return fs.writeFileSync(file, ...args);
  };
  try {
    expect(saveMarkdownCopy(target, 'OCR page', io, sandbox).status).toBe(
      'saved'
    );
    expect(
      saveExistingMarkdown(target, 'edited', 'OCR page', io, sandbox).status
    ).toBe('saved');
    expect(saveMarkdownCopy(target, 'replaced', io, sandbox).status).toBe(
      'saved'
    );
    expect(
      sandbox.replacementDirectory.mock.calls.map(([item]) => item)
    ).toEqual([folder, fs.realpathSync(target), fs.realpathSync(target)]);
    expect(fs.readFileSync(target, 'utf8')).toBe('replaced');
    for (const { value } of sandbox.replacementDirectory.mock.results)
      expect(fs.existsSync(value)).toBe(false);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
