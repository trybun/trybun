# 00 – Glossary

Every domain term has exactly one meaning. **Use the code identifier in code** (types, database, API). UI labels are given in English and Polish.

## People and access

| Term | Code identifier | UI label (EN / PL) | Definition |
|---|---|---|---|
| End user | `end_user` | End user / Użytkownik | A customer-side person who reports tickets through the portal ([§7.2](07-users-organizations-permissions.md)) |
| Developer | `developer` | Developer / Developer | Team role that handles tickets |
| Project manager | `project_manager` | Project manager / Kierownik projektu | Team role that triages and plans |
| Administrator | `admin` | Administrator / Administrator | Global role managing the system |
| Team | – | – | Developer, Project manager and Administrator together |
| Organization | `organization` | Organization / Organizacja | A customer company grouping end users ([§7.3](07-users-organizations-permissions.md)) |
| Project | `project` | Project / Projekt | Container of tickets, linked to GitHub repositories ([§3.1](03-ticket-model.md)) |
| Project key | `project.key` | Key / Klucz | Prefix of ticket identifiers, e.g. `ERP` |
| Requester | `requester` | Requester / Zgłaszający | Author of a ticket |
| Assignee | `assignee` | Assignee / Przypisany | Person responsible for a ticket |
| Watcher | `watcher` | Watcher / Obserwujący | Person receiving notifications about a ticket ([§6.4](06-comments-notifications.md)) |

## Tickets

| Term | Code identifier | UI label (EN / PL) | Definition |
|---|---|---|---|
| Ticket | `ticket` | Ticket / Zgłoszenie | The single unit of work in the system ([03-ticket-model.md](03-ticket-model.md)) |
| Ticket identifier | `ticket.identifier` | – | `KEY-number`, e.g. `ERP-123` |
| Source | `ticket.source`: `user`, `developer`, `integration` | User / Użytkownik, Developer / Developer, Integration / Integracja | Where the ticket came from |
| Type | `ticket.type`: `bug`, `feature`, `task`, `question` | Bug / Błąd, Feature / Funkcjonalność, Task / Zadanie, Question / Pytanie | Kind of ticket |
| Priority | `ticket.priority`: `low`, `normal`, `high`, `critical` | Low / Niski, Normal / Normalny, High / Wysoki, Critical / Krytyczny | Urgency |
| Internal status | `ticket.status` | see [§4.1](04-ticket-lifecycle.md) | Team workflow status |
| Public status | `public_status` | see [§4.1](04-ticket-lifecycle.md) | Simplified status shown to end users |
| Terminal status | – | – | `done`, `rejected` or `duplicate`; "closed"/"completed" means this |
| Reopen | – | Reopen / Otwórz ponownie | Moving a ticket out of a terminal status |
| Triage | – | Triage / Triage | Completing type, priority and assignee of new tickets ([§8.3](08-team-views.md)) |
| Visibility | `ticket.visibility`: `only_me`, `my_organization`, `all_customers` | Only me / Tylko dla mnie, My organization / Moja organizacja, All customers / Wszyscy klienci | Who among end users can see the ticket ([§5.1](05-visibility-and-search.md)) |
| Shared ticket | `ticket.is_shared` | Shared / Wspólne | Ticket visible to all end users of the project ([§5.2](05-visibility-and-search.md)) |
| Requester count | `ticket.requester_count` | Affected users / Zgłaszający | Users who clicked "I have the same problem" |
| Public comment | `comment.kind = public` | Comment / Komentarz | Visible to everyone who can see the ticket |
| Internal note | `comment.kind = internal` | Internal note / Notatka wewnętrzna | Visible to the team only |
| Activity timeline | `activity_event` | Activity / Aktywność | Immutable history of comments and events ([§4.5](04-ticket-lifecycle.md)) |
| Sub-ticket | `ticket.parent_id` | Sub-ticket / Podzadanie | Ticket belonging to a parent ticket ([§3.5](03-ticket-model.md)) |
| Relation | `ticket_relation`: `blocks`, `relates_to`, `duplicate_of` | Blocks / Blokuje, Relates to / Powiązane z, Duplicate of / Duplikat | Link between tickets; `blocks` = Gantt dependency |
| Label | `label` | Label / Etykieta | Project-scoped tag |
| Template | `ticket_template` | Template / Szablon | Global description structure per type ([§3.4](03-ticket-model.md)) |
| Fingerprint | `ticket.fingerprint` | – | Error identifier sent by integrations for grouping ([§12.3](12-api-webhooks-import.md)) |
| Occurrence count | `ticket.occurrence_count` | Occurrences / Wystąpienia | How many times an integration reported the same error |
| Attachment | `attachment` | Attachment / Załącznik | File attached to a ticket or comment ([§13.3](13-non-functional.md)) |

## Planning

