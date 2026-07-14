// @ts-check
// Drag-and-drop file/folder opening: the drop-zone handlers plus the
// document-level drop that adds tabs while a document is already open.
// Extracted from main.js in the Wave C decomposition.

import { state } from '../core/state.js';
import { handleFile } from './file-loading.js';
import {
  tryOpenDroppedFolder,
  isFolderDragDropSupported,
} from './workspace.js';

const dragDropZoneEl = () => document.getElementById('drop-zone');

/** @param {DragEvent} e */
export function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropZone = dragDropZoneEl();
  if (dropZone) dropZone.classList.add('drag-over');
}

/** @param {DragEvent} e */
export function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropZone = dragDropZoneEl();
  if (
    dropZone &&
    !dropZone.contains(/** @type {Node | null} */ (e.relatedTarget))
  ) {
    dropZone.classList.remove('drag-over');
  }
}

/** @param {DragEvent} e */
export function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropZone = dragDropZoneEl();
  if (dropZone) dropZone.classList.remove('drag-over');

  if (!e.dataTransfer) return;
  // Capture files synchronously — the FileList is invalidated after the event.
  const droppedFiles = Array.from(e.dataTransfer.files || []);
  const openDroppedFiles = () => {
    for (const file of droppedFiles) handleFile(file);
  };
  // A dropped folder opens as a workspace (Chromium, async); otherwise — and on
  // browsers without the API — fall back to opening the dropped files directly.
  if (isFolderDragDropSupported()) {
    tryOpenDroppedFolder(e.dataTransfer).then((handled) => {
      if (!handled) openDroppedFiles();
    });
  } else {
    openDroppedFiles();
  }
}

/** Wire the drop-zone drag handlers + the document-level drop-to-new-tab. */
export function setupDragAndDrop() {
  const dropZone = dragDropZoneEl();
  if (dropZone) {
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
  }

  // Prevent default drag behavior on document
  document.addEventListener('dragover', (e) => e.preventDefault());

  // Document-level drop: open files as new tabs when tabs are already open.
  // When the drop zone is visible its handler fires first and calls
  // stopPropagation(), so this listener is only reached for drops on the
  // content area (when the drop zone is hidden).
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!e.dataTransfer) return;
    // Capture files synchronously — the FileList is invalidated after the event.
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    const openDroppedFiles = () => {
      if (state.tabs.length > 0) {
        for (const file of droppedFiles) handleFile(file);
      }
    };
    // Folder drag-and-drop is Chromium-only and async; elsewhere open files
    // directly (keeps the synchronous drop path on other browsers).
    if (isFolderDragDropSupported()) {
      tryOpenDroppedFolder(e.dataTransfer).then((handled) => {
        if (!handled) openDroppedFiles();
      });
    } else {
      openDroppedFiles();
    }
  });
}
