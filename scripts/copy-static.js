#!/usr/bin/env node

/**
 * Post-build copy step.
 *
 * The bundled sample documents in markdown-viewer/samples/ are loaded at
 * runtime by path (the iOS shell reads them from the app bundle), not via an
 * index.html reference, so Vite does not pick them up. Copy them into the build
 * output so the produced dist/ is a complete, self-contained web root that every
 * platform can bundle as-is (dist/index.html + dist/assets + dist/samples).
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'markdown-viewer');
const samplesSrc = path.join(root, 'samples');
const samplesDest = path.join(root, 'dist', 'samples');

if (!fs.existsSync(samplesSrc)) {
  console.warn('No samples/ directory to copy; skipping.');
  process.exit(0);
}

fs.mkdirSync(samplesDest, { recursive: true });
for (const entry of fs.readdirSync(samplesSrc)) {
  fs.copyFileSync(path.join(samplesSrc, entry), path.join(samplesDest, entry));
}

console.log('Copied samples/ into dist/samples/');
