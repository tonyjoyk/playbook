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
