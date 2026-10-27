# Trybun

**Trybun** is an open-source ticket system that connects customer requests with developer workflow: it receives tickets from the development team, end users and integrations, and combines handling them with work planning (roadmap, Gantt chart) and GitHub integration.

The project is delivered with an **AI Engineering** approach: AI agents write the code, tests and documentation, and humans define the requirements and review and approve every change. The system specification in [`docs/spec/`](docs/spec/README.md) is the source of truth; the [implementation plan](docs/plan/implementation-plan.md) shows what is built and what comes next.

> **Status:** Stage 0 (foundation) is in progress. The repository contains the monorepo skeleton; there are no user-facing features yet.

## Prerequisites

- **Node.js** in the version from [`.node-version`](.node-version) (24 LTS)
- **pnpm** enabled through Corepack: `corepack enable` (the version comes from the `packageManager` field of [`package.json`](package.json))
- **Docker** with the Compose plugin – runs the infrastructure services and the integration tests (Testcontainers)
- **Chromium** for the component tests, installed once after `pnpm install`: `pnpm --filter @trybun/ui exec playwright install chromium`
- **ShellCheck** for `pnpm lint`, which checks the shell scripts (`trybun`, the backup service, the restore test): `apt install shellcheck` (preinstalled on the CI runners)

## Getting started

```sh
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev` starts the infrastructure in Docker Compose (`compose.yaml` with `compose.dev.yaml`: PostgreSQL, Valkey, SeaweedFS, Keycloak, ClamAV and Mailpit, ports bound to `127.0.0.1`), applies the Keycloak configuration, runs the database migrations, loads the demo dataset, and then starts the web application on <http://localhost:3000>, the API on <http://localhost:3001/api/v1> and the Worker. Keycloak answers on <http://localhost:8080/auth>, Mailpit shows all outgoing e-mail on <http://localhost:8025>. When memory is short, remove `clamav` from `COMPOSE_PROFILES` in `.env`. A change of the API or the Worker rebuilds and restarts both ([§15.12](docs/spec/15-deployment.md)); `docker compose -f compose.yaml -f compose.dev.yaml down` stops the infrastructure.

### Signing in locally

Opening <http://localhost:3000> leads to the Keycloak login screen. In the local environment only, the seeded team accounts of the demo dataset sign in with a password ([§7.4](docs/spec/07-users-organizations-permissions.md)), so no GitHub OAuth application is needed:

| Account | E-mail | Password |
|---|---|---|
| Administrator | `admin@example.com` | `trybun` |
| Project manager | `manager@example.com` | `trybun` |
| Developer | `developer@example.com` | `trybun` |
| Newcomer – a team member without product tour progress, who sees the tours | `newcomer@example.com` | `trybun` |

Team members always sign in with 2FA. The seeded accounts share one TOTP secret: add `ORZHSYTVNYWWY33DMFWC2MTGMEWWWZLZ` to an authenticator app, or print the current code with `oathtool --totp -b ORZHSYTVNYWWY33DMFWC2MTGMEWWWZLZ`. Keycloak imports these accounts only on the first start of an empty Keycloak database ([`docker/keycloak/dev/`](docker/keycloak/dev)); after `docker compose -f compose.yaml -f compose.dev.yaml down -v` they are imported again. `pnpm db:seed` restores the demo data, also the tour progress – the other accounts have completed every tour, the newcomer none – and the demo projects **Customer portal** (`CP`), **ERP** and the archived **Legacy intranet** (`LEGACY`), in which the Project manager and the Developer have their roles. **Projects** (`/projects`) lists them; the Administrator creates, archives and deletes projects there. Sign-in with GitHub, Microsoft or Google appears on the login screen once its variables are set in `.env`. The Administrator also opens **Administration** (`/admin`): the getting-started checklist and the "About" page. The demo dataset has an Administrator, so the first-run wizard (`/setup`) only says that Trybun is set up; on an empty database, `pnpm --filter @trybun/server exec node --env-file=../../.env dist/cli.js setup-token` (after `pnpm build`) prints a setup link.

## Scripts

Run from the repository root:

