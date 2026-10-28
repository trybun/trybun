# Execution plan – Organizations (S1-02)

Source doc: .ai/specs/2026-10-26-organizations.md
Plan task: S1-02 (docs/plan/implementation-plan.md)
Spec PR: #112 (merged)
Branch: S1-02-organizations

## Goal

Implement the approved change specification for organizations: the `organizations`, `organization_domains`, `organization_projects` and `organization_members` models, unique e-mail domains with public mail domains blocked, project access, membership with move and undo, archiving, unarchiving and deleting, audit entries with `details`, `findForInvitation` for S1-03, the Administrator panel views, the getting-started item, the product tour and the user documentation.

## Scope

- Server: `apps/server/prisma/` (models, enum, migration with the `lower(name)` index), `apps/server/src/modules/organizations/` (service, controller, abilities, `domain/email-domains.ts` with the blocklist data file), `apps/server/src/modules/audit-log-entries/` (new actions and typed `details`), `apps/server/src/modules/users/` (`create_organization` on `/users/me`), `apps/server/src/modules/administration/` (getting-started item), factories, demo dataset.
- Contracts: `packages/contracts/src/organizations/`, error codes.
- Web: `apps/web/src/features/organizations/`, routes `app/(team)/admin/organizations/…`, the read-only section in the project settings, the product tour, catalogues EN/PL.
- Docs: `docs/user/` (EN, PL), the system specification sections listed in the spec, the spec moved to `implemented/`, plan task S1-02 ticked.

## Non-goals

As in the spec: no effects on ticket visibility (S1-11); no invitations or domain matching on acceptance (S1-03, only `findForInvitation`); no derived project access of members in the project abilities (S1-04); no hiding of organization elements; no SLA policy; no anonymization or export (S1-16); no account kind change; no outbox events.

## Implementation Plan

### Phase 1: Organizations and domains

1. Prisma models `Organization`, `OrganizationDomain`, enum `OrganizationState`, the `lower(name)` index; contracts, error codes; factories; enum test.
2. Pure rules `domain/email-domains.ts` with the blocklist data file; table tests.
3. `organizations.abilities.ts` with the archived restriction, record access, `create_organization` on `/users/me`; abilities tests.
4. Endpoints list, create, detail, change (name, domains), archive, unarchive, delete with audit entries; integration tests.
5. Web: list, create dialog, detail with the domains section, archive/unarchive/delete, the checklist item; component tests and E2E.

### Phase 2: Project access and membership

6. `OrganizationProject`, `projectIds` in `PATCH`, `findForInvitation`; integration and table tests.
7. `OrganizationMember` and the member endpoints with move, `removeMembership` and the cascade on delete; integration tests.
8. Web: projects and members sections, move confirmation, undo of a removal, the section in the project settings; component and E2E tests.
9. User documentation EN and PL, `pnpm help:generate`, the product tour, the specification updates, the spec moved to `implemented/`, the plan task ticked.

## Risks

- The blocklist of public mail domains is a vendored data file (Q1); its licence must be MIT-compatible.
- `organization_members` and the archived restriction must not block `removeMembership` for account changes (Q4).
- Size: nine steps across server, contracts and web; the run commits and pushes per phase so `om-auto-continue-pr` can resume.
- The configured `baseBranch` (`auto`) does not exist on the remote; the run targets `main`, the repository's default branch.

## Progress

PR: #149

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Organizations and domains

- [x] 1.1 Prisma models, migration, contracts, factories, enum test — 6b2373a
- [x] 1.2 E-mail domain rules and blocklist — 51aa800
- [x] 1.3 Organization abilities, record access, create_organization — 96af112
- [x] 1.4 Organization endpoints with audit entries — 82b4124
- [ ] 1.5 Web: list, create dialog, detail with domains, checklist item

### Phase 2: Project access and membership

- [x] 2.1 Project access and findForInvitation — 82b4124
- [x] 2.2 Members endpoints, move, removeMembership — 82b4124
- [ ] 2.3 Web: projects and members sections, project settings section
- [ ] 2.4 User documentation, product tour, specification updates
