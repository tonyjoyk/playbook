import type { ArtStyleId, Cast } from '../types';

const GENERATION_FAILED = 'Generation failed.';

function messageFromBody(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof (data as { message: unknown }).message === 'string'
  ) {
    const message = (data as { message: string }).message;
    if (message.length > 0) return message;
  }
  return GENERATION_FAILED;
}

function failureFromBody(data: unknown): { ok: false; message: string } | null {
  if (
    typeof data === 'object' &&
    data !== null &&
    'ok' in data &&
    (data as { ok: unknown }).ok === false
  ) {
    return { ok: false, message: messageFromBody(data) };
  }
  return null;
}

async function parseJsonResponse(res: Response): Promise<unknown | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function checkGenerationHealth(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  try {
    const res = await fetch('/api/generation/health');
    const data = await parseJsonResponse(res);
    if (data === null) {
      return { ok: false, message: GENERATION_FAILED };
    }
    if (!res.ok) {
      return { ok: false, message: messageFromBody(data) };
    }
    const failure = failureFromBody(data);
    if (failure) return failure;
    if (
      typeof data === 'object' &&
      data !== null &&
      'ok' in data &&
      (data as { ok: unknown }).ok === true
    ) {
      return { ok: true };
    }
    return { ok: false, message: GENERATION_FAILED };
  } catch {
    return { ok: false, message: GENERATION_FAILED };
  }
}

export async function requestStory(body: {
  theme: string;
  detailedWriteup: string;
  breakdownPageCount: number;
  artStyleId: ArtStyleId;
}): Promise<
  | {
      ok: true;
      cast: Cast;
      pages: { pageNumber: number; script: string; sceneDescription: string }[];
    }
  | { ok: false; message: string }
> {
  try {
    const res = await fetch('/api/generation/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await parseJsonResponse(res);
    if (data === null) {
      return { ok: false, message: GENERATION_FAILED };
    }
    if (!res.ok) {
      return { ok: false, message: messageFromBody(data) };
    }
    const failure = failureFromBody(data);
    if (failure) return failure;
    return data as {
      ok: true;
      cast: Cast;
      pages: { pageNumber: number; script: string; sceneDescription: string }[];
    };
  } catch {
    return { ok: false, message: GENERATION_FAILED };
  }
}

export async function requestIllustration(body: {
  artStyleId: ArtStyleId;
  sceneDescription: string;
  script: string;
  cast: Cast;
  referenceImageBase64: string | null;
}): Promise<
  | { ok: true; mediaType: 'image/png'; imageBase64: string }
  | { ok: false; message: string }
> {
  try {
    const res = await fetch('/api/generation/illustration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await parseJsonResponse(res);
    if (data === null) {
      return { ok: false, message: GENERATION_FAILED };
    }
    if (!res.ok) {
      return { ok: false, message: messageFromBody(data) };
    }
    const failure = failureFromBody(data);
    if (failure) return failure;
    return data as { ok: true; mediaType: 'image/png'; imageBase64: string };
  } catch {
    return { ok: false, message: GENERATION_FAILED };
  }
}
