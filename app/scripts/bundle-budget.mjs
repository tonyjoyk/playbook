/**
 * Fail if matting-related build assets exceed gzip budget (25 MB).
 * Run: node scripts/bundle-budget.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist/assets');
const BUDGET_BYTES = 25 * 1024 * 1024;

function gzipSize(buf) {
  return gzipSync(buf).length;
}

let total = 0;
const matches = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      walk(path);
      continue;
    }
    if (!/ort|matting|background-removal|\.wasm$/i.test(name)) continue;
    const gz = gzipSize(readFileSync(path));
    total += gz;
    matches.push({ name, gz });
  }
}

if (statSync(distDir).isDirectory()) walk(distDir);

if (total > BUDGET_BYTES) {
  console.error(`FAIL: matting bundle gzip ${(total / 1024 / 1024).toFixed(1)} MB > 25 MB`);
  for (const m of matches) console.error(`  ${m.name}: ${(m.gz / 1024 / 1024).toFixed(2)} MB`);
  process.exit(1);
}

console.log(`OK: matting bundle gzip ${(total / 1024 / 1024).toFixed(2)} MB (budget 25 MB)`);
