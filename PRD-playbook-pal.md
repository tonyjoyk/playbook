# PRD — Playbook Pal

**Product:** Playbook Pal — a guided storybook-maker app
**Author:** Akansha (Product) · for Hari (Engineering) to pick up
**Status:** Draft v1 · **Date:** 2026-06-16
**Related docs:** `docs/feasibility-and-mvp-approach.md`, `docs/shape-accuracy-discussion.md` (the SVG/illustration engine), `CLAUDE.md`

---

## 1. Summary

Playbook Pal helps anyone turn a personal idea into an illustrated storybook. It walks the user
from a one-line theme → a guided story breakdown → a page-by-page editor (like Google Slides) →
consistent AI-generated illustrations → and, eventually, *editable vector* art they can rearrange
on the page.

The product's bet: most people have a story worth telling but get stuck on (a) structuring it and
(b) producing coherent art. Playbook Pal removes both blockers **without writing the story for
them** and **without locking them into one AI model** — it generates ready-to-paste prompts the
user runs in their own tools (Claude for the story breakdown, ChatGPT/an image model for visuals).

## 2. Problem & opportunity

- Non-technical storytellers can't produce a good-looking, consistent picture book. DIY tools give
  either blank pages (too hard) or fully auto-generated stories (impersonal, generic).
- AI art is powerful but inconsistent page-to-page and hard to edit after the fact.
- Opportunity: a gentle, opinionated workflow that keeps the **human as the author**, enforces a
  **consistent art style**, and turns flat AI images into **editable vector scenes**.

## 3. Goals & non-goals

**Goals**
- Take a user from raw idea to a complete, illustrated, multi-page storybook draft.
- Keep the user as the storyteller — the app *nudges*, it does not ghostwrite.
- Produce visually consistent illustrations via a defined art style.
- Lay the foundation for editable vector illustrations (move objects on a page).

**Non-goals (for now)**
- We do **not** call image/LLM APIs ourselves in early phases — the user brings their own (Claude,
  ChatGPT). Direct API integration is a later candidate, not a near-term goal.
- We do **not** auto-write the full story.
- Multiple art styles, printing/fulfilment, collaboration/multi-user, and animation are out of
  early scope.

## 4. Target users & personas

- **Primary — "The Personal Storyteller":** a parent, partner, teacher, or hobbyist making a
  personal/gift picture book from a real memory or idea. Non-technical. Comfortable copy-pasting
  into ChatGPT/Claude. Cares about the story feeling *theirs* and looking beautiful.
- **Secondary — "The Educator":** wants to produce themed illustrated material quickly with a
  consistent look.

## 5. Product principles

1. **Nudge, don't ghostwrite.** Every generative step helps the user shape *their* story; the story
   breakdown gives prompts and idea-nudges, never a finished narrative.
2. **Bring your own AI (model-agnostic).** The app outputs copy-paste prompts; the user runs them in
   Claude / ChatGPT. No API keys, no per-generation cost, no model lock-in in early phases.
3. **Consistency by default.** A single, well-specified art style guarantees a coherent book.
4. **Editable by design (the differentiator).** Vectorization turns static AI art into objects the
   user can rearrange — the long-term moat.
5. **Familiar surface.** A Google-Slides-style page rail makes the editor instantly understandable.

---

## 6. User journey

The end-to-end flow the product must support. (Stages map to epics in §8.)

1. **Theme.** The user enters an overall theme in 1–2 lines.
   *Example: "Me and a friend had a discussion today about the meaning of life."*
2. **Detailed write-up.** The user writes a longer description: what they discussed and what they
   want the story to be about.
3. **Story-breakdown prompt.** The app generates a **pre-written prompt** the user copies into
   Claude. Running it returns a markdown file with a **page-by-page breakdown**. Important: the
   breakdown does **not** write the full story — it gently **nudges** the user with ideas drawn from
   their write-up, broken out per page. The prompt has an **easily editable field for the number of
   pages (default 8).**
4. **Pages editor.** A left-hand page rail (like Google Slides). The first page exists already and is
   blank. The user adds pages manually.
5. **Add the script.** The user copies the words (the "script") for each page in. They can **edit**
   each page's text, **reorder** pages, and **add/remove** text and pages.
6. **Scene words per page.** Each page holds words that describe the scene (user-editable). Pages are
   added/removed manually.
7. **Choose art style.** The user picks an art style. *For now there is only one* — the reference
   folk-art gouache style (`reference-image.png`).
8. **Generate image prompts.** After choosing the style, the app generates, for each page, a prompt
   the user can paste into an image model (e.g. ChatGPT) to get visuals in the correct style. A
   **reference image is shown for the user to download** to feed alongside the prompt.
9. **Upload images per page.** The user returns to each page and uploads the image they generated.
   The selected page shows as a **small thumbnail in the left rail** and **large in the main canvas**.
   Each page offers an **upload** control.
