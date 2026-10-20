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

## 4.3 Transition rules

- **Initial status:** tickets from end users and integrations start in `new` (they go through triage). Tickets created by the team start in `todo`. Tickets created from GitHub issues ([§11.5](11-github-integration.md)) start in `todo`.
- The team may move a ticket between any statuses; the workflow is a convention, not a hard-enforced state machine. Permission rules from [§7.5](07-users-organizations-permissions.md) apply.
- **Waiting reason.** A ticket in `waiting_for_requester` always has a **waiting reason** (`ticket.waiting_reason`): `information` (the team asked for more information) or `confirmation` (resolution confirmation, below). The system also stores the status the ticket had before it started waiting. The reason is cleared when the ticket leaves `waiting_for_requester`.
- **Closing after verification**: a Developer or Project manager moves a ticket from `in_verification` to `done` after checking the result.
- **Resolution confirmation** (optional per project, [§3.1](03-ticket-model.md)): when the setting is on and a ticket with source `user` is moved to `done` from any non-terminal status, it goes to `waiting_for_requester` with reason `confirmation` instead. The requester is asked "Is your problem solved?" (PL: „Czy Twój problem został rozwiązany?”) and gets two explicit actions in the portal and in the e-mail:
  - "Yes, solved" (PL: „Tak, rozwiązane”) → `done`,
  - "No, still a problem" (PL: „Nie, problem nadal występuje”) → `in_progress`.
  - In the e-mail both actions are signed one-click links that open a confirmation page in the portal; the change happens only after the button on that page is pressed (POST), so link scanners in mail systems cannot trigger it.
  - Any other public comment by the requester counts as "No, still a problem" → `in_progress`.
  - Only the requester's actions count; comments of other end users do not change the status.
  - With no action within **7 calendar days** of the request, the ticket moves to `done` automatically (an automatic event, [§4.5](#45-activity-timeline)).
  - These rules take precedence over the general return rule below.
- **Requester reply while waiting for information**: when the requester replies (public comment, including e-mail reply) to a ticket in `waiting_for_requester` with reason `information`, the ticket automatically returns to the **status it had before** – no manual team action.
- Moving a ticket to `rejected` requires a **reason**, published to the requester as a public comment.
- Moving to `duplicate` requires a **link** to the original ticket in the same project, stored as the relation `duplicate_of` ([§3.5](03-ticket-model.md)):
  - the requester and the watchers of the duplicate become watchers of the original, and the requester is counted as an affected user of the original ([§5.6](05-visibility-and-search.md)),
  - if the original is itself a duplicate, the link points to its original (no chains),
  - reopening the duplicate removes the `duplicate_of` relation and records an event.
- Moving a ticket from a terminal status to any other status is a **reopen** (relevant for SLA, [§9.4](09-sla.md)).
- **Comments on terminal tickets**: a public comment by the requester on a `done` ticket within **14 days** of reaching `done` reopens it to `triage` (a reopen for SLA) and notifies the assignee. After 14 days, and always for `rejected` and `duplicate`, end users cannot comment; instead of the comment field the portal shows "Create a new ticket" (PL: „Utwórz nowe zgłoszenie”). E-mail replies follow the same rules ([§6.3](06-comments-notifications.md)). The team can always comment.
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

- Every change of a ticket field is recorded with the author, timestamp, previous and new value.
  - Values that refer to other records (assignee, label, milestone, status) are stored as a snapshot – identifier plus display name – so the event stays readable after the record is renamed or deleted. Events have no foreign keys to labels or milestones.
  - Changes of the description and of comments are recorded only as "edited" with author and time. The text itself is kept in **content revisions** ([§6.1](06-comments-notifications.md)), not in events, so it can be redacted.
- The history is **immutable**: nobody, including the Administrator, can edit or delete events. (GDPR anonymization replaces personal data of the author but keeps the event, [§13.2](13-non-functional.md).) Redaction of content ([§5.2](05-visibility-and-search.md)) is itself recorded as an event "Content redacted" (PL: „Treść zredagowana”) with author and time, without the removed content.
- Automatic events (GitHub, integrations, system rules) are marked as automatic, with their source.
- End users see only **public events**: public status changes, public comments and assignment to a public milestone. Internal events are visible to the team only.
- Team members can hide events and see comments only (toggle remembered per user).
