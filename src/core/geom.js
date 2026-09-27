// Geometry helpers shared by primitives.

// Build a tapering "ribbon" (neck, tail, limb, trunk) from a centerline of
// [x,y] points and a per-point half-width. Returns a closed point ring.
export function ribbon(centerline, widths) {
  const n = centerline.length;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const p = centerline[i];
    const prev = centerline[Math.max(0, i - 1)];
    const next = centerline[Math.min(n - 1, i + 1)];
    let dx = next[0] - prev[0], dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const nx = -dy, ny = dx; // normal
    const w = widths[i];
    left.push([p[0] + nx * w, p[1] + ny * w]);
    right.push([p[0] - nx * w, p[1] - ny * w]);
  }
  return [...left, ...right.reverse()];
}

export function lerp(a, b, t) { return a + (b - a) * t; }