10. **Vectorize (option).** The user can choose to **vectorize** the uploaded image.
11. **Edit on canvas.** Once vectorized, the user can **move objects around** on the page. The
    original **raster image remains available** somewhere on the page to click into and **download**;
    clicking the raster **enlarges** it.

> The object-moving experience in step 11 depends on cleaner vector output than VTracer gives today —
> see §10 (engine improvements) and §9 (these land in **Phase 2**).

---

## 7. Functional requirements (by capability)

- **Story intake:** two text inputs (theme; detailed write-up), persisted to a project.
- **Breakdown-prompt generator:** assembles a templated prompt embedding the user's write-up, with an
  editable `page count` (default 8); one-click **copy**. (App does not call the LLM.)
- **Pages model & editor:** ordered list of pages; each page = { script text, scene description,
  image (raster), vector (later), object layout (later) }. Add / edit / reorder (drag) / delete.
  Left rail of thumbnails + main canvas for the selected page. First page auto-created, blank.
- **Art style:** selectable style (single option now); selection stored on the project; drives the
  image-prompt template + which reference image is offered.
- **Image-prompt generator:** per-page prompt combining the page's scene description + the style's
  master prompt; one-click copy; **download reference image**.
- **Image upload:** per-page upload (PNG/JPG); validate; show as thumbnail + main canvas.
- **Vectorize:** convert an uploaded page image to SVG (VTracer fork, tuned params); show vector on
  canvas; **preserve raster**, click-to-enlarge + **download raster**.
- **Object editing:** select/move/(resize/reorder) individual vector objects on a page.
- **Save/export:** persist the project; export the book (PDF and/or per-page images; vector/SVG export
  later).

---

## 8. User stories (for Hari)

Tagged by release: **[MVP]**, **[P1]**, **[P2]**. Each has acceptance criteria (AC).

### Epic A — Story setup
- **A1 [MVP]** As a storyteller, I want to enter a 1–2 line theme, so I can frame my book.
  *AC:* short text input; required; saved to project; visible in later steps.
- **A2 [MVP]** As a storyteller, I want to write a longer detailed description, so the breakdown has
  substance to work from. *AC:* multiline input; autosaves; no length cap (soft guidance shown).

### Epic B — Story-breakdown prompt
- **B1 [MVP]** As a storyteller, I want the app to give me a ready-made prompt to paste into Claude,
  so I get a page-by-page breakdown without writing the prompt myself.
  *AC:* prompt includes my write-up verbatim; one-click copy; opens/links to Claude optionally.
- **B2 [MVP]** As a storyteller, I want the breakdown to **nudge** me with ideas rather than write the
  story, so the book stays mine. *AC:* template explicitly instructs "breakdown & nudges, not a
  finished story" (see Appendix A).
- **B3 [MVP]** As a storyteller, I want to easily change the number of pages (default 8), so I control
  length. *AC:* clearly editable page-count field in the prompt; default 8.

### Epic C — Pages editor (Slides-like)
- **C1 [MVP]** As a storyteller, I want a left rail of pages with a blank first page, so I can build
  my book visually. *AC:* page 1 exists, blank; rail shows thumbnails; selecting shows the page in the
  main canvas.
- **C2 [MVP]** As a storyteller, I want to add pages manually, so the book grows as I need.
- **C3 [MVP]** As a storyteller, I want to paste/edit the **script** text per page, so each page has
  its words. *AC:* editable text area per page; autosaves.
- **C4 [MVP]** As a storyteller, I want a separate **scene description** per page, so I can later turn
  it into an image prompt. *AC:* second editable text field per page.
- **C5 [MVP]** As a storyteller, I want to **reorder** and **delete** pages, so I can restructure.
  *AC:* drag-to-reorder in the rail; delete with confirm; order persists.

### Epic D — Art style
- **D1 [MVP]** As a storyteller, I want to choose an art style, so my book looks coherent.
  *AC:* style picker with one option (the reference folk-art gouache style) selected by default;
  choice stored. Built to accept more styles later.

### Epic E — Image-prompt generation
- **E1 [MVP]** As a storyteller, I want a per-page image prompt in the chosen style, so I can paste it
  into ChatGPT and get on-style art. *AC:* prompt = page scene description + style master prompt
  (Appendix B); one-click copy per page; "copy all" optional.
- **E2 [MVP]** As a storyteller, I want to download the reference image, so I can give the model a
  visual example. *AC:* download button serves the style's reference image.

### Epic F — Image upload
- **F1 [MVP]** As a storyteller, I want to upload my generated image to a specific page, so it becomes
  that page's art. *AC:* per-page upload (PNG/JPG); shows large in canvas + as the rail thumbnail;
  replaceable.

