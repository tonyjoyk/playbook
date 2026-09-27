---
title: Playbook Pal demo storybook
status: draft
created: 2026-09-27
updated: 2026-09-27
---

# PRD: Playbook Pal demo storybook

Working title: Playbook Pal. Confirm before final.

## 0. Document Purpose

This PRD is for Tony and for the downstream BMAD skills that will design the experience, record architecture decisions, and break the work into stories. It describes the demo change on the existing Playbook Pal web app. It builds on the June 2026 product draft at `PRD-playbook-pal.md` and on the code in `app/`. It does not replace that draft, and it does not restate the vector-editing roadmap.

Vocabulary is anchored in the Glossary. Features group the demo. Functional requirements are numbered FR-1 onward and stay stable if features are reordered. Inferences are tagged `[ASSUMPTION]` and listed again in the Assumptions Index. How the current app stores data, and how generation should be wired, lives in `addendum.md` in this same folder. UX specifications, the architecture spine, and implementation stories are later artifacts. This PRD does not contain them.

## 1. Vision

Playbook Pal already lets a person assemble a picture book page by page. Today the person writes the words and brings their own pictures. For this demo, the same app should take a short idea and return a finished visual storybook the presenter can show to other people in one sitting.

The person enters a Theme, adds Notes, chooses a Page count, and chooses an Illustration style. The app writes the Story text for every Page and draws an Illustration for every Page. The Story text on each Page is the text of the book. The book reads as one story from the first Page to the last. Characters, places, and important objects keep a stable appearance. The selected Illustration style does not drift.

The demo succeeds when a presenter can open the existing editor, start from a blank Story, and leave with a complete Storybook view without pasting prompts into another product.

### 1.1 Current product

Playbook Pal is a local web app. A Story holds a title, a Theme, Notes, a Page count, one Illustration style, and an ordered list of Pages. Each Page holds Story text, a Visual description, and an optional Illustration. The setup screen already collects Theme, Notes, and Page count. A separate style screen offers one style, folk-art gouache. The app does not call a model. It copies a prompt the person pastes elsewhere, then the person uploads a picture onto the Page. Pictures and project data stay in the browser. The page rail and the main canvas are the way a person looks at the book. Upload, vector tracing, and object editing already work and stay in the product.

The June 2026 draft said the app would nudge the author and would not write the story. This demo reverses that for the generated path: the app writes the Story text and the Illustrations. The manual prompt-and-upload path remains available. Generate is the primary action in the setup dialog. Copy-prompt stays in the editor and is visually secondary, so the live path is the one Maya hits first.

## 2. Target User

### 2.1 Jobs To Be Done

- Show a small group a complete picture book that started as a one- or two-line idea.
- Keep the story the presenter's idea: Theme and Notes decide what the book is about.
- Leave the sitting with words and pictures already on the Pages, ready to click through.
- Rely on one Illustration style and a stable look for recurring characters and places, so the book feels made rather than assembled from unrelated pictures.

### 2.2 Non-Users (v1)

- Teams who need accounts, shared editing, or a hosted library of books.
- Readers who want print fulfillment, a store, or animation.
- Authors who want the app only to suggest beats and who will write every line themselves. That remains possible through the existing editor, and it is not the demo path.

### 2.3 Key User Journeys

**UJ-1. Maya shows a finished book that started as a sentence.**

`[ASSUMPTION: "Maya" is a stand-in for the presenter. The session is on a laptop browser, already on the Playbook Pal editor, with no account.]`

- **Persona + context:** Maya is showing Playbook Pal to a few people. She has a personal idea and about one sitting.
- **Entry state:** The editor is open on a new Story. The setup dialog is available. No Pages have Story text or Illustrations yet.
- **Path:** She types a Theme. She types Notes. She sets the Page count. She chooses an Illustration style, starting from pencil sketch unless she picks another. She presses Generate, the primary action. The adapter answers, or she sees why it did not and does not start in front of the room. Page 1 appears with Story text and an Illustration before the rest of the book is drawn. She can stop there if the look is wrong. Otherwise each later Page appears as it finishes. She then moves through the Storybook view.
- **Climax:** Every Page shows Story text and an Illustration in the chosen style, and the book is one continuous story.
- **Resolution:** The Story stays in the editor. She can change words, regenerate one Illustration, or export with the tools already there.
- **Edge case:** Generation fails on one Page. The Pages that finished stay in place. She can retry the failed Page without losing the rest of the book, and without a second Illustration left attached to that Page.

