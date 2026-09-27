# Storybook Generator — project memory

Procedural **folk-art gouache children's-book** scene generator. Pure code → SVG → PNG,
fully deterministic (no AI image model in the render path). Originally built in Cowork; this
file gives a Claude Code session the same context.

## Run it

```bash
npm install                                   # deps: simplex-noise, @resvg/resvg-js
node src/scripts/generate.js                  # full scene, seed 7 -> out/scene-7.{svg,png}
node src/scripts/generate.js 42               # different seed -> varied scene
node src/scripts/generate.js 7 "A caption"    # with text-on-scene
node src/scripts/gate.js                       # texture go/no-go (one mesa)
node src/scripts/asset_test.js 7               # render an authored asset alone + silhouette
```

No build step. Node 22, ES modules. Output PNG/SVG go to `out/`.

## Architecture (a "scene compiler", not prompt→image)

```
scene JSON ─► compose/scene.js ─► primitives + assets ─► imperfection (jitter+filters) ─► SVG ─► PNG (resvg)
```

- `src/core/` — `rng.js` (seeded mulberry32 + `hashSeed` sub-seeds), `svg.js` (raw-SVG string
  helpers, `smoothClosedPath`), `geom.js` (`ribbon`).
- `src/imperfection/jitter.js` — simplex noise, `jitterPoints`, `blobPoints`, `leafPoints`.
- `src/palettes/summer.js` — muted palette + `tone()`; colours referenced by name (slots).
- `src/primitives/` — procedural shapes: sky, mesa, creatures, flora, pond, child.
- `src/assets/` — **authored** shape assets (e.g. `sauropod.js`). This is the current direction
  (see Key decision below). Authored outline + slots + anchors + seeded jitter.
- `src/render/` — `filters.js` (gouache `feTurbulence`/`feDisplacementMap` + grain), `png.js` (resvg).
- `src/compose/` — `scene.js` (back-to-front composition), `text.js` (torn-paper caption band).
- `docs/` — design + decision docs (read these for the "why").
- `reference/`, `reference-image.png` — the target art.

## Hard rules

- **Determinism:** every random/noise value flows through `makeRng`/`makeNoise` with a `seed`
  + string label. NEVER use `Math.random()` or `Date.now()`. Same scene+seed → byte-identical
  PNG. New seed → consistent variation. Verify with: render twice, `md5sum` the PNG (must match);
  reseed, hashes must differ.
- **No gradients** in fills (breaks the matte look). Get value variation from layered, slightly
  inset `tone()`-shifted shapes instead. (One radial glow behind the mesa is the only exception.)
- **resvg is the source of truth** for rendering (it supports the filters); don't trust a browser
  preview. resvg has no `mix-blend-mode` — use masked layers.

## Key decision — shapes come from AUTHORED assets, not noise

We learned that noise-perturbed blobs *cannot* produce recognizable, art-directed silhouettes
(it's a representation problem, not a tuning one). The pivot: **authored vector assets** carry the
shape; code keeps doing composition, palette/seasonal recolour, placement, jitter, and texture.
`src/assets/sauropod.js` is the reference implementation. Full reasoning + the asset data model
(slots / anchors / jitterTargets) is in `docs/shape-accuracy-discussion.md`.

## VTracer (raster→vector) usage

`vtracer` (Python: `pip install vtracer`) converts an *image* into SVG. It does NOT take prompts.
We use it as a **grader** (binary-mode silhouette mask for an IoU check) and as a **tracing guide**.
Current product direction: **vectorize & make editable** — the user generates the source art, we
trace it, then simplify paths + map colours to slots + tag anchors so it's recolourable/editable.
Tuned params that worked: `mode=spline, color_precision=6, layer_difference=16, filter_speckle=8,
corner_threshold=70, splice_threshold=45, hierarchical=stacked`.

## The team (subagents)

This project uses an AI team. See `.claude/agents/`: **akansha** (PM, relentless simplifier),
**sam** (designer, visual fidelity), **hari** (engineer). Delegate to them for product scoping,
design critique, and implementation respectively. They mirror the personas in `../team/`.

## Docs worth reading

- `docs/feasibility-and-mvp-approach.md` — original feasibility + MVP scope.
- `docs/improvement-plan.md` — palette/texture improvements (v0.2).
- `docs/shape-accuracy-discussion.md` — the authored-asset pivot + VTracer learnings (most important).
