import type { Page, VectorizeStage } from '../types';
import type {
  CompositeMap,
  CompositePreviewUrls,
  ImageUrls,
  SceneMap,
  VectorUrls,
} from '../hooks/useProject';
import { vectorizeStageLabel } from '../lib/vectorizeStages';
import { EditableScene } from './EditableScene';
import { EditableComposite } from './EditableComposite';

type CanvasProps = {
  page: Page;
  pageIndex: number;
  totalPages: number;
  imageUrls: ImageUrls;
  vectorUrls: VectorUrls;
  scenes: SceneMap;
  composites: CompositeMap;
  compositePreviewUrls: CompositePreviewUrls;
  isPainterly: boolean;
  vectorizeStage: VectorizeStage | null;
  onSelectObject: (objectId: string | null) => void;
  onUpdateTransform: (
    objectId: string,
    patch: Partial<import('../types').ObjectTransform>
  ) => void;
  onTransformBegin: (objectId: string) => void;
  onTransformEnd: (objectId: string) => void;
  onCompositeClick: (x: number, y: number, negative: boolean) => void;
  onSelectLayer: (layerId: string | null) => void;
  onLayerTransformBegin: (layerId: string) => void;
  onLayerTransformUpdate: (
    layerId: string,
    patch: Partial<import('../types').ObjectTransform>
  ) => void;
  onLayerTransformEnd: (layerId: string) => void;
};

export function Canvas({
  page,
  pageIndex,
  totalPages,
  imageUrls,
  vectorUrls,
  scenes,
  composites,
  compositePreviewUrls,
  isPainterly,
  vectorizeStage,
  onSelectObject,
  onUpdateTransform,
  onTransformBegin,
  onTransformEnd,
  onCompositeClick,
  onSelectLayer,
  onLayerTransformBegin,
  onLayerTransformUpdate,
  onLayerTransformEnd,
}: CanvasProps) {
  const imageUrl = page.imageId ? imageUrls[page.imageId] : undefined;
  const vectorUrl = page.vectorId ? vectorUrls[page.vectorId] : undefined;
  const scene = page.sceneId ? scenes[page.sceneId] : undefined;
  const composite = page.compositeId ? composites[page.compositeId] : undefined;
  const compositePreview = page.compositeId
    ? compositePreviewUrls[page.compositeId]
    : undefined;
  const hasScript = page.script.trim().length > 0;
  const isVectorizing = page.vectorStatus === 'running';
  const showVectorScene =
    !isPainterly &&
    page.displayMode === 'vector' &&
    page.sceneStatus === 'ready' &&
    scene != null;
  const showComposite =
    isPainterly && page.compositeStatus === 'ready' && composite != null;
  const showRawVector =
    !isPainterly &&
    page.displayMode === 'vector' &&
    !showVectorScene &&
    vectorUrl &&
    page.vectorStatus === 'done';
  const showRasterOnly =
    !showVectorScene && !showComposite && !showRawVector && imageUrl;
  const hasArt = showVectorScene || showComposite || showRawVector || imageUrl;
  const isEditing =
    page.canvasMode === 'edit' && (showVectorScene || showComposite);

  return (
    <section className="col stage">
      <div className="canvas-wrap">
        <div className="page-canvas">
          {showComposite && composite && page.canvasMode === 'edit' && (
            <div className="art">
              <EditableComposite
                composite={composite}
                mode={page.canvasMode}
                selectedLayerId={page.selectedLayerId}
                editRegion={page.editRegion}
                onCanvasClick={onCompositeClick}
                onSelectLayer={onSelectLayer}
                onUpdateTransform={onLayerTransformUpdate}
                onTransformBegin={onLayerTransformBegin}
                onTransformEnd={onLayerTransformEnd}
                segmentPending={page.editStage === 'segmenting'}
              />
            </div>
          )}
          {showComposite && composite && page.canvasMode !== 'edit' && (
            <div className="art">
              <img
                src={compositePreview ?? imageUrl}
                alt=""
                className="art-img"
              />
            </div>
          )}
          {showVectorScene && scene && (
            <div className="art">
              <EditableScene
                scene={scene}
                mode={page.canvasMode}
                selectedObjectId={page.selectedObjectId}
                onSelectObject={onSelectObject}
                onUpdateTransform={onUpdateTransform}
                onTransformBegin={onTransformBegin}
                onTransformEnd={onTransformEnd}
              />
            </div>
          )}
          {showRawVector && (
            <div className="art">
              <img src={vectorUrl} alt="" className="art-img" />
            </div>
          )}
          {showRasterOnly && (
            <div className="art">
              <img src={imageUrl} alt="" className="art-img" />
              {isVectorizing && vectorizeStage && (
                <div className="vectorize-overlay" aria-live="polite">
                  <span className="vectorize-overlay-label">
                    {vectorizeStageLabel(vectorizeStage)}
                  </span>
                </div>
              )}
            </div>
          )}
          {!hasArt && !hasScript && (
            <div className="empty-state">
              <div className="empty-ico">🖼️</div>
              <div
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontSize: 18,
                  color: 'var(--ink)',
                }}
              >
                This page is blank
              </div>
              <div style={{ maxWidth: 260 }}>
                Add the words in <b>Words</b>, describe the <b>Scene</b>, then
                generate a prompt and upload your image under{' '}
                <b>Illustration</b>.
              </div>
            </div>
          )}
          {hasScript && <div className="caption-band">{page.script.trim()}</div>}
        </div>
        <div className="stage-foot">
          <span>
            Page {pageIndex + 1} of {totalPages}
          </span>
          {isVectorizing && vectorizeStage && (
            <span className="muted" style={{ color: 'var(--coral-deep)' }}>
              {vectorizeStageLabel(vectorizeStage)}
            </span>
          )}
          {isEditing && !isVectorizing && (
            <span className="muted editing-pill">Editing</span>
          )}
          {(showVectorScene || showComposite || showRawVector) &&
            !isVectorizing &&
            page.canvasMode !== 'edit' && (
              <span className="muted" style={{ color: 'var(--teal)' }}>
                {isPainterly ? 'Layer view' : 'Vector view'}
              </span>
            )}
          <span className="muted">Click a page on the left to edit it</span>
        </div>
      </div>
    </section>
  );
}
