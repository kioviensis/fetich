# AGENTS.md

## Project Overview

- This repository is a single-package Yarn v1 TypeScript library for `1000fetches`, an HTTP client built on native `fetch`.
- Runtime source lives in `src`.
- Public exports are controlled by `src/index.ts` and `package.json`.
- Tests live next to the source module or feature they cover; MSW fixtures and server setup live in `src/testing`.

## Commands

- Install dependencies with `yarn install`.
- Build the package with `yarn build`.
- Run the full test task with `yarn test`.
- Run type checks with `yarn tsc` or `yarn test:types`.
- Run formatting and lint checks with `yarn lint` or `yarn format:check`.
- Format the repo with `yarn format`.
- Run unit tests with `yarn test:unit`.
- Run export smoke tests with `yarn test:exports`.
- Run the package smoke workflow with `yarn package:smoke`.
- For a focused Vitest file, pass the colocated test path, for example `yarn test:unit src/request/retry/retry.integration.test.ts`.

## Code Style

- Use TypeScript in strict mode and ES modules.
- Follow Prettier: 2 spaces, single quotes, no semicolons, trailing commas where valid in ES5, 80-column print width, and `arrowParens: avoid`.
- Keep runtime code dependency-light. Do not add runtime dependencies without explicit approval; `zod`, `valibot`, and `arktype` are external/optional.
- Keep source imports extensionless and local imports relative.
- Prefer small, typed helpers over broad abstractions.
- Preserve the library's public API shape and type inference. Public surface changes usually need export updates, runtime tests, type tests, README/docs updates, and export smoke coverage.

## Architecture Notes

- `client/index.ts` builds the chainable public API: `get`, `post`, `put`, `patch`, `delete`, `request`, `.contract()`, `.data()`, and `.void()`.
- `core.ts` owns request option normalization and delegates request execution to focused helpers in `request/`.
- `contract/index.ts` owns response contract validation and status-specific success and error schemas.
- `request/retry.ts` owns opt-in retry policy. Retries should stay conservative: idempotent methods by default, unsafe methods only when configured.
- `utils/path.ts` owns path template generation and compile-time path parameter enforcement. Preserve the type-level guarantees when changing URL handling.
- `errors/errors.ts` defines public error classes. Keep error instances specific and preserve useful context such as status, URL, method, response, data, and cause.

## Testing Guidance

- Add or update Vitest runtime tests for behavior changes.
- Add or update `*.typecheck.ts` tests for type inference, path parameter, or public type changes. Use `expect-type` and `@ts-expect-error` intentionally.
- Prefer MSW handlers in `src/testing/handlers.ts` for HTTP behavior tests.
- Run the narrowest relevant test first. When touching types or exports, also run `yarn test:types`.
- Before finishing changes to public API or packaging, run `yarn package:smoke` when practical.
- If a relevant check cannot be run, report exactly which command was skipped and why.

## Documentation

- The root `README.md` describes the package. Keep it aligned with public behavior and examples.
- Update `docs/BEST_PRACTICES.md` when changing production usage guidance.
- Do not add release notes, changelogs, release metadata, or changesets unless the user asks for release preparation.

## Safety And Workflow

- Check `git status --short` before editing. This repo may contain user changes; do not revert unrelated edits.
- Keep changes scoped to the requested behavior and nearby tests/docs.
- Do not run destructive cleanup commands such as `yarn clean`, `rm -rf`, `git reset`, or `git checkout --` unless the user explicitly asks.
- Do not publish, release, push, or run release commands without explicit user approval.
- Do not commit secrets, tokens, local environment files, coverage output, `dist`, or `node_modules`.

## Maintaining This File

- Keep this file concise and operational. Add a rule only when it prevents a repeat mistake or records repo context that agents cannot infer cheaply.
- Prefer concrete commands, paths, and constraints over generic advice.
- Remove stale instructions when behavior, scripts, or layout changes.
