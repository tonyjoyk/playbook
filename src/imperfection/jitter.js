// The "imperfection engine": turns clean geometry into hand-drawn, wobbly forms.
import { createNoise2D } from "simplex-noise";
import { mulberry32, hashSeed } from "../core/rng.js";

// A deterministic 2D noise field derived from the master seed + a label.
export function makeNoise(seed, label = "field") {
  return createNoise2D(mulberry32(hashSeed(seed, label)));
}

// Perturb a list of [x,y] points along a noise field for organic edges.
export function jitterPoints(points, noise, { amp = 4, freq = 0.04, phase = 0 } = {}) {
  return points.map(([x, y], i) => {
    const nx = noise(x * freq + phase, y * freq);
    const ny = noise(x * freq + 100 + phase, y * freq + 100);
    return [x + nx * amp, y + ny * amp];
  });
}

// Build an organic blob: an ellipse-ish ring of points with per-point radius wobble.
export function blobPoints(cx, cy, rx, ry, {
  count = 14, noise, amp = 0.18, freq = 1.4, phase = 0, squash = 0,
} = {}) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const wob = noise ? noise(Math.cos(a) * freq + phase, Math.sin(a) * freq) : 0;
    const r = 1 + wob * amp;
    let px = Math.cos(a) * rx * r;
    let py = Math.sin(a) * ry * r;
    if (squash) py += Math.abs(px) * squash; // optional asymmetric droop
    pts.push([cx + px, cy + py]);
  }
  return pts;
}

// A leaf/teardrop outline (used for foliage, plates, lily pads).
export function leafPoints(length, width, { noise, amp = 0.12, phase = 0, count = 16 } = {}) {
  const pts = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;          // 0..1 along the leaf
    const y = -t * length;        // grows upward
    const w = Math.sin(t * Math.PI) * (width / 2);
    const wob = noise ? noise(t * 3 + phase, 0) * amp : 0;
    pts.push([w * (1 + wob), y]);
  }
  for (let i = count; i >= 0; i--) {
    const t = i / count;
    const y = -t * length;
    const w = Math.sin(t * Math.PI) * (width / 2);
    const wob = noise ? noise(t * 3 + phase + 50, 0) * amp : 0;
    pts.push([-w * (1 + wob), y]);
  }
  return pts;
}
