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

3. The restore first reads the backup, which can take a while, and checks where its attached files go – Trybun keeps running meanwhile. If the restore cannot run, it says why and stops there; nothing is changed. Otherwise confirm with `y`. Trybun stops, restores the backup and starts again.

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

   When the attached files are kept on an external S3 storage, the restore asks a second question, because their folder still belongs to the old server: "The storage folder … belongs to another Trybun server. Replace its content? [y/N]". Answer `y` when the old server is lost. Answer `n` while the old server still runs: `y` would replace its attached files with those of the backup. To test a restore, follow "Test a restore while the installation runs" below instead.

   The restore also asks before it replaces a folder that holds files but no mark of a Trybun server, because it may belong to another application: "The storage folder … holds objects but no Trybun marker. Replace its content? [y/N]". An empty folder asks nothing.

The users sign in with their passwords and two-factor codes as before. If the `.env` is lost, run `./trybun install` on the new server, set `TRYBUN_BACKUP_PASSPHRASE` and the `TRYBUN_BACKUP_S3_*` variables of the old installation in the new `.env`, and run `./trybun restore`; it brings back the old `.env` too.

## Test a restore while the installation runs

Test a restore on a separate server at least once a quarter, as described in "Onto a new server", but restore with `--test`. A test restore empties `TRYBUN_BACKUP_S3_URL` in the restored `.env`, so the test server makes no backups on the external S3 storage and leaves those of the installation alone; to back it up off-site, set `TRYBUN_BACKUP_S3_URL` to a repository of its own, never the one of the installation.

- When the attached files are kept in SeaweedFS on the server (the default), restore with:

  ```sh
  ./trybun restore --test
  ```

- When they are kept on an external S3 storage, the restored `.env` points to the folder of the installation you test, so restore the files into a folder of their own. `--test` without it is refused.
  1. On the storage, create an empty bucket, or a folder outside the one of `TRYBUN_S3_URL` and of `TRYBUN_BACKUP_S3_URL`, that the access key of `.env` (`TRYBUN_S3_ACCESS_KEY_ID`) may write to.
  2. Restore into it:

     ```sh
     ./trybun restore --test --storage-url https://s3.example.com/my-bucket-restore-test
     ```

     The restored `.env` uses this folder, and the folder of the installation stays unchanged. An empty folder asks no second question; if it appears anyway, answer `n`. The restore refuses a folder that contains the folder of the installation or of the backups, or lies inside one of them.

Then sign in with two-factor authentication and check that your data and files are there. Delete the test folder on an external storage afterwards.
