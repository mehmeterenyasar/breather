import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // The trailing-slash form tells ESLint not to walk the tree at all. With
  // '/**' it descends and filters file by file, which crawls under .output.
  { ignores: ['.output/', '.wxt/', 'coverage/', 'node_modules/', 'public/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    // Keep src/core pure: no browser APIs, and no reading the clock.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'chrome', message: 'src/core must stay pure: no browser APIs.' },
        { name: 'browser', message: 'src/core must stay pure: no browser APIs.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'No Date.now() in src/core: pass `now` in as an argument.',
        },
      ],
    },
  },
  {
    // The build scripts run under Node.
    files: ['**/*.mjs', 'scripts/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['tests/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
