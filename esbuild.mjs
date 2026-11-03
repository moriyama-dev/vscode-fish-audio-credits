import * as esbuild from 'esbuild';
import { readdirSync } from 'node:fs';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const tests = process.argv.includes('--tests');

const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  logLevel: 'warning',
};

const testEntries = (dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.test.ts'))
    .map((name) => `${dir}/${name}`);

const configs = tests
  ? [
      { ...shared, entryPoints: testEntries('test/unit'), outdir: 'out/test/unit', sourcemap: true },
      { ...shared, entryPoints: testEntries('test/integration'), outdir: 'out/test/integration', sourcemap: true },
    ]
  : [
      {
        ...shared,
        entryPoints: ['src/extension.ts'],
        outfile: 'dist/extension.js',
        minify: production,
        sourcemap: !production,
      },
    ];

if (watch) {
  for (const config of configs) {
    const context = await esbuild.context(config);
    await context.watch();
  }
} else {
  await Promise.all(configs.map((config) => esbuild.build(config)));
}
