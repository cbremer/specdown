#!/usr/bin/env node

/**
 * Syncs the version from package.json into app.js (APP_VERSION constant)
 * and README.md (Version History section).
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
const readmePath = path.join(__dirname, '..', 'README.md');

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

// Update README.md version
let readmeContent = fs.readFileSync(readmePath, 'utf8');

const readmeVersionRegex = /^#### v[0-9]+\.[0-9]+\.[0-9]+ \(Current\)/m;
if (!readmeVersionRegex.test(readmeContent)) {
    console.error('Could not find version in README.md');
    process.exit(1);
}

readmeContent = readmeContent.replace(readmeVersionRegex, '#### v' + version + ' (Current)');

fs.writeFileSync(readmePath, readmeContent, 'utf8');
console.log('Synced version ' + version + ' into README.md');
