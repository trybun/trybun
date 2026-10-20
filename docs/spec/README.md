# Trybun – specification index

Specification of **Trybun**, a ticket / task management system for development teams and their customers. Read [01-overview.md](01-overview.md) first; then read only the files relevant to your task. Always check [00-glossary.md](00-glossary.md) for terms and code identifiers.

| File | Contents |
|---|---|
| [00-glossary.md](00-glossary.md) | Every domain term with its code identifier and EN/PL UI labels |
| [01-overview.md](01-overview.md) | Purpose of the system, AI Engineering approach, how to use this specification, naming conventions and brand assets |
| [02-agent-rules.md](02-agent-rules.md) | Rules 1–11 for AI agents (incl. project memory, up-to-date specification, phone/tablet support, dependency security and versioning), Definition of Done, agent workflow (branching, commit scopes, ADRs, testing approach), quality gates with coverage thresholds, tools and license policy |
| [03-ticket-model.md](03-ticket-model.md) | Projects, ticket fields, forms, templates, sub-tickets, relations, labels |
| [04-ticket-lifecycle.md](04-ticket-lifecycle.md) | Internal and public statuses, mapping, transition rules, activity timeline |
| [05-visibility-and-search.md](05-visibility-and-search.md) | What end users see, shared tickets, portal search, similar ticket detection, end-user portal |
| [06-comments-notifications.md](06-comments-notifications.md) | Public comments, internal notes, GFM editor, e-mail replies, watching, notifications |
| [07-users-organizations-permissions.md](07-users-organizations-permissions.md) | Roles, organizations, accounts and authentication, permission matrix |
| [08-team-views.md](08-team-views.md) | List and saved views, Kanban board, triage queue, command palette, global search |
| [09-sla.md](09-sla.md) | SLA policies, business calendars, time counting, warnings, reports |
| [10-roadmap-gantt.md](10-roadmap-gantt.md) | Milestones, internal and public roadmap, Gantt chart |
| [11-github-integration.md](11-github-integration.md) | GitHub App, linking code to tickets, creating issues, issue sync, privacy |
| [12-api-webhooks-import.md](12-api-webhooks-import.md) | Public REST API, tokens, integration tickets and error grouping, outgoing webhooks, data import |
| [13-non-functional.md](13-non-functional.md) | Internationalization, GDPR, attachments, accessibility, security, backups |
| [14-architecture.md](14-architecture.md) | Components, technology stack, rationale, architectural principles, alternatives, monorepo structure |
| [15-deployment.md](15-deployment.md) | Docker Compose deployment on any Linux VPS, releases, install, first run, updates, backups, local development environment |
| [16-open-source.md](16-open-source.md) | MIT license, community files, contribution rules (DCO, AI-assisted contributions), repository security, voluntary funding |
| [17-conventions.md](17-conventions.md) | Code naming conventions; data and integration conventions: IDs, dates, deletion, concurrency, outbox, errors, logging, dependency failures, migrations |

## Change specifications

New functionality and changes of behavior start with a dated change specification in `.ai/specs/` (`YYYY-MM-DD-slug.md`), approved through its own pull request; implemented specifications move to `.ai/specs/implemented/` ([§2.8](02-agent-rules.md)). This folder (`docs/spec/`) remains the system specification and the source of truth.

## Project memory

Knowledge gained during work (pitfalls, non-obvious behavior, proven solutions) is kept in `.ai/memory/` with the index `.ai/memory/MEMORY.md` ([§2.7](02-agent-rules.md)). It never overrides this specification.

## Implementation plan

The staged implementation plan is in [`docs/plan/implementation-plan.md`](../plan/implementation-plan.md). It delivers the **MVP (Minimum Viable Product)** in its first stages (0 and 1); later stages extend the working system.
