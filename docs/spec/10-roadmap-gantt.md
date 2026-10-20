# 10 – Roadmap and Gantt chart

Planning is managed by the Project manager; Developers have read-only access ([§7.5](07-users-organizations-permissions.md)).

## 10.1 Milestones

The roadmap is based on **milestones**, following the GitHub and GitLab convention. Each milestone belongs to one project.

| Field | Description |
|---|---|
| Name | E.g. "v2.0", "Reporting module" |
| Description | Goal of the milestone (GFM, internal) |
| Target date | Planned completion date |
| Tickets | Tickets assigned to the milestone (each ticket belongs to at most one milestone) |
| Progress | Calculated automatically: tickets in a terminal status / all tickets, e.g. "12 of 20" |
| State | `planned` / `in_progress` / `completed` |
| Public | Whether the milestone appears on the public roadmap |
| Public description | Short, non-technical description shown to end users (EN and PL) |

State changes automatically: to `in_progress` when the first ticket reaches `in_progress`, and to `completed` when all tickets are in a terminal status. The Project manager can change it manually.

A ticket is added to a milestone from the ticket, with a bulk action in the list ([§8.1](08-team-views.md)), or by dragging it on the roadmap view.

**Deleting a milestone**: the Project manager can delete a milestone. Its tickets lose the milestone (`milestone = none`) with an event in their activity timeline ([§4.5](04-ticket-lifecycle.md)); the GitHub milestone is not changed.

**GitHub**: a milestone maps to a GitHub milestone of the same name in each linked repository ([§11.2](11-github-integration.md)). The GitHub milestone is created on demand, when the first issue of that milestone is created or synchronized in a repository, and is matched by name ([§11.4](11-github-integration.md)).

## 10.2 Internal roadmap

- Timeline of the project's milestones, with a progress bar for each.
- Expanding a milestone shows its tickets with their statuses.
- Milestones at risk are highlighted: the milestone is not `completed` and either its target date has passed, or the target date is at most 14 days away and progress is below 50%.

## 10.3 Public roadmap

A simplified version for end users that reduces "when will it be ready?" questions:

- shows only milestones marked as **public**,
- shows an **approximate period** instead of an exact date, e.g. "Q2 2027" / „II kwartał 2027” (best practice for public roadmaps: no promises for a specific day),
- shows the public description and state, without task details,
- lists only tickets with source `user` that the viewer may see ([§5.1](05-visibility-and-search.md)).

In a ticket view, the end user sees "Planned: Q2 2027" (PL: „Planowane: II kwartał 2027”) if the ticket belongs to a public milestone.

Releases and deployments of the customer's software are **out of scope** of the system. End users learn about delivery through the public status `resolved` ([§4.2](04-ticket-lifecycle.md)) and the state of the public milestone.

## 10.4 Gantt chart

Visualizes how work is distributed over time. On phones the chart is read-only and scheduling is done through ticket fields; tablets support full touch editing (Rule 9, [§2.9](02-agent-rules.md)). The chart shows the project's tickets grouped by milestone.

### Implementation

- The chart uses **SVAR React Gantt**, open-source MIT edition only ([§14.2](14-architecture.md)).
- Scheduling logic is part of the domain and lives in the API: shifting dependent tickets, computing parent summary bars, cycle prevention and warnings. The chart only displays the result and sends the user's changes to the API.
- The "Unscheduled" panel is a project component in `@trybun/ui` (a list with drag sources), not a feature of the chart library.

### Chart elements

- A bar per ticket from start date to due date, with the assignee and a color based on status (plus a text/icon indicator, [§13.4](13-non-functional.md)).
- Milestones as markers on the time axis at their target date.
- A "today" line.
- Zoom levels: day / week / month / quarter.

### Dependencies

- A dependency on the chart is the **"blocks / blocked by"** relation ([§3.5](03-ticket-model.md)). It is one concept in the system, visible both in the ticket and on the chart.
- Supported type: **finish-to-start** (B starts after A finishes), the most common in practice.
- Moving ticket A automatically moves the tickets that depend on it.
- The system prevents circular dependencies.
- Dependencies are created by dragging a connector between bars, or in the ticket.

### Sub-tickets on the chart

- A parent ticket is shown as a **summary bar** spanning from the earliest start to the latest end of its sub-tickets (convention of scheduling tools).
- Sub-tickets can be collapsed and expanded under their parent.

### Display modes

A **"Show unscheduled"** toggle (PL: „Pokaż niezaplanowane”), available to all team roles:

- **Off by default**: the chart shows only tickets with dates, so it stays readable with many tickets.
- **On**: an "Unscheduled" panel appears next to the chart with open tickets without dates, grouped by milestone. Dragging a ticket from the panel onto the timeline assigns its dates (pattern: GitHub Projects and planning tools). A keyboard/menu alternative exists ([§13.4](13-non-functional.md)).
- The toggle state is remembered per user.

### Warnings

- Overlapping tickets of the same assignee are highlighted.
- Tickets whose due date is after the milestone's target date are highlighted.
- Overdue tickets that are not in a terminal status are highlighted.

### Permissions

Developers can view the chart (including the display toggle). Scheduling and editing on the chart is reserved for the Project manager.
