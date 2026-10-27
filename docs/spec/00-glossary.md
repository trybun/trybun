# 00 – Glossary

Every domain term has exactly one meaning. **Use the code identifier in code** (types, database, API), spelled according to the naming conventions of each place ([§17.1](17-conventions.md)): e.g. `ticket.requester_count` is `requesterCount` in TypeScript and JSON and `requester_count` in the database. Enum values are used exactly as listed. UI labels are given in English and Polish.

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
| Account | `user` | Account / Konto | A person's account in the system; roles are stored only in the application database ([§7.4](07-users-organizations-permissions.md)) |
| Account kind | `user.kind`: `team`, `end_user` | Team / Zespół, End user / Użytkownik | Mutually exclusive kind of an account; decides sign-in method and 2FA ([§7.1](07-users-organizations-permissions.md)) |
| Account state | `user.state`: `invited`, `active`, `deactivated`, `anonymized` | Invited / Zaproszony, Active / Aktywny, Deactivated / Dezaktywowany, Anonymized / Zanonimizowany | Lifecycle of an account ([§7.4](07-users-organizations-permissions.md)) |
| Project member | `project_member`, `project_member.role` | Project member / Członek projektu | A team account with a team role (`developer`, `project_manager`) in one project ([§7.4](07-users-organizations-permissions.md)) |
| Invitation | `invitation` | Invitation / Zaproszenie | Single-use link valid 7 days that creates or extends access; targets a project role, an organization or the Administrator role ([§7.4](07-users-organizations-permissions.md)) |
| Team group | – | – | Keycloak group `team`, kept in sync by the API; members must use 2FA ([§7.4](07-users-organizations-permissions.md)) |
| Deleted user | – | Deleted user / Użytkownik usunięty | Tombstone that replaces an anonymized account in history ([§13.2](13-non-functional.md)) |
| Principal | `principal` | – | The identity a request or job acts as: a user (session or personal access token), an integration token or the system ([§18.3](18-code-patterns.md)) |
| Allowed actions | `allowed_actions` | – | Codes of the actions the principal may perform on a record, sent by the API so that the UI adapts to them ([§18.3](18-code-patterns.md)) |

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
| Shared ticket | `ticket.visibility = all_customers` | Shared / Wspólne | Ticket visible to all end users of the project; always approved by the team ([§5.2](05-visibility-and-search.md)) |
| Sharing request | `ticket.sharing_request`: `none`, `pending`, `rejected` | Sharing request / Prośba o udostępnienie | An author's request to share a ticket with all customers, awaiting team approval ([§5.1](05-visibility-and-search.md)) |
| Comment audience | `comment.audience` | – | Effective visibility of the ticket when a public comment was written; limits who sees the comment ([§5.2](05-visibility-and-search.md)) |
| Affected user | `ticket_affected_user` | Affected user / Dotknięty użytkownik | The requester or a user who clicked "I have the same problem" ([§5.6](05-visibility-and-search.md)) |
| Requester count | `ticket.requester_count` | Affected users / Liczba zgłaszających | Number of distinct affected users, derived from `ticket_affected_user` ([§3.2](03-ticket-model.md)) |
| Waiting reason | `ticket.waiting_reason`: `information`, `confirmation` | Waiting for information / Oczekuje na informacje, Waiting for confirmation / Oczekuje na potwierdzenie | Why a ticket is in `waiting_for_requester` ([§4.3](04-ticket-lifecycle.md)) |
| Edit history | `content_revision` | Edit history / Historia edycji | Previous versions of descriptions and comments, visible to the team and to the author of the text ([§6.1](06-comments-notifications.md)) |
| Redaction | – | Redact / Zredaguj | Team action that replaces content and purges its revisions, leaving a "Content redacted" (PL: „Treść zredagowana”) event ([§6.1](06-comments-notifications.md)) |
| Regression | – | Regression / Regresja | Reopening of a `done` integration ticket by a new occurrence of its fingerprint ([§12.3](12-api-webhooks-import.md)) |
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
| Attachment status | `attachment.status`: `quarantine`, `available`, `infected` | Checking… / Sprawdzanie…, –, Infected / Zainfekowany | Malware scan state of an attachment ([§13.3](13-non-functional.md)) |

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
| SLA policy version | `sla_policy_version` | – | Immutable version of a policy and its calendar, referenced by a ticket from creation ([§9.1](09-sla.md)) |
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
| Product tour progress | `product_tour_progress` | – | Per-user, server-side record that a tour version was completed or skipped ([§2.4](02-agent-rules.md)); one per person and tour, replaced when the tour ends again |
| Product tour progress status | `product_tour_progress.status`: `completed`, `skipped` | Completed / Ukończony, Skipped / Pominięty | How a person ended a version of a tour ([§2.4](02-agent-rules.md)) |
| Product tour version | `product_tour.version` | Tour version / Wersja przewodnika | Integer from 1, increased when a tour's steps change materially, so the tour starts once more ([§2.4](02-agent-rules.md)) |
| Help page | – | Help / Pomoc | A page of the user documentation in `docs/user/` for the audience `end-user`, `team` or `administrator`, shown in the help viewer at `/help` ([§2.3](02-agent-rules.md)) |
| WIP limit | – | WIP limit / Limit WIP | Optional per-project limit of cards in a Kanban column; signalled, never blocking ([§8.2](08-team-views.md)) |
| Predefined view | – | – | Saved view shipped with the system, e.g. "Unassigned" (PL: „Nieprzypisane”) or "Pending sharing approvals" (PL: „Oczekujące udostępnienia”) ([§8.1](08-team-views.md)) |

## Integrations and operations

