import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@vscode/test-cli';

// VS Code puts its IPC socket in the user data folder. Unix sockets are
// limited to about 103 characters, which the default folder inside a deep
// checkout (such as the macOS runner's) exceeds, so use a short temp folder.
const userDataDir = mkdtempSync(join(tmpdir(), 'vsct-'));

export default defineConfig({
  files: 'out/test/integration/**/*.test.js',
  version: '1.143.0',
  launchArgs: ['--disable-extensions', '--user-data-dir', userDataDir],
  mocha: { ui: 'bdd', timeout: 20000 },
});
