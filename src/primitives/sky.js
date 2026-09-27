// Sky bands + soft pink gouache clouds.
import { rect, group, path, smoothClosedPath } from "../core/svg.js";
import { blobPoints } from "../imperfection/jitter.js";
import { summer, tone } from "../palettes/summer.js";

export function sky({ W, H, horizon, palette = summer }) {
  return group([
    rect(0, 0, W, horizon + 40, palette.skyTop),
    rect(0, horizon * 0.35, W, horizon, palette.sky),
  ]);
}

// A clumpy cloud built from a few overlapping blobs.
export function cloud({ cx, cy, scale = 1, noise, palette = summer }) {
  const lobes = [
    [0, 0, 60, 26], [-42, 6, 38, 20], [40, 8, 42, 22], [-12, -14, 40, 22], [20, -10, 34, 20],
  ];
  const parts = lobes.map(([dx, dy, rx, ry], i) =>
    path(
      smoothClosedPath(blobPoints(cx + dx * scale, cy + dy * scale, rx * scale, ry * scale, {
        noise, amp: 0.22, freq: 1.6, phase: i * 5, count: 12,
      })),
      i === 0 ? palette.cloud : tone(palette.cloud, 0.04),
      { opacity: 0.92 }
    )
  );
  return group(parts, { filter: "wobble" });
}

export function clouds({ W, noise, palette = summer }) {
  return group([
    cloud({ cx: W * 0.18, cy: 70, scale: 0.9, noise, palette }),
    cloud({ cx: W * 0.82, cy: 60, scale: 1.1, noise, palette }),
    cloud({ cx: W * 0.5, cy: 40, scale: 0.7, noise, palette }),
  ]);
}
