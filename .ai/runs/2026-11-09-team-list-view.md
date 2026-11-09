# Execution plan — implement the team list view (S1-13)

Source doc: .ai/specs/implemented/2026-10-26-team-list-view.md
Spec PR: #123 (merged)

## 🎯 Goal

Implement the approved S1-13 specification: the team's ticket list at `/tickets` across all of a person's projects – a table on tablets and desktops and cards on phones from one TanStack Table 9 row model, filters and sorting kept in the URL, the five predefined views, approving and refusing sharing requests from "Pending sharing approvals", and bulk changes of status, priority and assignee with per-ticket results.

## Scope

- Contracts: the team list query (filters, `sort`, `order`), `ticketListItemSchema` (team and end-user shapes without `description`), the bulk-change request and result schemas, `organizationsExist` in `currentUserSchema`, the team's organization name list.
- Server: filters and sorting in `TicketsService.list` (team only), `POST /tickets/bulk-changes` through the single-change service methods, the organization `read_name` rule and `organizationsExist`, migration `add_ticket_list_indexes`, demo dataset additions.
- Packages: `Table` in `@trybun/ui` with stories.
- Web: the identifier lookup reads the detail by ID; `/tickets` list page, navigation item, view picker, filter bar and panel, sort, table and cards, Show more, selection, bulk action bar, reject-reason and result dialogs, sharing row actions; `@tanstack/react-table` 9.
- Docs: the `docs/spec/` changes of the spec's change table, the glossary, the plan row, user documentation (EN, PL), `pnpm help:generate`; the spec moves to `implemented/`.

## Non-goals

Everything the spec lists under Non-goals: label, milestone and SLA filters and columns, the "SLA at risk" view, occurrence sorting, the "blocked" marker (S2-08, S2-09, S4-01, S4-06, S6-03); stored saved views (S2-10); free-text search (S2-04); the Kanban board (S1-14) and the triage queue (S2-06); live updates (S1-15); bulk `duplicate` and bulk sharing approvals; visibility, requester, date and title filters; a product tour.

## Risks

- The list must never return a ticket whose detail returns `404`: the `read` filter of the ability stays the first condition, and the property test over the demo dataset covers the new filters.
- Bulk changes run up to 100 single-ticket transactions in one request; phase 3 measures the duration on the demo dataset.
- Removing `description` from list items changes the identifier lookup that the portal (S1-09) and the team view (S1-10) share; both pages are covered by their existing tests.
- Cursor pages over enum sort keys need a stable tiebreak (`updatedAt`, `id`); integration tests cover equal sort values.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: List API

- [x] 1.1 Add the list, bulk-change and organization-name contracts — 79c8f34
- [x] 1.2 Add filters and sorting to the ticket list for the team — bd72776
- [x] 1.3 Read the ticket detail by ID after the identifier lookup — 4bb3095
- [x] 1.4 Add the list indexes migration — 0cc4e5d

### Phase 2: Organizations for the filter

- [x] 2.1 Let team members read the names of their organizations and add organizationsExist — 18b0c1a

### Phase 3: Bulk changes

- [x] 3.1 Add POST /tickets/bulk-changes with per-ticket results — db91d90

### Phase 4: Web

- [x] 4.1 Add the Table component to @trybun/ui — 98b6b98
- [x] 4.2 Add the ticket list page with the table and the cards — c4fb2a1
- [x] 4.3 Add the filters, the sort and the predefined views — c4fb2a1
- [x] 4.4 Add sharing approval actions to Pending sharing approvals — c4fb2a1
- [x] 4.5 Add the bulk action bar and the result dialog — c4fb2a1

### Phase 5: Documentation and dataset

- [ ] 5.1 Extend the demo dataset and the E2E tests
- [x] 5.2 Write the user documentation — ae28c5b
- [ ] 5.3 Apply the specification changes and move the spec to implemented

### Phase 6: Review

- [ ] 6.1 Apply the code review findings
