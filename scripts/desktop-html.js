#!/usr/bin/env node

/**
 * Launch Electron with VITE_HTML_DOCUMENTS=true so main
 * (`htmlDocumentsEnabledMain`) and the HTML-on renderer cannot disagree.
 * Electron main is not Vite-bundled. A Node wrapper is used instead of
 * POSIX `VAR=value cmd` so `npm run desktop:html` works on Windows shells.
 */

'use strict';

const { spawn } = require('child_process');

process.env.VITE_HTML_DOCUMENTS = 'true';

const electronBin = require('electron');
const child = spawn(electronBin, ['.'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code == null ? 1 : code);
});