## 3. Glossary

- **Story** — One book project. It has a stable Story id, a title, a Theme, Notes, a Page count, one Illustration style, a Cast, and an ordered list of Pages.
- **Story id** — The stable identifier of a Story. It does not change when the title changes or when Illustrations are regenerated.
- **Page** — One spread in a Story. It has a stable Page id, a Page number, Story text, a Visual description, and at most one current Illustration.
- **Page number** — The 1-based position of a Page in the Story at the time an Illustration is stored. The Page id, not the Page number, is what keeps an Illustration attached if Pages are later reordered.
- **Theme** — The one- or two-line idea the person types first.
- **Notes** — The longer "Tell us more" text. Together with the Theme, Notes are the only story inputs the generator may invent from.
- **Page count** — How many Pages the generated Story must contain.
- **Illustration style** — The look applied to every Illustration in a Story. The generated set is Pencil sketch, Watercolour storybook, and Simple cartoon.
- **Pencil sketch** — Black-and-white children's storybook pencil. The default Illustration style for a new Story. `[ASSUMPTION]`
- **Watercolour storybook** — Soft watercolour children's-book Illustration style.
- **Simple cartoon** — Flat, simple cartoon children's-book Illustration style.
- **Story text** — The words shown on a Page. Generated Story text is the book text, not a private prompt.
- **Visual description** — The picture direction for one Page, used to make that Page's Illustration.
- **Illustration** — The picture stored for one Page. A Page has one current Illustration. Regenerating replaces it.
- **Cast** — The short record of characters, places, and important objects in a Story, with the visual traits later Illustrations must keep.
- **Storybook view** — The way the presenter reads the finished Story, Page by Page, using the existing page rail and canvas.
- **Generation** — The app writing Story text, Visual descriptions, the Cast, and Illustrations from the Theme, Notes, Page count, and Illustration style.

## 4. Features

### 4.1 Story intake

**Description:** The presenter sets the inputs Generation needs before any Page is written. The existing setup dialog already collects Theme, Notes, and Page count. The Illustration style choice joins that same start, using the existing style-selection pattern. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: Capture a Theme

The presenter can enter a Theme of one or two lines before Generation.

**Consequences (testable):**
- The Theme is saved on the Story and is still there after the browser is reloaded.
- Generation does not start while the Theme is empty.

#### FR-2: Capture Notes

The presenter can enter Notes in the existing "Tell us more" field before Generation.

**Consequences (testable):**
- Notes are saved on the Story and survive reload.
- Generation uses the Notes together with the Theme.
- `[ASSUMPTION: Generation may start when Notes are empty, and the Theme alone is then the whole idea.]`

#### FR-3: Choose a Page count

The presenter can set the Page count before Generation. The control already allows 1 through 99.

**Consequences (testable):**
- The generated Story contains exactly that many Pages.
- A Page count below 1 or above 99 is rejected by the existing control.

#### FR-4: Choose an Illustration style

The presenter can choose Pencil sketch, Watercolour storybook, or Simple cartoon before Generation. A new Story starts on Pencil sketch. `[ASSUMPTION: folk-art gouache stays as a style for the existing manual prompt and upload path, and it is not one of the three generated styles.]`

**Consequences (testable):**
- The chosen Illustration style is saved on the Story.
- Every Illustration produced for that Generation uses that style.
- Changing the style after Generation applies on the next Generation for the Pages that are generated again, and does not silently restyle Illustrations that were not regenerated.

### 4.2 Story generation

**Description:** Generation turns the Theme, Notes, and Page count into Story text the presenter can read on the Pages. Each Page is written with knowledge of the whole Story so later Pages follow from earlier ones. The words on the Page are the book. Realizes UJ-1.

**Functional Requirements:**

#### FR-5: Generate Story text for every Page

The presenter can start Generation and receive Story text for every Page in the Page count.

**Consequences (testable):**
- Each Page's Story text is visible in the existing editor and in the Storybook view.
- The Pages in order read as one story that begins from the Theme and Notes and ends on the last Page.
- Events and characters that are not supported by the Theme or Notes are not required for the story to work. `[ASSUMPTION: the model may add only the connective tissue needed to make those inputs into a picture book, and may not introduce a new premise.]`
- Story text is prose for the Page, not an outline of questions for the presenter to answer.

