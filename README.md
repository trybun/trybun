# Trybun

**Trybun** is an open-source ticket system that connects customer requests with developer workflow: it receives tickets from the development team, end users and integrations, and combines handling them with work planning (roadmap, Gantt chart) and GitHub integration.

The project is delivered with an **AI Engineering** approach: AI agents write the code, tests and documentation, and humans define the requirements and review and approve every change. The system specification in [`docs/spec/`](docs/spec/README.md) is the source of truth; the [implementation plan](docs/plan/implementation-plan.md) shows what is built and what comes next.

> **Status:** Stage 0 (foundation) is in progress. The repository contains the monorepo skeleton; there are no user-facing features yet.

## Prerequisites

- **Node.js** in the version from [`.node-version`](.node-version) (24 LTS)
- **pnpm** enabled through Corepack: `corepack enable` (the version comes from the `packageManager` field of [`package.json`](package.json))
- **Docker** with the Compose plugin – runs the infrastructure services and the integration tests (Testcontainers)
- **Chromium** for the component tests, installed once after `pnpm install`: `pnpm --filter @trybun/ui exec playwright install chromium`

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

Team members always sign in with 2FA. The seeded accounts share one TOTP secret: add `ORZHSYTVNYWWY33DMFWC2MTGMEWWWZLZ` to an authenticator app, or print the current code with `oathtool --totp -b ORZHSYTVNYWWY33DMFWC2MTGMEWWWZLZ`. Keycloak imports these accounts only on the first start of an empty Keycloak database ([`docker/keycloak/dev/`](docker/keycloak/dev)); after `docker compose -f compose.yaml -f compose.dev.yaml down -v` they are imported again. Sign-in with GitHub, Microsoft or Google appears on the login screen once its variables are set in `.env`.

## Scripts

Run from the repository root:

| Command | Purpose |
|---|---|
| `pnpm install` | Install dependencies from the lockfile |
| `pnpm dev` | Start the infrastructure in Docker Compose, apply the migrations and the demo dataset, then the web application, the API and the Worker with hot reload (variables from `.env` or the environment) |
| `pnpm build` | Build all applications and generate the Keycloak login theme from the message catalogues |
| `pnpm lint` | Lint all packages, check the formatting, the Keycloak login theme against the message catalogues and the Prisma schema mappings, reject Prisma ORM 8 packages in the lockfile, workflow triggers that expose secrets to forks, and actions or images not pinned to a SHA or digest |
| `pnpm lint:spec` | Check that every `§N.M` reference points to an existing section of the specification |
| `pnpm format` | Format all files with Prettier |
| `pnpm typecheck` | TypeScript strict type check |
| `pnpm test` | Unit tests and the component tests of `@trybun/ui` (Vitest; every story in Chromium, light and dark, with axe) |
| `pnpm test:integration` | Integration tests against PostgreSQL and Valkey in Testcontainers (needs Docker) |
| `pnpm test:coverage` | Unit, component and integration tests with the coverage thresholds of CI (needs Docker) |
| `pnpm storybook` | Start the component catalogue of `@trybun/ui` on <http://localhost:6006> |
| `pnpm db:migrate` | Apply the database migrations (`prisma migrate deploy`) |
| `pnpm db:seed` | Load the deterministic demo dataset; running it again restores the same records |

E2E tests arrive with task S0-08.

## Database

The schema is [`apps/server/prisma/schema.prisma`](apps/server/prisma/schema.prisma) (Prisma ORM 7 – install and update Prisma packages with an explicit major, e.g. `pnpm add prisma@7`, because `latest` is Prisma ORM 8, [§14.2](docs/spec/14-architecture.md)). Models and fields follow the TypeScript conventions and map to snake_case tables and columns with `@@map` and `@map` ([§17.1](docs/spec/17-conventions.md)); primary keys are UUIDv7 and timestamps `timestamptz` ([§17.2](docs/spec/17-conventions.md)). `pnpm install` generates the Prisma Client into `apps/server/src/generated/` (not committed).

To change the schema, edit it and create a forward-only migration named in snake_case against the local database, then review its SQL:

```sh
pnpm --filter @trybun/server exec prisma migrate dev --create-only --name add_ticket_visibility
pnpm db:migrate
```

Database objects Prisma does not model (text search configurations, pgvector or partial indexes) are added as SQL to a migration. In production, the one-off Compose service `migrate` applies the migrations before the API and the Worker start ([§15.7](docs/spec/15-deployment.md)).

## Continuous integration

