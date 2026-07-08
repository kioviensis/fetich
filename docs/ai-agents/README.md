# Agent Workflow Guide

This directory holds source-backed workflow guidance for coding agents working
inside this repository. Root `AGENTS.md` is the always-loaded router; these docs
carry the details that should not be duplicated into every adapter.

## Routing

Use the deterministic router when the task is broad, ambiguous, or touches
multiple surfaces:

```bash
yarn agents:route -- "fix retry regression in src/request/retry/retry.ts"
```

The router returns a route ID, selected local skill when applicable, mandatory
context, conditional context, not-selected context, overlays, and verification
recommendations. Source, config, tests, and package manifests still win over
router output when they disagree.

## Routing Audit Contract

When the user asks for a routing audit or read-evidence report, provide a small
table before finalizing the plan:

| file or section         | status       | reason                                                         |
| ----------------------- | ------------ | -------------------------------------------------------------- |
| `AGENTS.md`             | read         | Always-loaded policy                                           |
| selected docs or skills | read         | Mandatory route context                                        |
| source files            | conditional  | Read after the route is selected and the task surface is known |
| unrelated guides        | not-selected | Avoid over-reading                                             |

Use only these status values: `read`, `conditional`, `not-selected`, and
`selected-not-read-yet` for interim updates. Do not claim `read` unless the
file or section was opened in the current turn.

## Dry Run Contract

For dry-run or design-only requests, select the same task route that would be
used for implementation, then stop before file edits. Report the route,
mandatory context, conditional context, expected changed-file checks, and
assumptions. Dry-run wording should not steal a product task into harness
maintenance unless the task itself is about the harness.

## Read-Only Scout Contract

Use a scout pass before broad or unfamiliar work. Scouts are read-only and must
not edit files, stage commits, run services, or read `.env` files.

Scout briefs should include:

- task and scope
- paths, docs, or search terms to inspect
- off-limits files
- exact facts to return

Scout output should include paths inspected, reusable patterns, ownership
rules, focused checks, stale docs or router risks, and unresolved gaps.

## Gatekeeper Contract

Use a read-only gatekeeper pass after broad, shared, public API, package,
harness, or high-risk changes. The gatekeeper checks the diff against
`AGENTS.md`, route-selected docs and skills, package scripts, and source-backed
contracts. It reports exact commands run, commands skipped, stale docs or
router entries, and residual risk.
