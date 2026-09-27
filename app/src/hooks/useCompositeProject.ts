import { useCallback, useRef, useState } from 'react';
import type {
  CompositeDocument,
  EditRegion,
  ObjectTransform,
  Page,
  UploadTier,
} from '../types';
import { regionBounds, clampPointToRegion } from '../lib/diptych';
import {
  createCompositeSnapshotCommand,
  CompositeHistory,
  snapshotFromDoc,
} from '../lib/compositeHistory';
import { createCompositeFromImage } from '../lib/compositeInit';
import {
  blobToImageData,
  buildHoleMaskAtTransform,
  cutHoleInBackground,
  extractLayerFromMask,
  imageDataToBlob,
  layerAlphaFromMaskBlob,
  renderCompositeToBlob,
} from '../lib/compositeOps';
import { inpaintInWorker, terminateInpaintWorker } from '../lib/inpaintClient';
import { mattingInWorker, terminateMattingWorker } from '../lib/mattingClient';
import { cropImageDataToBlob, cropRectAroundClick } from '../lib/mattingCrop';
import {
  alphaToMask,
  maskComponentAtClick,
  pasteCropMask,
  subtractPointsFromMask,
  validateMaskForCrowd,
} from '../lib/mattingMask';
import {
  newCompositeBlobId,
  newCompositeId,
  newLayerId,
} from '../lib/project';
import { classifyUploadTier, effectiveUploadTier } from '../lib/uploadTier';
import {
  deleteComposite,
  deleteCompositeBlob,
  imageObjectUrl,
  loadComposite,
  loadCompositeBlob,
  loadImage,
  saveComposite,
  saveCompositeBlob,
} from '../lib/storage';

export type CompositeMap = Record<string, CompositeDocument>;
export type CompositePreviewUrls = Record<string, string>;

const MATTING_CROP_SIZE = 512;

