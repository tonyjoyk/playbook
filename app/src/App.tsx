import { useEffect } from 'react';
import { useProject } from './hooks/useProject';
import { useToast } from './hooks/useToast';
import { Header } from './components/Header';
import { PageRail } from './components/PageRail';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { StorySetupModal } from './components/StorySetupModal';
import { ArtStyleModal } from './components/ArtStyleModal';
import { RasterLightbox } from './components/RasterLightbox';
import { Toast } from './components/Toast';
import { loadImage } from './lib/storage';
import './styles/playbook-pal.css';

function App() {
  const {
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
    composites,
    compositePreviewUrls,
    getEffectiveTier,
    storyModalOpen,
    setStoryModalOpen,
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
    setUploadTierOverride,
    setEditRegion,
    compositeCanvasClick,
    beginLayerTransform,
    updateLayerTransform,
    commitLayerTransform,
    undoComposite,
    redoComposite,
    canUndoComposite,
    canRedoComposite,
    vectorizeStage,
    markExported,
    generationStatus,
    generateStory,
    retryIllustration,
  } = useProject();

  const { message, visible, showToast } = useToast();

  const activeImageUrl = activePage.imageId
    ? imageUrls[activePage.imageId]
    : undefined;
  const activeScene = activePage.sceneId
    ? scenes[activePage.sceneId]
    : undefined;

  const activeComposite = activePage.compositeId
    ? composites[activePage.compositeId]
    : undefined;
  const isPainterly = getEffectiveTier(activePage) === 'painterly';

  useEffect(() => {
    if (activePage.canvasMode !== 'edit') return;
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== 'z') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (isPainterly) {
        if (e.shiftKey) redoComposite(activePage.id);
        else undoComposite(activePage.id);
      } else if (e.shiftKey) {
        redoScene(activePage.id);
      } else {
        undoScene(activePage.id);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activePage.id,
    activePage.canvasMode,
    isPainterly,
    undoScene,
    redoScene,
    undoComposite,
    redoComposite,
  ]);

  async function downloadOriginalRaster() {
    if (!activePage.imageId) return;
    const blob = await loadImage(activePage.imageId);
    if (!blob) {
      showToast('Original image not found');
      return;
    }
    const ext = blob.type.includes('jpeg') ? 'jpg' : 'png';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `page-${activePageIndex + 1}-original.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app">
      <Header
        project={project}
        generationStatus={generationStatus}
        onRetry={() => {
          if (generationStatus.phase === 'error' && generationStatus.pageIndex !== null) {
            void retryIllustration(generationStatus.pageIndex);
          }
        }}
        onTitleChange={(title) => setProject((p) => ({ ...p, title }))}
        onOpenStorySetup={() => setStoryModalOpen(true)}
        onOpenStyle={() => setStyleModalOpen(true)}
        onExported={markExported}
        showToast={showToast}
      />

      <main>
        <PageRail
          project={project}
          activePageIndex={activePageIndex}
          imageUrls={imageUrls}
          onSelectPage={setActivePageIndex}
          onAddPage={addPage}
          onDeletePage={deletePage}
          onReorder={reorderPages}
          onSeedPages={seedPagesToBreakdownCount}
          showToast={showToast}
        />
        <Canvas
          page={activePage}
          pageIndex={activePageIndex}
          totalPages={project.pages.length}
          imageUrls={imageUrls}
          vectorUrls={vectorUrls}
          scenes={scenes}
          composites={composites}
          compositePreviewUrls={compositePreviewUrls}
          isPainterly={isPainterly}
          vectorizeStage={vectorizeStage}
          onSelectObject={(id) => setSelectedObject(activePage.id, id)}
          onUpdateTransform={(objectId, patch) =>
            updateObjectTransform(activePage.id, objectId, patch)
          }
          onTransformBegin={(objectId) =>
            beginObjectTransform(activePage.id, objectId)
          }
          onTransformEnd={(objectId) =>
            commitObjectTransform(activePage.id, objectId)
          }
          onCompositeClick={(x, y, negative) =>
            void compositeCanvasClick(activePage.id, x, y, negative).catch(
              (err: Error) => showToast(err.message)
            )
          }
          onSelectLayer={(id) =>
            updatePage(activePage.id, { selectedLayerId: id })
          }
          onLayerTransformBegin={(layerId) =>
            beginLayerTransform(activePage.id, layerId)
          }
          onLayerTransformUpdate={(layerId, patch) =>
            updateLayerTransform(activePage.id, layerId, patch)
          }
          onLayerTransformEnd={(layerId) =>
            void commitLayerTransform(activePage.id, layerId)
          }
        />
        <Inspector
          project={project}
          page={activePage}
          pageIndex={activePageIndex}
          tab={inspectorTab}
          imageUrls={imageUrls}
          scene={activeScene}
          composite={activeComposite}
          isPainterly={isPainterly}
          onTabChange={setInspectorTab}
          onUpdatePage={(patch) => updatePage(activePage.id, patch)}
          onOpenStyle={() => setStyleModalOpen(true)}
          onUpload={async (file) => {
            const hadVector = activePage.vectorStatus === 'done';
            await uploadPageImage(activePage.id, file);
            if (hadVector) {
              showToast('New image uploaded — vector cleared. Vectorize again when ready.');
            }
          }}
          onVectorize={async () => {
            await vectorizePage(activePage.id);
            showToast('Page vectorized — edit shapes in Illustration tab');
          }}
          onCancelVectorize={cancelVectorize}
          onSetDisplayMode={(mode) => setDisplayMode(activePage.id, mode)}
          onSetCanvasMode={(mode) => setCanvasMode(activePage.id, mode)}
          onSelectObject={(id) => setSelectedObject(activePage.id, id)}
          onToggleLayerSelection={(id, extend) =>
            toggleLayerSelection(activePage.id, id, extend)
          }
          onReorderLayer={(objectId, direction) =>
            reorderObjectLayer(activePage.id, objectId, direction)
          }
          onUndo={() =>
            isPainterly
              ? undoComposite(activePage.id)
              : undoScene(activePage.id)
          }
          onRedo={() =>
            isPainterly
              ? redoComposite(activePage.id)
              : redoScene(activePage.id)
          }
          canUndo={
            isPainterly
              ? canUndoComposite(activePage.id)
              : canUndoScene(activePage.id)
          }
          canRedo={
            isPainterly
              ? canRedoComposite(activePage.id)
              : canRedoScene(activePage.id)
          }
          onSetUploadTier={(tier) => setUploadTierOverride(activePage.id, tier)}
          onSetEditRegion={(region) => setEditRegion(activePage.id, region)}
          onGroup={() => groupSelectedObjects(activePage.id)}
          onUngroup={(objectId) => ungroupObject(activePage.id, objectId)}
          onViewOriginal={() => {
            if (activeImageUrl) setRasterLightboxUrl(activeImageUrl);
          }}
          onDownloadOriginal={() => void downloadOriginalRaster()}
          vectorizeStage={vectorizeStage}
          showToast={showToast}
        />
      </main>

      <StorySetupModal
        open={storyModalOpen}
        project={project}
        onClose={() => setStoryModalOpen(false)}
        onChange={(patch) => setProject((p) => ({ ...p, ...patch }))}
        onGenerate={() => void generateStory()}
        generationStatus={generationStatus}
        showToast={showToast}
      />

      <ArtStyleModal
        open={styleModalOpen}
        project={project}
        onClose={() => setStyleModalOpen(false)}
        onChange={(patch) => setProject((p) => ({ ...p, ...patch }))}
      />

      <RasterLightbox
        imageUrl={rasterLightboxUrl}
        onClose={() => setRasterLightboxUrl(null)}
        onDownload={() => void downloadOriginalRaster()}
      />

      <Toast message={message} visible={visible} />
    </div>
  );
}

export default App;