| Command | Purpose |
|---|---|
| `pnpm install` | Install dependencies from the lockfile |
| `pnpm dev` | Start the infrastructure in Docker Compose, apply the migrations and the demo dataset, then the web application, the API and the Worker with hot reload (variables from `.env` or the environment) |
| `pnpm build` | Build all applications and generate the Keycloak login theme from the message catalogues |
| `pnpm lint` | Lint all packages, check the formatting, the Keycloak login theme against the message catalogues, the help content against the user documentation and the Prisma schema mappings, reject Prisma ORM 8 packages in the lockfile, workflow triggers that expose secrets to forks, and actions or images not pinned to a SHA or digest, and check the shell scripts (`trybun`, the backup service, the restore test) with ShellCheck |
| `pnpm lint:spec` | Check that every `§N.M` reference points to an existing section of the specification |
| `pnpm format` | Format all files with Prettier |
| `pnpm typecheck` | TypeScript strict type check |
| `pnpm test` | Unit tests and the component tests of `@trybun/ui` (Vitest; every story in Chromium, light and dark, with axe) |
| `pnpm test:integration` | Integration tests against PostgreSQL and Valkey in Testcontainers (needs Docker) |
| `pnpm test:coverage` | Unit, component and integration tests with the coverage thresholds of CI (needs Docker) |
| `pnpm e2e` | E2E tests in Playwright on phone, tablet and desktop with axe, and the Lighthouse mobile budget of the key pages, against the local environment (needs `pnpm dev`; browsers: `pnpm --filter @trybun/web exec playwright install --with-deps chromium webkit`) |
| `pnpm api:generate` | Write the OpenAPI document of the API (`apps/server/openapi.json`) and the typed API client of the web application generated from it, after a change of the endpoints |
| `pnpm help:generate` | Generate the help content of the web application (pages and search indexes) from the user documentation in `docs/user/`, after a change of a page |
| `pnpm storybook` | Start the component catalogue of `@trybun/ui` on <http://localhost:6006> |
| `pnpm db:migrate` | Apply the database migrations (`prisma migrate deploy`) |
| `pnpm db:seed` | Load the deterministic demo dataset; running it again restores the same records |

`pnpm e2e` signs in as the seeded Developer of the demo dataset and reuses the web application and the API of a running `pnpm dev`; without one, it starts both from their builds (`pnpm build`). The Lighthouse budget (Performance and Accessibility ≥ 90, LCP < 2.5 s, TBT < 200 ms, CLS < 0.1, [§2.9](docs/spec/02-agent-rules.md)) holds for the production build only, so measure it with `pnpm build` and without `pnpm dev`: `pnpm e2e --project=setup --project=lighthouse`.

## Web application and API

The browser talks only to the web application: the BFF endpoint `/api/v1/*` forwards every request to the same path of the API over the internal network and attaches the access token of the session on the server, so tokens never reach the browser ([§14.4](docs/spec/14-architecture.md)). Integrations call the same URL with an `Authorization` header, which is forwarded unchanged and without cookies; a request with both a session cookie and an `Authorization` header is rejected (`400`), and a state-changing request without an `Authorization` header needs the `Origin` of the web application (`403` otherwise, CSRF). Server Components call the API directly with the session's token.

Security baseline ([§13.5](docs/spec/13-non-functional.md)): `apps/web/src/proxy.ts` sets the security headers of every page – a strict Content Security Policy with a nonce per request, HSTS, `nosniff`, no framing. The API limits requests per user (100 per minute) and per client IP for its public endpoints (20 per minute) with counters in Valkey, answering `429` with `RateLimit` headers beyond them. A team session ends after 30 minutes without a request or 12 hours after the sign-in, an end-user session after 8 hours or 30 days. Administrative actions are written to the immutable audit log (`audit_log_entries`) in the transaction of the change.

Both use the typed client generated from the OpenAPI document of the API (`openapi-typescript` + `openapi-fetch`), and client components read data through TanStack Query; the layout of the team views prefetches its data on the server and hydrates it into the browser ([§18.5](docs/spec/18-code-patterns.md)). After a change of the endpoints, run `pnpm api:generate` and commit `apps/server/openapi.json` and `apps/web/src/lib/api-client/schema.d.ts`; `pnpm test` and `pnpm lint` fail while either is out of date.

