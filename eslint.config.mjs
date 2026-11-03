import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'out/', 'release/', '.vscode-test/', 'node_modules/'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': [
        'error',
        // node:test returns promises from describe/it; the runner tracks them itself.
        { allowForKnownSafeCalls: [{ from: 'package', name: ['describe', 'it'], package: 'node:test' }] },
      ],
      eqeqeq: 'error',
      curly: 'error',
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        fetch: 'readonly',
        WebSocket: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
);