### Epic G — Vectorize
- **G1 [P1]** As a storyteller, I want to vectorize a page's image, so the art becomes scalable and
  (later) editable. *AC:* "Vectorize" action runs the VTracer fork with tuned params; vector renders
  on the page; operation is cancel-able and shows progress.
- **G2 [P1]** As a storyteller, I want my original raster kept and downloadable, so I never lose it.
  *AC:* raster persists; a control to **download** it; **clicking the raster enlarges** it.
- **G3 [P1]** As a storyteller, I want the vector to look clean (not hundreds of stray shapes), so the
  page looks right. *AC:* a path-simplification post-process reduces shape count to a usable level
  (see §10.1; light version may land in P1, full version in P2).

### Epic H — Object editing on canvas (depends on engine work, §10)
- **H1 [P2]** As a storyteller, I want to move objects around a vectorized page, so I can recompose
  the scene. *AC:* select an object; drag to move; change persists; raster still available beneath.
- **H2 [P2]** As a storyteller, I want objects to be clean, separable pieces (no seams/overlap
  artifacts), so moving one doesn't reveal gaps. *AC:* depends on §10.2 (perfect cut-out).
- **H3 [P2]** As a storyteller, I want (optionally) line-art elements as strokes, so certain styles
  read as drawn. *AC:* depends on §10.3 (pencil tracing).
- **H4 [P2]** As a storyteller, I want to resize/reorder/layer objects, so I have real layout control.

### Epic I — Save & export
- **I1 [MVP]** As a storyteller, I want my project saved automatically, so I can return to it.
- **I2 [MVP]** As a storyteller, I want to export my book (PDF and/or per-page images), so I can share
  or print it. *AC:* export composes each page's text + image into output files.
- **I3 [P1]** As a storyteller, I want vector/SVG export, so my book stays crisp at any size.

### Epic J — VTracer engine (the fork) — see §10
- **J1 [P2]** Path simplification post-process. **J2 [P2]** Perfect cut-out mode. **J3 [P2]** Pencil
  tracing. (Detailed in §10.)

---

## 9. Release plan — MVP, Phase 1, Phase 2

### MVP — "Idea → illustrated storybook draft (bring-your-own-AI)"
The smallest thing that delivers the core value: a complete, on-style, multi-page storybook the user
authored, with their own AI images placed page by page. **No vectorization, no object editing.**

Includes: A1–A2, B1–B3, C1–C5, D1, E1–E2, F1, I1–I2.

**MVP success = a user can go from a one-line theme to an exported multi-page book with their words
and an uploaded on-style image on each page, in one sitting, without help.**

### Phase 1 — "Make the art scalable & safe to keep"
Adds vectorization as a *view/quality* feature (not yet free object-moving), preserving and enlarging
the raster, plus crisp export.

Includes: G1, G2, G3 (light path-simplification), I3. Uses the **`tonyjoyk/vtracer`** fork as-is with
our tuned params (`mode=spline, color_precision≈6, layer_difference≈16, filter_speckle≈8,
corner_threshold≈70, splice_threshold≈45, hierarchical=stacked`) + a colour→style-slot mapping so
vectors can later be recoloured.

### Phase 2 — "Editable canvas"
The differentiator: move objects around a page. This **requires** the three VTracer engine
improvements (§10), because today's output isn't clean/separable enough to manipulate.

Includes: J1–J3 (engine), then H1–H4 (canvas editing). Candidate extras: multiple art styles,
direct model-API integration, sharing.

| Capability | MVP | Phase 1 | Phase 2 |
|---|:--:|:--:|:--:|
| Theme + detailed write-up | ✅ | | |
| Claude breakdown-prompt (nudges, editable page count=8) | ✅ | | |
| Slides-style page editor (add/edit/reorder/delete) | ✅ | | |
| Single art style + per-page image prompts + reference download | ✅ | | |
| Upload image per page (thumbnail + canvas) | ✅ | | |
| Export (PDF / images) | ✅ | | |
| Vectorize image (view), raster preserved + click-to-enlarge/download | | ✅ | |
| Light path simplification + colour→slot mapping; SVG export | | ✅ | |
| Move/resize/layer objects on canvas | | | ✅ |
| VTracer: path simplification (full), perfect cut-out, pencil tracing | | | ✅ |
| Multiple styles / direct API / sharing | | | ✅ (candidate) |

---

## 10. VTracer engine improvements (Phase 2) — fork: `github.com/tonyjoyk/vtracer`

All engine work happens in **Tony's fork** (`tonyjoyk/vtracer`, forked from `visioncortex/vtracer`,
MIT). These three changes are **necessary to let users move objects around** (Phase 2). They mirror
the upstream "What's next" list and are not yet implemented in the fork.

