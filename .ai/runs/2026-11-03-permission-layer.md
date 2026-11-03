# Execution plan — implement the permission layer (S1-04)

Source doc: .ai/specs/2026-10-26-permission-layer.md
Spec PR: #114 (merged)

## Goal

Implement the approved S1-04 change specification: end users' project access, the role hierarchy and account kinds defined once, record descriptors, fail-closed restrictions (also for invitations), the account rules of S1-20 and the permission matrix as executable tests.

## Scope

`apps/server/src/platform/authorization/`, the `*.abilities.ts` files and services of `projects`, `organizations`, `invitations`, `users`, `apps/server/test/factories/`, `api.module.ts`, `docs/spec/` (§7.1, §7.2, §7.4, §18.3, §18.7, §18.9), the plan row S1-04, the spec moved to `implemented/`.

## Non-goals

- New endpoints, UI, contract codes of `change_kind` / `change_email` (S1-20).
- Ticket rules, token scope (S6-02), an `allowedActionsOf()` helper.

## Implementation Plan

Follows the spec's "Phasing and implementation plan" (steps 1–7), split into the Phases below.

## Risks

- Q10 changes a response (a Developer inviting to an archived project: `409` instead of `403`).
- Nested relation conditions of `@casl/prisma` in memory – covered by unit and filter-equals tests.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Roles, hierarchy and account kinds

- [x] 1.1 Hierarchy helper teamRolesFrom — 2230288
- [x] 1.2 Team conditions on team roles only — 42c3361
- [x] 1.3 Principal factory, matrix tables, hierarchy and kind tests — 30d42f1

### Phase 2: End users' access to projects

- [x] 2.1 End-user project rules and organization access in the project select — 30d42f1
- [ ] 2.2 Integration tests of end users' project access

### Phase 3: Record descriptors

- [x] 3.1 Record descriptors and subject-independent PrismaRecordAccess — 30d42f1
- [ ] 3.2 Selected-fields test

### Phase 4: Restrictions fail closed

- [x] 4.1 Restrictions from the contract action lists — 30d42f1
- [x] 4.2 Invitation restrictions replacing the service checks — 30d42f1

### Phase 5: Account rules

- [x] 5.1 change_kind and change_email rules — 30d42f1

### Phase 6: Permission tests across subjects

- [ ] 6.1 Filter equals check
- [ ] 6.2 Done-when tests of the project response
- [ ] 6.3 Denied-case tests of every existing endpoint

### Phase 7: Specification and documentation

- [ ] 7.1 System specification, plan and project memory
