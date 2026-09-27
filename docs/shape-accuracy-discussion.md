# Team Discussion — How to Significantly Improve SVG Shape Accuracy

**Problem from Tony:** the output still looks very different from the reference. The issue is
**not** the gouache texture — it's the *shape* of objects and characters. The dinosaurs, plants,
mesa and children are generic procedural blobs; they don't match the specific, art-directed
silhouettes in the reference. "Think creatively between the team and document the discussion."

**Participants:** Sam (Design), Hari (Engineering), Akansha (Product). Two rounds.
**Date:** 2026-06-16

---

## The core realization (unanimous)

> **This is a *representation* problem, not a *tuning* problem.**

Texture was something we could dial in. Shape can't be — because of *how* we generate shapes.
Every object is currently a low-frequency closed curve around a center: `blobPoints()` is a
perturbed ellipse, `ribbon()` is a centerline swept to a width, `leafPoints()` is a
sine-width teardrop. Simplex noise adds **low-amplitude wobble to a convex blob**. That family
of functions can only ever produce *generic organic mass*.

The features that make a silhouette *read* as a specific thing are exactly what noise cannot create:

- **Concavities and inflection points** — the S-curve where a brachiosaurus neck meets the
  shoulder; the cusps between stegosaurus plates; the splits in a monstera leaf.
- **Art-directed, asymmetric proportion** — the reference sauropod is ~60% neck with a tiny
  tilted head. Our neck is a stiff tapered tube.
- **Sharp local detail / negative space** — toes, plate spikes, leaf serrations. Noise
  *averages these away*; raising amplitude just makes a noisier blob, never a sharper feature.

As Hari put it: the recognizable shape "isn't in the span" of perturbed ellipses — no seed,
frequency or amplitude lands on "brachiosaurus." Sam: "noise adds variation *within* a shape;
it cannot *author* the shape." Akansha: "'infinitely generative from nothing' was a *means* we
fell in love with, not the product."

---

## Creative approaches considered (Round 1 brainstorm)

| # | Approach | Where accuracy comes from | Keeps recolor/variation? | Verdict |
|---|---|---|---|---|
| A | Hand-authored SVG path library (illustrator-drawn) | Human eye | Yes, if slotted | Ideal, but no human illustrator on this team |
| B | Raster→vector **tracing** of the reference (potrace/VTracer) | The source image | Poorly (fused paths, baked colors) | Provenance + recolor problems → demote to a *tool*, not the asset |
| C | **LLM-authored SVG paths** to a written spec (Claude as illustrator) | Spec + model + human/visual accept-reject loop | Yes | Most promising given the team has no illustrator |
| D | Designer draws in Figma/Illustrator → export → tokenize | Professional pen | Yes | Same as A; needs a person/tool we don't have |
| E | **Control-point silhouette templates** traced off the reference, run through our existing jitter renderer | Where we place the points | Yes, natively | Great for *fine-tuning*; slow/blind as a first draft |
| F | Puppet/component assembly (head, neck, body, legs as posable parts) | Per-part authoring + procedural pose | Yes | Right for *many poses*; over-engineered for static scenes now |
| — | Hybrid AI raster image + code for layout | Image model | **No** — kills SVG editability, palette control, determinism | Rejected as the renderer; keep only as a reference generator |

The division of labor everyone agreed on: **artists (or an LLM acting as one) author *shape*;
code authors *arrangement*** — composition, layering, palette + seasonal recolor, placement,
scale, per-instance jitter, and the texture work already done.

---

## The hard question (Round 2): who actually draws the assets?

The team has **no human illustrator and no Figma/Illustrator**. So the candidates collapse to:
LLM-authored paths (C), tracing the reference (B), or control-point templates (E). This is where
the creative resolution happened.

**Sam (design) ranked them — counter-intuitively — LLM-authored #1, traced #2, control-points #3:**
- Tracing the reference is "seductive but wrong as the primary": it inherits the reference's
  lighting and raster noise, welds us to one pose, and produces a single *fused* blob path —
  the very failure we're escaping. Keep tracing as a **measurement tool** (extract proportions
  and the neck curve), then redraw.
- An LLM can author clean, intentional, *separable* sub-paths to a brief **and iterate against
  its own rendered PNG** — and the style language transfers to future animals. The catch: a
  model can't eyeball proportion from prose, so art direction must be a **visual loop, not a
  one-shot prompt**.

