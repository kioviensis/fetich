# Testing And Verification

## Command Map

| Need                                        | Command                            |
| ------------------------------------------- | ---------------------------------- |
| Runtime unit and integration tests          | `yarn test:unit`                   |
| Focused Vitest file                         | `yarn test:unit <path>`            |
| Type inference and compile-time path checks | `yarn test:types`                  |
| Build output and declaration generation     | `yarn build`                       |
| Export surface smoke test                   | `yarn test:exports`                |
| Package smoke workflow                      | `yarn package:smoke`               |
| Lint and formatting                         | `yarn lint` or `yarn format:check` |
| Harness validation                          | `yarn check:agents`                |
| Changed-file recommendations                | `yarn check:changed`               |

## Focused Test Rules

- Run the changed test file directly when editing a `*.test.ts` or
  `*.integration.test.ts` file.
- Run `yarn test:types` for `*.typecheck.ts`, type inference, path parameter,
  public type, export, or package entrypoint changes.
- For source files with colocated tests, run the existing nearby test files.
  Do not invent a focused test path from naming conventions when the file does
  not exist.
- Use `src/testing/handlers.ts`, `src/testing/setup.ts`, and fixtures for HTTP
  behavior tests instead of ad hoc network calls.
- Before finishing public API or package-surface changes, run package smoke
  checks when practical.

## Safe And Unsafe Checks

Safe focused checks include `yarn test:unit <existing test file>`,
`yarn test:types`, `yarn lint`, `yarn format:check`, `yarn build`,
`yarn test:exports`, `yarn package:smoke`, and `yarn check:agents`.

Do not run publishing, release, destructive cleanup, watch-mode, or service
commands without explicit user approval. `yarn clean` removes generated output
and is not part of normal verification.

## Reporting

When a relevant check cannot be run, report the exact command skipped and why.
When broad package checks are impractical, report the focused checks that did
run and the remaining risk.
