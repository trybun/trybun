# 08 – Team views

Ways of working with tickets, modelled on GitHub Projects and Jira. All views work on phones and tablets according to Rule 9 ([§2.9](02-agent-rules.md)). Available to Developer and above. Switching between the list and the Kanban board keeps the active filters.

Filters, columns, badges and views that depend on features of later stages of the implementation plan (labels, milestones, SLA, occurrence count, relations) are added by the task that introduces the feature.

## 8.1 List

- Filtering by any ticket field (project, organization, type, status, priority, assignee, source, labels, milestone, SLA state).
- Sorting by columns (including SLA deadline, [§9.5](09-sla.md), and occurrence count, [§12.3](12-api-webhooks-import.md)).
- **Saved views**: stored filter sets. Users can create their own. Predefined views cover all projects of the user:

| View | Filter |
|---|---|
| "My open tickets" | assignee = me, status not terminal |
| "Triage" | status `new` or `triage` |
| "Critical" | priority `critical`, status not terminal |
| "Unassigned" | no assignee, status not terminal (includes tickets whose assignee was deactivated or removed from the project, [§7.4](07-users-organizations-permissions.md)) |
| "Pending sharing approvals" | sharing requested and not yet decided ([§5.2](05-visibility-and-search.md)) |
| "SLA at risk" | SLA state `at_risk` or `breached` ([§9.5](09-sla.md)) |

- **Bulk actions** on selected tickets (status, priority, assignee, milestone, labels), within the user's permissions:
  - every ticket is processed separately; the result lists, per ticket, whether it was changed, changed by someone else in the meantime (conflict, [§17.2](17-conventions.md)) or not permitted, and the UI shows the tickets that were not changed;
  - at most 100 tickets per bulk action;
  - bulk change to `rejected` asks for one reason, used for all selected tickets ([§4.3](04-ticket-lifecycle.md));
  - bulk change to `duplicate` is not offered, because each ticket needs its own original.
- Tickets with an open "blocked by" relation are marked ([§3.5](03-ticket-model.md)).

## 8.2 Kanban board

- The board shows **one project** at a time; the project filter is required.
- Columns correspond to the main-flow statuses: `new`, `triage`, `todo`, `in_progress`, `in_verification`, `done` ([§4.1](04-ticket-lifecycle.md)).
- `waiting_for_requester` has its own column, so blocked tickets stay visible.
- The `done` column shows only tickets that reached `done` within the last **14 days**, so the board does not grow forever.
- `rejected` and `duplicate` have no columns. They are set from the card menu, because they require a reason or a link ([§4.3](04-ticket-lifecycle.md)).
- Status is changed by dragging the card, respecting permissions ([§7.5](07-users-organizations-permissions.md)). Every drag action also has a keyboard/menu alternative ([§13.4](13-non-functional.md)).
- If the project uses resolution confirmation ([§4.3](04-ticket-lifecycle.md)), dropping a card from an end user onto `done` places it in the `waiting_for_requester` column and shows a toast explaining that the requester is asked to confirm.
- Cards within a column are sorted by priority (`critical` first), then by the last update (most recent first). There is no manual ordering of cards.
- Cards show: identifier, title, assignee, priority, SLA state badge ([§9.5](09-sla.md)) and a "blocked" marker.
- Optional work-in-progress (WIP) limits, set per project and status by the Project manager, e.g. for `in_progress`. Exceeding a limit is signalled visually but never blocks moving a card.

## 8.3 Triage queue

A view for the Project manager to process new tickets from end users and integrations.

- Contains tickets in status `new` or `triage` ([§4.1](04-ticket-lifecycle.md)).
- Tickets are shown one at a time, ordered by the nearest SLA deadline ([§9.5](09-sla.md)); tickets without SLA are ordered from the oldest.
- Type, priority and assignee can be completed without leaving the view.
- Quick actions: accept (→ `todo`), ask for information (→ `waiting_for_requester`, with a public comment), mark as duplicate, reject (with a reason).
- Keyboard shortcuts for all actions and automatic move to the next ticket (Rule 2).
- Pending shared-ticket approvals ([§5.2](05-visibility-and-search.md)) are also shown in the queue. Developers, who may also approve sharing ([§7.5](07-users-organizations-permissions.md)), find them in the predefined view "Pending sharing approvals" ([§8.1](#81-list)).

## 8.4 Command palette

The command palette opens with **Ctrl+K** (Cmd+K on macOS) from anywhere in the application, except inside the GFM editor, where the shortcut inserts a link ([§6.2](06-comments-notifications.md)) (pattern: Linear, GitHub, VS Code). It also opens from the search field in the application header ([§8.5](#85-global-search)). Available to Developer and above.

| Function | Examples |
|---|---|
| **Search** | Typing a key (`ERP-123`) jumps straight to the ticket. Typing text searches titles and content of tickets in all of the user's projects |
| **Navigation** | Projects, saved views ([§8.1](#81-list)), milestones, Kanban board, roadmap, settings |
| **Actions** | On the current ticket: change status, assign to me, change priority, add label, add to milestone, create sub-ticket, copy branch name |

Rules:

- Fuzzy matching, tolerant of typos and skipped characters: commands, navigation targets and recent items are matched in the browser; ticket titles are matched on the server with trigram similarity (PostgreSQL `pg_trgm`) combined with the search of [§5.6](05-visibility-and-search.md).
- Results grouped by kind (tickets, projects, views, actions).
- When opened without input, the palette shows recently visited tickets and frequently used actions.
- Every action shows its keyboard shortcut, so the palette teaches shortcuts.
- The palette shows only actions the user is permitted to perform ([§7.5](07-users-organizations-permissions.md)); permissions are decided by the API ([§14.4](14-architecture.md)).
- Commands are shown in the user's UI language ([§13.1](13-non-functional.md)).
- The palette is fully accessible to screen readers (ARIA combobox pattern, [§13.4](13-non-functional.md)).

## 8.5 Global search

- The search field in the application header opens the command palette ([§8.4](#84-command-palette)) with the typed text.
- Pressing Enter on free text (or choosing "See all results", PL: „Zobacz wszystkie wyniki”) opens the **List** view ([§8.1](#81-list)) with the query and the full set of filters, so results can be narrowed, sorted and saved as a view. The query is kept in the page state, not in the URL query string ([§13.5](13-non-functional.md)).
- Uses the same search mechanism as [§5.6](05-visibility-and-search.md): full-text first, semantic later.
