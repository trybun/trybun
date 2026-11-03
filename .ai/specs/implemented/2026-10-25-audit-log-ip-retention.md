# Retention of the IP addresses of the audit log

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-10-25 |
| Plan task | `S0-21` |
| System specification sections | §13.2, §13.5, §17.2, §18.3 |
| Related issues / PRs | [#87](https://github.com/trybun/trybun/issues/87) (this task), [#86](https://github.com/trybun/trybun/pull/86) (S0-14, which found the contradiction), [#88](https://github.com/trybun/trybun/pull/88) (specification) |

## Context

The specification gives the IP addresses of the administrative audit log two retention rules:

- [§13.5](../../../docs/spec/13-non-functional.md) "Administrative audit log": entries are recorded "with author, timestamp, target and (for security events) IP address", and "the log is immutable".
- [§13.2](../../../docs/spec/13-non-functional.md) "Retention of technical records": "Security and access logs with IP addresses" are kept for **14 days**, the "Administrative audit log" for the **lifetime of the installation**.
- [§13.5](../../../docs/spec/13-non-functional.md) "Logs" and [§17.2](../../../docs/spec/17-conventions.md) "Logging and monitoring": IP addresses appear **only** in security and access logs, kept for **at most 14 days**.

S0-14 followed §13.5 "Administrative audit log". The entry `setup_token.used` stores the client IP in `audit_log_entries.ip_address` (`inet`). The trigger `audit_log_entries_immutable_rows` refuses every `UPDATE` and `DELETE`, so the IP can never be removed. Every later security event of the audit log (use of the break-glass Administrator account, revocation of tokens, data exports) adds more entries of this kind.

An IP address is personal data. The 14 days of §13.2 are the period in which it serves its purpose – investigating an attack or a misuse close to the event. The entry itself (who did what, to which record, when) is needed for the lifetime of the installation; its IP is not.

## Goals

- One retention rule for the IP addresses of the audit log, with no contradiction between §13.2, §13.5 and §17.2.
- The IP of an entry is kept for 14 days and removed afterwards; the entry itself stays for the lifetime of the installation.
- The database still refuses every other change and every deletion of an entry.
- The removal runs automatically, is idempotent and runs once regardless of the number of Worker replicas.

## Non-goals

- Backups: the database backups keep the IPs until the backup expires (default 30 days, [§13.6](../../../docs/spec/13-non-functional.md)), like every other removed personal data ([§13.2](../../../docs/spec/13-non-functional.md), "Backups – not modified").
- The retention of the other records with IP addresses (Caddy access logs, Keycloak events, rate limiting): unchanged.
- An Administrator view of the audit log: a later feature task.
- A configurable retention period: 14 days are fixed, like the other periods of §13.2.

## Considered options

| Option | Description | Assessment |
|---|---|---|
| **A. The IP expires after 14 days** (proposed) | A recurring job of the Worker sets `ip_address = NULL` on entries older than 14 days. The trigger allows exactly this change and nothing else. The entry itself is kept | One table, one statement. The only change the database allows removes data, so it cannot alter what an entry says |
| B. The IP in its own table | `audit_log_entry_ip_addresses` (entry ID, IP), rows deleted after 14 days. The entries stay strictly immutable | A second table and a join for one nullable column; the new table needs its own trigger that allows only the expiring `DELETE`, so it moves the exception rather than removing it |
| C. An exception in §13.2 and §17.2 | IP addresses kept for the lifetime of the installation in the audit log only, with a written legal basis | No code, but personal data kept without time limit, against data minimisation (GDPR Art. 5(1)(c), (e)); a legal basis the maintainer has to write and defend |
| D. No IP in the audit log | §13.5 changed: IPs only in the Keycloak events and the access logs (14 days) | The audit entry cannot be correlated with the access log by IP alone; the setup token is used before any account exists, so its IP is the only clue to who used it |

## Proposed change

### Rule

The IP address of an audit log entry is kept for **14 days** after the entry was created and is then removed (`ip_address` set to `NULL`). The entry itself is kept for the lifetime of the installation. Apart from this removal, entries are immutable.

### Database

A new migration replaces the row trigger of `audit_log_entries`:

- `DELETE` and `TRUNCATE`: still refused.
- `UPDATE`: allowed only when `ip_address` changes from a value to `NULL` and every other column is unchanged (`IS NOT DISTINCT FROM`); any other `UPDATE` is refused with the existing message (`RAISE EXCEPTION`, `P0001`, see `.ai/memory/prisma.md`).
- The trigger does not check the age of the entry (open question 2).
- The run uses the existing index on `created_at`. A partial index on the entries that still have an IP was dropped while implementing: Prisma ORM 7 models partial indexes only as a preview feature, and an index the schema does not model would be dropped by the next generated migration; the audit log holds administrative actions only, so the range scan stays small.

### Retention job

- The module `audit-log-entries` gets `audit-log-entries-worker.module.ts` with a queue `audit-log-entries` and a recurring job `audit-log-entries-ip-expiry`, registered with `upsertJobScheduler` under the same stable ID ([§17.2](../../../docs/spec/17-conventions.md), [§18.3](../../../docs/spec/18-code-patterns.md)), following the purge of the outbox (`OutboxWorkerModule`) as the reference implementation.
- It runs **every hour** (open question 1) and executes one statement:
  `UPDATE audit_log_entries SET ip_address = NULL WHERE ip_address IS NOT NULL AND created_at < now() - interval '14 days'`.
- The statement is idempotent: a second run, or a run of another replica, finds no rows. The job scheduler with a stable ID makes one run per interval regardless of the number of Worker replicas.
- The run logs the number of entries changed, never an IP ([§17.2](../../../docs/spec/17-conventions.md)).
- The run is not itself recorded in the audit log: it changes no record and would add one entry per hour; it is a technical retention step like the purge of the outbox, not an "automatic retention run" of the anonymization of §13.2.

## Changes to the system specification

| Section | Change |
|---|---|
| §13.2 "Retention of technical records" | Row "Security and access logs with IP addresses" – 14 days, including the IP addresses of the administrative audit log; row "Administrative audit log" – kept for the lifetime of the installation, its IP addresses removed after 14 days |
| §13.5 "Logs" | IP addresses appear only in security and access logs and in the security events of the administrative audit log, all with the retention of §13.2 |
| §13.5 "Administrative audit log" | The log is immutable except that the IP of an entry is removed after 14 days; the trigger allows only this `UPDATE`; the hourly retention job of the Worker removes it |
| §17.2 "Logging and monitoring" | IP addresses only in access and security logs (Caddy, Keycloak events, rate limiting) and in the security events of the audit log, kept for at most 14 days |
| §17.2 "Background jobs and scheduling" | The removal of the IPs of the audit log named among the recurring jobs |

New or changed glossary terms: none.

## Open questions

Implementation must not start until every question has an answer. The answers were approved with the specification pull request (#88).

1. How often does the retention job run? — **Answer:** every hour, like the purge of the outbox. §17.2 says "at most 14 days"; a daily run would keep an IP for up to 15 days. An hourly run keeps it for at most 14 days and 1 hour and costs one indexed statement that usually changes no row.
2. Does the trigger also check that the entry is older than 14 days? — **Answer:** no. The only change it allows removes data, which never harms privacy, and the period stays in one place (the job). Checking the age in the trigger would duplicate the constant in a migration.
3. Option A, B, C or D? — **Answer:** A.

## Acceptance criteria

- [x] §13.2, §13.5 and §17.2 state one retention rule for the IP addresses of the audit log
- [x] An entry with an IP keeps it for 14 days and has none after the next run; the entry itself remains (integration test, Testcontainers)
- [x] Every other `UPDATE` of an entry (another column, the IP changed to another value, the IP set together with another column) and every `DELETE` and `TRUNCATE` are refused by the database (integration test)
- [x] A second run changes no row; the job scheduler has one stable ID (integration test)
- [x] The run logs no IP address
- Rule 9 and user documentation and product tours: not affected (no user interface)

## Changelog

- 2026-10-25 – Created.
- 2026-10-25 – Approved (#88): option A, hourly run, no age check in the trigger.
- 2026-10-25 – Implemented; the partial index was dropped (see "Database"). Status `implemented`.
