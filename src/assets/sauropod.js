// AUTHORED sauropod asset (not procedurally generated from noise).
// One confident silhouette outline traced to the reference proportions, plus a
// belly shadow (2-tone), spots, and a deliberate eye. Color via palette SLOTS;
// per-instance wobble via seeded jitter on the outline only. Determinism preserved.
//
// Local authoring frame: x 0..100, y 0..165 (y DOWN). Ground anchor = (23,165).
import { path, group, ellipse, circle, smoothClosedPath } from "../core/svg.js";
import { jitterPoints } from "../imperfection/jitter.js";
import { summer } from "../palettes/summer.js";

// Silhouette outline, clockwise from the snout. Authored to the reference.
const OUTLINE = [
  [88, 34], [86, 27], [80, 22], [72, 19], [63, 21], [57, 27],  // rounder, friendlier head
  [50, 40], [43, 57], [37, 77], [31, 97],                      // back of neck (S-curve) -> shoulder
  [22, 102], [14, 112], [9, 123], [8, 134],                    // back -> rear
  [11, 148], [11, 165], [18, 165],                             // hind leg
  [20, 150], [26, 150], [28, 165], [36, 165],                  // belly notch + front leg
  [39, 143], [42, 120], [47, 100], [52, 80],                   // chest -> front of neck (THICKER)
  [57, 62], [61, 47], [64, 38],                                // front of neck -> jaw
  [68, 36], [78, 38], [88, 37],                                // jaw -> under-snout
];

const GROUND = [23, 165];
const EYE = [73, 29];

// Smaller, scattered spots on body + lower neck: [x, y, rx, ry]
const SPOTS = [
  [18, 118, 4.5, 4], [27, 128, 5, 4.5], [14, 131, 4, 4], [31, 116, 4.5, 4],
  [37, 125, 4, 4], [23, 108, 4.5, 4], [33, 138, 4.5, 4], [20, 140, 4, 4],
  [42, 96, 4, 3.5], [46, 78, 3.8, 3.3],
];

export function sauropod({
  x, y, scale = 1, dir = 1,
  color, shade, spotColor, spots = false, noise, palette = summer,
}) {
  color = color || palette.sauropodBlue;
  shade = shade || palette.sauropodBlueShade;
  spotColor = spotColor || shade;

  // gentle wobble on the authored outline (keeps the shape, adds handmade edge)
  const outline = noise
    ? jitterPoints(OUTLINE, noise, { amp: 2.2, freq: 0.06 })
    : OUTLINE;

  const parts = [];

  // belly shadow (2-tone under-mass) — the single biggest "painted" tell
  parts.push(ellipse(24, 138, 18, 15, shade, { opacity: 0.5 }));

  // the silhouette
  parts.push(path(smoothClosedPath(outline, 0.85), color));

  // a soft crease to separate the two legs
  parts.push(path(smoothClosedPath([[23, 150], [25, 158], [22, 164], [20, 158]], 0.8), shade, { opacity: 0.45 }));

  // spots
  if (spots) {
    SPOTS.forEach(([sx, sy, rx, ry]) => parts.push(ellipse(sx, sy, rx, ry, spotColor, { opacity: 0.55 })));
  }

  // eye
  parts.push(circle(EYE[0], EYE[1], 2.4, palette.ink));

  // place: move ground anchor to origin, then position + scale + flip
  const inner = group(parts, { translate: [-GROUND[0], -GROUND[1]] });
  return group(inner, { translate: [x, y], scale: [scale * dir, scale], filter: "wobble" });
}
