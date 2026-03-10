import * as esbuild from 'esbuild';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = `${__dirname}/dist`;

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [`${__dirname}/index.mjs`],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: `${outDir}/index.mjs`,
  minify: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  minifyWhitespace: true,
  keepNames: false,
  external: ['fs', 'path', 'child_process'],
  sourcemap: false,
});

console.log('Built dist/index.mjs (minified)');
