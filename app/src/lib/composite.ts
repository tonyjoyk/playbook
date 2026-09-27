export const PAGE_WIDTH = 1200;
export const PAGE_HEIGHT = 900;
export const CAPTION_BAND_HEIGHT = 72;

export type CompositeOptions = {
  script: string;
  image: HTMLImageElement | null;
  width?: number;
  height?: number;
};

export function renderPageComposite(
  canvas: HTMLCanvasElement,
  { script, image, width = PAGE_WIDTH, height = PAGE_HEIGHT }: CompositeOptions
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const hasScript = script.trim().length > 0;
  const artBottom = hasScript ? height - CAPTION_BAND_HEIGHT : height;

  if (image) {
    const imgAspect = image.naturalWidth / image.naturalHeight;
    const areaAspect = width / artBottom;
    let drawW: number;
    let drawH: number;
    if (imgAspect > areaAspect) {
      drawH = artBottom;
      drawW = drawH * imgAspect;
    } else {
      drawW = width;
      drawH = drawW / imgAspect;
    }
    const x = (width - drawW) / 2;
    const y = (artBottom - drawH) / 2;
    ctx.drawImage(image, x, y, drawW, drawH);
  } else {
    ctx.fillStyle = '#F4EADb';
    ctx.fillRect(0, 0, width, artBottom);
  }

  if (hasScript) {
    ctx.fillStyle = 'rgba(246, 239, 226, 0.92)';
    ctx.fillRect(0, artBottom, width, CAPTION_BAND_HEIGHT);
    ctx.strokeStyle = 'rgba(231, 222, 207, 0.8)';
    ctx.beginPath();
    ctx.moveTo(0, artBottom);
    ctx.lineTo(width, artBottom);
    ctx.stroke();

    ctx.fillStyle = '#3A2F2A';
    ctx.font = '500 22px Fraunces, Georgia, serif';
    const paddingX = 28;
    const maxWidth = width - paddingX * 2;
    wrapText(ctx, script.trim(), paddingX, artBottom + 36, maxWidth, 28);
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split(/\s+/);
  let line = '';
  let currentY = y;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
}

export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
      'image/png'
    );
  });
}
