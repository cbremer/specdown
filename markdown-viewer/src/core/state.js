// Shared mutable app state.
//
// Modules import this object and read/mutate its fields. ESM forbids
// reassigning an imported binding, but mutating a property of an imported
// object is fine — so shared state lives here as object fields rather than
// bare module-level `let`s. This object grows as the entry module is split
// into feature modules that need to share state.

export const state = {
  // Table of contents
  tocVisible: false,
  tocEntries: [],
  tocScrollSpyScheduled: false,
};
