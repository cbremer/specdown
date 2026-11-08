const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ABOUT_BUNDLE_CHANNELS = Object.freeze({
  'com.mosaicpando.specdown': 'production',
  'com.mosaicpando.specdown.dev': 'development',
  'com.mosaicpando.specdown.beta': 'beta',
});

function readOwnBundleInfo(filename) {
  return JSON.parse(
    execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', filename], {
      encoding: 'utf8',
      timeout: 2000,
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  );
}

// Read only this signed app's own Info.plist. A missing/unreadable bundle keeps
// the existing About fallback rather than guessing from runtime/debug flags.
function nativeAboutArguments(
  app,
  {
    mas = process.mas,
    platform = process.platform,
    readInfo = readOwnBundleInfo,
  } = {}
) {
  if (mas !== true || platform !== 'darwin') return [];
  try {
    const filename = path.join(
      path.dirname(app.getPath('exe')),
      '..',
      'Info.plist'
    );
    const info = readInfo(filename);
    if (!Object.hasOwn(ABOUT_BUNDLE_CHANNELS, info.CFBundleIdentifier))
      return [];
    const args = [];
    const build = info.CFBundleVersion;
    const match =
      typeof build === 'string'
        ? build.match(/^[0-9]{1,9}(?:\.[0-9]{1,9}){0,2}$/)
        : null;
    if (match && match[0] === build) args.push(`--specdown-app-build=${build}`);
    const expected = ABOUT_BUNDLE_CHANNELS[info.CFBundleIdentifier];
    const channel = info.SpecDownChannel === expected ? expected : 'production';
    args.push(`--specdown-app-channel=${channel}`);
    return args;
  } catch {
    return [];
  }
}

module.exports = { nativeAboutArguments };
