/**
 * Raster matting automated gates.
 * Run: node scripts/raster-gates.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(label, script) {
  const res = spawnSync('node', [join(root, 'scripts', script)], {
    encoding: 'utf8',
    cwd: root,
    env: process.env,
  });
  if (res.status !== 0) {
    console.error(res.stdout);
    console.error(res.stderr);
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  process.stdout.write(res.stdout);
}

run('generate fixtures', 'generate-fixtures.mjs');
run('matting mask IoU', 'matting-mask-iotest.mjs');
run('inpaint smoke', 'inpaint-smoke.mjs');
run('composite history', 'composite-history-smoke.mjs');
run('diptych region', 'diptych-region-smoke.mjs');
run('export hash', 'export-hash-smoke.mjs');

import { existsSync } from 'node:fs';
if (existsSync(join(root, 'dist/assets'))) {
  run('bundle budget', 'bundle-budget.mjs');
}

console.log('All raster gates passed.');
