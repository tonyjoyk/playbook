// Texture go/no-go gate: render ONE mesa through the gouache pipeline -> PNG.
// If this reads as hand-painted (not flat vector), we proceed to the full scene.
import { svgDoc, rect, group } from "../core/svg.js";
import { filterDefs } from "../render/filters.js";
import { makeNoise } from "../imperfection/jitter.js";
import { mesa } from "../primitives/mesa.js";
import { renderPng } from "../render/png.js";
import { summer } from "../palettes/summer.js";

const W = 800, H = 600;
const seed = Number(process.argv[2] ?? 7);
const noise = makeNoise(seed, "mesa-gate");

const sky = `
  ${rect(0, 0, W, H, summer.sky)}
  ${rect(0, H * 0.5, W, H * 0.5, summer.skyLow)}
`;

const theMesa = mesa({ cx: W * 0.5, baseY: H * 0.78, w: W * 0.32, h: H * 0.5, noise, palette: summer });

// chalky grain overlay across the whole canvas
const grain = group(rect(0, 0, W, H, "#000000"), { filter: "paperGrain", opacity: 0.06 });

const svg = svgDoc({
  width: W, height: H,
  defs: filterDefs(seed),
  body: `${sky}\n${theMesa}\n${grain}`,
});

import { writeFileSync } from "node:fs";
writeFileSync(new URL("../../out/gate.svg", import.meta.url), svg);
renderPng(svg, new URL("../../out/gate.png", import.meta.url).pathname, { width: W });
console.log("wrote out/gate.png and out/gate.svg (seed " + seed + ")");
