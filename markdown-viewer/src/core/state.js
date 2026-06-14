// Shared mutable app state.
//
// Modules import this object and read/mutate its fields. ESM forbids
// reassigning an imported binding, but mutating a property of an imported
// object is fine — so shared state lives here as object fields rather than
// bare module-level `let`s. This object grows as the entry module is split
// into feature modules that need to share state.

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
