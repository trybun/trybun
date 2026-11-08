# A restore that cannot run is refused before it asks and before Trybun stops

| | |
|---|---|
| Status | `draft` |
| Created | 2026-11-08 |
| Plan task | – |
| System specification sections | §15.10 |
| Related issues / PRs | #248 (request), #247 (S1-08 phase 4, where the maintainer found it), `.ai/specs/implemented/2026-10-26-attachments.md` (Q13, Q24–Q26) |

## 📝 TLDR

Today `./trybun restore` asks `Continue? [y/N]`, stops Trybun and fetches the backup before its storage check can refuse – so a restore that was never possible (a `--test` of a backup on an external storage without `--storage-url`, an overlapping folder, an overlap with a backup repository, an unreadable folder, a foreign or unmarked folder without a terminal) leaves a stopped Trybun behind. Proposed: **the restore fetches the backup and runs the storage check while Trybun keeps running, and refuses there, before the first question**; only a restore that can run asks `Continue? [y/N]` (unchanged), then the second question when the folder needs it (unchanged), and only then stops Trybun. A restore that stops before Trybun is stopped discards the fetched copy.

## Context

`restore` in `deploy/trybun` runs, in this order: the arguments, `require_env`, `check_docker`, the explanation, `Continue? [y/N]`, `Stopping Trybun.` (`docker compose stop`), `backup fetch`, `check_storage_folder`, `restore_configuration`, `docker compose up -d --wait postgres` with `set_database_passwords`, `restore-data`, `docker compose up -d --wait`. `check_storage_folder` needs the fetched backup: `storage-owner` of the backup service reads the storage settings from `$RESTORED/configuration/.env`.

Every refusal of `check_storage_folder` – `external`, `overlap`, `repository`, an unreadable folder, an unexpected answer, and `foreign`/`unmarked` without a terminal and without `--replace-foreign-objects` – therefore comes after the first question and after the stop. Nothing is changed, but the message tells the Administrator to start Trybun again with `docker compose up -d --wait`; on a test server that ran Trybun before, it stays down until then. The maintainer found this in the manual QA of #247.

What the check needs is safe while Trybun runs:

