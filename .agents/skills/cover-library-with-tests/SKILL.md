---
name: cover-library-with-tests
description: Add or improve tests for existing 1000fetches behavior without changing production behavior.
---

# Cover Library With Tests

1. Read the behavior source and nearby test style before writing tests.
2. Use MSW handlers and fixtures from `src/testing` for HTTP behavior tests
   instead of ad hoc network calls.
3. Use `expect-type` and intentional `@ts-expect-error` assertions in
   `*.typecheck.ts` files for inference, path params, body typing, and public
   type guarantees.
4. Do not change production code unless the user asked for a fix or the test
   exposes a confirmed bug that is now in scope.
5. Run the focused test file. For type tests, run `yarn test:types`.
6. Run `yarn check:changed` and report any broader checks that remain
   recommended but were not run.