#### FR-6: Attach a Visual description to every Page

Generation stores a Visual description on each Page, alongside the Story text.

**Consequences (testable):**
- Every generated Page has a non-empty Visual description.
- The Visual description matches the Story text on that same Page.
- The presenter can read and edit the Visual description in the existing scene field.

#### FR-7: Keep later Pages consistent with earlier Pages

Generation of a later Page has access to the Theme, the Notes, the Cast, and the Story text of the Pages before it.

**Consequences (testable):**
- A character or event introduced on an early Page is not contradicted on a later Page.
- The last Page resolves the story begun on the first Page.

**Notes:** `[NOTE FOR PM]` The product requirement is coherent Pages. Whether that is one model response for the whole Story or a sequence of responses is an implementation choice recorded in the addendum.

### 4.3 Illustration generation

**Description:** After the Pages have Story text and Visual descriptions, the app creates one Illustration per Page in the Story's Illustration style. Pencil sketch is black-and-white children's storybook pencil. The other two styles are named in the Glossary and stay fixed for the whole Story. Realizes UJ-1.

**Functional Requirements:**

#### FR-8: Generate one Illustration per Page

The presenter can have an Illustration created for each Page from that Page's Visual description, the Illustration style, and the Cast.

**Consequences (testable):**
- Each generated Page shows its Illustration on the canvas and as the rail thumbnail.
- A Page does not show a second, older Illustration beside the current one.
- Illustration generation uses the Story text only as context. The words drawn inside the picture are not required. `[ASSUMPTION: pictures do not contain rendered story sentences.]`

#### FR-9: Lock the Illustration style for the Story

The Illustration style chosen at intake is the style of every Illustration in that Generation.

**Consequences (testable):**
- A Pencil sketch Story produces black-and-white pencil Illustrations on every Page.
- A Watercolour storybook Story produces watercolour Illustrations on every Page.
- A Simple cartoon Story produces simple cartoon Illustrations on every Page.
- A Page is not left in a different style from the rest of the Story unless that Page failed and has no Illustration.

#### FR-10: Show each Page as it completes, and recover a failed Page

The presenter can see Generation move Page by Page. Each Page that finishes appears with its Story text and Illustration before the next Illustration is required. A failed Page can be retried from that Page.

**Consequences (testable):**
- The room sees Page 1 before Pages 2 onward are drawn.
- Each later Page appears when its Illustration is stored, rather than only at the end.
- A failure on one Page leaves successful Pages on screen.
- Retry is available on the failed Page and replaces that Page's Illustration in the same place.
- Retry does not add another picture for the same Page and does not clear the Pages that succeeded.

#### FR-17: Check the model adapter before Generation starts

The presenter can start Generation only when the local model adapter answers. If it does not, the app says what is wrong and does not begin.

**Consequences (testable):**
- A missing credential, an unreachable adapter, or a refused connection produces a message the presenter can read aloud or act on.
- No Page is left half-written by a start that never reached the model.
- A successful check is quiet. It does not add a screen.

### 4.4 Visual consistency

**Description:** Recurring characters, places, and objects keep the same appearance on later Pages. Generation writes a Cast and passes it into every Illustration. From the second Page on, the first successful Illustration goes with the request whenever the image API accepts a reference. The live demo depends on that reference path. Cast text remains in every request either way. Realizes UJ-1.

**Functional Requirements:**

#### FR-11: Record a Cast for the Story

Generation writes a Cast that names the characters, places, and important objects and describes the visual traits that must stay fixed.

**Consequences (testable):**
- The Cast exists before the second Page's Illustration is requested.
- Traits in the Cast for a character who appears on more than one Page do not conflict across Pages.
- The presenter does not have to type the Cast by hand for the demo path.

#### FR-12: Give later Illustrations the Cast and prior visual context

Each Illustration request includes the Illustration style, the Page's Visual description, and the Cast. From the second Page on, the request also includes the visual context of earlier Pages that share a Cast entry.

**Consequences (testable):**
- A character described in the Cast looks like the same character on every Page where the Visual description includes them.
- A place that recurs is recognisable as the same place.
- From Page 2 onward, the first successful Illustration is attached to the image request whenever the image API accepts a reference image.
- The live demo uses that reference path. Cast text alone is not the consistency plan for a sitting in front of other people. `[ASSUMPTION: the chosen image API accepts one reference image. If a candidate API does not, it is the wrong API for this demo.]`

