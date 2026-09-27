import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import {
  buildGeneratedStoryPrompt,
  isGeneratedArtStyleId,
  styleBlock,
} from '../src/lib/prompts.ts';
import type { Cast, CastEntry } from '../src/types.ts';

export const IMAGE_MODEL = 'gpt-image-2';
/** Chat Completions + JSON mode; see https://developers.openai.com/api/docs/models/gpt-4o-mini */
export const TEXT_MODEL = 'gpt-4o-mini';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_GENERATIONS_URL = 'https://api.openai.com/v1/images/generations';
const OPENAI_EDITS_URL = 'https://api.openai.com/v1/images/edits';

type FailBody = { ok: false; message: string };

type StoryPage = {
  pageNumber: number;
  script: string;
  sceneDescription: string;
};

function apiKey(): string | undefined {
  const key = process.env.OPENAI_API_KEY;
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

function openAiErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
    return payload.error.message;
  }
  return fallback;
}

async function callOpenAiChat(prompt: string, key: string): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });
  } catch {
    return { ok: false, message: 'Could not reach OpenAI for the story request.' };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: 'OpenAI returned a story response that could not be read.' };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: openAiErrorMessage(payload, 'OpenAI could not generate the story.'),
    };
  }

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.choices) ||
    payload.choices.length === 0 ||
    !isRecord(payload.choices[0]) ||
    !isRecord(payload.choices[0].message) ||
    typeof payload.choices[0].message.content !== 'string'
  ) {
    return { ok: false, message: 'OpenAI returned a story in an unexpected shape.' };
  }

  return { ok: true, text: payload.choices[0].message.content };
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
): string {
  const style = styleBlock(artStyleId);
  const castText = [
    formatCastSection('Characters', cast.characters),
    formatCastSection('Places', cast.places),
    formatCastSection('Objects', cast.objects),
  ].join('\n\n');

  return `${style}

Scene: ${sceneDescription.trim()}

${castText}

Story context for this page (do not render these words in the picture): ${script.trim()}`;
}

function imageBase64FromPayload(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.data) || payload.data.length === 0) {
    return null;
  }
  const first = payload.data[0];
  if (!isRecord(first)) return null;
  if (typeof first.b64_json === 'string') return first.b64_json;
  return null;
}

async function callOpenAiGeneration(
  prompt: string,
  key: string,
): Promise<{ ok: true; imageBase64: string } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetch(OPENAI_GENERATIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        n: 1,
      }),
    });
  } catch {
    return { ok: false, message: 'Could not reach OpenAI for the illustration request.' };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: 'OpenAI returned an illustration response that could not be read.' };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: openAiErrorMessage(payload, 'OpenAI could not generate the illustration.'),
    };
  }

  const imageBase64 = imageBase64FromPayload(payload);
  if (!imageBase64) {
    return { ok: false, message: 'OpenAI returned an illustration in an unexpected shape.' };
  }

  return { ok: true, imageBase64 };
}

function buildMultipartEditsBody(
  prompt: string,
  pngBytes: Buffer,
): { contentType: string; body: Buffer } {
  const boundary = `----playbook-${crypto.randomUUID()}`;
  const parts: Buffer[] = [];

  const appendField = (name: string, value: string) => {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  };

  appendField('model', IMAGE_MODEL);
  appendField('prompt', prompt);

  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image[]"; filename="reference.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
  );
  parts.push(pngBytes);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: Buffer.concat(parts),
  };
}

async function callOpenAiEdit(
  prompt: string,
  referencePng: Buffer,
  key: string,
): Promise<{ ok: true; imageBase64: string } | { ok: false; message: string }> {
  const { contentType, body } = buildMultipartEditsBody(prompt, referencePng);

  let response: Response;
  try {
    response = await fetch(OPENAI_EDITS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': contentType,
      },
      body,
    });
  } catch {
    return { ok: false, message: 'Could not reach OpenAI for the illustration edit request.' };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: 'OpenAI returned an illustration edit response that could not be read.' };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: openAiErrorMessage(payload, 'OpenAI could not edit the illustration.'),
    };
  }

  const imageBase64 = imageBase64FromPayload(payload);
  if (!imageBase64) {
    return { ok: false, message: 'OpenAI returned an edited illustration in an unexpected shape.' };
  }

  return { ok: true, imageBase64 };
}

async function handleHealth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!apiKey()) {
    fail(res, 503, 'Add OPENAI_API_KEY to app/.env and restart.');
    return;
  }
  sendJson(res, 200, { ok: true });
}

async function handleStory(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const key = apiKey();
  if (!key) {
    fail(res, 503, 'Add OPENAI_API_KEY to app/.env and restart.');
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

  const chatResult = await callOpenAiChat(prompt, key);
  if (!chatResult.ok) {
    fail(res, 502, chatResult.message);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(chatResult.text) as unknown;
  } catch {
    fail(res, 502, 'OpenAI returned story JSON that could not be parsed.');
    return;
  }

  if (!isRecord(parsed)) {
    fail(res, 502, 'OpenAI returned story JSON in an unexpected shape.');
    return;
  }

  const cast = parseCast(parsed.cast);
  const pages = parseStoryPages(parsed.pages, breakdownPageCount);
  if (!cast || !pages) {
    fail(res, 502, 'OpenAI returned story JSON in an unexpected shape.');
    return;
  }

  sendJson(res, 200, { ok: true, cast, pages });
}

async function handleIllustration(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const key = apiKey();
  if (!key) {
    fail(res, 503, 'Add OPENAI_API_KEY to app/.env and restart.');
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

  const prompt = buildIllustrationPrompt(artStyleId, sceneDescription, script, cast);

  let imageResult: { ok: true; imageBase64: string } | { ok: false; message: string };

  if (referenceImageBase64 === null) {
    imageResult = await callOpenAiGeneration(prompt, key);
  } else {
    let referencePng: Buffer;
    try {
      referencePng = Buffer.from(referenceImageBase64, 'base64');
    } catch {
      fail(res, 400, 'The reference image base64 could not be decoded.');
      return;
    }
    if (referencePng.length === 0) {
      fail(res, 400, 'The reference image base64 could not be decoded.');
      return;
    }
    imageResult = await callOpenAiEdit(prompt, referencePng, key);
  }

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