1. **Path simplification.** A post-process filter on the output paths to reduce the number of splines.
   *Why:* raw traces produce hundreds of shapes (we measured ~680 on one crop); too many to edit or
   render efficiently. *(A light version may be pulled into Phase 1 for display quality; the robust
   version belongs here.)*
2. **Perfect cut-out mode.** Today's cut-out mode produces shapes that don't share boundaries
   perfectly — they have **seams**. *Why:* to move one object without revealing gaps/overlaps, objects
   must tile cleanly. Needed for H1/H2.
3. **Pencil tracing.** Instead of tracing shapes as closed filled paths, skeletonize them into **open
   paths** — clean, fixed-width strokes. *Why:* enables line-art elements and cleaner editable
   geometry for certain styles. Supports H3.

**Engineering note (Hari):** the fork is a native Rust project (also published to crates.io / PyPI via
pyo3). Decide early how the app invokes it — bundled CLI/binary, a Rust→WASM build for in-browser
tracing, or a small server endpoint. WASM keeps it client-side and model-agnostic, matching the
bring-your-own-AI principle; a server is simpler to ship first. This choice is an open question (§13).

---

## 11. Technical considerations (non-binding guidance)

- **Reuse the existing illustration engine.** The SVG→PNG renderer, palette **slots**, gouache
  filters, and determinism rules in this repo (`src/…`, see `CLAUDE.md`) should back the style system,
  reference rendering, and the colour→slot mapping for vectorized art.
- **Likely a web app** (page rail + canvas). Framework TBD; keep the page/project model simple and
  serializable (JSON) from day one so MVP data survives into later phases.
- **Bring-your-own-AI** means MVP has no LLM/image API calls — just prompt templating + clipboard +
  file upload. Cheapest, fastest, model-agnostic.
- **Determinism / provenance:** the user owns their generated art (no copyright concern), so vector
  output may ship — but still simplify + tokenize colours to keep it editable and on-style.

## 12. Success metrics

- **Activation:** % of users who go theme → at least one page with text **and** an uploaded image.
- **Completion:** % who export a book of ≥ N pages (target default 8).
- **Story ownership:** qualitative — users report the story still feels like *theirs* (the nudge
  principle is working).
- **Phase 1:** % of pages vectorized; raster-recovery used without data loss.
- **Phase 2:** % of users who move ≥1 object; edits without visible seams/artifacts.

## 13. Risks & open questions

- **Risk — too many manual copy-paste hops** (Claude for breakdown, ChatGPT for each image) may feel
  laborious. *Mitigation:* tight UX, "copy all prompts," clear step guidance; revisit direct API
  integration once the flow is validated.
- **Risk — vector quality** isn't good enough to move objects. *Mitigation:* Phase-1 vectorize is
  view-only; gate Phase-2 editing on the §10 engine work landing.
- **Risk — scope creep** into multi-style/API too early. *Mitigation:* one style, BYO-AI, until MVP
  proves the core loop.
- **Open Q1:** How does the app run the fork — bundled binary, WASM in-browser, or a server endpoint?
- **Open Q2:** Does "light path simplification" belong in Phase 1 (for usable vector display) or stay
  fully in Phase 2? Recommendation: a minimal simplification in P1, robust version in P2.
- **Open Q3:** Export format priority for MVP — PDF vs per-page PNGs vs both?
- **Open Q4:** Where is project data stored in MVP (local/browser vs account/cloud)?

---

## Appendix A — Story-breakdown prompt template (for Epic B)

> Draft to be refined with Sam/Hari. `{{...}}` are app-filled; **[PAGES]** is the user-editable field.

```
You are helping me break my own story idea into a picture-book outline. DO NOT write the full story
or finished prose. Instead, give me gentle nudges and idea-prompts, page by page, drawn ONLY from my
notes below, so I can write it myself.

Theme: {{theme}}
My detailed notes: {{detailed_writeup}}

Produce a markdown file with a page-by-page breakdown for [PAGES] = 8 pages.
For each page give: (1) the idea/beat to cover (1 line), (2) 2–3 nudging questions or options to help
me write it, (3) a one-line note on what the illustration could show. Keep it light — these are
prompts for my own writing, not the story itself.
```

## Appendix B — Per-page image prompt template (for Epic E)

> Combines the page's scene description with the style master prompt (from the project style guide).

```
{{page_scene_description}}

STYLE: Naive folk-art gouache children's-book illustration — visible brushstrokes, simplified rounded
shapes, flat decorative composition, layered overlapping forms, matte chalky texture, handmade
imperfections, limited muted palette, strong silhouettes, low detail, child-friendly.
NEGATIVE: photorealistic, 3D render, cinematic lighting, hyper-detail, sharp focus, Pixar/Disney/anime.

Use the attached reference image as the style guide. Keep characters and palette consistent with it.
```

*(Full style spec lives in the project style guide; the reference image is `reference-image.png`.)*
