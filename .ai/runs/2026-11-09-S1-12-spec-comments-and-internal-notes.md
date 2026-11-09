# Execution plan — finish the S1-12 comments and internal notes specification (adopted from PR #122)

**Origin:** adopted — reconstructed by `om-auto-continue-pr` on 2026-11-09 because PR #122 carried no execution plan.
**PR:** #122 · **Branch:** `S1-12-spec-comments-and-internal-notes` · **Base:** `main`
**Author:** `om-auto-write-spec` pipeline run — this plan interprets its intent; correct it by editing this file or commenting on the PR.

## 🎯 Goal

Make the S1-12 change specification `.ai/specs/2026-10-26-comments-and-internal-notes.md` mergeable: current with `main`, consistent with the implemented S1-04 to S1-11, and with its open questions decided by the maintainer.

## Scope

- `.ai/specs/2026-10-26-comments-and-internal-notes.md` only (design-only PR).
- The PR body, labels and draft state.

## Non-goals

- Implementing S1-12. It ships on its own PR through `om-auto-implement-spec`.
- Editing `docs/spec/` or `docs/plan/`. The implementation PR applies the spec's "Changes to the system specification" table.
- Re-deciding questions already settled by the merged sibling specifications.

## Evidence

| Conclusion | Drawn from | Confidence |
|---|---|---|
| The PR stays a draft until Q2 and Q3 (and, at the maintainer's request, every open question) are confirmed | PR body "Decision needed"; the `om-auto-write-spec` defaults comment | high |
| The spec refers to proposals that are now implemented | `git log`: S1-04 to S1-11 merged after the branch point (103 commits behind), the sibling specs are in `.ai/specs/implemented/` | high |
| The precedent: merge `main`, align the spec with the code, record the maintainer's answers, run the specification review | PR #121 plan `.ai/runs/2026-11-08-S1-11-spec-ticket-visibility.md` and its outcome comment | high |

## Assumptions

- The maintainer decides every open question in this session (Q1–Q21; Q21 added by the alignment). Done on 2026-11-09: all recommended answers approved.
- The specification review runs through `om-auto-review-pr 122 --autofix`, as for PR #120 and #121.

## Risks

- The implemented code may differ from the proposals the spec was written against. The spec is aligned to the code, never the other way round.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Already landed on this PR (reconstructed)

- [x] 1.1 Draft the S1-12 specification with autonomous defaults — 04997bf

### Phase 2: Bring the specification up to date

- [x] 2.1 Merge main into the branch — 327aaa8
- [x] 2.2 Align the specification with the implemented S1-04 to S1-11 — bee4f5c

### Phase 3: Record the maintainer's decisions

- [x] 3.1 Record the answers to Q2 and Q3 — ce14818

### Phase 4: Review and finalize

- [ ] 4.1 Run the specification review and apply its findings
- [ ] 4.2 Update the PR body, labels and draft state
