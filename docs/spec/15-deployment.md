# 15 – Hosting and deployment

## 15.1 Principle

The system must run on **any Linux VPS**, without depending on services of a specific provider. The target deployment method from the first version is **Docker Compose**. Moving to another server means copying the configuration and running one command.

Development and test environments (e.g. a VPS at OVH) use the same Compose file as production, with an additional override file for development settings. What is tested is exactly what goes to production.

## 15.2 Server requirements

- Linux with Docker Engine and the Docker Compose plugin.
- At least 8 GB RAM, 16 GB recommended (one server runs, among others, PostgreSQL, Redis, Keycloak and ClamAV).
- Access to external S3-compatible storage in a different location than the server – for backups ([§15.10](#1510-backups)).
- Recommended server location in the European Economic Area (GDPR, [§13.2](13-non-functional.md)).

## 15.3 Configuration (Twelve-Factor App)

- All configuration is passed via **environment variables**; the system's own variables use the `TRYBUN_` prefix ([§1.4](01-overview.md)). `.env.example` contains the full list of variables with descriptions (Rule 5).
- Object storage: MinIO runs in Compose by default. Setting variables switches to any external S3-compatible storage (MinIO is then not started – Compose profiles).
- Secrets are never stored in the repository or in images ([§13.5](13-non-functional.md)).

## 15.4 Releases

- Versions follow **Semantic Versioning**: `MAJOR.MINOR.PATCH`. A MAJOR change means changes that require the Administrator's attention.
- Images are built **in CI** (GitHub Actions), tagged with the version and published to GitHub Container Registry as `ghcr.io/trybun/<service>` ([§1.4](01-overview.md)). The server only pulls ready images.
- Every release is published as a GitHub Release and contains a **deployment package**: `compose.yaml`, `.env.example`, Caddy configuration, Keycloak configuration, the install and update scripts and an installation guide (`INSTALL.md`). Source code is not needed for installation.
- `CHANGELOG.md` follows the *Keep a Changelog* convention and is generated from commit messages in the Conventional Commits format. Release notes clearly mark breaking changes and any manual steps.
- The "About" page of the Administrator panel shows the installed system version, the license and the "Support the project" link ([§16.6](16-open-source.md)).

## 15.5 Installation

Installing on a new server:

1. Prepare the server: install Docker Engine with the Compose plugin, point the domain to the server, open ports 80 and 443.
2. Download and unpack the deployment package of the chosen release.
3. Run the **install script**.
4. Finish the configuration in the **first-run wizard** in the browser ([§15.6](#156-first-run-wizard)).

**Install script:**

- Checks prerequisites: Docker and Compose versions, available RAM, free ports 80 and 443, the domain pointing to the server.
- Asks a few questions: domain, Administrator e-mail, default system language, time zone.
- **Generates all secrets** (database, Redis, MinIO and Keycloak passwords, application keys) as cryptographically random values. The Administrator does not have to invent them.
- Writes `.env` with permissions restricted to the owner.
- Never overwrites an existing `.env`, so re-running it is safe.
- Finally starts the system and prints the first-run wizard URL with a **one-time setup token**.

Optional settings (e-mail provider, S3 storage for backups, GitHub App) can be filled in `.env` now or later.

**Automatic Keycloak configuration:**

- Keycloak configuration (realm, clients, login flows, mandatory 2FA for the team, translated login screens, theme) is part of the repository and the deployment package (configuration as code).
- It is imported automatically on first start, and configuration changes in new versions are applied during updates. No manual configuration in the Keycloak admin console is required.

## 15.6 First-run wizard

- Available only while no Administrator account exists, and protected by the one-time setup token, so nobody else can take over a fresh installation.
- Guides through: creating the first Administrator account (with 2FA setup), confirming the default language and time zone, sending a test e-mail (if an e-mail provider is configured).
- Disabled permanently after completion.

## 15.7 Updates

An update to a new version is performed with one command of the update script included in the deployment package. The script:

1. Shows breaking changes and manual steps from the release notes and asks for confirmation if the MAJOR version changes.
2. Creates an **automatic backup** of the database and configuration before any change.
3. Pulls the new images.
4. Runs database migrations (as a one-off service before the API starts) and applies Keycloak configuration changes.
5. Starts the new versions of the services and checks their health checks.

If an update fails, the **restore** command restores the backup taken before the update and starts the previous version. Changing the version number alone is not enough to roll back, because migrations may have changed the database schema.

## 15.8 HTTPS

The reverse proxy (Caddy) obtains and renews HTTPS certificates automatically. On a new server HTTPS works without manual configuration.

## 15.9 Container configuration rules

Containerization on Linux adds no significant performance overhead (containers are processes running on the host kernel, not virtual machines). To keep it that way:

- PostgreSQL, Redis and MinIO data is stored in **named volumes**, not in the container filesystem.
- Container logs use **rotation with a size limit**, so they do not fill the disk.
- Every service has a **memory limit**, so one service (e.g. ClamAV updating signatures) cannot starve the others.
- Every service has a **health check** and an automatic restart policy.
- Only the reverse proxy is exposed publicly. The database, Redis, MinIO and Keycloak's internals are reachable only on the internal Compose network.

## 15.10 Backups

- A backup service in Compose creates encrypted backups of the database and the object storage to the external S3 storage configured in `.env` ([§13.6](13-non-functional.md)).
- Backups offered by the VPS provider (whole-machine snapshots) can be an additional safeguard but do not replace backups in another location.

## 15.11 Growth path

A single server is a single point of failure; this must be reflected in the declared availability and in SLA agreements with customers ([09-sla.md](09-sla.md)). When load or availability requirements grow, the same images can run on Kubernetes and the database can move to a managed service, without changes to the application.
