# 15 – Hosting and deployment

## 15.1 Principle

The system must run on **any Linux VPS**, without depending on services of a specific provider. The target deployment method from the first version is **Docker Compose**. Moving to another server means copying the configuration and running one command.

Development and test environments (e.g. a VPS at OVH) use the same Compose file as production, with an additional override file for development settings. What is tested is exactly what goes to production.

| Environment | Purpose | Data |
|---|---|---|
| **Local** | Development on the developer's machine or dev VPS ([§15.12](#1512-local-development-environment)); includes Mailpit to capture all outgoing e-mail; seeded team accounts may sign in with a password ([§7.4](07-users-organizations-permissions.md)) | Seed and demo data |
| **Test** | Every release candidate (`-rc`, Rule 11) is deployed here before release | Demo data, never production data |
| **Production** | Customer installations | Real data |

## 15.2 Server requirements

- Linux with Docker Engine and the Docker Compose plugin.
- At least 8 GB RAM, 16 GB recommended (one server runs, among others, PostgreSQL, Valkey, SeaweedFS, Keycloak and ClamAV).
- External S3-compatible storage in a different location than the server for backups ([§15.10](#1510-backups)) is **strongly recommended**. Without it, backups are kept only on a local volume and the Administrator panel shows a permanent warning.
- Recommended server location in the European Economic Area (GDPR, [§13.2](13-non-functional.md)).

## 15.3 Configuration (Twelve-Factor App)

- All configuration is passed via **environment variables**; the system's own variables use the `TRYBUN_` prefix ([§1.4](01-overview.md)). They are validated at start-up; invalid or missing values stop the service with a clear message ([§14.4](14-architecture.md)). `.env.example` contains the full list of variables with descriptions (Rule 5).
- Variables read implicitly by a library keep the library's name (e.g. `DATABASE_URL` for Prisma, `AUTH_SECRET` and `NEXTAUTH_URL` for Auth.js 4), like the variables of third-party components ([§1.4](01-overview.md)); every other own setting uses the `TRYBUN_` prefix.
- The web application reads its configuration only on the server at runtime; `NEXT_PUBLIC_*` variables are not used, because the same image is used by every installation ([§14.2](14-architecture.md)).
- Object storage of the attachments ([§13.3](13-non-functional.md)): SeaweedFS runs in Compose by default (profile `seaweedfs`). Setting variables switches to any external S3-compatible storage (SeaweedFS is then not started – Compose profiles). The API and the Worker read:
  - `TRYBUN_S3_URL` – the URL of the bucket with an optional folder, in the form of `TRYBUN_BACKUP_S3_URL` (e.g. `https://s3.eu-central-1.amazonaws.com/my-bucket/trybun`): the origin is the endpoint, the first path segment the bucket, the rest the folder of the objects (`{folder}/quarantine/{id}`, `{folder}/available/{id}`). Default `http://seaweedfs:8333/trybun` in Compose and `http://localhost:8333/trybun` for `pnpm dev`; commented out in `.env.example`, so the Compose default applies; The API, the backup service and `./trybun restore` accept the same URLs: `http(s)://host[:port]/bucket[/folder]`, a host name of letters, digits, `.`, `_` and `-` (or an IP address in brackets), folder segments of letters, digits and `._~%+,:@=!-`, no `.` or `..` segment, no credentials, query or fragment.
  - `TRYBUN_S3_ACCESS_KEY_ID` and `TRYBUN_S3_SECRET_ACCESS_KEY` – the credentials of SeaweedFS of Compose or of the external storage; required by the API and the Worker with any storage (`./trybun install` generates them, [§15.5](#155-installation));
  - `TRYBUN_S3_REGION` – the region, for providers that need one (default `us-east-1`).

  Requests use path-style addressing, which SeaweedFS needs and S3-compatible providers support. The API creates the bucket at start-up when it is missing; when the storage refuses, it logs a warning and `/health/ready` reports the storage as `degraded` ([§17.2](17-conventions.md)). Every backup copies the folder of `TRYBUN_S3_URL`, on SeaweedFS and on an external storage alike, and a restore replaces its content, so the folder must belong to the installation alone ([§15.10](#1510-backups)). The storage is chosen before the first upload: objects are never moved between storages.
- Malware scanning: `TRYBUN_CLAMAV_URL` – clamd over TCP (default `tcp://clamav:3310` in Compose, `tcp://localhost:3310` for `pnpm dev`; commented out in `.env.example`). The ClamAV service (profile `clamav`) mounts `docker/clamav/clamd.conf` of the deployment package, which never reports a file it could not scan completely as clean ([ADR 0008](../adr/0008-attachment-serving.md)).
- `TRYBUN_ATTACHMENT_MAX_SIZE_MB` – the maximum size of one attachment, 1–100 (default 25, [§13.3](13-non-functional.md)), read by the API and by the web application, which refuses a larger file before sending it.
- Sign-in providers are enabled only when their variables are set: `TRYBUN_GITHUB_CLIENT_ID` and `TRYBUN_GITHUB_CLIENT_SECRET` (team sign-in, [§7.4](07-users-organizations-permissions.md)), `TRYBUN_MICROSOFT_*` and `TRYBUN_GOOGLE_*` (optional end-user sign-in). A provider without configuration is not shown on the login screen, nor on the invitation page, whose web container reads `TRYBUN_MICROSOFT_CLIENT_ID` and `TRYBUN_GOOGLE_CLIENT_ID` to offer them.
- Secrets are never stored in the repository or in images ([§13.5](13-non-functional.md)).

## 15.4 Releases

- Versions follow **Semantic Versioning** and are produced by release-please from Conventional Commits; a human releases by merging the release pull request. Full rules: Rule 11 ([§2.11](02-agent-rules.md)).
- The web application is built in Next.js `standalone` mode for its container image; the internal API address is configured with an environment variable.
- Images are built **in CI** (GitHub Actions), tagged with the version and published to GitHub Container Registry as `ghcr.io/trybun/<service>` ([§1.4](01-overview.md)):
  - `web` – the web application,
  - `server` – the API and the Worker, which run from the same image with different commands ([§14.6](14-architecture.md)),
  - `postgres` – PostgreSQL with pgvector and the Polish full-text dictionary ([§14.4](14-architecture.md)), based on the official pgvector image pinned to a digest;
  - `backup` – the backup service ([§15.10](#1510-backups)): restic, rclone and the PostgreSQL client of the same major version, based on the official PostgreSQL Alpine image pinned to a digest.

  The server only pulls ready images.
- Every release is published as a GitHub Release and contains a **deployment package**: `compose.yaml`, `.env.example`, Caddy configuration, Keycloak configuration, the `trybun` script, an installation guide (`INSTALL.md`) and `CHANGELOG.md`. `trybun` is one POSIX shell script with a subcommand per task – `install` and `setup-token` ([§15.5](#155-installation), [§15.6](#156-first-run-wizard)), `update`, `restore` and `backup` ([§15.7](#157-updates), [§15.10](#1510-backups)), and `uninstall` ([§15.5](#155-installation)) – and needs no Node.js on the server. Its `compose.yaml` pulls the images of the release (`X.Y.Z`) and builds nothing. The release also contains the SBOM of every image and a `SHA256SUMS` file with the checksums of all its files. Source code is not needed for installation.
- `CHANGELOG.md` follows the *Keep a Changelog* convention and is generated from commit messages in the Conventional Commits format. Release notes clearly mark breaking changes and any manual steps.

### Releasing a PATCH version (example)

1. Fixes are merged into `main` as `fix:` commits through reviewed pull requests.
2. release-please updates its release pull request (e.g. "chore(release): 1.4.1") with the version and changelog entry.
3. Optionally, the maintainer publishes the release candidate `1.4.1-rc.1` (Rule 11), which is deployed to the test environment and verified.
4. The maintainer merges the release pull request – the decision to release.
5. Automation creates the tag `v1.4.1` and a draft GitHub Release, builds the images `ghcr.io/trybun/<service>:1.4.1`, scans them and creates their SBOMs, builds the deployment package and runs the restore test on them ([§13.6](13-non-functional.md)); a failed restore test stops the release.
6. The maintainer approves the publication; automation pushes the images (and moves `:1.4`, `:1`), attaches the SBOMs and the deployment package and publishes the release.
7. Administrators run the update script ([§15.7](#157-updates)).

If `main` already contains `feat:` commits, the release becomes a MINOR version. To release only a fix, use a maintenance branch `release/1.4.x` as described in Rule 11.

- Built images are scanned for vulnerabilities (Trivy) and every release includes an SBOM of each image (Syft, CycloneDX); no release ships with known critical vulnerabilities ([§2.10](02-agent-rules.md)): a vulnerability of severity `CRITICAL` in an image – with or without a fixed version – stops the release before anything is published, unless it is an accepted risk with an expiry date ([§2.10](02-agent-rules.md)).
- Published images are scanned again **every day** (`.github/workflows/image-scan.yml`, also with "Run workflow"), because new vulnerabilities are found in images that were clean when released: Trivy checks the images `X.Y` of the highest release and – for 6 months after the first release of a new MAJOR version – of the last release of the previous series ([§2.11](02-agent-rules.md)), and the images built from `main`, for vulnerabilities of severity `CRITICAL`, with the accepted risks of `.trivyignore.yaml`. The results are uploaded as SARIF to GitHub code scanning, one category per image and slot (`image-scan/<service>/main`, `current`, `previous`), so a finding opens an alert and a vulnerability that is gone closes it; a slot without an image uploads an empty result. The workflow uses no secrets and no environment and has read-only permissions plus `security-events: write` ([§2.10](02-agent-rules.md)).
- The "About" page of the Administrator panel shows the installed system version, the license and the "Support the project" link ([§16.6](16-open-source.md)).

## 15.5 Installation

Installing on a new server:

1. Prepare the server: install Docker Engine with the Compose plugin, point the domain to the server, open ports 80 and 443.
2. Download and unpack the deployment package of the chosen release.
3. Run the **install script**: `./trybun install`.
4. Finish the configuration in the **first-run wizard** in the browser ([§15.6](#156-first-run-wizard)).

**Install script** (`./trybun install`):

- **Checks prerequisites** and stops before it changes anything when one fails, saying what is wrong and how to fix it:
  - Docker Engine and the Docker Compose plugin in at least the oldest versions that support every feature of `compose.yaml` (today Docker Engine 25.0 and Compose 2.20.2, for the health check option `start_interval`); the versions are constants of the script, raised with `compose.yaml`;
  - total memory (`MemTotal`) of at least 8 GB (8 × 10⁹ bytes, so a server sold as "8 GB" passes), with a warning below 16 GB ([§15.2](#152-server-requirements));
  - free ports 80 and 443 (TCP, and 443 UDP for HTTP/3); ports held by the installation's own `caddy` container count as free, so a re-run on a running system passes;
  - the domain pointing to the server: when the addresses of the domain differ from those of the server, a warning with a confirmation, because servers behind NAT or with a floating IP do not see their public address.
- Asks for the domain, the default system language (`en` or `pl`) and the default time zone (default: the server's time zone, else `UTC`), validated as the server validates them at start-up. The Administrator's e-mail address is asked by the first-run wizard, where it is needed.
- **Generates all secrets** (database, Keycloak database, Valkey, SeaweedFS and Keycloak passwords, the `trybun-web` and `trybun-server` Keycloak client secrets, application keys, the backup passphrase) as 32 random bytes from `/dev/urandom`. The Administrator does not have to invent them.
- Prints the **backup passphrase** (`TRYBUN_BACKUP_PASSPHRASE`) once and requires the Administrator to type `stored` to confirm that it is kept outside the server; without it, off-site backups cannot be restored after the server is lost ([§15.10](#1510-backups)).
- Writes `.env` from `.env.example`, keeping its descriptions, with permissions restricted to the owner (mode `600`); it writes a temporary file and moves it into place only when no `.env` exists.
- Never overwrites an existing `.env`: when one exists, it skips the questions and the secrets, still runs the checks, starts the system and prints a new setup link while no Administrator exists – so re-running it is safe and resumes an interrupted installation.
- Without `.env`, stops before the questions when Docker volumes of the installation's Compose project already exist: the database keeps the passwords of the `.env` it was created with, so new secrets cannot use it. It names the volumes and the two ways on: copy back the `.env` of that installation, or delete the data.
- Finally starts the system (`docker compose up -d --wait`) and prints the first-run wizard URL with a **one-time setup token**.

**Uninstall** (`./trybun uninstall`):

- Removes Trybun from the server: the containers, networks and volumes of the installation's Compose project – both databases, the stored objects and the backups on the local volume – also of services whose profile is off, and the images of its services and containers. An image that another container of the server uses stays, with a warning. Docker itself and everything outside the project stay.
- Needs `.env` (the Compose file needs it). It first says what it deletes and what stays – the folder of the package with `.env`, and the backups on the external S3 storage – and, without external S3 storage, warns that no backup will remain anywhere.
- Deletes nothing until the Administrator types the domain of the installation (`TRYBUN_DOMAIN`).
- With external S3 storage, it first takes a last backup (tag `uninstall`); when it fails, nothing is deleted.
- Finally names the restore path (with S3) and the command that deletes the folder, after `.env` and the backup passphrase are kept outside the server. With nothing left, it reports that Trybun is not installed; so a re-run after a partial failure is safe.

Optional settings (SMTP server for outgoing e-mail, incoming e-mail provider, S3 storage for backups, GitHub App and GitHub sign-in, Microsoft and Google sign-in) can be filled in `.env` now or later. The same SMTP settings are used by the server and by Keycloak (password reset, e-mail verification). Until SMTP is configured, the system works but sends no e-mails, invitation links are copied manually ([§7.4](07-users-organizations-permissions.md)), and the Administrator panel shows a warning. Until GitHub sign-in is configured, only the break-glass Administrator can sign in as a team member, and inviting team members is disabled with an explanation ([§15.6](#156-first-run-wizard)).

**Keycloak on the same domain:**

- Keycloak is served on the same domain under the path `/auth` (`KC_HTTP_RELATIVE_PATH=/auth`, `KC_HOSTNAME=https://${TRYBUN_DOMAIN}/auth`), so no second DNS record or certificate is needed.
- Caddy exposes only `/auth/realms/trybun/*` and `/auth/resources/*`; the administration console is reachable only through an SSH tunnel ([§15.9](#159-container-configuration-rules)).
- The issuer of all tokens is `https://${TRYBUN_DOMAIN}/auth/realms/trybun`. The API validates this public issuer and fetches the signing keys (JWKS) over the internal network ([§14.4](14-architecture.md)).
- Keycloak stores its data in its own database (`keycloak`, with its own database user) in the same PostgreSQL instance as the system.

**Automatic Keycloak configuration:**

- Keycloak configuration (realm, clients, login flows, mandatory 2FA for the team, password policy and hashing algorithm with the blocklist of common passwords ([§7.4](07-users-organizations-permissions.md)), brute-force detection, session lifetimes, translated login screens, theme) is part of the repository and the deployment package (configuration as code).
- It is applied by **`keycloak-config-cli`** running as a one-off Compose service on installation and on every update ([§15.7](#157-updates)). Settings managed by Trybun are overwritten on every run, so new versions can change them; other settings an Administrator changes in Keycloak are left untouched. Every run applies the files, also when they are unchanged (the checksum cache of keycloak-config-cli is off), so a managed setting changed in the console is restored.
- Sign-in providers (GitHub, Microsoft, Google) are created only when their variables are set ([§15.3](#153-configuration-twelve-factor-app)); a provider whose variables are removed later stays in Keycloak until an Administrator deletes it. The SMTP settings are applied only when `TRYBUN_SMTP_HOST` is set.
- Team 2FA: the browser flow and the flow after every sign-in through a sign-in provider require a one-time password for members of the group `team` (through its realm role `team`); a member without one must set it up before the sign-in completes. The access tokens carry the authentication methods (`amr`) for the check of the API ([§14.4](14-architecture.md)).
- No manual configuration in the Keycloak admin console is required.

## 15.6 First-run wizard

- Available only while no Administrator account exists, and protected by the one-time setup token, so nobody else can take over a fresh installation. The token expires after **24 hours** or after first use. `./trybun setup-token` generates a new one (the `setup-token` command of the `server` image, run in the `api` container), which replaces every earlier token, so only the latest link works; once an Administrator exists, it refuses.
- The setup link is `https://<domain>/setup#token=<token>`: the token is in the URL fragment, which the browser never sends to a server, so it appears in no access log or `Referer` header; the wizard sends it in the request body.
- The API stores only a hash of the setup token (SHA-256) with its expiry (`setup_token`). The wizard endpoints require no session and return the same error (`setup.token_invalid`) for an unknown, expired, replaced or used token, and `setup.completed` once an Administrator exists. Rate limiting by client IP ([§14.4](14-architecture.md)) comes with plan task S0-14.
- The wizard is one step: the Administrator's first name, last name (both required by the user profile of Keycloak), e-mail address and password (with a show/hide toggle instead of a repeated field; the description under the field states the rule of the password policy, and the length is checked before submitting, [§7.4](07-users-organizations-permissions.md)), and their own language and time zone, prefilled with the system defaults. It shows the system default language and time zone read-only and explains that they are changed in `.env`, followed by `docker compose up -d --wait`.
- The API creates the Keycloak user through the Admin API with the password as a credential – Keycloak's password policy applies, and the system never stores or logs the password ([§7.4](07-users-organizations-permissions.md)) – as a member of the group `team` with the required action "configure OTP", then the account (`kind` `team`, Administrator, `active`), claiming the token in the same transaction with a conditional update, so of two simultaneous requests only one succeeds; when the transaction fails, the Keycloak user is deleted again. Keycloak itself then enforces the 2FA setup at the first sign-in, so the system implements no 2FA of its own ([§7.4](07-users-organizations-permissions.md)).
- After success, **Sign in** leads to the getting-started checklist. While no Administrator exists, the sign-in page points to the setup link instead of starting a sign-in no account could complete.
- Disabled permanently after completion.
- Afterwards the Administrator panel (`/admin`, the **Administration** item of the side navigation and, on phones, of the account menu) shows a **getting-started checklist**: create a project, configure GitHub sign-in (required before inviting team members), invite the team, create an organization (optional), configure e-mail, configure backup storage, connect the GitHub App (optional). Completed items are ticked automatically from the configuration and the data – nothing about the checklist is stored, so an item is never ticked while its setting is missing – and each links to the help page that explains it. Each item arrives with the task that builds its feature ("Configure backup storage" is ticked once `TRYBUN_BACKUP_S3_URL` is set, "Create an organization" once any organization exists, active or archived, "Invite the team" once a team account other than the first Administrator exists, `invited` or `active`, [§7.4](07-users-organizations-permissions.md)); "Configure e-mail" offers to send a test e-mail once the system sends e-mail.

## 15.7 Updates

An update to a new version is performed with one command of the deployment package, `./trybun update <version>` (e.g. `./trybun update 1.4.1`; the version is named, because a `0.x` release is never marked as the latest one, [§2.11](02-agent-rules.md)). The script:

1. Downloads the deployment package of the release from its GitHub Release and checks it against `SHA256SUMS`; it refuses a version that is not newer than the installed one (the default of `TRYBUN_VERSION` in `compose.yaml`) and a `TRYBUN_VERSION` set in `.env`, which would keep the old images.
2. Shows the entries of `CHANGELOG.md` between the installed and the new version – breaking changes and manual steps included – and asks for confirmation if the MAJOR version changes.
3. Pulls the images of the new version that are not on the server yet; if it fails, the update stops with nothing changed.
4. Creates an **automatic backup** of both databases, the objects and the configuration before any change, on the local backup volume and additionally on the external S3 storage if configured ([§15.10](#1510-backups)); if it fails, the update stops with nothing changed.
5. Replaces the files of the deployment package in the folder of the installation (`.env` is never changed).
6. Runs database migrations (as a one-off service before the API starts) and applies Keycloak configuration changes (`keycloak-config-cli`, [§15.5](#155-installation)).
7. Starts the new versions of the services and checks their health checks (`docker compose up -d --wait`).

If an update fails, the script prints the **restore** command with the ID of the backup taken before the update (`./trybun restore <backup>`), which restores it and starts the previous version, because the backup contains the files of the deployment package of that version. Changing the version number alone is not enough to roll back, because migrations may have changed the database schema.

## 15.8 HTTPS

The reverse proxy (Caddy) obtains and renews HTTPS certificates automatically. On a new server HTTPS works without manual configuration. HSTS is sent with `max-age=31536000; includeSubDomains` (without `preload`, so the Administrator can still move the domain) by the web application with its other security headers ([§13.5](13-non-functional.md)), and by Keycloak on its sign-in pages.

## 15.9 Container configuration rules

Containerization on Linux adds no significant performance overhead (containers are processes running on the host kernel, not virtual machines). To keep it that way:

- PostgreSQL, Valkey, SeaweedFS and local backup data is stored in **named volumes**, not in the container filesystem.
- Container logs use **rotation with a size limit**, so they do not fill the disk.
- Every service has a **memory limit**, so one service (e.g. ClamAV updating signatures) cannot starve the others.
- Every service has a **health check** and an automatic restart policy ([§17.2](17-conventions.md)): the API checks `/health`, the web application `/api/health`, the Worker the age of its heartbeat file (it has no HTTP server), the third-party services their own standard checks.
- Only the reverse proxy is exposed publicly. It routes `/socket.io` to the API, only the sign-in endpoints of Keycloak (`/auth/realms/trybun/*`, `/auth/resources/*`) to Keycloak, and everything else to the web application, including the BFF endpoint `/api/v1/*` and the incoming webhooks ([§14.4](14-architecture.md)). The Keycloak administration console, the API, the database, Valkey and SeaweedFS are reachable only on the internal Compose network (administration through an SSH tunnel).
- Networks: every service is on the network `internal`, which has no access to or from outside the server. Only the services that connect outside also join `outbound`: the API and the Worker (an external object storage, [§15.3](#153-configuration-twelve-factor-app); the Worker also the external services of its jobs), Keycloak (sign-in providers), ClamAV (signature updates), the backup service (the external S3 storage of the backups and an external object storage) and Caddy (the public ports).
- SeaweedFS, a service of an optional profile, is a dependency of the API and the Worker with `required: false`, so they wait for SeaweedFS to be healthy when its profile is on and start without it when an external storage is configured.
- Access logs of Caddy contain no query strings and no `Authorization` or `Cookie` headers ([§17.2](17-conventions.md)).

## 15.10 Backups

- A dedicated **backup service** in Compose (`backup`, image `ghcr.io/trybun/backup`, restic, [§14.2](14-architecture.md)) owns both scheduling and execution of backups, so backups also run when the application is down. The commands `backup`, `restore` and `update` of the `trybun` script run the same image as a one-off container.
- Every backup is one restic snapshot of one set: the system database and the Keycloak database (`pg_dump` in custom format, uncompressed so that restic deduplicates them), the objects of the storage folder of `TRYBUN_S3_URL` ([§15.3](#153-configuration-twelve-factor-app)) and the configuration – `.env` and the files of the deployment package, so a restore starts the version the backup was taken with. Valkey is not backed up: it holds only queues and caches ([§14.2](14-architecture.md)). The databases are dumped before the objects are copied, while the API and the Worker keep running, so rows and objects of a set can be out of step; they are reconciled after a restore ([§13.3](13-non-functional.md)).
- The objects: the backup service configures the rclone remote `objects` from the storage variables of [§15.3](#153-configuration-twelve-factor-app) (endpoint, credentials, region, path-style addressing; provider `SeaweedFS` when `TRYBUN_S3_URL` is on the SeaweedFS of Compose, `http://seaweedfs:8333`, else `Other` without bucket checks, because the API creates a missing bucket at start-up and an access key limited to its folder may not create one; a restore creates a missing bucket itself) and copies the folder `objects:{bucket}/{folder}` into `objects/` of the set, on the SeaweedFS of Compose and on an external storage alike; the file `layout` of the set records this. A set without `layout` was taken by an earlier release and holds the whole SeaweedFS of Compose; its restore takes the folder from its bucket and folder path there, or leaves the folder empty, the state of that time.
- Backups are encrypted with `TRYBUN_BACKUP_PASSPHRASE` ([§15.5](#155-installation)) and always stored in a restic repository on the local volume `backup-data`, and additionally in one on the external S3 storage configured in `.env` (`TRYBUN_BACKUP_S3_URL`, `TRYBUN_BACKUP_S3_ACCESS_KEY_ID`, `TRYBUN_BACKUP_S3_SECRET_ACCESS_KEY`, optional `TRYBUN_BACKUP_S3_REGION`); without external storage they are kept only on the local volume ([§15.2](#152-server-requirements)). The service creates missing repositories when it starts and stops with a clear message when a repository cannot be reached or the passphrase does not open it, so `docker compose up --wait` reports a wrong setting.
- Schedule and retention: daily at `TRYBUN_BACKUP_TIME` (`HH:MM` in UTC, default `03:00`); `restic forget --keep-daily N --keep-within Nd --prune` with `N` = `TRYBUN_BACKUP_KEEP_DAILY` (default 30, [§13.6](13-non-functional.md)), so the backups of the last 30 days and at least 30 daily ones are kept, relative to the newest backup.
- `./trybun backup` creates a backup now and prints its IDs; `./trybun backup list` lists the backups of both repositories.
- `./trybun restore [<backup>] [--test [--storage-url <url>]] [--replace-foreign-objects]` (default: the newest) asks for confirmation, stops all services, restores the snapshot from the local volume when it has it and else from the external S3 storage, brings back `.env` and the files of the deployment package, sets the passwords of the database users to those of `.env`, replaces both databases and the content of the storage folder of the restored `.env` – objects in the folder that are not in the backup are deleted – and starts the system. So it can restore onto a clean server from the deployment package of any release, the `.env` kept outside the server – or a new `.env` of `./trybun install` with the passphrase and the S3 settings of the old one – and the passphrase alone.
- **The restore guard**: every server has a server ID in `/backup/server-id` of the volume `backup-data`, outside everything a backup contains, so a restore never brings back another server's ID; the backup service creates it on first use (its start by `./trybun install`, or `./trybun restore` on a new server). The backup service writes the marker `{folder}/.trybun-installation` with that ID when it starts and with every backup, unless the marker names another server: then it logs an error and leaves it, since only a restore takes over a folder. Copy and restore exclude the marker, and the restore rewrites it with the restoring server's ID. Before it changes anything, `./trybun restore` reads the marker of the folder of the backup's `.env`: the own ID, or no marker in an empty folder (no object, or no bucket) → it continues; another ID – e.g. production, when its backup is restored onto a test server – → it asks a second question, "The storage folder {url} belongs to another Trybun server. Replace its content? [y/N]" (default no); objects without a marker, which may belong to another application → the same question, "The storage folder {url} holds objects but no Trybun marker. Replace its content? [y/N]". Without a terminal it refuses, unless `--replace-foreign-objects` is given. `restore-data` of the backup service checks the marker again and refuses such a folder without the flag. A disaster-recovery restore onto a new server with an external storage meets the question by design, because the folder still names the lost server. A backup whose `.env` uses the SeaweedFS of Compose cannot be restored while the `seaweedfs` profile of the current `.env` is off: the marker cannot be read, and the restore stops with nothing changed.
- **The storage folder and the backup repository** must not overlap: a backup into a repository inside the storage folder would copy the repository into itself, and a restore would delete it. The backup service compares the folder of `TRYBUN_S3_URL` with the repository of `TRYBUN_BACKUP_S3_URL` (restic's `s3:` prefix removed, `https://` when it names no scheme; origins in lower case without a default port) and refuses a backup, its start and `restore-data` when one contains the other on the same endpoint; `./trybun restore` refuses a target folder that overlaps the repository of the current or of the backup's `.env`.
- **A test restore**: `--test` (before or after the backup ID) marks a test restore, e.g. the quarterly one on a separate server while production runs ([§13.6](13-non-functional.md)). It empties `TRYBUN_BACKUP_S3_URL` of the restored `.env` (the line stays, the unused `TRYBUN_BACKUP_S3_*` credentials too) and says so: the backups of the test server, under the same restic host name, would otherwise go into the repository of the server it copies and its daily `forget` would prune that server's snapshots; the test server makes no off-site backups until the Administrator sets a repository of its own. When the backup's attachments are not on the SeaweedFS of Compose, the backed-up installation may still use their folder, so `--test` requires `--storage-url` and is refused without it before anything changes.
- **A restore into another folder**: `--storage-url <url>`, accepted only with `--test`, restores the objects into the folder of `<url>` instead – a restore into an isolated target. `./trybun` validates `<url>` before it changes anything, as the server validates `TRYBUN_S3_URL` ([§15.3](#153-configuration-twelve-factor-app)): `http` or `https` in any case, a bucket name, an optional folder without `.` or `..` segments, no credentials, query or fragment; the backup service validates `TRYBUN_S3_URL` with the same rules and never logs credentials of a URL. After the backup's `.env` is brought back, its `TRYBUN_S3_URL` is replaced by `<url>` – the lines of the `.env` are read as Docker Compose reads them (`export `, blanks, quotes, ` #` comments) – and the S3 credentials stay those of the backup's `.env`, so the folder must be writable with them. The guard reads the marker of that folder (an empty one asks no question) through `storage-owner <url>` of the backup service, which also refuses a folder that contains the backup's folder or lies inside it (same origin, compared without a default port); `restore-data` repeats that check with the backup's `TRYBUN_S3_URL`, so the restore never changes the backup's folder. Without a terminal, the refusal of a folder of another server names `--test`.
- `./trybun uninstall` ([§15.5](#155-installation)) deletes the backups on the local volume and keeps those on the external S3 storage, after a last backup to it.
- Backups offered by the VPS provider (whole-machine snapshots) can be an additional safeguard but do not replace backups in another location.

## 15.11 Growth path

A single server is a single point of failure; this must be reflected in the declared availability and in SLA agreements with customers ([09-sla.md](09-sla.md)). When load or availability requirements grow, the same images can run on Kubernetes and the database can move to a managed service, without changes to the application.

## 15.12 Local development environment

The local environment starts with one command after cloning the repository (Rule 5, [§2.5](02-agent-rules.md)).

**Prerequisites:** Docker Engine (or Docker Desktop) with the Compose plugin, Node.js in the version from `.node-version` (LTS), and pnpm enabled through Corepack (`corepack enable`; the version comes from the `packageManager` field); ShellCheck for `pnpm lint`. At least 8 GB RAM; ClamAV can be disabled locally with a Compose profile when memory is short (uploads then stay in quarantine, [§17.2](17-conventions.md)).

**Starting:**

```
pnpm install
pnpm dev
```

`pnpm dev`:

1. starts the infrastructure with `docker compose -f compose.yaml -f compose.dev.yaml up -d --wait` as the Compose project `trybun-dev`, apart from an installation's project `trybun` on the same machine: PostgreSQL, Valkey, SeaweedFS, Keycloak, ClamAV and Mailpit;
2. applies the Keycloak configuration with the **development realm overlay**: seeded team accounts that sign in with a password and a TOTP secret listed in `README.md` ([§7.4](07-users-organizations-permissions.md)), imported by Keycloak on the first start of its database so they keep their fixed IDs – before keycloak-config-cli applies the password policy ([§7.4](07-users-organizations-permissions.md)), so they keep their short password – and a `trybun-web` client for `http://localhost:3000`;
3. runs the database migrations and loads the seed and demo data (seeded Keycloak users and database users share fixed IDs). The demo team accounts have completed every product tour, except the newcomer (`newcomer@example.com`), who has no tour progress for trying the tours and their E2E tests; loading the demo data again restores this progress ([§2.4](02-agent-rules.md)); two end users sign in to the portal with a password only – the customer (`customer@customer.example.com`, one project, tickets in every public status) and the partner (`partner@customer.example.com`, two projects) ([§5.7](05-visibility-and-search.md));
4. starts the applications on the host with hot reload (`turbo dev`): the web application on `http://localhost:3000`, the API and the Worker.

Mailpit shows all outgoing e-mail on `http://localhost:8025`. Session cookies are not marked `Secure` only on `localhost`.

**Other commands** (listed in `README.md` and `AGENTS.md`): `pnpm test` (unit tests), `pnpm test:integration` (integration tests with Testcontainers), `pnpm test:coverage` (unit and integration tests with the coverage thresholds of CI), `pnpm e2e` (Playwright), `pnpm lint`, `pnpm lint:spec` (specification references), `pnpm typecheck`, `pnpm build`, `pnpm db:migrate`, `pnpm db:seed`.
