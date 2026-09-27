# Reconcile — demo brief

Source: Tony demo brief, 2026-09-27. Compared to `prd.md` and `addendum.md`.

## Covered

- **Planning on existing app, not a rebuild; reuse current UI; smallest UI changes as intent** — Non-Goals §5 (no rebuild/new framework); FR-16; Out of Scope §4.6 (no new design system/navigation); SM-C1 (counter-metric on new screens).
- **No scope for unrelated product features; complete generation flow** — MVP §6.1; Non-Goals §5; FR-1–FR-10, FR-15–FR-17; manual path preserved (FR-16, §1.1).
- **Flow: Theme → Tell us more (Notes) → page count → illustration style → story → illustration per page → view book** — FR-1–FR-4 intake; FR-5–FR-8 generation; FR-15 Storybook view; UJ-1.
- **Three styles: Pencil sketch (B&W children’s pencil, demo default), Watercolour storybook, Simple cartoon** — Glossary §3; FR-4; §11 Aesthetic and Tone; MVP §6.1.
- **Visual consistency across pages** — FR-7, FR-11, FR-12; §4.4; SM-4.
- **Stable illustration identity (not timestamps); story id + page; overwrite on regenerate** — FR-13, FR-14; Non-Goals (no timestamp identity); addendum “Illustration keys” (`story/{storyId}/page-{pageNumber}`).
- **Folk-gouache kept for manual path, not one of the three generated styles** — FR-4 `[ASSUMPTION]`; Non-Goals §5; addendum “What the code does today”.
- **Pre-mortem: Generate primary; adapter check with readable failure; no half-written pages** — §1.1; FR-17; addendum “How Generation should extend that”.
- **Page 1 (text + image) before rest; later pages as they finish** — FR-10; UJ-1; MVP §6.1; SM-1.
- **Reference image from first successful illustration from page 2 on; Cast text still sent; wrong API if no reference** — FR-12; Assumptions Index §4.4 FR-12; addendum illustration sequencing.
- **Missing key / unreachable adapter → readable message** — FR-17 consequences.

## Gaps

1. **Whether the presenter has API keys (story + images) — asked, unanswered before “final”**  
   Brief: explicitly wanted that question captured; it was not answered. PRD/addendum assume a local adapter and `OPENAI_API_KEY` in the environment (addendum “How Generation should extend that”) and §10 credential privacy, but neither lists key availability as an **Open Question** nor any intake/check beyond adapter reachability at Generate time (FR-17). Silent on the unresolved planning decision.

2. **“Generates story page-by-page” vs batched story text**  
   Brief flow: story generation **page-by-page**, then illustration per page. PRD FR-10 streams **Illustrations** page-by-page after Page 1, but addendum assumes **one structured response** returns all Pages’ story text and Visual descriptions before any Illustration request. No FR or consequence that story text **appears** incrementally page-by-page during the story phase—only that illustrations complete sequentially.

3. **Stop if Page 1 looks wrong (during in-progress generation)**  
   Brief (pre-mortem): user can stop if Page 1 looks wrong. UJ-1 states this narratively; FR-10 covers retry on **failure** and progressive display, but there is no numbered FR with testable consequences for **aborting or cancelling** in-flight generation after Page 1 without treating it as a hard failure.

4. **“No extra features” / smallest UI vs optional reading presentation**  
   Brief: reuse current UI, smallest changes, no extra features. FR-15 and Open Question §8.3 allow a **separate reading presentation** if rail/canvas are insufficient; addendum story split item 5 mentions Storybook view wiring. Softer than the brief’s “complete flow only on existing surfaces” default—implementation could add UI the brief discouraged unless explicitly rejected in planning.

5. **“Visual consistency without over-engineering” as a product guardrail**  
   Brief asked for consistency **without over-engineering**. PRD fully specifies Cast (FR-11), reference-image dependency for the live demo (FR-12), and pre-start adapter check (FR-17)—appropriate given later pre-mortem items in the brief, but the brief’s **proportionality** constraint is not restated as a guardrail (e.g. no presenter Cast editor, no multi-reference pipeline). MVP §6.2 excludes Cast editor; other simplification limits are mostly `[ASSUMPTION]` rather than consequences tied to the brief phrase.

## Scope the PRD added

- **Children’s picture-book safety guardrail** (§10 Constraints): violent/sexual/unsafe expansions out of demo; moderation via instructions + retry/edit—not in the demo brief.
- **Success metrics and counter-metrics** (§7): formal SM-1–SM-C2 including “no new screens” as counter-metric—brief implied minimal UI but did not ask for a metrics section.
- **Explicit Visual description field** as generated, editable, non-empty per Page (FR-6)—brief said illustration per page; PRD makes scene direction a first-class persisted artifact.
- **Open Questions and demo scripting** (§8): empty Notes, folk-gouache visibility in picker, suggested 6–8 pages for live demo—brief did not request these product forks.
- **Downstream BMAD / June 2026 draft framing** (§0, Non-Goals): scope of planning artifacts and non-replacement of historical PRD—process scope beyond the demo brief.
