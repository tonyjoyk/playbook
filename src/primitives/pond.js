// Pond: a soft water blob with a lighter rim and a few ripples.
import { path, group, smoothClosedPath, smoothOpenPath } from "../core/svg.js";
import { blobPoints } from "../imperfection/jitter.js";
import { summer, tone } from "../palettes/summer.js";

export function pond({ cx, cy, rx, ry, noise, palette = summer }) {
  const outer = path(
    smoothClosedPath(blobPoints(cx, cy, rx, ry, { noise, amp: 0.1, freq: 1.3, count: 16 })),
    palette.pond
  );
  const deep = path(
    smoothClosedPath(blobPoints(cx, cy + ry * 0.18, rx * 0.8, ry * 0.7, { noise, amp: 0.1, freq: 1.4, phase: 6, count: 14 })),
    palette.pondDeep, { opacity: 0.5 }
  );
  const ripples = [0.4, 0.7].map((t, i) =>
    path(smoothOpenPath([
      [cx - rx * 0.5, cy + ry * (t - 0.2)],
      [cx, cy + ry * (t - 0.05)],
      [cx + rx * 0.5, cy + ry * (t - 0.2)],
    ]), "none", { stroke: tone(palette.pond, 0.25), strokeWidth: 2, opacity: 0.5 })
  );
  return group([outer, deep, ...ripples], { filter: "wobble" });
}
