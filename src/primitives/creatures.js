// Dinosaurs + pterosaurs as simplified folk-art silhouettes.
import { path, group, ellipse, circle, smoothClosedPath } from "../core/svg.js";
import { ribbon } from "../core/geom.js";
import { blobPoints, jitterPoints } from "../imperfection/jitter.js";
import { summer, tone } from "../palettes/summer.js";

// Flying pterosaur silhouette: a shallow W of two wings + body + head crest.
export function pterosaur({ cx, cy, span = 70, tilt = 0, palette = summer }) {
  const w = span / 2;
  const pts = [
    [-w, -2], [-w * 0.55, -w * 0.22], [-w * 0.2, -2],   // left wing
    [-4, 4], [4, 4],                                      // body
    [w * 0.2, -2], [w * 0.55, -w * 0.22], [w, -2],        // right wing
    [w * 0.5, 3], [w * 0.18, 6],
    [w * 0.05, 14], [-w * 0.05, 14],                      // little tail/legs
    [-w * 0.18, 6], [-w * 0.5, 3],
  ];
  // head crest poking forward
  const head = [[4, 4], [w * 0.28, -6], [w * 0.42, -3], [10, 7]];
  return group([
    path(smoothClosedPath(pts, 0.9), palette.silhouette),
    path(smoothClosedPath(head, 0.9), palette.silhouette),
  ], { translate: [cx, cy], rotate: tilt, filter: "wobbleFine" });
}

// Long-necked sauropod (brachiosaurus-ish). dir = 1 faces right, -1 faces left.
export function sauropod({
  x, y, scale = 1, dir = 1, color, shade, spotColor, spots = false, noise, palette = summer,
}) {
  const s = scale, d = dir;
  color = color || palette.sauropodBlue;
  shade = shade || tone(color, -0.18);

  // legs (back pair first, then front pair) — simple tapered columns
  const legXs = [-55, -28, 28, 52];
  const legs = legXs.map((lx, i) => {
    const top = -40, bot = 6 + (i % 2) * 4;
    const wTop = 15 - (i < 2 ? 0 : 1), wBot = 12;
    const cl = [[lx, top], [lx + (i < 2 ? -2 : 2), (top + bot) / 2], [lx, bot]];
    return path(smoothClosedPath(ribbon(cl, [wTop, wBot + 1, wBot])), i < 2 ? shade : color);
  });

  // body
  const body = path(
    smoothClosedPath(blobPoints(-8, -55, 62, 40, { noise, amp: 0.14, freq: 1.5, count: 16 })),
    color
  );
  // belly shade
  const belly = path(
    smoothClosedPath(blobPoints(-8, -42, 56, 26, { noise, amp: 0.14, freq: 1.6, phase: 4, count: 14 })),
    shade, { opacity: 0.4 }
  );

  // tail
  const tailCl = [[-60, -58], [-95, -52], [-120, -40], [-138, -22]];
  const tail = path(smoothClosedPath(ribbon(tailCl, [26, 16, 8, 3])), color);

  // neck + head, sweeping up and forward
  const neckCl = [[42, -70], [70, -95], [86, -130], [96, -165], [108, -188]];
  const neck = path(smoothClosedPath(ribbon(neckCl, [24, 18, 14, 11, 9])), color);
  const headPts = [[108, -195], [128, -198], [134, -186], [126, -176], [110, -178]];
  const head = path(smoothClosedPath(headPts, 0.9), color);
  const eye = circle(122, -190, 2.6, palette.ink);

  // spots (for the blue one)
  let spotEls = "";
  if (spots) {
    const sc = spotColor || tone(color, -0.18);
    const dots = [[-30, -58], [-5, -68], [18, -52], [-18, -40], [8, -44], [-45, -50], [30, -66]];
    spotEls = group(dots.map(([dx, dy], i) =>
      ellipse(dx, dy, 7 + (i % 3), 6 + (i % 2), sc, { opacity: 0.55 })
    ));
  }

  const inner = [
    ...legs.slice(0, 2),    // back legs
    tail,
    body,
    belly,
    spotEls,
    neck,
    head,
    eye,
    ...legs.slice(2),       // front legs over body
  ].join("\n");

  return group(inner, { translate: [x, y], scale: [s * d, s], filter: "wobble" });
}

// Stegosaurus with back plates. dir = 1 faces right.
export function stegosaurus({ x, y, scale = 1, dir = 1, noise, palette = summer }) {
  const color = palette.stego, shade = palette.stegoShade, plate = palette.stegoPlate;

  // body — low, rounded
  const body = path(
    smoothClosedPath(blobPoints(0, -34, 60, 30, { noise, amp: 0.12, freq: 1.5, count: 16, squash: 0.05 })),
    color
  );
  const belly = path(
    smoothClosedPath(blobPoints(0, -24, 54, 18, { noise, amp: 0.12, freq: 1.6, phase: 3, count: 14 })),
    shade, { opacity: 0.4 }
  );

  // tail + neck/head
  const tail = path(smoothClosedPath(ribbon([[-52, -40], [-88, -34], [-112, -24]], [22, 11, 4])), color);
  const neck = path(smoothClosedPath(ribbon([[48, -42], [78, -36], [98, -28]], [22, 14, 9])), color);
  const head = path(smoothClosedPath([[96, -34], [120, -32], [122, -22], [104, -20], [94, -26]], 0.9), color);
  const eye = circle(110, -29, 2.4, palette.ink);

  // legs
  const legs = [-34, -10, 22, 42].map((lx, i) => {
    const top = -28, bot = 8;
    const cl = [[lx, top], [lx, bot]];
    return path(smoothClosedPath(ribbon(cl, [13, 11])), i < 2 ? shade : color);
  });

  // back plates — a row of soft triangles following the back arc
  const plates = [];
  const pN = 7;
  for (let i = 0; i < pN; i++) {
    const t = i / (pN - 1);
    const px = -44 + t * 92;
    const arch = -64 - Math.sin(t * Math.PI) * 20;
    const ph = 16 + Math.sin(t * Math.PI) * 16;
    const tri = jitterPoints([
      [px - 9, arch + 6], [px, arch - ph], [px + 9, arch + 6],
    ], noise, { amp: 2.5, freq: 0.1, phase: i * 4 });
    plates.push(path(smoothClosedPath(tri, 0.8), i % 2 ? plate : tone(plate, 0.06)));
  }

  const inner = [
    ...legs.slice(0, 2),
    tail, body, belly, neck, head, eye,
    ...plates,
    ...legs.slice(2),
  ].join("\n");

  return group(inner, { translate: [x, y], scale: [scale * dir, scale], filter: "wobble" });
}
