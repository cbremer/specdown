/**
 * Tests for desktop/main.js — Electron main process logic
 *
 * These tests cover the pure functions exported from main.js:
 * file validation, file reading, and menu construction.
 * Electron APIs are mocked since we run in a Node/jsdom environment.
 */

const path = require('path');
const fs = require('fs');

// Mock chokidar before requiring main.js
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    close: jest.fn(),
  })),
}));

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

const { isValidMarkdownFile, readMarkdownFile, buildMenu, watchFile, unwatchFile, watchers, VALID_EXTENSIONS } = require('../../desktop/main');

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

    it('registers watch-file and unwatch-file handlers', () => {
      const { ipcMain } = require('electron');
      const registeredChannels = ipcMain.on.mock.calls.map(call => call[0]);
      expect(registeredChannels).toContain('watch-file');
      expect(registeredChannels).toContain('unwatch-file');
    });
  });

  describe('file watching', () => {
    const chokidar = require('chokidar');

    beforeEach(() => {
      // Clear watchers map and reset mocks between tests
      watchers.clear();
      chokidar.watch.mockClear();
      chokidar.watch.mockReturnValue({
        on: jest.fn().mockReturnThis(),
        close: jest.fn(),
      });
    });

    afterEach(() => {
      // Clean up any watchers created during tests
      watchers.forEach((watcher) => watcher.close());
      watchers.clear();
    });

    describe('watchFile', () => {
      it('creates a chokidar watcher for the given path', () => {
        const mockWebContents = { isDestroyed: jest.fn(() => false), send: jest.fn() };
        watchFile('/path/to/file.md', mockWebContents);

        expect(chokidar.watch).toHaveBeenCalledWith('/path/to/file.md', expect.objectContaining({
          persistent: true,
          ignoreInitial: true,
        }));
        expect(watchers.has('/path/to/file.md')).toBe(true);
      });

      it('does not create a second watcher for the same path', () => {
        const mockWebContents = { isDestroyed: jest.fn(() => false), send: jest.fn() };
        watchFile('/path/to/file.md', mockWebContents);
        watchFile('/path/to/file.md', mockWebContents);

        expect(chokidar.watch).toHaveBeenCalledTimes(1);
        expect(watchers.size).toBe(1);
      });

      it('registers a change handler on the watcher', () => {
        const mockWatcher = { on: jest.fn().mockReturnThis(), close: jest.fn() };
        chokidar.watch.mockReturnValue(mockWatcher);
        const mockWebContents = { isDestroyed: jest.fn(() => false), send: jest.fn() };

        watchFile('/path/to/file.md', mockWebContents);

        expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
      });

      it('can watch multiple different paths', () => {
        const mockWebContents = { isDestroyed: jest.fn(() => false), send: jest.fn() };
        watchFile('/path/to/a.md', mockWebContents);
        watchFile('/path/to/b.md', mockWebContents);

        expect(watchers.size).toBe(2);
        expect(watchers.has('/path/to/a.md')).toBe(true);
        expect(watchers.has('/path/to/b.md')).toBe(true);
      });
    });

    describe('unwatchFile', () => {
      it('closes the watcher and removes it from the map', () => {
        const mockWatcher = { on: jest.fn().mockReturnThis(), close: jest.fn() };
        chokidar.watch.mockReturnValue(mockWatcher);
        const mockWebContents = { isDestroyed: jest.fn(() => false), send: jest.fn() };

        watchFile('/path/to/file.md', mockWebContents);
        expect(watchers.has('/path/to/file.md')).toBe(true);

        unwatchFile('/path/to/file.md');

        expect(mockWatcher.close).toHaveBeenCalledTimes(1);
        expect(watchers.has('/path/to/file.md')).toBe(false);
      });

      it('does nothing if the path is not being watched', () => {
        expect(() => unwatchFile('/not/watched.md')).not.toThrow();
      });
    });
  });
});
