import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasMode, CompositeDocument, CompositeLayer, EditRegion } from '../types';
import { loadCompositeBlob } from '../lib/storage';

type EditableCompositeProps = {
  composite: CompositeDocument;
  mode: CanvasMode;
  selectedLayerId: string | null;
  editRegion: EditRegion;
  onCanvasClick: (x: number, y: number, negative: boolean) => void;
  onSelectLayer: (layerId: string | null) => void;
  onUpdateTransform: (layerId: string, patch: { tx?: number; ty?: number }) => void;
  onTransformBegin: (layerId: string) => void;
  onTransformEnd: (layerId: string) => void;
  segmentPending?: boolean;
};

type DragState = {
  layerId: string;
  startX: number;
  startY: number;
  origTx: number;
  origTy: number;
};

function clientToCanvas(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export function EditableComposite({
  composite,
  mode,
  selectedLayerId,
  editRegion,
  onCanvasClick,
  onSelectLayer,
  onUpdateTransform,
  onTransformBegin,
  onTransformEnd,
  segmentPending,
}: EditableCompositeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spritesRef = useRef<Map<string, ImageBitmap>>(new Map());
  const alphaRef = useRef<Map<string, Uint8Array>>(new Map());
  const bgRef = useRef<ImageBitmap | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragTransformRef = useRef<{ layerId: string; tx: number; ty: number } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const getLayerTransform = useCallback(
    (layer: CompositeLayer) => {
      const drag = dragTransformRef.current;
      if (drag && drag.layerId === layer.id) {
        return { ...layer.transform, tx: drag.tx, ty: drag.ty };
      }
      return layer.transform;
    },
    []
  );

  const redraw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = composite.width;
    canvas.height = composite.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!bgRef.current || bgRef.current.width !== composite.width) {
      bgRef.current?.close();
      bgRef.current = null;
      const blob = await loadCompositeBlob(composite.backgroundBlobId);
      if (blob) bgRef.current = await createImageBitmap(blob);
    }
    if (bgRef.current) ctx.drawImage(bgRef.current, 0, 0);

    for (const layer of [...composite.layers].sort((a, b) => a.zIndex - b.zIndex)) {
      let bmp = spritesRef.current.get(layer.spriteBlobId);
      if (!bmp) {
        const blob = await loadCompositeBlob(layer.spriteBlobId);
        if (blob) {
          bmp = await createImageBitmap(blob);
          spritesRef.current.set(layer.spriteBlobId, bmp);
          const { data } = await readAlpha(blob);
          alphaRef.current.set(layer.spriteBlobId, data);
        }
      }
      if (!bmp) continue;
      const { tx, ty, scale } = getLayerTransform(layer);
      ctx.save();
      ctx.translate(layer.originX + tx, layer.originY + ty);
      ctx.scale(scale, scale);
      ctx.drawImage(bmp, 0, 0);
      ctx.restore();
      if (layer.id === selectedLayerId && mode === 'edit') {
        ctx.strokeStyle = '#e07a5f';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          layer.originX + tx - 2,
          layer.originY + ty - 2,
          layer.width * scale + 4,
          layer.height * scale + 4
        );
      }
    }

    if (composite.splitX != null && mode === 'edit') {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(composite.splitX, 0);
      ctx.lineTo(composite.splitX, composite.height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [composite, selectedLayerId, mode, getLayerTransform]);

  useEffect(() => {
    spritesRef.current.forEach((b) => b.close());
    spritesRef.current.clear();
    alphaRef.current.clear();
    bgRef.current?.close();
    bgRef.current = null;
    void redraw();
  }, [composite.backgroundBlobId, composite.layers, redraw]);

  useEffect(() => {
    void redraw();
  }, [selectedLayerId, mode, redraw]);

  useEffect(() => {
    if (!drag) return;
    const { layerId, origTx, origTy, startX, startY } = drag;
    function onMove(e: PointerEvent) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pt = clientToCanvas(canvas, e.clientX, e.clientY);
      const tx = origTx + (pt.x - startX);
      const ty = origTy + (pt.y - startY);
      dragTransformRef.current = { layerId, tx, ty };
      void redraw();
    }
    function onUp() {
      const d = dragTransformRef.current;
      if (d) onUpdateTransform(layerId, { tx: d.tx, ty: d.ty });
      dragTransformRef.current = null;
      dragRef.current = null;
      setDrag(null);
      onTransformEnd(layerId);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, onUpdateTransform, onTransformEnd, redraw]);

  function hitTestLayer(x: number, y: number): CompositeLayer | null {
    const sorted = [...composite.layers].sort((a, b) => b.zIndex - a.zIndex);
    for (const layer of sorted) {
      const { tx, ty, scale } = getLayerTransform(layer);
      const lx = Math.floor(x - (layer.originX + tx));
      const ly = Math.floor(y - (layer.originY + ty));
      if (lx < 0 || ly < 0 || lx >= layer.width * scale || ly >= layer.height * scale) {
        continue;
      }
      const sx = Math.min(layer.width - 1, Math.floor(lx / scale));
      const sy = Math.min(layer.height - 1, Math.floor(ly / scale));
      const alpha = alphaRef.current.get(layer.spriteBlobId);
      if (alpha) {
        const ai = sy * layer.width + sx;
        if (alpha[ai] < 32) continue;
      }
      return layer;
    }
    return null;
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (mode !== 'edit') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pt = clientToCanvas(canvas, e.clientX, e.clientY);
    const hit = hitTestLayer(pt.x, pt.y);
    if (hit) {
      onSelectLayer(hit.id);
      onTransformBegin(hit.id);
      dragRef.current = {
        layerId: hit.id,
        startX: pt.x,
        startY: pt.y,
        origTx: hit.transform.tx,
        origTy: hit.transform.ty,
      };
      dragTransformRef.current = {
        layerId: hit.id,
        tx: hit.transform.tx,
        ty: hit.transform.ty,
      };
      setDrag(dragRef.current);
      e.preventDefault();
      return;
    }
    onCanvasClick(pt.x, pt.y, e.shiftKey);
  }

  return (
    <div className={`composite-wrap${mode === 'edit' ? ' composite-edit' : ''}`}>
      {mode === 'edit' && (
        <div className="composite-toolbar">
          <span className="muted">
            {editRegion === 'left'
              ? 'Editing left scene'
              : editRegion === 'right'
                ? 'Editing right scene'
                : 'Editing full page'}
          </span>
          <span className="muted">Click a character to extract (AI cutout)</span>
          {segmentPending && <span className="muted">Extracting…</span>}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`composite-canvas${drag ? ' is-dragging' : ''}`}
        onPointerDown={handlePointerDown}
      />
    </div>
  );
}

async function readAlpha(blob: Blob): Promise<{ data: Uint8Array; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return { data: new Uint8Array(0), width: 0, height: 0 };
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < data.length; i++) {
    data[i] = img.data[i * 4 + 3];
  }
  return { data, width: canvas.width, height: canvas.height };
}
