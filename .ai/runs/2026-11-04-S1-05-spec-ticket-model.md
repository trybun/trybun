# Execution plan — bring the S1-05 ticket model proposal up to date with main (adopted from PR #115)

**Origin:** adopted — reconstructed by `om-auto-continue-pr` on 2026-11-04 because PR #115 carried no execution plan (its body names only the `Source doc:`).
**PR:** #115 · **Branch:** `S1-05-spec-ticket-model` · **Base:** `main`
**Author:** `om-auto-write-spec` (maintainer's account) — this plan interprets its intent; correct it by editing this file or commenting on the PR.

## 🎯 Goal

Keep PR #115 a design-only change specification for S1-05 that is correct against the current `main`, so the maintainer can answer the ⚠ questions (Q1, Q6, Q8, Q16) on facts, not on the state of 2026-10-26.

## Scope

- `.ai/specs/2026-10-26-ticket-model.md` only, plus this plan.
- Merge of `main` into the branch (72 commits behind; S1-01, S1-02, S1-03 and S1-04 implemented since).

## Non-goals

- Answering the ⚠ questions: they stay the maintainer's (Rule 8).
- Renumbering questions: sibling proposals (#116, #121, #122, #126, the title redaction spec) cite S1-05 Q-numbers.
- Implementation of S1-05 (it ships on its own PR via `om-auto-implement-spec`).
- Changes to `docs/spec/` or the plan: listed in the spec's "Changes to the system specification" and applied when it is implemented.

## Evidence

| Conclusion | Drawn from | Confidence |
|---|---|---|
| The spec is otherwise finished and waits on the maintainer | PR body "Status: complete (draft – merge gated on the ⚠ assumptions)", run summary comment | high |
| No human feedback to address | PR has no reviews and no human comments | high |
| Siblings are implemented: S1-01 (#134), S1-02 (#149), S1-03 (#160), S1-04 (#225) | `git log origin/main`, `.ai/specs/implemented/` | high |
| Row locks already exist as `<feature>.sql.ts` functions (`lockProjectForShare`, `lockOrganizationForShare/ForUpdate`), shared through `ProjectsService.lockForShare` | `apps/server/src/modules/*/…sql.ts`, `projects.service.ts` | high |
| `user.deactivated` exists (`users.events.ts`, payload `{ userId }`); `project_member.removed` is only an audit action | `users.events.ts`, `projects.service.ts` `removeMember` | high |
| `organization.not_empty` exists in the contracts; `OrganizationsService.delete` expects S1-05's foreign key | `packages/contracts/src/errors/index.ts`, `organizations.service.ts` | high |
| S1-04 fixed how ticket rules are written: `teamRolesFrom`, kind-bound end-user rules, fail-closed relation restriction `{ project: { is: { state: 'archived' } } }`, record descriptors, `permission-layer.integration.spec.ts` | §18.3, `.ai/specs/implemented/2026-10-26-permission-layer.md` | high |
| The change of account kind is now plan task S1-20, which writes `project_member.removed` | `docs/plan/implementation-plan.md` S1-20 | high |
| Title redaction is now S1-21 with its own spec | `.ai/specs/2026-10-26-title-redaction.md`, plan S1-21 | high |

## Assumptions

- "Address the PR" means refreshing the proposal against `main`, not deciding its open questions.
- Q16 stays ⚠: §18 still names no row-lock pattern, so recording one is a change to the pattern catalogue (Rule 12), even though the code already follows it.

## Risks

- The goal was inferred, not stated (medium): the maintainer may have wanted only a merge of `main`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Already landed on this PR (reconstructed)

- [x] 1.1 Change specification of the ticket model proposed — 44e5b79

### Phase 2: Bring the proposal up to date with main

- [x] 2.1 Merge main into the branch — 9d71265
- [x] 2.2 Align the spec with the implemented S1-01 to S1-04 code and specifications — 8f96ef2
- [x] 2.3 Align the spec with the plan tasks S1-20 and S1-21 — 8f96ef2
- [x] 2.4 Validate (spec lint, Prettier) and record the changelog entry — 8f96ef2

### Phase 3: Review and hand back

- [x] 3.1 Specification review pass and fixes — c3b868f
