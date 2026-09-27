import { useRef } from 'react';
import { getArtStyle } from '../lib/artStyles';
import { copyToClipboard } from '../lib/clipboard';
import { buildImagePrompt } from '../lib/prompts';
import { objectLabel } from '../lib/sceneRender';
import type {
  CanvasMode,
  CompositeDocument,
  DisplayMode,
  EditRegion,
  InspectorTab,
  Page,
  Project,
  SceneDocument,
  UploadTier,
  VectorizeStage,
} from '../types';
import type { ImageUrls } from '../hooks/useProject';
import { vectorizeStageLabel } from '../lib/vectorizeStages';

type InspectorProps = {
  project: Project;
  page: Page;
  pageIndex: number;
  tab: InspectorTab;
  imageUrls: ImageUrls;
  scene: SceneDocument | undefined;
  composite: CompositeDocument | undefined;
  isPainterly: boolean;
  onTabChange: (tab: InspectorTab) => void;
  onUpdatePage: (patch: Partial<Page>) => void;
  onOpenStyle: () => void;
  onUpload: (file: File) => Promise<void>;
  onVectorize: () => Promise<void>;
  onCancelVectorize: () => void;
  onSetDisplayMode: (mode: DisplayMode) => void;
  onSetCanvasMode: (mode: CanvasMode) => void;
  onSelectObject: (objectId: string | null) => void;
  onToggleLayerSelection: (objectId: string, extend: boolean) => void;
  onReorderLayer: (objectId: string, direction: 'forward' | 'back') => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onGroup: () => void;
  onUngroup: (objectId: string) => void;
  onSetUploadTier: (tier: UploadTier | null) => void;
  onSetEditRegion: (region: EditRegion) => void;
  onViewOriginal: () => void;
  onDownloadOriginal: () => void;
  vectorizeStage: VectorizeStage | null;
  showToast: (msg: string) => void;
};

