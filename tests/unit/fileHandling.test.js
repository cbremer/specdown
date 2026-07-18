/**
 * Unit tests for file handling functionality
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('File Handling', () => {
  beforeEach(() => {
    // Load HTML structure
    loadHTML(document);
    // Load app.js
    loadApp(document);
  });

  describe('handleFile', () => {
    it('should accept .md files', (done) => {
      const file = new File(['# Test'], 'test.md', { type: 'text/markdown' });

      // Create spy on FileReader
      const originalFileReader = global.FileReader;
      const mockOnLoad = jest.fn();

      global.FileReader = class {
        constructor() {
          this.readAsText = jest.fn(function() {
            this.result = '# Test';
            setTimeout(() => {
              if (this.onload) {
                this.onload({ target: this });
              }
              mockOnLoad();
              done();
            }, 0);
          });
        }
      };

      // Call handleFile (available in global scope after loadApp)
      handleFile(file);

      // Restore original FileReader
      setTimeout(() => {
        global.FileReader = originalFileReader;
      }, 10);
    });

    it('should accept .markdown files', (done) => {
      const file = new File(['# Test'], 'test.markdown', { type: 'text/markdown' });

      const originalFileReader = global.FileReader;

      global.FileReader = class {
        constructor() {
          this.readAsText = jest.fn(function() {
            this.result = '# Test';
            setTimeout(() => {
              if (this.onload) {
                this.onload({ target: this });
              }
              done();
            }, 0);
          });
        }
      };

      handleFile(file);

      setTimeout(() => {
        global.FileReader = originalFileReader;
      }, 10);
    });

    it('should reject .txt files with a warning toast', () => {
      const file = new File(['Test content'], 'test.txt', { type: 'text/plain' });

      handleFile(file);

      expect(global.alert).not.toHaveBeenCalled();
      const toast = document.querySelector('.toast');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toBe(
        'Please select a valid Markdown file (.md or .markdown)'
      );
      expect(toast.classList.contains('toast-warning')).toBe(true);
      expect(toast.getAttribute('role')).toBe('status');
    });

    it('should reject files without extensions', () => {
      const file = new File(['Test'], 'test', { type: 'text/plain' });

      handleFile(file);

      const toast = document.querySelector('.toast');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toBe(
        'Please select a valid Markdown file (.md or .markdown)'
      );
    });

    it('should handle file read errors with an error toast', (done) => {
      const file = new File(['# Test'], 'test.md', { type: 'text/markdown' });

      const originalFileReader = global.FileReader;

      global.FileReader = class {
        constructor() {
          this.readAsText = jest.fn(function() {
            setTimeout(() => {
              if (this.onerror) {
                this.onerror(new Error('Read failed'));
              }

              const toast = document.querySelector('.toast');
              expect(toast).not.toBeNull();
              expect(toast.textContent).toBe('Error reading file. Please try again.');
              expect(toast.classList.contains('toast-error')).toBe(true);
              expect(toast.getAttribute('role')).toBe('alert');
              done();
            }, 0);
          });
        }
      };

      handleFile(file);

      setTimeout(() => {
        global.FileReader = originalFileReader;
      }, 10);
    });

    it('should handle case-insensitive file extensions', (done) => {
      const file = new File(['# Test'], 'test.MD', { type: 'text/markdown' });

      const originalFileReader = global.FileReader;

      global.FileReader = class {
        constructor() {
          this.readAsText = jest.fn(function() {
            this.result = '# Test';
            setTimeout(() => {
              if (this.onload) {
                this.onload({ target: this });
              }
              done();
            }, 0);
          });
        }
      };

      handleFile(file);

      setTimeout(() => {
        global.FileReader = originalFileReader;
      }, 10);
    });
  });

  describe('handleFileSelect', () => {
    it('should process first file from input', () => {
      const file = new File(['# Test'], 'test.md', { type: 'text/markdown' });
      const event = {
        target: {
          files: [file]
        }
      };

      // Spy on handleFile
      const originalHandleFile = global.handleFile;
      global.handleFile = jest.fn();

      handleFileSelect(event);

      expect(global.handleFile).toHaveBeenCalledWith(file);

      global.handleFile = originalHandleFile;
    });

    it('should handle empty file list', () => {
      const event = {
        target: {
          files: []
        }
      };

      const originalHandleFile = global.handleFile;
      global.handleFile = jest.fn();

      handleFileSelect(event);

      expect(global.handleFile).not.toHaveBeenCalled();

      global.handleFile = originalHandleFile;
    });
  });

  describe('browse button click', () => {
    it('should stop propagation to prevent double fileInput.click()', () => {
      const browseButton = document.getElementById('browse-button');
      const fileInput = document.getElementById('file-input');

      const clickSpy = jest.fn();
      fileInput.click = clickSpy;

      // Simulate a click event on the browse button
      const event = new Event('click', { bubbles: true });
      browseButton.dispatchEvent(event);

      // fileInput.click() should be called exactly once, not twice
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleDrop', () => {
    it('should extract file from drag event', () => {
      const file = new File(['# Test'], 'test.md', { type: 'text/markdown' });
      const event = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        dataTransfer: {
          files: [file]
        }
      };

      const originalHandleFile = global.handleFile;
      global.handleFile = jest.fn();

      handleDrop(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(global.handleFile).toHaveBeenCalledWith(file);

      global.handleFile = originalHandleFile;
    });

    it('should handle empty file list from drop', () => {
      const event = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        dataTransfer: {
          files: []
        }
      };

      const originalHandleFile = global.handleFile;
      global.handleFile = jest.fn();

      handleDrop(event);

      expect(global.handleFile).not.toHaveBeenCalled();

      global.handleFile = originalHandleFile;
    });

    it('should remove drag-over class on drop', () => {
      const dropZone = document.getElementById('drop-zone');
      dropZone.classList.add('drag-over');

      const file = new File(['# Test'], 'test.md', { type: 'text/markdown' });
      const event = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        dataTransfer: {
          files: [file]
        }
      };

      handleDrop(event);

      expect(dropZone.classList.contains('drag-over')).toBe(false);
    });
  });
});

// Bridge-first describe (single init per test): on desktop, drops route
// through the main process by absolute path so files open file-backed (live
// reload + Reload from disk) and folders become real desktop workspaces.
// This was the drag-and-drop bug where dropped documents opened without the
// Live chip: the web fallback reads content only, and Electron v32+ removed
// the legacy File.path the old code relied on.
describe('Drag and drop (desktop bridge routing)', () => {
  beforeEach(() => {
    localStorage.clear();
    window.specdown = {
      isDesktop: true,
      getPathForFile: jest.fn((file) => '/abs/' + file.name),
      openDroppedPath: jest.fn(),
      watchFile: jest.fn(),
      unwatchFile: jest.fn(),
      saveSession: jest.fn(),
      onFileOpened: jest.fn(),
      onCloseTab: jest.fn(),
      onFileChanged: jest.fn(),
      onTriggerPrint: jest.fn(),
      onTriggerSearch: jest.fn(),
      onApplyCustomCss: jest.fn(),
    };
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    delete window.specdown;
  });

  const dropEvent = (files) => ({
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    dataTransfer: { files },
  });

  it('routes dropped files to the shell by absolute path (no content-only tab)', () => {
    const file = new File(['# Test'], 'test.md', { type: 'text/markdown' });
    handleDrop(dropEvent([file]));

    expect(window.specdown.openDroppedPath).toHaveBeenCalledWith('/abs/test.md');
    // The tab arrives later via the shell's file-opened event — the renderer
    // must NOT also open a pathless copy through the web reader.
    expect(state.tabs.length).toBe(0);
  });

  it('routes each dropped item (files and folders share the path channel)', () => {
    const a = new File(['# A'], 'a.md', { type: 'text/markdown' });
    const b = new File([''], 'docs', { type: '' }); // a dropped folder surfaces as a typeless File
    handleDrop(dropEvent([a, b]));

    expect(window.specdown.openDroppedPath).toHaveBeenCalledWith('/abs/a.md');
    expect(window.specdown.openDroppedPath).toHaveBeenCalledWith('/abs/docs');
  });

  it('falls back to the web reader when the shell cannot resolve paths', () => {
    window.specdown.getPathForFile.mockReturnValue('');
    const file = new File(['# Test'], 'test.md', { type: 'text/markdown' });
    handleDrop(dropEvent([file]));

    expect(window.specdown.openDroppedPath).not.toHaveBeenCalled();
    // Web reader path proceeds (FileReader is async; just assert no crash and
    // that the drop wasn't swallowed by the desktop branch).
  });
});

