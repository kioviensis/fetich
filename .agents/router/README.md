# Agent Router

## Router Tier Decision

Selected tier: Tier 1, simple deterministic router.

Rejected lower tier: Tier 0 manual routing is insufficient because this repo
now has multiple repo-local task skills, stable guide IDs, a thin Claude
adapter that exposes route suggestions, and public API/type-test/package
surfaces where over-reading and under-reading are both plausible.

Rejected higher tier: Tier 2 is not justified for this single-package library.
There is no current cross-agent audit matrix, model-read evidence capture,
large adapter set, or mature deleted router topology to preserve.

Repo-family evidence: single TypeScript library/package using Yarn v1, strict
TypeScript, Vite library build, Vitest/MSW tests, typecheck fixtures, package
smoke scripts, and a packaged `skills/1000fetches` product skill.

Route families: implementation, bug fix, refactor, test coverage, docs,
public API/package surface, harness maintenance, and fallback.

Local skills: `implement-library-change`, `fix-library-regression`,
`refactor-library-surface`, and `cover-library-with-tests` are router-selected.

Overlays: `routing-audit`, `dry-run`, and `verification-only` augment the
selected task route instead of replacing it.

Adapter: `CLAUDE.md` is preserved as a thin adapter and points to
`yarn agents:route -- "<task>"`.

Known overlap risks: refactor versus bug fix when prompts mention errors,
test coverage versus implementation when prompts say "add tests", docs versus
domain words such as retry or middleware, and harness sync versus generic
router/eval wording.

Required validation categories:

- TypeScript typecheck for router code: `yarn agents:typecheck`
- Route and eval data validation: `yarn agents:validate`
- Exact route eval comparison: `yarn agents:eval`
- Harness and adapter validation: `yarn agents:harness`
- Changed-file recommendation self-tests: `yarn agents:self-test`
- Aggregate validation: `yarn check:agents`

Done means every selected validation category passes, every route has eval
coverage, every local task skill is selected by at least one route, adapter and
command references resolve, and changed-file recommendations use existing test
paths or explicit broad/manual fallbacks.

## Commands

```bash
yarn agents:route -- "fix retry regression in src/request/retry/retry.ts"
yarn agents:validate
yarn agents:eval
yarn agents:harness
yarn agents:self-test
yarn check:agents
yarn check:changed
```

The router is implemented in TypeScript under `src`. Node executes it with
type stripping for CLI use; `agents:typecheck` remains the type contract.
