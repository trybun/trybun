# 08 – Team views

Ways of working with tickets, modelled on GitHub Projects and Jira. All views work on phones and tablets according to Rule 9 ([§2.9](02-agent-rules.md)). Available to Developer and above. Switching between the list and the Kanban board keeps the active filters.

Filters, columns, badges and views that depend on features of later stages of the implementation plan (labels, milestones, SLA, occurrence count, relations) are added by the task that introduces the feature.

## 8.1 List

The list (`/tickets`, **Tickets** – PL: „Zgłoszenia” – in the main navigation) shows the tickets of all projects of the user. On tablets and desktops it is a table; on phones every ticket is a card with its identifier and type on one line (`ERP-12 · Bug`, the separator hidden from assistive technology), title, status, priority, assignee and a checkbox. Both are rendered from the same data and switched by CSS, so the server-rendered page is right on every device ([§2.9](02-agent-rules.md)). The table hides the type, project and organization columns on tablets, and the organization column while no organization exists ([§7.3](07-users-organizations-permissions.md)); on tablets the title cell shows the type below the title instead, so the type is shown on every device without widening the table. Where the columns would not fit otherwise – below 1024 px and, with all columns shown, from 1280 to 1535 px – the labels of the columns other than the checkbox, the identifier and the title, and the column headers, take at most a fixed width and wrap a longer word within the cell (hyphenated where the browser knows the page's language), as does the type below the title when the title column is at its narrowest; so the table fits in every language and no column or row action hides behind horizontal scrolling. A ticket without a type shows "Not set" (PL: „Nie ustawiono”). **Show more** at the end loads the next 50 tickets. List items carry no description; it is read with the ticket ([§8.6](#86-team-ticket-view)).

- Filtering by any ticket field (project, organization, type, status, priority, assignee, source, labels, milestone, SLA state). Stage 1 offers the fields that exist in it plus the sharing request ([§5.2](05-visibility-and-search.md)): values of one filter are combined with OR, filters with AND, and all of them are kept in the URL. A value of a record the user cannot see (e.g. a project they left, in a shared link) matches no ticket, never widens the list and never fails the request; its chip shows "Unknown" (PL: „Nieznany”). **Add filter** (PL: „Dodaj filtr”) lists the fields not yet active, and each field opens its own picker: a search input over a checkbox list with the chosen values pinned on top; each change applies at once and the picker stays open. From the tablet width on it is a popover, on phones one bottom sheet with the field list and the picker as two steps (back to the fields, **Done** only closes it). Projects, organizations and the members of the chosen projects are searched on the server (`query`, the first page of each state of a list, "Type to find more" when more exist), so every record the user can see can be chosen; the fixed fields filter their options in the browser. One filter takes at most 50 values (`MAX_TICKET_FILTER_VALUES`): once 50 are chosen, the picker disables the values not chosen and its status says "Up to 50 values per filter" (PL: „Do 50 wartości w jednym filtrze”), announced to screen readers; an address with more values keeps the first 50 of the filter and the list names it ("Project: only the first 50 values are used – a filter takes up to 50 values."). Each active filter is a chip with its first value and the count of the rest ("Project: QM150 +2"): the chip reopens its picker, its **×** removes the filter. Chips name the chosen records looked up by ID (`id` of `GET /projects` and `GET /organizations`, `userId` of `GET /project-members`, [§17.2](17-conventions.md)), so the chip of a visible record always shows its name, also beyond the first search page; while a lookup has not succeeded the chip shows only the count. The filters and the sort parameters of `GET /api/v1/tickets` are accepted for team accounts only; an end user sending them gets `422 field.unrecognized`, so the portal never filters by a value its response hides.
- Sorting by columns (including SLA deadline, [§9.5](09-sla.md), and occurrence count, [§12.3](12-api-webhooks-import.md)). Stage 1 sorts by priority, status, identifier, creation and last update, then by the last update and the ID, so pages are stable; priority and status sort in the order of [§4.1](04-ticket-lifecycle.md). Title and assignee are not sortable.
- **Saved views**: stored filter sets. Users can create their own. **Predefined views** are filter sets with a default sort, shipped as constants of the system and selected with `?view=<code>`; they cover all projects of the user, and `/tickets` without parameters opens "My open tickets". Changing a filter leaves the view ("Custom filter", PL: „Filtr niestandardowy”); a custom filter with every filter removed is kept as `?view=custom` and lists every ticket the user can see. The sort is kept in the URL only when it differs from the view's default and does not leave the view.

| View (code) | Filter | Default sort |
|---|---|---|
| "My open tickets" (`my_open_tickets`) | assignee = me, status not terminal | priority |
| "Triage" (`triage`) | status `new` or `triage` | created, oldest first |
| "Critical" (`critical`) | priority `critical`, status not terminal | last update |
| "Unassigned" (`unassigned`) | no assignee, status not terminal (includes tickets whose assignee was deactivated or removed from the project, [§7.4](07-users-organizations-permissions.md)) | priority |
| "Pending sharing approvals" (`pending_sharing_approvals`) | sharing requested and not yet decided ([§5.2](05-visibility-and-search.md)), any status | created, oldest first |
| "SLA at risk" | SLA state `at_risk` or `breached` ([§9.5](09-sla.md)) | – |

- In "Pending sharing approvals" every ticket offers **Approve sharing** and **Refuse sharing** (PL: „Zatwierdź udostępnienie”, „Odmów udostępnienia”) according to its `allowedActions`, with the confirmation and the reason dialog of the ticket view ([§5.2](05-visibility-and-search.md)). The confirmation links to the ticket, so its description and attachments can be checked and redacted first. There is no bulk approval, because each ticket may need redaction; after either decision the ticket leaves the view.
- **Bulk actions** on selected tickets (status, priority, assignee, milestone, labels), within the user's permissions; Stage 1 offers status, priority and assignee:
  - every ticket is processed separately, in its own transaction, through the same rules as a single change; the result lists, per ticket, whether it was changed, changed by someone else in the meantime (conflict, [§17.2](17-conventions.md)), not permitted, no longer visible, in an archived project or refused by a rule (e.g. an assignee who cannot be assigned in its project), and the UI shows the tickets that were not changed;
  - tickets that were not changed stay selected, and the UI offers to reload the list and repeat the change on them with their new versions; a selected ticket that is no longer in the list leaves the selection;
  - at most 100 tickets per bulk action; the selection spans the loaded pages and is cleared when the view, the filters or the sort change;
  - an action is offered when at least one selected ticket allows it; tickets that do not allow it are sent anyway and reported as not permitted;
  - bulk change to `rejected` asks for one reason, used for all selected tickets ([§4.3](04-ticket-lifecycle.md));
  - bulk change to `duplicate` is not offered, because each ticket needs its own original;
  - the assignee offers "Assign to me" and "Unassigned", and the assignable members of the project only when every selected ticket belongs to one project;
  - a ticket that resolution confirmation moves to `waiting_for_requester` ([§4.3](04-ticket-lifecycle.md)) counts as changed, and the result says how many did;
  - bulk changes have no **Undo**: each ticket had its own previous value.
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

## 8.6 Team ticket view

One ticket for the team, with every Stage 1 field of [§3.2](03-ticket-model.md#32-ticket-fields) that exists (pattern: the issue view of GitHub, the properties of Linear).

- **Routes** (route group `(team)`): `/tickets/{identifier}`, e.g. `/tickets/ERP-12`, resolved with `GET /api/v1/tickets?identifier=`, whose list item has no description, and then read with `GET /api/v1/tickets/{ticketId}` (the portal's ticket pages resolve their identifier the same way); a lower-case identifier redirects to the upper-case form, and a ticket the person cannot see shows the not-found page. The full form is `/tickets/new?projectId=…` ([§3.3](03-ticket-model.md#33-forms)), opened by **New ticket** (PL: „Nowe zgłoszenie”) in the header of the team application shell for every team account – an icon with that name on phones – and later by the views of a project's tickets with their project; it lists the projects that allow `create_ticket` and says so when there is none. A new ticket opens in the view with the toast "Ticket ERP-12 created". An end user who opens a team route is sent to its portal counterpart ([§5.7](05-visibility-and-search.md)), `/tickets/new` to `/portal`; a team member who opens a portal ticket lands in this view.
- **Layout** (Rule 9): the header with the identifier (copy button), the title and "{requester} opened {relative time}" with the source; the description, its attachments ([§13.3](13-non-functional.md)) and the activity timeline ([§4.5](04-ticket-lifecycle.md#45-activity-timeline)); the **field panel** in a second column from the `lg` breakpoint, below it the **Details** section between the header and the description, where each field opens a bottom sheet on phones.
- **Field panel**: status with its waiting reason ([§4.1](04-ticket-lifecycle.md#41-statuses)), assignee, type ("Not set" for an end-user ticket before triage), priority, project (read-only), requester, organization (only when the ticket has one) and the times of creation and of the latest change in the person's time zone. Each control follows the ticket's `allowedActions` – `update` (title, description), `update_fields` (type, priority), `assign` / `assign_self`, `change_status`, `add_attachment`, `add_comment`, `add_internal_note`, `redact_description`, `read_description_revisions` – and is plain text without its action; in an archived project the whole view is read-only with the archived notice.
- **Assignment** ([§7.5](07-users-organizations-permissions.md#75-permission-matrix)): with `assign` a picker searched on the server among the eligible members (`GET /projects/{projectId}/members?assignable=true&query=…`), with **Assign to me** first while the person is among them and **Unassigned** last; with only `assign_self` **Assign to me** (also taking over from someone else) or **Unassign me**, no picker.
- **Status**: a select of the nine internal statuses grouped by kind. `rejected` asks for the reason and `duplicate` for the original ticket of the same project in a dialog first ([§4.3](04-ticket-lifecycle.md#43-transition-rules)); a `done` that the project turns into a wait for the requester's confirmation says that the ticket closes automatically after 7 days.
- **Immediate saving with undo** (Rule 2, [§18.5](18-code-patterns.md#185-web-application)): type, priority and assignee save on selection, then a toast offers **Undo**, which sends the inverse change with the version the change returned. A change between non-terminal statuses has **Undo** too. There is none for a move into or out of a terminal status, a dialog-confirmed move, a redirected `done`, a move out of a wait for confirmation (its inverse would cancel the confirmation), a Developer's take-over (its inverse assigns another person) and a type set on a ticket without one (the type cannot be unset). An undo is a change of its own with its own event; refused (`412`, `403`, `422`) it shows the message, the ticket is read again, and it is never retried.
- **Title and description** save explicitly: the title in place with **Save** or Enter, cancelled with Escape; the description in the GFM editor with **Save** / **Cancel**. A `412` shows the standard conflict message ([§17.2](17-conventions.md)) and reads the ticket again while the typed text stays. Leaving the full form or an open description editor with unsaved text asks to discard it. A type change never touches the description ([§3.4](03-ticket-model.md#34-ticket-templates)).
- **Timeline and comments** ([§4.5](04-ticket-lifecycle.md#45-activity-timeline), [§6.1](06-comments-notifications.md#61-comments-and-internal-notes)): comments and events in one chronological timeline, read from the merged timeline of the API. At its end the comment form with the GFM editor, its attachments and `@` suggestions, shown with `add_comment`:
  - above it a two-option switch **Internal note** (PL: „Notatka wewnętrzna”), preselected on every new form, and **Public comment** (PL: „Komentarz publiczny”);
  - with **Public comment** chosen, a one-line hint built from the ticket's visibility says who will see it: "Visible to the requester" / "Visible to organization X" / "Visible to all customers of the project" (PL: „Widoczny dla zgłaszającego” / „Widoczny dla organizacji X” / „Widoczny dla wszystkich klientów projektu”); the submit button reads **Add internal note** (PL: „Dodaj notatkę wewnętrzną”) or **Comment publicly** (PL: „Skomentuj publicznie”), and is disabled while sending;
  - internal notes in the timeline and the form in internal mode have the warning tint of the theme (`bg-warning/10`, `border-warning/50`), a lock icon and the label "Internal note" – never colour alone ([§13.4](13-non-functional.md));
  - each comment has a "⋯" menu (44 px, no hover) following its `allowedActions`: **Edit** (inline editor), **Delete** (confirmation dialog, because the content cannot be restored) and **Redact**; the "edited" marker is a button that opens the history in a dialog (a bottom sheet on phones) with `read_revisions`, otherwise plain text; the redaction dialog prefills the editor with the current text and lists the earlier versions as checkboxes, all checked, with the warning that this cannot be undone.
- **Live updates** of other people's changes come with the real-time connection ([§14.4](14-architecture.md), plan task S1-15); until then the view reads the ticket again on focus and after the person's own changes.
