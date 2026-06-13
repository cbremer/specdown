#!/usr/bin/env node

/**
 * Syncs the version from package.json into the viewer entry module
 * (APP_VERSION constant in markdown-viewer/src/main.js).
 *
 * This runs automatically via the npm "version" lifecycle script, so
 * bumping the version is a single command:
 *
 *   npm version 0.0.26
 *   npm version patch
 *   npm version minor
 */

const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const appPath = path.join(__dirname, '..', 'markdown-viewer', 'src', 'main.js');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

let appCode = fs.readFileSync(appPath, 'utf8');

const versionRegex = /^const APP_VERSION = '[^']*';/m;
if (!versionRegex.test(appCode)) {
    console.error('Could not find APP_VERSION constant in ' + appPath);
    process.exit(1);
}

appCode = appCode.replace(versionRegex, "const APP_VERSION = '" + version + "';");

fs.writeFileSync(appPath, appCode, 'utf8');
console.log('Synced version ' + version + ' into src/main.js');

// The README no longer carries a per-build "#### vX.Y.Z (Current)" line — the
// version is a build counter, not a changelog (see README "Version History").
// Nothing to sync there anymore.
