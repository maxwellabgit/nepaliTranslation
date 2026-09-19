const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      '.expo/**',
      'assets/models/**',
      'src/mt/generated/**',
      'scripts/**',
    ],
  },
  {
    rules: {
      'import/no-unresolved': 'off',
      // Pre-existing screen patterns; tighten in a dedicated cleanup slice.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]);
