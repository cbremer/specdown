// Distribution channel of the running build.
//
// The same desktop/ code ships through two channels:
//   - 'direct' — the Developer ID-signed DMG/ZIP from GitHub Releases
//     (appId com.specdown.desktop), which updates itself via electron-updater.
//   - 'mas'    — the Mac App Store build (appId com.mosaicpando.specdown),
//     packaged on Electron's MAS runtime, where `process.mas === true`.
//
// The App Store delivers MAS updates, and App Review Guideline 2.4.5 forbids
// apps from updating themselves, so the MAS build must never load
// electron-updater, poll GitHub, or show update UI. Keeping the decision here
// (one pure function, keyed off the runtime flag electron-builder can't get
// wrong) means the direct channel's behavior is untouched.

/** @param {{ mas?: boolean }} [proc] @returns {'mas' | 'direct'} */
function getDistributionChannel(proc = process) {
  return proc && proc.mas === true ? 'mas' : 'direct';
}

/** Whether this channel may self-update (download + install). */
function channelAllowsSelfUpdate(channel) {
  return channel === 'direct';
}

module.exports = { getDistributionChannel, channelAllowsSelfUpdate };