**Hari (engineering) proposed the creative combo that resolves provenance — "trace-as-grader, not trace-as-asset":**
- **VTracer is the grader; Claude is the author.** Crop the reference → VTracer it into an
  accurate **target mask** (never shipped). Claude drafts *original* Bézier paths to our spec,
  informed by the trace's proportions. Render → **silhouette-diff** (IoU/Chamfer) against the
  mask → feed the diff back → iterate 3–5 rounds until it clears threshold. We get the trace's
  *accuracy* with authored paths' *originality + recolorability*. "Neither pure-trace (over-fit,
  ugly to recolor) nor pure-LLM (drifts off-style)."

**Akansha (product) set the decision criteria and guarded scope:**
- Optimize for **repeatability** (regenerate from a written spec in minutes), **cost at the
  10th asset, not the 1st**, and **provenance** (spec-driven authoring over tracing; if we trace,
  it's a temporary geometry guide we redraw, never shipped path data).
- Risks flagged: **over-fitting to this one reference** (tune until perfect, learn nothing
  transferable) and **a pipeline too slow to ever fill a scene** ("beautiful asset, dead product").

### Resolution — the authoring pipeline (agreed)

1. **Crop** the reference to the one object (the silhouette *oracle* only).
2. **VTracer** the crop → an accurate outline used purely as a **target mask / grader** (not shipped).
3. **Claude authors original SVG path data** to a written spec — clean cubic Béziers, named
   sub-paths, color **slots**, no black keylines, flat cut-paper forms.
4. **Render → silhouette-diff vs the mask**, plus Sam's visual checklist → annotate the single
   biggest shape error → **re-author. Iterate 3–5 loops.**
5. **Clean** (cap control points, snap handles) and tag **slots + anchors + jitterTargets**.

---

## Points of disagreement (and how they resolved)

**How much part-structure? (single outline vs "puppet")**
- *Hari:* single continuous outline + a few named sub-paths (belly, eye, leg-overlap). A full
  posable rig invites seam artifacts at every joint when recolor/jitter hit independently —
  "earn the puppet by shipping the outline first."
- *Sam:* concedes more than expected — the sauropod does **not** need 4 separate legs or an
  articulated neck spline at this scene scale. But holds firm that **the neck+head must be its
  own named sub-path with an eye anchor** — "the entire identity lives in the head-on-long-neck
  relationship; if that's a jitter blob it dies."
- *Akansha:* single outline for v0.3; parts only when a scene need demands it (no gold-plating).
- **Resolved → a "lightly jointed cutout":** one confident authored silhouette (body+legs+tail
  as a grounded mass), **neck+head as a deliberate named sub-path**, an **eye** dot via anchor,
  plus Sam's fidelity technique below. No articulated rig.

**VTracer = raster-AI?** Akansha warned off raster pipelines. Hari clarified VTracer is used only
as an **automated accuracy grader/oracle**, not as shipped art — the asset stays authored vector.
Agreed.

---

## What we're committing to

**A contained PIVOT, not a rebuild.** Keep the renderer, palette/seasonal recolor, texture, and
jitter. **Swap only the data layer**: noise-driven blob generation → authored shape assets.

### Asset data model (locked)

```js
{
  id, version,
  viewBox: [0, 0, 100, 100],          // normalized authoring frame
  parts: [
    { name: "body", d: "M..C..", slot: "body",  jitterTargets: [/* pt idxs */] },
    { name: "neckHead", d: "M..C..", slot: "body", jitterTargets: [...] },
    { name: "bodyShadow", d: "M..C..", slot: "bodyShade" },   // 2-tone under-mass
    { name: "eye", d: "M..", slot: "ink" },
  ],
  anchors: { head: [x, y], tail: [x, y], ground: [x, y], eye: [x, y] },
}
```

- **Recolor / season:** parts carry a `slot` (body / bodyShade / spot / eye), never a hex; the
  existing slot→palette map handles recolor and seasonal palettes with **zero asset change**.
- **Per-instance jitter:** existing `jitterPoints()` runs on `jitterTargets` control points only
  (not anchors), seeded — silhouette wobbles, topology and proportion hold.
- **Determinism:** the asset is static data; all variation flows through the seeded RNG, so the
  same seed → byte-identical output. Placement/scale stays in the renderer via `anchors`.

### Sam's single highest-leverage fidelity technique

**One 2-tone shadow sub-path per part** (a darker, offset under-mass for belly / far legs /
under-neck, same hue family, recolor-aware). It's how the reference's gouache forms read as
*placed in light* rather than flat stickers — one extra slotted sub-path per asset.

---

## Scope, sequence, and acceptance (Akansha's call)

**v0.3-shapes = author exactly ONE asset: the sauropod.** Everything else — other creatures,
plants, children, the full scene re-skin — is **explicitly deferred**.

**Sequence with a hard checkpoint:**
1. Write the sauropod spec → 2. Author the single asset via the pipeline → 3. Run it through
recolor + jitter + placement → 4. **CHECKPOINT: Tony's thumbs-up on the naive-recognition test**
→ 5. Only then author asset #2 — deliberately a *different* creature — to test that the method
**transfers** before any broader rollout. (The gate exists so we never author 10 assets against
an unvalidated method.)

**Acceptance test for the sauropod (all must pass):**
- **Silhouette / recognizability:** filled solid black at scene size, a naive viewer names it
  "long-neck dinosaur" — with no color or texture. If it reads as a hill, reject.
- **Proportion:** small head (≤ ⅓ neck width), neck longer than body height, tail ≈ neck, a
  single smooth S-curve (no kink).
- **Shape language:** all-curve contours, flat-paper forms, **no black outlines, no gradients**.
- **Eye:** one readable dot, placed high-forward via anchor.
- **Grounding:** belly/feet sit on a believable ground line; not floating or melting into foliage.
- **Recolor:** swaps to the seasonal palette cleanly, no leaked hardcoded color, no muddy seams.
- **Jitter-variation:** 5 seeds visibly differ, none degenerate/self-intersecting.
- **Determinism:** same seed → byte-identical SVG.
- **Silhouette-diff:** IoU ≥ ~0.90 vs the reference mask.

**Top risk being watched:** the method doesn't generalize — the sauropod looks great but asset #2
falls apart. Mitigation: asset #2 is a *different* creature, and we gate before rollout.

---

## Recommended next action

Run the pipeline on the **sauropod** only: VTracer the reference crop as the grader, have Claude
author the slotted Bézier asset against the spec, iterate ~3–5 visual loops, wire it through the
existing recolor + jitter renderer, and bring the single asset back for Tony's thumbs-up **before**
authoring anything else.

---

## Addendum — Learnings from VTracer (visioncortex/vtracer), tested on our crop

We installed VTracer (`pip install vtracer` — it ships as a Python extension since 0.6, so it runs
in our sandbox with no Rust build) and traced the reference sauropod crop. Findings:

**It works, and it's very good.** With spline mode + gentle quantization it produced a clean,
accurate, on-style vector of the whole crop — the brachiosaurus silhouette, spots, palms and mesa
are all faithfully captured, far more accurate than our hand-authored outline. Tuned params that
worked: `mode=spline, color_precision=6, layer_difference=16, filter_speckle=8,
corner_threshold=70, splice_threshold=45, hierarchical=stacked`.

**But it confirms — not overturns — the team's "trace-as-grader, not trace-as-asset" call.** The
trace was **680 paths**, with colors **baked in from the reference** (no semantic slots), and it is
a **direct derivative** of the reference art. So it is not a shippable, recolorable, seasonal asset —
exactly the failure mode we predicted. Shipping it would forfeit recolor, seasonal palettes, and
clean provenance (the real moats).

**Concrete learnings we're adopting:**

1. **Use VTracer as the grader/guide, upgraded.** Its `colormode=binary` (potrace-style) output is a
   cleaner silhouette mask than our hand-rolled color-segmentation mask — better for the IoU gate.
   And its spline output is an excellent *tracing guide* an author (Claude) traces over, then
   re-draws to slots. This **accelerates** authoring future assets without shipping derivative paths.
2. **Parameter map to our folk-art style:** `mode=spline` → smooth gouache-friendly curves; high
   `corner_threshold` → rounded shapes (our shape language); `filter_speckle` → drops foliage noise;
   `color_precision` / `layer_difference` → flatness of color blocks. There's a sweet spot:
   **too aggressive merges subjects into the background; too gentle explodes the path count** (680).
3. **The repo's own roadmap validates two of our decisions:** (a) cut-out mode produces **seams**
   between shapes → reinforces our choice of a *single continuous outline* over assembled "puppet"
   parts; (b) there is **no path-simplification pass yet** → traced paths are heavily
   over-segmented (the 680 paths), so any traced geometry needs a decimation/cleanup step before it
   could become an asset. Also: it needs **lossless PNG** input (jpeg noise hurts) — we already crop to PNG.
4. **A faster authoring pipeline for the remaining assets** (optional upgrade): per object →
   VTracer (binary) for the grader mask **and** (spline) for a tracing guide → author slotted
   Bézier paths over the guide → run a path-simplification pass → tag slots/anchors → existing
   jitter+recolor renderer. This keeps provenance clean and output recolorable while using VTracer's
   accuracy where it's safe (measurement + guidance), not where it's risky (shipped art).

**Net:** VTracer makes the *grader* and the *authoring guide* much stronger and could meaningfully
speed up building the rest of the asset library — but the authored-slotted-asset model stays the
thing we ship.
