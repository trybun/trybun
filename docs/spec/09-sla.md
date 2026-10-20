# 09 – SLA (service level agreements)

An SLA defines the maximum handling times for tickets resulting from agreements with customers. Model based on Zendesk and Jira Service Management.

## 9.1 SLA policy

An SLA policy is a named set of time targets per priority. It has two metrics:

- **First response time** – from ticket creation to the first public comment by a team member.
- **Resolution time** – from ticket creation to a terminal status (`done`, `rejected`, `duplicate`).

Example policy (illustrative values):

| Priority | First response | Resolution |
|---|---|---|
| `critical` | 1 h | 8 h |
| `high` | 4 h | 2 business days |
| `normal` | 1 business day | 5 business days |
| `low` | 2 business days | 10 business days |

Each policy references a **business calendar** ([§9.2](#92-business-calendar)) used to count time. Policies are managed by the Administrator.

## 9.2 Business calendar

- Working days and hours, e.g. Monday–Friday 8:00–16:00.
- Time zone (default `Europe/Warsaw`).
- Holidays, e.g. public holidays.
- A 24/7 calendar is possible for round-the-clock support agreements.

SLA time runs only during the working hours of the referenced calendar.

## 9.3 Policy assignment

- An SLA policy can be assigned to an **organization** ([§7.3](07-users-organizations-permissions.md)).
- A project has a **default policy** for users without an organization and organizations without their own policy ([§3.1](03-ticket-model.md)).
- Precedence: organization policy → project default policy → no SLA.
- SLA applies only to tickets with source `user`. Team tickets and integration tickets are not subject to SLA.

## 9.4 Time counting rules

- The clock is **paused** while the ticket is in `waiting_for_requester` and resumes when the requester replies.
- Changing the priority recalculates deadlines with the new priority's targets, counted from ticket creation.
- Reopening a ticket ([§4.3](04-ticket-lifecycle.md)) resumes the resolution clock from the value at which it stopped.
- Changing a policy or calendar affects new tickets only. Existing tickets keep the deadlines calculated at creation.

## 9.5 Presentation and warnings

| State | Code | Condition | Indication |
|---|---|---|---|
| On track | `on_track` | less than 75% of time used | neutral |
| At risk | `at_risk` | at least 75% of time used | warning (e.g. orange + icon) |
| Breached | `breached` | deadline passed | alert (e.g. red + icon) |
| Paused | `paused` | status `waiting_for_requester` | pause icon |
| Met / missed | `met` / `missed` | metric finished | recorded in the activity timeline |

Where it is shown (Rule 2 – information where decisions are made):

- **Ticket**: countdown to the nearest deadline, with the metric name.
- **List** ([§8.1](08-team-views.md)): column with the nearest SLA deadline, sorting and the predefined view "SLA at risk".
- **Kanban board** ([§8.2](08-team-views.md)): SLA state badge on the card.
- **Triage queue** ([§8.3](08-team-views.md)): default ordering by the nearest SLA deadline.

The assignee and the Project manager are notified when an SLA is at risk or breached ([§6.6](06-comments-notifications.md)).

SLA deadlines are **visible to the team only**. End users do not see them, so a countdown in the UI does not become a source of disputes about contract interpretation.

## 9.6 Reports

- Percentage of met SLA targets by organization, project, priority and period.
- Average first response and resolution times.
- List of tickets with breached SLA.

Charts in reports use Recharts ([§14.2](14-architecture.md)).

Reports are available to the Project manager and the Administrator and can serve as a basis for settlements with customers.
