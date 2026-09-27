export const ART_STYLE_IDS = [
  'folk-gouache',
  'pencil-sketch',
  'watercolour-storybook',
  'simple-cartoon',
] as const;

export type ArtStyleId = (typeof ART_STYLE_IDS)[number];

export const GENERATED_ART_STYLE_IDS = [
  'pencil-sketch',
  'watercolour-storybook',
  'simple-cartoon',
] as const;

export type GeneratedArtStyleId = (typeof GENERATED_ART_STYLE_IDS)[number];

export type CastEntry = {
  name: string;
  appearance: string;
};

export type Cast = {
  characters: CastEntry[];
  places: CastEntry[];
  objects: CastEntry[];
};

export type VectorStatus = 'none' | 'running' | 'done' | 'error';

export type VectorizeStage = 'preparing' | 'tracing' | 'finishing';

export type SceneStatus = 'none' | 'compiling' | 'ready' | 'error';

export type DisplayMode = 'raster' | 'vector';

export type CanvasMode = 'view' | 'edit';

export type UploadTier = 'folk-art' | 'painterly';

export type CompositeStatus = 'none' | 'ready' | 'error';

export type EditRegion = 'left' | 'right' | 'full';

export type EditStage = 'segmenting' | 'inpainting' | null;

export type ObjectTransform = {
  tx: number;
  ty: number;
  scale: number;
  rotation: number;
};

export type ScenePath = {
  d: string;
  fill: string;
  transform: string;
};

export type SceneObject = {
  id: string;
  paths: ScenePath[];
  transform: ObjectTransform;
  zIndex: number;
  slot?: string;
  groupMeta?: {
    isManualGroup: boolean;
    children?: SceneObject[];
  };
};

export type SceneDocument = {
  version: 1;
  width: number;
  height: number;
  objects: SceneObject[];
  cutoutMode: boolean;
};

export type CompositeLayer = {
  id: string;
  maskBlobId: string;
  spriteBlobId: string;
  originX: number;
  originY: number;
  width: number;
  height: number;
  transform: ObjectTransform;
  zIndex: number;
  label?: string;
};

export type CompositeDocument = {
  version: 1;
  width: number;
  height: number;
  backgroundBlobId: string;
  layers: CompositeLayer[];
  editRegion: EditRegion;
  splitX: number | null;
};

export type Page = {
  id: string;
  script: string;
  sceneDescription: string;
  imageId: string | null;
  vectorId: string | null;
  vectorStatus: VectorStatus;
  vectorError?: string;
  displayMode: DisplayMode;
  sceneId: string | null;
  sceneStatus: SceneStatus;
  sceneError?: string;
  canvasMode: CanvasMode;
  selectedObjectId: string | null;
  selectedObjectIds: string[];
  uploadTier: UploadTier;
  uploadTierOverride: UploadTier | null;
  compositeId: string | null;
  compositeStatus: CompositeStatus;
  compositeError?: string;
  editRegion: EditRegion;
  selectedLayerId: string | null;
  editStage: EditStage;
};

export type Project = {
  id: string;
  title: string;
  theme: string;
  detailedWriteup: string;
  breakdownPageCount: number;
  artStyleId: ArtStyleId;
  cast: Cast;
  hasViewedIllustrationTab: boolean;
  hasExported: boolean;
  pages: Page[];
  updatedAt: string;
};

export type InspectorTab = 'words' | 'scene' | 'art';

export const DEFAULT_TRANSFORM: ObjectTransform = {
  tx: 0,
  ty: 0,
  scale: 1,
  rotation: 0,
};
