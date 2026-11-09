# 04 – Ticket lifecycle and activity timeline

## 4.1 Statuses

Following helpdesk practice (Zendesk, Jira Service Management) the system distinguishes:

- **internal statuses** – the team's full workflow,
- **public statuses** – a simplified view for end users.

The set of statuses and their mapping are **global for the whole system**. All projects use the same workflow, so the team works with one consistent scheme regardless of the project.

### Internal statuses

| Code | EN label | PL label | Kind |
|---|---|---|---|
| `new` | New | Nowe | initial |
| `triage` | Triage | Do analizy | active |
| `todo` | To do | Do zrobienia | active |
| `in_progress` | In progress | W realizacji | active |
| `in_verification` | In verification | W weryfikacji | active |
| `waiting_for_requester` | Waiting for requester | Oczekuje na zgłaszającego | paused |
| `done` | Done | Zakończone | terminal |
| `rejected` | Rejected | Odrzucone | terminal |
| `duplicate` | Duplicate | Duplikat | terminal |

Main flow: `new` → `triage` → `todo` → `in_progress` → `in_verification` → `done`.

**Terminal statuses** are `done`, `rejected` and `duplicate`. Everywhere in this specification, "closed" or "completed" means a terminal status.

### Public statuses

| Code | EN label | PL label |
|---|---|---|
| `received` | Received | Przyjęte |
| `awaiting_reply` | **Awaiting your reply** | **Wymaga Twojej odpowiedzi** |
| `in_progress` | In progress | W realizacji |
| `resolved` | Resolved | Rozwiązane |
| `closed` | Closed | Zamknięte |

## 4.2 Status mapping

Every internal status maps to exactly one public status. As a result:

- users do not need to know the team's jargon,
- moving a ticket back in the workflow (e.g. from verification to in progress) does not look like a regression to the user,
- changing the internal process does not change what users see.

| Internal | Public | Description shown to the user (EN) | Description shown to the user (PL) |
|---|---|---|---|
| `new` | `received` | We have received your ticket | Otrzymaliśmy Twoje zgłoszenie |
| `triage` | `received` | We are analyzing your ticket | Analizujemy zgłoszenie |
| `waiting_for_requester` (reason `information`) | `awaiting_reply` | We need more information from you | Potrzebujemy od Ciebie dodatkowych informacji |
| `waiting_for_requester` (reason `confirmation`) | `awaiting_reply` | Please confirm whether your problem is solved | Potwierdź, czy Twój problem został rozwiązany |
| `todo` | `in_progress` | Your ticket has been scheduled | Zgłoszenie zostało zaplanowane |
| `in_progress` | `in_progress` | We are working on a solution | Pracujemy nad rozwiązaniem |
| `in_verification` | `in_progress` | We are testing the solution | Testujemy rozwiązanie |
| `done` | `resolved` | Your ticket has been resolved | Zgłoszenie zostało rozwiązane |
| `rejected` | `closed` | Ticket closed (with the reason) | Zgłoszenie zamknięte (z podaniem powodu) |
| `duplicate` | `closed` | Ticket merged with another one (with a link) | Zgłoszenie połączone z innym (z odnośnikiem) |

The description shown to the user is a code of the API response (`publicStatusDescription` of the end-user ticket response: `received`, `analyzing`, `information_needed`, `confirmation_needed`, `scheduled`, `working`, `testing`, `resolved`, `rejected`, `merged`, one per row), so the internal status never reaches end users. Status changes reach end users with public statuses only.

## 4.3 Transition rules

