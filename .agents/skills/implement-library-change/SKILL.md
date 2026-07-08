---
name: implement-library-change
description: Implement a 1000fetches library behavior or API change. Use when adding or changing runtime behavior, request features, contracts, serialization, retries, middleware, path params, defaults, or package-visible API.
---

# Implement Library Change

1. Read `AGENTS.md`, route the task with `yarn agents:route -- "<task>"` when
   the surface is broad, and inspect the source files before editing.
2. Read `docs/ai-agents/library-workflows.md` and
   `docs/ai-agents/testing-and-verification.md`.
3. For public behavior, inspect `skills/1000fetches/SKILL.md` and the relevant
   reference file under `skills/1000fetches/references`.
4. Preserve public API shape and type inference unless the request explicitly
   changes them.
5. Update runtime tests and, for type inference or path parameter behavior,
   update `*.typecheck.ts` tests.
6. Update `README.md`, `docs/BEST_PRACTICES.md`, or `skills/1000fetches` when
   public examples or production guidance change.
7. Run `yarn check:changed` and the focused checks it recommends. For public
   API or package changes, include `yarn test:types` and package smoke checks
   when practical.
