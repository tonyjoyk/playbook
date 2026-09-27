import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type {
  CanvasMode,
  DisplayMode,
  EditRegion,
  InspectorTab,
  ObjectTransform,
  Page,
  Project,
  SceneDocument,
  UploadTier,
  VectorizeStage,
} from '../types';
import { compileSceneFromSvg } from '../lib/sceneCompiler';
import {
  createGroupCommand,
  createReorderCommand,
  createTransformCommand,
  createUngroupCommand,
  newManualGroupId,
  SceneHistory,
} from '../lib/sceneHistory';
import { prepareImageForTrace } from '../lib/imagePrep';
import {
  createBlankPage,
  createDefaultProject,
  ensurePageCount,
  fitPageCount,
  generatedImageKey,
  newImageId,
  newSceneId,
  newVectorId,
  normalizeCast,
} from '../lib/project';
import { isGeneratedArtStyleId } from '../lib/prompts';
import {
  checkGenerationHealth,
  requestIllustration,
  requestStory,
} from '../lib/generationClient';
import {
  deleteImage,
  deleteScene,
  deleteSvg,
  imageObjectUrl,
  isStorySetupSeenThisSession,
  loadImage,
  loadProject,
  loadScene,
  loadSvg,
  markStorySetupSeen,
  saveImage,
  saveProject,
  saveScene,
  saveSvg,
  svgObjectUrl,
} from '../lib/storage';
import { terminateTraceWorker, traceInWorker } from '../lib/vtracerClient';
import {
  useCompositeProject,
  type CompositeMap,
  type CompositePreviewUrls,
} from './useCompositeProject';

export type GenerationResult = { ok: true } | { ok: false; message: string };

export type GenerationStatus =
  | { phase: 'idle' }
  | { phase: 'story' }
  | { phase: 'illustration'; pageNumber: number; total: number }
  | { phase: 'error'; message: string; pageIndex: number | null };

export type ImageUrls = Record<string, string>;
export type VectorUrls = Record<string, string>;
export type SceneMap = Record<string, SceneDocument>;
export type { CompositeMap, CompositePreviewUrls };

export type UseProjectReturn = {
  project: Project;
  setProject: Dispatch<SetStateAction<Project>>;
  activePageIndex: number;
  setActivePageIndex: (index: number) => void;
  activePage: Page;
  inspectorTab: InspectorTab;
  setInspectorTab: (tab: InspectorTab) => void;
  imageUrls: ImageUrls;
  vectorUrls: VectorUrls;
  scenes: SceneMap;
  vectorizeStage: VectorizeStage | null;
  storyModalOpen: boolean;
  setStoryModalOpen: (open: boolean) => void;
  styleModalOpen: boolean;
  setStyleModalOpen: (open: boolean) => void;
  rasterLightboxUrl: string | null;
  setRasterLightboxUrl: (url: string | null) => void;
  updatePage: (pageId: string, patch: Partial<Page>) => void;
  addPage: () => void;
  deletePage: (pageId: string) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  seedPagesToBreakdownCount: () => void;
  uploadPageImage: (pageId: string, file: File) => Promise<void>;
  vectorizePage: (pageId: string) => Promise<void>;
  cancelVectorize: () => void;
  setDisplayMode: (pageId: string, mode: DisplayMode) => void;
  setCanvasMode: (pageId: string, mode: CanvasMode) => void;
  setSelectedObject: (pageId: string, objectId: string | null) => void;
  toggleLayerSelection: (
    pageId: string,
    objectId: string,
    extend: boolean
  ) => void;
  updateObjectTransform: (
    pageId: string,
    objectId: string,
    patch: Partial<ObjectTransform>
  ) => void;
  beginObjectTransform: (pageId: string, objectId: string) => void;
  commitObjectTransform: (pageId: string, objectId: string) => void;
  undoScene: (pageId: string) => void;
  redoScene: (pageId: string) => void;
  canUndoScene: (pageId: string) => boolean;
  canRedoScene: (pageId: string) => boolean;
  groupSelectedObjects: (pageId: string) => void;
  ungroupObject: (pageId: string, objectId: string) => void;
  reorderObjectLayer: (
    pageId: string,
    objectId: string,
    direction: 'forward' | 'back'
  ) => void;
  composites: CompositeMap;
  compositePreviewUrls: CompositePreviewUrls;
  getEffectiveTier: (page: Page) => UploadTier;
  setUploadTierOverride: (pageId: string, tier: UploadTier | null) => void;
  setEditRegion: (pageId: string, region: EditRegion) => void;
  compositeCanvasClick: (pageId: string, x: number, y: number, negative: boolean) => Promise<void>;
  beginLayerTransform: (pageId: string, layerId: string) => void;
  updateLayerTransform: (
    pageId: string,
    layerId: string,
    patch: Partial<ObjectTransform>
  ) => void;
  commitLayerTransform: (pageId: string, layerId: string) => void;
  undoComposite: (pageId: string) => void;
  redoComposite: (pageId: string) => void;
  canUndoComposite: (pageId: string) => boolean;
  canRedoComposite: (pageId: string) => boolean;
  getFlattenedBlob: (page: Page) => Promise<Blob | null>;
  markExported: () => void;
  generationStatus: GenerationStatus;
  generateStory: () => Promise<GenerationResult>;
  retryIllustration: (pageIndex: number) => Promise<GenerationResult>;
};

