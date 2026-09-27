// The pink volcanic mesa: a broad rounded butte with a smaller secondary peak,
// matte coral fill, a shaded side, a highlight, and a few vertical pigment strokes.
import { path, group, smoothClosedPath } from "../core/svg.js";
import { jitterPoints } from "../imperfection/jitter.js";
import { summer, tone } from "../palettes/summer.js";

// Build the silhouette of a mesa whose base sits at y=baseY, peak height h, half-width w.
function buttePoints(cx, baseY, w, h, { shoulder = 0.62, flat = 0.18 } = {}) {
  // left base -> up the left slope -> rounded top -> down right slope -> right base
  return [
    [cx - w, baseY],
    [cx - w * 0.92, baseY - h * 0.18],
    [cx - w * shoulder, baseY - h * 0.66],
    [cx - w * flat, baseY - h * 0.99],
    [cx + w * flat * 0.7, baseY - h],          // rounded summit
    [cx + w * shoulder, baseY - h * 0.64],
    [cx + w * 0.95, baseY - h * 0.16],
    [cx + w, baseY],
  ];
}

export function mesa({ cx, baseY, w, h, noise, palette = summer }) {
  // main mass
  const main = jitterPoints(buttePoints(cx, baseY, w, h), noise, { amp: 5, freq: 0.02 });
  // secondary smaller peak to the right
  const peak = jitterPoints(
    buttePoints(cx + w * 0.78, baseY, w * 0.42, h * 0.66, { shoulder: 0.55, flat: 0.1 }),
    noise, { amp: 4, freq: 0.03, phase: 9 }
  );

  // shaded right flank (a sliver on the right side of the main mass)
  const shade = jitterPoints([
    [cx + w * flatX(0.05), baseY - h * 0.98],
    [cx + w * 0.62, baseY - h * 0.62],
    [cx + w * 0.95, baseY - h * 0.16],
    [cx + w, baseY],
    [cx + w * 0.5, baseY],
    [cx + w * 0.2, baseY - h * 0.5],
  ], noise, { amp: 4, freq: 0.03, phase: 4 });

  // soft highlight on the left shoulder
  const hi = jitterPoints([
    [cx - w * 0.7, baseY - h * 0.55],
    [cx - w * 0.18, baseY - h * 0.95],
    [cx - w * 0.02, baseY - h * 0.8],
    [cx - w * 0.4, baseY - h * 0.35],
    [cx - w * 0.78, baseY - h * 0.1],
  ], noise, { amp: 3, freq: 0.03, phase: 14 });

  // vertical pigment strokes for a painted, fluted look
  const strokes = [];
  const sN = 5;
  for (let i = 0; i < sN; i++) {
    const t = (i + 1) / (sN + 1);
    const x = cx - w * 0.55 + t * w * 1.05;
    const top = baseY - h * (0.85 - Math.abs(t - 0.5) * 0.7);
    const pts = jitterPoints(
      [[x, top], [x + 2, (top + baseY) / 2], [x, baseY - 4]],
      noise, { amp: 3, freq: 0.05, phase: i * 3 }
    );
    strokes.push(
      path(
        smoothClosedPath([...pts, [pts[2][0] + 7, baseY - 4], [pts[1][0] + 7, (top + baseY) / 2], [pts[0][0] + 6, top + 6]]),
        tone(palette.mesa, -0.08),
        { opacity: 0.5 }
      )
    );
  }

  return group([
    path(smoothClosedPath(peak), tone(palette.mesa, -0.05)),
    path(smoothClosedPath(main), palette.mesa),
    path(smoothClosedPath(hi), palette.mesaHi, { opacity: 0.6 }),
    ...strokes,
    path(smoothClosedPath(shade), palette.mesaShade, { opacity: 0.55 }),
  ], { filter: "wobble" });
}

// tiny helper to keep the shade polygon readable
function flatX(v) { return v; }
