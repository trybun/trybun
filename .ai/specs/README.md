# Change specifications

This folder contains **change specifications**: one file per change (new feature, change of behavior or requirements). A change specification describes **what changes and why**. The **system specification** in [`docs/spec/`](../../docs/spec/README.md) describes **what the system is now** and remains the source of truth.

Rules: [`docs/spec/02-agent-rules.md`](../../docs/spec/02-agent-rules.md) §2.8 (Rule 8).

## Naming

- `YYYY-MM-DD-slug.md` – the date the specification was created, a short English slug in kebab-case, e.g. `2026-11-03-ticket-visibility.md`.
- If the name already exists, append `-2`, `-3`, …

## Lifecycle

| Status | Location | Meaning |
|---|---|---|
| `draft` | `.ai/specs/` | Being written; open questions may exist |
| `approved` | `.ai/specs/` | Approved by a human through the specification pull request; all open questions answered |
| `implemented` | `.ai/specs/implemented/` | Implemented and merged; the system specification is updated |
| `archived` | `.ai/specs/archive/` | Abandoned or superseded; the reason (and the replacing specification) is written in the changelog |

**Implementation never starts while the specification has unanswered open questions.**

## When a change specification is required

- Required: new functionality and changes of behavior or requirements, including tasks of the implementation plan that deliver functionality.
- Optional: infrastructure tasks (e.g. most of Stage 0), larger refactorings.
- Not used: bug fixes, dependency updates, documentation-only changes, clarifications of the system specification.

## Flow

1. Create the change specification from [`TEMPLATE.md`](TEMPLATE.md) and open a pull request with it (status `draft`).
2. Answer open questions; when a human approves and merges, the status is `approved`.
3. Implement in a separate pull request that refers to the specification.
4. In the implementation pull request: update the system specification (`docs/spec/`, Rule 8), set the status to `implemented`, add a changelog entry and move the file to `implemented/`.
