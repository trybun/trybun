# Execution plan — implement the end-user portal (S1-09)

Source doc: .ai/specs/2026-10-26-end-user-portal.md
Spec PR: #118 (merged, design only)
Plan task: `S1-09`

## 🎯 Goal

Build the end-user portal exactly as the approved change specification decides (Q1–Q20): the `(portal)` route group under `/portal` with the counterparts table of redirects, the portal shell, the portal root and project home, the simplified ticket form, "My tickets", the ticket view with the public status description and the public timeline, the resolution confirmation (panel and page), `/portal/settings`, `/help` in the shell of the reader's kind, and the API additions that keep internal data out of end-user responses.

## Scope

- Contracts (`@trybun/contracts`): `involvement=mine`, `ticketProjectReferenceSchema` (`project` on ticket responses), `publicStatusDescriptionSchema` and `publicStatusDescriptionOf`, `endUserActivityEventSchema` (allow-list), `endUserProjectSchema`.
- Server: `tickets` (list with `involvement=mine` in `tickets.sql.ts`, `project` reference, description code), `activity-events` (end-user shape), `projects` (end-user shape); integration tests with `z.strictObject` end-user schemas.
- Web: `app/(portal)/portal/…` routes, `app/help/` moved out of `(team)`, `/portal/settings`, counterparts table and redirects, portal navigation, `features/tickets` (queries, mutations, search params, components), product-tour provider in the portal shell.
- Catalogues (EN, PL): `portal` namespace, `tickets.publicDescriptions` rekeyed to the Q11 codes.
- User documentation (EN, PL): the three how-to pages of Q16, `getting-started` and `change-language` views; `pnpm help:generate`.
- Demo dataset, `pnpm api:generate`, system specification (§4.2, §4.3, §5.7, §18.5, glossary), plan status, README if affected, project memory.

## Non-goals

- Attachments in the form and the view (S1-08 not implemented): the form and the view leave the place for S1-08's field and list; step 5 delivers only what exists.
- The visibility switch (S1-11 not implemented): the form creates `only_me` tickets (Q8).
- The team ticket route `/tickets/{identifier}` (S1-10): a team member opening a portal ticket goes to `/` until S1-10 (Q1).
- Comments, editing (S1-12); watchers, e-mails, signed tokens (S1-15); portal search (S2-03); tours and reference pages (S1-18); `Idempotency-Key` (S6-01, Q20).

## Risks

- Large full-stack change: keep the API additions additive (BACKWARD_COMPATIBILITY.md) and the end-user shapes strict.
- Moving `/help` out of `(team)` must keep every help address and the help tests green.
- The `involvement=mine` order needs raw SQL that filters only by requester; records are loaded through the ability (§18.3).
- E2E on three devices with axe for every portal view; the seeded end user needs projects and tickets in the demo dataset.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Shell and routing

- [x] 1.1 Portal navigation, the `(portal)` layout, `app/help/` and `/portal/settings` — 60397fe
- [x] 1.2 Counterparts table and redirects by account kind — 60397fe
- [x] 1.3 End-user project response and the portal root — fff2ec4

### Phase 2: Creating a ticket

- [x] 2.1 Project home and the simplified ticket form — 184a4e6
- [x] 2.2 Attachments and visibility switch (deferred parts recorded) — 508a3e4

  > Deferred: S1-08 and S1-11 are not merged; their plan rows wire the attachment field and the visibility switch into the portal (Q8).

### Phase 3: Following tickets

- [x] 3.1 `involvement=mine` and the project reference — fa4c877
- [x] 3.2 Public status description and end-user activity events — fa4c877
- [x] 3.3 My tickets and the ticket view — 2c64f12

### Phase 4: Resolution confirmation

- [x] 4.1 Confirmation panel and confirmation page — 2c64f12

### Phase 5: Documentation and data

- [x] 5.1 User documentation, demo dataset and generated artifacts — ac36954
- [x] 5.2 System specification, plan and spec moved to `implemented/` — 508a3e4

### Phase 6: Validation and review

- [ ] 6.1 Full validation gate
- [ ] 6.2 Review pass
