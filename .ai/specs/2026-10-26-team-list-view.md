# Team list view – filters, sorting, predefined views and bulk actions

| | |
|---|---|
| Status | `approved` |
| Created | 2026-10-26 |
| Plan task | `S1-13` |
| System specification sections | §2.9, §4.1, §5.2, §7.3, §7.4, §7.5, §8.1, §8.3, §12.1, §17.1, §17.2, §18.4, §18.5, §18.6, §18.9, glossary |
| Related issues / PRs | Sibling specifications, all implemented (`.ai/specs/implemented/`): S1-01 projects ([#111](https://github.com/trybun/trybun/pull/111)), S1-02 organizations ([#112](https://github.com/trybun/trybun/pull/112)), S1-04 permission layer ([#114](https://github.com/trybun/trybun/pull/114)), S1-05 ticket model ([#115](https://github.com/trybun/trybun/pull/115)), S1-06 statuses ([#116](https://github.com/trybun/trybun/pull/116)), S1-10 team ticket view ([#120](https://github.com/trybun/trybun/pull/120)), S1-11 visibility ([#121](https://github.com/trybun/trybun/pull/121)), S1-12 comments ([#122](https://github.com/trybun/trybun/pull/122)); depends on this one: S1-14 Kanban board (reuses the filter state) |

## Context

The team has no way to see many tickets at once. S1-05 built `GET /api/v1/tickets` (`listTicketsQuerySchema`) with the cursor envelope and three filters: `projectId` (ordered by number, newest first), `identifier` (the lookup of S1-10's `/tickets/{identifier}`) and `involvement=mine` (the portal's list of S1-09, ordered by "awaiting your reply" first); without a filter it is ordered by creation, newest first. Its items are the full team or end-user ticket (`ticketPageSchema`), including `description`. S1-05 left "filters, sorting and saved views" to S1-13. S1-06 built `PUT /api/v1/tickets/{ticketId}/status` and left bulk changes to S1-13; S1-05 built `PATCH /api/v1/tickets/{ticketId}` for the fields. Both take the expected version in `If-Match`. S1-11 added `sharingRequest` (`none`, `pending`, `rejected`; an approval returns it to `none`) and `POST …/sharing/approve` and `…/sharing/reject` ([§5.2](../../docs/spec/05-visibility-and-search.md)). S1-12 publishes the reason of a rejection as a public comment.

This specification was written against the proposals of these tasks and aligned with their implementation on 2026-11-09.

S1-13 builds the **List** of [§8.1](../../docs/spec/08-team-views.md): the team's main working view across all their projects. The plan's scope: the `Data Table` on TanStack Table 9 ([§18.5](../../docs/spec/18-code-patterns.md)), filters, sorting, the predefined saved views "My open tickets", "Triage", "Critical", "Unassigned" and "Pending sharing approvals", and bulk actions with per-item results. Out of scope: label, milestone and SLA filters and columns, the "SLA at risk" view and sorting by occurrence count (S2-09, S4-01, S4-06, S6-03); the "blocked" marker of [§8.1](../../docs/spec/08-team-views.md) comes with relations (S2-08). Stage 1's exit criterion "Sharing requests are approved or refused from the 'Pending sharing approvals' view" also lands here.

The plan's "Done when" for S1-13:

- a bulk update of 20 tickets with one stale version reports 19 successes and 1 conflict;
- a pending sharing request is listed in "Pending sharing approvals";
- a ticket whose assignee was deactivated is listed in "Unassigned";
- on a phone the list renders as cards.

While reading the specification against the plan and the sibling proposals, this proposal found gaps and one contradiction the specification does not decide. Agents may not decide them (Rule 8). Each one is listed under [Open questions](#open-questions) with the answer the maintainer approved on 2026-11-09. The design below follows these answers.

## Goals

- A team member (Developer and above) sees the tickets of all their projects in one list at `/tickets`, as a table on tablets and desktops and as cards on phones ([§2.9](../../docs/spec/02-agent-rules.md)).
- The list is filtered by project, organization, type, status, priority, assignee, source and sharing request, and sorted by priority, status, identifier, creation or last update ([Q5](#open-questions), [Q8](#open-questions)).
- The five predefined views of [§8.1](../../docs/spec/08-team-views.md) that Stage 1 can serve are one tap away.
- Bulk changes of status, priority and assignee for up to 100 selected tickets, each ticket changed in its own transaction, with a per-ticket result the UI reports ([§17.2](../../docs/spec/17-conventions.md)).
- Pending sharing requests are approved or refused from their view (Stage 1 exit criterion, [Q11](#open-questions)).
- The reference implementation of the data-table pattern of [§18.5](../../docs/spec/18-code-patterns.md), including the phone cards ([Q15](#open-questions)).

## Non-goals

- Label, milestone and SLA filters and columns, the "SLA at risk" view, sorting by occurrence count, the "blocked" marker (S2-08, S2-09, S4-01, S4-06, S6-03).
- User-defined saved views and the `saved_view` model (S2-10, [Q4](#open-questions)).
- Free-text search in the list and the global search that opens it (S2-04, [§8.5](../../docs/spec/08-team-views.md)).
- The Kanban board (S1-14), which reuses the filter state of this task, and the triage queue (S2-06).
- Live updates of the list (S1-15 adds them through query invalidation, [§18.5](../../docs/spec/18-code-patterns.md)).
- Bulk changes to `duplicate` (never offered, [§8.1](../../docs/spec/08-team-views.md)) and bulk sharing approvals ([Q11](#open-questions)).
- Visibility, requester, date and title filters ([Q5](#open-questions)).

## Proposed change

### What the user sees

**Entry point.** The team application shell gets a navigation item **Tickets** (PL „Zgłoszenia”) that opens `/tickets` in the `(team)` route group. An end user who opens `/tickets` is redirected to the portal, as S1-10 does for its routes. `/tickets` without parameters opens "My open tickets" ([Q9](#open-questions)).

**Layout** (top to bottom):

1. **View picker**: the predefined views as a horizontal tab list (tablet, desktop) or a select (phone). The active view is marked; after any filter change no view is marked ("Custom filter" / „Filtr niestandardowy”).
2. **Filter bar**: a **Filter** button and the active filters as removable chips ("Status: New, Triage ×"), a **Clear filters** link, and on phones a **Sort** select. **Filter** opens a popover on tablets and desktops and a bottom sheet (`Drawer`) on phones, with one section per filter ([Filters](#filters)).
3. **The list**: on tablets and desktops a table with a checkbox column, **Identifier**, **Title**, **Status**, **Priority**, **Type**, **Assignee**, **Project**, **Organization** (only while organizations exist, [§7.3](../../docs/spec/07-users-organizations-permissions.md), [Q6](#open-questions)) and **Updated** (relative time through the `next-intl` formatter); tablets hide **Type**, **Project** and **Organization**. On phones each ticket is a card with the identifier, the title (two lines at most), the status, the priority and the assignee, plus a 44 px checkbox. Activating the title (or the card) opens `/tickets/{identifier}` (S1-10). Sortable column headers are buttons with `aria-sort`.
4. **Show more** at the end loads the next 50 tickets ([Q19](#open-questions)).

**Empty states** name the view, e.g. "No open tickets are assigned to you." (PL „Nie masz przypisanych otwartych zgłoszeń.”), "No sharing requests are waiting for approval." (PL „Żadna prośba o udostępnienie nie czeka na zatwierdzenie.”), and for a custom filter "No tickets match these filters." with **Clear filters**.

**Selection and bulk actions.** Selecting at least one ticket shows a bulk action bar – above the table on tablets and desktops, fixed at the bottom on phones with the safe area ([§18.6](../../docs/spec/18-code-patterns.md)) – with "{count} selected", **Status**, **Priority**, **Assignee** and **Clear selection**. The header checkbox selects the loaded tickets. At most 100 tickets can be selected; the 101st checkbox is disabled with the hint "You can change at most 100 tickets at once." (PL „Jednorazowo możesz zmienić najwyżej 100 zgłoszeń.”). Selection is cleared when the view, the filters or the sort change ([Q17](#open-questions)).

An action is offered when at least one selected ticket carries its action code in `allowedActions` (S1-05, S1-06): **Status** with `change_status`, **Priority** with `update_fields`, **Assignee** with `assign` or `assign_self`. Tickets without the action are sent anyway and come back as "not permitted", so the result explains them ([§8.1](../../docs/spec/08-team-views.md)). The UI only reports result codes; it never derives permissions from them. A ticket that became invisible is always reported as "No longer available" (`404`), whatever else applies, because the API checks visibility first.

- **Status** offers the internal statuses except `duplicate`. `rejected` opens a dialog for one reason, used for every selected ticket ([§8.1](../../docs/spec/08-team-views.md), S1-06); S1-12 publishes it on each changed ticket as its own public comment.
- **Priority** offers the four priorities.
- **Assignee** offers **Assign to me** and **Unassigned**; when every selected ticket belongs to one project and the person has `assign` on them, also that project's assignable members (S1-01's `GET /projects/{projectId}/members?assignable=true`, as S1-10's assignee picker) ([Q13](#open-questions)).

**Result.** When every ticket was changed, a toast says "20 tickets updated" (PL „Zaktualizowano 20 zgłoszeń”, ICU plural). Otherwise a dialog (bottom sheet on phones) says "19 of 20 tickets updated" and lists each ticket that was not changed with its identifier, title and reason: "Changed by someone else – reload to see the latest version" (`412`), "You are not allowed to do this" (`403`), "No longer available" (`404`), "The project is archived" (`409 project.archived`), or the translated message of the rule's error code (a `422`, today only `ticket.assignee_not_eligible`; the dialog shows any other code a later rule adds in the same way). Tickets that were not changed stay selected, so **Reload and retry** refetches the list and repeats the action on them with their new versions. A selected ticket that is no longer in the refetched list (it no longer matches the filters or is invisible) leaves the selection and is not retried. The retry's own result names how many tickets left the selection. Tickets redirected to `waiting_for_requester` by resolution confirmation (S1-06) count as changed; the toast adds "3 are waiting for the requester's confirmation". Bulk changes have no **Undo** ([Q12](#open-questions)).

**Pending sharing approvals** ([Q11](#open-questions)): in this view each row (card) has **Approve sharing** and **Refuse sharing**, shown according to S1-11's `approve_sharing` / `reject_sharing` in `allowedActions`. **Approve sharing** opens S1-11's confirmation dialog (`ShareDialog` with `approve`) and **Refuse sharing** its dialog for the required reason (`RefuseSharingDialog`), both from `sharing-dialogs.tsx` through their lazy wrappers. The dialogs take the ticket's `TicketVersion` (ID, identifier, version), which a list item has, instead of the full `Ticket`. The list does not show the description, so in this view the approval dialog also links to the ticket view (`/tickets/{identifier}`). From there the team can check the description and attachments, as the reminder of [§5.2](../../docs/spec/05-visibility-and-search.md) asks, and redact them if needed. Their errors (`409 ticket.sharing_not_pending`, `ticket.organization_changed`) are shown as on the ticket view. After either action the ticket leaves the view with a toast; approval has no undo, because it is a public event ([§5.2](../../docs/spec/05-visibility-and-search.md)).

### Predefined views

Predefined views are constants of the web application, not records ([Q4](#open-questions)). Each has a code, catalogue labels and a filter set; "me" is resolved by the API ([Filters](#filters)). Open means the six non-terminal statuses ([§4.1](../../docs/spec/04-ticket-lifecycle.md), `TERMINAL_TICKET_STATUSES` and `isTerminalStatus()` of `@trybun/contracts/tickets`).

| Code | EN / PL label | Filter | Default sort |
|---|---|---|---|
| `my_open_tickets` | My open tickets / Moje otwarte zgłoszenia | `assignee=me`, status open | priority ([Q20](#open-questions)) |
| `triage` | Triage / Triage | status `new`, `triage` | created, oldest first |
| `critical` | Critical / Krytyczne | priority `critical`, status open | updated |
| `unassigned` | Unassigned / Nieprzypisane | `assignee=none`, status open | priority |
| `pending_sharing_approvals` | Pending sharing approvals / Oczekujące udostępnienia | `sharingRequest=pending`, any status | created, oldest first |

The URL holds `?view=<code>` while the view's filters are unchanged; changing a filter replaces `view` with the explicit filter parameters. A custom filter with no value left (after **Clear filters** or removing the last chip) is written as `?view=custom` and lists every ticket the person can see (approved by the maintainer, 2026-11-09, as Linear and GitHub Projects keep an unsaved filter apart from the default view). Otherwise it would be `/tickets` without parameters, which opens the default view, and a reload would lose it. The sort is its own parameter: it is written to the URL only when it differs from the view's default sort, and changing it does not leave the view. "Unassigned" lists tickets whose assignee was deactivated or removed from the project because S1-05's job sets their assignee to `null` ([§7.4](../../docs/spec/07-users-organizations-permissions.md), [Q16](#open-questions)).

### Filters

All filter values are identifiers or enum codes, so they may live in the URL ([§18.5](../../docs/spec/18-code-patterns.md) "State"). Every filter is multi-valued; values of one filter are combined with OR, filters with AND.

| Filter | Parameter | Values | Options in the UI |
|---|---|---|---|
| Project | `projectId` | project IDs | The person's projects (S1-01 `GET /projects`, active and archived) |
| Organization | `organizationId` | organization IDs, `none` | Organizations with access to one of the person's projects ([Q6](#open-questions)); hidden while no organization exists |
| Type | `type` | `bug`, `feature`, `task`, `question`, `none` (not set yet; `type` is nullable, S1-05 Q3) | All |
| Status | `status` | the nine internal statuses | Grouped like S1-10's status select, with a shortcut **Open** that selects the six non-terminal statuses |
| Priority | `priority` | the four priorities | All |
| Assignee | `assigneeId` | user IDs, `me`, `none` | **Me**, **Unassigned**, and the members of the projects chosen in the project filter ([Q7](#open-questions)) |
| Source | `source` | `user`, `developer`, `integration` | `integration` only once a ticket has it (Stage 6); until then the two others |
| Sharing request | `sharingRequest` | `pending`, `rejected` (S1-11; `none` is not a filter value) | Pending, Refused |

A filter value of a record the person cannot see (e.g. a project they left, in a shared link) matches no ticket, never widens the list and never fails the request; its chip shows "Unknown" („Nieznany”) and can be removed. Other values of the same filter still match ([Q5](#open-questions)).

### API

**`GET /api/v1/tickets`** (S1-05, extended; `projectId`, `identifier` and `involvement` keep their meaning and order): the filter parameters above (repeated parameters for several values, e.g. `status=new&status=triage`), `sort` (`priority`, `status`, `identifier`, `createdAt`, `updatedAt`), `order` (`asc`, `desc`; default `desc`, only together with `sort`), and the cursor envelope (`cursor`, `limit` 1–100, default 50) ([§18.4](../../docs/spec/18-code-patterns.md)). The query schema `listTicketsQuerySchema` lives in `@trybun/contracts/tickets`; the web application's URL schema reuses its filter part.

- Visibility first: the query adds `accessibleBy(ability, 'read')`, so the list never returns a ticket whose detail returns `404` ([§18.3](../../docs/spec/18-code-patterns.md)); filters only narrow it. `assigneeId=me` is the principal; `none` is `IS NULL`. An unknown or invisible ID matches nothing (see [Filters](#filters)); a malformed one is `422`.
- Team only: the new filter and sort parameters are part of a team query schema; today one `listTicketsQuerySchema` serves both kinds of account. For an end user the endpoint keeps S1-05's parameters (`projectId`, `identifier`, `involvement`), and any other parameter is `422 field.unrecognized`, so an end user can never filter their visible tickets by assignee, organization, source or sharing request and learn a value their response hides ([Q21](#open-questions)).
- Order: the chosen key, then `updatedAt` descending, then `id`, so pages are stable. Without `sort` the existing orders stay (by number with `projectId`, the portal order with `involvement`, creation otherwise), so the portal and the identifier lookup do not change; the list always sends `sort`, and its default is `priority` descending ([Q8](#open-questions)), the order of the Kanban cards ([§8.2](../../docs/spec/08-team-views.md)). Priority and status sort by the declaration order of their PostgreSQL enums (`low` → `critical`, the order of [§4.1](../../docs/spec/04-ticket-lifecycle.md)); `identifier` sorts by project key, then number.
- Items use a list schema `ticketListItemSchema` without `description` ([Q10](#open-questions)), for both kinds of account, as `ticketResponseSchema` does today: the union of the team ticket (`ticketSchema`) and the end-user ticket (`endUserTicketSchema`), each without `description`. Both keep `sharingRequest`, `descriptionEditedAt` and `allowedActions`. `ticketPageSchema` becomes a page of list items, so the portal's "My tickets" (`involvement=mine`, S1-09) keeps receiving the end-user shape. The identifier lookup `ticketQueryOptions` takes the full ticket from the list today. The team ticket view (S1-10) and the portal's ticket view and resolution-confirmation page (S1-09, all through `getTicketPage`) share it. After the change it resolves the identifier through the list and then reads the detail with `GET /tickets/{ticketId}`, because `getTicketPage` needs `description` for the images it references.
- Indexes for the default sort and the predefined views (migration `add_ticket_list_indexes`; `created_at, id`, `assignee_id`, `organization_id` and `requester_id` exist), checked with `EXPLAIN` on a demo dataset of 10,000 tickets.

**`POST /api/v1/tickets/bulk-changes`** ([Q1](#open-questions), [Q2](#open-questions), [Q3](#open-questions)):

```json
{
  "tickets": [{ "id": "0192…", "version": 7 }],
  "change": { "field": "status", "status": "rejected", "rejectionReason": "Out of scope" }
}
```

- `tickets`: 1–100 items, unique IDs (a repeated ID → `422` with `field.invalid` at its pointer; more than 100 → `array.too_long`).
- `change`: a discriminated union on `field` – `status` (S1-06's `changeTicketStatusSchema` without the `duplicate` member), `priority`, `assignee` (`assigneeId`, UUID or `null`). One field per request.
- Processing: in request order, one at a time, each ticket in its own transaction through the **same service method** as the single change – `TicketsService.update` for priority and assignee, `TicketsService.changeStatus` for the status – with the version from the body as the expected version (`VersionedTarget`, in place of `If-Match`, [§17.2](../../docs/spec/17-conventions.md) "Concurrency"). Before it, `RecordAccess.decide` – the check of `TargetRecordGuard` – with the action of the single change (`update` or `change_status`) decides `404` (invisible), `403` (action not permitted) or the code of a denying state rule (`409 project.archived`), in the order of [§17.2](../../docs/spec/17-conventions.md) "Errors". Every changed ticket writes its own activity events and outbox events, and a rejection its own public comment (S1-12), as a single change does.
- Response `200` with `{ results: [...] }` in request order: `{ id, status: 200, ticket }` (the changed list item, including the actual status after a redirect) or `{ id, status, code }` with `403`, `404`, `409`, `412` or `422` and the error code of the contracts (`@trybun/contracts/errors`). An unexpected error of one ticket is logged with the request ID and reported as `{ id, status: 500, code: "server.internal_error" }`; the others are still processed. The whole request fails only for request-level errors (`401`, `413`, `422` of the body, `429`).
- No `Idempotency-Key` ([§12.1](../../docs/spec/12-api-webhooks-import.md) asks for it when creating resources): nothing is created, and a repeated request reports `412` for the tickets the first one changed.
- Duration: 100 sequential single-ticket transactions; phase 3 measures the time on the demo dataset, and if it comes near the request timeout, Q2's alternative of a Worker job with a result resource is reconsidered before release.
- Route order: the static `bulk-changes` route is registered before `/{ticketId}`. Logs carry only the count and the per-status totals, never ticket content ([§17.2](../../docs/spec/17-conventions.md)).

**Organizations for the filter** ([Q6](#open-questions)): `GET /api/v1/organizations` returns to a team member, as `{ id, name }` only, the organizations with access to at least one of their projects (a new `read_name` rule in `organizations.abilities.ts`, which today grants organizations to the Administrator only); the Administrator keeps the full response of S1-02. `currentUserSchema` of `GET /api/v1/users/me` gains `organizationsExist` for team accounts, as S1-02 (its Q8) leaves to the first task that hides an organization element; no such signal exists yet, and [§7.3](../../docs/spec/07-users-organizations-permissions.md) hides the organization filter while no organization exists.

No new error codes: the bulk results reuse the codes of S1-01, S1-05, S1-06 and §17.2.

### Web application

`features/tickets/` (S1-05 and S1-10's feature, [§18.5](../../docs/spec/18-code-patterns.md)); **Tickets** joins `NAVIGATION_ITEMS` of `features/app-shell/navigation.ts`:

- `app/(team)/tickets/page.tsx` (next to the existing `[identifier]`, `new` and `layout.tsx`): parses the search parameters with the feature's schema, prefetches the first page and the account, composes `TicketList`.
- `search-params.ts`: `ticketListSearchParamsSchema` – `view` (a predefined view's code or `custom`), the filters (from `listTicketsQuerySchema`), `sort`, `order`. S1-14's board reuses the filter part, so switching between list and board keeps the filters ([§8](../../docs/spec/08-team-views.md)).
- `predefined-views.ts`: the table of [Predefined views](#predefined-views) and `filtersOfView()` / `viewOfFilters()` as pure functions with table tests.
- `queries.ts`: `ticketListInfiniteQueryOptions(client, filters, sort)` with key `['tickets', 'list', { filters, sort }]` (`infiniteQueryOptions`, [§18.5](../../docs/spec/18-code-patterns.md)); `organizationFilterOptionsQueryOptions`.
- `mutations.ts`: `useBulkChangeTickets()` – sends the versions of the query data in the body (the bulk form of `If-Match`, [§17.2](../../docs/spec/17-conventions.md)), invalidates `['tickets', 'list']` and the `detail` keys of the changed tickets, which S1-10 keys by identifier (`['tickets', 'detail', identifier]`).
- `components/`: `ticket-list.tsx` (client: selection context, bar, both renderings), `ticket-table.tsx` (TanStack Table 9 `useTable`; row and cell components read state through `Subscribe`, [§18.5](../../docs/spec/18-code-patterns.md)), `ticket-card-list.tsx`, `ticket-filter-bar.tsx`, `lazy-ticket-filter-panel.tsx`, `ticket-bulk-action-bar.tsx`, `lazy-bulk-change-result-dialog.tsx`, `lazy-bulk-reject-dialog.tsx` (S1-10's `RejectDialog` changes one ticket itself; the bulk dialog only collects the reason, with the same field and limits), `ticket-selection-context.tsx` (the selection is UI state of a subtree, [§18.5](../../docs/spec/18-code-patterns.md) "State").
- **Table and cards**: both are rendered from the same `useTable` instance (the cards iterate its row model) and share one selection state, so they never diverge; CSS shows the cards below `md` and the table from `md` ([Q14](#open-questions)). The server cannot know the viewport, so the HTML is right on the first paint without a layout shift; the hidden rendering is `display: none` and leaves the accessibility tree.

`@trybun/ui` gains, from shadcn/ui and adapted under Rule 6 with stories for all states and the three viewports: `Table` (compound `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableCell`, …). `Checkbox`, `Drawer`, `Popover`, `Select` and `Tabs` exist already. The TanStack wiring stays in the feature, because components of `@trybun/ui` are presentational ([§18.6](../../docs/spec/18-code-patterns.md)). `@tanstack/react-table` 9 is added to `apps/web` as a stable version after the 7-day cooldown (Rule 10).

Texts in the `tickets` namespace, EN and PL. User documentation (Rule 3): a team reference page "Ticket list" (views, filters, sorting, bulk actions and their results) with `views: ['/tickets']`, and a how-to "Change many tickets at once"; `pnpm help:generate`. No product tour: [§2.4](../../docs/spec/02-agent-rules.md) lists none for the list (Rule 4).

### Prior art

- **GitHub Projects (table layout)** and **Linear**: views are saved filter sets; editing a filter marks the view as modified until it is saved. Without user-defined views in Stage 1, this proposal drops the view marker instead ([Q4](#open-questions)).
- **Jira bulk change** runs as a background task with a per-issue report; **GitHub** applies bulk edits per issue and reports failures. With 100 tickets as the limit, this proposal processes them synchronously and reports per ticket, as [§17.2](../../docs/spec/17-conventions.md) requires.
- **Zendesk** and **Jira** show lists as tables on desktop and as cards in their mobile apps; the cards here follow [§2.9](../../docs/spec/02-agent-rules.md).
- **shadcn/ui Data Table** is a recipe on TanStack Table, not a component; this proposal follows it: presentational `Table` in the library, table logic in the feature.

## Changes to the system specification

| Section | Change |
|---|---|
| §8.1 | Predefined views are system constants with codes and default sorts, and "My open tickets" is the default of the list (Q4, Q9, Q20); filter values of invisible records match nothing (Q5); the new filters are team-only (Q21); the Stage 1 filter set adds the sharing request (Q5); bulk results also name archived projects and rule errors, unchanged tickets stay selected, and bulk changes have no undo (Q1, Q12); the bulk assignee picker (Q13); approving and refusing from "Pending sharing approvals" (Q11) |
| §17.2 Concurrency | Bulk actions: the response lists per record its status and error code – `200`, `403`, `404`, `409`, `412`, `422` (and `500` for an unexpected error of one record) – instead of `200`, `404`, `412` only (Q1) |
| §7.5 | Team members read the names of organizations with access to one of their projects (Q6) |
| §18.9 | New reference implementation row: "Data table with cards on phones" → `packages/ui/src/components/table.tsx`, `apps/web/src/features/tickets/components/ticket-table.tsx`, `ticket-card-list.tsx`; S1-13 (Q15) |
| Glossary | "Predefined view" becomes a filter set shipped as a constant of the system instead of a stored saved view (Q4), with the codes of the predefined views (below); new term "Bulk action" |
| Contracts of S1-05 (implemented) | `GET /tickets` returns `ticketListItemSchema` items (team and end-user shapes) without `description`; the identifier lookup shared by S1-09 and S1-10 reads the detail by ID (Q10) |
| Contracts and abilities of S1-02 (implemented) | Team read rule for organization names; `organizationsExist` in `currentUserSchema` (Q6) |

New or changed glossary terms (code identifier, EN/PL labels):

- Predefined view: a filter set with a default sort, shipped as a constant of the system and selected with `?view=<code>`; not a stored `saved_view` (Q4). Codes: `my_open_tickets` – My open tickets / Moje otwarte zgłoszenia; `triage` – Triage / Triage; `critical` – Critical / Krytyczne; `unassigned` – Unassigned / Nieprzypisane; `pending_sharing_approvals` – Pending sharing approvals / Oczekujące udostępnienia.
- Bulk action – Bulk action / Akcja zbiorcza: one change applied to up to 100 selected tickets, each ticket changed separately ([§8.1](../../docs/spec/08-team-views.md)).

## Open questions

Implementation must not start until every question has an answer. The maintainer approved every answer explicitly on 2026-11-09, each as the option that follows the established conventions of comparable products and the project's rules. Q1 and Q6 change a shared contract or a permission rule (§17.2, §7.5), and Q10 removes a field from an implemented response.

1. **Per-item results of a bulk action.** [§17.2](../../docs/spec/17-conventions.md) lists `200`, `404` and `412` per record, while [§8.1](../../docs/spec/08-team-views.md) also reports tickets that were "not permitted", and the single-change rules of S1-01, S1-05 and S1-06 can also answer `409 project.archived` and `422` rule codes. — **Answer (approved by the maintainer, 2026-11-09):** each result carries the HTTP status and the error code a single change would return (`200`, `403`, `404`, `409`, `412`, `422`; `500` for an unexpected error of that record), and §17.2 is changed accordingly. The order of checks stays that of a single change, so an invisible ticket is always `404`.
2. **Shape of the bulk endpoint.** — **Answer (approved by the maintainer, 2026-11-09):** `POST /api/v1/tickets/bulk-changes` with `{ tickets: [{ id, version }], change }`, one field per request, processed sequentially through the single-change service methods, `200` with results in request order, no `Idempotency-Key`. The path follows [§17.1](../../docs/spec/17-conventions.md) (plural nouns, actions as sub-resources). Alternatives: `PATCH /api/v1/tickets` with a list (collides with the separate status endpoint of S1-06), or `207 Multi-Status` (a WebDAV status that clients rarely handle).
3. **Bulk actions in Stage 1.** [§8.1](../../docs/spec/08-team-views.md) names status, priority, assignee, milestone and labels. — **Answer (approved by the maintainer, 2026-11-09):** status, priority and assignee; milestone comes with S4-01 and labels with S2-09, each adding a `field` to the union.
4. **Predefined views before user-defined views.** The glossary calls a predefined view a "saved view shipped with the system", but the `saved_view` model comes with S2-10. — **Answer (approved by the maintainer, 2026-11-09):** predefined views are constants of the web application, selected by `?view=<code>`; no table and no API in S1-13. Changing a filter leaves the view (no "modified" state, because nothing can be saved yet). S2-10 adds stored views next to them.
5. **Filter set in Stage 1.** [§8.1](../../docs/spec/08-team-views.md) says "any ticket field" and lists project, organization, type, status, priority, assignee, source, labels, milestone and SLA state. — **Answer (approved by the maintainer, 2026-11-09):** the listed fields that exist in Stage 1, plus the sharing request that "Pending sharing approvals" needs. Visibility, requester, dates and title text are not filters yet (title text comes with S2-04); each can be added later as one more parameter.
6. **Organization filter for the team.** S1-02 ([#112](https://github.com/trybun/trybun/pull/112)) made organizations readable only by the Administrator (`organizations.abilities.ts`), and its Q8 leaves the "organizations exist" signal to the first task that hides an element. — **Answer (approved by the maintainer, 2026-11-09):** a team member may read `{ id, name }` of the organizations with access to one of their projects – names they already see in ticket snapshots (S1-05); `GET /api/v1/users/me` gains `organizationsExist` for team accounts, as S1-02 proposes (no task has added it yet). This widens a read rule of [§7.5](../../docs/spec/07-users-organizations-permissions.md). Alternative: organization filter options built only from the organizations of the loaded tickets – no rule change, but the options would depend on the page loaded and miss organizations whose tickets are further down, so it is not proposed although it is smaller.
7. **Assignee filter options across projects.** — **Answer (approved by the maintainer, 2026-11-09):** **Me** and **Unassigned** always; people only from the members of the projects chosen in the project filter (S1-01's members list, without `assignable`, so former assignees can still be found). No new directory endpoint.
8. **Sorting.** — **Answer (approved by the maintainer, 2026-11-09):** sortable by priority, status, identifier, created and updated; default priority descending, then last update, as the Kanban cards ([§8.2](../../docs/spec/08-team-views.md)); status sorts in the order of the table of [§4.1](../../docs/spec/04-ticket-lifecycle.md) (`new` first); title and assignee are not sortable (collation and a join for little value).
9. **Default view.** — **Answer (approved by the maintainer, 2026-11-09):** `/tickets` without parameters opens "My open tickets" (Linear's "My issues"); the navigation item links to it.
10. **List item shape.** S1-05 returns full tickets from `GET /tickets`, including the description of up to 65,536 characters, and S1-10's identifier lookup takes the full ticket from that list. — **Answer (approved by the maintainer, 2026-11-09):** a `ticketListItemSchema` without `description`; S1-10's identifier lookup then reads the detail with `GET /tickets/{ticketId}`. This removes a field from an implemented response, which [`BACKWARD_COMPATIBILITY.md`](../../BACKWARD_COMPATIBILITY.md) allows without a new API version while only the web application of the same release calls the API (no API tokens yet), so it is cheapest now. Alternative: keep `description` in list items – no change to S1-05 or S1-10, but up to 50 × 64 KB per page.
11. **Approving and refusing from the view.** The Stage 1 exit criterion says sharing requests are approved or refused "from the 'Pending sharing approvals' view", and S1-11 leaves the view to S1-13. — **Answer (approved by the maintainer, 2026-11-09):** row actions **Approve sharing** and **Refuse sharing** with S1-11's dialogs (`ShareDialog` with `approve`, `RefuseSharingDialog`) and API, shown by `allowedActions`; no bulk approval, because each ticket may need redaction before sharing ([§5.2](../../docs/spec/05-visibility-and-search.md)).
12. **Undo of bulk changes.** [§18.5](../../docs/spec/18-code-patterns.md) shows **Undo** for reversible actions. — **Answer (approved by the maintainer, 2026-11-09):** no undo for bulk changes in S1-13: the inverse differs per ticket (each had its own previous value) and would itself need per-ticket results; the result dialog lists what changed. Alternative: an undo that sends one bulk request per previous value.
13. **Bulk assignee across projects.** An assignee must be eligible in the ticket's project (S1-05 Q9). — **Answer (approved by the maintainer, 2026-11-09):** **Assign to me** and **Unassigned** always; other people only when all selected tickets are in one project; tickets where the person is not eligible come back as `422 ticket.assignee_not_eligible`.
14. **Cards or table.** — **Answer (approved by the maintainer, 2026-11-09):** both renderings from the same data, switched by CSS at `md`, so the server-rendered HTML is right for every device; checkboxes always visible on cards (no long press, Rule 9).
15. **Reference implementation.** [§18.5](../../docs/spec/18-code-patterns.md) prescribes TanStack Table 9, but [§18.9](../../docs/spec/18-code-patterns.md) names no reference for data tables. — **Answer (approved by the maintainer, 2026-11-09):** S1-13 is the reference for "Data table with cards on phones": `Table` and `Checkbox` in `@trybun/ui`, the table logic in the feature. No new pattern.
16. **"Unassigned" and deactivated assignees.** — **Answer (approved by the maintainer, 2026-11-09):** the view filters `assignee IS NULL` and relies on S1-05's unassignment job, which runs seconds after the deactivation or removal; the list does not re-check eligibility at read time.
17. **Selection lifetime and what counts as changed.** — **Answer (approved by the maintainer, 2026-11-09):** the selection spans the loaded pages (the header checkbox selects the loaded tickets only), is capped at 100 and is cleared when the view, filters or sort change; tickets that were not changed stay selected after a bulk action. A ticket that resolution confirmation redirected to `waiting_for_requester` (S1-06) counts as changed, and the toast says how many were redirected.
18. **One task or several.** The plan row bundles the list, filters, views and bulk actions. — **Answer (approved by the maintainer, 2026-11-09):** one task and one implementation PR built in the phases below, each leaving the application working; the "Done when" needs all of them. Alternative: bulk actions as a separate PR (phase 3).
19. **Paging in the UI.** — **Answer (approved by the maintainer, 2026-11-09):** 50 tickets per page with a **Show more** button (keyboard and screen-reader friendly, as S1-10's timeline), no infinite scroll.
20. **Default sort of each view.** [§8.1](../../docs/spec/08-team-views.md) defines the filters of the views but not their order, and the triage queue orders by the nearest SLA deadline, then the oldest ([§8.3](../../docs/spec/08-team-views.md)). — **Answer (approved by the maintainer, 2026-11-09):** "My open tickets" and "Unassigned" by priority; "Triage" and "Pending sharing approvals" oldest first (the queue's order without SLA, which comes in Stage 4); "Critical" by last update. S4-06 may switch "Triage" to the SLA deadline.
21. **New filters for end users.** S1-05's `GET /tickets` also serves end users, whose responses hide the assignee, source and organization. — **Answer (approved by the maintainer, 2026-11-09):** the new filter and sort parameters are accepted only for team principals; an end user sending them gets `422 field.unrecognized`. The portal (S1-09) adds its own parameters when it needs them.

## Implementation plan

Each step leaves the application working and has its tests.

**Phase 1 – List API and the table**

1. `listTicketsQuerySchema`, `ticketListItemSchema` (team and end-user shapes) in `@trybun/contracts/tickets`; filters and sorting in the list query of `TicketsService`; migration `add_ticket_list_indexes`. In the same step, `ticketQueryOptions` reads the detail by ID after the identifier lookup, so the team and portal ticket pages keep their description. Then `pnpm api:generate`. Integration tests: every filter and sort key, `me`/`none`, stable pages across equal sort values, invisible IDs match nothing, an end user sending a team filter gets `422`, **the list never returns a ticket whose detail returns 404** for every principal of the demo dataset.
2. `Table` in `@trybun/ui` with stories (all states, three viewports, target sizes); `@tanstack/react-table` 9.
3. `/tickets` route, navigation item, `ticket-table.tsx`, `ticket-card-list.tsx`, **Show more**, empty states; help page "Ticket list" (EN, PL), `pnpm help:generate`. E2E on the three devices with axe: **on a phone the list renders as cards**, on desktop as a table.

**Phase 2 – Filters and predefined views**

4. `search-params.ts`, `predefined-views.ts` with table tests; filter bar, filter panel (popover and bottom sheet), chips, sort; view picker. Organization read rule and `organizationsExist` (Q6) with allowed and denied tests. E2E: a filter survives a reload; choosing a view sets its filters; changing a filter unmarks the view.
5. Demo dataset additions and E2E: **a ticket whose assignee was deactivated is listed in "Unassigned"** (after S1-05's job); **a pending sharing request is listed in "Pending sharing approvals"**; approving and refusing from the view.

**Phase 3 – Bulk actions**

6. `POST /tickets/bulk-changes` with its schemas; `pnpm api:generate`. Integration tests: **a bulk update of 20 tickets with one stale version reports 19 successes and 1 conflict**; an invisible ticket is `404` whatever its version; a Developer assigning someone else gets `403` for that ticket only; an archived project's ticket `409 project.archived`; `rejected` uses one reason for all; `duplicate` is rejected by the schema; a redirect to `waiting_for_requester` returns the actual status; 101 tickets and repeated IDs are `422`; each changed ticket has its own activity event.
7. Bulk action bar, status/priority/assignee menus, reason dialog, result toast and dialog, retry of unchanged tickets; how-to "Change many tickets at once" (EN, PL). E2E on three devices: a bulk change with one ticket changed by someone else lists it as a conflict and keeps it selected.
8. Update §7.5, §8.1, §17.2, §18.9 and the glossary as approved; mark S1-13 `[x]` in `docs/plan/implementation-plan.md`; move this file to `implemented/`.

## Acceptance criteria

- [ ] A bulk update of 20 tickets with one stale version reports 19 successes and 1 conflict, and the UI lists the conflicting ticket
- [ ] Every per-ticket result carries the status and error code a single change would return; an invisible ticket is `404` whatever its version
- [ ] A pending sharing request is listed in "Pending sharing approvals" and can be approved or refused from there
- [ ] A ticket whose assignee was deactivated is listed in "Unassigned"
- [ ] The list never returns a ticket whose detail returns `404`; filters and sorting give stable cursor pages
- [ ] Filters, sort and view are kept in the URL and survive a reload, including a custom filter with every filter removed (`?view=custom`); a link with an unknown ID still opens
- [ ] List items carry no `description` for team members and end users; the team and portal ticket pages still show the description
- [ ] An end user sending a team filter or sort parameter gets `422 field.unrecognized`
- [ ] A team member reads only `{ id, name }` of the organizations with access to one of their projects; `organizationsExist` hides the organization filter while no organization exists
- [ ] Bulk actions accept at most 100 tickets; `duplicate` is never offered; `rejected` asks for one reason
- [ ] Works on phone, tablet and desktop (Rule 9): on a phone the list renders as cards with 44 px targets; the bulk bar respects the safe area; E2E with axe on the three devices
- [ ] User documentation updated (Rule 3): reference "Ticket list" and how-to "Change many tickets at once" in EN and PL; no product tour (Rule 4, §2.4)

## Changelog

- 2026-10-26 – Created.
- 2026-11-09 – Aligned with the implemented S1-01 to S1-12: the existing list parameters and orders, the team-only query schema, `TERMINAL_TICKET_STATUSES`, the sharing request states and dialogs, rejection reasons as public comments, the existing `Checkbox`, the identifier-keyed detail cache, and the missing `organizationsExist`.
- 2026-11-09 – Approved by the maintainer: every answer to Q1–Q21, including Q1 (per-ticket results with the codes of a single change), Q6 (team read rule for organization names and `organizationsExist`) and Q10 (list items without `description`).
- 2026-11-09 – Specification review (`om-auto-review-pr`): list items cover the end-user shape too, and the identifier lookup that S1-09 and S1-10 share reads the detail in the same step; reachable error codes of the bulk results; `?view=custom` for an empty custom filter; the approval dialog links to the ticket view and takes a `TicketVersion`; retry of tickets that left the list; default `order`; glossary definition of a predefined view; acceptance criteria for Q6, Q10 and Q21. No approved answer changed.
- 2026-11-09 – Approved by the maintainer: `?view=custom` for a custom filter with every filter removed.
