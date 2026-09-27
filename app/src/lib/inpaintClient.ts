import type { InpaintRequest, InpaintResponse } from '../workers/inpaint.worker';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<
  string,
  { resolve: (pixels: Uint8ClampedArray) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/inpaint.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (event: MessageEvent<InpaintResponse>) => {
      const msg = event.data;
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.ok) {
        p.resolve(msg.pixels);
      } else {
        p.reject(new Error(msg.error));
      }
    });
    worker.addEventListener('error', () => {
      for (const [, p] of pending) p.reject(new Error('Inpaint worker failed'));
      pending.clear();
      worker = null;
    });
  }
  return worker;
}

export function inpaintInWorker(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  holeMask: Uint8Array,
  signal?: AbortSignal
): Promise<Uint8ClampedArray> {
  const id = `inpaint-${++seq}`;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Cancelled'));
      return;
    }
    const onAbort = () => {
      pending.delete(id);
      reject(new Error('Cancelled'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    pending.set(id, {
      resolve: (r) => {
        signal?.removeEventListener('abort', onAbort);
        resolve(r);
      },
      reject: (e) => {
        signal?.removeEventListener('abort', onAbort);
        reject(e);
      },
    });
    const pxCopy = new Uint8ClampedArray(pixels);
    const maskCopy = new Uint8Array(holeMask);
    const req: InpaintRequest = {
      id,
      pixels: pxCopy,
      width,
      height,
      holeMask: maskCopy,
    };
    getWorker().postMessage(req, [pxCopy.buffer, maskCopy.buffer]);
  });
}

export function terminateInpaintWorker(): void {
  worker?.terminate();
  worker = null;
  for (const [, p] of pending) p.reject(new Error('Cancelled'));
  pending.clear();
}
