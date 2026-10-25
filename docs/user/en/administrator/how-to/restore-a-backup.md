---
title: Restore a backup
description: Return Trybun to the state of a backup – after a failed update, after a mistake, or onto a new server.
---

A backup contains both databases (including the sign-in accounts), the stored files and the configuration: `.env` and the files of the deployment package. Restoring it replaces all of them and starts the version of Trybun the backup was taken with. Everything that changed after the backup is lost.

## On the same server

1. In the folder of the installation, list the backups:

   ```sh
   ./trybun backup list
   ```

2. Restore one by its ID, or the newest one without an ID:

   ```sh
   ./trybun restore 1a2b3c4d
   ```

3. Confirm with `y`. Trybun stops, restores the backup and starts again.

After a failed update, the update itself prints the command that restores the backup taken right before it, e.g. `./trybun restore 1a2b3c4d`.

## Onto a new server

You need the deployment package of any release, the copy of `.env` you kept outside the old server, and the backups on the external S3 storage ([configure backup storage](configure-backup-storage.md)).

1. Prepare the server as for an installation: Docker Engine with the Compose plugin, the domain pointing to the new server, ports 80 and 443 open.
2. Unpack the deployment package and copy the kept `.env` into its folder:

   ```sh
   tar -xzf trybun-<version>.tar.gz
   cd trybun-<version>
   cp ~/trybun.env .env
   chmod 600 .env
   ```

3. Restore the newest backup from the S3 storage:

   ```sh
   ./trybun restore
   ```

The users sign in with their passwords and two-factor codes as before. If the `.env` is lost, run `./trybun install` on the new server, set `TRYBUN_BACKUP_PASSPHRASE` and the `TRYBUN_BACKUP_S3_*` variables of the old installation in the new `.env`, and run `./trybun restore`; it brings back the old `.env` too.
