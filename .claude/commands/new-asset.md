---
description: Author a new authored vector asset from the reference using the trace→author→grade pipeline
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Author a new shape asset for: $ARGUMENTS

Follow the project's authored-asset pipeline (see `docs/shape-accuracy-discussion.md`):

1. Crop the reference to the target element; save the crop to `out/`.
2. Build a grader mask: run VTracer in binary mode (`pip install vtracer` if needed) to get a clean
   silhouette, OR colour-segment the crop. Use it for an IoU check.
3. Author an ORIGINAL slotted asset in `src/assets/<name>.js`: one confident outline (+ named
   sub-paths like neck/head), a 2-tone shadow, an eye anchor where relevant. Colours via palette
   SLOTS (never hardcoded hex); per-instance wobble via seeded `jitterPoints` on the outline only.
3. Render the asset alone (mirror `src/scripts/asset_test.js`), view the PNG, overlay vs the mask,
   fix the single biggest shape error, and iterate 3–5 visual loops.
4. Wire it into `src/compose/scene.js` (drop-in, matching the existing call signature), re-render
   the full scene, and verify: recolour via slots works, determinism holds (same seed → identical
   PNG hash), variation holds (new seed differs).

Use the `sam` subagent to critique each loop against the reference and the `hari` subagent for the
implementation. Stop at the checkpoint and summarize for review before authoring further assets.
