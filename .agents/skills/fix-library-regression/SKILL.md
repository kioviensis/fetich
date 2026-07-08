---
name: fix-library-regression
description: Diagnose and fix a 1000fetches bug, failing test, regression, incorrect error, contract, retry, middleware, timeout, serialization, URL, or type inference behavior.
---

# Fix Library Regression

1. Reproduce or pin the failing behavior before editing. Use the reported test,
   a focused existing test, or a new minimal regression test.
2. Trace the issue to the smallest owned boundary in `src/client`, `src/core`,
   `src/request`, `src/contract`, `src/schema`, `src/utils`, or `src/errors`.
3. Read `docs/ai-agents/library-workflows.md` for coupled surfaces before
   changing shared request, contract, error, type, or package behavior.
4. Add or update a regression test unless the failure is already covered by a
   focused executable test.
5. Fix the root cause without broad refactors or unrelated public API changes.
6. Run the focused failing test, then `yarn check:changed` and any additional
   recommended checks.
7. Report the repro, the fix, and any skipped relevant verification command.
