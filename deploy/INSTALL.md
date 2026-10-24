# Installing Trybun

This folder is the deployment package of one Trybun release. It runs the published images `ghcr.io/trybun/web`, `ghcr.io/trybun/server` and `ghcr.io/trybun/postgres` of this release with Docker Compose; the source code is not needed.

## Requirements

- A Linux server with Docker Engine and the Docker Compose plugin.
- At least 8 GB RAM, 16 GB recommended.
- A domain pointing to the server, and ports 80 and 443 open: Caddy obtains the HTTPS certificate automatically.

## Contents

| File | Purpose |
|---|---|
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

2. Create the configuration, readable only by its owner:

   ```sh
   cp .env.example .env
   chmod 600 .env
   ```

3. In `.env`, set `TRYBUN_DOMAIN` to the domain, and replace every password and secret with a random value of letters and digits, e.g. the output of `openssl rand -hex 32`. Optional settings (e-mail, sign-in providers) are described next to their variables.

4. Start Trybun:

   ```sh
   docker compose up -d --wait
   ```

Trybun answers on `https://<domain>`. A change of `.env` takes effect after running `docker compose up -d --wait` again.
