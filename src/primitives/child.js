// A small child seen from behind: head, hair, torso (shirt), legs, arms.
import { path, group, ellipse, circle, smoothClosedPath } from "../core/svg.js";
import { ribbon } from "../core/geom.js";
import { blobPoints } from "../imperfection/jitter.js";
import { summer, tone } from "../palettes/summer.js";

export function child({
  x, y, scale = 1, skin, hair = summer.childHair, shirt, stripe, dress = false, noise, palette = summer,
}) {
  skin = skin || palette.childSkinB;
  shirt = shirt || palette.childShirt;

  const els = [];

  // legs
  const legColor = dress ? skin : tone(shirt, -0.3);
  [-9, 9].forEach((lx) => {
    els.push(path(smoothClosedPath(ribbon([[lx, 24], [lx, 52]], [6, 5])), legColor));
  });
  // feet
  [-9, 9].forEach((lx) => els.push(ellipse(lx, 54, 6, 4, palette.ink, { opacity: 0.8 })));

  // torso: shirt or dress
  if (dress) {
    const d = smoothClosedPath([
      [-11, 0], [11, 0], [20, 40], [-20, 40],
    ], 0.7);
    els.push(path(d, palette.childDress));
  } else {
    const torso = smoothClosedPath(blobPoints(0, 12, 15, 18, { noise, amp: 0.12, freq: 1.4, count: 12 }));
    els.push(path(torso, shirt));
    // stripes
    if (stripe) {
      [4, 12, 20].forEach((sy) =>
        els.push(path(smoothClosedPath([[-15, sy], [15, sy], [15, sy + 3], [-15, sy + 3]], 0.5), stripe, { opacity: 0.85 })));
    }
  }

  // arms
  [-15, 15].forEach((ax) =>
    els.push(path(smoothClosedPath(ribbon([[ax, 4], [ax * 1.2, 26]], [5, 4])), dress ? skin : shirt)));

  // neck + head
  els.push(ellipse(0, -2, 4, 5, skin));
  els.push(path(smoothClosedPath(blobPoints(0, -16, 14, 15, { noise, amp: 0.1, freq: 1.4, count: 12 }), 0.9), skin));
  // hair (back of head)
  els.push(path(smoothClosedPath(blobPoints(0, -19, 15, 14, { noise, amp: 0.12, freq: 1.5, phase: 3, count: 12 }), 0.9), hair, { opacity: 0.97 }));

  return group(els, { translate: [x, y], scale: [scale, scale], filter: "wobble" });
}
