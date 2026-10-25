# Uninstall command of the deployment package

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-10-25 |
| Plan task | – |
| System specification sections | §15.4, §15.5, §15.10 |
| Related issues / PRs | [#99](https://github.com/trybun/trybun/pull/99) (the check for data of an earlier installation), [#100](https://github.com/trybun/trybun/pull/100) (specification) |

## Context

The `trybun` script of the deployment package installs, backs up, restores and updates Trybun ([§15.4](../../../docs/spec/15-deployment.md)), but nothing removes it. An Administrator who tried Trybun on a server – the first test installation of 0.1.2 on a VPS – has to find the Docker commands themselves: stop the containers, delete the volumes and the networks, delete the images, in the right order (`docker compose down` needs `.env`). A forgotten volume breaks the next installation: a new `.env` cannot use the database of the old one ([#99](https://github.com/trybun/trybun/pull/99)).

## Goals

- One command, `./trybun uninstall`, removes Trybun from the server: containers, networks, all data and the images.
- Deleting data by mistake is hard: an explicit confirmation, and a last backup on the external S3 storage when one is configured.
- What is needed to restore later – `.env` and the backup passphrase – stays, and the Administrator is told so.

## Non-goals

- Removing Docker itself, the membership of the group `docker` or anything outside the Compose project of the installation.
- Deleting the backups on the external S3 storage: they stay under the retention of [§15.10](../../../docs/spec/15-deployment.md); deleting them is a decision outside the server.
- Uninstalling without `.env`: the Compose file needs it. The message of `./trybun install` (#99) already names the commands for leftover data without `.env`.

## Proposed change

`./trybun uninstall`, run in the folder of the installation:

1. **Checks**: `.env` exists (else the message of `require_env`) and Docker is usable (`check_docker`).
2. **Explains** what it deletes – the containers, the networks, both databases, the stored files, the backups on this server and the images – and what stays: the folder of the package with `.env`, and the backups on the external S3 storage.
3. **Without external S3 storage** (`TRYBUN_BACKUP_S3_URL` not set) it warns that no backup will remain anywhere, because the backups on this server are deleted too.
4. **Confirmation**: the Administrator types the domain of the installation (`TRYBUN_DOMAIN` of `.env`). Any other answer stops with "Nothing was changed."
5. **Last backup** with external S3 storage: a backup with the tag `uninstall`, as `./trybun backup` does, while Trybun still runs. If it fails, the command stops and changes nothing.
6. **Removal**: stops and removes the containers, networks and named volumes of the Compose project, also of services of profiles that are off, and the images of its services (`docker compose down --volumes --remove-orphans --rmi all`, plus the volumes still labelled with the project). An image that another container on the server still uses stays; Docker reports it.
7. **Result**: says what was removed and that the folder with `.env` stays. With S3 it names the last backup and the restore path (unpack a package, copy `.env`, `./trybun restore`); it ends with the command that deletes the folder: `rm -rf <folder>`, and the reminder to keep `.env` and the passphrase outside the server first.

Re-running it after a partial failure is safe: with nothing left, it reports that nothing is installed.

The help of the script (`./trybun --help`), `INSTALL.md` (new section "Uninstalling") and the README list the command.

## Changes to the system specification

| Section | Change |
|---|---|
| §15.4 | The `trybun` script also has the subcommand `uninstall` (§15.5). |
| §15.5 | New paragraph **Uninstall** (`./trybun uninstall`): what it deletes and keeps, the confirmation by the domain, the last backup with external S3 storage. |
| §15.10 | The backups on this server are deleted by `uninstall`; those on the external S3 storage stay. |

New or changed glossary terms: none.

## Open questions

1. Remove the images of the installation too? — **Answer:** yes; images used by other containers stay (maintainer, 2026-10-25).
2. Keep or delete the folder of the package with `.env`? — **Answer:** keep it, and print the command that deletes it (maintainer, 2026-10-25).
3. Confirmation and a last backup? — **Answer:** typing the domain; a last backup when external S3 storage is configured, else a warning that no backup remains (maintainer, 2026-10-25).

## Acceptance criteria

- [x] `./trybun uninstall` deletes nothing unless the typed answer equals `TRYBUN_DOMAIN`; without a terminal answer it stops with "Nothing was changed."
- [x] With `TRYBUN_BACKUP_S3_URL` set, a backup tagged `uninstall` is taken first; a failed backup stops the command before anything is deleted.
- [x] Without it, the command warns that no backup will remain, before the confirmation.
- [x] Afterwards no container, network or volume with the label `com.docker.compose.project` of the installation exists, also for services of profiles that are off, and the images of the package's services are removed unless another container uses them.
- [x] The folder of the package and `.env` are unchanged; the output names `rm -rf <folder>` and the restore path.
- [ ] `./trybun install` in the same folder after `uninstall` installs again from the kept `.env` (with its secrets) on empty volumes – to be checked on the test VPS, see the changelog.
- [x] Script tests (`deploy/trybun.spec.js`) cover the confirmation, the backup with and without S3, a failing backup and a re-run; ShellCheck passes.
- [x] `./trybun --help`, `INSTALL.md` (EN) and the README describe the command; §15.4, §15.5 and §15.10 are updated.

## Changelog

- 2026-10-25 – Created, with the answers of the maintainer to the open questions.
- 2026-10-25 – Approved by merging #100.
- 2026-10-25 – Implemented, with these refinements found while implementing:
  - The images to delete are those of `docker compose config --images` and of the project's containers that are on the server; `--rmi all` of `docker compose down` is not used, because it fails on an image another container uses instead of keeping it.
  - Leftover containers, volumes and networks of services whose profile is off are found by the label `com.docker.compose.project`, not with `--profile '*'`, which the oldest supported Compose (2.20.2) may not have.
  - Without volumes (nothing to back up) no last backup is taken.
  - The criterion "install again from the kept `.env`" is covered by the script tests of `install` with an existing `.env` and by #99, not by an end-to-end run: the only Docker host of the agents runs the maintainer's test installation.
