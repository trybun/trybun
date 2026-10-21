# Trybun

**Trybun** is an open-source ticket system that connects customer requests with developer workflow: it receives tickets from the development team, end users and integrations, and combines handling them with work planning (roadmap, Gantt chart) and GitHub integration.

The project is delivered with an **AI Engineering** approach: AI agents write the code, tests and documentation, and humans define the requirements and review and approve every change. The system specification in [`docs/spec/`](docs/spec/README.md) is the source of truth; the [implementation plan](docs/plan/implementation-plan.md) shows what is built and what comes next.

> **Status:** Stage 0 (foundation) is in progress. The repository contains the monorepo skeleton; there are no user-facing features yet.

## Prerequisites

- **Node.js** in the version from [`.node-version`](.node-version) (24 LTS)
- **pnpm** enabled through Corepack: `corepack enable` (the version comes from the `packageManager` field of [`package.json`](package.json))
- **Docker** with the Compose plugin – needed once the infrastructure services arrive (task S0-03)

## Getting started

```sh
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev` starts the web application on <http://localhost:3000> and the API on <http://localhost:3001/api/v1>. The infrastructure (PostgreSQL, Valkey, Keycloak and others), the migrations and the seed data join the same command in Stage 0 ([§15.12](docs/spec/15-deployment.md)).

## Scripts

Run from the repository root:

| Command | Purpose |
|---|---|
| `pnpm install` | Install dependencies from the lockfile |
| `pnpm dev` | Start the web application and the API with hot reload (variables from `.env` or the environment) |
| `pnpm build` | Build all applications |
| `pnpm lint` | Lint all packages and check the formatting |
| `pnpm format` | Format all files with Prettier |
| `pnpm typecheck` | TypeScript strict type check |
| `pnpm test` | Unit tests (Vitest) |

Integration tests, E2E tests and database migrations arrive with tasks S0-02, S0-08 and S0-04.

## Monorepo structure

pnpm workspaces with Turborepo ([§14.6](docs/spec/14-architecture.md)). Applications are in `apps/`, shared internal packages in `packages/`:

| Path | Package | Role |
|---|---|---|
| `apps/web` | `@trybun/web` | Next.js web application and the BFF endpoint `/api/v1/*` |
| `apps/server` | `@trybun/server` | NestJS backend: the API (`src/main.ts`) and the Worker (`src/worker.ts`) |
| `packages/contracts` | `@trybun/contracts` | Zod schemas, types and error codes shared by web and server |
| `packages/ui` | `@trybun/ui` | Component library (shadcn/ui on Base UI, Tailwind CSS) |
| `packages/i18n` | `@trybun/i18n` | Message catalogues (EN, PL) for web and server |
| `packages/tsconfig` | `@trybun/tsconfig` | Shared TypeScript configuration (strict) |
| `packages/eslint-config` | `@trybun/eslint-config` | Shared lint rules: naming conventions, package and layer boundaries |
| `docs/` | | Specification, implementation plan, ADRs, brand |

The code inside the applications follows the patterns of [§18](docs/spec/18-code-patterns.md); the technology choices are recorded in [`docs/adr/`](docs/adr/README.md).

## Configuration

All configuration comes from environment variables ([§15.3](docs/spec/15-deployment.md)); the system's own variables start with `TRYBUN_`. [`.env.example`](.env.example) lists every variable with its description. The API and the web application validate their variables at start-up and stop with a clear message when one is missing or invalid.

## Deployment

Trybun runs on a single Linux server with Docker Compose ([15-deployment.md](docs/spec/15-deployment.md)). The release package with the install script arrives in Stage 0 (tasks S0-11, S0-12).

## Documentation

- System specification: [`docs/spec/`](docs/spec/README.md)
- Architecture decisions: [`docs/adr/`](docs/adr/README.md)
- Instructions for AI agents: [`AGENTS.md`](AGENTS.md)
- User documentation and API documentation: arrive with tasks S0-09 and S6

## Contributing

Contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md), the [Code of Conduct](CODE_OF_CONDUCT.md) and, for vulnerabilities, the [security policy](SECURITY.md).

## License

Trybun is licensed under the [MIT License](LICENSE).