### 4.5 Illustration identity and retrieval

**Description:** Each Story has a stable Story id. Each Page has a stable Page id. The current Illustration for a Page is stored under a predictable key derived from the Story and the Page, and a later retrieval finds that same Illustration. Regenerating replaces the Illustration for that Page. The existing browser storage remains the store. The identifier is not a timestamp. Realizes UJ-1.

**Functional Requirements:**

#### FR-13: Store each Illustration under a stable key

The app stores the current Illustration for a Page so it can be loaded again after Generation and after reload.

**Consequences (testable):**
- Reloading the browser shows the same Illustration on the same Page.
- The storage key does not use the clock as its identity.
- The key can be derived from the Story id and the Page. The addendum records the exact key shape.
- Two Pages in the same Story do not share one Illustration key.

#### FR-14: Replace the Illustration in place on regenerate

Regenerating a Page's Illustration keeps a single current Illustration for that Page.

**Consequences (testable):**
- After regenerate, the canvas shows the new Illustration.
- The Page does not list both the old and the new Illustration as current.
- Other Pages' Illustrations are unchanged.

### 4.6 Storybook view on the existing editor

**Description:** The finished book is read in the app that already exists. The page rail and canvas stay the primary surface. The smallest addition is a reading presentation if the editing controls make the demo hard to follow. Realizes UJ-1.

**Functional Requirements:**

#### FR-15: Read the finished Story Page by Page

The presenter can move through every Page and see that Page's Story text and Illustration together.

**Consequences (testable):**
- After Generation, the first Page is shown with its Story text and Illustration.
- Next and previous reach every generated Page.
- Empty Pages that were not part of Generation are not required in the Storybook view.

#### FR-16: Keep the existing editor available

Generation fills the existing Story, Pages, Story text, Visual descriptions, and Illustrations. It does not remove upload, text editing, page reorder, vector tracing, or export.

**Consequences (testable):**
- After Generation, the presenter can edit Story text on a Page and the edit remains after reload.
- The presenter can still upload a replacement picture onto a Page.
- Vector tracing and export behave as they do today on whatever Illustration is current.
- The procedural scene compiler under `src/` is unchanged by this demo.

**Out of Scope:**
- A new visual design system, a new navigation model, or a separate book-reader product.

## 5. Non-Goals (Explicit)

- Rebuilding Playbook Pal, or replacing the Vite and React editor with another framework.
- Calling a model from a new backend product. Any credential stays off the page, and the mechanism is in the addendum.
- Making folk-art gouache a generated Illustration style in this demo.
- Improving vector tracing, object moving, inpainting, or the procedural SVG scene compiler.
- Accounts, collaboration, sharing links, print fulfillment, or animation.
- Using timestamps as the identity of an Illustration.
- Writing a second planning system beside BMAD. Later UX, architecture, and story artifacts use the installed BMAD folders.

## 6. MVP Scope

### 6.1 In Scope

- Theme, Notes, Page count, and Illustration style on the existing start of a Story.
- Three generated Illustration styles, with Pencil sketch as the default.
- Generation of Story text, Visual descriptions, a Cast, and one Illustration per Page.
- Coherence across Pages and a stable look for recurring Cast entries.
- Stable Illustration identity and in-place regenerate.
- A Storybook view on the current page rail and canvas.
- A pre-start check of the local model adapter, with a readable failure.
- Page 1 on screen before the rest of the Illustrations are drawn, then each later Page as it completes.
- The first successful Illustration sent as a reference for later Pages.
- Generate as the primary setup action. Copy-prompt remains available and is visually secondary.
- A retry on a failed Page. Successful Pages stay.
- The existing editor, upload, vector tools, and export left in place.

### 6.2 Out of Scope for MVP

- Mobile-first layout. `[ASSUMPTION: the demo is a laptop browser.]`
- A presenter-authored Cast editor. The Cast is produced by Generation.
- Multiple Stories open at once beyond what the current single-Story browser save already does.
- Hosted storage, user accounts, or a shared gallery.
- Restyling Illustrations that were already generated when the Illustration style changes, until those Pages are generated again.
- Phase 2 vector-editing goals from `PRD-playbook-pal.md`.

## 7. Success Metrics

