import type { Page, Project } from '../types';

export function newPageId(): string {
  return `page-${crypto.randomUUID()}`;
}

export function newImageId(): string {
  return `img-${crypto.randomUUID()}`;
}

export function newVectorId(): string {
  return `vec-${crypto.randomUUID()}`;
}

export function newSceneId(): string {
  return `scene-${crypto.randomUUID()}`;
}

export function newCompositeId(): string {
  return `composite-${crypto.randomUUID()}`;
}

export function newCompositeBlobId(): string {
  return `cblob-${crypto.randomUUID()}`;
}

export function newLayerId(): string {
  return `layer-${crypto.randomUUID().slice(0, 8)}`;
}

export function createBlankPage(): Page {
  return {
    id: newPageId(),
    script: '',
    sceneDescription: '',
    imageId: null,
    vectorId: null,
    vectorStatus: 'none',
    displayMode: 'raster',
    sceneId: null,
    sceneStatus: 'none',
    canvasMode: 'view',
    selectedObjectId: null,
    selectedObjectIds: [],
    uploadTier: 'folk-art',
    uploadTierOverride: null,
    compositeId: null,
    compositeStatus: 'none',
    editRegion: 'full',
    selectedLayerId: null,
    editStage: null,
  };
}

export function createDefaultProject(): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: 'Untitled Story',
    theme: '',
    detailedWriteup: '',
    breakdownPageCount: 8,
    artStyleId: 'folk-gouache',
    hasViewedIllustrationTab: false,
    hasExported: false,
    pages: [createBlankPage()],
    updatedAt: now,
  };
}

export function ensurePageCount(project: Project, target: number): Project {
  const count = Math.max(1, Math.floor(target));
  if (project.pages.length >= count) return project;
  const extra = Array.from({ length: count - project.pages.length }, () =>
    createBlankPage()
  );
  return {
    ...project,
    pages: [...project.pages, ...extra],
    updatedAt: new Date().toISOString(),
  };
}

export function storySetupComplete(project: Project): boolean {
  return project.theme.trim() !== '' && project.detailedWriteup.trim() !== '';
}

export function pagesStepComplete(project: Project): boolean {
  return project.pages.some(
    (p) => p.script.trim() !== '' || p.sceneDescription.trim() !== ''
  );
}
