# Team Discussion — How to Group Vector Objects for Editing

**Problem from Tony:** the tool is still not grouping objects the right way. Selecting and
dragging does not match what a human would call “one thing” on the page (mesa, dinosaur, tree).

**Participants:** Akansha (Product), Sam (Design), Hari (Engineering).  
**Date:** 2026-06-16  
**Context:** Phase 2 editable canvas (`app/wasm-vtracer/src/scene.rs`, `sceneCompiler.ts`).  
**Related:** [shape-accuracy-discussion.md](./shape-accuracy-discussion.md) (authored assets vs trace),
Phase 2 plan Gate 0 J1 / Gate 3 J2.

---

## Tony’s ask

> The tool is still not grouping objects the right way. Discuss among yourselves the right way
> to group objects.

---

## What “right” means (product + design alignment)

**Akansha:** Before we tune heuristics, we need a one-sentence job:

> **When I click a shape on the page, I want to move the thing I meant — not a random colour patch.**

That implies:

| Should be one draggable object | Should stay separate |
|-------------------------------|----------------------|
| A whole foreground character (body + belly + neck, even if different fills) | Sky vs mesa vs ground (background bands) |
| A whole plant or tree mass | Individual leaves only if the user clearly expects fine control |
| A mesa silhouette | Speckle noise the trace turned into 12 green dots |

**Sam:** At arm’s length, grouping errors read as *broken editing*, not “approximate AI”:

- **Under-grouped:** user drags one green leaf; the rest of the bush stays. Frustrating but
  understandable.
- **Over-grouped:** user drags “the dinosaur” and half the hillside moves. **Unacceptable.**
- **Wrong merge:** two separate trees fuse because they share `greenMid`. Also unacceptable.

The visual test is not object count — it’s **gestalt**. On our reference folk-art page:

1. Dragging the sauropod moves **one** silhouette (all its colour patches).
2. Dragging the mesa moves **one** mesa, not sky bleeding into it.
3. Background sky/hills stay put when foreground moves (cut-out / seam behaviour is separate but
   related).

**Akansha:** So success is **low false-merge rate first**, then improve recall. I’d rather have
45 selectable objects that are mostly right than 25 objects where 8 are nonsense mergers.

---

## What the code does today (Hari’s diagnosis)

### Pipeline recap

```
Raster → VTracer (cutout config) → N SVG paths → build_scene() → ≤80 <g data-object-id>
       → sceneCompiler (main thread) → SceneDocument → EditableScene
```

Raw trace (`vectorId`, stacked hierarchical) is untouched. **Grouping only happens in
`build_scene()`** in `app/wasm-vtracer/src/scene.rs`.

### Current J1 heuristic (the bug)

After trace, **every path starts as its own group**. To satisfy `MAX_OBJECTS = 80`:

1. Repeatedly merge the **closest pair of same-fill groups** (by centroid distance).
2. If no same-fill pair exists, **merge the smallest group into the largest** — **even if colours
   differ**.

Centroids come from a crude bbox parse of path `d` strings, not true geometry.

### Why this fails on real pages

| Failure mode | Cause |
|--------------|-------|
| Whole hillside drags | Step 2: unlike colours forced together to hit the 80 cap |
| Dinosaur splits into 4 objects | Body blue, belly pink, neck blue, eye dot = different fills; same-fill merge only joins same hex |
| Forest becomes one blob | Many `greenMid` patches close together merge into one centroid cluster |
| Sky + cloud wrong | Same hue family or forced merge under cap |
| Ignores VTracer’s work | `trace_color` already emits **one path per visioncortex cluster** after cutout re-cluster; `build_scene` **throws away** that 1:1 mapping and re-merges in SVG path space |

**Hari:** The Phase 2 plan said “connected same-fill regions after simplify” and Douglas–Peucker.
We shipped **neither connectivity nor DP** — only bbox-centroid same-colour merge plus a destructive
cap fallback. That’s not a tuning issue; it’s the wrong algorithm.

**Sam:** That matches what I see. Layers list shows “Shape 7 · greenMid” that is clearly three
trees. And sometimes one object is sky + mesa edge — that’s the unlike-colour merge.

---

## Round 1 — Options considered

