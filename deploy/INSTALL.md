# Installing Trybun

This folder is the deployment package of one Trybun release. It runs the published images `ghcr.io/trybun/web`, `ghcr.io/trybun/server`, `ghcr.io/trybun/postgres` and `ghcr.io/trybun/backup` of this release with Docker Compose; the source code is not needed.

## Requirements

- A Linux server with Docker Engine 25.0 or newer and the Docker Compose plugin 2.20.2 or newer.
- At least 8 GB RAM, 16 GB recommended.
- A domain pointing to the server, and ports 80 and 443 open and free: Caddy obtains the HTTPS certificate automatically.

The install script checks these requirements and stops before it changes anything if one is not met.

## Contents

| File | Purpose |
|---|---|
| `trybun` | The command of the package: `./trybun install`, `setup-token`, `backup`, `restore`, `update`, `uninstall`, `--help` |
| `compose.yaml` | All services, pinned to the images of this release |
| `.env.example` | Every setting with its description |
| `docker/caddy/` | Configuration of the reverse proxy |
| `docker/keycloak/` | Configuration of the sign-in (Keycloak), applied on every start |
| `CHANGELOG.md` | The changes of every release; `./trybun update` shows those since the installed version |
| `SHA256SUMS` (next to the archive in the GitHub Release) | Checksums of the archive and the SBOMs |

## Installation

1. Check the archive and unpack it:

   ```sh
   sha256sum --check --ignore-missing SHA256SUMS
   tar -xzf trybun-<version>.tar.gz
   cd trybun-<version>
   ```

2. Run the install script as a user who may use Docker (root or a member of the group `docker`):

   ```sh
   ./trybun install
   ```

   It checks the server, then asks for:
   - the domain, e.g. `trybun.example.com`;
   - the default language, `en` or `pl`;
   - the default time zone, e.g. `Europe/Warsaw`.

   If the domain does not point to the server yet, the script warns and asks whether to continue. Behind NAT or a floating IP the server does not see its public address; continue in that case.

3. **Store the backup passphrase.** The script prints it once. Keep it outside the server, e.g. in a password manager, and type `stored` to continue. Without it, off-site backups cannot be restored after the server is lost.

4. The script writes `.env` with random passwords and secrets, readable only by its owner, and starts Trybun. The first start downloads the images and takes a few minutes.

5. **Open the setup link** printed at the end, `https://<domain>/setup#token=…`, and create the first Administrator. The link is valid for 24 hours and works once.

## A new setup link

If the link has expired or got lost before the first Administrator was created, print a new one; it replaces the previous link:

```sh
./trybun setup-token
```

Once an Administrator exists, the command only reports that Trybun is already set up.

## Running the install script again

Re-running `./trybun install` is safe: when `.env` exists, the script asks no questions, generates no secrets and never changes `.env`. It checks the server, starts Trybun and prints a new setup link while no Administrator exists. So it is also the way to resume an interrupted installation.

The database keeps the passwords of the `.env` it was created with. So when `.env` is missing but the data of an earlier installation is still on the server, the script stops before the questions and names the Docker volumes: copy the `.env` of that installation into the folder, or – if the data is not needed – delete it with the command the script prints, then run `./trybun install` again.

## Changing the configuration

Optional settings (e-mail, sign-in providers, backup storage) are described next to their variables in `.env`. A change of `.env` takes effect after running `docker compose up -d --wait` again.

Keep `.env` and the backup passphrase safe: `.env` holds every password of the installation. Keep a copy of both outside the server – with them, this package restores Trybun onto a new server.

## Attachments on an external S3 storage

The attached files are kept in SeaweedFS, a service of this package on the server, unless an S3-compatible storage is configured instead. Switch before the first file is attached: Trybun does not move files between storages, so the files of the storage used before stay there and can no longer be opened.

1. Create a bucket, or a folder in one, for the attachments of this installation and an access key that may list, read, write and delete its objects. The folder must belong to this installation alone – not to another application, another Trybun server or the backups of `TRYBUN_BACKUP_S3_URL` – because a restore deletes every object in it that is not in the backup.
2. Set the variables of the **Attachments** section of `.env` and remove `seaweedfs` from `COMPOSE_PROFILES`:

   ```sh
   TRYBUN_S3_URL=https://s3.eu-central-1.amazonaws.com/my-bucket/trybun
   TRYBUN_S3_REGION=eu-central-1
   COMPOSE_PROFILES=clamav
   ```

   `TRYBUN_S3_URL` is the address of the bucket followed by an optional folder; the requests use path-style addressing. Replace the generated `TRYBUN_S3_ACCESS_KEY_ID` and `TRYBUN_S3_SECRET_ACCESS_KEY` with the access key of the storage. Set the region when your provider needs one.

3. Apply the change with `docker compose up -d --wait`, then back up right away with `./trybun backup`.