## User documentation

The user documentation lives in [`docs/user/`](docs/user/README.md) as Markdown – one folder per language (EN, PL), audience (end user, team, Administrator) and Diátaxis category ([§2.3](docs/spec/02-agent-rules.md)) – and is updated in the same pull request as the behaviour it describes. The web application shows it at `/help`: the help icon in the header opens the page of the current view, the search finds pages by any word in both languages, and end users receive only the pages written for them. After changing a page, run `pnpm help:generate` and commit `apps/web/src/features/help/content/`; `pnpm lint` fails while it is out of date.

## Database

The schema is [`apps/server/prisma/schema.prisma`](apps/server/prisma/schema.prisma) (Prisma ORM 7 – install and update Prisma packages with an explicit major, e.g. `pnpm add prisma@7`, because `latest` is Prisma ORM 8, [§14.2](docs/spec/14-architecture.md)). Models and fields follow the TypeScript conventions and map to snake_case tables and columns with `@@map` and `@map` ([§17.1](docs/spec/17-conventions.md)); primary keys are UUIDv7 and timestamps `timestamptz` ([§17.2](docs/spec/17-conventions.md)). `pnpm install` generates the Prisma Client into `apps/server/src/generated/` (not committed).

To change the schema, edit it and create a forward-only migration named in snake_case against the local database, then review its SQL:

```sh
pnpm --filter @trybun/server exec prisma migrate dev --create-only --name add_ticket_visibility
pnpm db:migrate
```

Database objects Prisma does not model (text search configurations, pgvector or partial indexes) are added as SQL to a migration. In production, the one-off Compose service `migrate` applies the migrations before the API and the Worker start ([§15.7](docs/spec/15-deployment.md)).

## Continuous integration