| Term | Code identifier | UI label (EN / PL) | Definition |
|---|---|---|---|
| GitHub App | – | – | The system's GitHub integration identity ([§11.1](11-github-integration.md)) |
| Sync direction | `project.sync_direction`: `one_way`, `two_way` | One-way / Jednokierunkowa, Two-way / Dwukierunkowa | GitHub issue synchronization mode ([§11.5](11-github-integration.md)) |
| Personal access token | `personal_access_token` | Personal token / Token osobisty | API token of a team member ([§12.2](12-api-webhooks-import.md)) |
| Integration token | `integration_token` | Integration token / Token integracji | Project-level API token; acts as an integration principal, not as a user ([§12.2](12-api-webhooks-import.md)) |
| Token scope | `tickets:read`, `tickets:write`, `comments:write`, `integration:report` | – | Closed list of permissions an API token may carry ([§12.2](12-api-webhooks-import.md)) |
| Deletion request | `deletion_request`: `requested`, `completed`, `rejected` | Deletion request / Wniosek o usunięcie | A user's GDPR erasure request, handled by the Administrator within 30 days ([§13.2](13-non-functional.md)) |
| Reply domain | – | – | Domain of personal reply addresses (`TRYBUN_REPLY_DOMAIN`, default `reply.<domain>`) ([§6.3](06-comments-notifications.md)) |
| Realtime ticket | – | – | One-time, 30-second credential for opening a WebSocket connection ([§14.4](14-architecture.md)) |
| Session | – | – | Server-side web session; the cookie holds only an opaque identifier ([§14.4](14-architecture.md)) |
| Backup service | – | – | Compose service `backup` (image `ghcr.io/trybun/backup`) creating encrypted backups with restic; also run by `./trybun backup`, `restore` and `update` ([§15.10](15-deployment.md)) |
| Backup | – | Backup / Kopia zapasowa | One encrypted restic snapshot of both databases, the objects and the configuration, identified by its ID ([§15.10](15-deployment.md)) |
| Outgoing webhook | `webhook` | Webhook / Webhook | HTTP notification sent to external systems ([§12.4](12-api-webhooks-import.md)) |
| Import batch | `import_batch` | Import / Import | One run of the import wizard; can be undone ([§12.5](12-api-webhooks-import.md)) |
| Change specification | – | – | Dated description of one change (`.ai/specs/YYYY-MM-DD-slug.md`) with status `draft` → `approved` → `implemented` / `archived` ([§2.8](02-agent-rules.md)) |
| Project memory | – | – | Knowledge gained during work, kept in `.ai/memory/` with the index `MEMORY.md` ([§2.7](02-agent-rules.md)) |
| Reference implementation | – | – | The first implementation of a code pattern, listed in [§18.9](18-code-patterns.md); later code follows it (Rule 12) |
| Release candidate | – | – | Pre-release `X.Y.Z-rc.N` deployed to the test environment before a release (Rule 11) |
| Maintenance branch | – | – | `release/X.Y.x` branch for PATCH releases without new features (Rule 11) |
| SBOM | – | – | Software bill of materials attached to every release (Rule 10) |
| Cooldown | – | – | Minimum age (7 days) of a dependency version before a regular update (Rule 10) |
| Transactional outbox | `outbox_event` | – | Event stored in the same transaction as the change and published by the Worker ([§17.2](17-conventions.md)) |
| ADR | – | – | Architecture Decision Record in `docs/adr/` ([§2.14](02-agent-rules.md)) |
| Machine account | – | – | GitHub user account of the project's AI agents, with the Write role only; it pushes and opens pull requests but never approves them ([§16.5](16-open-source.md)) |
| Code owner | – | – | Human maintainer listed in `.github/CODEOWNERS` whose approval a pull request needs ([§16.3](16-open-source.md)) |
| Break-glass account | – | – | The first Administrator account with password and 2FA, usable without GitHub sign-in ([§7.4](07-users-organizations-permissions.md)) |
| BFF (Backend for Frontend) | – | – | The web application's proxy endpoint `/api/v1/*` that attaches the user's token on the server side ([§14.4](14-architecture.md)) |
| Optimistic locking | `version` | – | Conflict detection with `ETag`/`If-Match` when two people edit the same record ([§17.2](17-conventions.md)) |
| Archived | `project.state`, `organization.state`: `active`, `archived` | Active / Aktywne, Archived / Zarchiwizowane | Read-only project or organization that can no longer be changed ([§7.3](07-users-organizations-permissions.md)) |
| Resolution confirmation | `project.confirm_resolution` | – | Optional request to the requester to confirm that the problem is solved ([§4.3](04-ticket-lifecycle.md)) |
| Audit log | `audit_log_entry`; `audit_log_entry.action`: `setup_token.used` | Audit log / Dziennik zdarzeń | Immutable log of administrative actions ([§13.5](13-non-functional.md)); feature tasks add the actions they record |
| Anonymization | – | Anonymization / Anonimizacja | GDPR erasure that keeps history ([§13.2](13-non-functional.md)) |
| Deployment package | – | – | Release assets needed to install the system ([§15.4](15-deployment.md)) |
| Setup token | `setup_token` | Setup token / Token konfiguracji | One-time token protecting the first-run wizard, valid 24 hours ([§15.6](15-deployment.md)) |
| Getting-started item | `getting_started_item`: `configure_github_sign_in`, `configure_email`, `configure_backup_storage` | Configure GitHub sign-in / Skonfiguruj logowanie przez GitHub, Configure e-mail / Skonfiguruj e-mail, Configure backup storage / Skonfiguruj miejsce na kopie zapasowe | An item of the getting-started checklist of the Administrator panel, ticked automatically; later tasks add theirs ([§15.6](15-deployment.md)) |
| Administrator panel | – | Administration / Administracja | The pages of the Administrator (`/admin`): the getting-started checklist and the "About" page ([§15.6](15-deployment.md)) |
