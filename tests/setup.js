/**
 * Jest Setup File
 * Configures the testing environment and global mocks
 */

// Import testing library extensions
require('@testing-library/jest-dom');

// Spy on localStorage/sessionStorage methods
// jsdom provides its own Storage implementation, so spy on prototype
// rather than replacing the entire object
jest.spyOn(Storage.prototype, 'getItem');
jest.spyOn(Storage.prototype, 'setItem');
jest.spyOn(Storage.prototype, 'removeItem');
jest.spyOn(Storage.prototype, 'clear');

// Mock alert
global.alert = jest.fn();

// Mock console methods to reduce test noise (optional)
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

// Setup FileReader mock
class FileReaderMock {
  constructor() {
    this.onerror = null;
    this.onload = null;
    this.result = null;
    const self = this;
    this.readAsText = jest.fn(function(file) {
      // Simulate async file reading
      setTimeout(() => {
        if (self.onload) {
          self.result = file.mockContent || '';
          self.onload({ target: self });
        }
      }, 0);
    });
  }
}
global.FileReader = FileReaderMock;

// Mock File constructor
global.File = class File {
  constructor(parts, filename, options) {
    this.parts = parts;
    this.name = filename;
    this.type = options?.type || '';
    this.size = parts.reduce((acc, part) => acc + (part.length || 0), 0);
    this.mockContent = parts.join('');
  }
};

// Mock Blob
global.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options?.type || '';
    this.size = parts.reduce((acc, part) => acc + (part.length || 0), 0);
  }
};

// Reset mocks before each test
beforeEach(() => {
  // Clear storage spy call history and actual storage data
  Storage.prototype.getItem.mockClear();
  Storage.prototype.setItem.mockClear();
  Storage.prototype.removeItem.mockClear();
  Storage.prototype.clear.mockClear();
  localStorage.clear();
  sessionStorage.clear();
  // Re-clear after actual clear() to reset the spy call counts
  Storage.prototype.clear.mockClear();

  global.alert.mockClear();
  global.console.error.mockClear();
  global.console.warn.mockClear();

  // Clear document body
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
});
