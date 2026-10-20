# 03 – Ticket model

The system uses **one common ticket model** for all sources (team, end users, integrations). Sources are distinguished by the `source` and `type` fields, so a ticket reported by a user can become a development task without copying data.

## 3.1 Projects

Every ticket belongs to exactly one **project**.

| Field | Description |
|---|---|
| Name | Full project name |
| Key | Short prefix used in ticket identifiers, e.g. `ERP` → `ERP-123` (convention from Jira/Linear). Unique, uppercase letters and digits |
| GitHub repositories | One or more linked repositories; one marked as default for new issues ([§11.2](11-github-integration.md)) |
| Default SLA policy | SLA policy for users without an organization and organizations without their own policy ([§9.3](09-sla.md)) |
| Sync direction | GitHub issue synchronization direction ([§11.5](11-github-integration.md)) |

End users always create tickets **within a specific project**, so the `project` field is set automatically and is not shown to them (Rule 2).

## 3.2 Ticket fields

| Field | Description | End user | Team |
|---|---|---|---|
| Identifier | Assigned automatically, format `KEY-number`; numbers are sequential per project and never reused | sees (read-only) | sees |
| Title | Short description of the problem/task | fills in | fills in |
| Description | GFM Markdown content ([§6.2](06-comments-notifications.md)) | fills in | fills in |
| Attachments | Files, screenshots ([§13.3](13-non-functional.md)) | optional | optional |
| Project | Project the ticket belongs to | set automatically, hidden | fills in (defaults to current project) |
| Type | `bug` / `feature` / `task` / `question` | – | fills in (completed during triage) |
| Source | `user` / `developer` / `integration` | set automatically | set automatically |
| Occurrence count | For integration tickets: how many times the same error was reported ([§12.3](12-api-webhooks-import.md)) | – | set automatically |
| Organization | Requester's organization, if any ([§7.3](07-users-organizations-permissions.md)) | set automatically, hidden | sees |
| Visibility | `only_me` / `my_organization` / `all_customers` ([§5.1](05-visibility-and-search.md)) | chooses (default `only_me`) | sees; may mark as shared ([§5.2](05-visibility-and-search.md)) |
| Priority | `low` / `normal` / `high` / `critical` | – | fills in (default `normal`) |
| Status | Internal status ([§4.1](04-ticket-lifecycle.md)) | sees the public status | changes |
| Requester | Author of the ticket | set automatically | set automatically |
| Assignee | Responsible person | – | Developer (self only) or Project manager |
| Created / updated | Timestamps | set automatically | set automatically |
| Milestone | Milestone the ticket belongs to ([§10.1](10-roadmap-gantt.md)) | sees an approximate period if the milestone is public | set by Project manager |
| Start / due date | Planned schedule ([§10.4](10-roadmap-gantt.md)) | – | set by Project manager |
| Parent ticket | The ticket this is a sub-ticket of ([§3.5](#35-sub-tickets-relations-and-labels)) | – | Developer and above |
| Relations | Blocks / blocked by, relates to, duplicate of ([§3.5](#35-sub-tickets-relations-and-labels)) | – | Developer and above |
| Labels | Project tags, e.g. `module:invoices` ([§3.5](#35-sub-tickets-relations-and-labels)) | – | Developer and above |
| GitHub links | Linked issues, branches and pull requests ([§11.3](11-github-integration.md)) | – | set automatically |
| Requester count | Number of users who clicked "I have the same problem" ([§5.6](05-visibility-and-search.md)) | – | set automatically |

"Team" means the roles Developer, Project manager and Administrator ([§7.2](07-users-organizations-permissions.md)).

## 3.3 Forms

- **End user** – simplified form: title, description, optional attachments and a small visibility switch below the description (default `only_me`, [§5.1](05-visibility-and-search.md)). Similar tickets are suggested while typing the title ([§5.6](05-visibility-and-search.md)).
- **Team** – full form with sensible defaults (current project, priority `normal`, type `task`) and a description template depending on the type ([§3.4](#34-ticket-templates)).
- **Triage** – the team completes missing fields (type, priority, assignee) of tickets from end users ([§8.3](08-team-views.md)).

## 3.4 Ticket templates

Templates structure ticket content (pattern: GitHub issue forms). They are **global for the whole system**, like statuses ([§4.1](04-ticket-lifecycle.md)), so tickets in all projects share one structure. Templates are managed by the Administrator.

### Template for end users

One universal template shown as **placeholder text inside the description field**, which disappears when the user starts typing. It adds no fields or steps (Rule 2).

| EN | PL |
|---|---|
| What happened? | Co się stało? |
| What did you expect? | Czego się spodziewałeś? |
| How can we reproduce it? | Jak możemy to powtórzyć? |

### Templates for the team

A template is bound to a **ticket type**. Choosing the type in the full form inserts a GFM structure into the description and sets default field values.

| Type | Description structure (example) | Defaults |
|---|---|---|
| `bug` | Problem description, steps to reproduce, expected and actual result, environment | priority `normal` |
| `feature` | Goal, proposed solution, acceptance criteria (task list `- [ ]`) | priority `normal` |
| `task` | Scope of work, completion criteria (task list `- [ ]`) | priority `normal` |
| `question` | Question, context | priority `low` |

Rules:

- Changing the type while the description is empty or unchanged replaces the template. If the description has been edited, the template never overwrites it.
- Templates have language versions ([§13.1](13-non-functional.md)). The placeholder and the inserted structure appear in the language of the person creating the ticket.
- Changing a template affects new tickets only.

## 3.5 Sub-tickets, relations and labels

### Sub-tickets

A large ticket (e.g. "Reporting module") can be split into smaller **sub-tickets** (pattern: GitHub sub-issues, Jira sub-tasks).

- A sub-ticket is a full ticket with its own status, assignee and dates.
- A sub-ticket belongs to the same project as its parent.
- Multi-level nesting is allowed. The system prevents cycles.
- The parent shows **progress calculated automatically** from its sub-tickets, e.g. "3 of 5". A sub-ticket counts as complete when it is in a terminal status ([§4.1](04-ticket-lifecycle.md)).
- The parent is never closed automatically. When all sub-tickets reach a terminal status, the parent's assignee receives a notification suggesting to close it.
- A sub-ticket is created directly inside the parent (title + Enter), without opening the full form (Rule 2).

### Relations

| Relation | Meaning |
|---|---|
| **Blocks / blocked by** | Ticket A must be finished before B starts. This is **the same concept as a dependency on the Gantt chart** ([§10.4](10-roadmap-gantt.md)): setting it in one place shows it in the other |
| **Relates to** | Loose association without planning impact |
| **Duplicate of** | The ticket duplicates another one (status `duplicate`, [§4.1](04-ticket-lifecycle.md)) |

- Relations are bidirectional: adding "A blocks B" automatically shows "blocked by A" in B.
- A ticket with an open "blocked by" relation is marked in the list and on the Kanban board.
- The system prevents cycles in "blocks" relations.
- Relations and sub-tickets are visible to the team only. Exception: an end user sees the link to the original ticket their ticket duplicates, if they may see it ([§5.1](05-visibility-and-search.md)).

### Labels

- Labels are defined **per project**: name, color, optional description.
- Recommended naming with group prefixes, e.g. `module:invoices`, `area:performance`.
- Developers and above assign labels and may create new ones directly while assigning (type the name + Enter), without going to settings (Rule 2).
- Editing, merging and deleting labels is done by the Project manager, to keep the label list tidy.
- Labels are visible to the team only.
- The prefixes `type:` and `priority:` are reserved for mapping type and priority to GitHub ([§11.4](11-github-integration.md)).
