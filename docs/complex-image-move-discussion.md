# Team Discussion — Moving Objects on Complex Uploads (Split-Screen Test Image)

**Trigger from Tony:** object **moving still does not work** on real uploads. We need a different
approach — not more tuning of the same vector-grouping loop.

**Test artifact:** split-screen painterly illustration (bedroom at night ↔ crowded subway) — Tony’s
upload attached 2026-06-21 (`Screenshot_2026-06-21_at_1.33.43_PM.png` in session assets).

**Participants:** Akansha (Product), Sam (Design), Hari (Engineering).  
**Date:** 2026-06-21  
**Prior work:** [object-grouping-discussion.md](./object-grouping-discussion.md),
[character-grouping-ux-review.md](./character-grouping-ux-review.md) (depth-tree + undo shipped;
folk-art reference was the design target).

---

## Akansha — why “move” fails on this image (product framing)

### The job to be done (unchanged)

> **When I click the thing I mean, I move that thing. The page still looks like one illustration —
> not a sticker on a white hole.**

That second clause is what breaks on Tony’s upload. On our **folk-art reference**, shapes sit on
flat colour bands — moving a dinosaur mostly reveals another flat band. On this **painterly
diptych**, moving the man in bed reveals **pillow fabric, headboard wood, and wall** that were
*occluded* — not a solid fill waiting underneath.

So we have **two separate failures**, and fixing only grouping will not make move “work”:

| Failure | User sees | Root cause |
|---------|-----------|------------|
| **A — Wrong selection** | Click man → move half the duvet, or the crowd with the subway guy | Segmentation/grouping on soft, textured edges |
| **B — Wrong hole fill** | Drag 30px → white/empty seam, smeared texture, or duplicated brush strokes | No **inpainting** / layer decomposition — only SVG `translate()` |

**Akansha:** We’ve been treating “editable canvas” as a **vector rearrangement** problem. Tony’s
image proves the real job is **layer extraction + reposition + background repair** — closer to
Canva/Figma “remove background + nudge” or Photoshop “content-aware move,” not Illustrator path
drag on a flat poster.

### What we should *not* pretend

- VTracer cutout + union-find + Group/Ungroup can solve **occlusion** and **painterly texture**.
- One algorithm fixes both left panel (single subject, moderate occlusion) and right panel (crowd,
  partial overlap, shared lighting).
- “Re-vectorize after deploy” fixes move — it only refreshes **groups**, not **holes behind moved pixels**.

### Product question this image forces

**Who is the upload, and what move means:**

| Upload type | Example | Minimum “move works” |
|-------------|---------|----------------------|
| **Type 1 — Flat folk-art** | Procedural reference, flat gouache bands | Vector cutout + group; seam ≤ 2px on flat fills (existing H2 gate) |
| **Type 2 — AI painterly, simple scene** | Bedroom panel alone | Click man → move man + phone; bed/wall **inpainted** behind |
| **Type 3 — AI painterly, crowded scene** | Subway panel | Click foreground man → move without dragging 4 passengers; inpaint crowd gap |
| **Type 4 — Diptych / composite** | Tony’s full image | Either **two edit regions** or accept that “one page” = two independent scenes |

**Recommendation:** Stop expanding Type 1 heuristics until we **name the upload tier** in the UI and
ship move behaviour **per tier**. Tony’s image is **Type 4** (diptych) with **Type 3** complexity on
the right — the hardest case. Success for v1 might be: *“Move works on Type 1–2; Type 3–4 = click
to segment + raster move + inpaint (beta).”*

---

## Sam — what is in this image (visual inventory)

### Composition

Vertical split: **~50% bedroom / ~50% subway**. Shared palette (navy, sage, cream, amber lamp
light) but **no shared objects** across the gutter — functionally **two illustrations on one canvas**.

### Left panel — objects a user might click

| ID | Gestalt name | Visual parts (fills / regions) | Grouping notes |
|----|--------------|----------------------------------|----------------|
| L1 | **Man in bed** | Hair, skin, beard, blue shirt, hand, phone | One character; phone is part of gesture |
| L2 | **Bedding** | Checkered pillow, cross-pattern duvet | Duvet **occludes** torso — not same object as L1 if we move “man” |
| L3 | **Bed frame** | Wooden headboard | Background furniture |
| L4 | **Nightstand cluster** | Table, lamp (glow), mug, saucer | Lamp glow bleeds into wall — edge is soft |
| L5 | **Wall + decor** | Navy wall, window (moon, city), frames, shelf, plant, books | Large background band |
| L6 | **Floor** (if visible) | Dark strip | Minor |

