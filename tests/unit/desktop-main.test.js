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
    // A thenable whose `then` never resolves — the IIFE in main.js awaits
    // this, so its body stays suspended during tests and we can exercise
    // the exported pure functions in isolation.
    whenReady: jest.fn(() => ({ then: jest.fn() })),
    on: jest.fn(),
    quit: jest.fn(),
    getPath: jest.fn(() => '/tmp/specdown-test-userdata'),
    addRecentDocument: jest.fn(),
  },
  BrowserWindow: Object.assign(
    jest.fn(() => ({
      loadFile: jest.fn(),
      webContents: { on: jest.fn(), send: jest.fn() },
      on: jest.fn(),
    })),
    { getAllWindows: jest.fn(() => []) }
  ),
  Menu: {
    buildFromTemplate: jest.fn((template) => template),
    setApplicationMenu: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showErrorBox: jest.fn(),
    showMessageBox: jest.fn(),
  },
  ipcMain: {
    on: jest.fn(),
  },
  globalShortcut: {
    register: jest.fn(),
    unregisterAll: jest.fn(),
  },
  shell: {
    openPath: jest.fn(),
    showItemInFolder: jest.fn(),
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

    it('includes a Help menu with Open Log File', () => {
      buildMenu();
      const template = Menu.buildFromTemplate.mock.calls[0][0];
      const helpMenu = template.find(m => m.label === 'Help');
      expect(helpMenu).toBeDefined();

      const openLog = helpMenu.submenu.find(item => item.label === 'Open Log File');
      expect(openLog).toBeDefined();
      expect(typeof openLog.click).toBe('function');
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
      // Route cleanup through unwatchFile so the internal dirWatchers
      // map also gets cleared between tests (entries in `watchers` are
      // metadata, not chokidar watchers).
      [...watchers.keys()].forEach((filePath) => unwatchFile(filePath));
      watchers.clear();
    });

    describe('watchFile', () => {
      it('creates a chokidar watcher for the parent directory of the file', () => {
        const mockWebContents = { isDestroyed: jest.fn(() => false), send: jest.fn() };
        watchFile('/path/to/file.md', mockWebContents);

        // We watch the parent dir (not the file) so atomic renames don't
        // orphan the watcher on the old inode.
        expect(chokidar.watch).toHaveBeenCalledWith('/path/to', expect.objectContaining({
          persistent: true,
          ignoreInitial: true,
          depth: 0,
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

      it('registers change, add, and error handlers on the watcher', () => {
        const mockWatcher = { on: jest.fn().mockReturnThis(), close: jest.fn() };
        chokidar.watch.mockReturnValue(mockWatcher);
        const mockWebContents = { isDestroyed: jest.fn(() => false), send: jest.fn() };

        watchFile('/path/to/file.md', mockWebContents);

        // 'change' for in-place edits; 'add' catches atomic saves (where the
        // editor replaces the file via rename and chokidar sees it as a new
        // add event on the post-rename inode).
        const registeredEvents = mockWatcher.on.mock.calls.map((call) => call[0]);
        expect(registeredEvents).toContain('change');
        expect(registeredEvents).toContain('add');
        expect(registeredEvents).toContain('error');
      });

      it('can watch multiple different paths', () => {
        const mockWebContents = { isDestroyed: jest.fn(() => false), send: jest.fn() };
        watchFile('/path/to/a.md', mockWebContents);
        watchFile('/other/dir/b.md', mockWebContents);

        expect(watchers.size).toBe(2);
        expect(watchers.has('/path/to/a.md')).toBe(true);
        expect(watchers.has('/other/dir/b.md')).toBe(true);
      });

      it('reuses a single chokidar watcher for files in the same directory', () => {
        const mockWebContents = { isDestroyed: jest.fn(() => false), send: jest.fn() };
        watchFile('/shared/dir/a.md', mockWebContents);
        watchFile('/shared/dir/b.md', mockWebContents);

        // One OS-level watch on the parent dir serves both files.
        expect(chokidar.watch).toHaveBeenCalledTimes(1);
        expect(chokidar.watch).toHaveBeenCalledWith('/shared/dir', expect.any(Object));
        expect(watchers.size).toBe(2);
      });

      describe('SPECDOWN_WATCH_POLLING env var', () => {
        const originalEnv = process.env.SPECDOWN_WATCH_POLLING;

        afterEach(() => {
          if (originalEnv === undefined) {
            delete process.env.SPECDOWN_WATCH_POLLING;
          } else {
            process.env.SPECDOWN_WATCH_POLLING = originalEnv;
          }
        });

        it('enables chokidar polling when SPECDOWN_WATCH_POLLING=1', () => {
          process.env.SPECDOWN_WATCH_POLLING = '1';
          const mockWebContents = { isDestroyed: jest.fn(() => false), send: jest.fn() };

          watchFile('/path/to/file.md', mockWebContents);

          expect(chokidar.watch).toHaveBeenCalledWith('/path/to', expect.objectContaining({
            usePolling: true,
            interval: 500,
          }));
        });

        it('does not enable polling when the env var is unset', () => {
          delete process.env.SPECDOWN_WATCH_POLLING;
          const mockWebContents = { isDestroyed: jest.fn(() => false), send: jest.fn() };

          watchFile('/path/to/file.md', mockWebContents);

          const options = chokidar.watch.mock.calls[0][1];
          expect(options.usePolling).toBe(false);
          expect(options.interval).toBeUndefined();
        });

        it('does not enable polling for other truthy values', () => {
          // Only the exact string '1' flips the switch — prevents accidental
          // activation via e.g. `SPECDOWN_WATCH_POLLING=true`.
          process.env.SPECDOWN_WATCH_POLLING = 'true';
          const mockWebContents = { isDestroyed: jest.fn(() => false), send: jest.fn() };

          watchFile('/path/to/file.md', mockWebContents);

          const options = chokidar.watch.mock.calls[0][1];
          expect(options.usePolling).toBe(false);
        });
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

      it('keeps the shared dir watcher alive while other files in it are watched', () => {
        const mockWatcher = { on: jest.fn().mockReturnThis(), close: jest.fn() };
        chokidar.watch.mockReturnValue(mockWatcher);
        const mockWebContents = { isDestroyed: jest.fn(() => false), send: jest.fn() };

        watchFile('/shared/dir/a.md', mockWebContents);
        watchFile('/shared/dir/b.md', mockWebContents);

        unwatchFile('/shared/dir/a.md');
        // One file in /shared/dir is still being watched, so the underlying
        // chokidar watcher must stay open.
        expect(mockWatcher.close).not.toHaveBeenCalled();
        expect(watchers.has('/shared/dir/b.md')).toBe(true);

        unwatchFile('/shared/dir/b.md');
        // Last file gone → watcher closes.
        expect(mockWatcher.close).toHaveBeenCalledTimes(1);
      });

      it('does nothing if the path is not being watched', () => {
        expect(() => unwatchFile('/not/watched.md')).not.toThrow();
      });
    });
  });
});