export function Inspector({
  project,
  page,
  pageIndex,
  tab,
  imageUrls,
  scene,
  composite,
  isPainterly,
  onTabChange,
  onUpdatePage,
  onOpenStyle,
  onUpload,
  onVectorize,
  onCancelVectorize,
  onSetDisplayMode,
  onSetCanvasMode,
  onToggleLayerSelection,
  onReorderLayer,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onGroup,
  onUngroup,
  onSetUploadTier,
  onSetEditRegion,
  onViewOriginal,
  onDownloadOriginal,
  vectorizeStage,
  showToast,
}: InspectorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const style = getArtStyle(project.artStyleId);
  const imagePrompt = buildImagePrompt(page.sceneDescription);
  const imageUrl = page.imageId ? imageUrls[page.imageId] : undefined;
  const canEditVector = !isPainterly && page.sceneStatus === 'ready' && scene != null;
  const canEditComposite =
    isPainterly && page.compositeStatus === 'ready' && composite != null;
  const canEdit = canEditVector || canEditComposite;
  const sortedObjects = scene
    ? [...scene.objects].sort((a, b) => a.zIndex - b.zIndex)
    : [];
  const selectedIds =
    page.selectedObjectIds?.length > 0
      ? page.selectedObjectIds
      : page.selectedObjectId
        ? [page.selectedObjectId]
        : [];
  const selectedObject = scene?.objects.find((o) => o.id === page.selectedObjectId);
  const canGroup = selectedIds.length >= 2;
  const canUngroup = Boolean(selectedObject?.groupMeta?.isManualGroup);

  async function handleCopy(text: string, label: string) {
    const ok = await copyToClipboard(text);
    showToast(ok ? `${label} copied` : 'Copy failed');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void onUpload(file)
      .then(() => showToast('Image uploaded'))
      .catch((err: Error) => showToast(err.message || 'Upload failed'));
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void onUpload(file)
      .then(() => showToast('Image uploaded'))
      .catch((err: Error) => showToast(err.message || 'Upload failed'));
  }

  function downloadReference() {
    const a = document.createElement('a');
    a.href = style.referenceImageUrl;
    a.download = 'reference-image.png';
    a.click();
    showToast('Reference image downloaded');
  }

  return (
    <aside className="col inspector">
      <div className="insp-head">
        <div className="pg">Page {pageIndex + 1}</div>
        <h2>Page details</h2>
      </div>
      <div className="tabs">
        {(['words', 'scene', 'art'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`tab${tab === t ? ' active' : ''}`}
            onClick={() => onTabChange(t)}
          >
            {t === 'words' ? 'Words' : t === 'scene' ? 'Scene' : 'Illustration'}
          </button>
        ))}
      </div>

      <div className={`panel${tab === 'words' ? ' active' : ''}`}>
        <div className="field">
          <label htmlFor="script">The words on this page</label>
          <div className="hint">
            Paste or type the script the reader will see on this page.
          </div>
          <textarea
            id="script"
            rows={6}
            value={page.script}
            onChange={(e) => onUpdatePage({ script: e.target.value })}
            placeholder="e.g. We sat on the old bench and wondered: what is it all for?"
          />
        </div>
        <div className="note">
          Tip: keep it to a sentence or two per page. Add or remove pages anytime
          from the left.
        </div>
      </div>

      <div className={`panel${tab === 'scene' ? ' active' : ''}`}>
        <div className="field">
          <label htmlFor="scene">Describe the scene</label>
          <div className="hint">
            A few words about what we should see. This becomes your image prompt.
          </div>
          <textarea
            id="scene"
            rows={6}
            value={page.sceneDescription}
            onChange={(e) => onUpdatePage({ sceneDescription: e.target.value })}
            placeholder="e.g. Two friends on a park bench at sunset, tall trees, warm sky."
          />
        </div>
        <div className="note">No need to be fancy — plain words work best.</div>
      </div>

      <div className={`panel${tab === 'art' ? ' active' : ''}`}>
        <button
          type="button"
          className="chip"
          onClick={onOpenStyle}
          title="Change art style"
        >
          <span className="swatch" />
          Style: {style.name}
          <span style={{ color: 'var(--coral)', fontWeight: 800, marginLeft: 2 }}>
            · Change
          </span>
        </button>

        <div className="field">
          <label>1 · Get your image prompt</label>
          <div className="hint">
            Copy this into ChatGPT (or your image tool) with the reference image
            attached.
          </div>
          <div className="prompt-box">
            <button
              type="button"
              className="copy"
              onClick={() => void handleCopy(imagePrompt, 'Image prompt')}
            >
              Copy
            </button>
            {imagePrompt}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={downloadReference}>
              ⬇ Download reference image
            </button>
          </div>
        </div>

        <div className="divider" />

        <div className="field">
          <label>2 · Upload the image you generated</label>
          <div className="hint">
            Bring back the picture from ChatGPT and drop it here.
          </div>
          {imageUrl ? (
            <div className="uploaded">
              <img src={imageUrl} alt="" className="mini" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>Image uploaded</div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginTop: 8, padding: '6px 12px', fontSize: 12 }}
                  onClick={() => fileRef.current?.click()}
                >
                  Replace image
                </button>
              </div>
            </div>
          ) : (
            <div
              className="drop"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
            >
              <div className="big">🖼️</div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>
                Drag &amp; drop or click to upload
              </div>
              <div style={{ fontSize: 12, marginTop: 2 }}>PNG or JPG</div>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleFileChange}
          />
        </div>

        <div className="divider" />

        <div className="field">
          <label>Upload type</label>
          <div className="hint">
            {isPainterly
              ? 'Painterly — click a character to extract it as a raster layer (AI cutout, beta). Drag to move; background fills on drop.'
              : 'Flat folk-art — vector shape editing after vectorize.'}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={
                isPainterly ? undefined : { borderColor: 'var(--coral)' }
              }
              onClick={() => onSetUploadTier('folk-art')}
            >
              Folk-art
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={
                isPainterly ? { borderColor: 'var(--coral)' } : undefined
              }
              onClick={() => onSetUploadTier('painterly')}
            >
              Painterly
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onSetUploadTier(null)}
            >
              Auto
            </button>
          </div>
        </div>

        <div className="divider" />

        <div className="field">
          <label>{isPainterly ? '2 · Edit layers' : '3 · Vectorize'}</label>
          <div className="hint">
            {isPainterly
              ? 'Switch to Edit mode. Click a character, drag to move. Undo applies until you reload this page.'
              : 'Turn the image into scalable vector art. After vectorizing, switch to edit mode to move and resize shapes.'}
          </div>
          {!isPainterly && page.vectorStatus === 'running' ? (
            <div className="row" style={{ alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 13 }}>
                {vectorizeStage ? vectorizeStageLabel(vectorizeStage) : 'Tracing…'}
              </span>
              <button type="button" className="btn btn-ghost" onClick={onCancelVectorize}>
                Cancel
              </button>
            </div>
          ) : !isPainterly ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!imageUrl}
              onClick={() =>
                void onVectorize().catch((err: Error) =>
                  showToast(err.message || 'Vectorize failed')
                )
              }
            >
              ✶ Vectorize image
            </button>
          ) : (
            canEditComposite && (
              <div className="row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={
                    page.canvasMode === 'view'
                      ? { borderColor: 'var(--coral)' }
                      : undefined
                  }
                  onClick={() => onSetCanvasMode('view')}
                >
                  View mode
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={
                    page.canvasMode === 'edit'
                      ? { borderColor: 'var(--coral)' }
                      : undefined
                  }
                  onClick={() => onSetCanvasMode('edit')}
                >
                  Edit mode
                </button>
              </div>
            )
          )}
          {canEditComposite && composite?.splitX != null && (
            <div className="field" style={{ marginTop: 8 }}>
              <label>Edit region</label>
              <div className="row">
                {(['left', 'right', 'full'] as const).map((region) => (
                  <button
                    key={region}
                    type="button"
                    className="btn btn-ghost"
                    style={
                      page.editRegion === region
                        ? { borderColor: 'var(--coral)' }
                        : undefined
                    }
                    onClick={() => onSetEditRegion(region)}
                  >
                    {region === 'left'
                      ? 'Left'
                      : region === 'right'
                        ? 'Right'
                        : 'Full'}
                  </button>
                ))}
              </div>
            </div>
          )}
          {page.compositeStatus === 'error' && page.compositeError && (
            <div className="note" style={{ color: 'var(--coral-deep)' }}>
              {page.compositeError}
            </div>
          )}
          {page.editStage && (
            <div className="note" style={{ marginTop: 8 }}>
              {page.editStage === 'segmenting' ? 'Segmenting…' : 'Filling background…'}
            </div>
          )}
          {!isPainterly && page.vectorStatus === 'error' && page.vectorError && (
            <div className="note" style={{ color: 'var(--coral-deep)' }}>
              {page.vectorError}
            </div>
          )}
          {!isPainterly && page.vectorStatus === 'done' && (
            <>
              <div className="row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={
                    page.displayMode === 'vector'
                      ? { borderColor: 'var(--coral)' }
                      : undefined
                  }
                  onClick={() => onSetDisplayMode('vector')}
                >
                  Vector view
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={
                    page.displayMode === 'raster'
                      ? { borderColor: 'var(--coral)' }
                      : undefined
                  }
                  onClick={() => onSetDisplayMode('raster')}
                >
                  Raster view
                </button>
              </div>
              <div className="note" style={{ marginTop: 8 }}>
                Re-vectorize to refresh object groups after an update.
              </div>
              {canEdit && page.displayMode === 'vector' && (
                <div className="row" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={
                      page.canvasMode === 'view'
                        ? { borderColor: 'var(--coral)' }
                        : undefined
                    }
                    onClick={() => onSetCanvasMode('view')}
                  >
                    View mode
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={
                      page.canvasMode === 'edit'
                        ? { borderColor: 'var(--coral)' }
                        : undefined
                    }
                    onClick={() => onSetCanvasMode('edit')}
                  >
                    Edit mode
                  </button>
                </div>
              )}
              {canEdit && page.canvasMode === 'edit' && (
                <>
                  <div className="note" style={{ marginTop: 8 }}>
                    Undo applies until you reload this page. Cmd+Z / Cmd+Shift+Z
                    in Edit mode.
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={!canUndo}
                      onClick={onUndo}
                    >
                      Undo
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={!canRedo}
                      onClick={onRedo}
                    >
                      Redo
                    </button>
                  </div>
                </>
              )}
              {canEdit && page.canvasMode === 'edit' && !scene?.cutoutMode && (
                <div className="note" style={{ marginTop: 8 }}>
                  Moving shapes may reveal small gaps — improving in next update.
                </div>
              )}
              {page.sceneStatus === 'error' && page.sceneError && (
                <div className="note" style={{ color: 'var(--coral-deep)' }}>
                  Scene compile failed: {page.sceneError}
                </div>
              )}
            </>
          )}
        </div>

        {canEdit && page.displayMode === 'vector' && (
          <>
            <div className="divider" />
            <div className="field">
              <label>Layers</label>
              <div className="hint">
                Reorder shapes on this page. Shift-click layers to multi-select,
                then Group to move them together.
              </div>
              {canEdit && page.canvasMode === 'edit' && (
                <div className="row" style={{ marginTop: 8, marginBottom: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={!canGroup}
                    onClick={onGroup}
                  >
                    Group
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={!canUngroup}
                    onClick={() => {
                      if (page.selectedObjectId) onUngroup(page.selectedObjectId);
                    }}
                  >
                    Ungroup
                  </button>
                </div>
              )}
              <ul className="layer-list">
                {[...sortedObjects].reverse().map((obj) => (
                  <li
                    key={obj.id}
                    className={`layer-item${selectedIds.includes(obj.id) ? ' selected' : ''}`}
                  >
                    <button
                      type="button"
                      className="layer-name"
                      onClick={(e) =>
                        onToggleLayerSelection(obj.id, e.shiftKey)
                      }
                    >
                      {objectLabel(obj)}
                    </button>
                    <span className="layer-actions">
                      <button
                        type="button"
                        className="btn btn-ghost layer-btn"
                        title="Send back"
                        onClick={() => onReorderLayer(obj.id, 'back')}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost layer-btn"
                        title="Bring forward"
                        onClick={() => onReorderLayer(obj.id, 'forward')}
                      >
                        ↑
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {imageUrl && (
          <>
            <div className="divider" />
            <div className="field">
              <label>Original raster</label>
              <div className="hint">Your uploaded image is always kept.</div>
              <div className="row">
                <button type="button" className="btn btn-ghost" onClick={onViewOriginal}>
                  View original
                </button>
                <button type="button" className="btn btn-ghost" onClick={onDownloadOriginal}>
                  Download original
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
