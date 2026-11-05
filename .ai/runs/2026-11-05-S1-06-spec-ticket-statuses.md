# Execution plan — bring the S1-06 ticket statuses proposal up to date with main and the review of #226 (adopted from PR #116)

**Origin:** adopted — reconstructed by `om-auto-continue-pr` on 2026-11-05 because PR #116 carried no execution plan (its body names only the `Source doc:`).
**PR:** #116 · **Branch:** `S1-06-spec-ticket-statuses` · **Base:** `main`
**Author:** `om-auto-write-spec` (maintainer's account) — this plan interprets its intent; correct it by editing this file or commenting on the PR.

## 🎯 Goal

Keep PR #116 a design-only change specification for S1-06 that is correct against the implemented S1-05 ticket model and carries the maintainer's note from the review of #226 (project share lock for ticket changes), so the maintainer can answer Q2 and approve the proposal on current facts.

## Scope

- `.ai/specs/2026-10-26-ticket-statuses.md` only, plus this plan.
- Merge of `main` into the branch (77 commits behind; S1-05 implemented in #226, #228, #230).

## Non-goals

- Answering the ⚠ question Q2 or any other open question: they stay the maintainer's (Rule 8).
- Renumbering questions: sibling proposals cite S1-06 Q-numbers.
- Implementation of S1-06 (it ships on its own PR via `om-auto-implement-spec`), including the lock in S1-05's `PATCH`.
- Changes to `docs/spec/` or the plan: listed in the spec's "Changes to the system specification" and applied when it is implemented.

## Evidence

| Conclusion | Drawn from | Confidence |
|---|---|---|
| The spec is otherwise finished and waits on the maintainer (Q2) | PR body "Status: complete", run summary comment | high |
| S1-06 must take the project's share lock in the status change and in S1-05's field `PATCH` | Maintainer's comment "Note from the implementation of S1-05 (#226)" on PR #116 (2026-11-04) | high |
| S1-05 is implemented; its spec is in `implemented/`, Q1 (boundary) approved 2026-11-04 | `.ai/specs/implemented/2026-10-26-ticket-model.md`, plan row S1-05 `[x]` | high |
| `ticketStatusSchema` and `TERMINAL_TICKET_STATUSES` already exist in `@trybun/contracts/tickets` | `packages/contracts/src/tickets/index.ts` | high |
| `TicketsService.update` reads the ticket through the ability without a project lock; `create` locks via `ProjectsService.lockForShare` | `apps/server/src/modules/tickets/tickets.service.ts` | high |
| Assignee eligibility is decided after the share locks of the membership and the account; the unassignment re-checks under the same locks per batch (#229) | `tickets.service.ts` `assertEligibleAssignee`, `ticket-unassignment.service.ts` | high |
| The archived restriction of tickets is `archivedProjectsOfTicketsRestriction` (`409 project.archived`) | `tickets.abilities.ts` | high |
| Row lock is a recorded pattern (§18.3) | `docs/spec/18-code-patterns.md` | high |

## Assumptions

- "Address the PR" means applying the maintainer's note and refreshing the proposal against `main`, not deciding its open questions.
- The lock is recorded as a new question Q23 with the maintainer's proposal as its answer, so the approval of the whole specification covers it; it follows the existing Row lock pattern, so no §18 change is needed.
- The reopen's assignee check (Q22) takes the same membership and account share locks as S1-05's assignment, for the same race the note describes.

## Risks

- The goal was inferred, not stated (medium): the maintainer may have wanted only the lock note applied.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Already landed on this PR (reconstructed)

- [x] 1.1 Change specification of ticket statuses proposed — c5912ac

### Phase 2: Bring the proposal up to date with main and the review of #226

- [x] 2.1 Merge main into the branch — e73d40b
- [x] 2.2 Apply the maintainer's project share lock note to the spec — 2da47a5
- [x] 2.3 Align the spec with the implemented S1-05 code and specification — 2da47a5
- [x] 2.4 Validate (spec lint, Prettier) and record the changelog entry — 2da47a5