| Term | Code identifier | UI label (EN / PL) | Definition |
|---|---|---|---|
| Milestone | `milestone` | Milestone / Kamień milowy | Group of tickets with a target date ([§10.1](10-roadmap-gantt.md)) |
| Roadmap | – | Roadmap / Roadmapa | Timeline of milestones |
| Public roadmap | – | Public roadmap / Publiczna roadmapa | Simplified roadmap for end users ([§10.3](10-roadmap-gantt.md)) |
| Gantt chart | – | Gantt chart / Wykres Gantta | Schedule of tickets with dependencies ([§10.4](10-roadmap-gantt.md)) |
| Dependency | `ticket_relation = blocks` | Dependency / Zależność | Finish-to-start relation between tickets |

## Service levels

| Term | Code identifier | UI label (EN / PL) | Definition |
|---|---|---|---|
| SLA policy | `sla_policy` | SLA policy / Polityka SLA | Time targets per priority ([§9.1](09-sla.md)) |
| Business calendar | `business_calendar` | Business calendar / Kalendarz pracy | Working hours used to count SLA time |
| First response time | `first_response` | First response / Pierwsza odpowiedź | SLA metric |
| Resolution time | `resolution` | Resolution / Rozwiązanie | SLA metric |
| SLA state | `sla_state`: `on_track`, `at_risk`, `breached`, `paused`, `met`, `missed` | see [§9.5](09-sla.md) | State of an SLA metric |

## Team tools

| Term | Code identifier | UI label (EN / PL) | Definition |
|---|---|---|---|
| Saved view | `saved_view` | Saved view / Zapisany widok | Stored set of list filters ([§8.1](08-team-views.md)) |
| Kanban board | – | Board / Tablica | Status columns view ([§8.2](08-team-views.md)) |
| Triage queue | – | Triage queue / Kolejka triage | One-by-one processing of new tickets ([§8.3](08-team-views.md)) |
| Command palette | – | Command palette / Paleta poleceń | Ctrl+K search, navigation and actions ([§8.4](08-team-views.md)) |
| Product tour | `product_tour` | Tour / Przewodnik | Interactive in-app guide (Rule 4) |

## Integrations and operations

| Term | Code identifier | UI label (EN / PL) | Definition |
|---|---|---|---|
| GitHub App | – | – | The system's GitHub integration identity ([§11.1](11-github-integration.md)) |
| Sync direction | `project.sync_direction`: `one_way`, `two_way` | One-way / Jednokierunkowa, Two-way / Dwukierunkowa | GitHub issue synchronization mode ([§11.5](11-github-integration.md)) |
| Personal access token | `personal_access_token` | Personal token / Token osobisty | API token of a team member ([§12.2](12-api-webhooks-import.md)) |
| Integration token | `integration_token` | Integration token / Token integracji | Project-level API token |
| Outgoing webhook | `webhook` | Webhook / Webhook | HTTP notification sent to external systems ([§12.4](12-api-webhooks-import.md)) |
| Import batch | `import_batch` | Import / Import | One run of the import wizard; can be undone ([§12.5](12-api-webhooks-import.md)) |
| Change specification | – | – | Dated description of one change (`.ai/specs/YYYY-MM-DD-slug.md`) with status `draft` → `approved` → `implemented` / `archived` ([§2.8](02-agent-rules.md)) |
| Project memory | – | – | Knowledge gained during work, kept in `.ai/memory/` with the index `MEMORY.md` ([§2.7](02-agent-rules.md)) |
| Release candidate | – | – | Pre-release `X.Y.Z-rc.N` deployed to the test environment before a release (Rule 11) |
| Maintenance branch | – | – | `release/X.Y.x` branch for PATCH releases without new features (Rule 11) |
| SBOM | – | – | Software bill of materials attached to every release (Rule 10) |
| Cooldown | – | – | Minimum age (7 days) of a dependency version before a regular update (Rule 10) |
| Transactional outbox | `outbox_event` | – | Event stored in the same transaction as the change and published by the Worker ([§14.8](14-architecture.md)) |
| ADR | – | – | Architecture Decision Record in `docs/adr/` ([§2.13](02-agent-rules.md)) |
| Break-glass account | – | – | The first Administrator account with password and 2FA, usable without GitHub sign-in ([§7.4](07-users-organizations-permissions.md)) |
| Audit log | `audit_log_entry` | Audit log / Dziennik zdarzeń | Immutable log of administrative actions ([§13.5](13-non-functional.md)) |
| Anonymization | – | Anonymization / Anonimizacja | GDPR erasure that keeps history ([§13.2](13-non-functional.md)) |
| Deployment package | – | – | Release assets needed to install the system ([§15.4](15-deployment.md)) |
| Setup token | – | – | One-time token protecting the first-run wizard ([§15.6](15-deployment.md)) |
