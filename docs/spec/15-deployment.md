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
- Object storage: SeaweedFS runs in Compose by default. Setting variables switches to any external S3-compatible storage (SeaweedFS is then not started – Compose profiles).
- Sign-in providers are enabled only when their variables are set: `TRYBUN_GITHUB_CLIENT_ID` and `TRYBUN_GITHUB_CLIENT_SECRET` (team sign-in, [§7.4](07-users-organizations-permissions.md)), `TRYBUN_MICROSOFT_*` and `TRYBUN_GOOGLE_*` (optional end-user sign-in). A provider without configuration is not shown on the login screen.
- Secrets are never stored in the repository or in images ([§13.5](13-non-functional.md)).

## 15.4 Releases

- Versions follow **Semantic Versioning** and are produced by release-please from Conventional Commits; a human releases by merging the release pull request. Full rules: Rule 11 ([§2.11](02-agent-rules.md)).
- The web application is built in Next.js `standalone` mode for its container image; the internal API address is configured with an environment variable.
- Images are built **in CI** (GitHub Actions), tagged with the version and published to GitHub Container Registry as `ghcr.io/trybun/<service>` ([§1.4](01-overview.md)):
  - `web` – the web application,
  - `server` – the API and the Worker, which run from the same image with different commands ([§14.6](14-architecture.md)),
  - `postgres` – PostgreSQL with pgvector and the Polish full-text dictionary ([§14.4](14-architecture.md)), based on the official pgvector image pinned to a digest.

  The server only pulls ready images.
- Every release is published as a GitHub Release and contains a **deployment package**: `compose.yaml`, `.env.example`, Caddy configuration, Keycloak configuration, the install, update, restore and backup scripts and an installation guide (`INSTALL.md`). Source code is not needed for installation.
- `CHANGELOG.md` follows the *Keep a Changelog* convention and is generated from commit messages in the Conventional Commits format. Release notes clearly mark breaking changes and any manual steps.

### Releasing a PATCH version (example)

