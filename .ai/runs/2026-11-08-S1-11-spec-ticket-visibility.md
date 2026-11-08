# Execution plan — finish the S1-11 ticket visibility specification (adopted from PR #121)

**Origin:** adopted — reconstructed by `om-auto-continue-pr` on 2026-11-08 because PR #121 carried no execution plan.
**PR:** #121 · **Branch:** `S1-11-spec-ticket-visibility` · **Base:** `main`
**Author:** `om-auto-write-spec` pipeline run — this plan interprets its intent; correct it by editing this file or commenting on the PR.

## 🎯 Goal

Make the S1-11 change specification `.ai/specs/2026-10-26-ticket-visibility.md` mergeable: current with `main`, consistent with the implemented S1-02 to S1-09 and the approved S1-10 specification, and with the ⚠ questions Q1, Q7 and Q8 decided by the maintainer.

## Scope

- `.ai/specs/2026-10-26-ticket-visibility.md` only (design-only PR).
- The PR body, labels and draft state.

## Non-goals

- Implementing S1-11. It ships on its own PR through `om-auto-implement-spec`.
- Editing `docs/spec/` or `docs/plan/`. The implementation PR applies the spec's "Changes to the system specification" table.
- Re-deciding questions already settled by the merged sibling specifications.

## Evidence

| Conclusion | Drawn from | Confidence |
|---|---|---|
| The PR stays a draft until Q1, Q7 and Q8 are confirmed | PR body "Decision needed"; the `om-auto-write-spec` defaults comment | high |
| The spec refers to proposals that are now implemented | `git log`: S1-04 (#225), S1-05 (#226), S1-06 (#231), S1-07 (#234), S1-08 (#244), S1-09 (#240) merged after the branch point | high |
| The S1-10 precedent: merge `main`, align the spec with the code, record the maintainer's answers | PR #120 outcome comment and its commits | high |

## Assumptions

- Answers to Q1, Q7 and Q8 come from the maintainer in this session. The 15 other answers stay reversible proposals.
- The specification review runs through `om-auto-review-pr 121 --autofix`, as for PR #120.

## Risks

- The implemented code may differ from the proposals the spec was written against. The spec is aligned to the code, never the other way round.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Already landed on this PR (reconstructed)

- [x] 1.1 Draft the S1-11 specification with autonomous defaults — 2a296f0

### Phase 2: Bring the specification up to date

- [x] 2.1 Merge main into the branch — 72e2f33
- [x] 2.2 Align the specification with the implemented S1-02 to S1-09 and the S1-10 specification — 2d3b56a

### Phase 3: Record the maintainer's decisions

- [x] 3.1 Record the answers to Q1, Q7 and Q8 — 2d3b56a

### Phase 4: Review and finalize

- [x] 4.1 Run the specification review and apply its findings — 2de28cd
- [ ] 4.2 Update the PR body, labels and draft state
