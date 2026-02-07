#!/usr/bin/env node

/**
 * Syncs the version from package.json into app.js (APP_VERSION constant).
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
const appPath = path.join(__dirname, '..', 'markdown-viewer', 'app.js');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

let appCode = fs.readFileSync(appPath, 'utf8');

const versionRegex = /^const APP_VERSION = '[^']*';/m;
if (!versionRegex.test(appCode)) {
    console.error('Could not find APP_VERSION constant in app.js');
    process.exit(1);
}

appCode = appCode.replace(versionRegex, "const APP_VERSION = '" + version + "';");

fs.writeFileSync(appPath, appCode, 'utf8');
console.log('Synced version ' + version + ' into app.js');
