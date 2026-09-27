# Storybook Generator

Procedural folk-art **gouache** children's-book scene generator. Pure code → SVG → PNG,
fully deterministic (no AI image model in the loop). This is the MVP proof-of-concept that
recreates the prehistoric-jungle reference image as a "scene compiler".

## Quick start

```bash
npm install

# texture go/no-go gate (one mesa through the gouache pipeline)
node src/scripts/gate.js

# full scene
node src/scripts/generate.js                      # seed 7
node src/scripts/generate.js 42                    # a different seed -> a varied scene
node src/scripts/generate.js 7 "Where the dinosaurs sleep"   # with a caption
```

Outputs land in `out/` as both `.svg` (infinite resolution) and `.png`.

## How it works (the scene compiler)

```
scene JSON ──► compose/scene.js ──► primitives ──► imperfection (jitter+filters) ──► SVG ──► PNG (resvg)
```

A scene is plain data:

```js
{ width: 1000, height: 840, seed: 7, text: "optional caption", textPosition: "bottom" }
```

Same `seed` → byte-identical PNG. Change the `seed` → a new but stylistically consistent
scene (foliage, clouds and placement shift; the composition holds).

## Layout

```
src/
  core/        rng.js (seeded mulberry32 + sub-seed hashing), svg.js (raw-SVG helpers), geom.js
  imperfection/jitter.js (simplex path-jitter, blob/leaf generators)
  palettes/    summer.js (the muted summer palette + tone() helper)
  primitives/  sky, mesa, creatures (pterosaur/sauropod/stegosaurus),
               flora (palm/fern/broadLeaf/bush/flower/lilyPad/lotus), pond, child
  render/      filters.js (gouache feTurbulence/feDisplacementMap + grain), png.js (resvg)
  compose/     scene.js (back-to-front composition), text.js (torn-paper caption band)
  scripts/     gate.js, generate.js
out/           generated .svg + .png
reference/     the target reference image
docs/          feasibility-and-mvp-approach.md
```

## The gouache look

Three layered techniques give the hand-painted feel rather than flat vector clip-art:

1. **Seeded path jitter** — every shape's outline is perturbed by a simplex-noise field.
2. **Edge displacement filter** (`feTurbulence` → `feDisplacementMap`) for soft, irregular,
   brush-like edges, applied per shape-group.
3. **Layered semi-transparent fills + a faint paper-grain overlay** for matte, chalky pigment.

## Dependencies

`simplex-noise` (path jitter) and `@resvg/resvg-js` (deterministic SVG→PNG with reliable
filter support). That's the whole footprint.

## Status / next steps

MVP = one hand-authored scene with seed variation and a caption. Not yet built (deferred per
the MVP plan): other seasons / times of day, a mood system, a parametric character generator,
multiple scene types, and any UI. See `docs/feasibility-and-mvp-approach.md`.
