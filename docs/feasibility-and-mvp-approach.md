# Storybook Generator — Feasibility & MVP Approach

**Project:** Procedural children's-book scene generator (folk-art gouache style)
**Phase:** Feasibility decision + MVP approach (no code yet)
**Decision locked by Tony:** Pure procedural SVG renderer (deterministic, code-only, no AI image model in v1). SVG → PNG.
**Contributors:** Akansha (Product), Sam (Design), Hari (Engineering)
**Date:** 2026-06-16

---

## TL;DR

It's feasible — but the thing worth building first is *much* smaller than the architecture in the brief. All three of us independently landed in the same place: **build one hand-authored scene (the prehistoric jungle reference image) as procedural SVG, with a real imperfection/texture engine and a seed knob for variation, plus one caption. Nothing else.** That single scene answers the only question that matters right now: *can code produce art that actually looks handmade and charming, not "generated"?* If the answer is yes, we earn the right to build the general engine. If no, we've spent days, not months.

The make-or-break risk is unanimous: **the gouache texture and controlled imperfection.** Crisp vector shapes alone will read as flat corporate clip-art. The hand-painted feel lives in edge wobble + paper grain, and that should be proven on a single shape before we draw a single dinosaur.

---

## 1. Is it feasible?

Yes, with a caveat about *which* version.

The full vision in the brief — a parametric "scene compiler" that generates any setting, season, mood, culture, and a parametric character system — is feasible but is a multi-month engineering effort, and it front-loads exactly the parts most likely to look machine-made (organic foliage density, believable composition, stylized-but-recognizable creatures). That ambition is a *roadmap*, not an MVP.

A single, hand-crafted, lightly-parameterized scene in pure SVG is very feasible and is the correct feasibility test. SVG is a natural fit for this style: flat depth comes free from z-ordered layers, the muted palette is just controlled fills, and the hand-drawn look is achievable with SVG filters and seeded path jitter. Roughly 85% of the target look translates cleanly; the hard ~15% is the chalky matte paint surface, which we approximate rather than truly simulate.

**What's genuinely easy:** layered composition, simplified shape silhouettes, the limited palette, scale/overlap depth, text-on-top, deterministic output, and PNG export.

**What's genuinely hard (budget time here):** convincing chalky/granular gouache texture, soft brush edges, and making imperfection look *intentional and charming* rather than *broken*. This is tuning and taste, not algorithms.

---

## 2. Recommended MVP scope (Akansha — Product)

We framed three options:

- **Option A — Static showpiece.** Hand-coded scene, no variation, one caption. Fastest (days). Proves the *look* but not that it's generative — could be mistaken for a one-off hand drawing.
- **Option B — Seeded single scene. ✅ Recommended.** Hand-coded scene + imperfection engine + seed-driven jitter (foliage/clouds shift, identity holds) + one caption + PNG export. ~1–2 weeks. Proves both that it *looks right* and that *code generates it with variation*.
- **Option C — Mini-compiler.** Scene JSON → multiple palettes + reusable primitive library + character generator. Many weeks. Tests engineering, not the core risk (does it look good?), and front-loads the riskiest parts.

**Recommendation: Option B.** It answers the only question that matters at the lowest cost.

### In v1
- The one reference scene, composed by hand in code (pink mesa, sky, 4 pterosaur silhouettes, blue + pink sauropods, two orange stegosaurs, pond with lotus, two children from behind, layered jungle foliage).
- Imperfection engine: seeded path jitter + a matte gouache texture filter. **This is the style — non-negotiable.**
- One fixed warm-summer palette.
- A `seed` knob so re-running shifts foliage/cloud placement while keeping the scene's identity.
- One hardcoded caption line in a defined safe zone.
- SVG → PNG export, run from the command line.

### Explicitly cut / deferred
- All other seasons, times of day, and the night-palette transform.
- The mood system (bake "wonder" into this one palette).
- The parametric **character generator** (hardcode two kids instead).
- A reusable primitive *library as a goal* (extract primitives only where it's faster, don't design a system).
- Any GUI.
- Multiple scene types, cultures, or settings.

