# Execution plan — implement attachments, phases 1–3 (S1-08)

Source doc: .ai/specs/2026-10-26-attachments.md
Spec PR: #119 (merged, design only)
Plan task: `S1-08`

## 🎯 Goal

Build phases 1–3 of the approved change specification (Q1: phase 4, the backup of an external storage, ships as its own PR): the object storage and ClamAV adapters with their configuration, the attachments module of the API (upload into quarantine, scan, move, EXIF stripping, recovery, purge, reconciliation, content, list, link, delete, activity events), the `@trybun/ui` attachment components, the web feature wired into the portal's ticket form and view, and the user documentation – including the approved answers of `.ai/specs/2026-10-25-attachment-serving.md` and ADR 0008.

## Scope

- Server: `platform/config` (variables of Q2, Q3, `TRYBUN_CLAMAV_URL`), `platform/storage/`, `platform/clamav/`, `/health/ready`, module `modules/attachments/` (Prisma model and migration, abilities and record descriptor, controller, service, storage engine, jobs and processors), `tickets` (`add_attachment`, `ticketReadConditions`, `attachmentIds` at creation), `activity-events` (attachment events, end-user data), `users` (`lockForUpdate` for the draft quota).
- Contracts: `@trybun/contracts/attachments`, ticket and activity-event schemas, error codes and translations.
- Compose (`x-server` variables, `api` on `outbound`, `web` gets the size limit, `docker/clamav/clamd.conf`), `.env.example` (commented defaults).
- UI: `AttachmentList`, `AttachmentItem` with stories.
- Web: `features/attachments/` (queries, mutations, `useAttachmentDrafts`, `AttachmentDrafts`, `TicketAttachments`), BFF `content-length`, portal `NewTicketForm`, `TicketView` and timeline, E2E.
- User documentation EN/PL, `pnpm help:generate`, `pnpm api:generate`.
- System specification sections of the spec's "Changes to the system specification" table that phases 1–3 make true, ADR 0008 amendments (Q10, Q21), plan S1-15 row, project memory.

## Non-goals

- Phase 4: the backup and restore of the storage folder, the server-ID guard, the restore test changes, the external-storage documentation in `INSTALL.md` (Q1, Q13) – its own PR, which also moves both specifications to `implemented/`, sets ADR 0008 to `accepted` and ticks S1-08.
- The team ticket view (S1-10), comment attachments (S1-12), notifications and live updates (S1-15), file-name redaction (Q17), `Idempotency-Key` (S6-01).

## Risks

- Large full-stack change with new dependencies (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `file-type`, `yauzl`, `sharp`, `clamscan`, `@types/multer`): stable versions past the 7-day cooldown, no new high/critical vulnerabilities (Rule 10).
- Integration tests need the SeaweedFS and ClamAV containers (Testcontainers); ClamAV loads its signatures slowly.
- Permission rules must keep "lists equal details" and the denied-case tests green; invisible attachments return `404`.
- The storage folder of an external storage is documented only with phase 4, so this PR keeps SeaweedFS as the documented set-up.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Storage and scanning

- [x] 1.1 Configuration of the storage, ClamAV and the size limit — 3c19b60
- [x] 1.2 Storage adapter and readiness — 3c19b60
- [x] 1.3 ClamAV adapter and clamd configuration — 3c19b60

### Phase 2: Attachments in the API

- [x] 2.1 Model, contracts, abilities and record descriptor — 4e2f4d5
- [x] 2.2 Upload with type detection, limits and the draft quota — 97d5056
- [x] 2.3 Scan, move, EXIF stripping, recovery, reconciliation and purge — 0c78709
- [x] 2.4 Content, detail, lists, link, delete and activity events — 63ee16d

### Phase 3: Web

- [x] 3.1 Attachment components of `@trybun/ui` — 88567e3
- [x] 3.2 Web feature and the BFF content length — 1fdf494
- [x] 3.3 Portal form, view and timeline with attachments — 4f149bc
- [x] 3.4 User documentation — ca1e0d4

### Phase 4: Specification and finish

- [x] 4.1 System specification, ADR 0008 amendments, plan and memory — 37f07cf
- [ ] 4.2 Full validation gate
- [ ] 4.3 Review pass
