# Execution plan — implement the ticket model (S1-05)

Source doc: .ai/specs/2026-10-26-ticket-model.md
Spec PR: #115 (merged, design only)
Plan task: `S1-05`

## 🎯 Goal

Build the ticket model of S1-05 exactly as the approved change specification decides: tickets with per-project numbers from a locked counter, the immutable project and frozen key, deletion guards, immutable activity events for every field change, and the automatic unassignment of deactivated or removed team members.

## Scope

- Server: new modules `tickets` and `activity-events`; extensions to `projects`, `organizations`, `users` (lock functions, `hasTickets`, `project_member.removed`, deletion guards); `platform/database` (`isForeignKeyViolation`); Worker consumers.
- Contracts: `@trybun/contracts` features `tickets` and `activity-events`, new error codes, `create_ticket` project action, `hasTickets` on project and organization responses.
- Web: key and deletion hints on the project settings page and the organization page, error texts (EN, PL), generated API client.
- Demo dataset, user documentation (EN, PL), system specification, glossary, plan status.

## Non-goals

- Status changes, transitions, public status (S1-06); visibility and sharing (S1-11); comments (S1-12); ticket views and forms (S1-09, S1-10); list filters (S1-13); outbox events of ticket changes (S1-15); `Idempotency-Key` (S6-01).
- Changing the implementation plan rows of other tasks (the spec leaves them to the maintainer).

## Risks

- Large change crossing several modules; the permission layer and the row locks must follow the S1-04 and S1-01 patterns exactly.
- The 50-concurrent-creations test depends on pool and transaction timeouts.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Model and creation

- [x] 1.1 Contracts of tickets and activity events — bc87c00
- [x] 1.2 Ticket and counter models, migration and factories — 33f1a58
- [x] 1.3 Ticket abilities, record descriptor and archived restriction — 14dc594
- [x] 1.4 Create, list and read tickets with the locked counter — ddde7dd

### Phase 2: Changes and activity events

- [x] 2.1 Activity events module with the immutable table — 1d2075b
- [x] 2.2 Ticket updates with events and assignment rules — ddde7dd
- [x] 2.3 Project key and deletion guards, hasTickets, organization deletion guard — 015534e

### Phase 3: Unassignment, permissions, web and documentation

- [ ] 3.1 Unassignment jobs on deactivation and removal
- [ ] 3.2 Permission tests of tickets
- [ ] 3.3 Web hints for the frozen key and the deletion guards
- [ ] 3.4 Demo dataset tickets and events
- [ ] 3.5 User documentation
- [ ] 3.6 System specification, glossary, plan and project memory
