---
description: Render the scene and verify determinism
allowed-tools: Bash, Read
---

Render the storybook scene and verify it.

1. Run `node src/scripts/generate.js $ARGUMENTS` (args = optional seed and "caption").
2. Read/View the resulting PNG in `out/`.
3. Verify determinism: render the same seed twice and confirm the PNG `md5sum` is identical; then
   render a different seed and confirm the hash differs. Report the result briefly.
