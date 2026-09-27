import { removeBackground, preload } from '@imgly/background-removal';
import { getMattingConfig, getMattingConfigCdn } from '../lib/mattingConfig';

export type MattingRequest = {
  id: string;
  cropBlob: Blob;
};

export type MattingResponse =
  | { id: string; ok: true; resultBlob: Blob }
  | { id: string; ok: false; error: string };

let ready: Promise<void> | null = null;

async function ensureReady(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    try {
      await preload(getMattingConfig());
    } catch {
      await preload(getMattingConfigCdn());
    }
  })();
  return ready;
}

self.addEventListener('message', async (event: MessageEvent<MattingRequest>) => {
  const req = event.data;
  try {
    await ensureReady();
    let result: Blob;
    try {
      result = await removeBackground(req.cropBlob, getMattingConfig());
    } catch {
      result = await removeBackground(req.cropBlob, getMattingConfigCdn());
    }
    const res: MattingResponse = { id: req.id, ok: true, resultBlob: result };
    self.postMessage(res);
  } catch (e) {
    const res: MattingResponse = {
      id: req.id,
      ok: false,
      error: e instanceof Error ? e.message : 'Matting failed',
    };
    self.postMessage(res);
  }
});
