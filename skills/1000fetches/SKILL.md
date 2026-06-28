---
name: 1000fetches
description: Use when an AI coding agent is building or modifying TypeScript code that uses 1000fetches, including client setup, dynamic defaults, path params, contracts, retries, middleware, serialization, body typing, or public API changes in this library.
---

# 1000fetches

Use this skill to write or modify TypeScript code that uses `1000fetches`, and to preserve the library's design when changing the library itself.

## Workflow

1. Prefer `createHttpClient` and the method API: `get`, `post`, `put`, `patch`, `delete`, and `request`.
2. Use path params instead of string interpolation for templated paths.
3. Use `.contract()` at network boundaries when response shape matters; finish with `.data()` or `.void()` when the caller does not need the full response.
4. Use dynamic `defaults` for auth and request-shaped defaults.
5. Import the public types and errors used in examples from `1000fetches`; do not reach into package internals.
6. Use middleware only for observation or deliberate mutation that defaults cannot express.
7. Keep retries conservative and opt-in.
8. Do not recommend streaming callbacks; streaming telemetry is intentionally not part of the core API.

## Reference Routing

- Read `references/client-setup-and-defaults.md` when creating clients, configuring auth, setting headers, params, timeouts, retry defaults, or fetch options.
- Read `references/contracts-and-errors.md` when adding validation, status-specific contracts, typed data extraction, or error handling.
- Read `references/path-params-and-urls.md` when building URLs, path templates, base URLs, or query params.
- Read `references/retries-timeouts-and-middleware.md` when configuring retries, cancellation, timeouts, logging, telemetry, or middleware.
- Read `references/serialization-and-body-types.md` when sending bodies, using custom `serializeBody`, or modifying body-related library types.

## Library-Change Rules

- Preserve the public API shape and type inference unless the requested change explicitly changes the API.
- Update runtime tests, type tests, exports, and docs for public behavior changes.
- Keep runtime dependencies light; do not add runtime dependencies unless explicitly approved.
- Keep source imports extensionless and local imports relative.
- Do not add release notes, changelogs, or changesets unless release preparation is requested.
