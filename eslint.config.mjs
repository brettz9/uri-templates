import globals from 'globals';
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';

export default [
  {
    ignores: ['*.min.js', 'uri-templates.js'],
  },
  {
    files: ['test/**/*.mjs'],
    languageOptions: {
      globals: globals.mocha,
    },
  },
  js.configs.recommended,
  stylistic.configs['recommended-flat'],
  {
    rules: {
      '@stylistic/semi': ['error', 'always'],
    },
  },
];
