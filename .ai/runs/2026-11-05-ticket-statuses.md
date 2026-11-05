# Execution plan — implement ticket statuses and resolution confirmation (S1-06)

Source doc: .ai/specs/2026-10-26-ticket-statuses.md
Spec PR: #116 (merged, design only)
Plan task: `S1-06`

## 🎯 Goal

Build the status changes of S1-06 exactly as the approved change specification decides: one team endpoint for status changes with the rejection reason, duplicates and reopen rules, the public status in every ticket response, resolution confirmation by the requester with the 7-day automatic close on the timer pattern, and the project share lock for ticket changes (Q23).

## Scope

- Server: `tickets` module (domain rule `status-transitions.ts`, service, controller, abilities, `tickets.sql.ts` locks, events, Worker consumer and timer); the project share lock in S1-05's `PATCH`.
- Contracts: `@trybun/contracts/tickets` (public status, waiting reason, answers, schemas, action and error codes), activity event types.
- Database: new `tickets` columns with check constraints, `ticket_relations`.
- Catalogue texts (EN, PL), generated API client, demo dataset, system specification (§4.3, §4.5, §18.3, glossary), plan status, project memory.

## Non-goals

- Any view, product tour or user documentation (Q14).
- Status changes caused by requester comments, publishing the rejection reason (S1-12); e-mails and watchers (S1-15); affected users (S2-02); relations other than `duplicate_of` (S2-08).

## Risks

- The concurrency rules (project share lock, duplicate locks in ID order, reopen vs. unassignment) need barrier-based integration tests.
- The timer must follow the S0-04 timer pattern and the job payload compatibility rules.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Rules and model

- [x] 1.1 Contracts of statuses, answers, actions and errors — d8c49d6
- [x] 1.2 Migration of the status fields and ticket relations, factories — d0d4c27
- [x] 1.3 Domain rule status-transitions with unit tests — 443bd9c

### Phase 2: Team status changes

- [x] 2.1 change_status rule, allowedActions and response fields — 63930bf, 5334117
- [x] 2.2 Status change endpoint with events, outbox and locks — 5334117
- [x] 2.3 Project share lock in the field PATCH — 5334117
- [x] 2.4 Resolution-confirmation redirect — 5334117

### Phase 3: Requester answer and timer

- [x] 3.1 confirm_resolution rule and endpoint — 63930bf, 5334117
- [ ] 3.2 Worker scheduler and automatic close timer
- [ ] 3.3 Catalogue texts, generated API client and demo dataset
- [ ] 3.4 System specification, glossary, plan and project memory
