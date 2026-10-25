# Installing Trybun

This folder is the deployment package of one Trybun release. It runs the published images `ghcr.io/trybun/web`, `ghcr.io/trybun/server` and `ghcr.io/trybun/postgres` of this release with Docker Compose; the source code is not needed.

## Requirements

- A Linux server with Docker Engine 25.0 or newer and the Docker Compose plugin 2.20.2 or newer.
- At least 8 GB RAM, 16 GB recommended.
- A domain pointing to the server, and ports 80 and 443 open and free: Caddy obtains the HTTPS certificate automatically.

The install script checks these requirements and stops before it changes anything if one is not met.

## Contents

| File | Purpose |
|---|---|
| `trybun` | The command of the package: `./trybun install`, `./trybun setup-token`, `./trybun --help` |
| `compose.yaml` | All services, pinned to the images of this release |
| `.env.example` | Every setting with its description |
| `docker/caddy/` | Configuration of the reverse proxy |
| `docker/keycloak/` | Configuration of the sign-in (Keycloak), applied on every start |
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

Optional settings (e-mail, sign-in providers) are described next to their variables in `.env`. A change of `.env` takes effect after running `docker compose up -d --wait` again.

Keep `.env` and the backup passphrase safe: `.env` holds every password of the installation.
