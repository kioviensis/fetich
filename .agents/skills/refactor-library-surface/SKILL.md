---
name: refactor-library-surface
description: Refactor 1000fetches internals without intended behavior changes. Use for cleanup, extraction, simplification, or module-boundary work in this TypeScript library.
---

# Refactor Library Surface

1. Map current behavior, callers, public exports, tests, and packaged examples
   before editing.
2. Keep behavior, error classes, public exports, and type inference stable
   unless the user explicitly asks for an API change.
3. Prefer small typed helpers over broad abstractions, and keep source imports
   extensionless and local.
4. Preserve the existing test shape. Add tests only when the refactor exposes a
   missing behavior guarantee.
5. Run `yarn check:changed` and the focused checks it recommends. Include
   `yarn test:types` for type or public surface refactors.
6. Use a read-only gatekeeper pass for broad shared refactors before reporting
   completion.
