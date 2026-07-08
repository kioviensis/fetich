# AGENTS.md

## Purpose

Always-loaded repo policy and guide router. Tool-specific adapters point here;
canonical harness docs live in `docs/ai-agents`, local workflow skills live in
`.agents/skills`, and deterministic routing lives in `.agents/router`.

## Project

- `1000fetches` is a single-package Yarn v1 TypeScript library for an HTTP
  client built on native `fetch`.
- Runtime source lives in `src`; public exports are controlled by
  `src/index.ts` and `package.json`.
- Tests are colocated with the source module or feature they cover. MSW
  handlers and setup live in `src/testing`.
- `skills/1000fetches` is a packaged product skill for users and agents working
  with the library. Keep it aligned with public behavior, but do not duplicate
  it into `.agents/skills`.

## Commands

Use `package.json` as the command source.

- Install dependencies with `yarn install`.
- Build the package with `yarn build`.
- Run the full test task with `yarn test`.
- Run type checks with `yarn tsc` or `yarn test:types`.
- Run formatting and lint checks with `yarn lint` or `yarn format:check`.
- Run unit tests with `yarn test:unit`.
- Run export smoke tests with `yarn test:exports`.
- Run the package smoke workflow with `yarn package:smoke`.
- Get a deterministic route suggestion with `yarn agents:route -- "<task>"`.
- Validate the harness with `yarn check:agents`.
- Get changed-file verification recommendations with `yarn check:changed`.
- For a focused Vitest file, pass the colocated test path, for example
  `yarn test:unit src/request/retry/retry.integration.test.ts`.

## Workflow

- Check `git status --short` before editing and preserve unrelated dirty
  worktree changes.
- Inspect source, config, tests, and package manifests before editing docs or
  harness guidance. Source reality wins over docs.
- Keep changes scoped to the requested behavior and nearby tests/docs.
- Use focused verification first, then broader checks when public API,
  package/build, or cross-module behavior is touched.
- Update affected docs, packaged skill references, router data, and adapter
  pointers when a reusable convention changes.
- Do not read `.env` files. Do not publish, release, push, or run release
  commands without explicit user approval.
- Do not run destructive cleanup commands such as `yarn clean`, `rm -rf`,
  `git reset`, or `git checkout --` unless the user explicitly asks.

## Guide Router

| Task signal                                                                               | Read                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implement or change library behavior                                                      | `docs/ai-agents/library-workflows.md`, `docs/ai-agents/testing-and-verification.md`, `skills/1000fetches/SKILL.md`, route-selected local skill                       |
| Fix a bug, failing test, regression, timeout, retry, middleware, or contract issue        | `docs/ai-agents/library-workflows.md`, `docs/ai-agents/testing-and-verification.md`, `skills/1000fetches/SKILL.md`, `.agents/skills/fix-library-regression/SKILL.md` |
| Refactor without intended behavior changes                                                | `docs/ai-agents/library-workflows.md`, `docs/ai-agents/testing-and-verification.md`, `.agents/skills/refactor-library-surface/SKILL.md`                              |
| Add or improve tests for existing behavior                                                | `docs/ai-agents/testing-and-verification.md`, `.agents/skills/cover-library-with-tests/SKILL.md`                                                                     |
| Public exports, package entrypoints, README examples, package smoke, or npm package shape | `docs/ai-agents/library-workflows.md`, `docs/ai-agents/testing-and-verification.md`, `README.md`, `skills/1000fetches/SKILL.md`                                      |
| Agent harness, local skills, router, adapters, or changed-file checks                     | `docs/ai-agents/README.md`, `.agents/README.md`, `.agents/router/README.md`                                                                                          |
| Ambiguous task                                                                            | Run `yarn agents:route -- "<task>"` or start with `docs/ai-agents/README.md`                                                                                         |

Router rules:

- `AGENTS.md` is the always-loaded policy; detailed project and workflow rules
  belong in the referenced docs or local skills.
- Deterministic routing uses `.agents/router`. The router selects context; it
  does not replace source inspection.
- Canonical repo-local workflow skills live in `.agents/skills`.
- Tool adapters stay thin and point back to this file, docs, local skills, and
  router commands.
- Stale guides, router data, or adapters must be repaired with the code or
  docs change that made them stale.

## Always-Loaded Constraints

- Use TypeScript strict mode and ES modules. Keep source imports extensionless
  and local imports relative.
- Follow Prettier: 2 spaces, single quotes, no semicolons, trailing commas
  where valid in ES5, 80-column print width, and `arrowParens: avoid`.
- Keep runtime code dependency-light. Do not add runtime dependencies without
  explicit approval; `zod`, `valibot`, and `arktype` are external/optional.
- Preserve public API shape and type inference unless the request explicitly
  changes them. Public surface changes usually need export updates, runtime
  tests, type tests, README/docs or packaged skill updates, and export smoke
  coverage.
- Keep error instances specific and preserve useful context such as status,
  URL, method, response, data, and cause.