Every pull request runs the quality gates of [§2.14](docs/spec/02-agent-rules.md) in GitHub Actions ([`.github/workflows/`](.github/workflows)): formatting and lint, type check, unit, component and integration tests with coverage thresholds, build, specification consistency (links and `§N.M` references), vulnerability audit, dependency review with the license allowlist, CodeQL, and commitlint for the commit messages and the pull request title. Run the same checks locally with the commands above before opening a pull request.

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
| `docs/` | | Specification, implementation plan, ADRs, brand |

The code inside the applications follows the patterns of [§18](docs/spec/18-code-patterns.md); the technology choices are recorded in [`docs/adr/`](docs/adr/README.md).

## Component library

`@trybun/ui` holds the UI components: shadcn/ui on Base UI, styled with Tailwind CSS 4 and the design tokens of [`docs/brand/`](docs/brand/README.md) in [`packages/ui/src/styles/globals.css`](packages/ui/src/styles/globals.css) (light and dark). Applications import components by subpath (`@trybun/ui/components/button`) and the theme as `@trybun/ui/globals.css`. `pnpm storybook` shows every component in all states, in light and dark, in English and Polish, on phone, tablet and desktop viewports.

A new component starts from shadcn/ui: `pnpm --filter @trybun/ui exec shadcn add <component>`, then it is adapted to the tokens, touch targets, translations and accessibility and gets its stories – the steps are in the [`ui-component`](.ai/skills/ui-component/SKILL.md) skill ([§2.6](docs/spec/02-agent-rules.md), [§18.6](docs/spec/18-code-patterns.md)). Lint rejects classes outside the theme and arbitrary values such as `bg-[#E0482C]`; Prettier sorts the classes.

## Configuration

All configuration comes from environment variables ([§15.3](docs/spec/15-deployment.md)); the system's own variables start with `TRYBUN_`. [`.env.example`](.env.example) lists every variable with its description. The API and the web application validate their variables at start-up and stop with a clear message when one is missing or invalid. The Keycloak realm is configuration as code in [`docker/keycloak/`](docker/keycloak), applied by the one-off `keycloak-config` service on every start ([§15.5](docs/spec/15-deployment.md)); optional parts – SMTP and each sign-in provider – are applied only when their variables are set.

## Translations

Every text of the web application, the server's e-mails and API messages, and the Keycloak login screens comes from the ICU message catalogues in [`packages/i18n/messages/`](packages/i18n/messages) – English (`en.json`, the reference) and Polish (`pl.json`) ([§13.1](docs/spec/13-non-functional.md)). Add a text to both catalogues under the namespace of its feature; an error code of the API gets its message under `errors.<code>` ([§17.2](docs/spec/17-conventions.md)); `pnpm typecheck` rejects a key that is not in the catalogues, and `pnpm test` rejects a catalogue with missing, extra or malformed messages. The `keycloak` namespace becomes the login theme in [`docker/keycloak/themes/trybun/`](docker/keycloak/themes/trybun) on `pnpm build`; commit the generated files. The language is never in the URL: the web application uses the language chosen in the application, else the browser language, else `TRYBUN_DEFAULT_LANGUAGE`.

## Deployment

Trybun runs on a single Linux server with Docker Compose ([15-deployment.md](docs/spec/15-deployment.md)). [`compose.yaml`](compose.yaml) defines every service: `web`, `api` and `worker` (one `server` image, two commands), PostgreSQL with pgvector and the Polish dictionary, Valkey, SeaweedFS, Keycloak, ClamAV, the one-off services `migrate` (database migrations) and `keycloak-config`, and Caddy as the only public entry point with automatic HTTPS. The images are built from [`docker/`](docker). To try the production set-up locally, set the variables of `.env` and run:

```sh
docker compose up --build --wait
```

The API and the Worker log JSON lines to standard output (`docker compose logs api worker`) at the level of `TRYBUN_LOG_LEVEL`; every line of a request – and of the Worker jobs it causes – carries its request ID, which the API returns in `X-Request-Id`. On the internal network, `/health` of the API reports liveness and `/health/ready` readiness: it fails only without PostgreSQL and reports Valkey as `degraded` ([§17.2](docs/spec/17-conventions.md)).

The system is then served on `https://${TRYBUN_DOMAIN}` (for `localhost` with a certificate of Caddy's local authority). The release package with the install script arrives in Stage 0 (tasks S0-11, S0-12).

## Documentation

- System specification: [`docs/spec/`](docs/spec/README.md)
- Architecture decisions: [`docs/adr/`](docs/adr/README.md)
- Instructions for AI agents: [`AGENTS.md`](AGENTS.md)
- User documentation and API documentation: arrive with tasks S0-09 and S6

## Contributing

Contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md), the [Code of Conduct](CODE_OF_CONDUCT.md) and, for vulnerabilities, the [security policy](SECURITY.md).

## License

Trybun is licensed under the [MIT License](LICENSE).
