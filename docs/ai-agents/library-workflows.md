# Library Workflows

## Source Anchors

- `src/index.ts` owns public runtime and type exports.
- `package.json` owns package entrypoints, exported files, scripts, dependency
  shape, and package manager metadata.
- `src/client/index.ts` builds the chainable public API: `get`, `post`, `put`,
  `patch`, `delete`, `request`, `.contract()`, `.data()`, and `.void()`.
- `src/core.ts` owns request option normalization and delegates request
  execution to focused helpers in `src/request`.
- `src/contract/index.ts` owns response contract validation and
  status-specific success and error schemas.
- `src/utils/path.ts` owns path template generation and compile-time path
  parameter enforcement.
- `src/request/options.ts`, `src/request/defaults.ts`,
  `src/request/serialization`, `src/request/retry`, and
  `src/request/middleware` own request setup, dynamic defaults, body/query
  serialization, retries, timeouts, and middleware.
- `src/errors/errors.ts` and `src/errors/handling.ts` own public error classes
  and error wrapping.
- `src/testing/handlers.ts`, `src/testing/setup.ts`, and
  `src/testing/fixtures.ts` own shared MSW test behavior.

## Coupled Change Rules

| Change                                                                                        | Required companion context                                                                                                                              |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public export, type, or package entrypoint                                                    | `src/index.ts`, `package.json`, relevant `*.typecheck.ts`, runtime tests, `README.md`, `skills/1000fetches`, and export/package smoke checks            |
| Client method or chainable response behavior                                                  | `src/client/index.ts`, `src/core.ts`, client tests, inference tests, and contract/data extraction tests                                                 |
| Contract, schema, or error behavior                                                           | `src/contract`, `src/schema`, `src/errors`, contract validation tests, schema tests, and README or packaged skill examples when public behavior changes |
| Path params, base URLs, or query params                                                       | `src/utils/path.ts`, `src/request/url.ts`, query/path integration tests, and typecheck tests for compile-time guarantees                                |
| Dynamic defaults, fetch options, serialization, middleware, retry, timeout, or abort behavior | the relevant `src/request/*` module, matching integration tests, MSW handlers when needed, and packaged skill references when examples change           |
| Documentation or packaged skill examples                                                      | source and tests that prove the behavior, not only adjacent docs                                                                                        |

Do not change public API shape or type inference as part of a refactor unless
the user explicitly requests it. Runtime dependency additions need explicit
approval; `zod`, `valibot`, and `arktype` are external or optional examples,
not bundled runtime dependencies.

## Packaged Skill Surface

`skills/1000fetches/SKILL.md` and its references are part of the package file
set. They describe how users and agents should use the library. Update them
when public behavior, examples, or recommended usage changes. Keep local agent
workflow skills in `.agents/skills`; do not duplicate packaged skill content
into tool-specific folders.

## Package And Release Surface

Package-shape changes can affect both ESM and CJS consumers. For changes to
`package.json`, `vite.config.ts`, `src/index.ts`, `scripts/smoke-exports.mjs`,
or package files, prefer these checks when practical:

- `yarn test:types`
- `yarn build`
- `yarn test:exports`
- `yarn package:smoke`

Do not publish or create release metadata unless the user explicitly asks for
release preparation.
