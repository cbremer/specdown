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
import {
  hasDesktopBridge,
  bridgeGetPathForFile,
  bridgeOpenDroppedPath,
} from '../platform/bridge.js';

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

  openDroppedTransfer(e.dataTransfer, () => true);
}

/**
 * Shared drop core: capture the files synchronously (the FileList is
 * invalidated after the event), try the Chromium-only async folder path, and
 * otherwise open the files directly — but only while shouldOpen() still holds
 * (the document-level drop requires an open tab).
 * @param {DataTransfer | null} dataTransfer
 * @param {() => boolean} shouldOpen
 */
function openDroppedTransfer(dataTransfer, shouldOpen) {
  if (!dataTransfer) return;
  const droppedFiles = Array.from(dataTransfer.files || []);

  // Desktop: route drops through the main process by ABSOLUTE PATH, so a
  // dropped file opens as a real file-backed tab (live reload + Reload from
  // disk) and a dropped folder becomes a full desktop workspace (real paths,
  // relative-link navigation). The web fallback below reads content only,
  // which silently loses every disk affordance — that was the bug where
  // drag-and-drop opened documents without the Live chip. Electron v32+
  // removed the legacy File.path, so paths come from the preload's
  // webUtils.getPathForFile; if it yields nothing (e.g. a synthetic File),
  // the whole drop falls through to the web reader.
  if (hasDesktopBridge() && droppedFiles.length > 0) {
    const absPaths = droppedFiles
      .map((file) => bridgeGetPathForFile(file))
      .filter(Boolean);
    if (absPaths.length > 0) {
      if (!shouldOpen()) return;
      for (const absPath of absPaths) bridgeOpenDroppedPath(absPath);
      return;
    }
  }

  const openDroppedFiles = () => {
    if (!shouldOpen()) return;
    for (const file of droppedFiles) handleFile(file);
  };
  // A dropped folder opens as a workspace (Chromium, async); otherwise — and on
  // browsers without the API — fall back to opening the dropped files directly.
  if (isFolderDragDropSupported()) {
    tryOpenDroppedFolder(dataTransfer).then((handled) => {
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
    openDroppedTransfer(e.dataTransfer, () => state.tabs.length > 0);
  });
}
