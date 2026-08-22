// @ts-check
// Named empty-state looks (the Theme picker — not light/dark/auto).
// To add a future theme:
//   1. Append `{ id, label, icon }` here
//   2. Add a `[data-visual-theme="<id>"]` block in styles.css
// The header dropdown, iOS sheet, and desktop Appearance → Theme menu all
// read this list (desktop via `visual-theme-catalog` IPC when the renderer
// starts).
//
// Unique names: the test harness evals modules at global scope.

/**
 * @typedef {{ id: string, label: string, icon: string }} VisualThemeSpec
 */

/** @type {ReadonlyArray<VisualThemeSpec>} */
export const visualThemeCatalog = [
  { id: 'default', label: 'Default', icon: 'auto' },
  { id: 'starfield', label: 'Starfield', icon: 'sparkles' },
  { id: 'aurora', label: 'Aurora', icon: 'waves' },
  { id: 'blueprint', label: 'Blueprint', icon: 'grid' },
];

/** @param {string | null | undefined} id */
export function visualThemeIsKnown(id) {
  return !!id && visualThemeCatalog.some((theme) => theme.id === id);
}

/** @param {string | null | undefined} id */
export function visualThemeLabel(id) {
  const theme = visualThemeCatalog.find((entry) => entry.id === id);
  return theme ? theme.label : 'Default';
}
