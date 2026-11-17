# Execution plan — land the invitations-of-many-accounts spec as implemented (adopted from PR #358)

**Origin:** adopted — reconstructed by `om-auto-continue-pr` on 2026-11-17 because PR #358 carried no execution plan.
**PR:** #358 · **Branch:** `spec/invitations-of-many-accounts` · **Base:** `main`
**Author:** @dtk7c2 (`om-auto-write-spec` run) — this plan interprets the PR's intent; correct it by editing this file or commenting on the PR.

## 🎯 Goal

Merging #358 lands the change specification of #357 on `main` in its final state: `implemented`, in `.ai/specs/implemented/`, because its implementation PR #359 has already merged.

## Scope

`.ai/specs/2026-11-15-invitations-of-many-accounts.md` (status, acceptance criteria, changelog, location), the `Source doc` line of the #359 plan (`.ai/runs/2026-11-15-invitations-of-many-accounts.md`, which reaches the branch by merging `main`) and this plan.

## Non-goals

- Any change to the implementation, `docs/spec/` (§7.4, §12.1 and §18.5 were updated by #359) or the requirements of the spec.
- Any other edit of the #359 plan: it records that run as it happened.

## Evidence

| Conclusion | Drawn from | Confidence |
|---|---|---|
| Implementation is on `main` | #359 merged 2026-11-17 (`a5c676c`) | high |
| The move was deferred to "once both PRs have merged" | #359 body (*Spec status*), `.ai/runs/2026-11-15-invitations-of-many-accounts.md` on `main` (Non-goals) | high |
| The implementation PR normally sets `implemented` and moves the file | `.ai/specs/README.md` (Flow, step 4), §2.8 of `docs/spec/02-agent-rules.md` | high |
| A spec that reaches `main` after its implementation lands directly in `implemented/` | `cb7b0e0` (#314) created `.ai/specs/implemented/2026-11-12-ticket-filter-value-limit.md` | high |
| Q2–Q4 are confirmed | maintainer confirmation on #358 (2026-11-17), spec commit `57ccfae` | high |
| Every acceptance criterion holds on `main` | `apps/server/src/modules/invitations/invitations.integration.spec.ts` (#357 tests), `apps/server/src/permission-layer.integration.spec.ts` ("lists for %s by account only the invitations its detail check allows"), `apps/web/src/features/users/queries.spec.ts` (2 requests), `account-components.spec.tsx` / `inviting-flows.spec.tsx` (last invitation), `apps/server/openapi.json` (`userId` 1–50), §7.4/§12.1/§18.5 text, green CI of #359 | high |

## Assumptions

- The spec PR, not a follow-up PR, moves the file: it is the last of the two PRs to merge, and a follow-up would leave a `draft` spec of shipped behaviour on `main` in between.
- The verified acceptance criteria are checked (`- [x]`), as in `2026-11-12-ticket-filter-value-limit.md`.

## Risks

- None for the product: documentation only.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Already landed on this PR (reconstructed)

- [x] 1.1 Spec written, reviewed, aligned with #359, Q2–Q4 confirmed, QA memory entry — 377155b

### Phase 2: Land the spec as implemented

- [x] 2.1 Set the status to implemented, check the verified acceptance criteria, add the changelog entry and move the spec to implemented/ — 7a3629f
- [ ] 2.2 Merge main and point the Source doc of the #359 plan to implemented/
