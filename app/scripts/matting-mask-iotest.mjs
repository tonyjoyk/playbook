/**
 * Matting mask IoU gate — bedroom ≥0.75, subway ≥0.70 (IMG.LY ISNet).
 * Run: node scripts/matting-mask-iotest.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import {
  countMaskComponents,
  maskFromAlphaPng,
  maskIoU,
  mattingMaskAtClick,
} from './matting-gate-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = join(root, 'fixtures');
const manifest = JSON.parse(readFileSync(join(fixturesDir, 'manifest.json'), 'utf8'));

function loadPng(name) {
  return PNG.sync.read(readFileSync(join(fixturesDir, name)));
}

async function runCase(label, cfg) {
  const png = loadPng(cfg.fixture);
  const pixels = new Uint8ClampedArray(png.data);
  const region = { x: 0, y: 0, w: png.width, h: png.height };
  const mask = await mattingMaskAtClick(
    pixels,
    png.width,
    png.height,
    cfg.click.x,
    cfg.click.y,
    region,
    512,
    cfg.negative ?? []
  );
  if (!mask) {
    console.error(`FAIL: ${label} — no mask at click`);
    process.exit(1);
  }

  const refPath = join(fixturesDir, cfg.mask);
  if (!existsSync(refPath)) {
    const refPng = new PNG({ width: png.width, height: png.height });
    for (let i = 0; i < mask.length; i++) {
      const v = mask[i] > 0 ? 255 : 0;
      const pi = i * 4;
      refPng.data[pi] = v;
      refPng.data[pi + 1] = v;
      refPng.data[pi + 2] = v;
      refPng.data[pi + 3] = v > 0 ? 255 : 0;
    }
    writeFileSync(refPath, PNG.sync.write(refPng));
    console.log(`Wrote reference mask ${cfg.mask}`);
  }

  const ref = loadPng(cfg.mask);
  const refMask = maskFromAlphaPng(ref);
  const iou = maskIoU(mask, refMask);
  const components = countMaskComponents(mask, png.width, png.height);

  if (iou < cfg.iouMin) {
    console.error(`FAIL: ${label} matting IoU ${iou.toFixed(3)} < ${cfg.iouMin}`);
    process.exit(1);
  }
  if (cfg.maxComponents != null && components > cfg.maxComponents) {
    console.error(`FAIL: ${label} components ${components} > ${cfg.maxComponents}`);
    process.exit(1);
  }
  console.log(`OK: ${label} matting IoU ${iou.toFixed(3)} (min ${cfg.iouMin})`);
}

await runCase('bedroom-crop (T2)', manifest.bedroom);
await runCase('subway-crop (T3)', manifest.subway);
