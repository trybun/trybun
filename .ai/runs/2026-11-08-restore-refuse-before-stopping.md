# Execution plan: refuse an impossible restore before it asks and before Trybun stops

Source doc: .ai/specs/implemented/2026-11-08-restore-refuse-before-stopping.md (spec PR #254)
Issue: #248

## Goal

`./trybun restore` fetches the backup and runs the storage check while Trybun keeps running, and refuses there, before `Continue? [y/N]`. A restore that can run asks the unchanged questions and only then stops Trybun. A restore that ends before the stop discards the fetched copy.

## Scope

- `docker/backup/backup.sh`: the command `discard`
- `deploy/trybun`: `restore` and `check_storage_folder`
- `deploy/trybun.spec.js`, `scripts/restore-test.sh`
- §15.10 of `docs/spec/15-deployment.md`, `deploy/INSTALL.md`, `docs/user/{en,pl}/administrator/how-to/restore-a-backup.md`, the generated help content

## Non-goals

- Arguments, questions, problem texts, exit status, the checks themselves, `restore-data`, `update` (spec Non-goals)
- A configuration-only fetch (spec A1); a host-side lock against two restores at once
- Moving the spec to `implemented/` waited for #254 to merge; done after its merge

## Risks

Medium: the restore flow of the `./trybun` CLI is a protected surface. The guarantees stay, and `restore-data` keeps its own checks. The restore test of the release workflow covers the order end to end.

## Progress

PR: #255

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Refuse before asking and before stopping

- [x] 1.1 Add the discard command to the backup service — ca37f3b
- [x] 1.2 Reorder restore: fetch and check before the questions, discard before the stop, with unit tests — f31f65b
- [x] 1.3 Assert the new order in the restore test — 6790558, e117b3e
- [x] 1.4 Update §15.10, INSTALL.md and the user documentation — 4ee0674
