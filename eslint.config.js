// ESLint flat config (Phase 0 — Foundation & hygiene).
//
// Intentionally pragmatic: the shared `markdown-viewer/app.js` is still a
// single ~2,800-line browser global-scope file (Phase 1 will split it into ES
// modules). Until then we declare the browser + vendored-library globals it
// relies on and keep the rule set focused on real correctness signals so the
// CI lane is honest rather than drowning in stylistic noise that Prettier
// already owns.

const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
  {
    ignores: [
      'markdown-viewer/vendor/**',
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'ios/**',
    ],
  },

  // Shared browser viewer core.
  {
    files: ['markdown-viewer/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Vendored libraries exposed as browser globals.
        marked: 'readonly',
        mermaid: 'readonly',
        hljs: 'readonly',
        Panzoom: 'readonly',
        panzoom: 'readonly',
        DOMPurify: 'readonly',
        // Native bridges injected by the desktop/iOS shells.
        webkit: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['warn', 'smart'],
    },
  },

  // Electron main + preload (Node + Electron runtime).
  {
    files: ['desktop/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // Tooling / config files.
  {
    files: ['*.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
    },
  },

  // Jest test suite. Tests eval the shared viewer into the jsdom global scope
  // (via tests/helpers/loadApp.js) and reference its functions directly, so
  // `no-undef` is not a useful signal here until Phase 1 modularizes the app.
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest, ...globals.browser },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off',
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
    },
  },

  // Disable stylistic rules that Prettier governs.
  prettier,
];
