# 17 – Conventions

Code naming and data/integration conventions that apply to every part of the system. Architecture and technology choices are in [14-architecture.md](14-architecture.md), code design patterns in [18-code-patterns.md](18-code-patterns.md).

## 17.1 Code naming conventions

Naming follows the conventions of each technology in the stack (Rule 1). Domain terms always use the code identifiers from the [glossary](00-glossary.md); product-related identifiers follow [§1.4](01-overview.md). All identifiers are in English (Rule 5).

The glossary gives the **domain name** of every term and its **enum values**. The name is spelled according to the table below in each place: e.g. the glossary identifier `ticket.requester_count` is `requesterCount` in TypeScript and JSON and `requester_count` in the database; `activity_event` is the Prisma model `ActivityEvent` and the table `activity_events`. Enum values are used exactly as listed in the glossary.

| Element | Convention | Example |
|---|---|---|
| Variables, functions, methods | camelCase; booleans start with `is`, `has`, `can` or `should` | `assignTicket()`, `isShared` |
| Classes, types, interfaces, React components | PascalCase; interfaces without an `I` prefix | `TicketVisibility`, `StatusBadge` |
| Module-level constants | UPPER_SNAKE_CASE | `MAX_ATTACHMENT_SIZE` |
| Files and folders | kebab-case; NestJS files with their role suffix (NestJS convention); Next.js route segments in kebab-case | `ticket-list.tsx`, `tickets.service.ts`, `app/saved-views/` |
| NestJS classes | Plural resource + role | `TicketsModule`, `TicketsService`, `TicketsController` |
| DTOs | Action + resource + `Dto`: the type inferred from the request schema in `@trybun/contracts`; no DTO classes ([§14.4](14-architecture.md#144-architectural-principles)) | `type CreateTicketDto = z.infer<typeof createTicketSchema>` |
| Zod schemas and inferred types | Schema in camelCase with the `Schema` suffix; type in PascalCase via `z.infer` | `ticketSchema` → `type Ticket` |
| Prisma models | PascalCase, singular; fields in camelCase | `model Ticket { createdAt DateTime }` |
| PostgreSQL tables and columns | snake_case; tables in plural; mapped from Prisma with `@@map` and `@map` | `tickets`, `created_at` |
| Enum values (code, database, API) | The glossary codes in snake_case | `in_progress`, `only_me` |
| REST API paths | Plural nouns in kebab-case; no verbs, actions as sub-resources | `/api/v1/tickets/{id}/comments`, `/api/v1/saved-views` |
| JSON fields and query parameters | camelCase | `{ "requesterCount": 3 }`, `?sortBy=createdAt` |
| Webhook and internal events | `resource.event` in snake_case | `ticket.status_changed` |
| Error codes | `resource.reason` in snake_case | `ticket.visibility_not_allowed` |
| Queue names and job names | kebab-case | `github-webhooks`, `sla-timers` |
| Job IDs and deduplication keys | Custom job ID: the unique ID of the source (e.g. the outbox event ID); deduplication key: `<job-name>-<id>[-<id>]`; never `:` and never digits only ([§17.2](#172-data-and-integration-conventions)) | `notification-batch-<recipientId>-<ticketId>` |
| Translation keys | Dot-separated namespaces in camelCase, starting with the feature; error messages use `errors.<error code>` with the code unchanged | `tickets.form.titleLabel`, `errors.ticket.visibility_not_allowed` |
| Environment variables | UPPER_SNAKE_CASE with the `TRYBUN_` prefix ([§1.4](01-overview.md)); library-defined names stay unchanged ([§15.3](15-deployment.md)) | `TRYBUN_DOMAIN`, `DATABASE_URL` |
| Design tokens / Tailwind theme | kebab-case | `--color-ink`, `bg-ink` |
| Tests | `*.spec.ts` / `*.spec.tsx` next to the tested file; integration tests `*.integration.spec.ts` ([§18.7](18-code-patterns.md)); E2E tests in the application's `e2e/` folder | `visibility.spec.ts`, `tickets.service.integration.spec.ts`, `apps/web/e2e/create-ticket.spec.ts` |
| Product tour targets | `data-tour="<view>-<element>"` in kebab-case (Rule 4) | `data-tour="kanban-column-menu"` |

### Database naming

The code follows TypeScript conventions (camelCase) and the database follows PostgreSQL conventions (snake_case). Prisma maps between them, so:

- every Prisma model has `@@map("<plural_snake_case>")` and every multi-word field has `@map("<snake_case>")`,
- raw SQL queries ([§14.4](14-architecture.md#144-architectural-principles)) use the snake_case names and never need quoted identifiers,
- primary keys are named `id`, foreign keys `<entity>_id` (`requester_id`), timestamps `created_at`, `updated_at`.

### Enforcement

The conventions are enforced in CI by `@trybun/eslint-config` ([§14.6](14-architecture.md#146-monorepo-structure)): `@typescript-eslint/naming-convention` for identifiers and a file-name rule for files and folders. A check of the Prisma schema verifies that every model and multi-word field has its database mapping.


## 17.2 Data and integration conventions

### Identifiers

- Primary keys are **UUIDv7**, generated by the application: unique without coordination and time-ordered, which keeps indexes efficient.
- The human-readable ticket identifier `KEY-number` ([§3.2](03-ticket-model.md)) is a separate field and is never used as a primary or foreign key.

### Dates and times

- All timestamps are stored as `timestamptz` in UTC and exchanged in the API as ISO 8601 strings in UTC (e.g. `2026-11-03T09:15:00Z`).
- Dates without time (e.g. a milestone's target date) are stored as `date` and exchanged as `YYYY-MM-DD`.
- Conversion to the user's time zone and locale happens only in the presentation layer (web, e-mails) ([§13.1](13-non-functional.md)). SLA calculations use the time zone of the business calendar ([§9.2](09-sla.md)) and `date-fns` with `@date-fns/tz` ([§14.2](14-architecture.md)).

### Deleting data

- Tickets are never deleted; they are closed as `rejected` or `duplicate` ([§4.3](04-ticket-lifecycle.md)). Personal data is removed only through anonymization ([§13.2](13-non-functional.md)).
- **The only exception** is undoing an import batch ([§12.5](12-api-webhooks-import.md)), possible only while no ticket of the batch has activity events other than "Imported": the tickets of the batch are deleted physically, together with the accounts the batch created that have no other activity and the batch's external-ID records. Their ticket numbers are not reused. The undo is recorded in the administrative audit log.
- Other records (e.g. labels, saved views, webhooks) are deleted physically; the deletion is recorded in the activity timeline or the administrative audit log.
- Activity events never reference deletable records by foreign key; they store the values they show (ID and display name, e.g. of a label or milestone) in their own data, so deleting a record never changes or breaks the history ([§4.5](04-ticket-lifecycle.md)).
- There is no generic soft-delete (`deleted_at`) mechanism.

### Transactions and events

- Changes that span several records are performed in one database transaction.
- Side effects (notifications, webhooks, GitHub synchronization, search indexing) use the **transactional outbox** pattern: the event is written to an `outbox_events` table in the same transaction as the change, and the Worker publishes it to the queue. No event is lost when a process stops between the change and the publication, and no event is published for a change that was rolled back.
- **Outbox publisher**: the Worker polls `outbox_events` about once per second with `SELECT … FOR UPDATE SKIP LOCKED` (safe with several Worker replicas), enqueues each event in BullMQ with `jobId` equal to the outbox event ID (so a repeated publication creates no second job while the first one is kept, see "Background jobs and scheduling"), sets `published_at`, and deletes published events after 7 days.
- Event handlers are idempotent, because events may be delivered more than once.

### Background jobs and scheduling

- All delayed and recurring work runs in the Worker on **BullMQ** ([§14.2](14-architecture.md)):
  - recurring jobs (e.g. retention anonymization, GitHub delivery reconciliation, purging old records) use BullMQ job schedulers (`upsertJobScheduler` with a stable scheduler ID), so each run happens once regardless of the number of Worker replicas;
  - timers (e.g. SLA deadlines, automatic closing after resolution confirmation, [§4.3](04-ticket-lifecycle.md)) and notification batching ([§6.7](06-comments-notifications.md)) are delayed jobs deduplicated by a key derived from the subject (e.g. `notification-batch-<recipientId>-<ticketId>`) in BullMQ's debounce mode (`replace`, `extend`), so rescheduling replaces the pending job instead of adding a second one. A timer job carries only identifiers; its handler reads the current state and does nothing when the timer no longer applies (e.g. the ticket has left `waiting_for_requester`), so timers are never cancelled. The delay of a notification batch is computed from the first pending change, which keeps the 10-minute limit of [§6.7](06-comments-notifications.md);
  - work that must be enqueued only once (outbox events, outgoing webhook deliveries) uses a custom `jobId` equal to the unique ID of its source; BullMQ ignores a second job with the same ID while the first one is kept.
- Job IDs and deduplication keys never contain `:` (reserved by BullMQ) and never consist of digits only ([§17.1](#171-code-naming-conventions)).
- **Retention**: completed jobs are removed after 24 hours; failed jobs are kept for 30 days and are visible to the Administrator ([§13.2](13-non-functional.md)).
- Jobs that fail are retried with exponential backoff; after the last attempt they stay in the failed set. A failed job is retried manually with `job.retry()` – a new job with the same ID would be ignored. A manual redelivery of an outgoing webhook ([§12.4](12-api-webhooks-import.md)) creates a new delivery with its own ID.

### Concurrency

- **Ticket numbers** are allocated from a per-project counter incremented inside the ticket-creation transaction with a row lock, so numbers are unique and never reused even under concurrent creation. Numbers are consecutive except for tickets removed by undoing an import (see "Deleting data").
- **Optimistic locking** protects records edited by people:
  - Versioned records: tickets, comments (including internal notes), milestones, labels, saved views, organizations, projects, SLA policies, business calendars, ticket templates and webhooks. Each has a `version` field.
  - The API returns the version as a weak `ETag` (`W/"<version>"`). `PATCH`, `PUT` and `DELETE` of a versioned record must send `If-Match`; a missing header (or `*`, which would match any version) returns `428 Precondition Required` (code `request.precondition_required`), a stale one – or a value that is not the ETag of a version – `412 Precondition Failed` (code `request.precondition_failed`), and the UI shows "This item was changed by someone else – reload to see the latest version" (PL: „Ten element został zmieniony przez kogoś innego – odśwież, aby zobaczyć najnowszą wersję”).
  - The ticket's `version` covers only the ticket's own fields (title, description, type, priority, status, assignee, milestone, dates, visibility, parent). Child records – comments, attachments, labels assigned, watchers, relations, "I have the same problem" – are separate resources and do not change the ticket's `version`.
  - Automatic changes by the system (e.g. GitHub, the requester-reply status return, SLA, occurrence counts, automatic closing) do not send `If-Match` but do increase `version`, so a person editing at the same time gets a conflict instead of overwriting them.
  - **Bulk actions** ([§8.1](08-team-views.md)) send `[{id, version}]` for at most 100 records. Each record is changed in its own transaction, and the response lists the result per record (`200`, `404`, `412`), so the UI can report the records that were not changed.
  - Kanban columns have no manual card order ([§8.2](08-team-views.md)); moving a card changes only its status.

### Errors

- A record the user is not allowed to see returns **`404 Not Found`, never `403`**, so the existence of tickets, projects or organizations is not disclosed (ticket identifiers are sequential). `403` is used only for actions on records the user can see.
- **Order of checks**: the visibility check (404) runs first, for the target record and for every record referenced in the request (e.g. the original ticket of a `duplicate`, a relation target, a milestone). Validation (`422`), preconditions (`412`, `428`), conflicts and `Idempotency-Key` replays are evaluated only afterwards, so their responses never reveal whether an invisible record exists.
- The whole API (public and internal) returns errors in the *Problem Details* format (RFC 9457, media type `application/problem+json`) with a stable, documented error `code` (e.g. `ticket.visibility_not_allowed`). The `type` member is `about:blank` until the project domain is confirmed ([§1.4](01-overview.md)), then `https://<domain>/problems/<code>`; `title` is the HTTP reason phrase of RFC 9110.
- The error codes form one closed list in `@trybun/contracts/errors`, which also defines the HTTP status of each code. Feature tasks add the codes of their rules; the codes shared by every endpoint are:

| Code | Status | Meaning |
|---|---|---|
| `request.malformed` | 400 | The body is not valid JSON |
| `authentication.required` | 401 | No valid access token or API token, or no active account for it ([§14.4](14-architecture.md)) |
| `authentication.second_factor_required` | 401 | A team member whose sign-in did not complete 2FA ([§7.4](07-users-organizations-permissions.md)) |
| `request.forbidden` | 403 | An action the principal may not perform on a record they can see |
| `request.not_found` | 404 | A missing route, or a record that does not exist or that the principal may not see |
| `request.precondition_failed` | 412 | A stale `If-Match` (see "Concurrency") |
| `request.too_large` | 413 | The body exceeds the size limit |
| `request.validation_failed` | 422 | Invalid input (see below) |
| `request.precondition_required` | 428 | A change of a versioned record without `If-Match` |
| `request.rate_limited` | 429 | More requests than the rate limit of the principal or the client IP allows ([§14.4](14-architecture.md)) |
| `server.internal_error` | 500 | An unexpected error; the response carries no details and the error is logged with the request ID |
| `server.unavailable` | 503 | PostgreSQL is unavailable (see "Dependency failures") |
- The web application translates error codes into messages in the user's language (translation key `errors.<code>`, [§17.1](#171-code-naming-conventions)); raw server messages are never shown to users.
- Validation errors return `422` with the code `request.validation_failed` and list the invalid fields in an `errors` member (`[{ "pointer": "/title", "code": "string.too_long" }]`, JSON Pointer to the field), so forms can show them next to the fields. Field error codes are `<kind>.<reason>` from a closed list, chosen by the failing schema rule; a new code is added to this list and to `@trybun/contracts/problem-details`:

| Code | Schema rule |
|---|---|
| `string.too_long` / `string.too_short` | Maximum / minimum length of a string |
| `string.invalid_format` | Format of a string (e-mail, URL, UUID, pattern, …) |
| `array.too_long` / `array.too_short` | Maximum / minimum number of items |
| `number.too_large` / `number.too_small` | Maximum / minimum of a number |
| `date.too_late` / `date.too_early` | Latest / earliest date |
| `field.invalid_type` | A value of the wrong type, including a missing required field |
| `field.invalid_value` | A value outside the allowed values (e.g. an enum) |
| `field.unrecognized` | A field the schema does not know |
| `field.invalid` | Any other rule (e.g. a custom refinement) |

- The web application translates field error codes like error codes (`errors.<code>`, e.g. `errors.string.too_long`).

### Logging and monitoring

- Logs are structured JSON (`nestjs-pino`) on standard output with level, time, request ID and, for jobs, job ID; the level is set with `TRYBUN_LOG_LEVEL` (default `info`). The request ID is returned in the `X-Request-Id` header and passed to Worker jobs:
  - The API keeps an `X-Request-Id` sent by the caller (the web application) when it has 1–64 letters, digits, `_` or `-`; otherwise it generates a UUID.
  - An outbox event stores the request ID of the request (or job) that wrote it; the job of the event carries it in its data, and every line its handler logs carries it with the job ID.
  - Each completed request is logged once with the method, the route template, the status and the response time; health checks are not logged. Errors are logged with their type, code and stack frames, without their message, which may quote personal data.
- **What logs may contain**:
  - Allowed: pseudonymous IDs (UUIDs of users, tickets, projects, organizations, tokens), error codes, HTTP method, route template and status.
  - IP addresses only in access and security logs (Caddy, Keycloak events, rate limiting), kept for at most **14 days**.
  - Never: names, e-mail addresses, ticket or comment content, search text, tokens, passwords, secrets or cookies ([§13.2](13-non-functional.md)).
- **No secrets or search text in URLs**, because URLs end up in access logs, browser history and `Referer` headers: setup and invitation tokens are submitted in the request body (or the URL fragment, which is never sent to the server), and the search query of the global search ([§8.5](08-team-views.md)) is kept in client state and sent in the request body. Caddy access logs record paths without query strings and never log the `Authorization` or `Cookie` headers ([§15.9](15-deployment.md)).
- **Health endpoints** of the API (internal network only, [§14.4](14-architecture.md)):
  - `/health` – liveness: returns `{ "status": "ok", "version": "X.Y.Z" }` without checking dependencies, so an outage of a dependency never makes Compose restart the API (Rule 11, [§2.11](02-agent-rules.md)).
  - `/health/ready` – readiness: fails only when PostgreSQL is unavailable (`503`, code `server.unavailable`); the status of Valkey and the object storage is reported in the body as `ok` or `degraded` without failing the check (see "Dependency failures"), e.g. `{ "status": "degraded", "database": "ok", "valkey": "degraded" }`; `status` is `degraded` when any of them is. A check that does not answer within 2 seconds counts as failed. The object storage joins the body with its adapter (S1-08).
  - The web application has its own liveness endpoint `/api/health`.
  - The Worker has no HTTP server ([§14.6](14-architecture.md)); it writes a heartbeat file every 15 seconds, and its Compose health check fails when the file is older than 60 seconds.

### Dependency failures

| Unavailable | Behaviour |
|---|---|
| Keycloak | No new sign-ins; existing sessions work until their access token cannot be refreshed; API tokens keep working |
| SMTP / e-mail provider | Outgoing e-mails stay in the outbox and are retried with exponential backoff; the Administrator panel shows a warning |
| ClamAV | Uploaded files stay in quarantine ("Checking…") until the scanner is back; nothing is released unscanned |
| Object storage | Uploads and downloads fail with a clear message; the rest of the system works; `/health/ready` reports `degraded` |
| GitHub | Outgoing changes are retried with exponential backoff. GitHub does **not** redeliver failed webhook deliveries automatically, so a recurring Worker job lists the failed deliveries of the GitHub App through the GitHub API and requests their redelivery; duplicates are skipped by the delivery ID ([§11.1](11-github-integration.md)). The Administrator can also start a manual resynchronization of a repository |
| Valkey | Background jobs and real-time updates pause; the web UI and API keep working with reduced functionality; jobs resume from the outbox; API rate limiting fails open; `/health/ready` reports `degraded` |
| PostgreSQL | The system is unavailable; `/health/ready` reports the failure |


### Migrations

- Database migrations are created with Prisma Migrate, named in snake_case describing the change (e.g. `add_ticket_visibility`), and are forward-only.
- A migration that would lose data is split into compatible steps or marked as a breaking change (Rule 11).
- Database objects that Prisma does not model (e.g. the `polish` text search configuration, pgvector indexes, partial unique indexes) are created in migrations with SQL.
