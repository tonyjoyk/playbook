import type { SceneDocument, SceneObject } from '../types';

function transformAttr(obj: SceneObject): string {
  const { tx, ty, scale, rotation } = obj.transform;
  if (rotation !== 0) {
    return `translate(${tx} ${ty}) rotate(${rotation}) scale(${scale})`;
  }
  return `translate(${tx} ${ty}) scale(${scale})`;
}

export function renderSceneSvg(scene: SceneDocument, selectedId?: string | null): string {
  const sorted = [...scene.objects].sort((a, b) => a.zIndex - b.zIndex);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}" width="100%" height="100%">`,
  ];
  for (const obj of sorted) {
    const selected = obj.id === selectedId;
    lines.push(
      `<g data-object-id="${obj.id}"${obj.slot ? ` data-slot="${obj.slot}"` : ''} transform="${transformAttr(obj)}"${selected ? ' class="scene-object-selected"' : ''}>`
    );
    for (const p of obj.paths) {
      lines.push(
        `<path d="${p.d}" fill="${p.fill}" transform="${p.transform}"/>`
      );
    }
    lines.push('</g>');
  }
  lines.push('</svg>');
  return lines.join('\n');
}

export function objectLabel(obj: SceneObject): string {
  if (obj.groupMeta?.isManualGroup) {
    const n = obj.groupMeta.children?.length ?? obj.paths.length;
    return `Group (${n} shapes)`;
  }
  const num = obj.id.replace(/^obj-/, '').replace(/^group-/, '');
  if (/^\d+$/.test(num)) {
    return `Shape ${Number(num) + 1}${obj.slot ? ` · ${obj.slot}` : ''}`;
  }
  return `Shape${obj.slot ? ` · ${obj.slot}` : ''}`;
}