| # | Approach | Idea | Pros | Cons | Verdict |
|---|----------|------|------|------|---------|
| A | **1 VTracer cluster = 1 object** | Stop re-merging in `build_scene`; wrap each traced path/cluster as `obj-N` | Respects engine semantics; cutout already separates layers; trivial change | Multi-fill characters still split; may exceed 80 objects | **Do first** — baseline truth |
| B | **Union-find: merge only touching same-fill paths** | Adjacency on raster or bbox + shared edge; never merge non-touching | Fixes “three trees → one blob” | Doesn’t unite blue body + pink belly | **Do second** — speckle cleanup only |
| C | **Union-find: merge touching paths regardless of fill** | Flood-fill contact graph on label image | Unites multi-colour dinosaurs if patches touch | Risk: mesa + ground merge at shared boundary if colours differ but touch | Needs boundary rules |
| D | **Use visioncortex parent / hierarchical cluster tree** | Group children under parent cluster index from first pass | Semantically closer to “layer” | API may not expose stable parent IDs in WASM fork; needs spike | **Spike** — Hari ½ day |
| E | **Containment heuristic** | Small path fully inside larger path’s bbox → child of parent | Good for belly/eye on body | Bbox false positives; fragile on overlapping foliage | Supplement only |
| F | **Keep destructive 80-cap merge** | Current behaviour | Bounded object count | Causes Tony’s bug | **Remove** |
| G | **Raise / drop object cap** | 80 → 120 or no hard merge | Stops forced bad merges | Canvas perf (plan warned); layer list long | **Raise cap, don’t merge to satisfy it** |
| H | **User merge / split in UI** | Multi-select → “Group”; object → “Split” | Always correct eventually | Not in Phase 2 scope; escape hatch for P3 | **Defer** |
| I | **Authored slot tags + rules** | Map palette slots to group rules (`sauropodBlue*` + `sauropodPink` → one object) | Perfect on reference palette | Doesn’t generalise to arbitrary user uploads | **Reference only** — not primary |

---

## Round 2 — Disagreements and resolution

### “Should a multi-colour dinosaur be one object?”

**Sam:** Yes. Always. The sauropod is one gestalt. If belly is a separate drag target, the product
feels broken.

**Hari:** VTracer cutout gives one path per **colour cluster**, not per **character**. Uniting
patches requires either (c) contact across fills, (d) hierarchy from the first clustering pass, or
(e) containment. Contact-only almost works for belly-inside-body; neck touching body works; a
separate eye dot needs containment or tiny-patch absorption.

**Akansha:** Agreed one gestalt for foreground characters. But I won’t sign up for full semantic
segmentation (“find the dinosaur”) on arbitrary ChatGPT uploads. **Rule:** optimise for
**touching-region grouping + small-patch absorption**, not ML object detection.

**Resolved:** Target **connected visual components** on the cutout label map, where an edge
between two fills counts as connected if pixels touch (4- or 8-neighbour). That yields one object
per physically contiguous illustrated mass, including multi-fill, as long as the art has no gap
between belly and body (true in our gouache style).

### “What about the 80-object cap?”

**Hari:** Cap was for perf and layer-list UX. Forcing merges to hit it creates the worst bugs.

**Sam:** I’d rather scroll a 60-item layer list than drag half the scene.

**Akansha:** **Drop merge-to-cap.** Log a warning if `objects > 120`. If perf bites, we add
**raster fallback toggle** (already in plan), not silent bad grouping.

**Resolved:** Remove the “merge smallest into largest regardless of colour” branch entirely.
Soft warn at 120; hard cap only if we measure real jank (not yet).

### “Do we still need two traces (raw stacked + scene cutout)?”

**Hari:** Yes. Raw `vectorId` stays faithful for export/compare. Scene trace should drive grouping
only. **`build_scene` should not re-cluster** — it should **label** clusters from cutout output.

**Akansha:** Keep two artifacts. Simpler mental model: raw = film scan, scene = editable cutouts.

**Resolved:** unchanged architecture; fix grouping inside scene path only.

### “J1 simplify (DP, merge adjacent paths) — still needed?”

**Sam:** At rest, vector view must still match raster. Aggressive simplify that changes silhouettes
is a non-starter.

**Hari:** Defer Douglas–Peucker until grouping is correct. Speckle drop below `filter_speckle_area`
already happens at trace time. Optional: absorb sub-speckle paths into nearest **touching** parent,
never global centroid merge.

**Resolved:** **Grouping fix before simplify.** DP is a later quality pass, not a grouping tool.

---

## Agreed definition — “editable object” v1

An **editable object** is:

> A **4-connected component** of the cutout trace’s cluster label map on the image plane, after
> removing speckles below `filter_speckle_area`, rendered as one `<g data-object-id>` containing
> all paths that belong to clusters in that component.

Equivalently: if you painted each cluster a random colour and flood-fill touched regions, each
flood region is one object.

