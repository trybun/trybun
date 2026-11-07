# Team ticket view and full ticket form

| | |
|---|---|
| Status | `draft` |
| Created | 2026-10-26 |
| Plan task | `S1-10` |
| System specification sections | §3.2, §3.3, §3.4, §4.1–§4.5, §7.1, §7.5, §13.1, §17.2, §18.5, §18.6, glossary |
| Related issues / PRs | Sibling specifications: [#111](https://github.com/trybun/trybun/pull/111) (S1-01 projects), [#113](https://github.com/trybun/trybun/pull/113) (S1-03 accounts and user settings), [#114](https://github.com/trybun/trybun/pull/114) (S1-04 permission layer), [#115](https://github.com/trybun/trybun/pull/115) (S1-05 ticket model), [#116](https://github.com/trybun/trybun/pull/116) (S1-06 statuses), [#117](https://github.com/trybun/trybun/pull/117) (S1-07 GFM editor); S1-08 attachments, S1-09 portal and S1-11 visibility (in progress) |

## Context

The team has no screen for a ticket yet. S1-05 ([#115](https://github.com/trybun/trybun/pull/115)) proposes the ticket API – creation, `PATCH` of title, description, type, priority and assignee with `If-Match`, the activity events and `allowedActions` – and states that the ticket forms and views are S1-09 and S1-10 (its Q12) and that S1-10 builds the assignee picker and "Assign to me" on top of the API rules (its Q10). S1-06 ([#116](https://github.com/trybun/trybun/pull/116)) proposes `PUT /tickets/{id}/status` and leaves the status control and the reason and original dialogs of the team ticket view to S1-10 (its Q14). S1-07 ([#117](https://github.com/trybun/trybun/pull/117)) proposes the `MarkdownEditor` that each form adds itself.

The plan's scope for S1-10: the team ticket view and the full form with all Stage 1 fields, type-dependent templates, assignment rules, internal statuses, and the full activity timeline with a "hide events" toggle. "Done when":

- changing the type with an unchanged description replaces the template; with an edited one it never does;
- a Developer can assign only themselves;
- the "hide events" setting persists per user.

This specification assumes the sibling proposals above as proposed there, and does not re-decide their questions. Where the system specification or the plan leaves a gap for S1-10, the gap is listed under [Open questions](#open-questions) with a proposed answer (Rule 8); the design below assumes those answers.

## Goals

- A team member creates a ticket in the full form with the defaults of [§3.3](../../docs/spec/03-ticket-model.md) – current project, type `task`, priority `normal` – and the description template of the chosen type ([§3.4](../../docs/spec/03-ticket-model.md)), in their language.
- Changing the type in the form replaces the description template (and the default priority) while the description is empty or unchanged, and never overwrites an edited description.
- The team ticket view shows every Stage 1 field of [§3.2](../../docs/spec/03-ticket-model.md) that exists by then and lets a team member change title, description, type, priority, assignee and the internal status, each only as `allowedActions` permits ([§18.5](../../docs/spec/18-code-patterns.md)).
- A Developer can assign only themselves (take over or unassign themselves); a Project manager and the Administrator can assign any eligible team member ([§7.5](../../docs/spec/07-users-organizations-permissions.md)).
- The full activity timeline of [§4.5](../../docs/spec/04-ticket-lifecycle.md) with a "Hide events" toggle remembered per user on the server, so it follows the person to every device.
- Works on phones, tablets and desktops (Rule 9); help pages for both views (Rule 3).

## Non-goals

- The API rules behind the view: ticket creation and changes, assignee eligibility and the Developer rule (S1-05), status transitions, reasons, originals and resolution confirmation (S1-06). S1-10 calls them and adds only the small API changes listed under [API](#api).
- Visibility and sharing requests in the form and the view (S1-11), comments, internal notes, `@mentions` and edit history (S1-12), watching (S1-15), the list, saved views and bulk actions (S1-13), the Kanban board (S1-14).
- Managing templates (S1-17) and the tour "Creating a ticket" (S1-18).
- Parent ticket, relations other than `duplicate_of`, labels, milestone, dates, SLA, GitHub links (later stages; plan, "Out of scope").
- Keyboard shortcuts and command palette entries such as "New ticket" (command palette, Stage 2, [§8.4](../../docs/spec/08-team-views.md)).
- Ticking task-list checkboxes in the rendered description ([Q12](#open-questions)).
- Live updates of an open ticket by other people's changes (S1-15). Until then the view refreshes on focus and after the person's own changes (TanStack Query defaults).

## Proposed change

### Routes and entry points

Both routes live in the `(team)` route group ([§18.5](../../docs/spec/18-code-patterns.md), [Q8](#open-questions)):

| Route | Content |
|---|---|
| `/tickets/new?projectId=…` | The full form. `projectId` preselects the project ([Q6](#open-questions)) |
| `/tickets/{identifier}` | The team ticket view, e.g. `/tickets/ERP-12`. The page resolves the identifier with `GET /api/v1/tickets?identifier=ERP-12` (S1-05); no item → `notFound()`. A lower-case identifier redirects to the canonical upper-case form |

Entry points ([Q7](#open-questions)): a **New ticket** button in the header of the team application shell, shown when at least one project of `GET /api/v1/projects` carries `create_ticket`, and a **New ticket** action on each row of the Projects page (S1-01) that opens the form with that project. Later views (the list of S1-13, the board of S1-14) link to the same route with their project.

An end user who opens `/tickets/{identifier}` is redirected to `/portal/tickets/{identifier}`, and a team member who opens the portal route to the team route; whichever of S1-09 and S1-10 lands second adds the redirect of the other route. The portal route is S1-09's proposal (in progress), which this specification follows ([Q8](#open-questions)).

### Full form

One page with the fields in this order (Rule 2: the fields a person always fills come first, the defaults after them):

| Field | Control and default |
|---|---|
| Project | Select of the active projects whose `allowedActions` contain `create_ticket` (S1-05). Default: the `projectId` parameter; otherwise the only project when there is one; otherwise empty and required ([Q6](#open-questions)) |
| Type | Segmented control (radio group) `bug` / `feature` / `task` / `question`, default `task` ([§3.3](../../docs/spec/03-ticket-model.md)) |
| Title | Text input, required |
| Description | `MarkdownEditor` of S1-07, loaded through `features/tickets/components/lazy-markdown-editor.tsx`, prefilled with the template of the type; file upload through the editor's `onFilesAdd` with S1-08's upload ([Q11](#open-questions)) |
| Priority | Select `low` / `normal` / `high` / `critical`, default from the type's template ([§3.4](../../docs/spec/03-ticket-model.md)) |
| Assignee | As in the view (below): the picker when the chosen project's `allowedActions` contain `assign`, an **Assign to me** checkbox when they contain only `assign_self` (S1-05 lets a Developer create a ticket assigned to themselves) |

The form uses React Hook Form with the Zod resolver and `createTicketSchema` of `@trybun/contracts/tickets` (S1-05), the `Field` components and `fieldErrorsOf()` ([§18.5](../../docs/spec/18-code-patterns.md) "Forms"); watched values are read with `useWatch`. **Create ticket** submits through `useCreateTicket()` in `features/tickets/mutations.ts`, then the browser opens `/tickets/{identifier}` of the new ticket and a toast says "Ticket ERP-12 created" (PL „Utworzono zgłoszenie ERP-12”). Leaving the page with a changed title or description asks to discard the changes.

### Templates in the form

**Source** ([Q1](#open-questions)): until S1-17 builds template management, the four team templates of [§3.4](../../docs/spec/03-ticket-model.md) are catalogue texts of the `tickets` namespace of `@trybun/i18n` (`tickets.templates.<type>`, EN and PL), and the default priority per type is a constant `TICKET_TYPE_DEFAULT_PRIORITY` of `@trybun/contracts/tickets` (`question` → `low`, the others `normal`). A template is copied into the description when the form inserts it, so a later change of a template affects only new tickets ([§3.4](../../docs/spec/03-ticket-model.md)). The texts follow the structure of [§3.4](../../docs/spec/03-ticket-model.md), with headings and task lists, e.g. for `bug`:

```markdown
## Problem

## Steps to reproduce

1.

## Expected result

## Actual result

## Environment
```

**Language** ([Q4](#open-questions)): the template is inserted in the account language of the person creating the ticket (`language` of `GET /users/me`, S1-03), or in the request language of [§13.1](../../docs/spec/13-non-functional.md) when the account has none. A language switch while the form is open does not re-insert it.

**Replacement rule** – one pure function in `features/tickets/ticket-form-templates.ts`, unit-tested with a table ([Q3](#open-questions)):

```
nextDescription(current, previousType, nextType, language)
  = template(nextType, language)  when normalize(current) is empty
                                  or equals normalize(template(previousType, language))
  = current                       otherwise
```

`normalize` unifies line endings and trims trailing whitespace of every line and of the text, so an editor that adds a final newline does not count as an edit. The comparison has no hidden "touched" state: a person who edits the template and then restores it exactly gets the replacement again. The priority follows the same rule: when the priority equals the default of the previous type, it becomes the default of the next type; a priority the person chose is kept.

The rule applies only in the full form. In the ticket view a change of the type never touches the description ([Q2](#open-questions)).

### Ticket view

```
┌──────────────────────────────────────────────┬──────────────────────┐
│ ERP-12 · Title (editable)                    │ Status    [In progress▾]
│ requester opened 3 days ago · source         │ Assignee  [Anna     ▾]│
├──────────────────────────────────────────────┤ Type      [bug      ▾]│
│ Description (rendered GFM)          [Edit]   │ Priority  [high     ▾]│
│ Attachments (S1-08)                          │ Project   ERP         │
├──────────────────────────────────────────────┤ Requester …           │
│ Activity              [ ] Hide events        │ Organization …        │
│ • Anna changed priority: normal → high       │ Created / updated     │
│ • System removed the assignee Jan            │ (Visibility: S1-11)   │
│ [Show more]                                  │                       │
└──────────────────────────────────────────────┴──────────────────────┘
```

- **Layout** (Rule 9): two columns from the `lg` breakpoint; on phones and tablets the field panel becomes a **Details** section between the header and the description, with each field opening a bottom sheet ([§18.6](../../docs/spec/18-code-patterns.md)). Every control is at least 44 px; nothing is hover-only.
- **Header**: the identifier (copy button), the title – editable in place with `update`, saved with **Save** or Enter, cancelled with Escape – and "{requester} opened {relative time}" with the source (`user` / `developer` / `integration`, catalogue labels).
- **Description**: the rendered GFM (`Markdown` of `@trybun/ui`, with the attachment images of S1-07/S1-08). With `update`, **Edit** replaces it with the `MarkdownEditor` and **Save** / **Cancel**.
- **Field panel**: status, assignee, type (shows "Not set" for an end-user ticket before triage, S1-05 Q3), priority, project (read-only), requester, organization (only when the ticket has one, so nothing appears while no organization exists, [§7.3](../../docs/spec/07-users-organizations-permissions.md)), created and updated (`next-intl` formatter in the person's time zone). S1-11 adds the visibility and sharing request to this panel, S1-15 the watch toggle.
- **Read-only**: a control whose action is missing from `allowedActions` is shown as plain text. In an archived project the API returns only `read` (S1-04), so the whole view is read-only and shows the archived notice of S1-01.

**Saving** ([Q10](#open-questions)): type, priority and assignee save immediately on selection with `PATCH /api/v1/tickets/{id}` and `If-Match` (S1-05), then show a toast with **Undo** that sends the inverse `PATCH` with the version returned by the change ([§18.5](../../docs/spec/18-code-patterns.md) "Changing data"). An undo is a change of its own: it writes its own event, and when someone changed the ticket in between it gets `412`, shows the conflict message and is not retried. Title and description save explicitly. A `412` shows the standard conflict message ([§17.2](../../docs/spec/17-conventions.md)) and refetches the ticket; an open description editor keeps the person's text so nothing typed is lost.

### Assignment

| `allowedActions` of the ticket | Control |
|---|---|
| `assign` (Project manager, Administrator) | A searchable picker of the people who can be assigned in the project, with **Assign to me** as its first item and **Unassigned** as its last |
| `assign_self` only (Developer) | **Assign to me** when the ticket is unassigned or assigned to someone else (taking over); **Unassign me** when the person is the assignee; no picker |
| neither | The assignee as text |

The picker reads `GET /api/v1/projects/{projectId}/members?assignable=true` (S1-01's members list, Developer and above). The new filter `assignable` returns only the members the API would accept as assignee – active `team` accounts with a `developer` or `project_manager` membership (S1-05 Q9) – so the rule lives in the API and the web application does not filter by account state ([Q9](#open-questions)). The server still validates every assignment (`422 ticket.assignee_not_eligible`, `403` for a Developer assigning someone else).

### Status

A select of the nine internal statuses of [§4.1](../../docs/spec/04-ticket-lifecycle.md), grouped by kind (initial, active, paused, terminal) with the catalogue labels of S1-06, shown with `change_status`. A ticket in `waiting_for_requester` shows its waiting reason ("Waiting for information" / „Oczekuje na informacje”, "Waiting for confirmation" / „Oczekuje na potwierdzenie”). It calls `PUT /api/v1/tickets/{id}/status` of S1-06 with `If-Match`:

- **`rejected`** opens a dialog with the reason (`MarkdownEditor`, required, 1–2000 characters as S1-06 proposes) and the hint that the reason will be published to the requester (S1-12).
- **`duplicate`** opens a dialog with an **Original ticket** field that takes an identifier of the same project (`ERP-7`), resolved with `GET /api/v1/tickets?projectId&identifier=` and shown with its title before confirming; S1-06's errors (`ticket.duplicate_of_self`, `ticket.duplicate_other_project`) appear on the field. A search of tickets by title comes with search (S2-03).
- **`done`** redirected by resolution confirmation: the response carries `waiting_for_requester` with reason `confirmation`, and the view says "The requester is asked to confirm that the problem is solved. The ticket closes automatically after 7 days." (PL „Poprosiliśmy zgłaszającego o potwierdzenie rozwiązania problemu. Zgłoszenie zamknie się automatycznie po 7 dniach.”).
- **Undo** ([Q10](#open-questions)): a change between non-terminal statuses shows the undo toast; a move into or out of a terminal status, a dialog-confirmed move and a redirected `done` do not, because their inverse is not a neutral change (a reopen with its own event, S1-06).

### Activity timeline

- Read with `GET /api/v1/tickets/{id}/activity-events` (S1-05) through `infiniteQueryOptions` in `features/tickets/queries.ts`, oldest first, 50 per page, with **Show more** at the end ([Q13](#open-questions)). The first item is "{requester} opened the ticket" from the ticket itself (S1-05 writes no creation event).
- Each event type of S1-05 and S1-06 has a catalogue text in the `tickets` namespace, e.g. "Anna changed priority: Normal → High", "Jan changed status to In progress", "Anna marked this as a duplicate of ERP-7", "Jan edited the description". Codes are shown with the labels in the viewer's language, references with the snapshot name of the event (S1-05). An automatic event shows its source ("System" / „System”) instead of a person ([§4.5](../../docs/spec/04-ticket-lifecycle.md)); an event whose actor was anonymized shows "Deleted user".
- The team sees every event, internal and public, as S1-05 returns them.
- **Hide events**: a switch "Hide events" (PL „Ukryj zdarzenia”) above the timeline ([§4.5](../../docs/spec/04-ticket-lifecycle.md): the team sees comments only). Its state is the account field `hideTimelineEvents`, read from `GET /api/v1/users/me` and saved with `PATCH /api/v1/users/me` (S1-03's endpoint) with an optimistic update, as [§18.5](../../docs/spec/18-code-patterns.md) allows for toggles ([Q5](#open-questions)). While it is on, the view does not request the events. Until S1-12 adds comments, the hidden timeline shows "Events are hidden. Comments appear here." (PL „Zdarzenia są ukryte. Tutaj pojawią się komentarze.”) with the switch to show them; S1-12 interleaves comments and keeps the setting.

### API

S1-10 adds two small, additive changes; everything else comes from S1-01, S1-03, S1-05 and S1-06.

| Change | Detail |
|---|---|
| `users.hide_timeline_events` | Boolean, default `false`, migration `add_user_hide_timeline_events`; `GET /users/me` returns `hideTimelineEvents`; `PATCH /users/me` (S1-03) accepts it. Own account only, as S1-03 defines the endpoint ([Q5](#open-questions)) |
| `GET /projects/{projectId}/members?assignable=true` | Filter of S1-01's members list: only members who are eligible assignees by S1-05's rule. Same action `read_members` ([Q9](#open-questions)) |

The OpenAPI document and the web client are regenerated with `pnpm api:generate`. No new error code, permission rule, activity event type or outbox event.

### Web structure

`features/tickets/` (the feature name of the server module, [§18.5](../../docs/spec/18-code-patterns.md)):

- `queries.ts` – `ticketByIdentifierQueryOptions`, `ticketQueryOptions`, `ticketActivityEventsInfiniteQueryOptions`, `assignableMembersQueryOptions`; keys `['tickets', 'detail', id]`, `['tickets', 'activity-events', id]`; the account query of `features/users` for `hideTimelineEvents`.
- `mutations.ts` – `useCreateTicket`, `useUpdateTicket` (one hook for the fields, with the undo toast), `useChangeTicketStatus`; `features/users/mutations.ts` gains `useUpdateHideTimelineEvents`.
- `ticket-form-templates.ts` – the replacement rule; `components/` – `ticket-form`, `ticket-view`, `ticket-field-panel`, `assignee-control`, `status-control`, `reject-dialog`, `duplicate-dialog`, `activity-timeline`, `activity-event-item`; dialogs, pickers and the editor through `lazy-*.tsx` wrappers.
- Routes `app/(team)/tickets/new/page.tsx` and `app/(team)/tickets/[identifier]/page.tsx`: parse parameters with Zod, prefetch, compose.

Components missing from `@trybun/ui` – the radio group of the type and the searchable picker (combobox) if S1-01's member picker has not added it – are added from shadcn/ui on Base UI with stories in the three viewports (Rule 6, skill `ui-component`).

### User documentation and tours

- Team help pages in EN and PL (Rule 3, [§2.3](../../docs/spec/02-agent-rules.md)): how-to "Create a ticket" (`views`: `/tickets/new`) and reference "Ticket view" (`views`: `/tickets/[identifier]`) covering fields, assignment, statuses and the timeline; `pnpm help:generate`.
- The tour "Creating a ticket" with its `data-tour` targets is S1-18 (plan). S1-10 adds no tour ([§2.4](../../docs/spec/02-agent-rules.md) lists none for this task).

### Prior art

- **GitHub issues**: the issue body first, then one timeline of comments and events; field changes in a right-hand sidebar saved on selection; issue forms insert a template per kind. The view follows this layout and S1-05's event model.
- **Linear**: properties save immediately and show an undo toast; "Assign to me" is a first-class action. Adopted for type, priority and assignee.
- **Jira**: changing the issue type in the create dialog keeps a description the person edited. The replacement rule here goes further and compares with the template instead of a "touched" flag, so the behaviour is visible from the text alone.
- **Jira / Zendesk "Show: Comments / History / All"**: Jira remembers the activity tab per user, which matches "toggle remembered per user" of [§4.5](../../docs/spec/04-ticket-lifecycle.md).

## Changes to the system specification

| Section | Change |
|---|---|
| §3.3 | Full form: the project defaults to the context the form was opened from, else the only project (Q6); the default priority follows the type's template while the person has not chosen one (Q3) |
| §3.4 | "Unchanged" means equal to the template of the previous type after normalizing whitespace, or empty (Q3); templates apply only when creating a ticket, a type change of an existing ticket keeps its description (Q2); templates are inserted in the language of the form page (Q4); until S1-17 the templates are catalogue texts (Q1) |
| §4.5 | "Hide events" is an account setting (`hideTimelineEvents`) that follows the person to every device (Q5) |
| §7.5 | No change; "Assign tickets" is shown as "Assign to me" / "Unassign me" for a Developer |
| §8 (new paragraph or §8.6) | The team ticket view: routes, field panel, immediate saving with undo (Q8, Q10) |
| §18.2, §18.3 | Pattern for a per-user UI preference: a column of `users` exposed through `GET`/`PATCH /users/me` (Q5) |
| Glossary | `user.hide_timeline_events` – "Hide events" / „Ukryj zdarzenia” |
| Plan, S1-17 | Moves the four team templates from the catalogue into its managed model (Q1). The maintainer changes the plan |

## Open questions

Implementation must not start until every question has an answer. Each answer below is a **proposal awaiting human approval**, chosen as the smallest and most reversible option. Answers marked ⚠ change the plan or introduce a pattern, and need explicit confirmation.

1. ⚠ **Where the templates come from before S1-17.** [§3.4](../../docs/spec/03-ticket-model.md) says templates are global and managed by the Administrator, but management is S1-17 (group 8), after S1-10 (group 5). — **Answer (proposed, awaiting approval):** S1-10 ships the four team templates as catalogue texts (`tickets.templates.<type>`, EN and PL) and the default priorities as a contract constant, with no table and no endpoint; S1-17 introduces the managed model, seeds it from these texts, and switches the form to read it through the API. Alternative: S1-10 creates a `ticket_templates` table seeded by the migration and a read endpoint, and S1-17 adds only editing – one source from the start, but S1-10 then designs S1-17's model.
2. **Type change on an existing ticket.** [§3.4](../../docs/spec/03-ticket-model.md) speaks of "choosing the type in the full form". — **Answer (proposed, awaiting approval):** templates apply only in the creation form. In the ticket view (and during triage) a type change never touches the description: rewriting a saved description silently would be a second, surprising change with its own event. Alternative: also replace a saved description that still equals the old template.
3. **What "unchanged" means.** — **Answer (proposed, awaiting approval):** empty, or equal to the template of the previous type after normalizing line endings and trailing whitespace; a stateless comparison, no "touched" flag. The default priority follows the same rule: it changes with the type only while it equals the previous type's default.
4. **Template language.** [§3.4](../../docs/spec/03-ticket-model.md) says "the language of the person creating the ticket". — **Answer (proposed, awaiting approval):** the account language (S1-03), falling back to the request language of [§13.1](../../docs/spec/13-non-functional.md) when the account has none; a language switch during editing does not re-insert the template, and the replacement rule compares within the language the template was inserted in.
5. ⚠ **Where "hide events" is remembered.** [§4.5](../../docs/spec/04-ticket-lifecycle.md) says "remembered per user", and §18 has no pattern for per-user UI preferences (S5-04 will need a second one). — **Answer (proposed, awaiting approval):** a boolean column `users.hide_timeline_events` exposed as `hideTimelineEvents` on `GET`/`PATCH /users/me` (S1-03's endpoint); later preferences add their own typed column the same way. Proposed as the pattern "a per-user UI preference" (Rule 12). Alternatives: a generic `user_preferences` key–value table (one migration for all future preferences, but untyped values in the database); a cookie or local storage (not per user across devices, so it does not meet §4.5).
6. **Default project.** "Current project" ([§3.3](../../docs/spec/03-ticket-model.md)) is not defined while there is no project page. — **Answer (proposed, awaiting approval):** the project the form was opened from (`?projectId=`, set by the Projects page row, and later by the list and the board of S1-13/S1-14); otherwise the only project the person can create tickets in; otherwise empty and required. No "last used project" memory.
7. **Entry points.** — **Answer (proposed, awaiting approval):** a **New ticket** button in the team shell header (when any project allows `create_ticket`) and a **New ticket** row action on the Projects page; no keyboard shortcut until the command palette (Stage 2).
8. **Routes.** — **Answer (proposed, awaiting approval):** `/tickets/new` and `/tickets/{identifier}` in `(team)` (S1-05 Q12); the portal uses `/portal/tickets/{identifier}` (S1-09's proposal), with kind-based redirects between the two added by whichever task lands second. `new` cannot collide with an identifier, which always contains `-` and a number.
9. **Source of the assignee picker.** S1-01's members list includes members who may no longer be assigned (e.g. deactivated accounts), and the web application must not decide eligibility. — **Answer (proposed, awaiting approval):** an additive filter `assignable=true` on `GET /projects/{projectId}/members` that applies S1-05's eligibility rule in the API. A Developer gets no picker, only **Assign to me** / **Unassign me**.
10. **Saving and undo in the view.** — **Answer (proposed, awaiting approval):** type, priority and assignee save on selection with an undo toast; title and description save explicitly; status changes between non-terminal statuses have undo, moves into or out of terminal statuses, dialog-confirmed moves and a redirected `done` do not. An undo is an ordinary change with its own event (the history is immutable, [§4.5](../../docs/spec/04-ticket-lifecycle.md)); if the ticket changed in between it gets `412` and the conflict message, without a retry. Leaving the form or an open description editor with unsaved text asks to discard it.
11. **Boundaries with S1-08, S1-11, S1-12 and S1-15.** — **Answer (proposed, awaiting approval):** S1-10 composes what those tasks provide and invents no substitute: S1-08's upload (the editor's `onFilesAdd`) and attachment list, S1-11's visibility control in the form and the field panel, S1-12's comments in the timeline (keeping `hideTimelineEvents`), S1-15's watch toggle and live updates. Whichever task lands later adds its element to the view.
12. **Ticking task-list items in the rendered description** (S1-07 Q6 left it to S1-10). — **Answer (proposed, awaiting approval):** not in S1-10; ticking means editing the description. It can be added later as a description edit with `If-Match`.
13. **Timeline order and paging.** — **Answer (proposed, awaiting approval):** oldest first (as S1-05 returns), 50 per page, **Show more** at the end; the opening item comes from the ticket itself. GitHub's "hidden items" in the middle can come later if long timelines need it.
14. **One task or several.** The plan row bundles the view, the form with templates and the persisted toggle; the view and the form could ship separately, and the toggle depends on S1-03's `PATCH /users/me`. — **Answer (proposed, awaiting approval):** keep one task and one implementation PR, as the plan row and "one task = one PR" define, built in the phases below, each of which leaves the application working and can be merged on its own if the maintainer prefers. Phase 1 step 2 needs S1-03 merged; until then the switch works for the page only. Alternative: the maintainer splits S1-10 into "ticket view" and "full form" plan tasks.

## Implementation plan

Each step leaves the application working and has its tests.

**Phase 1 – View and timeline**

1. Routes `/tickets/{identifier}` (lookup, canonical redirect, `notFound()`), queries, the view with header, rendered description and read-only field panel, the timeline with every event type of S1-05 and S1-06, automatic and anonymized actors, paging. Component tests per event type; help page "Ticket view" (EN, PL).
2. `users.hide_timeline_events`, `GET`/`PATCH /users/me`, the switch with the optimistic update. Integration test: the setting is stored per account and returned to a second session; E2E: **the "hide events" setting persists per user** – switched on in one browser context, still on after sign-in of the same user in a second, fresh browser context (as the tour tests of S0-10).

**Phase 2 – Changes in the view**

3. Editing title and description (`update`), type and priority (`update_fields`) with undo and `412` handling; read-only rendering by `allowedActions` and in an archived project. Component tests: undo sends the inverse change; a `412` while saving the description shows the conflict message and keeps the typed text; a control without its action renders as text.
4. `assignable=true` on the members list (integration test: a deactivated member and an end user are not listed); assignee control. E2E: **a Developer can assign only themselves** – the Developer sees only **Assign to me** / **Unassign me** in the view and only the **Assign to me** checkbox in the form, takes over a ticket, and a direct API call assigning someone else returns `403`; a Project manager assigns anyone from the picker.
5. Status control with the reject and duplicate dialogs and the resolution-confirmation message.

**Phase 3 – Full form**

6. Catalogue templates (EN, PL), `TICKET_TYPE_DEFAULT_PRIORITY`, `ticket-form-templates.ts` with table tests (empty, unchanged, unchanged with trailing newline, edited, edited and restored, priority chosen or default).
7. `/tickets/new`, the form, entry points, navigation to the new ticket; component tests and E2E: **changing the type with an unchanged description replaces the template; with an edited one it never does**; the template appears in PL for a person whose language is PL. Help page "Create a ticket" (EN, PL), `pnpm help:generate`.
8. Update §3.3, §3.4, §4.5, §8, §18 and the glossary as approved; move this file to `implemented/`.

## Acceptance criteria

- [ ] In the full form, changing the type while the description is empty or equals the previous template replaces the template (and a default priority); with an edited description it never does
- [ ] The full form defaults to the project it was opened from, type `task` and priority `normal`; a `question` defaults to priority `low`; templates appear in the person's language
- [ ] A new ticket opens in the ticket view with a confirmation toast
- [ ] A Developer can assign only themselves (take over, unassign self); a Project manager and the Administrator can assign any eligible member; the picker lists only eligible members
- [ ] Every control follows `allowedActions`; an archived project shows a read-only view
- [ ] Status changes call S1-06's endpoint; `rejected` requires a reason, `duplicate` an original of the same project; a redirected `done` explains the confirmation
- [ ] The timeline shows every field change with old and new value, automatic events with their source, oldest first with paging
- [ ] The "hide events" setting persists per user across devices
- [ ] A `412` on any change shows the conflict message and never discards typed text
- [ ] Works on phone, tablet and desktop (Rule 9): E2E of the form and the view on the three devices with axe; touch targets ≥ 44 px
- [ ] User documentation updated (Rule 3): "Create a ticket" and "Ticket view" in EN and PL; no product tour in this task, the tour "Creating a ticket" is S1-18 (Rule 4)

## Changelog

- 2026-10-26 – Created.
