# 05 – Visibility and search

The team (Developer and above) always sees all tickets in their projects. This file defines what **end users** see and how they search.

## 5.1 Visibility levels

The visibility of a ticket is chosen by its author when creating it (pattern: Jira Service Management customer portal). Following privacy by design and by default (GDPR, Art. 25), the default option is **"Only me"**.

| Code | EN label | PL label | Who sees it | Sharing takes effect |
|---|---|---|---|---|
| `only_me` (default) | Only me | Tylko dla mnie | author + team | – |
| `my_organization` | My organization | Moja organizacja | members of the author's organization + team | immediately |
| `all_customers` | All customers | Wszyscy klienci | all end users of the project + team | after team approval ([§5.2](#52-shared-tickets)) |

`ticket.visibility` always stores the **effective** visibility. A request to share a ticket with all customers is stored separately as `ticket.sharing_request` (`none`, `pending`, `rejected`); while a request is `pending`, the visibility stays `my_organization` (or `only_me` if the author has no organization). A ticket is **shared** exactly when its visibility is `all_customers`.

UX rules (Rule 2):

- The choice is a small switch below the description, not a required field. In the typical case the user takes no extra step.
- Only meaningful options are shown. A user without an organization sees `only_me` and `all_customers`. If the system has no organizations at all, `my_organization` is never shown ([§7.3](07-users-organizations-permissions.md)).
- When choosing `all_customers`, a one-sentence warning is shown:
  - EN: "Make sure the description and attachments contain no confidential data."
  - PL: „Upewnij się, że opis i załączniki nie zawierają poufnych danych.”

## 5.2 Shared tickets

A ticket visible to all end users of the project is a **shared ticket**. It is created in one of two ways:

1. **At the author's request**: the author chooses `all_customers`. The sharing request becomes `pending` and goes to team approval. Until approved, the ticket is visible as with `my_organization` (or `only_me` if the author has no organization).
   - **One approval** by any team member of the project (Developer and above) is enough.
   - Before approving, the team may **redact** the content and remove data identifying the customer (see "Redaction" below).
   - On approval, the visibility becomes `all_customers` and the request is cleared; the author is informed "Shared with everyone" (PL: „Udostępnione wszystkim”). The approval is a public event in the activity timeline.
   - On refusal, the request becomes `rejected`, the visibility stays as it was, and the team must give a short reason, which is published to the author as a public comment. The author may request sharing again later.
   - Pending requests appear in the predefined list view "Pending sharing approvals" ([§8.1](08-team-views.md)) and in the triage queue ([§8.3](08-team-views.md)), and the project's team members receive an in-app notification ([§6.6](06-comments-notifications.md)).
2. **At the team's initiative**: the team may share a ticket with visibility `my_organization` (e.g. a known bug affecting all customers), after checking that the content contains no data identifying the customer. This sets the visibility to `all_customers`.

A ticket with visibility `only_me` is **never** shared without the author's consent. If it describes a problem affecting many customers, the team creates a new, redacted shared ticket, marks the original as `duplicate`, and the author automatically becomes a watcher of the new ticket.

### Comment audience

Every public comment stores its **audience** (`comment.audience`): the effective visibility of the ticket at the moment the comment was written (`only_me`, `my_organization` together with the organization, or `all_customers`).

- An end user sees a public comment only if they may see the ticket **and** the comment's audience includes them. The comment's author always sees their own comment.
- As a result, public comments added before a ticket became shared remain visible only within their original scope, and comments written while a ticket was shared are hidden from other customers' organizations after the visibility is narrowed again.
- Attachments of a comment follow the comment's audience ([§13.3](13-non-functional.md)).
- The team sees all comments.

### Redaction

Team members (Developer and above) can **redact** a ticket description or any comment: they replace the content and purge the selected earlier versions from the edit history ([§6.1](06-comments-notifications.md)). The activity timeline records "Content redacted" with author and time, without the removed content ([§4.5](04-ticket-lifecycle.md)), and the action is written to the administrative audit log ([§13.5](13-non-functional.md)).

## 5.3 Changing visibility

- The author may **widen** the visibility of their ticket at any time (widening to `all_customers` follows [§5.2](#52-shared-tickets)).
- The author may **narrow** the visibility as long as the ticket is not shared. Narrowing a shared ticket requires the team.
- Team members (Developer and above) may widen or narrow the visibility of any ticket, within the rule that `only_me` tickets are never shared without the author's consent.
- Every visibility change is recorded in the activity timeline. Comment audiences ([§5.2](#52-shared-tickets)) are not changed by it.

## 5.4 What end users see in other people's tickets

Only tickets with source `user` can be visible to other end users. Team tickets (source `developer`) and integration tickets (source `integration`) are visible to the team only.

In tickets of other people, end users see only:

- title and description,
- public status,
- public comments.

Internal notes, internal statuses, priority, assignee, labels and relations are never visible to end users.

**Identities of other customers.** Members of the requester's own organization see the real names of the requester and of commenters from their organization. End users of **other** organizations (or without an organization) see the requester and commenters from other organizations as "Customer" (PL: „Klient”), without name or organization. Team members are shown with their names. This is decided by the API in the response, not by the UI ([§14.4](14-architecture.md)).

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
- Each suggested ticket has an **"I have the same problem"** action (PL: „Mam ten sam problem”). It makes the user a watcher of that ticket and records them as an **affected user**, which increases its **requester count**, instead of creating a duplicate. The action is idempotent: each user is counted once per ticket ([§3.2](03-ticket-model.md)).
- The requester count is visible to the team and supports prioritization. For shared tickets the team also sees how many organizations are affected.
- Suggestions include only tickets the user may see ([§5.1](#51-visibility-levels)). Tickets with visibility `only_me` never appear in other people's suggestions.

### Search mechanism

- First version: PostgreSQL full-text search on title and description, with a Polish dictionary installed ([§14.4](14-architecture.md)).
- Target version: semantic search (pgvector) that recognizes the same problem described in different words. Embeddings are computed **locally** in the Worker (Transformers.js, `multilingual-e5-small`, [§14.2](14-architecture.md)); ticket content is never sent to an external service. Results combine full-text and semantic similarity (hybrid ranking).
- The same mechanism is used by the portal search ([§5.5](#55-search-in-the-end-user-portal)) and the team's global search ([§8.5](08-team-views.md)).

## 5.7 End-user portal

The end-user portal is the part of the web application that end users work in (Rule 2: the shortest path to reporting and following a problem).

- **Portal root**: lists the projects the user has access to ([§7.1](07-users-organizations-permissions.md)). If the user has access to exactly one project, the root redirects straight to that project's home.
- **Project home**: the large search field ([§5.5](#55-search-in-the-end-user-portal)), the "Create ticket" action (PL: „Utwórz zgłoszenie”) and "My tickets" (PL: „Moje zgłoszenia”) for that project.
- **My tickets**: also available across all projects of the user, from the portal navigation. It lists tickets the user created or watches, with their public status; tickets with `awaiting_reply` are shown first and highlighted ([§4.4](04-ticket-lifecycle.md)).
- **Ticket view**: title, description, public status with its description ([§4.2](04-ticket-lifecycle.md)), the public timeline and the comment field (subject to [§4.3](04-ticket-lifecycle.md) for terminal tickets).
- After accepting an invitation ([§7.4](07-users-organizations-permissions.md)), the user lands on the home of the project they were invited to; after accepting an invitation to an organization, which has no single project, on the portal root (team members invited to the Administrator role land on the team home); after a later sign-in, on the portal root.
- Team members who open the portal see the team views instead ([08-team-views.md](08-team-views.md)).
