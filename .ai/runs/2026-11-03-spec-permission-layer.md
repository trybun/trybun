# Execution plan — refresh the S1-04 permission-layer specification (adopted from PR #114)

**Origin:** adopted — reconstructed by `om-auto-continue-pr` on 2026-11-03 because PR #114 carried no execution plan.
**PR:** #114 · **Branch:** `spec-permission-layer` · **Base:** `main`
**Author:** @dtk7c2 — this plan interprets their intent; correct it by editing this file or commenting on the PR.

## 🎯 Goal
Bring the S1-04 change specification up to date with `main`, where S1-01, S1-02 and S1-03 are now implemented, so it can be reviewed and approved.

## Scope
`.ai/specs/2026-10-26-permission-layer.md` only (design-only PR).

## Non-goals
- Implementing S1-04 (own PR via `om-auto-implement-spec`).
- Deciding the open questions — they stay proposals for the maintainer.

## Evidence
| Conclusion | Drawn from | Confidence |
|---|---|---|
| The spec must be refreshed | #111, #112, #113 merged; `main` has `@casl/prisma`, `forRoot({ rules, restrictions })`, `PrismaRecordAccess`, `User` rules | high |
| Q1 is settled | merge order of #111–#113; the run summary comment gated the PR only on Q1 | high |
| End users' project access is missing | `projects.abilities.ts` returns early for `end_user` | high |

## Assumptions
- Refreshing the specification (not only re-labelling the PR) is the remaining work, because its Context and design describe code that has since changed.

## Risks
- Q5 and Q10 change behaviour/requirements and need the maintainer's approval.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Already landed on this PR (reconstructed)

- [x] 1.1 Change specification of the permission layer drafted — 3d5f4e7

### Phase 2: Refresh against main

- [x] 2.1 Merge main into the branch — 3e5df38
- [x] 2.2 Rewrite Context, design, open questions and plan to the delta against main — 762c50b
