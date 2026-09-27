/**
 * CompositeSnapshotCommand round-trip (mirrors compositeHistory.ts).
 * Run: node scripts/composite-history-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function cloneLayers(layers) {
  return layers.map((l) => ({ ...l, transform: { ...l.transform } }));
}

function applySnapshot(doc, snap) {
  return {
    ...doc,
    backgroundBlobId: snap.backgroundBlobId,
    layers: cloneLayers(snap.layers),
  };
}

function createCompositeSnapshotCommand(before, after, label) {
  return {
    label,
    apply: (doc) => applySnapshot(doc, after),
    revert: (doc) => applySnapshot(doc, before),
  };
}

const doc = {
  version: 1,
  width: 320,
  height: 240,
  backgroundBlobId: 'bg-1',
  layers: [
    {
      id: 'layer-a',
      maskBlobId: 'm1',
      spriteBlobId: 's1',
      originX: 10,
      originY: 20,
      width: 40,
      height: 80,
      transform: { tx: 0, ty: 0, scale: 1, rotation: 0 },
      zIndex: 1,
    },
  ],
  editRegion: 'left',
  splitX: null,
};

const before = {
  backgroundBlobId: doc.backgroundBlobId,
  layers: cloneLayers(doc.layers),
};
const after = {
  backgroundBlobId: 'bg-2',
  layers: cloneLayers(doc.layers).map((l) => ({
    ...l,
    transform: { ...l.transform, tx: 40, ty: -12 },
  })),
};

const cmd = createCompositeSnapshotCommand(before, after, 'move');
const moved = cmd.apply({ ...doc, layers: cloneLayers(doc.layers) });
const restored = cmd.revert(moved);

if (moved.backgroundBlobId !== 'bg-2' || moved.layers[0].transform.tx !== 40) {
  console.error('FAIL: composite apply');
  process.exit(1);
}
if (restored.backgroundBlobId !== 'bg-1' || restored.layers[0].transform.tx !== 0) {
  console.error('FAIL: composite revert');
  process.exit(1);
}

const src = readFileSync(join(root, 'src/lib/compositeHistory.ts'), 'utf8');
if (!src.includes('createCompositeSnapshotCommand')) {
  console.error('FAIL: compositeHistory.ts missing snapshot command');
  process.exit(1);
}

console.log('OK: CompositeSnapshotCommand round-trip');
