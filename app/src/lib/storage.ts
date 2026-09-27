import type {
  CompositeDocument,
  DisplayMode,
  Page,
  Project,
  SceneDocument,
  UploadTier,
  VectorStatus,
} from '../types';
import { createBlankPage, createDefaultProject } from './project';

const PROJECT_KEY = 'playbook-pal:project';
const DB_NAME = 'playbook-pal';
const DB_VERSION = 4;
const IMAGE_STORE = 'playbook-pal-images';
const SVG_STORE = 'playbook-pal-svgs';
const SCENE_STORE = 'playbook-pal-scenes';
const COMPOSITE_STORE = 'playbook-pal-composites';

export const SESSION_STORY_SETUP_SEEN = 'playbook-pal:story-setup-seen';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE);
      }
      if (!db.objectStoreNames.contains(SVG_STORE)) {
        db.createObjectStore(SVG_STORE);
      }
      if (!db.objectStoreNames.contains(SCENE_STORE)) {
        db.createObjectStore(SCENE_STORE);
      }
      if (!db.objectStoreNames.contains(COMPOSITE_STORE)) {
        db.createObjectStore(COMPOSITE_STORE);
      }
    };
  });
}

function migratePage(page: Partial<Page>): Page {
  const base = createBlankPage();
  const vectorStatus = (page.vectorStatus ?? 'none') as VectorStatus;
  const displayMode: DisplayMode =
    page.displayMode ??
    (page.vectorId && vectorStatus === 'done' ? 'vector' : 'raster');
  return {
    ...base,
    ...page,
    vectorId: page.vectorId ?? null,
    vectorStatus,
    vectorError: page.vectorError,
    displayMode,
    sceneId: page.sceneId ?? null,
    sceneStatus: page.sceneStatus ?? 'none',
    sceneError: page.sceneError,
    canvasMode: page.canvasMode ?? 'view',
    selectedObjectId: page.selectedObjectId ?? null,
    selectedObjectIds: page.selectedObjectIds ?? [],
    uploadTier: (page.uploadTier ?? 'folk-art') as UploadTier,
    uploadTierOverride: page.uploadTierOverride ?? null,
    compositeId: page.compositeId ?? null,
    compositeStatus: page.compositeStatus ?? 'none',
    compositeError: page.compositeError,
    editRegion: page.editRegion ?? 'full',
    selectedLayerId: page.selectedLayerId ?? null,
    editStage: page.editStage ?? null,
  };
}

export function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(PROJECT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Project>;
    const defaults = createDefaultProject();
    return {
      ...defaults,
      ...parsed,
      pages: parsed.pages?.length
        ? parsed.pages.map((p) => migratePage(p))
        : defaults.pages,
      hasViewedIllustrationTab: parsed.hasViewedIllustrationTab ?? false,
      hasExported: parsed.hasExported ?? false,
      breakdownPageCount: parsed.breakdownPageCount ?? 8,
      artStyleId: parsed.artStyleId ?? 'folk-gouache',
    };
  } catch {
    return null;
  }
}

export function saveProject(project: Project): void {
  localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
}

export async function saveImage(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IMAGE_STORE).put(blob, id);
  });
}

export async function loadImage(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, 'readonly');
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore(IMAGE_STORE).get(id);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as Blob | undefined) ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteImage(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IMAGE_STORE).delete(id);
  });
}

export async function saveSvg(id: string, svg: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SVG_STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.objectStore(SVG_STORE).put(svg, id);
  });
}

export async function loadSvg(id: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SVG_STORE, 'readonly');
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore(SVG_STORE).get(id);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as string | undefined) ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSvg(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SVG_STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.objectStore(SVG_STORE).delete(id);
  });
}

export function imageObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function svgObjectUrl(svg: string): string {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  return URL.createObjectURL(blob);
}

export async function saveScene(id: string, scene: SceneDocument): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCENE_STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.objectStore(SCENE_STORE).put(scene, id);
  });
}

export async function loadScene(id: string): Promise<SceneDocument | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCENE_STORE, 'readonly');
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore(SCENE_STORE).get(id);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as SceneDocument | undefined) ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteScene(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCENE_STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.objectStore(SCENE_STORE).delete(id);
  });
}

export async function saveComposite(id: string, doc: CompositeDocument): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COMPOSITE_STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.objectStore(COMPOSITE_STORE).put(doc, id);
  });
}

export async function loadComposite(id: string): Promise<CompositeDocument | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COMPOSITE_STORE, 'readonly');
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore(COMPOSITE_STORE).get(id);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as CompositeDocument | undefined) ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteComposite(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COMPOSITE_STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.objectStore(COMPOSITE_STORE).delete(id);
  });
}

export async function saveCompositeBlob(id: string, blob: Blob): Promise<void> {
  return saveImage(id, blob);
}

export async function loadCompositeBlob(id: string): Promise<Blob | null> {
  return loadImage(id);
}

export async function deleteCompositeBlob(id: string): Promise<void> {
  return deleteImage(id);
}

export function isStorySetupSeenThisSession(): boolean {
  return sessionStorage.getItem(SESSION_STORY_SETUP_SEEN) === '1';
}

export function markStorySetupSeen(): void {
  sessionStorage.setItem(SESSION_STORY_SETUP_SEEN, '1');
}
