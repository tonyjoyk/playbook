import { inpaintHole } from '../lib/inpaint';

export type InpaintRequest = {
  id: string;
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  holeMask: Uint8Array;
};

export type InpaintResponse =
  | { id: string; ok: true; pixels: Uint8ClampedArray; width: number; height: number }
  | { id: string; ok: false; error: string };

self.addEventListener('message', (event: MessageEvent<InpaintRequest>) => {
  const req = event.data;
  try {
    const filled = inpaintHole(req.pixels, req.width, req.height, req.holeMask);
    const res: InpaintResponse = {
      id: req.id,
      ok: true,
      pixels: filled,
      width: req.width,
      height: req.height,
    };
    // @ts-expect-error WorkerGlobalScope transfer list (not Window.postMessage)
    self.postMessage(res, [filled.buffer as ArrayBuffer]);
  } catch (e) {
    const res: InpaintResponse = {
      id: req.id,
      ok: false,
      error: e instanceof Error ? e.message : 'Inpaint failed',
    };
    self.postMessage(res);
  }
});
