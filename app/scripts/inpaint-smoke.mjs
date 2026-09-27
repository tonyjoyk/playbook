/**
 * LaMa-class inpaint smoke — SSIM vs golden ≥0.85, hole not white.
 * Run: node scripts/inpaint-smoke.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { inpaintHole, rgbSsim } from './raster-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = join(root, 'fixtures');
const goldenDir = join(fixturesDir, 'golden');
mkdirSync(goldenDir, { recursive: true });

const png = PNG.sync.read(readFileSync(join(fixturesDir, 'bedroom-crop.png')));
const pixels = new Uint8ClampedArray(png.data);
const { width, height } = png;

const holeMask = new Uint8Array(width * height);
for (let y = 100; y < 160; y++) {
  for (let x = 90; x < 150; x++) {
    holeMask[y * width + x] = 255;
  }
}

const filled = inpaintHole(pixels, width, height, holeMask);
const goldenPath = join(goldenDir, 'bedroom-inpaint.png');

if (!existsSync(goldenPath)) {
  const out = new PNG({ width, height });
  out.data.set(filled);
  writeFileSync(goldenPath, PNG.sync.write(out));
  console.log('Wrote golden', goldenPath);
}

const golden = PNG.sync.read(readFileSync(goldenPath));
const ssim = rgbSsim(filled, new Uint8ClampedArray(golden.data));
if (ssim < 0.85) {
  console.error(`FAIL: inpaint SSIM ${ssim.toFixed(3)} < 0.85`);
  process.exit(1);
}

let whiteInHole = 0;
const holeCount = holeMask.reduce((a, v) => a + (v > 0 ? 1 : 0), 0);
for (let i = 0; i < holeMask.length; i++) {
  if (holeMask[i] === 0) continue;
  const pi = i * 4;
  if (filled[pi] > 250 && filled[pi + 1] > 250 && filled[pi + 2] > 250) whiteInHole++;
}
if (whiteInHole > holeCount * 0.01) {
  console.error('FAIL: inpaint left white pixels in hole');
  process.exit(1);
}

console.log(`OK: inpaint SSIM ${ssim.toFixed(3)} (min 0.85), no white hole`);
