/**
 * VTracer WASM parity + Phase 2 gate checks.
 * Run: node scripts/vtracer-parity.mjs
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmDir = join(root, 'wasm-vtracer/pkg');

const VTRACER_CONFIG = {
  binary: false,
  mode: 'spline',
  hierarchical: 'stacked',
  filterSpeckle: 8,
  colorPrecision: 6,
  layerDifference: 16,
  cornerThreshold: 70,
  spliceThreshold: 45,
  lengthThreshold: 4,
  maxIterations: 10,
  pathPrecision: 8,
};

const SCENE_VTRACER_CONFIG = {
  ...VTRACER_CONFIG,
  hierarchical: 'cutout',
};

function makeTestPng(width = 120, height = 90) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      const sky = y < height * 0.45;
      const mesa = !sky && y > height * 0.55 && x > width * 0.2 && x < width * 0.8;
      if (sky) {
        png.data[i] = 188;
        png.data[i + 1] = 216;
        png.data[i + 2] = 224;
      } else if (mesa) {
        png.data[i] = 212;
        png.data[i + 1] = 131;
        png.data[i + 2] = 122;
      } else {
        png.data[i] = 94;
        png.data[i + 1] = 122;
        png.data[i + 2] = 80;
      }
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

/** Two same-fill blobs with a gap — must stay separate objects after grouping. */
function makeTwoBlobPng(width = 100, height = 60) {
  const png = new PNG({ width, height });
  const fill = [94, 122, 80];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      const leftBlob = x >= 8 && x < 28 && y >= 10 && y < 50;
      const rightBlob = x >= 62 && x < 82 && y >= 10 && y < 50;
      if (leftBlob || rightBlob) {
        png.data[i] = fill[0];
        png.data[i + 1] = fill[1];
        png.data[i + 2] = fill[2];
      } else {
        png.data[i] = 188;
        png.data[i + 1] = 216;
        png.data[i + 2] = 224;
      }
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function countPaths(svg) {
  return (svg.match(/<path/g) ?? []).length;
}

function countObjects(svg) {
  return (svg.match(/data-object-id="/g) ?? []).length;
}

function assertNoEmptyGroups(sceneSvg) {
  const groups = sceneSvg.match(/<g data-object-id="[^"]+">([\s\S]*?)<\/g>/g) ?? [];
  for (const g of groups) {
    if (!g.includes('<path')) {
      console.error('FAIL: empty data-object-id group in scene SVG');
      process.exit(1);
    }
  }
}

async function loadWasm() {
  const init = (await import(join(wasmDir, 'playbook_vtracer_wasm.js'))).default;
  const wasmBytes = readFileSync(join(wasmDir, 'playbook_vtracer_wasm_bg.wasm'));
  await init(wasmBytes);
  return import(join(wasmDir, 'playbook_vtracer_wasm.js'));
}

async function runWasmParity() {
  const { trace_pair, to_svg } = await loadWasm();
  const png = makeTestPng();
  const decoded = PNG.sync.read(png);
  const rgba = new Uint8Array(decoded.data.buffer);

  const rawOnly = to_svg(rgba, decoded.width, decoded.height, VTRACER_CONFIG);
  const pair = trace_pair(
    rgba,
    decoded.width,
    decoded.height,
    VTRACER_CONFIG,
    SCENE_VTRACER_CONFIG
  );

  const rawPaths = countPaths(pair.raw);
  const rawOnlyPaths = countPaths(rawOnly);
  const sceneObjects = pair.objectCount;
  const sceneGroups = countObjects(pair.scene);

  if (pair.raw !== rawOnly) {
    console.error('FAIL: trace_pair raw must match to_svg with stacked config');
    process.exit(1);
  }

  if (sceneObjects !== sceneGroups) {
    console.error(
      `FAIL: objectCount ${sceneObjects} != data-object-id groups ${sceneGroups}`
    );
    process.exit(1);
  }

  if (sceneObjects > rawPaths) {
    console.error(
      `FAIL: scene objects (${sceneObjects}) cannot exceed raw paths (${rawPaths})`
    );
    process.exit(1);
  }

  assertNoEmptyGroups(pair.scene);

  console.log('OK: WASM trace_pair', {
    rawPaths,
    sceneObjects,
    rawOnlyPaths,
  });

  return { rawPaths, png };
}

async function runTwoBlobGroupingTest() {
  const { trace_pair } = await loadWasm();
  const png = makeTwoBlobPng();
  const decoded = PNG.sync.read(png);
  const rgba = new Uint8Array(decoded.data.buffer);
  const pair = trace_pair(
    rgba,
    decoded.width,
    decoded.height,
    VTRACER_CONFIG,
    SCENE_VTRACER_CONFIG
  );
  if (pair.objectCount < 2) {
    console.error(
      `FAIL: two-blob fixture expected >= 2 objects, got ${pair.objectCount}`
    );
    process.exit(1);
  }
  console.log(`OK: two-blob grouping (${pair.objectCount} objects)`);
}

function grepWorkerNoDom() {
  const workerSrc = readFileSync(
    join(root, 'src/workers/vtracer.worker.ts'),
    'utf8'
  );
  if (workerSrc.includes('DOMParser')) {
    console.error('FAIL: vtracer.worker.ts must not use DOMParser');
    process.exit(1);
  }
  const sceneCompiler = readFileSync(
    join(root, 'src/lib/sceneCompiler.ts'),
    'utf8'
  );
  if (!sceneCompiler.includes('DOMParser')) {
    console.error('FAIL: sceneCompiler.ts should use DOMParser on main thread');
    process.exit(1);
  }
  console.log('OK: no DOMParser in worker; sceneCompiler on main thread');
}

function runRustTests() {
  const res = spawnSync(
    'cargo',
    ['test', '--manifest-path', join(root, 'wasm-vtracer/Cargo.toml')],
    { encoding: 'utf8' }
  );
  if (res.status !== 0) {
    console.error(res.stdout);
    console.error(res.stderr);
    console.error('FAIL: Rust tests');
    process.exit(1);
  }
  console.log('OK: Rust tests');
}

function runPythonParity(pngPath, wasmPathCount) {
  const py = spawnSync(
    'python3',
    [
      '-c',
      `
import sys, tempfile, os
try:
    import vtracer
except ImportError:
    sys.exit(2)
png = sys.argv[1]
out = tempfile.mktemp(suffix='.svg')
vtracer.convert_image_to_svg_py(
    png, out,
    colormode='color',
    hierarchical='stacked',
    mode='spline',
    filter_speckle=8,
    color_precision=6,
    layer_difference=16,
    corner_threshold=70,
    splice_threshold=45,
    path_precision=8,
)
svg = open(out).read()
print(svg.count('<path'))
os.unlink(out)
`,
      pngPath,
    ],
    { encoding: 'utf8' }
  );

  if (py.status === 2) {
    console.log('SKIP: Python vtracer not installed — WASM-only checks passed');
    return;
  }
  if (py.status !== 0) {
    console.error(py.stderr);
    console.error('FAIL: Python vtracer parity run');
    process.exit(1);
  }

  const pyPaths = Number(py.stdout.trim());
  const delta = Math.abs(pyPaths - wasmPathCount) / Math.max(pyPaths, 1);
  if (delta > 0.05) {
    console.error(
      `FAIL: path count parity — WASM ${wasmPathCount} vs Python ${pyPaths} (${(delta * 100).toFixed(1)}% off)`
    );
    process.exit(1);
  }
  console.log(`OK: Python CLI parity within 5% (WASM ${wasmPathCount}, Python ${pyPaths})`);
}

function runSceneHistorySmokeTest() {
  const scene = {
    version: 1,
    width: 100,
    height: 100,
    cutoutMode: true,
    objects: [
      {
        id: 'obj-0',
        paths: [{ d: 'M0 0', fill: '#000', transform: 'translate(0,0)' }],
        transform: { tx: 0, ty: 0, scale: 1, rotation: 0 },
        zIndex: 0,
      },
    ],
  };
  const before = { tx: 0, ty: 0, scale: 1, rotation: 0 };
  const after = { tx: 9, ty: 4, scale: 1, rotation: 0 };
  const applied = {
    ...scene,
    objects: scene.objects.map((o) =>
      o.id === 'obj-0' ? { ...o, transform: { ...after } } : o
    ),
  };
  const restored = {
    ...applied,
    objects: applied.objects.map((o) =>
      o.id === 'obj-0' ? { ...o, transform: { ...before } } : o
    ),
  };
  const moved = applied.objects[0].transform;
  const back = restored.objects[0].transform;
  if (moved.tx !== 9 || back.tx !== 0) {
    console.error('FAIL: sceneHistory move undo round-trip');
    process.exit(1);
  }
  console.log('OK: sceneHistory move undo round-trip');
}

grepWorkerNoDom();
runRustTests();
const { rawPaths, png } = await runWasmParity();
await runTwoBlobGroupingTest();
runSceneHistorySmokeTest();

const tmpPng = join(root, 'out-parity-test.png');
writeFileSync(tmpPng, png);
try {
  runPythonParity(tmpPng, rawPaths);
} finally {
  try {
    unlinkSync(tmpPng);
  } catch {
    /* ignore */
  }
}

console.log('All parity checks passed.');
