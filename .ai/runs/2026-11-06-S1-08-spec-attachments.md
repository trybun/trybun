# Execution plan — bring the S1-08 attachments proposal up to date with main and get it approved (adopted from PR #119)

**Origin:** adopted — reconstructed by `om-auto-continue-pr` on 2026-11-06 because PR #119 carried no execution plan (its body names only the `Source doc:`).
**PR:** #119 · **Branch:** `S1-08-spec-attachments` · **Base:** `main`
**Author:** `om-auto-write-spec` (maintainer's account) — this plan interprets its intent; correct it by editing this file or commenting on the PR.

## 🎯 Goal

Turn PR #119 into an approvable, design-only change specification for S1-08: current against `main` (S1-04 to S1-07 and S1-09 implemented since it was written), with the gaps this reveals added as open questions with proposed answers, so the maintainer can approve Q1–Q13 (Q13 explicitly) and the new questions.

## Scope

- `.ai/specs/2026-10-26-attachments.md` and this plan.
- Merge of `main` into the branch (89 commits behind).

## Non-goals

- Implementation of S1-08 (its own PR via `om-auto-implement-spec`).
- Changes to `docs/spec/` and `docs/plan/`: listed in the spec's "Changes to the system specification" and applied when it is implemented.
- Answering the open questions of `.ai/specs/2026-10-25-attachment-serving.md` (a separate draft; the S1-08 plan row requires its answers before implementation).

## Evidence

| Conclusion | Drawn from | Confidence |
|---|---|---|
| The spec is finished and waits on Q13 (and approval of Q1–Q12) | PR body "Decision needed", run summary comment | high |
| The spec names proposal-era contracts that landed differently (relation conditions with `is`, `ActivityEventsService.record`, event data `{ from, to }`, end-user event allow-list, `xxxQueryOptions`, fake API client, `ConfirmDialog`, no `Idempotency-Key`) | `apps/server/src/modules/tickets/tickets.abilities.ts`, `packages/contracts/src/activity-events/index.ts`, `apps/web/src/features/*`, `docs/spec/18-code-patterns.md` on `main` | high |
| S1-09 shipped without attachments and hands the portal form and view to S1-08 | Plan row S1-09, `.ai/specs/implemented/2026-10-26-end-user-portal.md` changelog, `new-ticket-form.tsx` | high |
| §4.5 says creating a ticket writes no event and end users see only status, comment and milestone events | `docs/spec/04-ticket-lifecycle.md` | high |
| Precedent: a spec PR is brought up to date with main and approved on the same PR | PR #118 (S1-09), plan `2026-11-06-S1-09-spec-end-user-portal.md` | high |

## Assumptions

- New decisions revealed by the update are added as new open questions (Q14 onwards) with proposed answers; no earlier question is renumbered.
- The approval itself is the maintainer's; this run proposes and does not mark the spec `approved` without it.

## Risks

- None beyond the design itself; nothing runs until the implementation PR.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Already landed on this PR (reconstructed)

- [x] 1.1 Change specification of attachments proposed — 169ad91

### Phase 2: Bring the proposal up to date with main

- [x] 2.1 Merge main into the branch — fb3f16d
- [x] 2.2 Check the spec against the implemented S1-04 to S1-09 code — f576d69

### Phase 3: Validation and review

- [ ] 3.1 Run the validation gate and the specification review

### Phase 4: Approval

- [ ] 4.1 Record the maintainer's answers to the open questions
