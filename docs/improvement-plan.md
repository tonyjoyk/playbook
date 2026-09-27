# Storybook Generator — Improvement Plan (toward the reference)

**Trigger:** Review of `out/scene-7.png` against `reference-image.png`.
**Contributors:** Sam (Design, lead reviewer), Hari (Engineering), Akansha (Product).
**Date:** 2026-06-16

---

## Verdict in one line

The output nails the *layout* but reads like a **flat-vector diagram**, not a **gouache painting**. Sam puts us at **~35–40%** of the reference. The whole team agrees the gap is dominated by two things — **texture** and **palette** — not by missing content.

---

## Sam's gap analysis (most impactful first)

1. **Texture / brushwork — biggest gap.** Reference shapes are mottled: visible brush streaks, chalky grain, darker edges / lighter centers, soft wobbly outlines. Ours read as clean flat color fields. *(Note from Hari: texture exists in the pipeline but is under-tuned — grain is at 5% opacity and fills have little internal variation, so it effectively reads flat.)*
2. **Color & palette.** Reference greens are dusty, desaturated, and span a wide value range (near-black shadow to pale sage, plus teal). Ours are too saturated, minty, and uniform.
3. **Foliage density & variety.** Reference is lush — dozens of distinct leaf forms in overlapping layers, no background showing. Ours is sparse and repetitive (mostly one rounded-blob shape), with flat green gaps between clumps.
4. **Mesa + atmosphere.** Reference is one broad **flat-topped** mesa with vertical erosion striations and a soft luminous haze. Ours reads as **two pointed peaks**, flat, no glow.
5. **Dinosaurs.** Reference silhouettes are characterful: long graceful sauropod necks, dot spots + dot eyes, and clear **triangular** stegosaurus plates. Ours have stubby necks, no spots, and plates that read as faint bumps.

Lower priority: children slightly too large / under-detailed; pond needs lily pads + rim rocks + water banding; foreground wants oversized dark framing leaves.

Sam's concrete specs (for when we build): greens ramp `#2F4A32 / #4A6B43 / #6F8C5A / #8AA06B / #BCC79A` + teal `#3D6B63`, global saturation −30%; grain ~10–12%; mesa width ×1.4 with flat top + radial glow `#F2C5BF` ~35%; sauropod neck ×1.4 with 8–10 spots; stegosaurus 6–8 overlapping triangular plates, body ×1.25.

---

## Engineering reality check (Hari)

Most of this is buildable without touching the architecture. Two constraints to respect:

- **resvg has no `mix-blend-mode` and only partial `feBlend`.** Sam's "multiply grain" can't be done literally — workaround is to keep the dark `feTurbulence` grain layer and raise its opacity (~0.10) using the existing `feComposite` mask. Near-identical result on our mid-value canvas.
- **"Internal value variation" must not become gradients** (it'd break the matte rule). Instead, add a second slightly-inset `tone()`-shifted shape per mass — the technique already used for the sauropod belly and mesa highlight. The one place a gradient is acceptable is the atmospheric mesa glow.

Effort + file map (S/M/L):

| Fix | Where | Effort |
|---|---|---|
| Grain 0.05→0.10; punchier `paperGrain` | `scene.js`, `render/filters.js` | **S** |
| Desaturate + widen greens; soften coral | `palettes/summer.js` (+ wider `rng.pick` arrays) | **S** |
| Internal mottling (inset tone shapes) | `flora.js`, `creatures.js` | **M** |
| Mesa: drop 2nd peak, flat top, ×1.4, glow, striations | `primitives/mesa.js`, `scene.js` | **M** |
| Dinosaurs: longer necks, spots, real plates, bigger | `primitives/creatures.js`, `scene.js` | **M** |
| Foliage density ×4–5 + new leaf primitives (monstera, banana, palm-crown, shrubs) | `scene.js` counts (easy) + `flora.js` new shapes (the real work) | **L** |
| Children scale/detail, pond lilies/rocks, foreground leaves | `scene.js`, `child.js`, `pond.js` | **S** each |

Performance watch: every instance carries a `wobble` filter and resvg re-evaluates turbulence per filtered group — so a jump to ~80 plants should group same-band foliage under **one** parent filter. Determinism guard: every new shape/instance must take an explicit seed label via `makeRng`/`makeNoise`, never `Math.random()`.

---

## Product decision — ship "v0.2" small (Akansha)

This is still a **feasibility proof**: the only question is *does it read as gouache?* By that test, **texture (#1) and palette (#2) are the whole ballgame** — they decide the style verdict. Foliage density, mesa shape, and dinosaur polish amplify or confirm a verdict we haven't earned yet; a lush, well-shaped, flat-vector jungle is still flat vector.

**v0.2 = palette re-tune + texture pass. Everything else deferred to v0.3.**

Build it in **three small batches**, re-rendering and gut-checking after each (no big-bang rewrite):

1. **Palette first** (isolated) → re-render → judge the greens alone.
2. **Texture pass on ONE shape type** (e.g. mesa or one leaf band) → re-render → judge grain/wobble/mottle before rolling out.
3. **Roll texture across all shapes** → full re-render → Sam's verdict.

We learn after batch 2 whether the texture engine is even worth rolling out — before spending the effort.

### v0.2 success criteria
- **Gut test:** at thumbnail size, does it read as a *painting* or a *diagram*?
- Sam's read moves from ~35–40% to **≥60%** toward the reference.
- Greens read natural/varied (≥4 distinct values visible), not minty/uniform.
- Visible paint character on edges and fills — no perfectly flat fills, no razor edges.

### Risk being watched
**Over-fitting this one hardcoded scene.** Texture + palette must be built as **reusable, parameterized treatments**, not eyeballed for this single frame — otherwise the feasibility "yes" won't survive scene #2.

---

## Recommended next action

Implement **v0.2 batch 1 (palette)** and **batch 2 (texture on one shape)**, re-render, and review against this success bar before doing the larger foliage/mesa/dino work in v0.3.
