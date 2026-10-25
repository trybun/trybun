---
title: Configure backup storage
description: Keep the daily backups on S3 storage in another location, so they survive the loss of the server.
---

Trybun backs up both databases, the stored files and its configuration every day, encrypted with the backup passphrase. Until backup storage is configured, the backups are kept only on the server itself and are lost with it. Any S3-compatible storage in another location works, e.g. a bucket of your cloud provider in another region.

1. Create a bucket for the backups and an access key that may read and write it.
2. On the server, open `.env` in the folder of the installation and set the variables of the **Backups** section:

   ```sh
   TRYBUN_BACKUP_S3_URL=https://s3.eu-central-1.amazonaws.com/my-bucket/trybun
   TRYBUN_BACKUP_S3_ACCESS_KEY_ID=…
   TRYBUN_BACKUP_S3_SECRET_ACCESS_KEY=…
   TRYBUN_BACKUP_S3_REGION=eu-central-1
   ```

   `TRYBUN_BACKUP_S3_URL` is the address of the bucket followed by an optional folder. Set the region when your provider needs one.

3. Apply the change:

   ```sh
   docker compose up -d --wait
   ```

   If the storage cannot be reached or the passphrase does not open the backups already in it, the command fails; `docker compose logs backup` says why.

4. Create the first backup right away instead of waiting for the night:

   ```sh
   ./trybun backup
   ```

Keep a copy of `.env` and of the backup passphrase outside the server: with them, the deployment package restores Trybun onto a new server ([restore a backup](restore-a-backup.md)).

The daily backup runs at 03:00 UTC; `TRYBUN_BACKUP_TIME` changes the time. The backups of the last 30 days are kept; `TRYBUN_BACKUP_KEEP_DAILY` changes the number of days.

The item **Configure backup storage** of **Administration** › **Getting started** is ticked as soon as `TRYBUN_BACKUP_S3_URL` is set.