**Not** grouped by:

- Same fill hex alone
- Centroid distance
- Pressure to reach 80 objects

**Metadata:** `slot` on `SceneObject` remains nearest palette name of the **largest-area path** in
the group (display only: “Shape 12 · sauropodBlue”).

---

## Implementation plan (Hari → build order)

| Step | Work | Gate |
|------|------|------|
| **G0** | **Remove** centroid merge loop in `build_scene`; 1 traced path → 1 object interim | Tony can see per-cluster behaviour |
| **G1** | During `trace_color` (cutout), keep `cluster_index` per path; build adjacency on downsampled label grid; union-find components → `data-object-id` | Sam: drag tests on 3 pages |
| **G2** | Absorb speckles: clusters &lt; `min_area` merge into **touching** neighbour with largest shared boundary (not nearest centroid) | No orphan 3px dots as separate layers |
| **G3** | Log `objectCount`; warn &gt; 120; document in console | Akansha checkpoint |
| **Defer** | DP simplify, user merge/split UI, slot-based rules | After G1–G2 stable |

**Files:** `app/wasm-vtracer/src/lib.rs` (pass cluster ids into scene builder), `scene.rs`
(replace merge heuristic), `sceneCompiler.ts` (unchanged if SVG groups are correct), parity script
(assert no unlike-colour merge in test fixture).

**Determinism:** Union-find order must be deterministic (sort cluster ids before merges; seeded
tie-break if needed).

---

## Sam’s visual sign-off protocol (after G1)

On **reference crop + 2 user uploads**:

1. Vectorize → switch to Edit mode.
2. Click each obvious foreground mass (dino, mesa, large bush). **Pass:** one selection outline
   per mass.
3. Drag largest foreground 30px. **Pass:** no white gap &gt; 2px on flat fills (H2 seam test —
   separate from grouping but same session).
4. **Fail examples to file:** “these two trees merged”, “dino belly separate”, “sky dragged with
   mesa”.

---

## Akansha — scope guardrails

**In scope now:** Fix grouping algorithm; remove bad merges; raise cap policy.

**Out of scope (explicit):**

- Renaming layers, user-defined groups, puppet rigs
- Semantic labels (“dinosaur”, “tree”) without geometry
- Re-opening authored-asset pipeline from shape-accuracy doc (still right for *generator* scenes,
  not Playbook Pal uploads)

**Checkpoint:** If after G1–G2 we still can’t get contiguous character grouping on **flat-fill
folk art** because ChatGPT art has **gaps** between belly and body, we show an honest Inspector
note and ship **H + manual re-upload guidance**, not another week of heuristics.

---

## Decision summary

| Question | Answer |
|----------|--------|
| What is an object? | 4-connected cluster region on cutout label map (multi-fill allowed) |
| Keep 80-cap forced merge? | **No** — remove |
| Trust VTracer cutout clusters? | **Yes** — don’t re-merge by colour/centroid in SVG space |
| When to simplify paths? | After grouping is correct |
| P3 escape hatch? | User merge/split if uploads stay messy |

**Next action:** Hari implements G0→G1 in the WASM fork; Sam runs the 3-page click-drag protocol;
Akansha blocks any new editing features until G1 passes.

---

## Appendix — current code references

Centroid merge + unlike-colour fallback (`scene.rs`):

```103:147:app/wasm-vtracer/src/scene.rs
    while groups.len() > MAX_OBJECTS {
        let mut best: Option<(usize, usize, f64)> = None;
        for i in 0..groups.len() {
            for j in (i + 1)..groups.len() {
                if groups[i].color_key != groups[j].color_key {
                    continue;
                }
                // ... merge closest same-colour centroids
            }
        }
        if let Some((i, j, _)) = best {
            // ... merge
        } else if groups.len() > 1 {
            // smallest into largest — ANY colour
            let smallest = groups.pop().unwrap();
            let largest = groups.last_mut().unwrap();
            // ...
        }
    }
```

Cutout trace already produces one path per cluster (`lib.rs`):

```221:235:app/wasm-vtracer/src/lib.rs
    let view = clusters.view();
    let mut svg = SvgFile::new(width, height, config.path_precision);
    for &cluster_index in view.clusters_output.iter().rev() {
        let cluster = view.get_cluster(cluster_index);
        let paths = cluster.to_compound_path(/* ... */);
        svg.add_path(paths, cluster.residue_color());
    }
```

Scene compiler trusts `data-object-id` groups only (`sceneCompiler.ts`) — garbage in, garbage out
if `build_scene` groups wrong.