function base64ToPng(imageBase64: string): Blob {
  const binary = atob(imageBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read the picture.'));
        return;
      }
      const comma = reader.result.indexOf(',');
      resolve(comma >= 0 ? reader.result.slice(comma + 1) : reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the picture.'));
    reader.readAsDataURL(blob);
  });
}

function persistProject(project: Project): Project {
  const updated = { ...project, updatedAt: new Date().toISOString() };
  saveProject(updated);
  return updated;
}

function clearPageAssets(
  page: Page,
  imageUrls: ImageUrls,
  vectorUrls: VectorUrls,
  sceneMap: SceneMap
): void {
  if (page.vectorId) {
    void deleteSvg(page.vectorId);
    if (vectorUrls[page.vectorId]) {
      URL.revokeObjectURL(vectorUrls[page.vectorId]);
      delete vectorUrls[page.vectorId];
    }
  }
  if (page.sceneId) {
    void deleteScene(page.sceneId);
    delete sceneMap[page.sceneId];
  }
  if (page.imageId && imageUrls[page.imageId]) {
    URL.revokeObjectURL(imageUrls[page.imageId]);
    void deleteImage(page.imageId);
    delete imageUrls[page.imageId];
  }
}

export function useProject(): UseProjectReturn {
  const [project, setProjectState] = useState<Project>(() => {
    return loadProject() ?? createDefaultProject();
  });
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [inspectorTab, setInspectorTabState] = useState<InspectorTab>('words');
  const [imageUrls, setImageUrls] = useState<ImageUrls>({});
  const [vectorUrls, setVectorUrls] = useState<VectorUrls>({});
  const [scenes, setScenes] = useState<SceneMap>({});
  const [vectorizeStage, setVectorizeStage] = useState<VectorizeStage | null>(null);
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({ phase: 'idle' });
  const projectRef = useRef(project);
  const generationLock = useRef(false);
  useEffect(() => {
    if (!generationLock.current) projectRef.current = project;
  }, [project]);
  const [styleModalOpen, setStyleModalOpen] = useState(false);
  const [rasterLightboxUrl, setRasterLightboxUrl] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageUrlsRef = useRef<ImageUrls>({});
  const vectorUrlsRef = useRef<VectorUrls>({});
  const scenesRef = useRef<SceneMap>({});
  const abortRef = useRef<AbortController | null>(null);
  const sceneSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<Record<string, SceneHistory>>({});
  const transformBeginRef = useRef<Record<string, ObjectTransform>>({});
  const [, setHistoryTick] = useState(0);

  const bumpHistory = useCallback(() => setHistoryTick((n) => n + 1), []);

  const getHistory = useCallback((pageId: string) => {
    if (!historyRef.current[pageId]) {
      historyRef.current[pageId] = new SceneHistory();
    }
    return historyRef.current[pageId];
  }, []);

  const applyScene = useCallback(
    (pageId: string, scene: SceneDocument, persist = true) => {
      const page = project.pages.find((p) => p.id === pageId);
      if (!page?.sceneId) return;
      scenesRef.current[page.sceneId] = scene;
      setScenes({ ...scenesRef.current });
      if (persist) {
        if (sceneSaveTimer.current) clearTimeout(sceneSaveTimer.current);
        sceneSaveTimer.current = setTimeout(() => {
          void saveScene(page.sceneId!, scene);
        }, 300);
      }
    },
    [project.pages]
  );

  const setProject: Dispatch<SetStateAction<Project>> = useCallback((action) => {
    setProjectState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveProject(next), 500);
      return next;
    });
  }, []);

  const updatePage = useCallback(
    (pageId: string, patch: Partial<Page>) => {
      setProject((p) =>
        persistProject({
          ...p,
          pages: p.pages.map((page) =>
            page.id === pageId ? { ...page, ...patch } : page
          ),
        })
      );
    },
    [setProject]
  );

  const composite = useCompositeProject(project.pages, updatePage);

  useEffect(() => {
    const shouldOpen =
      !project.theme.trim() && !isStorySetupSeenThisSession();
    if (shouldOpen) setStoryModalOpen(true);
  }, [project.theme]);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      const imgs: ImageUrls = {};
      const vecs: VectorUrls = {};
      const scns: SceneMap = {};
      for (const page of project.pages) {
        if (page.imageId) {
          const blob = await loadImage(page.imageId);
          if (blob && !cancelled) imgs[page.imageId] = imageObjectUrl(blob);
        }
        if (page.vectorId) {
          const svg = await loadSvg(page.vectorId);
          if (svg && !cancelled) vecs[page.vectorId] = svgObjectUrl(svg);
        }
        if (page.sceneId) {
          const scene = await loadScene(page.sceneId);
          if (scene && !cancelled) scns[page.sceneId] = scene;
        }
      }
      if (!cancelled) {
        await composite.loadCompositesForPages(project.pages);
        Object.values(imageUrlsRef.current).forEach(URL.revokeObjectURL);
        Object.values(vectorUrlsRef.current).forEach(URL.revokeObjectURL);
        imageUrlsRef.current = imgs;
        vectorUrlsRef.current = vecs;
        scenesRef.current = scns;
        setImageUrls(imgs);
        setVectorUrls(vecs);
        setScenes(scns);
      }
    }
    loadAll();
    return () => {
      cancelled = true;
    };
  }, [project.pages, composite.loadCompositesForPages]);

  useEffect(() => {
    return () => {
      Object.values(imageUrlsRef.current).forEach(URL.revokeObjectURL);
      Object.values(vectorUrlsRef.current).forEach(URL.revokeObjectURL);
      Object.values(composite.previewUrlsRef.current).forEach(URL.revokeObjectURL);
      terminateTraceWorker();
      composite.terminateMattingWorker();
      composite.terminateInpaintWorker();
    };
  }, []);

  const activePage = project.pages[activePageIndex] ?? project.pages[0];

  const setInspectorTab = useCallback(
    (tab: InspectorTab) => {
      setInspectorTabState(tab);
      if (tab === 'art' && !project.hasViewedIllustrationTab) {
        setProject((p) => ({ ...p, hasViewedIllustrationTab: true }));
      }
    },
    [project.hasViewedIllustrationTab, setProject]
  );

  const addPage = useCallback(() => {
    setProject((p) => {
      const pages = [...p.pages, createBlankPage()];
      setActivePageIndex(pages.length - 1);
      return persistProject({ ...p, pages });
    });
  }, [setProject]);

  const deletePage = useCallback(
    (pageId: string) => {
      setProject((p) => {
        if (p.pages.length <= 1) return p;
        const idx = p.pages.findIndex((pg) => pg.id === pageId);
        const removed = p.pages[idx];
        if (removed) {
          clearPageAssets(removed, imageUrlsRef.current, vectorUrlsRef.current, scenesRef.current);
          void composite.clearCompositeAssets(removed);
        }
        const pages = p.pages.filter((pg) => pg.id !== pageId);
        setActivePageIndex(Math.max(0, Math.min(activePageIndex, pages.length - 1)));
        setImageUrls({ ...imageUrlsRef.current });
        setVectorUrls({ ...vectorUrlsRef.current });
        setScenes({ ...scenesRef.current });
        return persistProject({ ...p, pages });
      });
    },
    [activePageIndex, setProject]
  );

  const reorderPages = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      setProject((p) => {
        const pages = [...p.pages];
        const [moved] = pages.splice(fromIndex, 1);
        pages.splice(toIndex, 0, moved);
        if (activePageIndex === fromIndex) setActivePageIndex(toIndex);
        else if (fromIndex < activePageIndex && toIndex >= activePageIndex) {
          setActivePageIndex(activePageIndex - 1);
        } else if (fromIndex > activePageIndex && toIndex <= activePageIndex) {
          setActivePageIndex(activePageIndex + 1);
        }
        return persistProject({ ...p, pages });
      });
    },
    [activePageIndex, setProject]
  );

  const seedPagesToBreakdownCount = useCallback(() => {
    setProject((p) => persistProject(ensurePageCount(p, p.breakdownPageCount)));
  }, [setProject]);

  const uploadPageImage = useCallback(
    async (pageId: string, file: File) => {
      const type = file.type.toLowerCase();
      if (type !== 'image/png' && type !== 'image/jpeg' && type !== 'image/jpg') {
        throw new Error('Please upload a PNG or JPG image.');
      }
      const tier = await composite.classifyAndSetTier(file);
      const imageId = newImageId();
      await saveImage(imageId, file);
      const url = imageObjectUrl(file);

      setProject((p) => {
        const page = p.pages.find((pg) => pg.id === pageId);
        if (page) {
          clearPageAssets(page, imageUrlsRef.current, vectorUrlsRef.current, scenesRef.current);
          void composite.clearCompositeAssets(page);
        }
        return persistProject({
          ...p,
          pages: p.pages.map((pg) =>
            pg.id === pageId
              ? {
                  ...pg,
                  imageId,
                  vectorId: null,
                  vectorStatus: 'none',
                  vectorError: undefined,
                  displayMode: 'raster',
                  sceneId: null,
                  sceneStatus: 'none',
                  sceneError: undefined,
                  canvasMode: 'view',
                  selectedObjectId: null,
                  selectedObjectIds: [],
                  uploadTier: tier,
                  uploadTierOverride: null,
                  compositeId: null,
                  compositeStatus: 'none',
                  compositeError: undefined,
                  editRegion: 'full',
                  selectedLayerId: null,
                  editStage: null,
                }
              : pg
          ),
        });
      });

      imageUrlsRef.current[imageId] = url;
      setImageUrls({ ...imageUrlsRef.current });
      setVectorUrls({ ...vectorUrlsRef.current });
      setScenes({ ...scenesRef.current });

      if (tier === 'painterly') {
        await composite.initCompositeOnUpload(pageId, file, tier);
      }
    },
    [setProject, composite]
  );

  const cancelVectorize = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    terminateTraceWorker();
    setVectorizeStage(null);
    setProject((p) =>
      persistProject({
        ...p,
        pages: p.pages.map((pg) =>
          pg.vectorStatus === 'running'
            ? { ...pg, vectorStatus: 'none', vectorError: undefined }
            : pg
        ),
      })
    );
  }, [setProject]);

  const vectorizePage = useCallback(
    async (pageId: string) => {
      const page = project.pages.find((p) => p.id === pageId);
      if (!page?.imageId) throw new Error('Upload an image first.');

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setProject((p) =>
        persistProject({
          ...p,
          pages: p.pages.map((pg) =>
            pg.id === pageId
              ? {
                  ...pg,
                  vectorStatus: 'running',
                  vectorError: undefined,
                  sceneStatus: 'none',
                  sceneError: undefined,
                }
              : pg
          ),
        })
      );

      try {
        const blob = await loadImage(page.imageId);
        if (!blob) throw new Error('Image not found.');

        setVectorizeStage('preparing');
        const prepared = await prepareImageForTrace(blob);
        const pixels = new Uint8ClampedArray(prepared.pixels);

        setVectorizeStage('tracing');
        const { rawSvg, sceneSvg, objectCount, traceMs } = await traceInWorker(
          pixels,
          prepared.width,
          prepared.height,
          ac.signal
        );

        setVectorizeStage('finishing');
        const vectorId = newVectorId();
        await saveSvg(vectorId, rawSvg);
        const url = svgObjectUrl(rawSvg);

        if (page.vectorId) {
          void deleteSvg(page.vectorId);
          if (vectorUrlsRef.current[page.vectorId]) {
            URL.revokeObjectURL(vectorUrlsRef.current[page.vectorId]);
            delete vectorUrlsRef.current[page.vectorId];
          }
        }
        if (page.sceneId) {
          void deleteScene(page.sceneId);
          delete scenesRef.current[page.sceneId];
        }

        vectorUrlsRef.current[vectorId] = url;
        getHistory(pageId).clear();
        bumpHistory();

        const sceneId = newSceneId();
        let sceneDoc: SceneDocument;
        try {
          sceneDoc = compileSceneFromSvg(sceneSvg, true);
          await saveScene(sceneId, sceneDoc);
          scenesRef.current[sceneId] = sceneDoc;
        } catch (compileErr) {
          const msg =
            compileErr instanceof Error ? compileErr.message : 'Scene compile failed';
          setVectorizeStage(null);
          setProject((p) =>
            persistProject({
              ...p,
              pages: p.pages.map((pg) =>
                pg.id === pageId
                  ? {
                      ...pg,
                      vectorId,
                      vectorStatus: 'done',
                      displayMode: 'vector',
                      vectorError: undefined,
                      sceneId: null,
                      sceneStatus: 'error',
                      sceneError: msg,
                    }
                  : pg
              ),
            })
          );
          setVectorUrls({ ...vectorUrlsRef.current });
          throw new Error(msg);
        }

        setVectorUrls({ ...vectorUrlsRef.current });
        setScenes({ ...scenesRef.current });

        setProject((p) =>
          persistProject({
            ...p,
            pages: p.pages.map((pg) =>
              pg.id === pageId
                ? {
                    ...pg,
                    vectorId,
                    vectorStatus: 'done',
                    displayMode: 'vector',
                    vectorError: undefined,
                    sceneId,
                    sceneStatus: 'ready',
                    sceneError: undefined,
                    canvasMode: 'view',
                    selectedObjectId: null,
                    selectedObjectIds: [],
                  }
                : pg
            ),
          })
        );

        const rawPathCount = (rawSvg.match(/<path/g) ?? []).length;
        console.info('[playbook-pal] page vectorized', {
          pageId,
          rawPathCount,
          objectCount,
          traceMs,
          width: prepared.width,
          height: prepared.height,
        });
        if (objectCount > 120) {
          console.warn('[playbook-pal] high object count', { objectCount, pageId });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Vectorize failed';
        if (msg === 'Cancelled') {
          setVectorizeStage(null);
          setProject((p) =>
            persistProject({
              ...p,
              pages: p.pages.map((pg) =>
                pg.id === pageId
                  ? { ...pg, vectorStatus: 'none', vectorError: undefined }
                  : pg
              ),
            })
          );
          return;
        }
        setVectorizeStage(null);
        setProject((p) =>
          persistProject({
            ...p,
            pages: p.pages.map((pg) =>
              pg.id === pageId
                ? { ...pg, vectorStatus: 'error', vectorError: msg }
                : pg
            ),
          })
        );
        throw err;
      } finally {
        setVectorizeStage(null);
        if (abortRef.current === ac) abortRef.current = null;
      }
    },
    [project.pages, setProject, getHistory, bumpHistory]
  );

  const setDisplayMode = useCallback(
    (pageId: string, mode: DisplayMode) => {
      updatePage(pageId, { displayMode: mode });
    },
    [updatePage]
  );

  const setCanvasMode = useCallback(
    (pageId: string, mode: CanvasMode) => {
      updatePage(pageId, {
        canvasMode: mode,
        ...(mode === 'view'
          ? { selectedObjectId: null, selectedObjectIds: [] }
          : {}),
      });
    },
    [updatePage]
  );

  const setSelectedObject = useCallback(
    (pageId: string, objectId: string | null) => {
      updatePage(pageId, {
        selectedObjectId: objectId,
        selectedObjectIds: objectId ? [objectId] : [],
      });
    },
    [updatePage]
  );

  const toggleLayerSelection = useCallback(
    (pageId: string, objectId: string, extend: boolean) => {
      const page = project.pages.find((p) => p.id === pageId);
      if (!page) return;
      if (!extend) {
        updatePage(pageId, {
          selectedObjectId: objectId,
          selectedObjectIds: [objectId],
        });
        return;
      }
      const current = page.selectedObjectIds?.length
        ? page.selectedObjectIds
        : page.selectedObjectId
          ? [page.selectedObjectId]
          : [];
      const has = current.includes(objectId);
      const next = has
        ? current.filter((id) => id !== objectId)
        : [...current, objectId];
      updatePage(pageId, {
        selectedObjectIds: next,
        selectedObjectId: next.length === 1 ? next[0] : next[0] ?? null,
      });
    },
    [project.pages, updatePage]
  );

  const updateObjectTransform = useCallback(
    (pageId: string, objectId: string, patch: Partial<ObjectTransform>) => {
      const page = project.pages.find((p) => p.id === pageId);
      if (!page?.sceneId) return;
      const scene = scenesRef.current[page.sceneId];
      if (!scene) return;
      const objects = scene.objects.map((obj) =>
        obj.id === objectId
          ? { ...obj, transform: { ...obj.transform, ...patch } }
          : obj
      );
      applyScene(pageId, { ...scene, objects }, false);
    },
    [project.pages, applyScene]
  );

  const beginObjectTransform = useCallback(
    (pageId: string, objectId: string) => {
      const page = project.pages.find((p) => p.id === pageId);
      if (!page?.sceneId) return;
      const scene = scenesRef.current[page.sceneId];
      const obj = scene?.objects.find((o) => o.id === objectId);
      if (obj) {
        transformBeginRef.current[`${pageId}:${objectId}`] = { ...obj.transform };
      }
    },
    [project.pages]
  );

  const commitObjectTransform = useCallback(
    (pageId: string, objectId: string) => {
      const key = `${pageId}:${objectId}`;
      const before = transformBeginRef.current[key];
      delete transformBeginRef.current[key];
      if (!before) return;
      const page = project.pages.find((p) => p.id === pageId);
      if (!page?.sceneId) return;
      const scene = scenesRef.current[page.sceneId];
      if (!scene) return;
      const obj = scene.objects.find((o) => o.id === objectId);
      if (!obj) return;
      const cmd = createTransformCommand(objectId, before, obj.transform);
      if (!cmd) return;
      getHistory(pageId).push(cmd);
      bumpHistory();
      applyScene(pageId, scene);
    },
    [project.pages, getHistory, bumpHistory, applyScene]
  );

  const undoScene = useCallback(
    (pageId: string) => {
      const page = project.pages.find((p) => p.id === pageId);
      if (!page?.sceneId) return;
      const scene = scenesRef.current[page.sceneId];
      if (!scene) return;
      const history = getHistory(pageId);
      if (!history.canUndo()) return;
      const next = history.undo(scene);
      applyScene(pageId, next);
      bumpHistory();
    },
    [project.pages, getHistory, bumpHistory, applyScene]
  );

  const redoScene = useCallback(
    (pageId: string) => {
      const page = project.pages.find((p) => p.id === pageId);
      if (!page?.sceneId) return;
      const scene = scenesRef.current[page.sceneId];
      if (!scene) return;
      const history = getHistory(pageId);
      if (!history.canRedo()) return;
      const next = history.redo(scene);
      applyScene(pageId, next);
      bumpHistory();
    },
    [project.pages, getHistory, bumpHistory, applyScene]
  );

  const canUndoScene = useCallback(
    (pageId: string) => getHistory(pageId).canUndo(),
    [getHistory]
  );

  const canRedoScene = useCallback(
    (pageId: string) => getHistory(pageId).canRedo(),
    [getHistory]
  );

  const groupSelectedObjects = useCallback(
    (pageId: string) => {
      const page = project.pages.find((p) => p.id === pageId);
      if (!page?.sceneId) return;
      const scene = scenesRef.current[page.sceneId];
      if (!scene) return;
      const ids =
        page.selectedObjectIds?.length >= 2
          ? page.selectedObjectIds
          : page.selectedObjectId
            ? [page.selectedObjectId]
            : [];
      if (ids.length < 2) return;
      const groupId = newManualGroupId();
      const cmd = createGroupCommand(ids, groupId);
      const next = cmd.apply(scene);
      getHistory(pageId).push(cmd);
      bumpHistory();
      applyScene(pageId, next);
      updatePage(pageId, {
        selectedObjectId: groupId,
        selectedObjectIds: [groupId],
      });
    },
    [project.pages, getHistory, bumpHistory, applyScene, updatePage]
  );

  const ungroupObject = useCallback(
    (pageId: string, objectId: string) => {
      const page = project.pages.find((p) => p.id === pageId);
      if (!page?.sceneId) return;
      const scene = scenesRef.current[page.sceneId];
      if (!scene) return;
      const group = scene.objects.find((o) => o.id === objectId);
      if (!group?.groupMeta?.children?.length) return;
      const cmd = createUngroupCommand(objectId, group.groupMeta.children);
      const next = cmd.apply(scene);
      getHistory(pageId).push(cmd);
      bumpHistory();
      applyScene(pageId, next);
      const childIds = group.groupMeta.children.map((c) => c.id);
      updatePage(pageId, {
        selectedObjectId: childIds[0] ?? null,
        selectedObjectIds: childIds,
      });
    },
    [project.pages, getHistory, bumpHistory, applyScene, updatePage]
  );

  const reorderObjectLayer = useCallback(
    (pageId: string, objectId: string, direction: 'forward' | 'back') => {
      const page = project.pages.find((p) => p.id === pageId);
      if (!page?.sceneId) return;
      const scene = scenesRef.current[page.sceneId];
      if (!scene) return;
      const sorted = [...scene.objects].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((o) => o.id === objectId);
      if (idx < 0) return;
      const swapIdx = direction === 'forward' ? idx + 1 : idx - 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      const cmd = createReorderCommand(
        a.id,
        a.zIndex,
        b.zIndex,
        b.id,
        b.zIndex,
        a.zIndex
      );
      if (!cmd) return;
      const next = cmd.apply(scene);
      getHistory(pageId).push(cmd);
      bumpHistory();
      applyScene(pageId, next);
    },
    [project.pages, getHistory, bumpHistory, applyScene]
  );

  const releaseDrawnAssets = useCallback(
    (page: Page) => {
      if (page.vectorId) {
        void deleteSvg(page.vectorId);
        const vectorUrl = vectorUrlsRef.current[page.vectorId];
        if (vectorUrl) {
          URL.revokeObjectURL(vectorUrl);
          delete vectorUrlsRef.current[page.vectorId];
        }
      }
      if (page.sceneId) {
        void deleteScene(page.sceneId);
        delete scenesRef.current[page.sceneId];
      }
      void composite.clearCompositeAssets(page);
    },
    [composite]
  );

  const storeGeneratedIllustration = useCallback(
    async (base: Project, pageIndex: number, imageBase64: string): Promise<Project> => {
      const page = base.pages[pageIndex];
      const imageId = generatedImageKey(base.id, pageIndex + 1);
      const blob = base64ToPng(imageBase64);
      await saveImage(imageId, blob);
      if (page.imageId && page.imageId !== imageId) {
        void deleteImage(page.imageId);
        const oldUrl = imageUrlsRef.current[page.imageId];
        if (oldUrl) {
          URL.revokeObjectURL(oldUrl);
          delete imageUrlsRef.current[page.imageId];
        }
      }
      const sameUrl = imageUrlsRef.current[imageId];
      if (sameUrl) URL.revokeObjectURL(sameUrl);
      releaseDrawnAssets(page);
      imageUrlsRef.current[imageId] = imageObjectUrl(blob);
      setImageUrls({ ...imageUrlsRef.current });
      setVectorUrls({ ...vectorUrlsRef.current });
      setScenes({ ...scenesRef.current });
      const next = persistProject({
        ...base,
        pages: base.pages.map((item, index) =>
          index === pageIndex
            ? {
                ...item,
                imageId,
                vectorId: null,
                vectorStatus: 'none',
                vectorError: undefined,
                displayMode: 'raster',
                sceneId: null,
                sceneStatus: 'none',
                sceneError: undefined,
                canvasMode: 'view',
                selectedObjectId: null,
                selectedObjectIds: [],
                uploadTier: 'folk-art',
                uploadTierOverride: null,
                compositeId: null,
                compositeStatus: 'none',
                compositeError: undefined,
                editRegion: 'full',
                selectedLayerId: null,
                editStage: null,
              }
            : item
        ),
      });
      setProject(next);
      projectRef.current = next;
      setActivePageIndex(pageIndex);
      return next;
    },
    [releaseDrawnAssets, setProject]
  );

  const illustratePage = useCallback(
    async (pageIndex: number): Promise<GenerationResult> => {
      const current = projectRef.current;
      const page = current.pages[pageIndex];
      if (!page) return { ok: false, message: 'That page is not in the story.' };
      if (!isGeneratedArtStyleId(current.artStyleId)) {
        return {
          ok: false,
          message: 'Choose pencil sketch, watercolour, or simple cartoon before generating.',
        };
      }
      let referenceImageBase64: string | null = null;
      if (pageIndex > 0) {
        const first = current.pages[0];
        const blob = first?.imageId ? await loadImage(first.imageId) : null;
        if (!blob) {
          return { ok: false, message: 'Page 1 has no picture to use as a reference.' };
        }
        referenceImageBase64 = await blobToBase64(blob);
      }
      setGenerationStatus({
        phase: 'illustration',
        pageNumber: pageIndex + 1,
        total: current.pages.length,
      });
      const illustrated = await requestIllustration({
        artStyleId: current.artStyleId,
        sceneDescription: page.sceneDescription,
        script: page.script,
        cast: current.cast,
        referenceImageBase64,
      });
      if (!illustrated.ok) return illustrated;
      await storeGeneratedIllustration(projectRef.current, pageIndex, illustrated.imageBase64);
      return { ok: true };
    },
    [storeGeneratedIllustration]
  );

  const generateStory = useCallback(async (): Promise<GenerationResult> => {
    if (generationLock.current) {
      return { ok: false, message: 'Generation is already running.' };
    }
    const current = projectRef.current;
    if (!current.theme.trim()) {
      const message = 'Add a theme before generating.';
      setGenerationStatus({ phase: 'error', message, pageIndex: null });
      return { ok: false, message };
    }
    if (!isGeneratedArtStyleId(current.artStyleId)) {
      const message = 'Choose pencil sketch, watercolour, or simple cartoon before generating.';
      setGenerationStatus({ phase: 'error', message, pageIndex: null });
      return { ok: false, message };
    }
    generationLock.current = true;
    setGenerationStatus({ phase: 'story' });
    try {
      const health = await checkGenerationHealth();
      if (!health.ok) {
        setGenerationStatus({ phase: 'error', message: health.message, pageIndex: null });
        return health;
      }
      const story = await requestStory({
        theme: current.theme,
        detailedWriteup: current.detailedWriteup,
        breakdownPageCount: current.breakdownPageCount,
        artStyleId: current.artStyleId,
      });
      if (!story.ok) {
        setGenerationStatus({ phase: 'error', message: story.message, pageIndex: null });
        return story;
      }
      const dropped = current.pages.slice(story.pages.length);
      for (const page of dropped) {
        clearPageAssets(page, imageUrlsRef.current, vectorUrlsRef.current, scenesRef.current);
        void composite.clearCompositeAssets(page);
      }
      const fitted = fitPageCount(current, story.pages.length);
      const withText = persistProject({
        ...fitted,
        cast: normalizeCast(story.cast),
        pages: fitted.pages.map((page, index) => ({
          ...page,
          script: story.pages[index].script,
          sceneDescription: story.pages[index].sceneDescription,
        })),
      });
      setProject(withText);
      projectRef.current = withText;
      setImageUrls({ ...imageUrlsRef.current });
      setStoryModalOpen(false);
      markStorySetupSeen();
      for (let index = 0; index < withText.pages.length; index++) {
        const drawn = await illustratePage(index);
        if (!drawn.ok) {
          setGenerationStatus({ phase: 'error', message: drawn.message, pageIndex: index });
          return drawn;
        }
      }
      setGenerationStatus({ phase: 'idle' });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed.';
      setGenerationStatus({ phase: 'error', message, pageIndex: null });
      return { ok: false, message };
    } finally {
      generationLock.current = false;
    }
  }, [composite, illustratePage, setProject]);

  const retryIllustration = useCallback(
    async (pageIndex: number): Promise<GenerationResult> => {
      if (generationLock.current) {
        return { ok: false, message: 'Generation is already running.' };
      }
      generationLock.current = true;
      try {
        const drawn = await illustratePage(pageIndex);
        if (!drawn.ok) {
          setGenerationStatus({ phase: 'error', message: drawn.message, pageIndex });
          return drawn;
        }
        setGenerationStatus({ phase: 'idle' });
        return { ok: true };
      } finally {
        generationLock.current = false;
      }
    },
    [illustratePage]
  );

  const markExported = useCallback(() => {
    setProject((p) => persistProject({ ...p, hasExported: true }));
  }, [setProject]);

  const closeStoryModal = useCallback((open: boolean) => {
    if (!open) markStorySetupSeen();
    setStoryModalOpen(open);
  }, []);

  return {
    project,
    setProject,
    activePageIndex,
    setActivePageIndex,
    activePage,
    inspectorTab,
    setInspectorTab,
    imageUrls,
    vectorUrls,
    scenes,
    vectorizeStage,
    storyModalOpen,
    setStoryModalOpen: closeStoryModal,
    styleModalOpen,
    setStyleModalOpen,
    rasterLightboxUrl,
    setRasterLightboxUrl,
    updatePage,
    addPage,
    deletePage,
    reorderPages,
    seedPagesToBreakdownCount,
    uploadPageImage,
    vectorizePage,
    cancelVectorize,
    setDisplayMode,
    setCanvasMode,
    setSelectedObject,
    toggleLayerSelection,
    updateObjectTransform,
    beginObjectTransform,
    commitObjectTransform,
    undoScene,
    redoScene,
    canUndoScene,
    canRedoScene,
    groupSelectedObjects,
    ungroupObject,
    reorderObjectLayer,
    composites: composite.composites,
    compositePreviewUrls: composite.compositePreviewUrls,
    getEffectiveTier: composite.getEffectiveTier,
    setUploadTierOverride: composite.setUploadTierOverride,
    setEditRegion: composite.setEditRegion,
    compositeCanvasClick: composite.compositeCanvasClick,
    beginLayerTransform: composite.beginLayerTransform,
    updateLayerTransform: composite.updateLayerTransform,
    commitLayerTransform: composite.commitLayerTransform,
    undoComposite: composite.undoComposite,
    redoComposite: composite.redoComposite,
    canUndoComposite: composite.canUndoComposite,
    canRedoComposite: composite.canRedoComposite,
    getFlattenedBlob: composite.getFlattenedBlob,
    markExported,
    generationStatus,
    generateStory,
    retryIllustration,
  };
}