**Sam’s intent test (left):** User clicks the man’s face → selection should include **head, shirt
sleeve, hand, phone** — **not** the duvet, pillow, or wall. After a 40px drag, the **pillow and
headboard** where his head was must be **re-painted**, not white.

### Right panel — objects a user might click

| ID | Gestalt name | Visual parts | Grouping notes |
|----|--------------|--------------|----------------|
| R1 | **Foreground man** | Hair, face, green sweater, phone hand, tote strap | Primary subject |
| R2 | **Tote bag** | White bag, strap over shoulder | Move with R1 or separate? **Product:** with R1 |
| R3 | **Grab strap** | Triangle strap, black tether | Touching his hand — **semantic tie** to R1, **topological tie** to ceiling |
| R4 | **Crowd** | 5–8 partial figures (orange jacket, yellow pattern, etc.) | Each could be own object; many **mutual occlusions** |
| R5 | **Train interior** | Cream walls, poles, windows, map line, city lights | Background |
| R6 | **Other straps** | Second triangle strap | Foreground clutter |

**Sam’s intent test (right):** Click foreground man → **not** the passenger in orange behind his
elbow. Move 30px right → **inpaint** the gap in the crowd; no **cut-out cardboard** edge on the
sweater (brush texture must continue).

### Style constraints (why trace + drag fails visually)

1. **No hard outlines** — edges are value + brush direction, not closed paths.
2. **Shared texture noise** across figure and background — same stipple frequency on skin and wall.
3. **Glow** (lamp, window) — semi-soft halos; vector fills will band.
4. **Contact points** — hand on phone, hand on strap, duvet on chest — segmentation must decide
   **include vs exclude**.

### What success looks like (design acceptance)

**Per panel, at 100% zoom, after one move:**

| # | Check | Pass | Fail |
|---|-------|------|------|
| V1 | Selection outline hugs **one gestalt** (man, not crowd) | Coral outline ±3px of perceived edge | Outline follows colour blob through beard into pillow |
| V2 | Moved figure retains **painterly edge** (soft, not scissors) | Feather ≤ 4px, no hard vector kink | Crisp SVG clip |
| V3 | Source hole **filled** with plausible bed/wall/crowd | No white; texture continues; no obvious clone stamp | White rectangle, blur smear, wrong pattern |
| V4 | **Lighting consistent** in filled region | Shadow direction matches panel | Flat paste patch |
| V5 | **Undo** restores prior pixels + position | Cmd+Z perfect | Partial restore |

**Sam:** For this image, **vector view that matches raster at rest** is still required — but **during
and after move**, a **raster compositing** preview is acceptable if export returns a single flat PNG.
Do not sacrifice V1–V3 to keep pure SVG.

---

## Hari — why the current stack breaks here

### Current pipeline (recap)

```
Upload PNG → VTracer (cutout) → scene SVG groups → SceneDocument → translate(transform) on <g>
```

**What move actually does today:** affine transform on grouped SVG paths. **No** mask, **no**
z-buffer, **no** inpainting. Background paths stay fixed → moving foreground **uncovers empty
viewBox** or wrong static paths underneath.

On folk-art, “underneath” is often the same green hill. On Tony’s image, underneath is **hidden
geometry that was never traced as a separate layer**.

### Grouping limits (even after depth-tree fix)

Depth-tree + cross-fill gestalt helps **folk-art multi-fill characters** (body + belly). On this
upload:

- **Same hue** links shirt, wall, and shadows (navy family).
- **Crowd** is many same-scale blobs — watershed risks **over-split** or **under-merge**.
- **Diptych gutter** is not a semantic boundary for clustering — one raster, one trace.

**Conclusion:** Cluster heuristics on VTracer output are **necessary but insufficient** for Type 2–4
uploads.

---

## Hari — algorithms on the web (what exists, what we can leverage)

Grouped by **problem**, not hype. Links are starting points for spikes — not endorsements to ship
without Sam gate.

