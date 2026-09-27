---
title: Playbook Pal demo storybook — addendum
status: draft
created: 2026-09-27
updated: 2026-09-27
---

# Addendum

Technical decisions and codebase notes that the PRD deliberately keeps out of the requirements. Downstream architecture and stories should start here and in the code, not by rediscovering the repo.

## What the code does today

The running product is the Vite + React app in `app/`. There is no API server, no `.env`, and no ChatGPT or Claude client. `app/src/lib/prompts.ts` builds two clipboard prompts: a breakdown prompt that tells the model not to write the story, and a folk-art gouache image prompt. `StorySetupModal` collects Theme (`project.theme`), Notes (`project.detailedWriteup`), and Page count (`project.breakdownPageCount`). `artStyles.ts` has a single style, `folk-gouache`. The person uploads a PNG or JPG. `useProject.ts` stores it.

A Story is `Project` in `app/src/types.ts`. It already has `id`, `title`, `theme`, `detailedWriteup`, `breakdownPageCount`, `artStyleId`, and `pages`. A Page already has `id`, `script` (Story text), `sceneDescription` (Visual description), and `imageId`.

Persistence is browser-local. The Story JSON is in `localStorage` under `playbook-pal:project`. Illustration bytes are in IndexedDB database `playbook-pal`, object store `playbook-pal-images`. New image ids are `img-${uuid}` from `app/src/lib/project.ts`. The clock is not the image id. `updatedAt` on the Story is the only timestamp, and it is not how a Page finds its Illustration.

`src/` is a separate procedural SVG scene compiler. It does not draw the editor's uploaded or generated Illustrations. Vector tracing, composite editing, and inpainting live in `app/src` and should keep working on whatever image is current.

## How Generation should extend that

`[ASSUMPTION]` One local adapter, not a new framework. A Vite dev middleware or a small route in this Node app reads `OPENAI_API_KEY` from the environment and calls the ChatGPT story and image APIs. The browser sends Theme, Notes, Page count, Illustration style, and, for a retry, the Page. The browser never receives the key.

`[ASSUMPTION]` Story Generation is one structured response that returns every Page plus the Cast. Each Page in that response has a Page number, Story text, and Visual description. The model sees the whole Story while writing later Pages. That satisfies FR-7 without a chain of chat calls. Sequential Page calls are a fallback only if one response cannot carry the Page count the presenter chose.

`[ASSUMPTION]` Story text and Visual descriptions for every Page return before any Illustration is requested, so Page 1 can be shown as soon as its Illustration exists. Illustration requests then run one Page at a time. Each request includes the Illustration style block, the Page's Visual description, and the Cast. From the second Page, the first successful Illustration is attached as a reference. FR-12 requires an image API that accepts that reference. The setup dialog's primary control is Generate. Copy-prompt stays and is visually secondary. Before the first model call, the adapter is checked. A failure there is a message, and no Page is written.

Style prompt blocks, one per generated style, live next to the existing prompt helpers. Pencil sketch instructions require black-and-white children's-book pencil. Watercolour storybook and Simple cartoon have their own blocks. The chosen block is the only style block on every Illustration request for that Story.

Map generated Story text into `page.script` and Visual description into `page.sceneDescription`. Store the Cast on the Story. `[ASSUMPTION]` A new field on `Project`, not a side file.

## Illustration keys

Do not use `img-${uuid}` for generated Illustrations. Store the current Illustration at a key the Page already points to via `imageId`:

```text
story/{storyId}/page-{pageNumber}
```

`storyId` is `Project.id`. `pageNumber` is the 1-based index at Generation time. Regenerating that Page writes the same key again. Other Pages are untouched. The bytes stay in the existing `playbook-pal-images` store. No new database and no filesystem layout.

If the presenter reorders Pages later, the Illustration stays on the Page record through `imageId`. The key is not recomputed from the new position. `[ASSUMPTION]` Reorder during the live demo is unnecessary. The rule is there so a later reorder cannot orphan or duplicate the picture.

Uploaded pictures may keep today's uuid keys. Only generated Illustrations use the stable key. Replacing a generated Illustration by upload clears the generated key and stores the upload the way uploads work today.

## What must not change

- `src/` scene compiler, including its seeded determinism.
- Vectorize, composite, and inpaint flows, except that they read the current Illustration whatever its key is.
- The existing export path, reading current Story text and the current Illustration.
- `PRD-playbook-pal.md` as the historical bring-your-own-prompt spec.

## Suggested story split for the next skill

These are not implementation stories. `bmad-create-epics-and-stories` should turn them into stories with acceptance criteria. Order:

1. Local model adapter and environment contract. No UI.
2. Story fields for the three styles, the Cast, and stable Illustration keys, including old `img-` ids still loading.
3. Story Generation into `script` and `sceneDescription`.
4. Style-locked Illustration Generation with overwrite on retry.
5. Wire Generation into the existing setup and style UI, with progress, retry, and the Storybook view on the current rail and canvas.
