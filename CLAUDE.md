@AGENTS.md

## Claude Code

- Claude Code reads this file, then imports `AGENTS.md`. Keep shared project
  instructions in `AGENTS.md`; put only Claude-specific guidance here.
- For broad or unfamiliar work, ask the repo router for context first:
  `yarn agents:route -- "<task>"`.
- Canonical agent docs live in `docs/ai-agents`; local workflow skills live in
  `.agents/skills`; router data, evals, and changed-file checks live in
  `.agents/router`.
- Run `yarn check:agents` after changing `AGENTS.md`, `CLAUDE.md`,
  `docs/ai-agents`, `.agents`, `skills/1000fetches`, or package scripts that
  the harness references.
- Keep this file short. If a new instruction is not needed in every Claude Code
  session, prefer a scoped rule, skill, hook, or normal project documentation.
- When compacting context, preserve the current goal, files changed, commands
  run, test results, skipped checks, and any user constraints.
