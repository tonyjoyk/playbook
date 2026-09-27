import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasMode, ObjectTransform, SceneDocument } from '../types';
import { renderSceneSvg } from '../lib/sceneRender';

type EditableSceneProps = {
  scene: SceneDocument;
  mode: CanvasMode;
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onUpdateTransform: (objectId: string, patch: Partial<ObjectTransform>) => void;
  onTransformBegin: (objectId: string) => void;
  onTransformEnd: (objectId: string) => void;
};

type DragState = {
  objectId: string;
  startX: number;
  startY: number;
  origTx: number;
  origTy: number;
};

type ResizeState = {
  objectId: string;
  startX: number;
  startY: number;
  origScale: number;
  centerX: number;
  centerY: number;
  startDist: number;
};

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM()?.inverse();
  return ctm ? pt.matrixTransform(ctm) : { x: 0, y: 0 };
}

export function EditableScene({
  scene,
  mode,
  selectedObjectId,
  onSelectObject,
  onUpdateTransform,
  onTransformBegin,
  onTransformEnd,
}: EditableSceneProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [handleBox, setHandleBox] = useState<DOMRect | null>(null);

  const svgMarkup = renderSceneSvg(scene, selectedObjectId);

  const updateHandleBox = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || !selectedObjectId || mode !== 'edit') {
      setHandleBox(null);
      return;
    }
    const group = wrap.querySelector(`[data-object-id="${selectedObjectId}"]`);
    if (!group || !(group instanceof SVGGElement)) {
      setHandleBox(null);
      return;
    }
    const bbox = group.getBBox();
    const svg = wrap.querySelector('svg');
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const corners = [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x, y: bbox.y + bbox.height },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    ];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of corners) {
      const pt = svg.createSVGPoint();
      pt.x = c.x;
      pt.y = c.y;
      const screen = pt.matrixTransform(ctm);
      minX = Math.min(minX, screen.x);
      minY = Math.min(minY, screen.y);
      maxX = Math.max(maxX, screen.x);
      maxY = Math.max(maxY, screen.y);
    }
    const wrapRect = wrap.getBoundingClientRect();
    setHandleBox(
      new DOMRect(minX - wrapRect.left, minY - wrapRect.top, maxX - minX, maxY - minY)
    );
  }, [selectedObjectId, mode, scene]);

  useEffect(() => {
    updateHandleBox();
  }, [updateHandleBox, svgMarkup]);

  useEffect(() => {
    if (!drag && !resize) return;

    function onMove(e: PointerEvent) {
      const svg = wrapRef.current?.querySelector('svg');
      if (!svg) return;
      const pt = clientToSvg(svg, e.clientX, e.clientY);

      if (drag) {
        onUpdateTransform(drag.objectId, {
          tx: drag.origTx + (pt.x - drag.startX),
          ty: drag.origTy + (pt.y - drag.startY),
        });
      } else if (resize) {
        const dx = pt.x - resize.centerX;
        const dy = pt.y - resize.centerY;
        const dist = Math.hypot(dx, dy) || 1;
        const ratio = dist / resize.startDist;
        const nextScale = Math.max(0.1, Math.min(4, resize.origScale * ratio));
        onUpdateTransform(resize.objectId, { scale: nextScale });
        requestAnimationFrame(updateHandleBox);
      }
    }

    function onUp() {
      const endedId = drag?.objectId ?? resize?.objectId;
      setDrag(null);
      setResize(null);
      if (endedId) onTransformEnd(endedId);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, resize, onUpdateTransform, onTransformEnd, updateHandleBox]);

  function handlePointerDown(e: React.PointerEvent) {
    if (mode !== 'edit') return;
    const target = (e.target as Element).closest('[data-object-id]');
    if (!target || !(target instanceof SVGGElement)) return;
    const objectId = target.getAttribute('data-object-id');
    if (!objectId) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectObject(objectId);

    const svg = wrapRef.current?.querySelector('svg');
    if (!svg) return;
    const pt = clientToSvg(svg, e.clientX, e.clientY);
    const obj = scene.objects.find((o) => o.id === objectId);
    if (!obj) return;

    setDrag({
      objectId,
      startX: pt.x,
      startY: pt.y,
      origTx: obj.transform.tx,
      origTy: obj.transform.ty,
    });
    onTransformBegin(objectId);
  }

  function handleResizeDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedObjectId) return;
    const obj = scene.objects.find((o) => o.id === selectedObjectId);
    const svg = wrapRef.current?.querySelector('svg');
    if (!obj || !svg) return;
    const group = svg.querySelector(`[data-object-id="${selectedObjectId}"]`);
    if (!group || !(group instanceof SVGGElement)) return;
    const bbox = group.getBBox();
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;
    const pt = clientToSvg(svg, e.clientX, e.clientY);
    const startDist = Math.hypot(pt.x - centerX, pt.y - centerY) || 1;
    setResize({
      objectId: selectedObjectId,
      startX: pt.x,
      startY: pt.y,
      origScale: obj.transform.scale,
      centerX,
      centerY,
      startDist,
    });
    onTransformBegin(selectedObjectId);
  }

  return (
    <div
      ref={wrapRef}
      className={`scene-svg-wrap${mode === 'edit' ? ' scene-svg-edit' : ''}`}
      onPointerDown={handlePointerDown}
    >
      <div
        className="scene-svg-inner"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
      {mode === 'edit' && handleBox && selectedObjectId && (
        <div
          className="scene-resize-handles"
          style={{
            left: handleBox.x,
            top: handleBox.y,
            width: handleBox.width,
            height: handleBox.height,
          }}
        >
          <span
            className="scene-handle scene-handle-br"
            onPointerDown={handleResizeDown}
          />
        </div>
      )}
    </div>
  );
}
