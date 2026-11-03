// @ts-check
// Immutable accepted-tab source descriptor. Browser selections without a native
// read-issued source token intentionally receive independent ephemeral identity.
import { recoverySource } from '../features/annotation-recovery.js';
const annotationTabSources = new WeakMap();
/** @param {import('./state.js').Tab} tab @returns {string} */
export function annotationSourceForTab(tab) {
  let source = annotationTabSources.get(tab);
  if (!source) {
    const native = tab.sourceMeta?.annotationSource;
    source = native
      ? `native:${JSON.stringify([native.authorityId, native.sourceToken])}`
      : recoverySource({ ...tab.sourceMeta });
    annotationTabSources.set(tab, source);
  }
  return source;
}
