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
| `waiting_for_requester` | `awaiting_reply` | We need more information from you | Potrzebujemy od Ciebie dodatkowych informacji |
| `todo` | `in_progress` | Your ticket has been scheduled | Zgłoszenie zostało zaplanowane |
| `in_progress` | `in_progress` | We are working on a solution | Pracujemy nad rozwiązaniem |
| `in_verification` | `in_progress` | We are testing the solution | Testujemy rozwiązanie |
| `done` | `resolved` | Your ticket has been resolved | Zgłoszenie zostało rozwiązane |
| `rejected` | `closed` | Ticket closed (with the reason) | Zgłoszenie zamknięte (z podaniem powodu) |
| `duplicate` | `closed` | Ticket merged with another one (with a link) | Zgłoszenie połączone z innym (z odnośnikiem) |

## 4.3 Transition rules

- **Initial status:** tickets from end users and integrations start in `new` (they go through triage). Tickets created by the team start in `todo`. Tickets created from GitHub issues ([§11.5](11-github-integration.md)) start in `todo`.
- The team may move a ticket between any statuses; the workflow is a convention, not a hard-enforced state machine. Permission rules from [§7.5](07-users-organizations-permissions.md) apply.
- Moving a ticket to `rejected` requires a **reason**, published to the requester as a public comment. Moving to `duplicate` requires a **link** to the original ticket.
- When the requester replies (public comment, including e-mail reply) to a ticket in `waiting_for_requester`, the ticket automatically returns to the **status it had before** – no manual team action.
- Moving a ticket from a terminal status to any other status is a **reopen** (relevant for SLA, [§9.4](09-sla.md)).
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
- The history is **immutable**: nobody, including the Administrator, can edit or delete events. (GDPR anonymization replaces personal data of the author but keeps the event, [§13.2](13-non-functional.md).)
- Automatic events (GitHub, integrations, system rules) are marked as automatic, with their source.
- End users see only **public events**: public status changes, public comments and assignment to a public milestone. Internal events are visible to the team only.
- Team members can hide events and see comments only (toggle remembered per user).
