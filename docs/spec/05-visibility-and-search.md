# 05 – Visibility and search

The team (Developer and above) always sees all tickets in their projects. This file defines what **end users** see and how they search.

## 5.1 Visibility levels

The visibility of a ticket is chosen by its author when creating it (pattern: Jira Service Management customer portal). Following privacy by design and by default (GDPR, Art. 25), the default option is **"Only me"**.

| Code | EN label | PL label | Who sees it | Sharing takes effect |
|---|---|---|---|---|
| `only_me` (default) | Only me | Tylko dla mnie | author + team | – |
| `my_organization` | My organization | Moja organizacja | members of the author's organization + team | immediately |
| `all_customers` | All customers | Wszyscy klienci | all end users of the project + team | immediately for the author's organization; for others after team approval |

UX rules (Rule 2):

- The choice is a small switch below the description, not a required field. In the typical case the user takes no extra step.
- Only meaningful options are shown. A user without an organization sees `only_me` and `all_customers`. If the system has no organizations at all, `my_organization` is never shown ([§7.3](07-users-organizations-permissions.md)).
- When choosing `all_customers`, a one-sentence warning is shown:
  - EN: "Make sure the description and attachments contain no confidential data."
  - PL: „Upewnij się, że opis i załączniki nie zawierają poufnych danych.”

## 5.2 Shared tickets

A ticket visible to all end users of the project is a **shared ticket**. It is created in one of two ways:

1. **At the author's request**: the author chooses `all_customers`. The ticket goes to team approval (Developer and above). The team may redact the content and remove data identifying the customer. The author is informed "Shared with everyone" (PL: „Udostępnione wszystkim”) or receives a short explanation of the refusal. Until approved, the ticket is visible as with `my_organization` (or `only_me` if the author has no organization).
2. **At the team's initiative**: the team may mark a ticket with visibility `my_organization` as shared (e.g. a known bug affecting all customers), after checking that the content contains no data identifying the customer.

A ticket with visibility `only_me` is **never** shared without the author's consent. If it describes a problem affecting many customers, the team creates a new, redacted shared ticket, marks the original as `duplicate`, and the author automatically becomes a watcher of the new ticket.

Public comments added before a ticket became shared remain visible only within their original scope.

## 5.3 Changing visibility

- The author may **widen** the visibility of their ticket at any time (widening to `all_customers` follows [§5.2](#52-shared-tickets)).
- The author may **narrow** the visibility as long as the ticket is not shared. Narrowing a shared ticket requires the team.

## 5.4 What end users see in other people's tickets

Only tickets with source `user` can be visible to other end users. Team tickets (source `developer`) and integration tickets (source `integration`) are visible to the team only.

In tickets of other people, end users see only:

- title and description,
- public status,
- public comments.

Internal notes, internal statuses, priority, assignee, labels and relations are never visible to end users.

End users may add public comments to any ticket they can see ([§6.1](06-comments-notifications.md)).

## 5.5 Search in the end-user portal

Following customer-portal practice (Zendesk, Jira Service Management), end users get a **large, visible search field** in the portal header instead of a command palette (the palette is for the team, [§8.4](08-team-views.md)).

- Search covers the tickets the user may see ([§5.1](#51-visibility-levels)).
- When search returns no results (or none fits), a **"Create ticket"** action (PL: „Utwórz zgłoszenie”) is shown below the list and the typed text becomes the title of the new ticket. Searching and reporting form a single path (Rule 2).
- The shortcut **Ctrl+K** (Cmd+K on macOS) focuses the search field. The action palette is not available to end users.

## 5.6 Similar ticket detection

Before a ticket is created, the system automatically searches for similar tickets in the same project (pattern: Stack Overflow, helpdesk portals).

UX rules (Rule 2):

- Suggestions appear **live while the title is typed**, as a list below the field, not as a separate form step.
- Suggestions never block the user. They can ignore them and submit the ticket.
- Each suggested ticket has an **"I have the same problem"** action (PL: „Mam ten sam problem”). It makes the user a watcher of that ticket and increases its **requester count**, instead of creating a duplicate.
- The requester count is visible to the team and supports prioritization. For shared tickets the team also sees how many organizations are affected.
- Suggestions include only tickets the user may see ([§5.1](#51-visibility-levels)). Tickets with visibility `only_me` never appear in other people's suggestions.

### Search mechanism

- First version: PostgreSQL full-text search on title and description, with a Polish dictionary installed ([§14.4](14-architecture.md)).
- Target version: semantic search (pgvector) that recognizes the same problem described in different words. Embeddings are computed **locally** in the Worker (Transformers.js, `multilingual-e5-small`, [§14.2](14-architecture.md)); ticket content is never sent to an external service. Results combine full-text and semantic similarity (hybrid ranking).
- The same mechanism is used by the portal search ([§5.5](#55-search-in-the-end-user-portal)) and the team's global search ([§8.5](08-team-views.md)).
