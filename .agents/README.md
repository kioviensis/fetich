# Agent Harness

This harness is the repo-local operating surface for coding agents working on
`1000fetches`.

## Layout

- `AGENTS.md` is the always-loaded policy and guide router.
- `docs/ai-agents` holds source-backed workflow docs, scout contracts, dry-run
  rules, and verification guidance.
- `.agents/skills` holds repo-local workflow skills. These are for changing
  this repository, not for users consuming the library.
- `.agents/router` holds deterministic route data, eval fixtures, validation,
  and changed-file recommendations.
- `CLAUDE.md` is a thin Claude adapter that imports `AGENTS.md` and points to
  the router command.
- `skills/1000fetches` is a packaged product skill and must stay separate from
  local workflow skills.

## Maintenance

Run `yarn check:agents` after changing harness docs, local skills, router data
or code, package scripts used by the harness, `CLAUDE.md`, or packaged skill
references. Run `yarn check:changed` for a task-shaped recommendation set.

Docs are starting points. If source, config, tests, package manifests, or smoke
scripts disagree with a harness rule, repair the harness rule as part of the
same change.
