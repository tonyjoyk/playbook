import { nearestSlot, normalizeHex } from './paletteSlots';
import { VTRACER_CONFIG } from './vtracerConfig';

const MIN_AREA = VTRACER_CONFIG.filterSpeckle;
const PATH_COUNT_WARN = 500;

type PathEntry = {
  d: string;
  fill: string;
  transform: string;
};

function parsePaths(svg: string): PathEntry[] {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const paths: PathEntry[] = [];
  for (const el of doc.querySelectorAll('path')) {
    const d = el.getAttribute('d');
    const fill = el.getAttribute('fill');
    if (!d || !fill) continue;
    paths.push({
      d,
      fill,
      transform: el.getAttribute('transform') ?? 'translate(0,0)',
    });
  }
  return paths;
}

function estimateArea(d: string): number {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  if (nums.length < 4) return 0;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]);
    maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]);
    maxY = Math.max(maxY, nums[i + 1]);
  }
  return Math.max(0, (maxX - minX) * (maxY - minY));
}

export function processTracedSvg(rawSvg: string): string {
  const paths = parsePaths(rawSvg).filter((p) => {
    const hex = normalizeHex(p.fill);
    return hex && estimateArea(p.d) >= MIN_AREA;
  });

  const w = rawSvg.match(/width="(\d+)"/)?.[1] ?? '1000';
  const h = rawSvg.match(/height="(\d+)"/)?.[1] ?? '800';
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Generator: Playbook Pal vector pipeline -->',
    `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`,
  ];
  for (const p of paths) {
    const hex = normalizeHex(p.fill) ?? p.fill;
    const slot = nearestSlot(hex);
    lines.push(
      `<g data-slot="${slot}"><path d="${p.d}" fill="${hex}" transform="${p.transform}"/></g>`
    );
  }
  lines.push('</svg>');
  const result = lines.join('\n');
  if (paths.length > PATH_COUNT_WARN) {
    console.warn(
      `[playbook-pal] vector post-process: ${paths.length} paths (>${PATH_COUNT_WARN})`
    );
  }
  return result;
}
