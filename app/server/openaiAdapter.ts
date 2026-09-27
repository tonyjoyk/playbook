import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import {
  buildGeneratedStoryPrompt,
  isGeneratedArtStyleId,
  styleBlock,
} from '../src/lib/prompts.ts';
import type { Cast, CastEntry } from '../src/types.ts';

/** Measured 2026-09-27. gemini-3.8-flash returned 503. Flash returned story JSON, then 503. Lite also returned story JSON. */
const TEXT_MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'] as const;
export const TEXT_MODEL = TEXT_MODELS[0];
/** Listed for generateContent on this key. Free-tier image quota is a separate billing limit. */
export const IMAGE_MODEL = 'gemini-3.1-flash-image';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MISSING_KEY = 'Add GEMINI_API_KEY to app/.env and restart.';

type FailBody = { ok: false; message: string };

type StoryPage = {
  pageNumber: number;
  script: string;
  sceneDescription: string;
};

function apiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY;
  if (typeof key !== 'string') return undefined;
  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function fail(res: ServerResponse, status: number, message: string): void {
  const body: FailBody = { ok: false, message };
  sendJson(res, status, body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCastEntry(value: unknown): value is CastEntry {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.appearance === 'string'
  );
}

function isCastEntryList(value: unknown): value is CastEntry[] {
  return Array.isArray(value) && value.every(isCastEntry);
}

function parseCast(value: unknown): Cast | null {
  if (!isRecord(value)) return null;
  const { characters, places, objects } = value;
  if (!isCastEntryList(characters) || !isCastEntryList(places) || !isCastEntryList(objects)) {
    return null;
  }
  return { characters, places, objects };
}

function parseStoryPages(value: unknown, expectedCount: number): StoryPage[] | null {
  if (!Array.isArray(value) || value.length !== expectedCount) return null;
  const pages: StoryPage[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (!isRecord(item)) return null;
    const { pageNumber, script, sceneDescription } = item;
    if (
      typeof pageNumber !== 'number' ||
      !Number.isInteger(pageNumber) ||
      pageNumber !== i + 1 ||
      typeof script !== 'string' ||
      typeof sceneDescription !== 'string'
    ) {
      return null;
    }
    pages.push({ pageNumber, script, sceneDescription });
  }
  return pages;
}

function providerErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
    const line = payload.error.message
      .split('\n')
      .map((part) => part.trim())
      .find((part) => part.length > 0);
    return line && line.length > 0 ? line : fallback;
  }
  return fallback;
}

