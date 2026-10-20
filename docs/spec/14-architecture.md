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
| Web application | Next.js (App Router) + React |
| Web sign-in and session | Auth.js with the Keycloak provider; session in an `httpOnly`, `Secure`, `SameSite=Lax` cookie; tokens never reach the browser (**Backend for Frontend**, [§14.4](#144-architectural-principles)) |
| Data access from the web | Typed API client generated from the OpenAPI document (`openapi-typescript` + `openapi-fetch`) calling the BFF endpoint `/api/v1/*` of the web application; TanStack Query in client components |
| Internationalization | `next-intl` in the web application; message catalogues in ICU MessageFormat in `@trybun/i18n`, shared by web and server ([§14.6](#146-monorepo-structure)) |
| Markdown (GFM) | Own editor component in `@trybun/ui` (textarea, toolbar, Write/Preview, as on GitHub); rendering with `react-markdown` + `remark-gfm` + `rehype-sanitize`; the same unified pipeline renders Markdown on the server (e-mails) |
| Drag and drop | `dnd-kit` (pointer, touch and keyboard sensors) |
| Gantt chart | SVAR React Gantt, open-source MIT edition only (never the commercial PRO edition); scheduling logic lives in the API ([§10.4](10-roadmap-gantt.md)) |
| Charts | Recharts (basis of the shadcn/ui `Chart` component) |
| Styling | Tailwind CSS 4 with the theme defined as design tokens (CSS variables, `@theme`); class-variance-authority for component variants, tailwind-merge for combining classes |
| UI components | Project component library (`packages/ui`, `@trybun/ui`) based on Radix UI and Tailwind CSS, using **shadcn/ui** (MIT) as the starting point: component source is copied into the library with the shadcn CLI and owned by the project; component catalog in Storybook (Rule 6) |
| API and Worker | NestJS – one backend application (`apps/server`) with two entry points: the API process and the Worker process ([§14.6](#146-monorepo-structure)) |
| Database | PostgreSQL with the pgvector extension and a Polish full-text dictionary |
| Database access | Prisma (ORM and migrations) |
| Authorization | CASL with `@casl/prisma`: one definition of abilities used both for action checks and for filtering database queries ([§14.4](#144-architectural-principles)) |
| Authentication | Keycloak |
| Queue | BullMQ + Valkey (Redis-compatible, BSD-3-Clause) |
| Real-time | NestJS WebSocket gateway with Socket.IO and its Redis adapter on Valkey |
| E-mail | Outgoing: SMTP via Nodemailer (works with any provider), templates in React Email. Incoming: provider webhook through an adapter interface ([§6.3](06-comments-notifications.md)). Development: Mailpit |
| Logging | `nestjs-pino`: JSON logs with a request ID propagated from the API to the Worker; no personal data ([§13.2](13-non-functional.md)) |
| Rate limiting | `@nestjs/throttler` with storage in Valkey |
| Semantic search | Embeddings computed locally in the Worker with Transformers.js and the `multilingual-e5-small` model (MIT, 384 dimensions, supports Polish), stored in pgvector; no ticket content is sent to an external service ([§5.6](05-visibility-and-search.md)) |
| Files | Any S3-compatible storage; SeaweedFS (Apache 2.0) included by default. Malware scanning with ClamAV |
| Reverse proxy | Caddy (automatic Let's Encrypt certificates) |
| Repository structure | Monorepo (pnpm workspaces + Turborepo); Node.js LTS and pnpm versions pinned in the repository (`.node-version`, `packageManager` field) |
| Validation and contracts | **Zod** – the only validation library. Schemas and types shared by frontend and backend live in `@trybun/contracts` ([§14.6](#146-monorepo-structure)). API: `nestjs-zod` (DTOs from Zod schemas, `ZodValidationPipe`, OpenAPI through `@nestjs/swagger`). Forms: React Hook Form with the Zod resolver (shadcn/ui `Form`) |
| Infrastructure | Docker and Docker Compose; CI/CD in GitHub Actions; images in GitHub Container Registry (`ghcr.io/trybun/<service>`, [§1.4](01-overview.md)) |
| Tests | Vitest (unit and integration), Testcontainers (real PostgreSQL and Valkey in integration tests), MSW (simulated external HTTP services), `@faker-js/faker` (test data factories), Playwright (E2E), axe (accessibility), Lighthouse (performance budget) |

## 14.3 Rationale

- **One language and shared contracts.** Rules for visibility, permissions, statuses and validation are defined once and used by both the UI and the API, eliminating discrepancies between layers.
- **Next.js + React** offers the most mature component ecosystem for a highly interactive UI (Kanban, Gantt, GFM editor, keyboard shortcuts) and good internationalization support. It is the framework recommended by the React documentation for new applications.
- **A separate NestJS backend**, because much of the logic runs outside user requests (SLA, queues, e-mail, scanning). A strongly structured framework with built-in conventions supports Rule 1.
- **Valkey** and **SeaweedFS** have permissive licenses (BSD-3-Clause, Apache 2.0) and active, vendor-neutral or community development, so the default stack contains no component with a restrictive or abandoned license (Rule 10, [§16.1](16-open-source.md)).
- **PostgreSQL** provides full-text search (first version of [§5.6](05-visibility-and-search.md)) and semantic search via pgvector (target version) without extra infrastructure.
- **Tailwind CSS** is the most common styling approach with Next.js, and Radix UI + Tailwind is the basis of the widely used shadcn/ui pattern. Its theme is defined as design tokens (Rule 6) and its utilities are mobile-first by default (Rule 9).
- **shadcn/ui** is the most widely used way to build component libraries on Radix UI and Tailwind CSS. Its components are copied into the project, not installed as a dependency, so `@trybun/ui` stays fully under the project's control. It provides ready building blocks for the specification: `Command` (command palette, [§8.4](08-team-views.md)), `Drawer` (bottom sheets on phones, Rule 9), `Data Table` (list view, [§8.1](08-team-views.md)), `Sonner` (toasts), `Calendar` and date pickers.
- **Prisma** is the most popular ORM in the TypeScript ecosystem, with a mature migration system, type generation and documented NestJS integration.
- **Keycloak** provides proven login, 2FA and external login, including translated login screens. In a project delivered by AI agents it minimizes the amount of security code written in the project.
- **A popular stack** makes it easier to find specialists and helps AI agents work effectively.

## 14.4 Architectural principles

- The frontend contains no permission or visibility logic. Decisions are made only by the API; the frontend only adapts the UI.
- Authentication, 2FA and OAuth are handled by Keycloak. Custom implementations of security mechanisms are forbidden (Rule 1, [§13.5](13-non-functional.md)). API tokens ([§12.2](12-api-webhooks-import.md)) are handled by the system.
- Database access goes through Prisma. Where the ORM is not sufficient (full-text search, pgvector), only parameterized SQL queries are allowed.
- Incoming e-mail is handled by an e-mail provider that converts messages into webhooks, not by a self-hosted mail server. Outgoing e-mail uses SMTP, so any provider can be configured.
- **Web ↔ API communication: Backend for Frontend (BFF).** Following the IETF guidance for browser-based applications, access tokens never reach the browser.
  - The web application exposes one proxy endpoint `/api/v1/*`. It attaches the user's Keycloak access token from the Auth.js session on the server side, refreshes it when it expires and forwards the request to the API over the internal network.
  - Requests that already carry an `Authorization` header (API tokens of integrations, [§12.2](12-api-webhooks-import.md)) are forwarded unchanged, so integrations use the same public URL.
  - The API itself is **not exposed publicly**; Caddy routes all traffic to the web application, except WebSocket traffic.
  - Next.js server components call the API directly over the internal network with the session's token.
  - Next.js Server Actions are not used as a second backend; Route Handlers exist only for the BFF proxy and Auth.js.
  - CSRF protection: session cookie with `SameSite=Lax` and a check of the `Origin` header for every state-changing request.
- **Real-time connections.** The browser connects to the Socket.IO gateway of the API (`/socket.io`, routed by Caddy) with a one-time ticket valid for 30 seconds, issued by the BFF. Every subscription (e.g. to a ticket or a board) is authorized with CASL, and permissions are checked again before each event is delivered, so a user never receives events about tickets they can no longer see.
- **Sign-in.** Auth.js performs the OpenID Connect flow with Keycloak. The API accepts only Keycloak access tokens (JWT verified against the Keycloak JWKS) and API tokens ([§12.2](12-api-webhooks-import.md)).
- **Authorization in one place.** All permissions ([§7.5](07-users-organizations-permissions.md)) and visibility rules ([§5.1](05-visibility-and-search.md)) are defined once as CASL abilities in the server. The same definition checks actions and builds Prisma filters (`accessibleBy`), so a list can never return a ticket that its detail view would refuse. The permission matrix is covered by automated tests.
- **Uploads.** Files are uploaded through the API into a quarantine area of the object storage, scanned by ClamAV in the Worker and only then made available. Downloads use short-lived signed URLs issued after the access check ([§13.3](13-non-functional.md)).
- Full-text search for Polish requires a Polish dictionary installed in PostgreSQL (e.g. hunspell). Without it, word inflections are not recognized.
- All services run in containers. The local environment is reproducible with one command.
- The repository structure and package boundaries follow [§14.6](#146-monorepo-structure); data and integration conventions follow [§17.2](17-conventions.md).
- **Zod is the only validation library** in the project. `class-validator`/`class-transformer`, Yup, Joi and similar libraries are not used.
  - Every schema crossing a boundary (API requests and responses, webhook events, import formats, WebSocket messages) lives in `@trybun/contracts` and is used by both sides.
  - Schemas used only inside one application (e.g. its configuration) stay in that application.
  - The API validates every request with the shared schema (`nestjs-zod`, global `ZodValidationPipe`); the OpenAPI document ([§12.1](12-api-webhooks-import.md)) is generated from the same schemas, so documentation and validation cannot drift apart.
  - Web forms validate with the same schemas (React Hook Form + Zod resolver) for immediate feedback; the API validation remains authoritative.
  - Environment variables are validated with a Zod schema at start-up of `server` and `web`; an invalid or missing variable stops the start with a clear message ([§15.3](15-deployment.md)).

## 14.5 Alternatives considered

| Alternative | Assessment |
|---|---|
| ASP.NET Core (API, background services, SignalR) + React frontend | Technically equivalent. Rejected only because of the lack of a shared language and contracts between layers |
| Next.js only (no separate backend) | Rejected – not designed for extensive background processing |
| Blazor | Rejected – weaker ecosystem of components for Kanban, Gantt and a GFM editor |
| PostgreSQL-based queue (e.g. pg-boss) instead of Valkey | Acceptable if minimizing infrastructure components becomes a priority |
| Redis instead of Valkey | Rejected – since 7.4 licensed RSALv2/SSPLv1, since 8.0 also AGPLv3; Valkey (Linux Foundation fork of Redis 7.2) keeps the permissive BSD license, vendor-neutral governance and protocol compatibility used by BullMQ |
| MinIO instead of SeaweedFS | Rejected – the community edition stopped publishing images and binaries (October 2025), entered maintenance mode and its repository was archived (2026); no security updates, which conflicts with Rule 10 |
| Garage or RustFS instead of SeaweedFS | Garage (AGPLv3) needs more configuration for a single node; RustFS (Apache 2.0) is promising but still young. Both can be used as external S3 storage ([§15.3](15-deployment.md)) |
| Drizzle instead of Prisma | Rejected – lighter and closer to SQL, but less established. Raw SQL for search is needed in both cases |
| Authentication library inside the application instead of Keycloak | Rejected – fewer infrastructure components, but more security code in the project |
| CSS Modules or CSS-in-JS (e.g. styled-components) instead of Tailwind CSS | Rejected – CSS-in-JS adds runtime cost and fits React Server Components poorly; CSS Modules are viable but have a smaller ecosystem of ready patterns with Radix UI |
| A WYSIWYG editor (e.g. Tiptap) instead of a Markdown textarea | Rejected – converting between rich text and GFM is lossy; a textarea with toolbar and preview matches GitHub exactly ([§6.2](06-comments-notifications.md)) |
| Next.js Server Actions as the main way to change data | Rejected – it would create a second backend next to the API and duplicate validation and permissions |
| An external embedding API (e.g. a cloud AI provider) for semantic search | Rejected – ticket content would leave the installation (GDPR); a local model is sufficient for similarity search |
| Commercial Gantt libraries or the SVAR PRO edition | Rejected – not compatible with an MIT project without paid licences; the scheduling logic required by [§10.4](10-roadmap-gantt.md) is implemented in the API |
| Services of a specific cloud provider | Rejected – the system must run on any Linux server ([15-deployment.md](15-deployment.md)) |

## 14.6 Monorepo structure

The repository follows the common pnpm + Turborepo convention: **`apps/`** contains what is run and deployed, **`packages/`** contains code shared by the applications.

```
apps/
  web/              @trybun/web        Next.js web application
  server/           @trybun/server     NestJS backend: API and Worker
packages/
  ui/               @trybun/ui         Component library (Rule 6)
  contracts/        @trybun/contracts  Zod schemas, API types, status codes and mapping
  i18n/             @trybun/i18n       Message catalogues (EN, PL) in ICU MessageFormat for web and server
  tsconfig/         @trybun/tsconfig   Shared TypeScript configuration (strict mode)
  eslint-config/    @trybun/eslint-config  Shared lint rules, incl. Tailwind and boundary rules
```

### Backend: one application, two processes

- `apps/server` contains all backend modules (domain, Prisma schema and migrations, integrations).
- It has two entry points: `src/main.ts` starts the **API** (HTTP and WebSocket), `src/worker.ts` starts the **Worker** (queues, scheduled jobs, no HTTP server, NestJS application context).
- Both processes are built into **one container image** (`ghcr.io/trybun/server`) and started as two Compose services with different commands. They remain separate processes as described in [§14.1](#141-system-components).
- This keeps the domain code in one place without an extra package, following the NestJS convention.

### Rules for packages

- A package is created only for a concrete reason: the code is used by at least two applications, or a hard boundary is needed (e.g. `@trybun/ui` must not import application code). No packages "just in case".
- Every package has one clear responsibility visible in its name. Catch-all packages such as `shared`, `common` or `utils` are not allowed.
- `@trybun/contracts` contains only what frontend and backend must understand identically (schemas, types, codes, mappings, labels). It contains no permission or visibility logic, which stays in the API ([§14.4](#144-architectural-principles)).
- Dependencies point in one direction only: applications → packages. Packages never import applications, and there are no cycles. `@trybun/contracts` and `@trybun/i18n` depend on no other project package; `@trybun/ui` does not depend on `@trybun/server`. These boundaries are enforced by lint rules in CI.
- Packages are **internal packages**: `"private": true`, referenced with the `workspace:*` protocol and consumed as TypeScript source, without a separate build or publishing step (Turborepo recommendation).
- A package is published to npm only when there is an external consumer. The first expected candidate is a client SDK for the public API (`@trybun/sdk`, generated from the OpenAPI document, [§12.1](12-api-webhooks-import.md)), added when the public API exists.
