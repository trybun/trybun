# 11 – GitHub integration

Based on patterns used by Linear and Jira. Two pillars: **linking code to tickets** (the basis) and **issue synchronization** (optional, configured per project).

## 11.1 Technical layer (Rule 1)

- **Authentication:** a GitHub App installed on an organization or account, with access only to selected repositories and the minimum set of permissions. No personal access tokens (PAT).
- **Incoming events:** GitHub webhooks.
  - Verify the `X-Hub-Signature-256` signature of every request.
  - Respond immediately and process the event in a background queue ([§14.1](14-architecture.md)).
  - Idempotency: the delivery identifier (`X-GitHub-Delivery`) is stored and repeated deliveries are skipped.
- **Outgoing changes:** GitHub API (REST/GraphQL), respecting rate limits, with retries and exponential backoff.
- **Loop protection:** events caused by the system's own GitHub App are ignored.
- The integration (installing the app, linking repositories) is configured by the Administrator.

## 11.2 Project repositories

- A project can have **multiple repositories** (e.g. separate frontend and backend).
- Code linking works in all linked repositories.
- One repository is the **default** for new issues. Another can be chosen when creating an issue.
- **Unlinking a repository**: existing links to issues, branches and pull requests stay in the tickets as plain links, synchronization stops, and an event is added to the activity timeline of the affected tickets.

## 11.3 Linking code to tickets

Branches, commits and pull requests are linked to a ticket when their name, title or description contains the ticket key, e.g. `ERP-123-fix-login`.

- The ticket offers a **"Copy branch name"** action that generates a name following the convention (key + shortened title in kebab-case).
- Linked branches and pull requests, with their state, are shown in the ticket (team only).
- Automatic status changes:

| GitHub event | Ticket status change |
|---|---|
| Branch created or PR opened with the ticket key | `todo` → `in_progress` |
| PR merged | → `in_verification` |
| PR closed without merge | no change (event in the activity timeline, [§4.5](04-ticket-lifecycle.md)) |

Automatic changes never move a ticket out of a terminal status.

## 11.4 Creating issues from tickets

- The **"Create issue"** action in a ticket opens a preview with pre-filled fields. The developer reviews and edits the content if needed, then confirms with one click.
- Field mapping:

| Ticket field | Issue field |
|---|---|
| Title | Title (prefixed with the key, e.g. `[ERP-123]`) |
| Description | Body (GFM, no conversion) |
| Type, priority | Labels, e.g. `type:bug`, `priority:high` |
| Labels | Labels with the same name (created in the repository if missing) |
| Parent ticket / sub-tickets | GitHub sub-issues |
| Milestone | Milestone |
| Assignee | Assignee (if the account has a linked GitHub login, [§7.4](07-users-organizations-permissions.md)) |

- The ticket stores the issue link and the issue contains a link back to the ticket.

## 11.5 Issue synchronization

The sync direction is set **per project** (pattern: Linear):

- **One-way (default):** changes from GitHub flow into the system. An issue created directly in a linked repository creates a ticket with source `developer` and status `todo`.
- **Two-way:** additionally, changes in the ticket (title, description, labels, assignee, status) update the issue. Comments on the issue written by GitHub users who are not team members are imported as **internal notes** marked with the GitHub author, never as public comments.

Status mapping (issues have only open/closed states):

| GitHub | System |
|---|---|
| Closed as "completed" | `in_verification` |
| Closed as "not planned" | `rejected` |
| Reopened | `todo` |

| System | GitHub (two-way sync only) |
|---|---|
| `done` | Closed as "completed" |
| `rejected`, `duplicate` | Closed as "not planned" |
| Reopened ticket | Reopened |

## 11.6 Privacy and GDPR

GitHub is an external data processor, and comments in a public repository are public. Therefore:

- **Internal notes are never synchronized** to GitHub.
- Only comments of team members are synchronized, never comments of end users.
- Personal data of the requester (name, e-mail) is never transferred to an issue.
- The description of a ticket from an end user goes to an issue only through the preview approved by a developer, who can remove sensitive data (e.g. from screenshots).
