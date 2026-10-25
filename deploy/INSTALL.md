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
| `trybun` | The command of the package: `./trybun install`, `setup-token`, `backup`, `restore`, `update`, `--help` |
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

## Changing the configuration

Optional settings (e-mail, sign-in providers, backup storage) are described next to their variables in `.env`. A change of `.env` takes effect after running `docker compose up -d --wait` again.

Keep `.env` and the backup passphrase safe: `.env` holds every password of the installation. Keep a copy of both outside the server – with them, this package restores Trybun onto a new server.

## Backups

The service `backup` backs up both databases, the stored files and the configuration (`.env` and the files of this package) every day at 03:00 UTC, encrypted with the backup passphrase, and keeps the backups of the last 30 days. Without external storage they stay on a volume of this server; set the `TRYBUN_BACKUP_S3_*` variables of `.env` to keep them on S3-compatible storage in another location as well (strongly recommended), then run `docker compose up -d --wait`.

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
./trybun restore [<backup>]
```

It asks for confirmation, then replaces all data and the configuration with the backup (the newest without an ID) and starts the version it was taken with. On a new server: unpack the package of any release, copy the kept `.env` into its folder and run `./trybun restore`; the backup comes from the S3 storage.

## Testing a restore

Restore onto a separate server at least once a quarter: follow "Restoring a backup" on a new server with the backups of the S3 storage, then sign in with two-factor authentication and check that your data and files are there. Every release passes the same restore automatically before it is published.
