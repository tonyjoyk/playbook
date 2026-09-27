import type { MattingRequest, MattingResponse } from '../workers/matting.worker';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<
  string,
  { resolve: (blob: Blob) => void; reject: (err: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/matting.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (event: MessageEvent<MattingResponse>) => {
      const msg = event.data;
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.resultBlob);
      else p.reject(new Error(msg.error));
    });
    worker.addEventListener('error', () => {
      for (const [, p] of pending) p.reject(new Error('Matting worker failed'));
      pending.clear();
      worker = null;
    });
  }
  return worker;
}

export function mattingInWorker(cropBlob: Blob, signal?: AbortSignal): Promise<Blob> {
  const id = `matting-${++seq}`;
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
      resolve: (blob) => {
        signal?.removeEventListener('abort', onAbort);
        resolve(blob);
      },
      reject: (err) => {
        signal?.removeEventListener('abort', onAbort);
        reject(err);
      },
    });
    const req: MattingRequest = { id, cropBlob };
    getWorker().postMessage(req);
  });
}

export function terminateMattingWorker(): void {
  worker?.terminate();
  worker = null;
  for (const [, p] of pending) p.reject(new Error('Cancelled'));
  pending.clear();
}