### 1. “What did the user click?” — segmentation / instance masks

| Approach | Examples | Pros | Cons for us |
|----------|----------|------|-------------|
| **Interactive click segmentation** | [SAM 2 (Meta)](https://github.com/facebookresearch/sam2), [MobileSAM](https://github.com/ChaoningZhang/MobileSAM), [FastSAM](https://github.com/CASIA-IVA-Lab/FastSAM) | Strong on soft edges; point/box prompt ≈ “click character” | Model weight, GPU/WASM?, non-deterministic unless frozen |
| **Classical graph segmentation** | [Felzenszwalb–Huttenlocher](https://felzenszwalb.com/publications/ijcv2011.pdf), [OpenCV watershed](https://docs.opencv.org/4.x/d7/d1b/group__imgproc__misc.html#ga326827091d93c645976f1b0) | Fast, deterministic | Fails on texture + crowd (we already use watershed conditionally) |
| **Colour + depth clustering** | VTracer hierarchical / `merged_into` depth-tree (our Step B) | Already in pipeline; deterministic | No semantics; weak on painterly AI art |
| **Salient object / rembg** | [rembg](https://github.com/danielgatis/rembg), [RMBG-2.0](https://huggingface.co/briaai/RMBG-2.0) | One foreground blob | Returns **one** mask — useless for subway crowd |
| **Anime / illustration layer split** | [See-through Layer Generation](https://see-through-layer-generation.github.io/), LayerDiff, [Adobe Illustrator Depth (2025)](https://arxiv.org/html/2511.17454) | Designed for flat illustration layers | Research-grade; heavy; may not match ChatGPT brush style |

**Hari spike recommendation:** **SAM 2 point prompt** (one positive click on face, optional negative
on pillow) → binary mask → measure IoU vs Sam’s gestalt outline (V1). Run **client-side** only if
MobileSAM ONNX + WebGPU is viable; else **worker API** with cached mask on `sceneId`.

### 2. “Fill the hole when something moves” — inpainting

| Approach | Examples | Pros | Cons |
|----------|----------|------|------|
| **Large mask inpainting** | [LaMa](https://github.com/advimman/lama), [IOPaint](https://github.com/Sanster/IOPaint) | Built for object removal / move holes | Quality on repeating patterns (duvet crosses) varies |
| **Generative fill** | Stable Diffusion inpainting, DALL·E edit, Adobe Firefly API | Plausible texture | Non-deterministic; style drift; cost |
| **Patch-based** | Photoshop content-aware fill, [PatchMatch](https://gfx.cs.princeton.edu/pubs/Barnes_2009_IMA.pdf) | Fast, local | Obvious repeats on cross-pattern duvet |
| **Exemplar from static background** | Shift static layer from pre-move composite | Deterministic if layers known | Requires **true layer separation** first |

**Hari:** For Type 2, **LaMa-class inpainting on the mask hole** after raster layer translate is the
smallest ML add that addresses failure **B**. Keep folk-art Type 1 on **vector-only** (no inpaint).

### 3. “Editable layers” — decomposition before move

| Approach | Examples | Notes |
|----------|----------|-------|
| **Manual Group** (shipped) | User multi-select layers | Still vector; no inpaint |
| **Automatic layerization** | See-through / SAM masks → each mask = layer | N masks for N clicks; store as raster stacks or re-vectorize per layer |
| **Hybrid raster + vector** | Background = flat raster; foreground = masked sprite | Common in games; export flattens |

### 4. Vectorization (secondary for this image)

| Tool | Role |
|------|------|
| [VTracer](https://github.com/visioncortex/vtracer) / our WASM fork | Good for **flat** regions; noisy on brush strokes |
| [Potrace](http://potrace.sourceforge.net/) | Binary only |
| Vectorize **per SAM mask** | Cleaner paths per object, but many paths + simplify step |

**Sam + Hari agreement:** Re-vectorizing the **whole page** after SAM will still produce **680+
paths** on this style ([shape-accuracy-discussion](./shape-accuracy-discussion.md)). Prefer **mask →
raster layer** for move; vectorize optionally for **export to SVG** later.

---

## Three architectural options (team alignment)

### Option A — Stay vector-only (current direction, capped scope)

- **Scope:** Type 1 folk-art uploads only; Inspector warns on “complex illustration detected.”
- **Move:** SVG translate + cutout mode; Group/Ungroup; undo.
- **Tony’s image:** Out of scope until inpaint exists.

**Akansha:** Honest but disappointing if marketing says “edit any uploaded illustration.”

### Option B — Raster layer editor (recommended spike)

```
Click → SAM mask → foreground raster layer
Drag → translate layer
On drop → LaMa (or API) inpaint hole in background raster
Undo → restore previous raster + layer transform (session cache)
Export → flatten to PNG (vector optional)
```

- **Determinism:** Fixed seed on inpaint model + frozen weights → reproducible export (matches project
  values if we care about print PDFs).
- **Vector view at rest:** Can still show traced SVG for **preview**; switch to **layer composite**
  in Edit mode for move.

**Sam:** Accept if **at-rest** view matches upload; edit mode may show layer handles, not path nodes.

### Option C — Full layer decomposition service

- Automatic N-layer split (See-through / custom model) on vectorize.
- Highest quality potential; **weeks–months**; API cost; fails closed on weird uploads.

**Akansha:** Defer. Option B proves move with one mask + one inpaint before auto-layerizing everything.

---

## Team consensus

| Question | Answer |
|----------|--------|
| What are the “objects” in Tony’s image? | **Semantic gestalts** (man+phone+bag, bed, nightstand, wall, each crowd figure, train interior) — not VTracer colour clusters |
| Why doesn’t move work today? | **No inpainting** + **wrong segmentation** on painterly, occluded art |
| Is more union-find enough? | **No** for this upload class |
| What success looks like | Left: move man, inpaint pillow/wall. Right: move foreground man, inpaint crowd. Soft edges, no white holes, undo restores |
| Best next spike | **Option B:** click → SAM 2 (or MobileSAM) mask → raster drag → LaMa hole fill |
| Keep folk-art path? | **Yes** — Type 1 stays vector-only; don’t regress reference page |
| Diptych handling | **Product:** detect vertical split or user picks “left / right scene” before edit |

### Acceptance tiers (proposed)

| Tier | Upload | Gate |
|------|--------|------|
| **T1** | Folk-art reference | Existing Sam 3-page + Cmd+Z + Group |
| **T2** | Single-subject painterly (bedroom crop) | V1–V3 on L1 move |
| **T3** | Crowded painterly (subway crop) | R1 move without R4 merge |
| **T4** | Full diptych | Both panels pass T2/T3 or scene picker |

---

## Next actions

| Owner | Action |
|-------|--------|
| **Akansha** | Add upload **complexity tier** copy in Inspector; define in/out for “move v2” |
| **Sam** | Annotate Tony’s PNG with expected selection outlines (L1, R1) + pass/fail screenshots for inpaint |
| **Hari** | 2-day spike: SAM point mask + raster translate + LaMa inpaint on **bedroom crop only**; document determinism + bundle size |
| **Tony** | Confirm product priority: **fix move on painterly uploads** vs **perfect folk-art vector** first |

---

## References

- [Segment Anything 2](https://github.com/facebookresearch/sam2)
- [LaMa inpainting](https://github.com/advimman/lama)
- [scikit-image watershed](https://scikit-image.org/docs/stable/auto_examples/segmentation/plot_watershed.html)
- [Illustrator’s Depth (layer decomposition)](https://arxiv.org/html/2511.17454)
- [See-through Layer Generation](https://see-through-layer-generation.github.io/)
- Internal: [character-grouping-ux-review.md](./character-grouping-ux-review.md),
  [object-grouping-discussion.md](./object-grouping-discussion.md)

---

## Appendix — object list (machine-oriented)

For test fixtures and mask IoU gates:

**Left panel bounding regions (approximate):**

- `left.man` — head, torso, arms, phone (exclude duvet below chin/chest)
- `left.bedding` — pillow + duvet
- `left.nightstand` — table, lamp, mug
- `left.background` — wall, window, frames, shelf, plant

**Right panel:**

- `right.man` — foreground standing figure + phone + tote
- `right.strap` — optional child of `right.man` or separate rigid layer
- `right.crowd.*` — one mask per visible passenger (5–8 instances)
- `right.interior` — walls, windows, map, poles, extra straps

**Diptych:**

- `meta.split` — vertical center line; scenes share no object IDs across left/right.
