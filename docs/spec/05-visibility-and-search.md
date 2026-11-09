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

- The choice is a radio group (`RadioGroup` of `@trybun/ui`) below the description, not a required field; every option is visible and chosen with one tap. In the typical case the user takes no extra step. A control with a single option is not shown.
- Only meaningful options are shown, and the API decides them ([§14.4](14-architecture.md)): for a new ticket through the project's `allowedActions` (`create_ticket` for `only_me`, `create_ticket_my_organization`, `create_ticket_all_customers`), for an existing ticket through the ticket's `allowedActions` (`set_visibility_only_me`, `set_visibility_my_organization`, `set_visibility_all_customers`). `my_organization` is offered only where the person's active organization has access to the project. A user without an organization sees `only_me` and `all_customers`. If the system has no organizations at all, `my_organization` is never shown ([§7.3](07-users-organizations-permissions.md)).
- Only end users choose a visibility. Tickets of the team and of integrations are always `only_me` ([§5.4](#54-what-end-users-see-in-other-peoples-tickets)); the team's full form has no visibility control.
- When choosing `all_customers`, a one-sentence warning is shown:
  - EN: "Make sure the description and attachments contain no confidential data."
  - PL: „Upewnij się, że opis i załączniki nie zawierają poufnych danych.”

## 5.2 Shared tickets

A ticket visible to all end users of the project is a **shared ticket**. It is created in one of two ways:

1. **At the author's request**: the author chooses `all_customers`. The sharing request becomes `pending` and goes to team approval. Until approved, the ticket is visible as with `my_organization` (or `only_me` if the author has no organization). A request from an `only_me` ticket widens it to `my_organization` only when the author could choose `my_organization` – the snapshot's organization is active, the author still belongs to it and it has access to the project; otherwise the ticket stays `only_me` while pending.
   - **One approval** by any team member of the project (Developer and above) is enough. When two decide at the same time, the first wins and the second gets `409 ticket.sharing_not_pending`.
   - Before approving, the team may **redact** the content and remove data identifying the customer (see "Redaction" below). The approval is confirmed in a dialog that reminds the team to check that the description and attachments contain no data identifying the customer.
   - While a request is pending, the team decides it before changing the visibility (`409 ticket.sharing_pending`).
   - On approval, the visibility becomes `all_customers` and the request is cleared; the author is informed "Shared with everyone" (PL: „Udostępnione wszystkim”). The approval is a public event in the activity timeline.
   - On refusal, the request becomes `rejected`, the visibility stays as it was, and the team must give a short reason (1–2000 characters), which is published as a public comment by the refusing team member in the same transaction; its audience is the unchanged visibility, so the author sees it. The team view shows "Refused – the reason is in the timeline" (PL: „Odrzucono – powód jest na osi czasu”). The author may request sharing again later.
   - Pending requests appear in the predefined list view "Pending sharing approvals" ([§8.1](08-team-views.md)) and in the triage queue ([§8.3](08-team-views.md)), and the project's team members receive an in-app notification ([§6.6](06-comments-notifications.md)).
2. **At the team's initiative**: the team may share a ticket with visibility `my_organization` (e.g. a known bug affecting all customers), after checking that the content contains no data identifying the customer – confirmed in the same dialog as an approval. This sets the visibility to `all_customers` and clears a refused request.

A ticket with visibility `only_me` is **never** shared without the author's consent (`409 ticket.author_consent_required`). If it describes a problem affecting many customers, the team creates a new, redacted shared ticket, marks the original as `duplicate`, and the author automatically becomes a watcher of the new ticket.

### Comment audience

Every public comment stores its **audience** (`comment.audience`): the effective visibility of the ticket at the moment the comment was written (`only_me`, `my_organization` together with the organization, or `all_customers`), read on the ticket locked by the comment's transaction, so a concurrent visibility change never gives a comment a scope it was not written in. An internal note has no audience. The audience never changes afterwards.

- An end user sees a public comment only if they may see the ticket **and** the comment's audience includes them: `only_me` – they are the requester; `my_organization` – they are a current member of the comment's organization; `all_customers` – always. The comment's author sees their own comment instead of the audience rule, as long as they may see the ticket.
- **Mentions** ([§6.1](06-comments-notifications.md)) are limited to people who can see the ticket **and** would see the comment:
  - an internal note: the project's team members;
  - a public comment by a team member: the project's team members (active team accounts with the Developer role or higher), the requester and, for `my_organization` or `all_customers`, the members of the ticket's organization – never customers of other organizations, even on a shared ticket;
  - a public comment by an end user: the team members who take part in the ticket – its assignee and the team members who wrote a public comment on it that the author can read – and, if the ticket's visibility includes them, the members of the author's organization ([§7.3](07-users-organizations-permissions.md)).
  - Each set is intersected with the people for whom the ticket's read conditions hold; deactivated and anonymized accounts are never in it. A mention never grants access.
- As a result, public comments added before a ticket became shared remain visible only within their original scope, and comments written while a ticket was shared are hidden from other customers' organizations after the visibility is narrowed again.
- Attachments of a comment follow the comment's audience ([§13.3](13-non-functional.md)).
- The team sees all comments.

### Redaction

Team members (Developer and above) can **redact** a ticket description or any comment: they replace the content and purge the selected earlier versions from the edit history ([§6.1](06-comments-notifications.md)). The activity timeline records "Content redacted" with author and time, without the removed content ([§4.5](04-ticket-lifecycle.md)), and the action is written to the administrative audit log ([§13.5](13-non-functional.md)).

## 5.3 Changing visibility

- The author may **widen** the visibility of their ticket at any time (widening to `all_customers` follows [§5.2](#52-shared-tickets)).
- The author may **narrow** the visibility as long as the ticket is not shared. Narrowing a shared ticket requires the team.
- While a request is pending, the author **withdraws** it by choosing `only_me` or `my_organization`; the request becomes `none`.
- Team members (Developer and above) may widen or narrow the visibility of any ticket, within the rule that `only_me` tickets are never shared without the author's consent.
- `my_organization` is set – by the author or the team – only while the snapshot's organization is active, the requester still belongs to it and it has access to the project (the team otherwise gets `409 ticket.organization_changed`, as does a creation whose snapshot no longer allows it), so a ticket is never shown to an organization its author left.
- Changing the visibility, approving and refusing are actions of the ticket's `allowedActions` ([§5.1](#51-visibility-levels)). The author's actions require current access to the project and stay the requester's own: people who read another person's ticket cannot change its visibility.
- Every visibility change is recorded in the activity timeline ([§4.5](04-ticket-lifecycle.md)). A change to the current value changes nothing and writes no event. Comment audiences ([§5.2](#52-shared-tickets)) are not changed by it.

## 5.4 What end users see in other people's tickets

Only tickets with source `user` can be visible to other end users. Team tickets (source `developer`) and integration tickets (source `integration`) are visible to the team only.

In tickets of other people, end users see only:

- title and description,
- public status,
- public comments.

Internal notes, internal statuses, priority, assignee, labels and relations are never visible to end users.

**Identities of other customers.** Members of the requester's own organization see the real names of the requester and of commenters from their organization. End users of **other** organizations (or without an organization) see the requester and commenters from other organizations as "Customer" (PL: „Klient”), without name or organization. Team members are shown with their names. "Same organization" means the **current** memberships of the viewer and the person, whether the organization is active or archived, not the ticket's snapshot: a requester who left the organization is shown as "Customer" to their former colleagues, and two people without an organization never count as the same organization. This is decided by the API in the response, not by the UI ([§14.4](14-architecture.md)): the response carries no name for "Customer". Every person in a response – the requester, comment and revision authors, mentioned people, uploaders, the actors of events – is shaped by one helper of the users module, `visiblePerson` (`modules/users/visible-person.ts`) on the pure rule `identityVisibleTo` (`modules/users/domain/identities.ts`), so the tickets, comments and activity-events modules apply the same rule without depending on each other.

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

The end-user portal is the part of the web application that end users work in (Rule 2: the shortest path to reporting and following a problem). Its routes live under `/portal` ([§18.5](18-code-patterns.md)).

| Route | View |
|---|---|
| `/portal` | Portal root |
| `/portal/projects/{projectId}` | Project home |
| `/portal/projects/{projectId}/tickets/new` | Simplified ticket form ([§3.3](03-ticket-model.md)) |
| `/portal/tickets` | My tickets (`?projectId=` for one project) |
| `/portal/tickets/{identifier}` | Ticket view |
| `/portal/tickets/{identifier}/resolution-confirmation?answer=solved\|not_solved` | Confirmation page of the resolution answer ([§4.3](04-ticket-lifecycle.md)) |
| `/portal/settings` | Account settings ([§13.1](13-non-functional.md)) |

- **Portal root**: lists the **active** projects the user has access to ([§7.1](07-users-organizations-permissions.md)). If the user has exactly one active project, the root redirects straight to that project's home; archived projects do not count. Without an active project, the root shows an empty state, with a link to "My tickets" when the user has tickets.
- **Project home**: the "Create ticket" action (PL: „Utwórz zgłoszenie”) and "My tickets" (PL: „Moje zgłoszenia”) for that project. An archived project shows its read-only banner instead of "Create ticket". The large search field ([§5.5](#55-search-in-the-end-user-portal)) is added with the portal search; until then the project home has none.
- **My tickets**: also available across all projects of the user, from the portal navigation. It lists tickets the user created and can still read – also in projects they can no longer open, but not their own `my_organization` tickets of an organization they left ([§7.3](07-users-organizations-permissions.md)) – and the tickets they watch once watching exists ([§6.4](06-comments-notifications.md)), with their public status; tickets with `awaiting_reply` are shown first and highlighted ([§4.4](04-ticket-lifecycle.md)), then the most recently updated. The API serves it as `GET /api/v1/tickets?involvement=mine` in this fixed order.
- **Ticket view**: title, description, public status with its description ([§4.2](04-ticket-lifecycle.md)), the resolution question while the ticket waits for it ([§4.3](04-ticket-lifecycle.md)), the public timeline and the comment field (subject to [§4.3](04-ticket-lifecycle.md) for terminal tickets). A lower-case identifier redirects to the upper-case form, on the confirmation page with its answer, like the team route ([08-team-views.md](08-team-views.md)).
- After accepting an invitation ([§7.4](07-users-organizations-permissions.md)), the user lands on the home of the project they were invited to; after accepting an invitation to an organization, which has no single project, on the portal root (team members invited to the Administrator role land on the team home); after a later sign-in, on the portal root.
- **Portal and team views by account kind**: team members who open the portal see the team views instead ([08-team-views.md](08-team-views.md)), and end users who open a team view see the portal. The server redirects by the account kind of the signed-in account to the counterpart of the opened route – `/` ↔ `/portal`, `/projects/{projectId}` ↔ `/portal/projects/{projectId}`, `/tickets/{identifier}` ↔ `/portal/tickets/{identifier}`, `/settings` ↔ `/portal/settings` – and to the root of the other side for every other route. The redirect only shapes the UI; the API decides every access ([§14.4](14-architecture.md)).
