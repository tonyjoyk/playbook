// Raw-SVG string helpers. No DOM, no runtime object model -> deterministic output.

const f = (n) => Number(n.toFixed(2));

export function attrs(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${typeof v === "number" ? f(v) : v}"`)
    .join(" ");
}

export function group(children, opts = {}) {
  const t = [];
  if (opts.translate) t.push(`translate(${f(opts.translate[0])} ${f(opts.translate[1])})`);
  if (opts.rotate) t.push(`rotate(${f(opts.rotate)} ${f(opts.rotate_cx || 0)} ${f(opts.rotate_cy || 0)})`);
  if (opts.scale) t.push(`scale(${f(opts.scale[0])} ${f(opts.scale[1] ?? opts.scale[0])})`);
  const a = {};
  if (t.length) a.transform = t.join(" ");
  if (opts.opacity !== undefined) a.opacity = opts.opacity;
  if (opts.filter) a.filter = `url(#${opts.filter})`;
  if (opts.id) a.id = opts.id;
  const inner = Array.isArray(children) ? children.join("\n") : children;
  return `<g ${attrs(a)}>\n${inner}\n</g>`;
}

export function path(d, fill, opts = {}) {
  const a = { d, fill };
  if (opts.opacity !== undefined) a.opacity = opts.opacity;
  if (opts.stroke) { a.stroke = opts.stroke; a["stroke-width"] = opts.strokeWidth ?? 1; }
  if (opts.strokeLinejoin) a["stroke-linejoin"] = opts.strokeLinejoin;
  if (opts.filter) a.filter = `url(#${opts.filter})`;
  return `<path ${attrs(a)} />`;
}

export function ellipse(cx, cy, rx, ry, fill, opts = {}) {
  const a = { cx, cy, rx, ry, fill };
  if (opts.opacity !== undefined) a.opacity = opts.opacity;
  if (opts.filter) a.filter = `url(#${opts.filter})`;
  return `<ellipse ${attrs(a)} />`;
}

export function circle(cx, cy, r, fill, opts = {}) {
  return ellipse(cx, cy, r, r, fill, opts);
}

export function rect(x, y, w, h, fill, opts = {}) {
  const a = { x, y, width: w, height: h, fill, rx: opts.rx, ry: opts.ry };
  if (opts.opacity !== undefined) a.opacity = opts.opacity;
  return `<rect ${attrs(a)} />`;
}

// Build a smooth closed path through points using a Catmull-Rom -> cubic Bezier.
// Gives organic rounded blobs instead of polygons.
export function smoothClosedPath(points, tension = 1) {
  const n = points.length;
  if (n < 3) return "";
  const p = (i) => points[((i % n) + n) % n];
  let d = `M ${f(p(0)[0])} ${f(p(0)[1])} `;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    d += `C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])} `;
  }
  return d + "Z";
}

// Open smooth path (for stems, necks).
export function smoothOpenPath(points) {
  const n = points.length;
  if (n < 2) return "";
  let d = `M ${f(points[0][0])} ${f(points[0][1])} `;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])} `;
  }
  return d;
}

export function svgDoc({ width, height, defs = "", body = "", bg }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
${defs}
</defs>
${bg ? rect(0, 0, width, height, bg) : ""}
${body}
</svg>`;
}