The backups contain the attachment folder on the external storage as they contain SeaweedFS. A backup taken before the switch restores only while SeaweedFS runs: without `seaweedfs` in `COMPOSE_PROFILES`, `./trybun restore` of such a backup stops and changes nothing.

## Backups

The service `backup` backs up both databases, the attached files – the folder of `TRYBUN_S3_URL`, in SeaweedFS or on an external storage – and the configuration (`.env` and the files of this package) every day at 03:00 UTC, encrypted with the backup passphrase, and keeps the backups of the last 30 days. Without external storage they stay on a volume of this server; set the `TRYBUN_BACKUP_S3_*` variables of `.env` to keep them on S3-compatible storage in another location as well (strongly recommended), then run `docker compose up -d --wait`.

```sh
./trybun backup        # back up now
./trybun backup list   # the backups on this server and on the S3 storage
```

## Updating

```sh
./trybun update <version>
```

The command downloads the release and checks its checksum, shows its changes, asks before a new MAJOR version, pulls the new images, backs up, replaces the files of this package (never `.env`), migrates the databases and starts the new version. If the new version does not start, it prints the command that returns to the previous version with the data from before the update: `./trybun restore <backup>`.

## Restoring a backup

```sh
./trybun restore [<backup>] [--storage-url <url>] [--replace-foreign-objects]
```

It asks for confirmation, then replaces all data and the configuration with the backup (the newest without an ID) and starts the version it was taken with. On a new server: unpack the package of any release, copy the kept `.env` into its folder and run `./trybun restore`; the backup comes from the S3 storage.

The restore replaces the content of the attachment folder of the backup's `.env` and deletes the objects in it that are not in the backup. Every server marks the folder it uses with an ID of its own, which no backup contains. When the folder is marked by another Trybun server, the restore asks a second question before it changes anything: "The storage folder {url} belongs to another Trybun server. Replace its content? [y/N]".

- Answer `y` when that server is lost or no longer uses the folder, e.g. on a new server after a disaster: with an external storage, the folder still names the lost server, so this restore always asks.
- Answer `n`, the default, when the other server still uses the folder, e.g. when a backup of production is restored onto a test server: the `.env` of the backup points to the folder of production, and `y` would replace the attachments of production with those of the backup. Restore such a backup with `--storage-url` instead (below).

Without a terminal, e.g. in a script, the restore refuses a folder of another server; `--replace-foreign-objects` answers the question with yes.

`--storage-url <url>` restores the attachments into another folder instead – the address of a bucket followed by an optional folder, as `TRYBUN_S3_URL`. The restored `.env` gets `TRYBUN_S3_URL=<url>`; the folder of the backup's `.env` is not changed. The restore checks the marker of the new folder, so an empty folder asks no second question, and refuses a folder that contains the folder of the backup or lies inside it. It uses the access key of the backup's `.env` (`TRYBUN_S3_ACCESS_KEY_ID`, `TRYBUN_S3_SECRET_ACCESS_KEY`), so the folder must be on a storage that key may write to, e.g. another bucket of the same account.

## Testing a restore

Restore onto a separate server at least once a quarter: follow "Restoring a backup" on a new server with the backups of the S3 storage, then sign in with two-factor authentication and check that your data and files are there. Every release passes the same restore automatically before it is published.

With the attachments on an external storage, the backup's `.env` points to the folder of the installation you test, which still runs. Create an empty folder for the test – another bucket, or a folder outside the one of `TRYBUN_S3_URL` – that the access key of `.env` may write to, and restore into it:

```sh
./trybun restore --storage-url https://s3.eu-central-1.amazonaws.com/my-bucket-restore-test
```

The restore asks no second question for the empty folder and leaves the folder of the installation unchanged. It also empties `TRYBUN_BACKUP_S3_URL` in the restored `.env`, so the test server makes no backups on the external S3 storage and cannot prune the backups of the installation; to back the test server up off-site, set `TRYBUN_BACKUP_S3_URL` to a repository of its own, never the one of the installation. If the second question appears anyway, answer `n`: the folder belongs to another server. Delete the test folder on the storage when the test is done.

## Uninstalling

```sh
./trybun uninstall
```

The command deletes Trybun from the server: its containers and networks, both databases, the stored files, the backups on this server and the images. Images that another container on the server uses stay. It deletes nothing until you type the domain of the installation.

- With external S3 storage, it first stores a last backup there; the backups on the S3 storage stay. If the backup fails, nothing is deleted.
- Without it, no backup remains anywhere – the command warns before it asks. Run `./trybun backup` and keep a copy elsewhere first if you may need the data.
- The attachment folder on an external storage (`TRYBUN_S3_URL`) is not deleted; delete it on the storage if the files are not needed. The ID of the server is deleted with the backups on this server, so a later restore into that folder asks the second question, as on a new server.

The folder of the package with `.env` stays. Keep `.env` and the backup passphrase outside the server – with them and the backups on the S3 storage, `./trybun restore` brings Trybun back, as described in "Restoring a backup". Then delete the folder with the command the script prints (`rm -rf <folder>`).
