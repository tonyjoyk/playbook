/**
 * Download IMG.LY matting assets to public/models/imgly/ for self-hosting.
 * Run: node scripts/setup-imgly-models.mjs
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const IMGLY_CDN = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/models/imgly');

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

mkdirSync(outDir, { recursive: true });
const resources = JSON.parse(
  (await fetchBuffer(`${IMGLY_CDN}resources.json`)).toString('utf8')
);
writeFileSync(join(outDir, 'resources.json'), JSON.stringify(resources, null, 2));

for (const [key, meta] of Object.entries(resources)) {
  const safeName = key.replace(/^\//, '').replace(/\//g, '_');
  const chunks = meta.chunks ?? [];
  const parts = [];
  for (const chunk of chunks) {
    const url = `${IMGLY_CDN}${chunk.hash}`;
    process.stdout.write(`Fetching ${chunk.hash.slice(0, 12)}…\n`);
    parts.push(await fetchBuffer(url));
  }
  writeFileSync(join(outDir, safeName), Buffer.concat(parts));
}

console.log('IMG.LY models written to', outDir);
