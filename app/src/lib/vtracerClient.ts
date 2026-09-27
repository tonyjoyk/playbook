import type { TraceRequest, TraceResponse } from '../workers/vtracer.worker';

export type TraceResult = {
  rawSvg: string;
  sceneSvg: string;
  objectCount: number;
  traceMs: number;
};

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<
  string,
  { resolve: (result: TraceResult) => void; reject: (err: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/vtracer.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (event: MessageEvent<TraceResponse>) => {
      const msg = event.data;
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.ok) {
        p.resolve({
          rawSvg: msg.rawSvg,
          sceneSvg: msg.sceneSvg,
          objectCount: msg.objectCount,
          traceMs: msg.ms,
        });
      } else {
        p.reject(new Error(msg.error));
      }
    });
    worker.addEventListener('error', () => {
      for (const [, p] of pending) {
        p.reject(new Error('Vectorize worker failed'));
      }
      pending.clear();
      worker = null;
    });
  }
  return worker;
}

export function traceInWorker(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  signal?: AbortSignal
): Promise<TraceResult> {
  const id = `trace-${++seq}`;
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
      resolve: (result) => {
        signal?.removeEventListener('abort', onAbort);
        resolve(result);
      },
      reject: (err) => {
        signal?.removeEventListener('abort', onAbort);
        reject(err);
      },
    });

    const req: TraceRequest = { id, pixels, width, height };
    getWorker().postMessage(req, [pixels.buffer]);
  });
}

export function terminateTraceWorker(): void {
  worker?.terminate();
  worker = null;
  for (const [, p] of pending) {
    p.reject(new Error('Cancelled'));
  }
  pending.clear();
}
