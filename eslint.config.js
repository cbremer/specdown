// ESLint flat config (modernization roadmap).
//
// Phase 1 moved the shared viewer to a Vite + ES-module build. The viewer
// source under markdown-viewer/src/ is ESM; the libraries it used to read as
// vendored globals (marked, mermaid, …) are now real imports. We keep the rule
// set focused on real correctness signals so the CI lane is honest rather than
// drowning in stylistic noise that Prettier already owns.

const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
  {
    ignores: [
      'markdown-viewer/vendor/**',
      'markdown-viewer/dist/**',
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'ios/**',
    ],
  },

  // Shared browser viewer source (ES modules, bundled by Vite).
  {
    files: ['markdown-viewer/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
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

  // CommonJS tooling / config files (eslint.config.js, scripts/*).
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

  // ESM config files (overrides the CommonJS block above for these paths).
  {
    files: ['vite.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
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
