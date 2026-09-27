// SVG string -> PNG buffer via resvg (native, deterministic, good filter fidelity).
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";

export function renderPng(svg, outPath, { width } = {}) {
  const resvg = new Resvg(svg, {
    fitTo: width ? { mode: "width", value: width } : { mode: "original" },
    background: "rgba(255,255,255,1)",
  });
  const png = resvg.render().asPng();
  writeFileSync(outPath, png);
  return outPath;
}
