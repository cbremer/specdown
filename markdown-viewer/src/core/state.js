// @ts-check
// Shared mutable app state.
//
// Modules import this object and read/mutate its fields. ESM forbids
// reassigning an imported binding, but mutating a property of an imported
// object is fine — so shared state lives here as object fields rather than
// bare module-level `let`s. This object grows as the entry module is split
// into feature modules that need to share state.

/**
 * An open file tab.
 * @typedef {object} Tab
 * @property {number} id
 * @property {string} filename
 * @property {string | null} filePath
 * @property {string} rawMarkdown
 * @property {'preview' | 'raw'} viewMode
 * @property {number} scrollTop
 * @property {boolean} watching
 * @property {boolean} hasUnseenChanges
 */

/**
 * A table-of-contents entry derived from a rendered heading.
 * @typedef {object} TocEntry
 * @property {string} id
 * @property {number} level
 * @property {string | null} text
 */

/**
 * @typedef {object} AppState
 * @property {any[]} currentPanzoomInstances Active panzoom instances to clean up.
 * @property {string} currentTheme 'light' or 'dark'.
 * @property {string} currentRawMarkdown Raw source of the active document.
 * @property {'preview' | 'raw'} currentViewMode
 * @property {Tab[]} tabs Open file tabs.
 * @property {number | null} activeTabId
 * @property {number} nextTabId Monotonic id source for new tabs.
 * @property {boolean} tocVisible
 * @property {TocEntry[]} tocEntries
 * @property {boolean} tocScrollSpyScheduled
 * @property {boolean} splitViewActive
 * @property {string} iosLayoutMode
 */

/** @type {AppState} */
export const state = {
  // Render / view
  currentPanzoomInstances: [],
  currentTheme: localStorage.getItem('theme') || 'light',
  currentRawMarkdown: '',
  currentViewMode: 'preview', // 'preview' or 'raw'

  // Tabs (the `tabs` array itself stays in main.js for now — it appears in a
  // user-facing string/comment and is migrated with the tabs extraction)
  tabs: [], // open file tabs: { id, filename, filePath, rawMarkdown, viewMode, scrollTop, watching }
  activeTabId: null,
  nextTabId: 0,

  // Table of contents
  tocVisible: false,
  tocEntries: [],
  tocScrollSpyScheduled: false,

  // Split view / iOS layout
  splitViewActive: false,
  iosLayoutMode: 'phone',
};
