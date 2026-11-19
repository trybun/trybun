# Change specifications

This folder contains **change specifications**: one file per change (new feature, change of behavior or requirements). A change specification describes **what changes and why**. The **system specification** in [`docs/spec/`](../../docs/spec/README.md) describes **what the system is now** and remains the source of truth.

Rules: [`docs/spec/02-agent-rules.md`](../../docs/spec/02-agent-rules.md) §2.8 (Rule 8); process: [`SDLC.md`](../../SDLC.md), "Specification before implementation", and [`AGENTS.md`](../../AGENTS.md), "Working practices".

## Naming

- `YYYY-MM-DD-slug.md` – the date the specification was created, a short English slug in kebab-case, e.g. `2026-11-03-ticket-visibility.md`.
- If the name already exists, append `-2`, `-3`, …

## Lifecycle

| Status | Location | Meaning |
|---|---|---|
| `draft` | `.ai/specs/` | Being written on an open specification pull request; open questions and assumptions to confirm may exist |
| `approved` | `.ai/specs/` | Accepted by the maintainer by merging the specification pull request to `main`; all open questions and assumptions decided |
| `implemented` | `.ai/specs/implemented/` | Implemented and merged; the system specification is updated |
| `archived` | `.ai/specs/archive/` | Abandoned or superseded; the reason (and the replacing specification) is written in the changelog |

The status is the `Status` row of the table under the title. Acceptance is decided by the presence of the specification on `main`, not by that row: a specification merged with the status `draft` (for example merged on GitHub without a last correction) is accepted, and the implementation pull request corrects its status.

**Implementation never starts before the specification pull request is merged to `main`** – also when an agent answered the open questions with defaults of its own. Those defaults (the resolved assumptions) are only a proposal, which the maintainer accepts by merging.

## When a change specification is required

- Required: new functionality and changes of behavior or requirements, including tasks of the implementation plan that deliver functionality.
- Optional: infrastructure tasks (e.g. most of Stage 0), larger refactorings.
- Not used: bug fixes, dependency updates, documentation-only changes, clarifications of the system specification.

## Flow

1. Create the change specification from [`TEMPLATE.md`](TEMPLATE.md) and open a pull request with it (status `draft`, `Refs #N` of the issue, never `Closes`) – `om-spec-writing` or `om-auto-write-spec`.
2. The maintainer answers the open questions and the assumptions. When they accept them, they merge the specification pull request – themselves or by telling an agent in the session to merge it. An agent merging at the maintainer's word sets the status to `approved` before the merge.
3. Implement in a separate pull request from a branch of the current `main`, which already contains the specification (`om-auto-implement-spec`, `om-auto-create-pr`). The implementation pull request refers to the specification pull request (`Refs`), has a `Source doc:` line and `Closes #N` of the issue.
4. In the implementation pull request: update the system specification (`docs/spec/`, Rule 8), set the status to `implemented`, add a changelog entry and move the file to `implemented/`.
