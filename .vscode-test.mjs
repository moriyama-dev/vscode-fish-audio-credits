import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/integration/**/*.test.js',
  version: '1.144.0',
  launchArgs: ['--disable-extensions'],
  mocha: { ui: 'bdd', timeout: 20000 },
});
