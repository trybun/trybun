# 14 – Architecture and technology stack

## 14.1 System components

| Component | Responsibility |
|---|---|
| **Web application** | User interface: end-user portal, forms, team views, roadmap, Gantt chart, GFM editor |
| **API** | Domain logic, permissions and visibility, REST API ([§12.1](12-api-webhooks-import.md)), real-time communication (WebSocket) |
| **Worker** | Background jobs: GitHub webhooks, SLA timers, attachment scanning, incoming e-mail, notification batching, outgoing webhooks, imports, anonymization, backups scheduling |
| **Database** | System data, full-text and semantic search |
| **Queue / cache** | Job queue, distributing real-time events between instances, login rate limiting |
| **Object storage** | Attachments (S3-compatible API) |
| **Identity provider** | Login, 2FA, login with GitHub, Microsoft and Google, password reset |
| **Reverse proxy** | Single public entry point, automatic HTTPS certificates, routing to the web application, API and identity provider |

## 14.2 Technology stack

| Layer | Technology |
|---|---|
| Language | TypeScript across the whole project |
| Web application | Next.js + React |
| UI components | Project component library (`packages/ui`, `@trybun/ui`) based on Radix UI; component catalog in Storybook (Rule 6) |
| API and Worker | NestJS (the Worker is a separate process using the same domain code) |
| Database | PostgreSQL with the pgvector extension and a Polish full-text dictionary |
| Database access | Prisma (ORM and migrations) |
| Authentication | Keycloak |
| Queue | BullMQ + Redis |
| Files | Any S3-compatible storage; MinIO included by default. Malware scanning with ClamAV |
| Reverse proxy | Caddy (automatic Let's Encrypt certificates) |
| Repository structure | Monorepo (pnpm workspaces + Turborepo) |
| Validation and contracts | Shared schemas (Zod) and types for frontend and backend |
| Infrastructure | Docker and Docker Compose; CI/CD in GitHub Actions; images in GitHub Container Registry (`ghcr.io/trybun/<service>`, [§1.4](01-overview.md)) |
| Tests | Vitest (unit and integration), Playwright (E2E), axe (accessibility) |

## 14.3 Rationale

- **One language and shared contracts.** Rules for visibility, permissions, statuses and validation are defined once and used by both the UI and the API, eliminating discrepancies between layers.
- **Next.js + React** offers the most mature component ecosystem for a highly interactive UI (Kanban, Gantt, GFM editor, keyboard shortcuts) and good internationalization support. It is the framework recommended by the React documentation for new applications.
- **A separate NestJS backend**, because much of the logic runs outside user requests (SLA, queues, e-mail, scanning). A strongly structured framework with built-in conventions supports Rule 1.
- **PostgreSQL** provides full-text search (first version of [§5.6](05-visibility-and-search.md)) and semantic search via pgvector (target version) without extra infrastructure.
- **Prisma** is the most popular ORM in the TypeScript ecosystem, with a mature migration system, type generation and documented NestJS integration.
- **Keycloak** provides proven login, 2FA and external login, including translated login screens. In a project delivered by AI agents it minimizes the amount of security code written in the project.
- **A popular stack** makes it easier to find specialists and helps AI agents work effectively.

## 14.4 Architectural principles

- The frontend contains no permission or visibility logic. Decisions are made only by the API; the frontend only adapts the UI.
- Authentication, 2FA and OAuth are handled by Keycloak. Custom implementations of security mechanisms are forbidden (Rule 1, [§13.5](13-non-functional.md)). API tokens ([§12.2](12-api-webhooks-import.md)) are handled by the system.
- Database access goes through Prisma. Where the ORM is not sufficient (full-text search, pgvector), only parameterized SQL queries are allowed.
- Incoming e-mail is handled by an e-mail provider that converts messages into webhooks, not by a self-hosted mail server.
- Full-text search for Polish requires a Polish dictionary installed in PostgreSQL (e.g. hunspell). Without it, word inflections are not recognized.
- All services run in containers. The local environment is reproducible with one command.

## 14.5 Alternatives considered

| Alternative | Assessment |
|---|---|
| ASP.NET Core (API, background services, SignalR) + React frontend | Technically equivalent. Rejected only because of the lack of a shared language and contracts between layers |
| Next.js only (no separate backend) | Rejected – not designed for extensive background processing |
| Blazor | Rejected – weaker ecosystem of components for Kanban, Gantt and a GFM editor |
| PostgreSQL-based queue (e.g. pg-boss) instead of Redis | Acceptable if minimizing infrastructure components becomes a priority |
| Drizzle instead of Prisma | Rejected – lighter and closer to SQL, but less established. Raw SQL for search is needed in both cases |
| Authentication library inside the application instead of Keycloak | Rejected – fewer infrastructure components, but more security code in the project |
| Services of a specific cloud provider | Rejected – the system must run on any Linux server ([15-deployment.md](15-deployment.md)) |
