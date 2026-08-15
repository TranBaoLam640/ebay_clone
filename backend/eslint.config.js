import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['coverage/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2023 },
    },
    rules: { 'no-console': ['error', { allow: ['error'] }] },
  },
  { files: ['tests/**/*.js'], languageOptions: { globals: globals.node } },
];
