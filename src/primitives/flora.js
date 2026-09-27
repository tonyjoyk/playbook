// Jungle flora: palms, ferns, broad leaves, bushes, flowers, lily pads, lotus.
import { path, group, ellipse, circle, smoothClosedPath, smoothOpenPath } from "../core/svg.js";
import { ribbon } from "../core/geom.js";
import { blobPoints, leafPoints, jitterPoints } from "../imperfection/jitter.js";
import { summer, tone } from "../palettes/summer.js";

// A single frond/leaf blade, drawn upward then rotated/placed by caller.
function blade(length, width, color, { noise, phase = 0, vein = false, palette = summer }) {
  const pts = leafPoints(length, width, { noise, amp: 0.14, phase, count: 14 });
  const els = [path(smoothClosedPath(pts, 0.9), color)];
  if (vein) {
    els.push(path(smoothOpenPath([[0, 0], [0, -length]]), "none", {
      stroke: tone(color, -0.18), strokeWidth: Math.max(1, width * 0.05), opacity: 0.5,
    }));
  }
  return group(els);
}

export function palm({ x, y, scale = 1, bend = 0, rng, noise, palette = summer }) {
  const h = rng.float(150, 210);
  const fronds = rng.int(7, 11);
  const trunkCl = [
    [0, 0], [bend * 0.3, -h * 0.35], [bend * 0.7, -h * 0.7], [bend, -h],
  ];
  const trunk = path(
    smoothClosedPath(ribbon(trunkCl, [12 * scale, 9 * scale, 7 * scale, 6 * scale])),
    palette.trunk
  );
  const trunkShade = path(
    smoothOpenPath(trunkCl),
    "none", { stroke: palette.trunkShade, strokeWidth: 3 * scale, opacity: 0.4 }
  );
  const top = [bend, -h];
  const crown = [];
  for (let i = 0; i < fronds; i++) {
    const ang = -150 + (i / (fronds - 1)) * 120 + rng.float(-8, 8);
    const len = rng.float(70, 105);
    const col = rng.pick([palette.greenMid, palette.greenDeep, palette.greenOlive, palette.greenTeal]);
    crown.push(group(
      blade(len, len * 0.26, col, { noise, phase: i * 7, palette }),
      { translate: top, rotate: ang + 90, scale: [1, 1] }
    ));
  }
  return group([trunk, trunkShade, ...crown], { translate: [x, y], scale: [scale, scale], filter: "wobble" });
}

export function fern({ x, y, scale = 1, rng, noise, palette = summer }) {
  const blades = rng.int(7, 11);
  const spread = rng.float(95, 135);
  const els = [];
  for (let i = 0; i < blades; i++) {
    const ang = -90 - spread / 2 + (i / (blades - 1)) * spread;
    const len = rng.float(55, 95) * (1 - Math.abs(i / (blades - 1) - 0.5) * 0.4);
    const col = rng.pick([palette.greenMid, palette.greenDeep, palette.greenSage, palette.greenOlive, palette.greenTeal]);
    els.push(group(blade(len, len * 0.16, col, { noise, phase: i * 5, vein: true, palette }),
      { rotate: ang + 90 }));
  }
  return group(els, { translate: [x, y], scale: [scale, scale], filter: "wobbleFine" });
}

export function broadLeaf({ x, y, scale = 1, rotate = 0, color, rng, noise, palette = summer }) {
  const len = rng ? rng.float(90, 150) : 120;
  color = color || (rng ? rng.pick([palette.greenMid, palette.greenDeep, palette.greenSage, palette.greenTeal]) : palette.greenMid);
  const pts = leafPoints(len, len * 0.5, { noise, amp: 0.1, phase: x + y, count: 16 });
  const vein = path(smoothOpenPath([[0, 0], [0, -len]]), "none", {
    stroke: tone(color, -0.2), strokeWidth: 2, opacity: 0.5,
  });
  return group([path(smoothClosedPath(pts, 0.95), color), vein],
    { translate: [x, y], rotate, scale: [scale, scale], filter: "wobble" });
}

export function bush({ x, y, w = 90, h = 60, rng, noise, palette = summer }) {
  const lobes = rng.int(4, 6);
  const els = [];
  for (let i = 0; i < lobes; i++) {
    const dx = (i / (lobes - 1) - 0.5) * w;
    const dy = -Math.sin((i / (lobes - 1)) * Math.PI) * h * 0.5;
    const col = rng.pick([palette.greenMid, palette.greenDeep, palette.greenOlive, palette.greenDark, palette.greenTeal]);
    els.push(path(
      smoothClosedPath(blobPoints(dx, dy, w * 0.32, h * 0.55, { noise, amp: 0.2, freq: 1.5, phase: i * 6, count: 12 })),
      col, { opacity: 0.96 }
    ));
  }
  return group(els, { translate: [x, y], filter: "wobble" });
}

export function flower({ x, y, scale = 1, color, center, petals = 6, rng, noise, palette = summer }) {
  color = color || palette.flower;
  center = center || palette.flowerCoral;
  const els = [];
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const px = Math.cos(a) * 11, py = Math.sin(a) * 11;
    els.push(group(blade(20, 13, color, { noise, phase: i * 9, palette }),
      { translate: [px, py], rotate: (a * 180) / Math.PI + 90 }));
  }
  els.push(circle(0, 0, 6, center));
  return group(els, { translate: [x, y], scale: [scale, scale], filter: "wobbleFine" });
}

export function lilyPad({ x, y, scale = 1, noise, palette = summer }) {
  const pts = blobPoints(0, 0, 22, 15, { noise, amp: 0.12, freq: 1.4, count: 12 });
  // notch
  const pad = path(smoothClosedPath(pts, 0.9), palette.greenMid, { opacity: 0.92 });
  const notch = path(smoothClosedPath([[0, 0], [16, -5], [16, 5]], 0.8), palette.pond);
  return group([pad, notch], { translate: [x, y], scale: [scale, scale], filter: "wobbleFine" });
}

export function lotus({ x, y, scale = 1, palette = summer }) {
  return flower({ x, y, scale, color: palette.lotus, center: palette.lotusLight, petals: 7, palette,
    rng: { pick: () => palette.lotus }, noise: null });
}
