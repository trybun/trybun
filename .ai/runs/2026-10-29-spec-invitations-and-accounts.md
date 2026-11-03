# Execution plan — record the maintainer's approval of the invitations and accounts specification (adopted from PR #113)

**Origin:** adopted — reconstructed by `om-auto-continue-pr` on 2026-10-29 because PR #113 carried no execution plan.
**PR:** #113 · **Branch:** `S1-03-spec-invitations-and-accounts` · **Base:** `main`
**Author:** @dtk7c2-claude — this plan interprets the maintainer's review; correct it by editing this file or commenting on the PR.

## 🎯 Goal

Apply the maintainer's answers ("Q1: accepted", "Q2: accepted", "Q14: accepted", "Spec: accepted") to the change specification and the implementation plan, and make the PR ready for merge.

## Scope

`.ai/specs/2026-10-26-invitations-and-accounts.md`, the plan rows the accepted answers change in `docs/plan/implementation-plan.md` (S1-15 for Q1, the reference to the existing task S1-20 for Q2), and the PR's metadata (body, draft state, labels).

## Non-goals

- Implementing S1-03 – it ships on its own PR via `om-auto-implement-spec`.
- Answering AQ1–AQ5 of `.ai/specs/2026-10-25-invitation-acceptance.md` – they belong to that specification and still gate the implementation.
- Changing any proposed answer – all were accepted as written.
- Splitting S1-03 (Q13 was accepted as proposed: one task, one PR).
- Updating `docs/spec/` – that happens in the implementation PR (Rule 8, `.ai/specs/README.md`).

## Evidence

| Conclusion | Drawn from | Confidence |
|---|---|---|
| Q1, Q2 and Q14 are confirmed | Comment by @dtk7c2 on 2026-10-29: "Q1: accepted / Q2: accepted / Q14: accepted" | high |
| The specification and answers 1–15 are approved | Same comment: "Spec: accepted" | high |
| An approved spec has status `approved` | `.ai/specs/README.md` lifecycle table | high |
| Accepted plan changes land in the spec PR | Q1 and Q2 say "the maintainer adds" them to the plan; precedent: #111 changed plan rows S1-01 and S1-04 in its spec PR | high |

## Assumptions

- "Spec: accepted" approves all fifteen proposed answers unchanged, including Q13 (no split of S1-03).
- Q2 is covered by the existing task S1-20 (group 4, #130), which `main` gained while this PR was open; the merge of `main` dropped the duplicate row this PR had added.

## Risks

None beyond a docs-only change.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Already landed on this PR (reconstructed)

- [x] 1.1 Change specification for the rest of S1-03 proposed — 9178ee0

### Phase 2: Apply the maintainer's answers

- [x] 2.1 Mark the specification approved and its open questions answered — 0ecb0b8
- [x] 2.2 Add the invitation e-mails to S1-15 and a plan task for the kind and e-mail change — dc56e25
- [x] 2.3 Promote the PR from draft to ready — 318515e
- [x] Post-review fix: merge main, keep its S1-20 (#130) instead of a second one — 5b228c7
