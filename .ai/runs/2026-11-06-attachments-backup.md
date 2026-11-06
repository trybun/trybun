# Execution plan — implement attachments, phase 4: backup of the storage folder (S1-08)

Source doc: .ai/specs/2026-10-26-attachments.md
Spec PR: #119 (merged, design only) · Phases 1–3: #244 (merged)
Plan task: `S1-08`

## 🎯 Goal

Build phase 4 of the approved change specification (Q1, Q13): every backup copies the attachment folder of `TRYBUN_S3_URL` – SeaweedFS of Compose or an external S3 storage – and `./trybun restore` replaces that folder's content, guarded by a server ID kept outside every backup. Then finish S1-08: both change specifications to `implemented/`, ADR 0008 `accepted`, S1-08 ticked.

## Scope

- Backup service (`docker/backup/backup.sh`, its image if needed, `compose.yaml` `backup` service): the rclone remote `objects` from the storage variables (endpoint, credentials, region; provider `SeaweedFS` with the profile, else `Other`); copy `objects:{bucket}/{folder}` into the snapshot's `objects/`; the restore syncs it back, excluding `/.trybun-installation`, and rewrites the marker.
- Server ID in `/backup/server-id` of the `backup-data` volume: created by `./trybun install` and by `./trybun restore` when missing; never in a backup.
- `./trybun restore` (`deploy/trybun`): the second question when the folder's marker names another server ("The storage folder {url} belongs to another Trybun server. Replace its content? [y/N]", default no), refusal without a terminal, the flag `--replace-foreign-objects`; `usage()`, `deploy/trybun.spec.js`.
- Restore test (`scripts/restore-test.sh`): the SeaweedFS case writes and compares only the attachment folder; a variant with an external storage on the test's S3 server; refusal without the flag, success with it; the marker rewritten.
- `INSTALL.md`, README, `.env.example`: the external storage, the dedicated folder, switching before the first upload, the restore question.
- System specification §15.10 (and §15.3 where it defers to this change), `BACKWARD_COMPATIBILITY.md` if the snapshot layout surface is described there, glossary if needed.
- Finish: `.ai/specs/2026-10-26-attachments.md` and `.ai/specs/2026-10-25-attachment-serving.md` to `implemented/` (status `implemented`, changelog, links fixed), ADR 0008 `accepted`, S1-08 ticked in the plan, project memory.

## Non-goals

- Moving the objects of an existing installation between storages (spec non-goal).
- Follow-ups #245, #246.

## Risks

- Protected surfaces "Backups" and the `./trybun` CLI (`BACKWARD_COMPATIBILITY.md`): snapshots of earlier releases must still restore (they hold no attachments); the existing confirmation and its answers stay unchanged.
- A restore deletes objects outside the server: the guard must hold for a production backup restored onto a test server.
- The restore test is a release gate; it needs Docker and runs long.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Backup and restore of the storage folder

- [ ] 1.1 Backup service: remote from the storage variables, copy and restore of the folder
- [ ] 1.2 Server ID and the restore guard of `./trybun restore`
- [ ] 1.3 Restore test with SeaweedFS and an external storage

### Phase 2: Documentation and finish

- [ ] 2.1 INSTALL.md, README, .env.example and the system specification
- [ ] 2.2 Specifications to implemented, ADR 0008 accepted, S1-08 ticked

### Phase 3: Validation and review

- [ ] 3.1 Full validation gate
- [ ] 3.2 Review pass
