// Render the sauropod asset alone: (1) on sky for visual review, (2) as a solid
// black silhouette for IoU grading vs the reference mask.
import { writeFileSync } from "node:fs";
import { svgDoc, rect, group } from "../core/svg.js";
import { filterDefs } from "../render/filters.js";
import { makeNoise } from "../imperfection/jitter.js";
import { sauropod } from "../assets/sauropod.js";
import { renderPng } from "../render/png.js";
import { summer } from "../palettes/summer.js";

const W = 260, H = 430, seed = Number(process.argv[2] ?? 7);
const noise = makeNoise(seed, "saur-asset");
const place = { x: W * 0.5, y: H - 20, scale: 2.2, dir: 1, spots: true, noise, palette: summer };

// visual version
const vis = svgDoc({
  width: W, height: H, defs: filterDefs(seed),
  body: `${rect(0, 0, W, H, summer.sky)}\n${sauropod(place)}`,
});
writeFileSync(new URL("../../out/_asset_vis.svg", import.meta.url), vis);
renderPng(vis, new URL("../../out/_asset_vis.png", import.meta.url).pathname, { width: W });

// silhouette version (no filter, solid black on white) for IoU
const sil = svgDoc({
  width: W, height: H, defs: "",
  body: `${rect(0, 0, W, H, "#ffffff")}\n` +
        sauropod({ ...place, color: "#000000", shade: "#000000", spotColor: "#000000", spots: false, noise: null }).replace(/filter="url\(#wobble\)"/g, ""),
});
renderPng(sil, new URL("../../out/_asset_sil.png", import.meta.url).pathname, { width: W });
console.log("wrote _asset_vis.png and _asset_sil.png");
