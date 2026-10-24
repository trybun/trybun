# 14 – Architecture and technology stack

## 14.1 System components

| Component | Responsibility |
|---|---|
| **Web application** | User interface: end-user portal, forms, team views, roadmap, Gantt chart, GFM editor; the BFF endpoint `/api/v1/*` ([§14.4](#144-architectural-principles)) |
| **API** | Domain logic, permissions and visibility, REST API ([§12.1](12-api-webhooks-import.md)), real-time communication (WebSocket), incoming webhooks |
| **Worker** | Background jobs: GitHub webhooks, SLA timers, attachment scanning, incoming e-mail, notification batching, outgoing webhooks, imports, anonymization, outbox publishing, scheduled jobs ([§17.2](17-conventions.md)) |
| **Database** | System data, full-text and semantic search; a separate database for Keycloak in the same PostgreSQL instance |
| **Queue / cache** | Job queue, distributing real-time events between instances, API rate-limit counters, one-time WebSocket tickets |
| **Object storage** | Attachments (S3-compatible API); reachable only from the API and the Worker |
| **Identity provider** | Login, 2FA, login with GitHub, Microsoft and Google, password reset, brute-force protection of logins |
| **Reverse proxy** | Single public entry point, automatic HTTPS certificates, routing to the web application, the WebSocket gateway of the API and the sign-in endpoints of the identity provider ([§15.9](15-deployment.md)) |
| **Backup service** | Scheduled, encrypted backups of both databases, the object storage and the configuration ([§15.10](15-deployment.md)) |

## 14.2 Technology stack

| Layer | Technology |
|---|---|
| Language | TypeScript across the whole project |
| Web application | Next.js (App Router) + React; built in `standalone` mode; runtime configuration only from server-side environment variables – `NEXT_PUBLIC_*` variables are not used, because images are built once in CI and configured per installation |
| Web sign-in and session | Auth.js with the Keycloak provider, from its **stable release line**; if the App Router integration exists only as a pre-release, the chosen version is recorded in an ADR approved by a human (Rule 10). **Server-side sessions** (Auth.js `database` strategy with the project's own session adapter on Prisma, [ADR 0004](../adr/0004-authjs-version-and-session-strategy.md)); the `httpOnly`, `Secure`, `SameSite=Lax` cookie holds only an opaque session ID; tokens never reach the browser (**Backend for Frontend**, [§14.4](#144-architectural-principles)) |
| Data access from the web | Typed API client generated from the OpenAPI document (`openapi-typescript` + `openapi-fetch`) calling the BFF endpoint `/api/v1/*` of the web application; TanStack Query in client components |
| Internationalization | `next-intl` in the web application; `intl-messageformat` in the server (e-mails, API messages); message catalogues in ICU MessageFormat in `@trybun/i18n`, shared by web and server ([§14.6](#146-monorepo-structure)). Keycloak theme messages (`messages_en.properties`, `messages_pl.properties`) are generated from `@trybun/i18n` at build time into the login theme `trybun` (`docker/keycloak/themes/`), which is committed as part of the Keycloak configuration of the deployment package; `pnpm lint` fails when it differs from the catalogues |
| Dates and time zones | `date-fns` with `@date-fns/tz` for all time-zone and business-calendar arithmetic (SLA, [§9.4](09-sla.md)); IANA time-zone names |
| Markdown (GFM) | Own editor component in `@trybun/ui` (textarea, toolbar, Write/Preview, as on GitHub); rendering with `react-markdown` + `remark-gfm` + `rehype-sanitize`; the same unified pipeline renders Markdown on the server (e-mails) and the user documentation ([§2.3](02-agent-rules.md)) |
| Drag and drop | `dnd-kit` (pointer, touch and keyboard sensors) |
| Gantt chart | SVAR React Gantt, open-source MIT edition only (never the commercial PRO edition); scheduling logic lives in the API ([§10.4](10-roadmap-gantt.md)) |
| Charts | Recharts (basis of the shadcn/ui `Chart` component) |
| Product tours | `driver.js` (MIT), or own components built from `@trybun/ui` Popover and Drawer; libraries under AGPL or commercial licences (e.g. Intro.js, Shepherd.js) are not used. Tour progress is stored per user in the database ([§2.4](02-agent-rules.md)) |
| User documentation | Markdown files from the repository (`docs/user/`) rendered in the web application; search with a MiniSearch (MIT) index per language and account kind, built from the pages by `pnpm help:generate` before the build and checked by `pnpm lint` ([§2.3](02-agent-rules.md)) |
| Styling | Tailwind CSS 4 with the theme defined as design tokens (CSS variables, `@theme`); class-variance-authority for component variants, `cn` (the shadcn/ui package with the API of `twMerge(clsx(…))`) for combining classes |
| UI components | Project component library (`packages/ui`, `@trybun/ui`) based on Base UI (the default primitives of shadcn/ui) and Tailwind CSS, using **shadcn/ui** (MIT) as the starting point: component source is copied into the library with the shadcn CLI and owned by the project; component catalog in Storybook (Rule 6) |
| Rendering optimization | React Compiler, enabled in `web` (`reactCompiler: true` with `babel-plugin-react-compiler`) and in the Storybook of `@trybun/ui` (`compiler` option of `@vitejs/plugin-react`, which runs `oxc-transform-react`, the Rust port of the compiler, marked experimental); `eslint-plugin-react-hooks` with its `recommended` preset, including the compiler rules ([§18.5](18-code-patterns.md)) |
| Data tables | TanStack Table 9 (the basis of the shadcn/ui `Data Table`), the first version compatible with the React Compiler |
| API and Worker | NestJS (version 12 or later, for its native Standard Schema validation and serialization) – one backend application (`apps/server`) with two entry points: the API process and the Worker process ([§14.6](#146-monorepo-structure)) |
| Database | PostgreSQL with the pgvector extension and a Polish full-text dictionary, shipped as the project image `ghcr.io/trybun/postgres` ([§15.4](15-deployment.md)) |
| Database access | Prisma ORM 7 (ORM and migrations). Prisma ORM 8 is adopted only through a planned upgrade task (Rule 10), once it supports client extensions (required by `@casl/prisma`), atomic number operations, transaction isolation levels and unique-violation error codes, and once `@casl/prisma` supports it (the session adapter of the web application is the project's own code, [ADR 0004](../adr/0004-authjs-version-and-session-strategy.md)); the monthly dependency review ([§2.10](02-agent-rules.md)) schedules the move before the support of Prisma ORM 7 ends (at least 12 months after the general availability of Prisma ORM 8) |
| Authorization | CASL with `@casl/prisma`: one definition of abilities used both for action checks and for filtering database queries ([§14.4](#144-architectural-principles)) |
| Authentication | Keycloak; realm configuration applied with `keycloak-config-cli`; users and group memberships managed by the server through `@keycloak/keycloak-admin-client` ([§15.5](15-deployment.md)); JWT verification in the server with `jose` |
| Queue and scheduling | BullMQ + Valkey (Redis-compatible, BSD-3-Clause) through `@nestjs/bullmq`; all delayed and recurring jobs use BullMQ ([§17.2](17-conventions.md)); `@nestjs/schedule` is not used |
| Valkey client | `ioredis` (MIT) – one client library for BullMQ, the Socket.IO adapter and rate limiting. Redis-protocol client libraries are allowed; only the Redis server itself is not used ([§14.5](#145-alternatives-considered)) |
| Real-time | NestJS WebSocket gateway with Socket.IO and `@socket.io/redis-adapter` on Valkey |
| E-mail | Outgoing: SMTP via Nodemailer (works with any provider), templates in React Email. Incoming: provider webhook through an adapter interface; every adapter verifies the provider's request signature ([§6.3](06-comments-notifications.md)). Development: Mailpit |
| Logging | `nestjs-pino`: JSON logs with a request ID propagated from the API to the Worker; no personal data ([§13.2](13-non-functional.md), [§17.2](17-conventions.md)) |
| Rate limiting | Logins: brute-force detection of Keycloak. API: `@nestjs/throttler` with Valkey storage (`@nest-lab/throttler-storage-redis`) ([§14.4](#144-architectural-principles)) |
| Semantic search | Embeddings computed locally in the Worker with Transformers.js and the `multilingual-e5-small` model (MIT, 384 dimensions, supports Polish), stored in pgvector; no ticket content is sent to an external service ([§5.6](05-visibility-and-search.md)) |
| Files | Any S3-compatible storage through `@aws-sdk/client-s3`; SeaweedFS (Apache 2.0) included by default. Malware scanning with ClamAV (clamd over TCP, `clamscan` client); file type detection from content with `file-type`; EXIF stripping by re-encoding images with `sharp` |
| Backups | restic (BSD-2-Clause) in a dedicated backup container: encryption, S3 backend, retention ([§15.10](15-deployment.md)) |
| Reverse proxy | Caddy (automatic Let's Encrypt certificates) |
| Repository structure | Monorepo (pnpm workspaces + Turborepo); Node.js LTS and pnpm versions pinned in the repository (`.node-version`, `packageManager` field) |
| Validation and contracts | **Zod** (4.2 or later) – the only validation library. Schemas and types shared by frontend and backend live in `@trybun/contracts` ([§14.6](#146-monorepo-structure)). API: the native Standard Schema support of NestJS – `StandardSchemaValidationPipe` for requests and `StandardSchemaSerializerInterceptor` for responses – with the OpenAPI document generated from the same schemas by `@nestjs/swagger` ([§18.3](18-code-patterns.md)). Forms: React Hook Form with the Zod resolver (shadcn/ui `Form`) |
| Infrastructure | Docker and Docker Compose; CI/CD in GitHub Actions; images in GitHub Container Registry (`ghcr.io/trybun/<service>`, [§1.4](01-overview.md)) |
| Tests | Vitest (unit and integration), Testcontainers (real PostgreSQL and Valkey in integration tests), MSW (simulated external HTTP services), `@faker-js/faker` (test data factories), Playwright (E2E), axe (accessibility), Lighthouse (performance budget) |

## 14.3 Rationale

- **One language and shared contracts.** Rules for visibility, permissions, statuses and validation are defined once and used by both the UI and the API, eliminating discrepancies between layers.
- **Next.js + React** offers the most mature component ecosystem for a highly interactive UI (Kanban, Gantt, GFM editor, keyboard shortcuts) and good internationalization support. It is the framework recommended by the React documentation for new applications.
- **A separate NestJS backend**, because much of the logic runs outside user requests (SLA, queues, e-mail, scanning). A strongly structured framework with built-in conventions supports Rule 1.
- **Valkey** and **SeaweedFS** have permissive licenses (BSD-3-Clause, Apache 2.0) and active, vendor-neutral or community development, so the default stack contains no component with a restrictive or abandoned license (Rule 10, [§16.1](16-open-source.md)).
- **PostgreSQL** provides full-text search (first version of [§5.6](05-visibility-and-search.md)) and semantic search via pgvector (target version) without extra infrastructure.
- **Tailwind CSS** is the most common styling approach with Next.js and the styling basis of the widely used shadcn/ui pattern. Its theme is defined as design tokens (Rule 6) and its utilities are mobile-first by default (Rule 9).
- **shadcn/ui** is the most widely used way to build component libraries on headless primitives and Tailwind CSS. Its components are copied into the project, not installed as a dependency, so `@trybun/ui` stays fully under the project's control. It provides ready building blocks for the specification: `Command` (command palette, [§8.4](08-team-views.md)), `Drawer` (bottom sheets on phones, Rule 9), `Data Table` (list view, [§8.1](08-team-views.md)), `Toast`, `Calendar` and date pickers.
- **Base UI** has been the default primitive library of shadcn/ui since July 2026: stable since version 1.0 (December 2025) and actively developed. Its `Drawer` – the bottom sheet of Rule 9 – is part of the library, while the Radix flavour of shadcn/ui builds it on the unmaintained `vaul` (Rule 10).
- **Prisma** is the most popular ORM in the TypeScript ecosystem, with a mature migration system, type generation and documented NestJS integration.
- **Keycloak** provides proven login, 2FA and external login, including translated login screens. In a project delivered by AI agents it minimizes the amount of security code written in the project.
- **Server-side sessions** make it possible to end a session immediately (deactivation, [§7.4](07-users-organizations-permissions.md)) and keep the cookie small; a stateless JWT cookie can be neither revoked nor kept under the cookie size limit with Keycloak tokens.
- **Streaming downloads through the API** keeps the object storage private and lets the API set safe response headers for every file ([§13.3](13-non-functional.md)).
- **A popular stack** makes it easier to find specialists and helps AI agents work effectively.

## 14.4 Architectural principles

- The frontend contains no permission or visibility logic. Decisions are made only by the API; the frontend only adapts the UI.
- Authentication, 2FA and OAuth are handled by Keycloak. Custom implementations of security mechanisms are forbidden (Rule 1, [§13.5](13-non-functional.md)). API tokens ([§12.2](12-api-webhooks-import.md)) are handled by the system.
- Database access goes through Prisma. Where the ORM is not sufficient (full-text search, pgvector), only parameterized SQL queries are allowed.
- Incoming e-mail is handled by an e-mail provider that converts messages into webhooks, not by a self-hosted mail server. Outgoing e-mail uses SMTP, so any provider can be configured.

### Public routing

Caddy is the only public entry point ([§15.9](15-deployment.md)) and routes by path:

| Path | Target |
|---|---|
| `/socket.io/*` | API (WebSocket gateway) |
| `/auth/realms/trybun/*`, `/auth/resources/*` | Keycloak (sign-in endpoints only, [§15.5](15-deployment.md)) |
| `/api/auth/backchannel-logout` | Not routed (Keycloak calls it on the internal network) |
| everything else, including `/api/v1/*` | Web application |

- The API itself is **not exposed publicly**; Caddy routes all traffic to the web application, except WebSocket traffic and the Keycloak sign-in endpoints. The Keycloak administration console (`/auth/admin/*`) is never routed.
- The BFF path `/api/v1/*` maps 1:1 to the API's global prefix `api/v1`, so the public and the internal path of every endpoint are the same.
- Health endpoints of the API ([§17.2](17-conventions.md)) are not proxied by the BFF; they are reachable only on the internal network.

### Web ↔ API communication: Backend for Frontend (BFF)

Following the IETF guidance for browser-based applications, access tokens never reach the browser.

- The web application exposes one proxy endpoint `/api/v1/*`. It attaches the user's Keycloak access token from the server-side session, refreshes it when it expires (30 seconds before) and forwards the request to the API over the internal network. Token refreshes are serialized per session by a lock on its session row, so concurrent requests – also on several instances of the web application – never use a rotated refresh token twice. When the refresh is refused because the Keycloak session has ended, the web session is deleted and the request is forwarded without a token. When the API is unreachable, the BFF answers `503` with `server.unavailable`.
- Requests that already carry an `Authorization` header (API tokens of integrations, [§12.2](12-api-webhooks-import.md)) are forwarded with that header unchanged and without the `Cookie` header, so integrations use the same public URL and the API never receives cookies. A request that carries both a session cookie and an `Authorization` header is rejected with `400` and `request.malformed`, because its principal would be ambiguous (RFC 6750: one method per request).
- **Incoming webhooks** use dedicated public paths: `/api/v1/webhooks/github` ([§11.1](11-github-integration.md)) and `/api/v1/webhooks/email/{provider}` ([§6.3](06-comments-notifications.md)). The BFF forwards them byte for byte (body and headers unchanged). The API authenticates them only by their signature: it reads the raw request body before parsing and compares signatures in constant time (`crypto.timingSafeEqual`). These endpoints are rate-limited.
- Next.js server components call the API directly over the internal network with the session's token.
- Next.js Server Actions are not used as a second backend; Route Handlers exist only for the BFF proxy, Auth.js and the back-channel logout endpoint.
- **CSRF protection** applies to cookie-authenticated requests: session cookie with `SameSite=Lax`, and every state-changing request (`POST`, `PUT`, `PATCH`, `DELETE`) must carry an `Origin` header equal to the origin of the web application – the origin of `NEXTAUTH_URL`, which is `https://${TRYBUN_DOMAIN}` in Compose ([§15.3](15-deployment.md)); a missing or different `Origin` is rejected with `403` and `request.forbidden`, also for a request without a session. Requests authenticated with an `Authorization` header and signed webhook requests are not cookie-authenticated and are exempt from the `Origin` check.

### Sign-in and sessions

- **Sign-in.** Auth.js performs the OpenID Connect flow with Keycloak (`trybun-web` client). Keycloak is served on the same domain under `/auth` ([§15.5](15-deployment.md)).
- **Sessions** are stored on the server (Auth.js `database` strategy with the project's own session adapter on Prisma, [ADR 0004](../adr/0004-authjs-version-and-session-strategy.md)). The session row (`sessions`, in the schema of `apps/server`; the web application has its own Prisma client and uses only this table) holds a SHA-256 hash of the session token, the Keycloak user (`sub`) and session (`sid`), and the access and refresh tokens encrypted (JWE, AES-256-GCM, key derived from `AUTH_SECRET`); the cookie holds only the opaque session token. The session is looked up on every request, so deleting its row signs the user out at once. The web application stores no account data; the API resolves the account from the access token.
- **Sign-out** deletes the session row and ends the Keycloak session (logout endpoint with the refresh token).
- **Lifetimes** (configured in Keycloak and matched by the web session):

| Setting | Team members | End users |
|---|---|---|
| Access token | 5 minutes | 5 minutes |
| Session idle timeout | 30 minutes | 8 hours |
| Session maximum lifetime | 12 hours | 30 days |

- Refresh tokens are rotated on every use.
- **Ending sessions.** Keycloak back-channel logout notifies the web application (`POST /api/auth/backchannel-logout`, internal network only), which verifies the logout token (signature against the JWKS, `iss`, `aud` `trybun-web`, the back-channel logout event, no `nonce`) and deletes the sessions of its `sid` (or of its `sub` without a `sid`). Deactivating an account ([§7.4](07-users-organizations-permissions.md)) deletes all its sessions in Keycloak and in the web application and disconnects its WebSocket connections. In addition, the API checks the account state (`user.state`) on every request, so a deactivated account is refused even while an already issued access token is still valid.
- **Token validation in the API.** The API accepts only Keycloak access tokens and API tokens ([§12.2](12-api-webhooks-import.md)). A Keycloak JWT is verified against the Keycloak JWKS (fetched over the internal network) with: algorithm `RS256` only, `iss` equal to the public issuer URL `https://${TRYBUN_DOMAIN}/auth/realms/trybun`, `aud` containing `trybun-api`, and a valid `exp`. API tokens are recognized by their prefix (`trybun_pat_`, `trybun_int_`) and are never parsed as JWTs. The authentication guard ([§18.3](18-code-patterns.md)) then resolves the account whose Keycloak user ID equals `sub`; a missing token, an invalid token or an account that is not `active` returns `401` with the code `authentication.required`, a team member whose sign-in did not include a second factor (`amr` without `otp` or `hwk`) `401` with `authentication.second_factor_required` and `WWW-Authenticate: Bearer error="insufficient_user_authentication"` (RFC 9470).
- **Roles are never read from token claims.** The application database is the only source of roles and account state ([§7.4](07-users-organizations-permissions.md)); the JWT only identifies the user (`sub`).
- **Keycloak administration by the server.** The server manages Keycloak users, required actions and the `team` group through the Keycloak Admin API with a confidential service-account client (`trybun-server`) whose permissions are limited to managing users of the `trybun` realm. Its secret is generated by the install script ([§15.5](15-deployment.md)).

### Real-time connections

- The browser connects to the Socket.IO gateway of the API (`/socket.io`, routed by Caddy) with a **one-time ticket**. The BFF obtains it for the session from the API (`POST /api/v1/realtime-tickets`); the API stores a random 128-bit ticket bound to the user and the session in Valkey with a time-to-live of 30 seconds and consumes it atomically on connection (`GETDEL`).
- The gateway accepts the handshake only if its `Origin` header equals `https://${TRYBUN_DOMAIN}`.
- Every subscription (e.g. to a ticket or a board) is authorized with CASL, and permissions are checked again before each event is delivered, so a user never receives events about tickets they can no longer see.
- On logout, session expiry or deactivation the API disconnects all sockets of the session or the user. Open connections are re-validated at least once per access-token lifetime.
- When Valkey is unavailable, no tickets can be issued and real-time updates pause ([§17.2](17-conventions.md)); the UI keeps working without live updates.

### Rate limiting

- **Login brute force** is handled by Keycloak's brute-force detection, configured in the realm as code: after 5 failed attempts the account is temporarily locked for 1 minute, the wait doubles with each further failure up to 15 minutes; permanent lockout is off.
- **API rate limiting** uses `@nestjs/throttler` with Valkey storage. The key is the API token ID for API tokens, the user ID for session requests, and the client IP for unauthenticated endpoints (webhooks, setup token, invitation redemption). The client IP is taken from `X-Forwarded-For` set by Caddy and passed on by the BFF; the header is trusted only when the request comes from the internal network.
- Default limits: 100 requests per minute per user, 600 per minute per integration token, 20 per minute per IP for unauthenticated endpoints. Responses carry `RateLimit` and `RateLimit-Policy` headers and, when the limit is exceeded, `429 Too Many Requests` with `Retry-After` ([§12.1](12-api-webhooks-import.md)).
- If Valkey is unavailable, the throttler fails open and logs a warning; login protection in Keycloak is unaffected.

### Other principles

- **Authorization in one place.** All permissions ([§7.5](07-users-organizations-permissions.md)) and visibility rules ([§5.1](05-visibility-and-search.md)) are defined once as CASL abilities in the server. The same definition checks actions and builds Prisma filters (`accessibleBy`), so a list can never return a ticket that its detail view would refuse. The permission matrix is covered by automated tests.
- **Uploads and downloads.** Files are uploaded through the API into a quarantine area of the object storage, scanned by ClamAV in the Worker and only then made available. The object storage is never exposed publicly. Downloads are **streamed by the API** from `GET /api/v1/attachments/{id}/content` after the access check, with headers set by the API: `Content-Type` from the allowlist (never the value sent by the client), `Content-Disposition`, `X-Content-Type-Options: nosniff` and `Cache-Control: private` ([§13.3](13-non-functional.md)). Markdown refers to attachments only through this stable path.
- **Polish full-text search** requires a Polish dictionary installed in PostgreSQL. The project image `ghcr.io/trybun/postgres` contains the hunspell dictionary from sjp.pl (used under its Apache-2.0 licence option); the `polish` text search configuration is created by a database migration. Without it, word inflections are not recognized.
- All services run in containers. The local environment is reproducible with one command ([§15.12](15-deployment.md)).
- The repository structure and package boundaries follow [§14.6](#146-monorepo-structure); data and integration conventions follow [§17.2](17-conventions.md); the structure of the code inside the applications and packages follows the code design patterns of [18-code-patterns.md](18-code-patterns.md).
- **Zod is the only validation library** in the project. `class-validator`/`class-transformer`, Yup, Joi and similar libraries are not used.
  - Every schema crossing a boundary (API requests and responses, webhook events, import formats, WebSocket messages) lives in `@trybun/contracts` and is used by both sides.
  - Schemas used only inside one application (e.g. its configuration) stay in that application.
  - The API validates every request with the shared schema (global `StandardSchemaValidationPipe`, the schema declared on each parameter) and serializes every response with its response schema (`StandardSchemaSerializerInterceptor`); the OpenAPI document ([§12.1](12-api-webhooks-import.md)) is generated from the same schemas, so documentation and validation cannot drift apart.
  - Web forms validate with the same schemas (React Hook Form + Zod resolver) for immediate feedback; the API validation remains authoritative.
  - Environment variables are validated with a Zod schema at start-up of `server` and `web`; an invalid or missing variable stops the start with a clear message ([§15.3](15-deployment.md)).

## 14.5 Alternatives considered

| Alternative | Assessment |
|---|---|
| ASP.NET Core (API, background services, SignalR) + React frontend | Technically equivalent. Rejected only because of the lack of a shared language and contracts between layers |
| Next.js only (no separate backend) | Rejected – not designed for extensive background processing |
| Blazor | Rejected – weaker ecosystem of components for Kanban, Gantt and a GFM editor |
| PostgreSQL-based queue (e.g. pg-boss) instead of Valkey | Acceptable if minimizing infrastructure components becomes a priority |
| Redis instead of Valkey | Rejected – since 7.4 licensed RSALv2/SSPLv1, since 8.0 also AGPLv3; Valkey (Linux Foundation fork of Redis 7.2) keeps the permissive BSD license, vendor-neutral governance and protocol compatibility used by BullMQ. Redis-protocol client libraries (e.g. `ioredis`) are not affected and are used with Valkey |
| MinIO instead of SeaweedFS | Rejected – the community edition stopped publishing images and binaries (October 2025), entered maintenance mode and its repository was archived (2026); no security updates, which conflicts with Rule 10 |
| Garage or RustFS instead of SeaweedFS | Garage (AGPLv3) needs more configuration for a single node; RustFS (Apache 2.0) is promising but still young. Both can be used as external S3 storage ([§15.3](15-deployment.md)) |
| Drizzle instead of Prisma | Rejected – lighter and closer to SQL, but less established. Raw SQL for search is needed in both cases |
| Prisma ORM 8 from the start | Postponed – a release candidate in October 2026 (Rule 10), with a new architecture and without client extensions (required by `@casl/prisma`), atomic `increment`, transaction isolation levels and unique-violation error codes; Prisma ORM 7 keeps receiving bug fixes and security updates after the general availability of Prisma ORM 8, and both can run side by side during a later migration |
| `nestjs-zod` (Zod DTO classes, `ZodValidationPipe`) | Rejected – NestJS 12 validates and serializes with Standard Schema natively, and `@nestjs/swagger` 12 documents the same schemas, so a third-party layer is no longer needed; in October 2026 `nestjs-zod` supported NestJS only up to version 11. NestJS 11 with `nestjs-zod` remains the fallback if the verification in task S0-01 fails |
| Authentication library inside the application instead of Keycloak | Rejected – fewer infrastructure components, but more security code in the project |
| Stateless JWT session cookie (Auth.js default) | Rejected – cannot be revoked immediately and exceeds the cookie size limit with Keycloak tokens |
| Presigned download URLs pointing at the object storage | Rejected for the default deployment – the storage would have to be exposed publicly, and response headers for user files could not be guaranteed |
| `@nestjs/schedule` (in-process cron) | Rejected – runs in every Worker replica and duplicates jobs; BullMQ job schedulers run each job once |
| CSS Modules or CSS-in-JS (e.g. styled-components) instead of Tailwind CSS | Rejected – CSS-in-JS adds runtime cost and fits React Server Components poorly; CSS Modules are viable but have a smaller ecosystem of ready patterns with headless primitives |
| Radix UI as the primitives of `@trybun/ui` (`shadcn init -b radix`) | Rejected – no longer the shadcn/ui default; its `Drawer` depends on `vaul`, which is unmaintained (Rule 10), and new shadcn/ui components may exist only for Base UI (e.g. `Toast`) |
| React Aria as the primitives of `@trybun/ui` | Not chosen – strong accessibility and built-in translations, but the newest and not the default base of shadcn/ui (July 2026), with a different API |
| `clsx` with `tailwind-merge` for combining classes | Replaced by `cn` – the shadcn/ui package with the same API and output, installed by the shadcn CLI; components added with the CLI import it, so keeping both would mean two utilities for one problem (Rule 12) |
| Sonner for toasts | Not used – the shadcn/ui `Toast` built on Base UI keeps all overlays on one primitive library |
| A WYSIWYG editor (e.g. Tiptap) instead of a Markdown textarea | Rejected – converting between rich text and GFM is lossy; a textarea with toolbar and preview matches GitHub exactly ([§6.2](06-comments-notifications.md)) |
| Next.js Server Actions as the main way to change data | Rejected – it would create a second backend next to the API and duplicate validation and permissions |
| An external embedding API (e.g. a cloud AI provider) for semantic search | Rejected – ticket content would leave the installation (GDPR); a local model is sufficient for similarity search |
| Commercial Gantt libraries or the SVAR PRO edition | Rejected – not compatible with an MIT project without paid licences; the scheduling logic required by [§10.4](10-roadmap-gantt.md) is implemented in the API |
| Tour libraries under AGPL or commercial licences (Intro.js, Shepherd.js) | Rejected – not compatible with MIT distribution ([§16.1](16-open-source.md)) |
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
docker/
  postgres/         Dockerfile of ghcr.io/trybun/postgres (pgvector + Polish dictionary)
  server/, web/     Dockerfiles of ghcr.io/trybun/server and ghcr.io/trybun/web
  caddy/, keycloak/ Caddy and Keycloak configuration of the deployment package (§15.4)
compose.yaml        Docker Compose file of every environment (§15.1)
compose.dev.yaml    Override of the local environment (§15.12)
scripts/            Repository tooling run by CI, e.g. the specification consistency check
docs/
  user/             User documentation (Rule 3)
```

### Backend: one application, two processes

- `apps/server` contains all backend modules (domain, Prisma schema and migrations, integrations).
- It has two entry points: `src/main.ts` starts the **API** (HTTP and WebSocket), `src/worker.ts` starts the **Worker** (queues, scheduled jobs, no HTTP server, NestJS application context).
- Both processes are built into **one container image** (`ghcr.io/trybun/server`) and started as two Compose services with different commands. They remain separate processes as described in [§14.1](#141-system-components).
- This keeps the domain code in one place without an extra package, following the NestJS convention.
- **Module system and build.** All applications and packages are ES modules (`"type": "module"`, TypeScript `module` and `moduleResolution` set to `nodenext`). `apps/server` is **bundled** for production with the rspack builder of the NestJS CLI (webpack is deprecated in the NestJS 12 CLI): the `@trybun/*` workspace packages are inlined into the bundle from their TypeScript source, while npm dependencies stay external ([ADR 0003](../adr/0003-module-system-and-server-bundling.md)).

### Rules for packages

- A package is created only for a concrete reason: the code is used by at least two applications, or a hard boundary is needed (e.g. `@trybun/ui` must not import application code). No packages "just in case".
- Every package has one clear responsibility visible in its name. Catch-all packages such as `shared`, `common` or `utils` are not allowed.
- `@trybun/contracts` contains only what frontend and backend must understand identically (schemas, types, codes, mappings, labels). It contains no permission or visibility logic, which stays in the API ([§14.4](#144-architectural-principles)).
- Dependencies point in one direction only: applications → packages. Packages never import applications, and there are no cycles. `@trybun/contracts` and `@trybun/i18n` depend on no other project package; `@trybun/ui` does not depend on `@trybun/server`. These boundaries are enforced by lint rules in CI.
- Packages are **internal packages**: `"private": true`, referenced with the `workspace:*` protocol and consumed as TypeScript source, without a separate build or publishing step (Turborepo recommendation). The web application compiles them through `transpilePackages`, Vitest compiles them on the fly, and the server bundle inlines them (see above).
- A package is published to npm only when there is an external consumer. The first expected candidate is a client SDK for the public API (`@trybun/sdk`, generated from the OpenAPI document, [§12.1](12-api-webhooks-import.md)), added when the public API exists.
