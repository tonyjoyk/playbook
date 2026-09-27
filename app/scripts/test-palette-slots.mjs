/**
 * Smoke test for palette slot mapping (no DOM required).
 * Run: node --experimental-strip-types scripts/test-palette-slots.mjs
 */
import { nearestSlot, normalizeHex } from '../src/lib/paletteSlots.ts';

const sky = nearestSlot('#BCD8E0');
if (sky !== 'sky') {
  console.error(`FAIL: expected sky, got ${sky}`);
  process.exit(1);
}

const short = normalizeHex('#abc');
if (short !== '#aabbcc') {
  console.error(`FAIL: normalizeHex #abc -> ${short}`);
  process.exit(1);
}

console.log('OK: palette slot mapping');
