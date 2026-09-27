import { nearestSlot, normalizeHex } from './paletteSlots';
import {
  DEFAULT_TRANSFORM,
  type SceneDocument,
  type SceneObject,
  type ScenePath,
} from '../types';

export function compileSceneFromSvg(sceneSvg: string, cutoutMode: boolean): SceneDocument {
  const doc = new DOMParser().parseFromString(sceneSvg, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  const width = Number(svgEl?.getAttribute('width') ?? 1000);
  const height = Number(svgEl?.getAttribute('height') ?? 800);
  const objects: SceneObject[] = [];

  for (const group of doc.querySelectorAll('g[data-object-id]')) {
    const id = group.getAttribute('data-object-id');
    if (!id) continue;
    const paths: ScenePath[] = [];
    let slot: string | undefined;
    for (const el of group.querySelectorAll('path')) {
      const d = el.getAttribute('d');
      const fill = el.getAttribute('fill');
      if (!d || !fill) continue;
      const hex = normalizeHex(fill);
      if (hex && !slot) slot = nearestSlot(hex);
      paths.push({
        d,
        fill,
        transform: el.getAttribute('transform') ?? 'translate(0,0)',
      });
    }
    if (paths.length === 0) continue;
    objects.push({
      id,
      paths,
      transform: { ...DEFAULT_TRANSFORM },
      zIndex: objects.length,
      slot,
    });
  }

  return {
    version: 1,
    width,
    height,
    objects,
    cutoutMode,
  };
}
