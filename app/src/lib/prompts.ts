import type { ArtStyleId, GeneratedArtStyleId } from '../types';
import { GENERATED_ART_STYLE_IDS } from '../types';

const GENERATED_STYLE_BLOCKS: Record<GeneratedArtStyleId, string> = {
  'pencil-sketch':
    'STYLE: Black-and-white children\'s-book pencil sketch. Simple drawings, clear shapes, little background noise. NEGATIVE: photorealistic, 3D render, colour, rendered story sentences, a different style.',
  'watercolour-storybook':
    'STYLE: Soft watercolour children\'s-book illustration. Simple shapes, the same characters on every page. NEGATIVE: photorealistic, 3D render, rendered story sentences, a different style.',
  'simple-cartoon':
    'STYLE: Bold simple cartoon shapes for a children\'s book. Not a comedy animation frame. NEGATIVE: photorealistic, 3D render, rendered story sentences, a different style.',
};

export function isGeneratedArtStyleId(value: unknown): value is GeneratedArtStyleId {
  return (
    typeof value === 'string' &&
    (GENERATED_ART_STYLE_IDS as readonly string[]).includes(value)
  );
}

export function styleBlock(artStyleId: ArtStyleId): string {
  if (!isGeneratedArtStyleId(artStyleId)) {
    throw new Error('folk-gouache is not a generated style');
  }
  return GENERATED_STYLE_BLOCKS[artStyleId];
}

export function buildGeneratedStoryPrompt({
  theme,
  detailedWriteup,
  pageCount,
}: {
  theme: string;
  detailedWriteup: string;
  pageCount: number;
}): string {
  const notes = detailedWriteup.trim() || '(no extra notes)';
  return `Write one children's picture book. Stay faithful to the theme and notes. You may add connective tissue. Do not replace the premise. Short warm concrete prose a person can read aloud. Not an outline. Not a moral unless the notes asked for one.

Theme: ${theme}
Notes: ${notes}

Return JSON only, no markdown. The object has "cast" and "pages".
cast is { "characters": [{"name","appearance"}], "places": [{"name","appearance"}], "objects": [{"name","appearance"}] }.
pages has exactly ${pageCount} items, in order. Each item is { "pageNumber": n, "script": "story text", "sceneDescription": "what the picture shows" }. pageNumber starts at 1. sceneDescription does not ask for words drawn in the picture.`;
}

export function buildBreakdownPrompt({
  theme,
  detailedWriteup,
  pageCount,
}: {
  theme: string;
  detailedWriteup: string;
  pageCount: number;
}): string {
  return `You are helping me break my own story idea into a picture-book outline. DO NOT write the full story or finished prose. Instead, give me gentle nudges and idea-prompts, page by page, drawn ONLY from my notes below, so I can write it myself.

Do not invent characters, events, or themes not present in my notes.

Theme: ${theme}
My detailed notes: ${detailedWriteup}

Produce a markdown file with a page-by-page breakdown for ${pageCount} pages.
For each page give: (1) the idea/beat to cover (1 line), (2) 2–3 nudging questions or options to help me write it, (3) a one-line note on what the illustration could show. Keep it light — these are prompts for my own writing, not the story itself.`;
}

const IMAGE_STYLE_BLOCK = `STYLE: Naive folk-art gouache children's-book illustration — visible brushstrokes, simplified rounded shapes, flat decorative composition, layered overlapping forms, matte chalky texture, handmade imperfections, limited muted palette, strong silhouettes, low detail, child-friendly.
NEGATIVE: photorealistic, 3D render, cinematic lighting, hyper-detail, sharp focus, Pixar/Disney/anime.

Use the attached reference image as the style guide. Keep characters and palette consistent with it.`;

export function buildImagePrompt(sceneDescription: string): string {
  const scene = sceneDescription.trim() || '(describe the scene for this page)';
  return `${scene}

${IMAGE_STYLE_BLOCK}`;
}
