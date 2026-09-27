import {
  ART_STYLE_IDS,
  type ArtStyleId,
  type Cast,
  type CastEntry,
  type Page,
  type Project,
} from '../types';

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
    artStyleId: 'pencil-sketch',
    cast: emptyCast(),
    hasViewedIllustrationTab: false,
    hasExported: false,
    pages: [createBlankPage()],
    updatedAt: now,
  };
}

export function emptyCast(): Cast {
  return { characters: [], places: [], objects: [] };
}

export function isArtStyleId(value: unknown): value is ArtStyleId {
  return typeof value === 'string' && (ART_STYLE_IDS as readonly string[]).includes(value);
}

export function generatedImageKey(projectId: string, pageNumber: number): string {
  return `story/${projectId}/page-${pageNumber}`;
}

function castEntries(value: unknown): CastEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: CastEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.name !== 'string' || typeof rec.appearance !== 'string') continue;
    entries.push({ name: rec.name, appearance: rec.appearance });
  }
  return entries;
}

export function normalizeCast(value: unknown): Cast {
  if (!value || typeof value !== 'object') return emptyCast();
  const rec = value as Record<string, unknown>;
  return {
    characters: castEntries(rec.characters),
    places: castEntries(rec.places),
    objects: castEntries(rec.objects),
  };
}

export function fitPageCount(project: Project, target: number): Project {
  const count = Math.min(99, Math.max(1, Math.floor(target)));
  const pages = project.pages.slice(0, count);
  while (pages.length < count) pages.push(createBlankPage());
  return {
    ...project,
    breakdownPageCount: count,
    pages,
    updatedAt: new Date().toISOString(),
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
