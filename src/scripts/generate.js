// Generate the full scene -> SVG + PNG.
// Usage: node src/scripts/generate.js [seed] ["caption text"]
import { writeFileSync } from "node:fs";
import { buildScene } from "../compose/scene.js";
import { renderPng } from "../render/png.js";

const seed = Number(process.argv[2] ?? 7);
const text = process.argv[3] ?? "";

const scene = {
  width: 1000,
  height: 840,
  seed,
  text,
  textPosition: "bottom",
};

const svg = buildScene(scene);
const base = new URL("../../out/", import.meta.url);
const tag = text ? "scene-captioned" : `scene-${seed}`;
writeFileSync(new URL(`${tag}.svg`, base), svg);
renderPng(svg, new URL(`${tag}.png`, base).pathname, { width: scene.width });
console.log(`wrote out/${tag}.png and out/${tag}.svg (seed ${seed})`);