### Text-on-scene, minimal
One caption line, one font, a defined safe zone (a soft "torn-paper" band rather than a UI bar), basic legibility (paper panel carries the contrast). No word-wrap engine, no dynamic fitting. A single hardcoded string proves the page reads as a storybook page — that's all v1 needs.

---

## 3. Visual system (Sam — Design)

**Feasibility verdict:** composition and shape language land beautifully in SVG; the paint *surface* is the hard 20%. We fake chalky texture with a low-opacity `feTurbulence` (fractalNoise) grain overlay plus per-shape mottling — it reads as textured paper, which is acceptable. We avoid linear gradients entirely (they read digital/3D and break the brief); instead we stack 2–3 near-tone semi-transparent blobs per mass to suggest pigment variation.

**Summer prehistoric palette (~11 swatches, all dusty/desaturated):**

| Role | Hex |
|---|---|
| Sky pale blue | `#BCD8E0` |
| Cloud / blossom pink | `#F3C4C9` |
| Coral mesa | `#E08A7E` |
| Deep volcanic rose | `#C25F5A` |
| Sauropod blue | `#6F9FB0` |
| Pink sauropod | `#E59AAE` |
| Rust stegosaurus | `#C97A4A` |
| Foliage mid-green | `#7A9A5E` |
| Deep shadow green | `#4D6B4A` |
| Highlight sage | `#A9BF86` |
| Pond teal / lotus accent | `#9CC1BD` / `#E96F8E` |

**Shape rules:** rounded corners only (sharp points reserved for plates/leaf tips); chunky proportions (thick necks, egg-like bodies); dot eyes only; build environments large→medium→small (mesa → tree masses → ferns → flower dots).

**Layering order (back → front):** sky → clouds → pterosaurs → mesa → far tree line → blue sauropod → pink sauropod + mid foliage → stegosaurs + pond → foreground leaf frame → children → foreground flowers.

**Imperfection:** apply displacement *per group*, not globally; seeded per-shape so no two leaves match; slight rotation (±3°) and scale jitter on repeated elements.

**Text treatment:** semi-opaque paper-tone band (`#F6EFE2` at ~85%) with wobbly edges (reads as torn paper, not UI). One warm humanist/rounded type (directions: Fraunces, Quicksand, or Baloo 2), one weight, generous leading, max ~2 lines, dark warm ink `#3A2F2A` (never pure black), no drop shadows.

**Single most important thing to get right:** the edge-wobble + grain combo. **Biggest visual risk:** ending up in flat-vector clip-art territory (too crisp, too even, gradient-y).

---

## 4. Architecture & stack (Hari — Engineering)

**Why pure SVG is right:** deterministic by construction, diffable in git, infinitely scalable, inspectable, no GPU/model weights. Determinism and PNG export are both easy; texture and taste are the hard parts.

**Recommended stack (minimal, proven dependencies):**
- **TypeScript / Node** — type the Scene JSON schema; the types *are* the spec.
- **Raw SVG via template strings** (or a tiny `h()` helper) — skip svg.js/paper.js (unneeded runtime object model) and rough.js (its sketchy pen aesthetic fights soft matte gouache). We control every path and filter directly.
- **Seeded RNG:** a ~15-line `mulberry32` PRNG (no dependency).
- **Noise:** `simplex-noise` (one small proven npm package) for path jitter.
- **SVG → PNG:** `@resvg/resvg-js` — native, fast, deterministic, reliable `feTurbulence`/`feDisplacementMap` fidelity. Avoid puppeteer (heavy, nondeterministic font/AA).

Total third-party footprint: `simplex-noise` + `@resvg/resvg-js`.

**Minimal v1 layers (of the 8 proposed):** essential = Shape Grammar (primitives), Color System (one palette), Imperfection Engine, Composition (hardcoded band positions), Renderer. Stub/hardcode = Scene Definition (one hand-authored JSON), Moods (baked in), Character Generator (one `child()` with skin/hair params, not a system).