1. Fixes are merged into `main` as `fix:` commits through reviewed pull requests.
2. release-please updates its release pull request (e.g. "release 1.4.1") with the version and changelog entry.
3. Optionally, the build from `main` is deployed to the test environment and verified.
4. The maintainer merges the release pull request – the only manual decision.
5. Automation creates the tag `v1.4.1` and the GitHub Release, builds and scans the images `ghcr.io/trybun/<service>:1.4.1` (and moves `:1.4`, `:1`), attaches the SBOM and the deployment package.
6. Administrators run the update script ([§15.7](#157-updates)).

If `main` already contains `feat:` commits, the release becomes a MINOR version. To release only a fix, use a maintenance branch `release/1.4.x` as described in Rule 11.

- Built images are scanned for vulnerabilities and every release includes an SBOM; no release ships with known critical vulnerabilities ([§2.10](02-agent-rules.md)).
- The "About" page of the Administrator panel shows the installed system version, the license and the "Support the project" link ([§16.6](16-open-source.md)).

## 15.5 Installation

Installing on a new server:

1. Prepare the server: install Docker Engine with the Compose plugin, point the domain to the server, open ports 80 and 443.
2. Download and unpack the deployment package of the chosen release.
3. Run the **install script**.
4. Finish the configuration in the **first-run wizard** in the browser ([§15.6](#156-first-run-wizard)).

**Install script:**

- Checks prerequisites: Docker and Compose versions, available RAM ([§15.2](#152-server-requirements)), free ports 80 and 443, the domain pointing to the server.
- Asks a few questions: domain, Administrator e-mail, default system language, time zone.
- **Generates all secrets** (database, Keycloak database, Valkey, SeaweedFS and Keycloak passwords, the `trybun-web` and `trybun-server` Keycloak client secrets, application keys, the backup passphrase) as cryptographically random values. The Administrator does not have to invent them.
- Prints the **backup passphrase** (`TRYBUN_BACKUP_PASSPHRASE`) once and requires the Administrator to confirm that it is stored outside the server; without it, off-site backups cannot be restored after the server is lost ([§15.10](#1510-backups)).
- Writes `.env` with permissions restricted to the owner.
- Never overwrites an existing `.env`, so re-running it is safe.
- Finally starts the system and prints the first-run wizard URL with a **one-time setup token**.

Optional settings (SMTP server for outgoing e-mail, incoming e-mail provider, S3 storage for backups, GitHub App and GitHub sign-in, Microsoft and Google sign-in) can be filled in `.env` now or later. The same SMTP settings are used by the server and by Keycloak (password reset, e-mail verification). Until SMTP is configured, the system works but sends no e-mails, invitation links are copied manually ([§7.4](07-users-organizations-permissions.md)), and the Administrator panel shows a warning. Until GitHub sign-in is configured, only the break-glass Administrator can sign in as a team member, and inviting team members is disabled with an explanation ([§15.6](#156-first-run-wizard)).

**Keycloak on the same domain:**

- Keycloak is served on the same domain under the path `/auth` (`KC_HTTP_RELATIVE_PATH=/auth`, `KC_HOSTNAME=https://${TRYBUN_DOMAIN}/auth`), so no second DNS record or certificate is needed.
- Caddy exposes only `/auth/realms/trybun/*` and `/auth/resources/*`; the administration console is reachable only through an SSH tunnel ([§15.9](#159-container-configuration-rules)).
- The issuer of all tokens is `https://${TRYBUN_DOMAIN}/auth/realms/trybun`. The API validates this public issuer and fetches the signing keys (JWKS) over the internal network ([§14.4](14-architecture.md)).
- Keycloak stores its data in its own database (`keycloak`, with its own database user) in the same PostgreSQL instance as the system.

**Automatic Keycloak configuration:**

- Keycloak configuration (realm, clients, login flows, mandatory 2FA for the team, brute-force detection, session lifetimes, translated login screens, theme) is part of the repository and the deployment package (configuration as code).
- It is applied by **`keycloak-config-cli`** running as a one-off Compose service on installation and on every update ([§15.7](#157-updates)). Settings managed by Trybun are overwritten on every run, so new versions can change them; other settings an Administrator changes in Keycloak are left untouched. Every run applies the files, also when they are unchanged (the checksum cache of keycloak-config-cli is off), so a managed setting changed in the console is restored.
- Sign-in providers (GitHub, Microsoft, Google) are created only when their variables are set ([§15.3](#153-configuration-twelve-factor-app)); a provider whose variables are removed later stays in Keycloak until an Administrator deletes it. The SMTP settings are applied only when `TRYBUN_SMTP_HOST` is set.
- Team 2FA: the browser flow and the flow after every sign-in through a sign-in provider require a one-time password for members of the group `team` (through its realm role `team`); a member without one must set it up before the sign-in completes. The access tokens carry the authentication methods (`amr`) for the check of the API ([§14.4](14-architecture.md)).
- No manual configuration in the Keycloak admin console is required.

## 15.6 First-run wizard

- Available only while no Administrator account exists, and protected by the one-time setup token, so nobody else can take over a fresh installation. The token expires after **24 hours** or after first use; a new one can be generated with the install script.
- The API stores only a hash of the setup token with its expiry. The wizard endpoint requires no session, is rate-limited ([§14.4](14-architecture.md)) and returns the same error for an unknown, expired or used token.
- Guides through: creating the first Administrator account, confirming the default language and time zone, sending a test e-mail (if an e-mail provider is configured). The API creates the Keycloak user through the Admin API with the required actions "set password" and "configure OTP"; Keycloak itself then enforces the password and 2FA setup at the first sign-in, so the system implements no 2FA of its own ([§7.4](07-users-organizations-permissions.md)).
- Disabled permanently after completion.
- Afterwards the Administrator panel shows a **getting-started checklist**: create a project, configure GitHub sign-in (required before inviting team members), invite the team, create an organization (optional), configure e-mail, configure backup storage, connect the GitHub App (optional). Completed items are ticked automatically.

## 15.7 Updates

An update to a new version is performed with one command of the update script included in the deployment package. The script:

1. Shows breaking changes and manual steps from the release notes and asks for confirmation if the MAJOR version changes.
2. Creates an **automatic backup** of both databases and the configuration before any change, on a local backup volume and additionally on the external S3 storage if configured ([§15.10](#1510-backups)).
3. Pulls the new images.
4. Runs database migrations (as a one-off service before the API starts) and applies Keycloak configuration changes (`keycloak-config-cli`, [§15.5](#155-installation)).
5. Starts the new versions of the services and checks their health checks.

If an update fails, the **restore** command restores the backup taken before the update and starts the previous version. Changing the version number alone is not enough to roll back, because migrations may have changed the database schema.

## 15.8 HTTPS

The reverse proxy (Caddy) obtains and renews HTTPS certificates automatically. On a new server HTTPS works without manual configuration. HSTS is sent with `max-age=31536000; includeSubDomains` (without `preload`, so the Administrator can still move the domain).

## 15.9 Container configuration rules

Containerization on Linux adds no significant performance overhead (containers are processes running on the host kernel, not virtual machines). To keep it that way:

- PostgreSQL, Valkey, SeaweedFS and local backup data is stored in **named volumes**, not in the container filesystem.
- Container logs use **rotation with a size limit**, so they do not fill the disk.
- Every service has a **memory limit**, so one service (e.g. ClamAV updating signatures) cannot starve the others.
- Every service has a **health check** and an automatic restart policy ([§17.2](17-conventions.md)): the API checks `/health`, the web application `/api/health`, the Worker the age of its heartbeat file (it has no HTTP server), the third-party services their own standard checks.
- Only the reverse proxy is exposed publicly. It routes `/socket.io` to the API, only the sign-in endpoints of Keycloak (`/auth/realms/trybun/*`, `/auth/resources/*`) to Keycloak, and everything else to the web application, including the BFF endpoint `/api/v1/*` and the incoming webhooks ([§14.4](14-architecture.md)). The Keycloak administration console, the API, the database, Valkey and SeaweedFS are reachable only on the internal Compose network (administration through an SSH tunnel).
- Access logs of Caddy contain no query strings and no `Authorization` or `Cookie` headers ([§17.2](17-conventions.md)).

## 15.10 Backups

- A dedicated **backup service** in Compose (restic, [§14.2](14-architecture.md)) owns both scheduling and execution of backups, so backups also run when the application is down.
- Every backup is one consistent set of: the system database and the Keycloak database (`pg_dump` in custom format), the object storage bucket and the `.env` configuration.
- Backups are encrypted with `TRYBUN_BACKUP_PASSPHRASE` ([§15.5](#155-installation)) and stored on the external S3 storage configured in `.env`; without external storage they are kept only on a local volume ([§15.2](#152-server-requirements)).
- Schedule and retention: daily, keeping 30 daily backups by default (configurable, [§13.6](13-non-functional.md)).
- The update script ([§15.7](#157-updates)) and the restore command use the same service. The restore command can restore onto a clean server from the deployment package, `.env` and the passphrase alone.
- Backups offered by the VPS provider (whole-machine snapshots) can be an additional safeguard but do not replace backups in another location.

## 15.11 Growth path

A single server is a single point of failure; this must be reflected in the declared availability and in SLA agreements with customers ([09-sla.md](09-sla.md)). When load or availability requirements grow, the same images can run on Kubernetes and the database can move to a managed service, without changes to the application.

## 15.12 Local development environment

The local environment starts with one command after cloning the repository (Rule 5, [§2.5](02-agent-rules.md)).

**Prerequisites:** Docker Engine (or Docker Desktop) with the Compose plugin, Node.js in the version from `.node-version` (LTS), and pnpm enabled through Corepack (`corepack enable`; the version comes from the `packageManager` field). At least 8 GB RAM; ClamAV can be disabled locally with a Compose profile when memory is short (uploads then stay in quarantine, [§17.2](17-conventions.md)).

**Starting:**

```
pnpm install
pnpm dev
```

`pnpm dev`:

1. starts the infrastructure with `docker compose -f compose.yaml -f compose.dev.yaml up -d --wait`: PostgreSQL, Valkey, SeaweedFS, Keycloak, ClamAV and Mailpit;
2. applies the Keycloak configuration with the **development realm overlay**: seeded team accounts that sign in with a password and a TOTP secret listed in `README.md` ([§7.4](07-users-organizations-permissions.md)), imported by Keycloak on the first start of its database so they keep their fixed IDs, and a `trybun-web` client for `http://localhost:3000`;
3. runs the database migrations and loads the seed and demo data (seeded Keycloak users and database users share fixed IDs). The demo team accounts have completed every product tour, except the newcomer (`newcomer@example.com`), who has no tour progress for trying the tours and their E2E tests; loading the demo data again restores this progress ([§2.4](02-agent-rules.md));
4. starts the applications on the host with hot reload (`turbo dev`): the web application on `http://localhost:3000`, the API and the Worker.

Mailpit shows all outgoing e-mail on `http://localhost:8025`. Session cookies are not marked `Secure` only on `localhost`.

**Other commands** (listed in `README.md` and `AGENTS.md`): `pnpm test` (unit tests), `pnpm test:integration` (integration tests with Testcontainers), `pnpm test:coverage` (unit and integration tests with the coverage thresholds of CI), `pnpm e2e` (Playwright), `pnpm lint`, `pnpm lint:spec` (specification references), `pnpm typecheck`, `pnpm build`, `pnpm db:migrate`, `pnpm db:seed`.
