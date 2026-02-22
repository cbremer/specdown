/**
 * Tests for desktop/main.js — Electron main process logic
 *
 * These tests cover the pure functions exported from main.js:
 * file validation, file reading, and menu construction.
 * Electron APIs are mocked since we run in a Node/jsdom environment.
 */

const path = require('path');
const fs = require('fs');

// Mock Electron modules before requiring main.js
jest.mock('electron', () => ({
  app: {
    name: 'Specdown Desktop',
    whenReady: jest.fn(() => ({ then: jest.fn() })),
    on: jest.fn(),
    quit: jest.fn(),
  },
  BrowserWindow: jest.fn(() => ({
    loadFile: jest.fn(),
    webContents: { on: jest.fn(), send: jest.fn() },
    on: jest.fn(),
  })),
  Menu: {
    buildFromTemplate: jest.fn((template) => template),
    setApplicationMenu: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn(),
  },
  ipcMain: {
    on: jest.fn(),
  },
}));

const { isValidMarkdownFile, readMarkdownFile, buildMenu, VALID_EXTENSIONS } = require('../../desktop/main');

describe('desktop/main.js', () => {
  describe('VALID_EXTENSIONS', () => {
    it('includes .md and .markdown', () => {
      expect(VALID_EXTENSIONS).toContain('.md');
      expect(VALID_EXTENSIONS).toContain('.markdown');
    });

    it('does not include other extensions', () => {
      expect(VALID_EXTENSIONS).not.toContain('.txt');
      expect(VALID_EXTENSIONS).not.toContain('.html');
    });
  });

  describe('isValidMarkdownFile', () => {
    it('returns true for .md files', () => {
      expect(isValidMarkdownFile('/path/to/file.md')).toBe(true);
    });

    it('returns true for .markdown files', () => {
      expect(isValidMarkdownFile('/path/to/file.markdown')).toBe(true);
    });

    it('returns true regardless of case', () => {
      expect(isValidMarkdownFile('/path/to/FILE.MD')).toBe(true);
      expect(isValidMarkdownFile('/path/to/FILE.Markdown')).toBe(true);
    });

    it('returns false for .txt files', () => {
      expect(isValidMarkdownFile('/path/to/file.txt')).toBe(false);
    });

    it('returns false for .html files', () => {
      expect(isValidMarkdownFile('/path/to/file.html')).toBe(false);
    });

    it('returns false for files with no extension', () => {
      expect(isValidMarkdownFile('/path/to/README')).toBe(false);
    });

    it('returns false for .md embedded in the filename', () => {
      expect(isValidMarkdownFile('/path/to/file.md.bak')).toBe(false);
    });
  });

  describe('readMarkdownFile', () => {
    const fixturesDir = path.join(__dirname, '..', 'fixtures');

    it('reads a markdown file and returns filename, filePath, and content', () => {
      // Use an actual fixture file
      const fixturePath = path.join(fixturesDir, 'test-read.md');
      const testContent = '# Test\n\nHello world\n';
      fs.writeFileSync(fixturePath, testContent);

      try {
        const result = readMarkdownFile(fixturePath);
        expect(result.filename).toBe('test-read.md');
        expect(result.filePath).toBe(fixturePath);
        expect(result.content).toBe(testContent);
      } finally {
        fs.unlinkSync(fixturePath);
      }
    });

    it('throws for non-existent files', () => {
      expect(() => {
        readMarkdownFile('/nonexistent/path/file.md');
      }).toThrow();
    });
  });

  describe('buildMenu', () => {
    const { Menu } = require('electron');

    beforeEach(() => {
      Menu.buildFromTemplate.mockClear();
      Menu.setApplicationMenu.mockClear();
    });

    it('calls Menu.buildFromTemplate and Menu.setApplicationMenu', () => {
      buildMenu();
      expect(Menu.buildFromTemplate).toHaveBeenCalledTimes(1);
      expect(Menu.setApplicationMenu).toHaveBeenCalledTimes(1);
    });

    it('includes a File menu with Open item', () => {
      buildMenu();
      const template = Menu.buildFromTemplate.mock.calls[0][0];
      const fileMenu = template.find(m => m.label === 'File');
      expect(fileMenu).toBeDefined();

      const openItem = fileMenu.submenu.find(item => item.label === 'Open...');
      expect(openItem).toBeDefined();
      expect(openItem.accelerator).toBe('CmdOrCtrl+O');
      expect(typeof openItem.click).toBe('function');
    });

    it('includes a File menu with Close Tab item', () => {
      buildMenu();
      const template = Menu.buildFromTemplate.mock.calls[0][0];
      const fileMenu = template.find(m => m.label === 'File');
      const closeItem = fileMenu.submenu.find(item => item.label === 'Close Tab');
      expect(closeItem).toBeDefined();
      expect(closeItem.accelerator).toBe('CmdOrCtrl+W');
    });

    it('includes Edit, View, and Window menus', () => {
      buildMenu();
      const template = Menu.buildFromTemplate.mock.calls[0][0];
      expect(template.find(m => m.label === 'Edit')).toBeDefined();
      expect(template.find(m => m.label === 'View')).toBeDefined();
      expect(template.find(m => m.label === 'Window')).toBeDefined();
    });
  });

  describe('IPC handlers', () => {
    it('registers request-file-open and close-active-tab handlers', () => {
      const { ipcMain } = require('electron');
      // ipcMain.on is called when main.js is first required (module-level)
      const registeredChannels = ipcMain.on.mock.calls.map(call => call[0]);
      expect(registeredChannels).toContain('request-file-open');
      expect(registeredChannels).toContain('close-active-tab');
    });
  });
});