export function useCompositeProject(
  projectPages: Page[],
  updatePage: (pageId: string, patch: Partial<Page>) => void
) {
  const [composites, setComposites] = useState<CompositeMap>({});
  const [compositePreviewUrls, setCompositePreviewUrls] = useState<CompositePreviewUrls>({});
  const compositesRef = useRef<CompositeMap>({});
  const previewUrlsRef = useRef<CompositePreviewUrls>({});
  const compositeHistoryRef = useRef<Record<string, CompositeHistory>>({});
  const layerTransformBeginRef = useRef<Record<string, ObjectTransform>>({});
  const negativePointsRef = useRef<Record<string, { x: number; y: number }[]>>({});
  const compositeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setCompositeHistoryTick] = useState(0);
  const bumpCompositeHistory = useCallback(
    () => setCompositeHistoryTick((n) => n + 1),
    []
  );

  const getCompositeHistory = useCallback((pageId: string) => {
    if (!compositeHistoryRef.current[pageId]) {
      compositeHistoryRef.current[pageId] = new CompositeHistory();
    }
    return compositeHistoryRef.current[pageId];
  }, []);

  const refreshPreview = useCallback(async (compositeId: string, doc: CompositeDocument) => {
    const blob = await renderCompositeToBlob(
      (await loadCompositeBlob(doc.backgroundBlobId))!,
      doc.layers,
      (layer) => loadCompositeBlob(layer.spriteBlobId).then((b) => b!)
    );
    if (previewUrlsRef.current[compositeId]) {
      URL.revokeObjectURL(previewUrlsRef.current[compositeId]);
    }
    const url = imageObjectUrl(blob);
    previewUrlsRef.current[compositeId] = url;
    setCompositePreviewUrls({ ...previewUrlsRef.current });
  }, []);

  const applyComposite = useCallback(
    (pageId: string, doc: CompositeDocument, persist = true, refresh = true) => {
      const page = projectPages.find((p) => p.id === pageId);
      if (!page?.compositeId) return;
      compositesRef.current[page.compositeId] = doc;
      setComposites({ ...compositesRef.current });
      if (refresh) void refreshPreview(page.compositeId, doc);
      if (persist) {
        if (compositeSaveTimer.current) clearTimeout(compositeSaveTimer.current);
        compositeSaveTimer.current = setTimeout(() => {
          void saveComposite(page.compositeId!, doc);
        }, 300);
      }
    },
    [projectPages, refreshPreview]
  );

  const loadCompositesForPages = useCallback(async (pages: Page[]) => {
    const map: CompositeMap = {};
    for (const page of pages) {
      if (page.compositeId) {
        const doc = await loadComposite(page.compositeId);
        if (doc) map[page.compositeId] = doc;
      }
    }
    compositesRef.current = map;
    setComposites(map);
    for (const page of pages) {
      if (page.compositeId && map[page.compositeId]) {
        await refreshPreview(page.compositeId, map[page.compositeId]);
      }
    }
  }, [refreshPreview]);

  const clearCompositeAssets = useCallback(async (page: Page) => {
    if (page.compositeId) {
      const doc = compositesRef.current[page.compositeId] ?? (await loadComposite(page.compositeId));
      if (doc) {
        void deleteCompositeBlob(doc.backgroundBlobId);
        for (const layer of doc.layers) {
          void deleteCompositeBlob(layer.maskBlobId);
          void deleteCompositeBlob(layer.spriteBlobId);
        }
      }
      void deleteComposite(page.compositeId);
      delete compositesRef.current[page.compositeId];
      if (previewUrlsRef.current[page.compositeId]) {
        URL.revokeObjectURL(previewUrlsRef.current[page.compositeId]);
        delete previewUrlsRef.current[page.compositeId];
      }
      compositeHistoryRef.current[page.id]?.clear();
    }
  }, []);

  const initCompositeOnUpload = useCallback(
    async (pageId: string, file: Blob, tier: UploadTier) => {
      if (tier !== 'painterly') return;
      try {
        const { doc, backgroundBlob } = await createCompositeFromImage(file);
        await saveCompositeBlob(doc.backgroundBlobId, backgroundBlob);
        const compositeId = newCompositeId();
        await saveComposite(compositeId, doc);
        compositesRef.current[compositeId] = doc;
        setComposites({ ...compositesRef.current });
        await refreshPreview(compositeId, doc);
        updatePage(pageId, {
          compositeId,
          compositeStatus: 'ready',
          compositeError: undefined,
          uploadTier: tier,
          displayMode: 'raster',
          canvasMode: 'view',
          editRegion: doc.editRegion,
        });
      } catch (e) {
        updatePage(pageId, {
          compositeStatus: 'error',
          compositeError: e instanceof Error ? e.message : 'Composite init failed',
        });
        throw e;
      }
    },
    [refreshPreview, updatePage]
  );

  const classifyAndSetTier = useCallback(async (file: File) => {
    return classifyUploadTier(file);
  }, []);

  const compositeCanvasClick = useCallback(
    async (pageId: string, x: number, y: number, negative: boolean) => {
      const page = projectPages.find((p) => p.id === pageId);
      if (!page?.compositeId) return;
      const doc = compositesRef.current[page.compositeId];
      if (!doc) return;

      const bgBlob = await loadCompositeBlob(doc.backgroundBlobId);
      if (!bgBlob) return;
      const { data, width, height } = await blobToImageData(bgBlob);
      const region = regionBounds(page.editRegion, width, height, doc.splitX);
      const pt = clampPointToRegion(x, y, region);

      if (negative) {
        const list = negativePointsRef.current[pageId] ?? [];
        list.push(pt);
        negativePointsRef.current[pageId] = list;
        return;
      }

      updatePage(pageId, { editStage: 'segmenting', compositeStatus: 'ready', compositeError: undefined });
      try {
        const negatives = negativePointsRef.current[pageId] ?? [];
        negativePointsRef.current[pageId] = [];

        const cropRect = cropRectAroundClick(
          width,
          height,
          pt.x,
          pt.y,
          MATTING_CROP_SIZE,
          region
        );
        const cropBlob = await cropImageDataToBlob(data, width, height, cropRect);
        const mattingBlob = await mattingInWorker(cropBlob);
        const matting = await blobToImageData(mattingBlob);
        const cropMask = alphaToMask(matting.data, matting.width, matting.height);
        const localClickX = pt.x - cropRect.x0;
        const localClickY = pt.y - cropRect.y0;
        const component = maskComponentAtClick(
          cropMask,
          matting.width,
          matting.height,
          localClickX,
          localClickY
        );
        if (!component) throw new Error('No subject at click — try another spot');

        let mask = pasteCropMask(
          component,
          matting.width,
          matting.height,
          width,
          height,
          cropRect.x0,
          cropRect.y0
        );
        if (negatives.length > 0) {
          subtractPointsFromMask(mask, width, height, negatives, data);
        }
        validateMaskForCrowd(mask, width, height);

        const extracted = extractLayerFromMask(data, width, height, mask);
        if (!extracted) throw new Error('Selection too small');

        const before = snapshotFromDoc(doc);
        const maskBlobId = newCompositeBlobId();
        const spriteBlobId = newCompositeBlobId();
        await saveCompositeBlob(maskBlobId, await maskToBlob(extracted.layer, mask, width));
        await saveCompositeBlob(
          spriteBlobId,
          await imageDataToBlob(extracted.sprite, extracted.layer.width, extracted.layer.height)
        );

        const layer = {
          ...extracted.layer,
          id: newLayerId(),
          maskBlobId,
          spriteBlobId,
          zIndex: doc.layers.length + 1,
          label: `Layer ${doc.layers.length + 1}`,
        };

        const newBg = await cutHoleInBackground(bgBlob, extracted.holeMask);
        const newBgId = newCompositeBlobId();
        await saveCompositeBlob(newBgId, newBg);

        const next: CompositeDocument = {
          ...doc,
          backgroundBlobId: newBgId,
          layers: [...doc.layers, layer],
        };

        const after = snapshotFromDoc(next);
        getCompositeHistory(pageId).push(
          createCompositeSnapshotCommand(before, after, 'Add layer')
        );
        bumpCompositeHistory();
        applyComposite(pageId, next);
        updatePage(pageId, { selectedLayerId: layer.id, editStage: null, compositeStatus: 'ready' });
      } catch (e) {
        updatePage(pageId, {
          editStage: null,
          compositeStatus: 'error',
          compositeError: e instanceof Error ? e.message : 'Cutout failed',
        });
        throw e;
      }
    },
    [
      projectPages,
      updatePage,
      getCompositeHistory,
      bumpCompositeHistory,
      applyComposite,
    ]
  );

  const beginLayerTransform = useCallback(
    (pageId: string, layerId: string) => {
      const page = projectPages.find((p) => p.id === pageId);
      if (!page?.compositeId) return;
      const doc = compositesRef.current[page.compositeId];
      const layer = doc?.layers.find((l) => l.id === layerId);
      if (layer) {
        layerTransformBeginRef.current[`${pageId}:${layerId}`] = { ...layer.transform };
      }
    },
    [projectPages]
  );

  const updateLayerTransform = useCallback(
    (pageId: string, layerId: string, patch: Partial<ObjectTransform>) => {
      const page = projectPages.find((p) => p.id === pageId);
      if (!page?.compositeId) return;
      const doc = compositesRef.current[page.compositeId];
      if (!doc) return;
      const layers = doc.layers.map((l) =>
        l.id === layerId ? { ...l, transform: { ...l.transform, ...patch } } : l
      );
      compositesRef.current[page.compositeId] = { ...doc, layers };
      setComposites({ ...compositesRef.current });
    },
    [projectPages]
  );

  const commitLayerTransform = useCallback(
    async (pageId: string, layerId: string) => {
      const key = `${pageId}:${layerId}`;
      const beforeT = layerTransformBeginRef.current[key];
      delete layerTransformBeginRef.current[key];
      const page = projectPages.find((p) => p.id === pageId);
      if (!page?.compositeId || !beforeT) return;
      const doc = compositesRef.current[page.compositeId];
      const layer = doc?.layers.find((l) => l.id === layerId);
      if (!doc || !layer) return;

      const moved =
        beforeT.tx !== layer.transform.tx || beforeT.ty !== layer.transform.ty;
      if (!moved) {
        applyComposite(pageId, doc, true, true);
        return;
      }

      updatePage(pageId, { editStage: 'inpainting' });
      try {
        const maskBlob = await loadCompositeBlob(layer.maskBlobId);
        if (!maskBlob) return;
        const layerAlpha = await layerAlphaFromMaskBlob(maskBlob);
        const bgBlob = await loadCompositeBlob(doc.backgroundBlobId);
        if (!bgBlob) return;
        const { width, height } = await blobToImageData(bgBlob);
        const holeMask = buildHoleMaskAtTransform(
          layer,
          layerAlpha,
          width,
          height,
          beforeT.tx,
          beforeT.ty
        );

        const before = snapshotFromDoc(doc);
        const { data } = await blobToImageData(bgBlob);
        const filled = await inpaintInWorker(data, width, height, holeMask);
        const newBgId = newCompositeBlobId();
        await saveCompositeBlob(newBgId, await imageDataToBlob(filled, width, height));

        const next: CompositeDocument = { ...doc, backgroundBlobId: newBgId };
        const after = snapshotFromDoc(next);
        getCompositeHistory(pageId).push(
          createCompositeSnapshotCommand(before, after, 'Move layer')
        );
        bumpCompositeHistory();
        applyComposite(pageId, next);
        updatePage(pageId, { compositeStatus: 'ready', compositeError: undefined });
      } catch (e) {
        updatePage(pageId, {
          compositeStatus: 'error',
          compositeError: e instanceof Error ? e.message : 'Inpaint failed',
        });
        throw e;
      } finally {
        updatePage(pageId, { editStage: null });
      }
    },
    [
      projectPages,
      updatePage,
      getCompositeHistory,
      bumpCompositeHistory,
      applyComposite,
    ]
  );

  const undoComposite = useCallback(
    (pageId: string) => {
      const page = projectPages.find((p) => p.id === pageId);
      if (!page?.compositeId) return;
      const doc = compositesRef.current[page.compositeId];
      if (!doc) return;
      const history = getCompositeHistory(pageId);
      if (!history.canUndo()) return;
      applyComposite(pageId, history.undo(doc));
      bumpCompositeHistory();
    },
    [projectPages, getCompositeHistory, applyComposite, bumpCompositeHistory]
  );

  const redoComposite = useCallback(
    (pageId: string) => {
      const page = projectPages.find((p) => p.id === pageId);
      if (!page?.compositeId) return;
      const doc = compositesRef.current[page.compositeId];
      if (!doc) return;
      const history = getCompositeHistory(pageId);
      if (!history.canRedo()) return;
      applyComposite(pageId, history.redo(doc));
      bumpCompositeHistory();
    },
    [projectPages, getCompositeHistory, applyComposite, bumpCompositeHistory]
  );

  const canUndoComposite = useCallback(
    (pageId: string) => getCompositeHistory(pageId).canUndo(),
    [getCompositeHistory]
  );

  const canRedoComposite = useCallback(
    (pageId: string) => getCompositeHistory(pageId).canRedo(),
    [getCompositeHistory]
  );

  const setEditRegion = useCallback(
    (pageId: string, region: EditRegion) => {
      updatePage(pageId, { editRegion: region });
    },
    [updatePage]
  );

  const setUploadTierOverride = useCallback(
    async (pageId: string, tier: UploadTier | null) => {
      const page = projectPages.find((p) => p.id === pageId);
      if (!page) return;
      const effective = tier ?? page.uploadTier;
      if (effective !== 'painterly' && page.compositeId) {
        await clearCompositeAssets(page);
        updatePage(pageId, {
          uploadTierOverride: tier,
          compositeId: null,
          compositeStatus: 'none',
          compositeError: undefined,
          canvasMode: 'view',
        });
        return;
      }
      updatePage(pageId, { uploadTierOverride: tier });
      if (effective === 'painterly' && !page.compositeId && page.imageId) {
        const blob = await loadImage(page.imageId);
        if (blob) await initCompositeOnUpload(pageId, blob, 'painterly');
      }
    },
    [projectPages, updatePage, initCompositeOnUpload, clearCompositeAssets]
  );

  const getEffectiveTier = useCallback((page: Page): UploadTier => {
    return effectiveUploadTier(page.uploadTier, page.uploadTierOverride);
  }, []);

  const getFlattenedBlob = useCallback(async (page: Page): Promise<Blob | null> => {
    if (!page.compositeId) return null;
    const doc = compositesRef.current[page.compositeId];
    if (!doc) return null;
    return renderCompositeToBlob(
      (await loadCompositeBlob(doc.backgroundBlobId))!,
      doc.layers,
      (layer) => loadCompositeBlob(layer.spriteBlobId).then((b) => b!)
    );
  }, []);

  return {
    composites,
    compositePreviewUrls,
    compositesRef,
    previewUrlsRef,
    loadCompositesForPages,
    clearCompositeAssets,
    initCompositeOnUpload,
    classifyAndSetTier,
    compositeCanvasClick,
    beginLayerTransform,
    updateLayerTransform,
    commitLayerTransform,
    undoComposite,
    redoComposite,
    canUndoComposite,
    canRedoComposite,
    setEditRegion,
    setUploadTierOverride,
    getEffectiveTier,
    getFlattenedBlob,
    terminateMattingWorker,
    terminateInpaintWorker,
  };
}

async function maskToBlob(
  layer: { originX: number; originY: number; width: number; height: number },
  fullMask: Uint8Array,
  canvasWidth: number
): Promise<Blob> {
  const data = new Uint8ClampedArray(layer.width * layer.height * 4);
  for (let y = 0; y < layer.height; y++) {
    for (let x = 0; x < layer.width; x++) {
      const fx = layer.originX + x;
      const fy = layer.originY + y;
      const mi = fy * canvasWidth + fx;
      const alpha = fullMask[mi] ?? 0;
      const pi = (y * layer.width + x) * 4;
      data[pi] = 255;
      data[pi + 1] = 255;
      data[pi + 2] = 255;
      data[pi + 3] = alpha;
    }
  }
  return imageDataToBlob(data, layer.width, layer.height);
}