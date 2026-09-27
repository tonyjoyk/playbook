import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import type { Page, Project } from '../types';
import { renderSceneSvg } from './sceneRender';
import { loadImage, loadScene, loadSvg, loadComposite, loadCompositeBlob } from './storage';
import { renderCompositeToBlob } from './compositeOps';
import {
  canvasToBlob,
  loadImageFromBlob,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  renderPageComposite,
} from './composite';

async function renderPageRaster(
  page: Page,
  canvas: HTMLCanvasElement
): Promise<void> {
  if (page.compositeId && page.compositeStatus === 'ready') {
    const doc = await loadComposite(page.compositeId);
    if (doc) {
      const bg = await loadCompositeBlob(doc.backgroundBlobId);
      if (bg) {
        const flat = await renderCompositeToBlob(
          bg,
          doc.layers,
          (layer) => loadCompositeBlob(layer.spriteBlobId).then((b) => b!)
        );
        const img = await loadImageFromBlob(flat);
        renderPageComposite(canvas, { script: page.script, image: img });
        return;
      }
    }
  }
  let image: HTMLImageElement | null = null;
  if (page.imageId) {
    const blob = await loadImage(page.imageId);
    if (blob) image = await loadImageFromBlob(blob);
  }
  renderPageComposite(canvas, { script: page.script, image });
}

export async function exportBookPdf(project: Project): Promise<void> {
  const canvas = document.createElement('canvas');
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [PAGE_WIDTH, PAGE_HEIGHT],
  });

  for (let i = 0; i < project.pages.length; i++) {
    await renderPageRaster(project.pages[i], canvas);
    const dataUrl = canvas.toDataURL('image/png');
    if (i > 0) pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'landscape');
    pdf.addImage(dataUrl, 'PNG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  }

  const safeTitle = project.title.trim() || 'storybook';
  pdf.save(`${safeTitle.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}.pdf`);
}

export async function exportPageImagesZip(project: Project): Promise<void> {
  const canvas = document.createElement('canvas');
  const zip = new JSZip();

  for (let i = 0; i < project.pages.length; i++) {
    await renderPageRaster(project.pages[i], canvas);
    const blob = await canvasToBlob(canvas);
    zip.file(`page-${String(i + 1).padStart(2, '0')}.png`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const safeTitle = project.title.trim() || 'storybook';
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}-pages.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportPageSvgsZip(project: Project): Promise<number> {
  const zip = new JSZip();
  let count = 0;

  for (let i = 0; i < project.pages.length; i++) {
    const page = project.pages[i];
    if (page.vectorStatus !== 'done') continue;

    let svg: string | null = null;
    if (page.sceneId && page.sceneStatus === 'ready') {
      const scene = await loadScene(page.sceneId);
      if (scene) svg = renderSceneSvg(scene);
    }
    if (!svg && page.vectorId) {
      svg = await loadSvg(page.vectorId);
    }
    if (!svg) continue;

    zip.file(`page-${String(i + 1).padStart(2, '0')}.svg`, svg);
    count++;
  }

  if (count === 0) {
    throw new Error('No vectorized pages to export');
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const safeTitle = project.title.trim() || 'storybook';
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}-vectors.zip`;
  a.click();
  URL.revokeObjectURL(url);
  return count;
}