async function callGemini(
  model: string,
  body: Record<string, unknown>,
  key: string,
  unreachable: string,
): Promise<{ ok: true; payload: unknown } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetch(`${GEMINI_URL}/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: unreachable };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: 'Gemini returned a response that could not be read.' };
  }

  if (!response.ok) {
    return { ok: false, message: providerErrorMessage(payload, 'Gemini could not complete the request.') };
  }

  return { ok: true, payload };
}

function textFromGemini(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.candidates) || payload.candidates.length === 0) {
    return null;
  }
  const candidate = payload.candidates[0];
  if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
    return null;
  }
  const texts = candidate.content.parts
    .filter((part): part is Record<string, unknown> => isRecord(part) && typeof part.text === 'string')
    .map((part) => part.text as string);
  if (texts.length === 0) return null;
  return texts.join('');
}

function pngBase64FromGemini(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.candidates) || payload.candidates.length === 0) {
    return null;
  }
  const candidate = payload.candidates[0];
  if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
    return null;
  }
  for (const part of candidate.content.parts) {
    if (!isRecord(part) || !isRecord(part.inlineData)) continue;
    const data = part.inlineData.data;
    const mime = part.inlineData.mimeType;
    if (typeof data !== 'string' || data.length === 0) continue;
    if (mime !== 'image/png') continue;
    return data;
  }
  return null;
}

async function callGeminiChat(
  prompt: string,
  key: string,
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  let last: { ok: false; message: string } = { ok: false, message: 'Gemini could not generate the story.' };
  for (const model of TEXT_MODELS) {
    const result = await callGemini(
      model,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      },
      key,
      'Could not reach Gemini for the story request.',
    );
    if (!result.ok) {
      last = result;
      if (!result.message.toLowerCase().includes('high demand')) return result;
      continue;
    }
    const text = textFromGemini(result.payload);
    if (!text) return { ok: false, message: 'Gemini returned a story in an unexpected shape.' };
    return { ok: true, text };
  }
  return last;
}

function formatCastSection(label: string, entries: CastEntry[]): string {
  if (entries.length === 0) return `${label}: (none)`;
  const lines = entries.map((entry) => `- ${entry.name}: ${entry.appearance}`).join('\n');
  return `${label}:\n${lines}`;
}

function buildIllustrationPrompt(
  artStyleId: Parameters<typeof styleBlock>[0],
  sceneDescription: string,
  script: string,
  cast: Cast,
  hasReference: boolean,
): string {
  const style = styleBlock(artStyleId);
  const castText = [
    formatCastSection('Characters', cast.characters),
    formatCastSection('Places', cast.places),
    formatCastSection('Objects', cast.objects),
  ].join('\n\n');
  const referenceLine = hasReference
    ? 'Match the characters and drawing style of the attached reference image. Draw this new scene. Do not copy the reference scene.'
    : '';

  return `${style}

Scene: ${sceneDescription.trim()}

${castText}

${referenceLine}

Story context for this page (do not render these words in the picture): ${script.trim()}`;
}

async function callGeminiImage(
  prompt: string,
  referencePngBase64: string | null,
  key: string,
): Promise<{ ok: true; imageBase64: string } | { ok: false; message: string }> {
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (referencePngBase64) {
    parts.push({
      inlineData: { mimeType: 'image/png', data: referencePngBase64 },
    });
  }

  const result = await callGemini(
    IMAGE_MODEL,
    {
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'] },
    },
    key,
    'Could not reach Gemini for the illustration request.',
  );
  if (!result.ok) return result;
  const imageBase64 = pngBase64FromGemini(result.payload);
  if (!imageBase64) {
    return { ok: false, message: 'Gemini returned an illustration in an unexpected shape.' };
  }
  return { ok: true, imageBase64 };
}

async function handleHealth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!apiKey()) {
    fail(res, 503, MISSING_KEY);
    return;
  }
  sendJson(res, 200, { ok: true });
}

async function handleStory(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const key = apiKey();
  if (!key) {
    fail(res, 503, MISSING_KEY);
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    fail(res, 400, 'The story request body must be valid JSON.');
    return;
  }

  if (!isRecord(body)) {
    fail(res, 400, 'The story request body must be a JSON object.');
    return;
  }

  const theme = body.theme;
  const detailedWriteup = typeof body.detailedWriteup === 'string' ? body.detailedWriteup : '';
  const breakdownPageCount = body.breakdownPageCount;
  const artStyleId = body.artStyleId;

  if (typeof theme !== 'string' || theme.trim().length === 0) {
    fail(res, 400, 'Enter a theme before generating a story.');
    return;
  }

  if (
    typeof breakdownPageCount !== 'number' ||
    !Number.isInteger(breakdownPageCount) ||
    breakdownPageCount < 1 ||
    breakdownPageCount > 99
  ) {
    fail(res, 400, 'Page count must be a whole number from 1 to 99.');
    return;
  }

  if (!isGeneratedArtStyleId(artStyleId)) {
    fail(res, 400, 'Choose a generated art style (pencil, watercolour, or simple cartoon), not folk gouache.');
    return;
  }

  const prompt = buildGeneratedStoryPrompt({
    theme: theme.trim(),
    detailedWriteup,
    pageCount: breakdownPageCount,
  });

  const chatResult = await callGeminiChat(prompt, key);
  if (!chatResult.ok) {
    fail(res, 502, chatResult.message);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(chatResult.text) as unknown;
  } catch {
    fail(res, 502, 'Gemini returned story JSON that could not be parsed.');
    return;
  }

  if (!isRecord(parsed)) {
    fail(res, 502, 'Gemini returned story JSON in an unexpected shape.');
    return;
  }

  const cast = parseCast(parsed.cast);
  const pages = parseStoryPages(parsed.pages, breakdownPageCount);
  if (!cast || !pages) {
    fail(res, 502, 'Gemini returned story JSON in an unexpected shape.');
    return;
  }

  sendJson(res, 200, { ok: true, cast, pages });
}

async function handleIllustration(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const key = apiKey();
  if (!key) {
    fail(res, 503, MISSING_KEY);
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    fail(res, 400, 'The illustration request body must be valid JSON.');
    return;
  }

  if (!isRecord(body)) {
    fail(res, 400, 'The illustration request body must be a JSON object.');
    return;
  }

  const artStyleId = body.artStyleId;
  const sceneDescription = body.sceneDescription;
  const script = body.script;
  const castRaw = body.cast;
  const referenceImageBase64 = body.referenceImageBase64;

  if (!isGeneratedArtStyleId(artStyleId)) {
    fail(res, 400, 'Choose a generated art style (pencil, watercolour, or simple cartoon), not folk gouache.');
    return;
  }

  if (typeof sceneDescription !== 'string') {
    fail(res, 400, 'Each illustration needs a scene description.');
    return;
  }

  if (typeof script !== 'string') {
    fail(res, 400, 'Each illustration needs the page script as context.');
    return;
  }

  const cast = parseCast(castRaw);
  if (!cast) {
    fail(res, 400, 'The illustration request needs a valid cast object.');
    return;
  }

  if (referenceImageBase64 !== null && typeof referenceImageBase64 !== 'string') {
    fail(res, 400, 'The reference image must be null or a base64 PNG string.');
    return;
  }

  if (typeof referenceImageBase64 === 'string' && referenceImageBase64.length === 0) {
    fail(res, 400, 'The reference image base64 could not be decoded.');
    return;
  }

  const prompt = buildIllustrationPrompt(
    artStyleId,
    sceneDescription,
    script,
    cast,
    typeof referenceImageBase64 === 'string',
  );

  const imageResult = await callGeminiImage(prompt, referenceImageBase64, key);
  if (!imageResult.ok) {
    fail(res, 502, imageResult.message);
    return;
  }

  sendJson(res, 200, {
    ok: true,
    mediaType: 'image/png',
    imageBase64: imageResult.imageBase64,
  });
}

export function attachGenerationRoutes(server: ViteDevServer): void {
  server.middlewares.use((req, res, next) => {
    const url = req.url?.split('?')[0] ?? '';
    const method = req.method ?? 'GET';

    if (url === '/api/generation/health' && method === 'GET') {
      void handleHealth(req, res);
      return;
    }

    if (url === '/api/generation/story' && method === 'POST') {
      void handleStory(req, res);
      return;
    }

    if (url === '/api/generation/illustration' && method === 'POST') {
      void handleIllustration(req, res);
      return;
    }

    next();
  });
}
