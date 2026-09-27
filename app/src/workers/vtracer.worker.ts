import init, { trace_pair } from '../../wasm-vtracer/pkg/playbook_vtracer_wasm.js';
import wasmUrl from '../../wasm-vtracer/pkg/playbook_vtracer_wasm_bg.wasm?url';
import { SCENE_VTRACER_CONFIG, VTRACER_CONFIG } from '../lib/vtracerConfig';

let ready: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  if (!ready) {
    ready = init(wasmUrl).then(() => undefined);
  }
  return ready;
}

export type TraceRequest = {
  id: string;
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
};

export type TraceResponse =
  | {
      id: string;
      ok: true;
      rawSvg: string;
      sceneSvg: string;
      objectCount: number;
      ms: number;
    }
  | { id: string; ok: false; error: string };

self.addEventListener('message', (event: MessageEvent<TraceRequest>) => {
  const { id, pixels, width, height } = event.data;
  const started = performance.now();
  void (async () => {
    try {
      await ensureReady();
      const rgba = new Uint8Array(
        pixels.buffer,
        pixels.byteOffset,
        pixels.byteLength
      );
      const result = trace_pair(
        rgba,
        width,
        height,
        VTRACER_CONFIG,
        SCENE_VTRACER_CONFIG
      ) as { raw: string; scene: string; objectCount: number };
      const res: TraceResponse = {
        id,
        ok: true,
        rawSvg: result.raw,
        sceneSvg: result.scene,
        objectCount: result.objectCount,
        ms: Math.round(performance.now() - started),
      };
      self.postMessage(res);
    } catch (err) {
      const res: TraceResponse = {
        id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      self.postMessage(res);
    }
  })();
});
