# Execution plan — record the maintainer's approval of the S1-09 end-user portal proposal (adopted from PR #118)

**Origin:** adopted — reconstructed by `om-auto-continue-pr` on 2026-11-06 because PR #118 carried no execution plan (its body names only the `Source doc:`).
**PR:** #118 · **Branch:** `S1-09-spec-end-user-portal` · **Base:** `main`
**Author:** `om-auto-write-spec` (maintainer's account) — this plan interprets its intent; correct it by editing this file or commenting on the PR.

## 🎯 Goal

Turn PR #118 into an approved, design-only change specification for S1-09: current against `main`, with the maintainer's answers to Q1–Q16 recorded and the approved plan changes applied, so it can be merged and implemented on its own PR.

## Scope

- `.ai/specs/2026-10-26-end-user-portal.md`, the S1-09, S1-12, S1-15, S1-18 and S2-03 rows of `docs/plan/implementation-plan.md`, and this plan.
- Merge of `main` into the branch (85 commits behind; S1-01 to S1-07 implemented).

## Non-goals

- Implementation of S1-09 (its own PR via `om-auto-implement-spec`).
- Changes to `docs/spec/`: listed in the spec's "Changes to the system specification" and applied when it is implemented (step 11).

## Evidence

| Conclusion | Drawn from | Confidence |
|---|---|---|
| The spec is finished and waits on Q1 and Q11 | PR body "Decision needed", run summary comment | high |
| Q1 `/portal` + IDs, Q11 approved, Q2–Q10 and Q12–Q16 accepted, plan changes applied in this PR | The maintainer's answers in the session of 2026-11-06 | high |
| Q11 still stands: `publicStatusOf` maps `todo`, `in_progress`, `in_verification` to one public status; `status_changed` stores internal codes | `packages/contracts/src/tickets/index.ts`, `packages/contracts/src/activity-events/index.ts` | high |
| S1-06 leaves the confirmation page to S1-09 (its Q11, approved) | `.ai/specs/implemented/2026-10-26-ticket-statuses.md` | high |
| Plan changes go into the spec PR at the maintainer's request | Precedent of PR #116 | high |

## Assumptions

- The maintainer's answers in the session are the human approval Rule 8 requires; the status becomes `approved`, as for S1-06.

## Risks

- None beyond the design itself; nothing runs until the implementation PR.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Already landed on this PR (reconstructed)

- [x] 1.1 Change specification of the end-user portal proposed — 4c7e42a

### Phase 2: Bring the proposal up to date with main

- [x] 2.1 Merge main into the branch — 80e1e43
- [x] 2.2 Check the spec against the implemented S1-01 to S1-07 code — 941dd9e

### Phase 3: Approval

- [x] 3.1 Record the maintainer's approval of every open question — 941dd9e
- [x] 3.2 Apply the approved plan changes — 484daf6

### Phase 4: Validation and review

- [x] 4.1 Run the validation gate and the specification review — 484daf6

### Phase 5: Specification review fixes

- [x] 5.1 Apply the findings of the specification review (Q17–Q20 approved by the maintainer) — 73097ad
- [x] 5.2 Apply the findings of the re-review — dd07291
