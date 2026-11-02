// @ts-check
// Recovery controls carry opaque main-held IDs, never renderer-selected paths.
import { showToast, dismissToast } from '../features/toast.js';
import {
  bridgeOnFileOpenFailed,
  bridgeOnFileOpenRecoveryResolved,
  bridgeResolveFileOpenFailure,
} from './bridge.js';

/** @type {Map<string, HTMLElement>} */
const desktopRecoveryRows = new Map();

/** @param {{ id: string }} info */
export function resolveOpenRecoveryRow(info) {
  const row = desktopRecoveryRows.get(info?.id);
  if (row) dismissToast(row);
  desktopRecoveryRows.delete(info?.id);
}

/** @param {Parameters<Parameters<typeof bridgeOnFileOpenFailed>[0]>[0]} info */
export function showOpenRecoveryRow(info) {
  if (!info || typeof info.id !== 'string' || typeof info.message !== 'string')
    return;
  resolveOpenRecoveryRow(info);
  const row = showToast('', {
    type: 'warning',
    duration: 0,
    dismissOnClick: false,
  });
  row.classList.add('native-file-recovery');
  desktopRecoveryRows.set(info.id, row);
  const message = document.createElement('span');
  message.textContent = `“${info.filename}”: ${info.message}`;
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  const actions = document.createElement('div');
  actions.className = 'native-file-recovery-actions';
  /** @param {'locate' | 'forget' | 'dismiss'} action @param {string} label */
  const addAction = (action, label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = label;
    button.addEventListener('click', async () => {
      if (
        !row.isConnected ||
        desktopRecoveryRows.get(info.id) !== row ||
        button.disabled
      )
        return;
      button.disabled = true;
      status.textContent = '';
      try {
        const accepted = await bridgeResolveFileOpenFailure({
          id: info.id,
          action,
        });
        if (!row.isConnected || desktopRecoveryRows.get(info.id) !== row)
          return;
        if (accepted && action !== 'locate') resolveOpenRecoveryRow(info);
        else if (!accepted && action !== 'locate') {
          status.textContent =
            'This action could not be saved. The saved file entry is unchanged.';
        }
        // Locate cancellation leaves the original entry and its controls available.
        // Successful admission is separately acknowledged by the native process.
      } catch {
        if (row.isConnected)
          status.textContent =
            'Please try again. The saved file entry is unchanged.';
      } finally {
        button.disabled = false;
      }
    });
    actions.appendChild(button);
  };
  addAction('locate', 'Locate…');
  if (info.canForget) {
    addAction('forget', 'Stop reopening');
    const explanation = document.createElement('small');
    explanation.textContent =
      'Stop reopening removes only this saved startup entry. Your file and notes are kept.';
    row.appendChild(explanation);
  }
  addAction('dismiss', 'Dismiss');
  row.prepend(message);
  row.append(actions, status);
}

export function setupOpenRecovery() {
  bridgeOnFileOpenFailed(showOpenRecoveryRow);
  bridgeOnFileOpenRecoveryResolved(resolveOpenRecoveryRow);
}
