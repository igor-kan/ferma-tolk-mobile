import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-plugin-prettier';
import boundaries from 'eslint-plugin-boundaries';
import importPlugin from 'eslint-plugin-import';

// ─── Base config (all JS files) ──────────────────────────────────────────────
const baseConfig = {
  files: ['**/*.{js,jsx}'],
  languageOptions: {
    ecmaVersion: 2020,
    globals: {
      ...globals.browser,
      ...globals.node,
      ...globals.es2020,
    },
    parserOptions: {
      ecmaVersion: 'latest',
      ecmaFeatures: { jsx: true },
      sourceType: 'module',
    },
  },
  settings: {
    // Pin version explicitly to avoid the contextOrFilename.getFilename() crash
    // in eslint-plugin-react@7 when used with ESLint flat config (v9/v10).
    react: { version: '19' },
    'import/resolver': {
      node: { extensions: ['.js', '.jsx'] },
    },
    'boundaries/elements': [
      { type: 'feature', pattern: 'src/features/*/*', mode: 'folder', capture: ['featureName'] },
      { type: 'shared', pattern: 'src/shared/*' },
      { type: 'lib', pattern: 'src/lib/*' },
      { type: 'app', pattern: 'src/App.jsx' },
      { type: 'main', pattern: 'src/main.jsx' },
    ],
  },
  plugins: {
    prettier,
    boundaries,
    import: importPlugin,
  },
  rules: {
    ...js.configs.recommended.rules,
    'prettier/prettier': 'error',
    'no-unused-vars': [
      'error',
      {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // Import hygiene
    'import/no-duplicates': 'error',

    // Architecture boundaries: features may only import from shared, lib,
    // or their own sibling files; never cross-feature imports.
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          {
            from: 'feature',
            allow: ['shared', 'lib', ['feature', { featureName: '${from.featureName}' }]],
          },
          { from: 'app', allow: ['feature', 'shared', 'lib'] },
          { from: 'shared', allow: ['shared', 'lib'] },
          { from: 'lib', allow: ['lib'] },
          { from: 'main', allow: ['app', 'shared', 'lib', 'feature'] },
        ],
      },
    ],
  },
};

// ─── React rules (JSX files only) ────────────────────────────────────────────
// Scoped separately so React plugin rules never run on api/ or src/lib/ files,
// which avoids the eslint-plugin-react@7 flat-config compatibility crash.
const reactConfig = {
  files: ['src/**/*.{js,jsx}'],
  plugins: {
    react,
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
  },
  rules: {
    ...(react.configs?.recommended?.rules ?? {}),
    ...(react.configs?.['jsx-runtime']?.rules ?? {}),
    ...(reactHooks.configs?.recommended?.rules ?? {}),
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'react/prop-types': 'off',
  },
};

// ─── API / server files ───────────────────────────────────────────────────────
const apiConfig = {
  files: ['api/**/*.js'],
  rules: {
    // Server-side code should use structured logging; allow only warn/error.
    // _security-log.js and _auth-session.js use console[level] dynamically,
    // so we permit warn and error here (same as the global rule).
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
};

// ─── Test and script files ────────────────────────────────────────────────────
// Tests may deliberately capture or mock console methods.
// CLI scripts (scripts/) are utilities that naturally write to stdout/stderr.
const testConfig = {
  files: ['**/*.test.js', 'e2e/**/*.js', 'scripts/**/*.js'],
  rules: {
    'no-console': 'off',
  },
};

export default [
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results'] },
  baseConfig,
  reactConfig,
  apiConfig,
  testConfig,
];