- `fetch` restores the snapshot into `$RESTORED` of the volume `backup-data`, under the `flock` the scheduled backup of the running backup service also takes, so the two never run at once; the scheduled backup writes `$SET`, never `$RESTORED`.
- `storage-owner` only reads: the marker and the object list of the folder, and the repository URLs. On a running server SeaweedFS already runs; on a stopped or new server `docker compose run backup` starts its dependencies (`postgres`, `seaweedfs`), as it does today after the stop.
- After the stop, `restore-data` checks the marker again (and the overlap with the backup's folder and with the repository of the restored `.env`), so a folder that another server marked or filled with objects in the meantime is still refused. It does not repeat the `external` check; that answer depends only on the fetched `.env`, which does not change.

## Goals

- A restore the storage check refuses without an answer of the Administrator fails before `Continue? [y/N]` and before `Stopping Trybun.`; a running Trybun keeps running.
- A fetch that fails also fails before the first question, with Trybun running.
- `Continue? [y/N]`, the second question and their answers are unchanged; both come before the stop, so `n` to either leaves Trybun running.
- A restore that stops before Trybun is stopped leaves no fetched copy of the backup on the server.

## Non-goals

- No change of the arguments, the questions, the problem texts of the refusals or the exit status (`BACKWARD_COMPATIBILITY.md`, `trybun` CLI).
- No change of the checks themselves (Q13, Q24–Q26 of S1-08) or of `restore-data`.
- No configuration-only fetch before a full one (A1).
- No change of `update` and its rollback path.

## Proposed change

### `./trybun restore`

New order; steps 1–3 and 7–10 are unchanged:

1. Arguments, `require_env`, `check_docker`.
2. The explanation (`This replaces all data …`, the `--test` and `--storage-url` lines).
3. `Reading the backup {id}.` (new line), then `docker compose run --rm -T --no-deps backup fetch {id}`. Before the fetch, the main shell sets `trap discard_backup EXIT` and `trap 'exit 130' HUP INT TERM` – the pattern of `restore_configuration` and `update`; without the second trap, dash runs no EXIT trap on an untrapped SIGINT. So every exit until the stop – a refusal, `n`, a missing answer (`ask` fails in its `$(…)` subshell, and the main shell then exits), Ctrl-C, a failed fetch – runs `backup discard` (below). The traps are cleared (`trap - EXIT HUP INT TERM`) right before `Stopping Trybun.`; `restore_configuration` then sets its own, as today.
   - Failure: `The backup {id} could not be read. Nothing was changed.`
   - Every `docker compose run` before the questions – `fetch`, `storage-owner` and `discard` – reads `</dev/null`: Compose passes stdin on to the container, also with `-T`, so it would consume the answers of `printf 'y\n' | ./trybun restore`. Today these commands run after the question and never see the answer.
4. The storage check (`storage-owner`, as today). Refusals with their unchanged problem texts, ending in `Nothing was changed.` – the hint `start Trybun again with docker compose up -d --wait` is dropped, since Trybun was not stopped:
   - `external`, `overlap`, `repository`, an unreadable folder, an unexpected answer;
   - `foreign` or `unmarked` without a terminal and without `--replace-foreign-objects`.
5. `Continue? [y/N]` – unchanged text and answers; `n` → `Restore stopped. Nothing was changed.`
6. `foreign` or `unmarked` with a terminal and without `--replace-foreign-objects`: the second question, unchanged text and answers; `n` → `Restore stopped. Nothing was changed.`
7. `Stopping Trybun.`, `docker compose stop`. From here on, failures keep their current messages, including the hint to start Trybun again.
8. `restore_configuration`.
9. `restore-data` (with `--replace-foreign-objects` after a yes or the flag), as today.
10. `docker compose up -d --wait` and the closing lines.

`check_storage_folder` is split into the classification with its refusals (step 4) and the second question (step 6); `$replace_objects` is set as today.

### Backup service: `discard`

A new command of `docker/backup/backup.sh`, `discard`: takes the lock and deletes `$RESTORED` (no error when it is missing). `./trybun` calls it as `docker compose run --rm -T --no-deps backup discard </dev/null >/dev/null 2>&1 || :` – its failure is ignored, so it never adds an error after the reason of the refusal; this also covers a backup image of an earlier release without the command. Without it, `n` at `Continue?` – which today leaves nothing behind – would leave an extracted copy of the backup, including its `.env` with every password, in `backup-data`.

### Tests

- `deploy/trybun.spec.js` (the stubbed `docker`): the stub gets a case for `backup discard` with `STUB_DISCARD_EXIT`, which prints an error to stderr when it fails (an unknown command answers `exit 99` and `unexpected: …`, which the tests assert never appears). As Compose, the stub of `fetch`, `storage-owner` and `discard` reads stdin when it is not a terminal, so a missing `</dev/null` fails the tests.
  - For every refusal of step 4 and a failed fetch: the log has `backup fetch` and `storage-owner`, no `compose stop`, no `backup configuration` or `restore-data`, and `backup discard`; the output has no `Continue? [y/N]` and no `Stopping Trybun.`; the message ends in `Nothing was changed.` without the start hint.
  - `n` at `Continue?`, `n` at the second question and a missing answer: no `compose stop`, `backup discard`.
  - A SIGTERM during the fetch: exit status 130, `backup discard`, no `compose stop`.
  - A successful restore: `fetch`, `storage-owner` and both questions before `compose stop`, then `backup configuration`, `restore-data`, `compose up`; no `backup discard`. A failure after the stop (`restore-data`) runs no discard.
  - A failing `discard` adds nothing to stderr after the reason of the stop. The existing inputs (`y\n`, `y\ny\n`) keep working.
- `scripts/restore-test.sh`: the refusal steps capture stdout and stderr and assert that neither `Continue? [y/N]` nor `Stopping Trybun.` appears. A new step after the backup of the test copy, while server-d runs: `printf 'y\n' | ./trybun restore --test` in its folder, without `restore_onto` – which would copy another `.env` over the running server's one – is refused, because the newest backup is the test copy's, whose attachments are on the external storage; every service that ran before still runs (`docker compose ps --status running --services` unchanged).

## Changes to the system specification

| Section | Change |
|---|---|
| §15.10, the bullet "`./trybun restore [<backup>] …` (default: the newest) asks for confirmation, stops all services, restores the snapshot …" | "… (default: the newest) fetches the snapshot into the volume `backup-data` – from the local repository when it has it and else from the external S3 storage – while Trybun keeps running, and checks the storage folder (the restore guard below); a restore the check refuses stops there, before any question and with Trybun running. Then it asks for confirmation – and the second question of the guard when the folder needs it – stops all services, brings back `.env` …". Add: "A restore that stops before the services are stopped deletes the fetched copy (`discard` of the backup service)." |
| §15.10, "The restore guard": "Before it changes anything, `./trybun restore` reads the marker …" | "Before it asks and before it stops Trybun, `./trybun restore` reads the marker …"; "it asks a second question" → "it asks a second question after the confirmation"; the unreadable-folder case ends "the restore stops with nothing changed and Trybun running". |
| §15.10, "A test restore": "… requires `--storage-url` and is refused without it before anything changes." | "… is refused without it before it asks and before Trybun stops." |

No glossary changes; no new pattern in §18.

Other documents in the same pull request: `deploy/INSTALL.md` ("Restoring a backup": it reads the backup and checks the folder first, so a restore it refuses changes nothing and leaves Trybun running; free disk space of the size of the backup is needed while Trybun runs); `docs/user/{en,pl}/administrator/how-to/restore-a-backup.md` (step 3: the restore reads the backup before it asks, which can take a while; both questions come before Trybun stops, so `n` leaves it running) and `pnpm help:generate`; `README.md` (the restore sentence of the backup service: a restore that cannot run is refused before any question, with Trybun running – Rule 5); `.ai/memory/backups.md`. `usage()` and `BACKWARD_COMPATIBILITY.md` need no change: the arguments and guarantees stay; the order is strictly safer.

## Edge Cases & Failure Scenarios

- **Trybun is not running** (a new server, or one stopped by hand): as today, `storage-owner` starts `postgres` and `seaweedfs` as dependencies of the backup service; a refusal leaves them running, as a refusal does today.
- **A scheduled backup runs while the restore fetches**: the fetch waits for the lock. **One runs between the fetch and the stop**: it writes its own set and marks only the server's own folder; the fetched copy is not touched.
- **The folder changes between the check and the stop** (another server marks it, objects appear): `restore-data` refuses after the stop, as it does today for a folder that differs from what `storage-owner` saw, with its current message (`Restoring the data failed. … run ./trybun restore {id} again.`).
- **Ctrl-C or a closed stdin at a question**: `exit` runs the discard; nothing else changed, Trybun runs.
- **Disk space**: the fetch needs the same space as today, but it now runs while Trybun runs, so a fetch that fills the disk also hits the running PostgreSQL and SeaweedFS – today it hits a stopped server. The failed fetch runs the discard at once, which frees the space; `deploy/INSTALL.md` asks for free space of the size of the backup before a restore.
- **Two restores at once** on one server: the second fetch or discard can replace the copy the first one checked while it waits at a question. This is possible today between the fetch and `restore-data` too; the window is now longer. Out of scope: one Administrator runs one restore; a host-side lock can follow if it matters.
- **Piped answers** (`printf 'y\n' | ./trybun restore`, as the restore test does): the commands before the questions read `</dev/null`, so the answers reach `Continue?`. Piped empty input with a foreign folder now fails with the foreign-folder refusal instead of `No answer to "Continue? [y/N]: "` – both before any change, with exit status 1.
- **`discard` fails** (e.g. Docker is gone): the refusal message stays the last error; the copy is removed by the next `fetch`, which empties `$RESTORED` first.
- **Waiting**: a large backup is read before the first question instead of after it; the new line `Reading the backup {id}.` says what happens. A restore that goes ahead takes as long as today; one that is refused or answered `n` now costs a full fetch, possibly from the external S3 storage, that it did not cost before. The documentation says so.

## Risks & Impact Review

Medium, as the issue says: the restore flow of the `./trybun` CLI is a protected surface. The arguments, both questions, their answers, the problem texts and the exit status stay; only the place of the stop moves later and the start hint disappears where Trybun was never stopped. Every refusal still happens before anything is changed, and `restore-data` keeps its own checks, so the guard is not weakened. The new `discard` command is internal to the backup image. Rollback is reverting the pull request; no data, schema or `.env` format changes. The restore test of the release workflow covers the new order end to end.

## Resolved assumptions (autonomous defaults)

The ticket left these open; they were chosen autonomously and can be overridden on the specification pull request.

| # | Question | Default | Rationale |
|---|---|---|---|
| A1 | Fetch the whole backup before the question, or only its configuration? | The whole backup, once | One fetch keeps the checked and the restored snapshot the same, also for `latest` while a scheduled backup can add a newer one; a configuration-only fetch would need a new command, a pinned snapshot ID and a second fetch. The cost: the wait moves before the question, a cancelled restore still pays the fetch, and the fetch takes its disk space while Trybun runs. |
| A2 | Where does the second question go? | Right after `Continue?`, before the stop | The order and texts of the two questions stay as the Administrator sees them today; only the stop moves after them, so `n` to the second question leaves Trybun running. |
| A3 | What happens to the fetched copy when the restore stops before the stop? | It is deleted by a new `discard` command of the backup service | Today `n` at `Continue?` leaves nothing; without the discard it would leave an extracted copy with the backup's `.env` on the server. |
| A4 | Messages of the early refusals | Problem texts unchanged; `Nothing was changed.` without the start hint | Trybun was not stopped, so the hint would be wrong; the scripts and tests that match the problem texts keep working. |
| A5 | Split into more than one change? | No | One capability: the order of one command, its test and its documentation. |

## Acceptance criteria

- [ ] The backup is fetched and the storage folder checked before `Continue?` and before `Stopping Trybun.`, without stopping a running Trybun.
- [ ] The refusals that need no answer – external storage without `--storage-url`, overlapping folders, an overlap with a backup repository, an unreadable folder, a foreign or unmarked folder without a terminal – and a failed fetch come before `Continue?`; Trybun keeps running.
- [ ] `Continue? [y/N]`, the second question and their answers are unchanged; both come before the stop.
- [ ] A restore that stops before the stop leaves no fetched copy (`discard`).
- [ ] `deploy/trybun.spec.js` and `scripts/restore-test.sh` assert the new order; `restore-test.sh` shows a refused restore leaving a running server running.
- [ ] §15.10, `deploy/INSTALL.md` and the user documentation (EN, PL) describe the new order.
- [ ] Works on phone, tablet and desktop (Rule 9) – not affected: a server command.
- [ ] User documentation and product tour updated where relevant (Rules 3, 4) – the restore how-to, no tour.

## 📋 Implementation Plan

Phase 1 – one pull request, `Closes #248`:

1. Add `discard` to `docker/backup/backup.sh` (and its usage line of unknown commands).
2. In `deploy/trybun`, split `check_storage_folder` into the classification with its refusals and the second question; reorder `restore` as in "Proposed change", with the discard on every exit before the stop and the start hint dropped from the early messages. Update and extend `deploy/trybun.spec.js` as in "Tests". `pnpm test` passes.
3. Update `scripts/restore-test.sh` as in "Tests".
4. Update §15.10, `deploy/INSTALL.md`, `docs/user/{en,pl}/administrator/how-to/restore-a-backup.md`, `README.md` and `.ai/memory/backups.md`, and run `pnpm help:generate`; set this specification to `implemented`, add its changelog entry and move it to `implemented/`.

## Changelog

- 2026-11-08 – Created (autonomous draft from #248).
- 2026-11-08 – Review: traps for Ctrl-C, the `discard` stub, the restore-test step without `restore_onto`, the disk and wait costs, what `restore-data` re-checks.
- 2026-11-08 – Specification review (#254), aligned with the implementation in #255: `</dev/null` for the commands before the questions, the tests of the signal and after-stop paths, `README.md`, the wording of §15.10.