Every pull request runs the quality gates of [§2.14](docs/spec/02-agent-rules.md) in GitHub Actions ([`.github/workflows/`](.github/workflows)): formatting and lint, type check, unit, component and integration tests with coverage thresholds, build, E2E tests with axe and the Lighthouse budget against the local environment in Docker Compose, specification consistency (links and `§N.M` references), vulnerability audit, dependency review with the license allowlist, CodeQL, and commitlint for the commit messages and the pull request title. Releases and the daily image scan run in their own workflows (see [Releases](#releases)). Run the same checks locally with the commands above before opening a pull request.

## Monorepo structure

pnpm workspaces with Turborepo ([§14.6](docs/spec/14-architecture.md)). Applications are in `apps/`, shared internal packages in `packages/`:

| Path | Package | Role |
|---|---|---|
| `apps/web` | `@trybun/web` | Next.js web application and the BFF endpoint `/api/v1/*` |
| `apps/server` | `@trybun/server` | NestJS backend: the API (`src/main.ts`) and the Worker (`src/worker.ts`) |
| `packages/contracts` | `@trybun/contracts` | Zod schemas, types and error codes shared by web and server |
| `packages/ui` | `@trybun/ui` | Component library (shadcn/ui on Base UI, Tailwind CSS) |
| `packages/i18n` | `@trybun/i18n` | Message catalogues (EN, PL) in ICU MessageFormat for web, server and the Keycloak login theme |
| `packages/tsconfig` | `@trybun/tsconfig` | Shared TypeScript configuration (strict) |
| `packages/eslint-config` | `@trybun/eslint-config` | Shared lint rules: naming conventions, package and layer boundaries, Tailwind classes |
| `docs/` | | Specification, implementation plan, ADRs, brand, user documentation (`docs/user/`) |
| `deploy/` | | Files of the deployment package of a release that are not in the repository root or `docker/` (`INSTALL.md`, the `trybun` script and its tests) |

The code inside the applications follows the patterns of [§18](docs/spec/18-code-patterns.md); the technology choices are recorded in [`docs/adr/`](docs/adr/README.md).

## Component library

`@trybun/ui` holds the UI components: shadcn/ui on Base UI, styled with Tailwind CSS 4 and the design tokens of [`docs/brand/`](docs/brand/README.md) in [`packages/ui/src/styles/globals.css`](packages/ui/src/styles/globals.css) (light and dark). Applications import components by subpath (`@trybun/ui/components/button`) and the theme as `@trybun/ui/globals.css`. `pnpm storybook` shows every component in all states, in light and dark, in English and Polish, on phone, tablet and desktop viewports.

A new component starts from shadcn/ui: `pnpm --filter @trybun/ui exec shadcn add <component>`, then it is adapted to the tokens, touch targets, translations and accessibility and gets its stories – the steps are in the [`ui-component`](.ai/skills/ui-component/SKILL.md) skill ([§2.6](docs/spec/02-agent-rules.md), [§18.6](docs/spec/18-code-patterns.md)). Lint rejects classes outside the theme and arbitrary values such as `bg-[#E0482C]`; Prettier sorts the classes.

## Configuration

All configuration comes from environment variables ([§15.3](docs/spec/15-deployment.md)); the system's own variables start with `TRYBUN_`. [`.env.example`](.env.example) lists every variable with its description. The API and the web application validate their variables at start-up and stop with a clear message when one is missing or invalid. The Keycloak realm is configuration as code in [`docker/keycloak/`](docker/keycloak), applied by the one-off `keycloak-config` service on every start ([§15.5](docs/spec/15-deployment.md)); optional parts – SMTP and each sign-in provider – are applied only when their variables are set.

## Translations

Every text of the web application, the server's e-mails and API messages, and the Keycloak login screens comes from the ICU message catalogues in [`packages/i18n/messages/`](packages/i18n/messages) – English (`en.json`, the reference) and Polish (`pl.json`) ([§13.1](docs/spec/13-non-functional.md)). Add a text to both catalogues under the namespace of its feature; an error code of the API gets its message under `errors.<code>` ([§17.2](docs/spec/17-conventions.md)); `pnpm typecheck` rejects a key that is not in the catalogues, and `pnpm test` rejects a catalogue with missing, extra or malformed messages. The `keycloak` namespace becomes the login theme in [`docker/keycloak/themes/trybun/`](docker/keycloak/themes/trybun) on `pnpm build`; commit the generated files. The language is never in the URL: the web application uses the language chosen in the application, else the browser language, else `TRYBUN_DEFAULT_LANGUAGE`.

## Deployment

Trybun runs on a single Linux server with Docker Compose ([15-deployment.md](docs/spec/15-deployment.md)). [`compose.yaml`](compose.yaml) defines every service: `web`, `api` and `worker` (one `server` image, two commands), PostgreSQL with pgvector and the Polish dictionary, Valkey, SeaweedFS, Keycloak, ClamAV, the one-off services `migrate` (database migrations) and `keycloak-config`, the backup service `backup` (restic), and Caddy as the only public entry point with automatic HTTPS. The images are built from [`docker/`](docker). To try the production set-up locally, set the variables of `.env` and run:

```sh
docker compose up --build --wait
```

The API and the Worker log JSON lines to standard output (`docker compose logs api worker`) at the level of `TRYBUN_LOG_LEVEL`; every line of a request – and of the Worker jobs it causes – carries its request ID, which the API returns in `X-Request-Id`. On the internal network, `/health` of the API reports liveness and `/health/ready` readiness: it fails only without PostgreSQL and reports Valkey as `degraded` ([§17.2](docs/spec/17-conventions.md)).

The system is then served on `https://${TRYBUN_DOMAIN}` (for `localhost` with a certificate of Caddy's local authority). `/health` also reports the installed version.

An installation from a release uses the `trybun` script of the deployment package ([`deploy/trybun`](deploy/trybun), [`INSTALL.md`](deploy/INSTALL.md), [§15.5](docs/spec/15-deployment.md)): `./trybun install` checks the server (Docker and Compose versions, 8 GB RAM, free ports 80 and 443, the domain), asks for the domain, the default language and time zone, generates every secret and the backup passphrase into `.env` – never changing an existing one, so a re-run is safe – starts the system and prints the link of the first-run wizard, which creates the first Administrator with 2FA in Keycloak. `./trybun setup-token` prints a new link (valid 24 hours, single use) while no Administrator exists; the `server` image runs it as `node dist/cli.js setup-token` in the `api` container.

The service `backup` ([`docker/backup`](docker/backup), [§15.10](docs/spec/15-deployment.md)) backs up both databases, the objects of SeaweedFS and the configuration (`.env` and the files of the deployment package) every day with restic, encrypted with `TRYBUN_BACKUP_PASSPHRASE`, to its volume and – with `TRYBUN_BACKUP_S3_URL` – to external S3 storage. `./trybun backup` backs up now (`backup list` lists the backups), `./trybun restore [<backup>]` restores a backup with the version it was taken with – also onto a new server from the package, `.env` and the passphrase – and `./trybun update <version>` downloads and checks a release, backs up, then installs and starts it, printing the restore command of that backup if the new version does not start ([§15.7](docs/spec/15-deployment.md)). `./trybun uninstall` deletes Trybun from the server after the domain is typed – containers, data, local backups and images, with a last backup to the S3 storage first when one is set – and keeps the folder with `.env` ([§15.5](docs/spec/15-deployment.md)).

## Releases

Versions are calculated from the Conventional Commits by [release-please](https://github.com/googleapis/release-please) – before `1.0.0`, `feat:` increases MINOR and everything else PATCH ([§2.11](docs/spec/02-agent-rules.md)); never set a version or edit `CHANGELOG.md` by hand. The workflow [`release.yml`](.github/workflows/release.yml) ([ADR 0006](docs/adr/0006-release-pipeline.md)):

1. keeps a release pull request open on `main` (and on every maintenance branch `release/X.Y.x`, PATCH only) with the next version and its changelog entry;
2. when the maintainer merges it, tags `vX.Y.Z`, creates a draft GitHub Release, builds the images `ghcr.io/trybun/web`, `server`, `postgres` and `backup`, scans them with Trivy – a critical vulnerability stops the release – creates their SBOMs (Syft, CycloneDX), builds the deployment package and runs the restore test [`scripts/restore-test.sh`](scripts/restore-test.sh) on them ([§13.6](docs/spec/13-non-functional.md)) – a failed restore stops the release;
3. after the maintainer's approval in the environment `release`, pushes the images as `X.Y.Z` (and moves `X.Y` and `X`), attaches the SBOMs, the deployment package and `SHA256SUMS`, and publishes the release.

"Run workflow" on `main` or a maintenance branch publishes the release candidate `X.Y.Z-rc.N` of its open release pull request the same way. The deployment package (`trybun-X.Y.Z.tar.gz`) holds `compose.yaml` pinned to the release's images, `.env.example`, the Caddy and Keycloak configuration, the `trybun` script and [`INSTALL.md`](deploy/INSTALL.md); build it locally with `node scripts/build-deployment-package.js <version> <folder>`.

The workflow [`image-scan.yml`](.github/workflows/image-scan.yml) scans every day (and with "Run workflow") the published images of the supported series and the images built from `main` with Trivy, with the accepted risks of [`.trivyignore.yaml`](.trivyignore.yaml); a critical vulnerability – or an accepted risk past its expiry date – opens an alert in GitHub code scanning ([§2.10](docs/spec/02-agent-rules.md), [§15.4](docs/spec/15-deployment.md)).

## Documentation

- System specification: [`docs/spec/`](docs/spec/README.md)
- Architecture decisions: [`docs/adr/`](docs/adr/README.md)
- Instructions for AI agents: [`AGENTS.md`](AGENTS.md)
- Delivery process, review rules and protected contracts: [`SDLC.md`](SDLC.md), [`CODE_REVIEW.md`](CODE_REVIEW.md), [`BACKWARD_COMPATIBILITY.md`](BACKWARD_COMPATIBILITY.md); the agent skills are restored with `npx skills experimental_install` ([`.ai/skills/`](.ai/skills/README.md))
- User documentation: [`docs/user/`](docs/user/README.md), shown in the application at `/help`
- API documentation: arrives with task S6

## Contributing

Contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md), the [Code of Conduct](CODE_OF_CONDUCT.md) and, for vulnerabilities, the [security policy](SECURITY.md).

## License

Trybun is licensed under the [MIT License](LICENSE).
