# Moving this project into Claude Code

The project is already a normal folder, so Claude Code can work on it directly. This folder just
holds the `.claude/` scaffolding (agents + slash commands) staged in a visible place, because
`.claude/` is a protected path that couldn't be written automatically.

## One-time install (copy the scaffolding into place)

From the project root (`playbook/`), run:

```bash
mkdir -p .claude/agents .claude/commands
cp claude-code-setup/agents/*.md   .claude/agents/
cp claude-code-setup/commands/*.md .claude/commands/
# optional: remove the staging folder afterwards
# rm -r claude-code-setup
```

`CLAUDE.md` is already at the project root — Claude Code loads it automatically.

## Start Claude Code

```bash
cd /path/to/playbook
claude
```

That's it — Claude Code uses the current directory as the project root, reads `CLAUDE.md`, and
picks up the agents and commands.

## What you get

- **CLAUDE.md** — project memory (architecture, run commands, the determinism rules, the
  authored-asset decision, VTracer usage). Loaded every session.
- **Subagents** (`/agents` to manage, or they auto-delegate by description):
  - `akansha` — product manager / relentless simplifier (scoping, sequencing, checkpoints).
  - `sam` — designer (visual critique vs the reference, look & specs).
  - `hari` — engineer (implementation, the SVG→PNG pipeline).
- **Slash commands**:
  - `/render [seed] ["caption"]` — render the scene and verify determinism.
  - `/new-asset <element>` — run the trace→author→grade pipeline for a new authored asset.

## Notes

- To reuse the team across *all* your projects instead of just this one, copy the agent files to
  `~/.claude/agents/` (user-level) instead of the project `.claude/agents/`.
- The fuller persona write-ups live in `../team/`. The subagent files here are condensed for
  Claude Code's auto-delegation (the `description` field decides when each is used).
- Dependencies: `npm install` (simplex-noise, @resvg/resvg-js); `pip install vtracer` for tracing.
- You can also run `/init` in Claude Code to regenerate CLAUDE.md from the codebase, but the
  hand-written one here already captures the important decisions — keep it unless it drifts.
```