**Smallest primitive set for the reference scene (~13 generators):** `mesa`, `cloud`, `pterosaur`, `sauropod`, `stegosaurus`, `child` (back view), `palm`, `fern`, `broadLeaf`, `bush`, `flower/lotus`, `pond`, `lilyPad`. Each returns an SVG group from params + a seeded RNG.

**Cheap gouache in SVG (three layered techniques):** (1) seeded simplex path jitter for wobbly edges (near-zero cost); (2) one shared `feTurbulence`→`feDisplacementMap` filter for soft edges + a faint multiplied grain overlay for chalkiness; (3) stacked near-tone semi-transparent fills for pigment buildup. **Trade-off:** displacement on every shape is the performance hog and blurs small detail — so apply one paper-grain filter canvas-wide, cheap jitter per shape, and reserve displacement for a few hero elements with tight filter regions.

**Determinism:** scene JSON carries a top-level integer `seed`; one master PRNG, with per-element sub-seeds derived deterministically (hash `seed + elementId`) so adding an element doesn't shift everyone else's randomness. No `Math.random`/`Date.now`. Same JSON + seed → byte-identical PNG; new seed → consistent variation.

**Ordered build plan:**

1. Skeleton: scene JSON type, PRNG, raw-SVG helper, resvg PNG export. Render one jittered blob; confirm reproducibility.
2. One textured primitive (mesa) with the shared gouache filter — **lock the texture look here** before scaling.
3. Composition bands + palette; place sky, mesa, ground, pond.
4. Flora generators; fill the jungle bands.
5. Fauna (sauropods, stegosaurs, pterosaurs) as parametric silhouettes.
6. Children (back view) + text overlay.
7. Tune imperfection amplitudes and layer opacities to match the reference.

**Verification:** (a) determinism test — render twice, assert identical PNG hash; reseed, assert different hash; (b) visual diff — reference vs output side-by-side against a rubric (palette match, band layout, element presence/placement, texture-reads-as-gouache); (c) SVG snapshot test to catch regressions.

---

## 5. Consolidated risks

| Risk | Owner view | Mitigation |
|---|---|---|
| Output looks "generated" / vector clip-art, not handmade | All three (top risk) | Prove the texture + imperfection on **one** primitive first; treat it as a go/no-go gate before building the scene |
| Scope creep into the general "compiler/engine" | Akansha | Hardcode ruthlessly for one scene; ban "system"/"generator" in v1 |
| Dinosaurs/children look wrong and tank the demo | Akansha | They're hand-tuned art, not parametric — iterate by hand until they charm |
| resvg renders filters differently from browser preview | Hari | Make resvg the source of truth from slice 1; never trust browser-only rendering |
| Filter/performance blowup at full scene | Hari | Shared filters, tight filter regions, jitter over displacement |
| Font rendering nondeterminism | Hari | Bundle the font or convert text to paths |

---

## 6. Success criteria for the MVP

- Side by side, the rendered PNG reads as "the same world" as the reference — a stranger calls it "a children's book illustration," not "a computer drawing."
- Re-running with a new seed produces a recognizably-same-but-varied scene (foliage/clouds shift, identity holds).
- The caption renders legibly on the busy art.
- The gut test: looking at the output makes you *want* to build scene #2.

---

## 7. Recommended next step

On approval, Hari starts at **build-plan slice 2 — the texture go/no-go gate**: a single mesa primitive rendered through the gouache filter + jitter, exported to PNG via resvg. If that one shape reads as hand-painted, we proceed through the rest of the scene. If it doesn't, we stop and rethink the texture approach before investing in the full composition.

*Proposed repo layout for when code begins:* `src/` with `palettes/`, `primitives/`, `characters/`, `compose/`, `imperfection/`, `render/`, and `scenes/` (the hand-authored JSON), plus `scripts/generate.ts`. Output PNGs to `out/`.