- **Initial status:** tickets from end users and integrations start in `new` (they go through triage). Tickets created by the team start in `todo`. Tickets created from GitHub issues ([§11.5](11-github-integration.md)) start in `todo`.
- The team may move a ticket between any statuses; the workflow is a convention, not a hard-enforced state machine. Permission rules from [§7.5](07-users-organizations-permissions.md) apply.
- **Waiting reason.** A ticket in `waiting_for_requester` always has a **waiting reason** (`ticket.waiting_reason`): `information` (the team asked for more information) or `confirmation` (resolution confirmation, below). A move of the team into `waiting_for_requester` always sets `information`; `confirmation` is set only by the resolution confirmation, because it starts the automatic close. The system also stores the status the ticket had before it started waiting (`ticket.status_before_waiting`) and since when it waits (`ticket.waiting_since`); after a reopen into `waiting_for_requester` the status before waiting is `triage`, so a reply of the requester never closes the ticket again. Switching the reason while waiting restarts the wait and keeps the status before waiting. The reason is cleared when the ticket leaves `waiting_for_requester`.
- **Closing time.** Every transition into a terminal status, also from another terminal status, sets the ticket's closing time (`ticket.closed_at`); a reopen clears it.
- **Closing after verification**: a Developer or Project manager moves a ticket from `in_verification` to `done` after checking the result.
- **Resolution confirmation** (optional per project, [§3.1](03-ticket-model.md)): when the setting is on and a ticket with source `user` is moved to `done` from any non-terminal status, it goes to `waiting_for_requester` with reason `confirmation` instead. The requester is asked "Is your problem solved?" (PL: „Czy Twój problem został rozwiązany?”) and gets two explicit actions in the portal and in the e-mail:
  - "Yes, solved" (PL: „Tak, rozwiązane”) → `done`,
  - "No, still a problem" (PL: „Nie, problem nadal występuje”) → `in_progress`.
  - In the e-mail both actions are signed one-click links that open the confirmation page of the portal, `/portal/tickets/{identifier}/resolution-confirmation?answer=solved|not_solved` ([§5.7](05-visibility-and-search.md)); the change happens only after the button on that page is pressed (POST), so link scanners in mail systems cannot trigger it. The signed token is carried in the URL fragment, never in the path or the query ([§17.2](17-conventions.md)).
  - Any other public comment by the requester counts as "No, still a problem" → `in_progress`.
  - Only the requester's actions count; comments of other end users do not change the status.
  - With no action within **7 calendar days** of the request – 7 × 24 hours after the ticket started waiting, independent of time zones – the ticket moves to `done` automatically (an automatic event, [§4.5](#45-activity-timeline)). In an archived project the automatic close waits; it happens on the first daily check after the project is unarchived.
  - A team move to `done` of a ticket that waits for the confirmation closes it directly: the team overrides the wait (e.g. the requester confirmed by phone).
  - These rules take precedence over the general return rule below.
- **Requester reply while waiting for information**: when the requester replies (public comment, including e-mail reply) to a ticket in `waiting_for_requester` with reason `information`, the ticket automatically returns to the **status it had before** – no manual team action.
- **Whose reply counts**: the requester-reply rules (the confirmation above, the reply while waiting for information and the reopen of a `done` ticket below) apply only to public comments of the requester's `end_user` account – a team member who requested a ticket of the team, other end users and internal notes never change the status. The change is made in the transaction of the comment, on the locked ticket, with the requester as its actor (no automatic source).
- Moving a ticket to `rejected` requires a **reason** (1–2000 characters), published as a public comment by the rejecting team member in the same transaction; its audience is the ticket's effective visibility ([§5.2](05-visibility-and-search.md#comment-audience)). A new reason on a ticket that is already `rejected` adds another comment.
- Moving to `duplicate` requires a **link** to the original ticket in the same project, stored as the relation `duplicate_of` ([§3.5](03-ticket-model.md)):
  - the requester and the watchers of the duplicate become watchers of the original, and the requester is counted as an affected user of the original ([§5.6](05-visibility-and-search.md)),
  - if the original is itself a duplicate, the link points to its original (no chains); the original may be in any other status, terminal ones included,
  - when a ticket becomes a duplicate, its own duplicates are re-pointed to its new original, each with an automatic event,
  - the effects on watchers and affected users are implemented by the tasks that introduce those records,
  - reopening the duplicate removes the `duplicate_of` relation and records an event.
- Moving a ticket from a terminal status to a non-terminal status is a **reopen** (relevant for SLA, [§9.4](09-sla.md)); a move from one terminal status to another is not. A reopen removes an assignee who is no longer an active team member of the project, with an automatic event.
- **Comments on terminal tickets**: a public comment by the requester on a `done` ticket within **14 days** of reaching `done` – less than 14 × 24 hours after `closedAt`, independent of time zones – reopens it to `triage` (a reopen for SLA) and notifies the assignee. After 14 days, and always for `rejected` and `duplicate`, end users cannot comment (`409 ticket.comments_closed`, the reason of the ticket action `add_comment`); instead of the comment field the portal shows "Create a new ticket" (PL: „Utwórz nowe zgłoszenie”). E-mail replies follow the same rules ([§6.3](06-comments-notifications.md)). The team can always comment.
- Automatic transitions (GitHub, integrations) never move a ticket out of a terminal status, except the regression rule for integration tickets ([§12.3](12-api-webhooks-import.md)).

## 4.4 UX rules (Rule 2)

- The public status `awaiting_reply` is clearly highlighted, because it is the only moment the user has to act.
- End users are notified only when the **public status** changes, not on every internal change ([§6.7](06-comments-notifications.md)).

## 4.5 Activity timeline

Every ticket has an activity timeline (pattern: GitHub) in which comments are interleaved chronologically with events, e.g.:

- "Jan changed status to In progress",
- "Anna changed priority: normal → high",
- "Added to milestone v2.0",
- "PR #45 was merged".

Rules:

- Every change of a ticket field is recorded with the author, timestamp, previous and new value: one event per changed field (one change of two fields writes two events), with its type (`activity_event.type`, e.g. `priority_changed`), `{ from, to }`, the person who made it or the source of an automatic change, and whether it is public, decided by the rule that writes it. Creating a ticket writes no event: the timeline begins with the ticket itself.
  - Attachments write `attachment_added` (one per file linked to an existing ticket) and `attachment_deleted`, both public, with the snapshot `{ id, displayName }` of the file – `displayName` being the file name – as `{ from: null, to }` and `{ from, to: null }`. Files linked when the ticket is created write no event, because creating a ticket writes none; the attachment list shows them ([§13.3](13-non-functional.md)).
  - Values that refer to other records (assignee, label, milestone) are stored as a snapshot – identifier plus display name, for a ticket identifier plus number and project key – so the event stays readable after the record is renamed or deleted. Events have no foreign keys to labels or milestones. Statuses are a fixed global list: status events store their codes, and the labels come from the catalogues in the viewer's language.
  - Changes of the description and of comments are recorded only as "edited" with author and time. The text itself is kept in **content revisions** ([§6.1](06-comments-notifications.md)), not in events, so it can be redacted.
  - Comments write `comment_edited` (data `{ commentId }`), `comment_deleted` (data `{ commentId, kind }`) and `comment_redacted` (data `{ commentId }`), the description `description_redacted` (no data) besides `description_edited`. All four are **internal**: end users see the "edited" marker on the text instead, and a deleted comment simply disappears from their view. Their data holds only identifiers, never content, so a deletion or a redaction never has to change an event.
  - Attachments of a comment write no `attachment_added` (the comment shows them); deleting one of them writes `attachment_deleted` as an **internal** event, so its file name does not leak beyond the comment's audience. Deleting a comment writes no `attachment_deleted` for its files: `comment_deleted` covers them.
- The history is **immutable**: nobody, including the Administrator, can edit or delete events. (GDPR anonymization replaces personal data of the author but keeps the event, [§13.2](13-non-functional.md).) Redaction of content ([§5.2](05-visibility-and-search.md)) is itself recorded as an event "Content redacted" (PL: „Treść zredagowana”) with author and time, without the removed content.
- Automatic events (GitHub, integrations, system rules) are marked as automatic, with their source.
- End users see only **public events**: public status changes, public comments (within their audience, [§5.2](05-visibility-and-search.md#comment-audience)), attachments added to or deleted from the ticket, the approval of a sharing request ("Shared with everyone", [§5.2](05-visibility-and-search.md)) and assignment to a public milestone. Internal events are visible to the team only.
  - Visibility writes one event per change: `visibility_changed`, `sharing_requested`, `sharing_request_withdrawn` and `sharing_rejected` are internal; `sharing_approved` is public and reaches end users without data. The reason of a refusal never enters an event.
- Team members can hide events and see comments only: the switch **Hide events** (PL: „Ukryj zdarzenia”) above the timeline of the team ticket view ([§8.6](08-team-views.md#86-team-ticket-view)). It is a setting of the account (`user.hide_timeline_events`, [§7.4](07-users-organizations-permissions.md#74-accounts-and-authentication)), so it follows the person to every device; while it is on, the timeline returns the comments only.
- The API returns comments and events as **one timeline** (`GET /api/v1/tickets/{ticketId}/timeline`), oldest first, merged by their time-ordered IDs with one cursor ([§18.3](18-code-patterns.md#reading-data)); comments go through the comment rules, events through the public-event filter above. The end-user shaping of events lives once in the activity-events module (`ActivityEventsService.listForViewer` for `GET …/activity-events`, `eventsForViewer` for the timeline).
