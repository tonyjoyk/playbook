// Text-on-scene: a soft "torn-paper" band holding one caption line, kept legible
// over busy art. Lives in a defined safe zone rather than free-floating overlay.
import { path, group, smoothClosedPath } from "../core/svg.js";
import { jitterPoints } from "../imperfection/jitter.js";
import { summer } from "../palettes/summer.js";

export function textBand({
  W, H, text, position = "bottom", noise, palette = summer,
  font = "Poppins", fontSize = 30,
}) {
  if (!text) return "";
  const bandH = fontSize * 2.6;
  const y = position === "top" ? 0 : H - bandH;
  const pad = 26;

  // wobbly torn-paper rectangle
  const ring = jitterPoints([
    [-10, y + 6], [W * 0.5, y - 4], [W + 10, y + 8],
    [W + 8, y + bandH], [W * 0.5, y + bandH + 8], [-8, y + bandH - 2],
  ], noise, { amp: 5, freq: 0.02 });
  const paper = path(smoothClosedPath(ring, 0.85), palette.paper, { opacity: 0.9 });

  const cy = y + bandH / 2 + fontSize * 0.34;
  const label =
    `<text x="${W / 2}" y="${cy}" text-anchor="middle" ` +
    `font-family="${font}, Lato, sans-serif" font-size="${fontSize}" ` +
    `font-weight="500" fill="${palette.ink}" letter-spacing="0.3">` +
    escapeXml(text) + `</text>`;

  return group([group(paper, { filter: "wobble" }), label]);
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}
