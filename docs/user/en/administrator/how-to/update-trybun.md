---
title: Update Trybun
description: Install a new release with one command, with a backup taken before anything changes.
---

1. Look up the version on the [releases page](https://github.com/trybun/trybun/releases) and read its notes.
2. In the folder of the installation on the server, run the update with the version:

   ```sh
   ./trybun update 1.4.1
   ```

The command downloads the deployment package of the release and checks its checksum, shows the changes since the installed version and – for a new MAJOR version, which may need manual steps – asks you to confirm. It then pulls the new images, backs up both databases, the stored files and the configuration, replaces the files of the deployment package (`.env` stays unchanged), migrates the databases, applies the sign-in configuration and starts the new version.

If the images cannot be pulled or the backup fails, the update stops before it changes anything. If the new version does not start, the command prints the one command that returns to the previous version with the data from before the update, for example:

```sh
./trybun restore 1a2b3c4d
```

Only restoring the backup returns to the previous version: the migrations may have changed the databases already ([restore a backup](restore-a-backup.md)).

The folder keeps its name, e.g. `trybun-1.4.0`, after the update.