**Primary**

- **SM-1:** A presenter completes UJ-1 in one sitting, from an empty Story to a Storybook view, with Generate as the action they press. Target: one uninterrupted demo, with Page 1 visible before the rest of the book is drawn. Validates FR-1 through FR-10, FR-15, and FR-17.
- **SM-2:** Every generated Page shows Story text and one Illustration, and a reload shows the same pairing. Target: no missing Page and no swapped Illustration in the demo Story. Validates FR-5, FR-8, FR-13, FR-14.

**Secondary**

- **SM-3:** A viewer who did not watch Generation can retell the plot from the Pages in order. Target: the story is followable without the presenter explaining missing beats. Validates FR-5 and FR-7.
- **SM-4:** Recurring characters and the Illustration style match across Pages well enough that the presenter does not apologise for a drift. Validates FR-9, FR-11, and FR-12.

**Counter-metrics (do not optimize)**

- **SM-C1:** Number of new screens. Counterbalances SM-1. A new screen that the current editor could have hosted is a failure.
- **SM-C2:** How editable the vectors are. Counterbalances SM-2. Vector quality is out of scope. The demo is not improved by spending time there.

## 8. Open Questions

1. Should empty Notes block Generation, or is the Theme enough? FR-2 assumes the Theme is enough.
2. Should folk-art gouache remain visible beside the three generated styles? FR-4 assumes it stays for the manual path only.
3. Is a separate reading presentation required, or is the current rail and canvas enough for the people Maya is showing? FR-15 allows either, and the addendum prefers the rail and canvas unless a walkthrough proves the editor chrome gets in the way.
4. What Page count should the demo script use? The control allows 1–99. `[NOTE FOR PM]` A short book, about 6–8 Pages, is easier to finish live. The product still honors the number the presenter sets.

## 9. Assumptions Index

- §1.1 — Copy-prompt stays in the editor and is visually secondary to Generate.
- §2.3 — Maya stands in for the presenter. The demo is a laptop browser with no account.
- §3 — Pencil sketch is the default Illustration style for a new Story.
- §4.1 FR-2 — Generation may run with empty Notes.
- §4.1 FR-4 — Folk-art gouache stays for manual prompt and upload, and is not a generated style.
- §4.2 FR-5 — The model may add connective tissue and may not replace the premise in the Theme and Notes.
- §4.3 FR-8 — Illustrations do not need rendered sentences inside the picture.
- §4.4 FR-12 — The live demo depends on the image API accepting the first Illustration as a reference. An API that cannot do that is the wrong API for this demo.
- §6.2 — The demo is not a phone layout.
- §8 — A live demo is most reliable around 6–8 Pages, while the control still accepts 1–99.

## 10. Constraints and Guardrails

These bind the demo because the product already exists and the sitting is in front of other people.

- **Existing code is the source of truth.** Generation writes into the current Story and Page fields. It does not introduce a parallel book model.
- **Privacy of the credential.** The model credential is not shipped in the browser bundle. The addendum records the local boundary.
- **Cost of a live sitting.** Generation must finish a short Story while people are watching. Page count is the presenter's lever. There is no batch of alternate books.
- **Safety of the picture book.** Story text and Illustrations stay suitable to show as a children's picture book. Violent, sexual, or otherwise unsafe expansions of the Theme are out of the demo. `[ASSUMPTION: no separate moderation product is built. The style and story instructions carry this, and a failed or unsafe Page can be retried or edited by hand.]`

## 11. Aesthetic and Tone

- **Pencil sketch:** black-and-white pencil, simple children's storybook drawings, clear shapes, little background noise.
- **Watercolour storybook:** soft watercolour, the same simplicity, still a children's book.
- **Simple cartoon:** bold simple shapes, still a children's book, not a comedy animation frame.
- **Story text:** short Page prose a person can read aloud. Warm, concrete, and faithful to the Theme and Notes. Not an outline, not a prompt, not a moral tacked on when the Notes did not ask for one.
- **Anti-references:** photorealistic scenes, 3D animation stills, and a different style on each Page.

## 12. Platform

Playbook Pal stays a local web app in the desktop browser the presenter already runs. `[ASSUMPTION: no installable mobile client and no hosted multi-user deployment are part of this demo.]` The June 2026 draft's bring-your-own-prompt behavior remains in the product. This PRD adds Generation beside it.
