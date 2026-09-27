// Compose the prehistoric-jungle reference scene from primitives, back-to-front.
import { svgDoc, rect, group, path, smoothClosedPath } from "../core/svg.js";
import { filterDefs } from "../render/filters.js";
import { makeNoise, makeRng } from "./rng-bridge.js";
import { summer, tone } from "../palettes/summer.js";
import { sky, clouds } from "../primitives/sky.js";
import { mesa } from "../primitives/mesa.js";
import { pterosaur, stegosaurus } from "../primitives/creatures.js";
import { sauropod } from "../assets/sauropod.js"; // authored asset (replaces procedural blob)
import { palm, fern, broadLeaf, bush, flower, lilyPad, lotus } from "../primitives/flora.js";
import { pond } from "../primitives/pond.js";
import { child } from "../primitives/child.js";
import { textBand } from "./text.js";

export function buildScene(scene = {}) {
  const W = scene.width || 1000;
  const H = scene.height || 840;
  const seed = scene.seed ?? 7;
  const palette = summer;
  const N = (label) => makeNoise(seed, label);
  const R = (label) => makeRng(seed, label);

  const horizon = H * 0.52;
  const layers = [];

  // 1. sky + clouds
  layers.push(sky({ W, H, horizon, palette }));
  layers.push(clouds({ W, noise: N("clouds"), palette }));

  // 2. pterosaurs
  const ptN = N("ptero");
  layers.push(group([
    pterosaur({ cx: W * 0.32, cy: H * 0.08, span: 78, tilt: -6, palette }),
    pterosaur({ cx: W * 0.62, cy: H * 0.10, span: 92, tilt: 8, palette }),
    pterosaur({ cx: W * 0.74, cy: H * 0.16, span: 70, tilt: 14, palette }),
    pterosaur({ cx: W * 0.83, cy: H * 0.22, span: 58, tilt: 20, palette }),
  ]));

  // 3. far hills behind mesa
  const hillN = N("hills");
  layers.push(group(
    path(smoothClosedPath([
      [-20, horizon], [W * 0.2, horizon - 90], [W * 0.45, horizon - 40],
      [W * 0.7, horizon - 110], [W + 20, horizon - 30], [W + 20, horizon + 20], [-20, horizon + 20],
    ], 0.9), palette.farHills, { opacity: 0.7 }),
    { filter: "wobble" }
  ));

  // 4. mesa
  layers.push(mesa({ cx: W * 0.5, baseY: horizon + 14, w: W * 0.2, h: H * 0.42, noise: N("mesa"), palette }));

  // 4b. ground mass (fills everything below the horizon so no bare canvas shows)
  const grN = N("ground");
  layers.push(group([
    path(smoothClosedPath([
      [-20, horizon - 6], [W * 0.25, horizon + 10], [W * 0.55, horizon - 4],
      [W * 0.8, horizon + 12], [W + 20, horizon],
      [W + 20, H + 20], [-20, H + 20],
    ], 0.9), palette.greenDeep),
    path(smoothClosedPath([
      [-20, H * 0.72], [W * 0.5, H * 0.7], [W + 20, H * 0.73], [W + 20, H + 20], [-20, H + 20],
    ], 0.9), palette.greenDark, { opacity: 0.6 }),
  ], { filter: "wobble" }));

  // 5. far tree line (dark green band of bushes)
  const tlR = R("treeline");
  const treeline = [];
  for (let i = 0; i < 10; i++) {
    const x = (i / 9) * W + tlR.float(-30, 30);
    treeline.push(bush({ x, y: horizon + tlR.float(0, 16), w: tlR.float(120, 180), h: tlR.float(70, 110), rng: R("tl" + i), noise: N("tl" + i), palette }));
  }
  layers.push(group(treeline, { opacity: 0.9 }));

  // 6. blue sauropod (mid-left) — authored asset
  layers.push(sauropod({
    x: W * 0.2, y: H * 0.64, scale: 1.5, dir: 1, spots: true,
    color: palette.sauropodBlue, shade: palette.sauropodBlueShade, spotColor: palette.sauropodSpot,
    noise: N("saur-blue"), palette,
  }));

  // 7. midground foliage band
  const midFoliage = [];
  midFoliage.push(palm({ x: W * 0.06, y: H * 0.62, scale: 1.0, bend: -16, rng: R("palmL1"), noise: N("palmL1"), palette }));
  midFoliage.push(palm({ x: W * 0.16, y: H * 0.58, scale: 0.8, bend: 10, rng: R("palmL2"), noise: N("palmL2"), palette }));
  midFoliage.push(palm({ x: W * 0.5, y: H * 0.6, scale: 0.95, bend: -8, rng: R("palmC"), noise: N("palmC"), palette }));
  midFoliage.push(palm({ x: W * 0.93, y: H * 0.62, scale: 1.05, bend: 16, rng: R("palmR1"), noise: N("palmR1"), palette }));
  midFoliage.push(palm({ x: W * 0.84, y: H * 0.56, scale: 0.78, bend: -10, rng: R("palmR2"), noise: N("palmR2"), palette }));
  const mfR = R("midfern");
  for (let i = 0; i < 8; i++) {
    const x = mfR.float(0.1, 0.9) * W;
    midFoliage.push(fern({ x, y: horizon + mfR.float(30, 90), scale: mfR.float(0.7, 1.1), rng: R("mf" + i), noise: N("mf" + i), palette }));
  }
  layers.push(group(midFoliage));

  // 8. pink sauropod (mid-right, peeking) — same authored asset, recolored via slots
  layers.push(sauropod({
    x: W * 0.83, y: H * 0.58, scale: 1.15, dir: -1, spots: false,
    color: palette.sauropodPink, shade: palette.sauropodPinkShade, spotColor: palette.sauropodPinkShade,
    noise: N("saur-pink"), palette,
  }));

  // 9. pond (center-bottom)
  layers.push(pond({ cx: W * 0.52, cy: H * 0.82, rx: W * 0.2, ry: H * 0.07, noise: N("pond"), palette }));

  // 10. denser low foliage clumps
  const lowR = R("lowfol");
  const lowFol = [];
  for (let i = 0; i < 7; i++) {
    const x = lowR.float(0.0, 1.0) * W;
    lowFol.push(bush({ x, y: H * (0.66 + lowR.float(0, 0.06)), w: lowR.float(120, 200), h: lowR.float(80, 130), rng: R("lf" + i), noise: N("lf" + i), palette }));
  }
  for (let i = 0; i < 6; i++) {
    lowFol.push(fern({ x: lowR.float(0.05, 0.95) * W, y: H * (0.7 + lowR.float(0, 0.08)), scale: lowR.float(0.9, 1.4), rng: R("lff" + i), noise: N("lff" + i), palette }));
  }
  layers.push(group(lowFol));

  // 11. stegosaurs (foreground right, by the pond) — bigger and clearly readable
  layers.push(stegosaurus({ x: W * 0.66, y: H * 0.72, scale: 1.05, dir: 1, noise: N("stego1"), palette }));
  layers.push(stegosaurus({ x: W * 0.88, y: H * 0.77, scale: 0.82, dir: 1, noise: N("stego2"), palette }));

  // 12. lily pads + lotus on the pond
  const lilies = [];
  const liR = R("lily");
  for (let i = 0; i < 5; i++) {
    lilies.push(lilyPad({ x: W * (0.42 + liR.float(0, 0.22)), y: H * (0.8 + liR.float(0, 0.05)), scale: liR.float(0.8, 1.2), noise: N("li" + i), palette }));
  }
  lilies.push(lotus({ x: W * 0.44, y: H * 0.84, scale: 0.9, palette }));
  lilies.push(lotus({ x: W * 0.6, y: H * 0.86, scale: 0.8, palette }));
  layers.push(group(lilies));

  // 13. children (center-bottom, from behind, watching)
  layers.push(child({ x: W * 0.45, y: H * 0.82, scale: 1.0, skin: palette.childSkinA, shirt: palette.childShirt, stripe: palette.childStripe, noise: N("child1"), palette }));
  layers.push(child({ x: W * 0.52, y: H * 0.83, scale: 0.96, skin: palette.childSkinB, dress: true, noise: N("child2"), palette }));

  // 14. foreground leaf frame + flowers
  const fg = [];
  // bottom groundcover row spanning the full width to frame the scene
  const gcR = R("groundcover");
  for (let i = 0; i < 7; i++) {
    const x = (i / 6) * W + gcR.float(-40, 40);
    fg.push(bush({ x, y: H * (0.96 + gcR.float(0, 0.04)), w: gcR.float(170, 240), h: gcR.float(110, 160), rng: R("gc" + i), noise: N("gc" + i), palette }));
  }
  fg.push(broadLeaf({ x: W * 0.04, y: H * 1.02, scale: 1.5, rotate: -18, color: palette.greenDeep, rng: R("fgL1"), noise: N("fgL1"), palette }));
  fg.push(broadLeaf({ x: W * 0.0, y: H * 0.95, scale: 1.3, rotate: 24, color: palette.greenMid, rng: R("fgL2"), noise: N("fgL2"), palette }));
  fg.push(broadLeaf({ x: W * 0.98, y: H * 1.0, scale: 1.6, rotate: 18, color: palette.greenDeep, rng: R("fgR1"), noise: N("fgR1"), palette }));
  fg.push(broadLeaf({ x: W * 1.0, y: H * 0.9, scale: 1.3, rotate: -22, color: palette.greenMid, rng: R("fgR2"), noise: N("fgR2"), palette }));
  fg.push(fern({ x: W * 0.2, y: H * 0.99, scale: 1.5, rng: R("fgfern"), noise: N("fgfern"), palette }));
  fg.push(flower({ x: W * 0.1, y: H * 0.88, scale: 1.6, color: palette.flower, rng: R("fgf1"), noise: N("fgf1"), palette }));
  fg.push(flower({ x: W * 0.16, y: H * 0.93, scale: 1.2, color: palette.lotus, rng: R("fgf2"), noise: N("fgf2"), palette }));
  layers.push(group(fg));

  // 15. chalky grain overlay
  layers.push(group(rect(0, 0, W, H, "#000000"), { filter: "paperGrain", opacity: 0.11 }));

  // 16. optional caption
  if (scene.text) {
    layers.push(textBand({ W, H, text: scene.text, position: scene.textPosition || "bottom", noise: N("text"), palette }));
  }

  return svgDoc({ width: W, height: H, defs: filterDefs(seed), body: layers.join("\n") });
}
