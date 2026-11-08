# Execution plan — implement the team ticket view and full form (S1-10)

Source doc: .ai/specs/implemented/2026-10-26-team-ticket-view.md
Spec PR: #120 (merged, design only)
Plan task: `S1-10`

## 🎯 Goal

Build the team ticket view at `/tickets/{identifier}` and the full ticket form at `/tickets/new` exactly as the approved change specification decides (Q1–Q15): field panel by `allowedActions`, immediate saving with undo, assignment with **Assign to me**, the status control with the reject and duplicate dialogs, the activity timeline with the per-person **Hide events** setting, and the type-dependent templates of the full form.

## Scope

- Server and contracts: `users.hide_timeline_events` (migration, `GET`/`PATCH /users/me`); `assignable` and `query` on `GET /projects/{projectId}/members`; project actions `assign_tickets` / `assign_tickets_self` in the CASL abilities; `TICKET_TYPE_DEFAULT_PRIORITY`; integration tests (Testcontainers); `pnpm api:generate`.
- Web: `app/(team)/tickets/[identifier]` and `app/(team)/tickets/new`, `features/tickets` (team view, field panel, assignee and status controls, dialogs, timeline, form, template rule), the header button, `MISSING_TEAM_ROUTES`, component tests, E2E on three devices with axe.
- Catalogues (EN, PL): ticket types and priorities, templates, event texts, view and form texts.
- User documentation (EN, PL): "Create a ticket" and "Ticket view"; `pnpm help:generate`.
- System specification (§3.3, §3.4, §4.5, §7.4, §7.5, §8.6, §18.2, §18.3, §18.5, glossary), plan row S1-10 and S1-17 (Q1), spec moved to `implemented/`, project memory, README if affected.

## Non-goals

- Visibility (S1-11), comments (S1-12), the list (S1-13), the board (S1-14), watching and live updates (S1-15), template management (S1-17), the tour "Creating a ticket" (S1-18).
- Ticking task-list items (Q12), keyboard shortcuts and the command palette (Stage 2), a ticket search for the duplicate original (S2-03).

## Risks

- Large full-stack change: keep API changes additive (BACKWARD_COMPATIBILITY.md); permission decisions only in CASL abilities, with an allowed and a denied test per new action.
- Undo races: refused undos (`412`, `403`, `422`) must never retry or lose typed text.
- E2E on three devices may not run locally when the shared test environment occupies the ports; CI is then the evidence.

## Progress

PR: #256

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: View and timeline

- [x] 1.1 Team ticket route, read-only view and activity timeline — b6fe983
- [x] 1.2 Hide events setting on the account — 0be7f69

### Phase 2: Changes in the view

- [x] 2.1 Editing title, description, type and priority with undo — 655eef7
- [x] 2.2 Assignable members, project assign actions and the assignee control — 8dc3abb
- [x] 2.3 Status control with the reject and duplicate dialogs — 44db847

### Phase 3: Full form

- [x] 3.1 Catalogue templates and the replacement rule — 8224b1f
- [x] 3.2 Full form, header button and navigation to the new ticket — e592926

### Phase 4: Documentation and specification

- [x] 4.1 User documentation and generated help — 18332c6
- [x] 4.2 System specification, plan and spec moved to `implemented/` — 11933db

### Phase 5: Validation and review

- [x] 5.1 Full validation gate — 7c8bca4
- [x] 5.2 Review pass — 9ed04da
