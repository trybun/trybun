# Code review – Trybun

Repo-specific review rules for Trybun pull requests. The `om-code-review` skill applies this file **in addition to** its built-in generic checklist (correctness, security, breaking changes, quality); generic advice is not repeated here. Human reviewers use the same list.

This file is an index of checks, not a second specification. Every rule links to its source; when this file and the source disagree, the source wins ([`docs/spec/`](docs/spec/README.md) is the source of truth, [§2.8](docs/spec/02-agent-rules.md)) and this file is fixed. Entry points: [`AGENTS.md`](AGENTS.md), [`CONTRIBUTING.md`](CONTRIBUTING.md), the [Definition of Done](docs/spec/02-agent-rules.md) (§2.13) and the [pull request template](.github/pull_request_template.md). Contract and compatibility rules: [`BACKWARD_COMPATIBILITY.md`](BACKWARD_COMPATIBILITY.md).

## 1. Validation gate

Run from the repository root, in this order ([`verify-change`](.ai/skills/verify-change/SKILL.md), [`AGENTS.md`](AGENTS.md) commands):

| Command | Checks |
|---|---|
| `pnpm lint` | ESLint (naming, layer and package boundaries, Tailwind tokens, no suppressions), Prettier, Keycloak theme and help content up to date, Prisma checks, supply-chain pinning, ShellCheck |
| `pnpm lint:spec` | `§N.M` references of the specification |
| `pnpm typecheck` | TypeScript strict; unknown i18n keys fail here |
| `pnpm test` | Unit tests and the story tests of `@trybun/ui` (Chromium) |
| `pnpm test:coverage` | Unit, component and integration tests (Testcontainers, needs Docker) with the CI thresholds |
| `pnpm build` | All applications and the Keycloak login theme |

- Without Docker, `pnpm test:coverage` cannot run: report it as `NOT RUN` and require the PR to say so ([`verify-change`](.ai/skills/verify-change/SKILL.md)); CI remains authoritative.
- **CI-only gates** ([§2.14](docs/spec/02-agent-rules.md) "Automated quality gates", [`.github/workflows/`](.github/workflows)): E2E on phone/tablet/desktop with axe and the Lighthouse budget (`pnpm e2e`, job `E2E and Lighthouse`), link check (lychee), vulnerability audit (`pnpm audit`, high/critical block), dependency review with the license allowlist, CodeQL, secret scanning, commitlint on commits and the PR title, and the `DCO sign-off` job.
- A change of server entry points or `apps/server/rspack.config.js` also needs the start check of the built server ([`verify-change`](.ai/skills/verify-change/SKILL.md)).
- A change of endpoints needs `pnpm api:generate` output committed; a change of `docs/user/` needs `pnpm help:generate` output committed (`pnpm lint` catches stale help content).

## 2. Review priorities

Review in this order; stop escalating lower items while higher ones are open.

1. **Correctness** against the linked specification sections and the change specification in `.ai/specs/`, if any.
2. **Security and privacy** – BFF token boundary, CASL as the only authorization, 404-not-403, CSRF/CSP, no personal data in logs or URLs ([§13.5](docs/spec/13-non-functional.md), [§14.4](docs/spec/14-architecture.md), [§17.2](docs/spec/17-conventions.md)).
3. **Contracts and backward compatibility** – `@trybun/contracts`, `/api/v1`, webhook payload versions, environment variables, migrations ([`BACKWARD_COMPATIBILITY.md`](BACKWARD_COMPATIBILITY.md), [§2.11](docs/spec/02-agent-rules.md)).
4. **Spec conformance** – behaviour changes are proposed, never silent ([§2.8](docs/spec/02-agent-rules.md)).
5. **Patterns** – one pattern per problem ([§2.12](docs/spec/02-agent-rules.md), [§18](docs/spec/18-code-patterns.md)); new code follows its reference implementation ([§18.9](docs/spec/18-code-patterns.md)).
6. **Quality** – tests, docs, readability.

## 3. Repo-specific checks

### Server / API ([§18.3](docs/spec/18-code-patterns.md))

- [ ] Feature code lives in `modules/<feature>/` with the glossary plural name; technical code in `platform/<concern>/`; `platform` imports no `modules`; no `forwardRef` cycles.
- [ ] Controllers are thin: one service call, no Prisma, no `try/catch` mapping. Services hold no HTTP types. `domain/` files are pure (no NestJS, Prisma, I/O, `new Date()`/`Date.now()`).
- [ ] Every `@Body`/`@Query`/`@Param`/`@MessageBody` declares its contract `schema`; every handler declares `@ResponseSchema()`.
- [ ] Errors are `AppError` with a code from `@trybun/contracts/errors` (new codes added there with their status); no empty `catch`, no catch-log-rethrow.
- [ ] Versioned records: `If-Match` via `@ExpectedVersion()`, update through `versionedUpdate`/`assertVersionMatched` ([§17.2](docs/spec/17-conventions.md) "Concurrency").
- [ ] Lists use the cursor envelope `pageSchema` ([§18.4](docs/spec/18-code-patterns.md)).
- [ ] Config only via `platform/config` (no `process.env` elsewhere); time via the injected clock; logging via injected Pino with constant messages, no `console`; server texts via `Translator`, never literals or `toLocaleString`.
- [ ] External services behind an adapter interface; user-configured URLs only through the SSRF-protected client; no retry loops in request handlers.
- [ ] No repository layer, generic base classes, request-scoped providers, `@nestjs/cqrs` or event emitter ([§18.8](docs/spec/18-code-patterns.md)).

### Permissions and visibility ([§14.4](docs/spec/14-architecture.md), [§18.3](docs/spec/18-code-patterns.md) "Authorization")

- [ ] Every permission or visibility rule is a CASL rule in `<feature>.abilities.ts` – nowhere else (not in contracts, web, SQL or services).
- [ ] Every query returning records to a principal uses `accessibleBy(ability, action)`; records are never loaded first and checked afterwards; raw SQL returns IDs only and records are loaded through the ability.
- [ ] Invisible or missing records return **404, never 403**, also for referenced records; 404 is checked before 422/412/428 ([§17.2](docs/spec/17-conventions.md) "Errors"). Targets use `@TargetRecord(...)`.
- [ ] Responses the UI acts on carry `allowedActions` computed with the same ability.
- [ ] A new or changed action has rows in the permission matrix ([§7.5](docs/spec/07-users-organizations-permissions.md)) and an allowed and a denied case in `<feature>.abilities.spec.ts`.
- [ ] Roles are never read from token claims.

### Web BFF ([§14.4](docs/spec/14-architecture.md), [§18.5](docs/spec/18-code-patterns.md))

- [ ] No access/refresh token or API token reaches the browser; browser calls go only through the `/api/v1/*` BFF; server-only modules start with `import 'server-only'`.
- [ ] No cross-request caching of per-user API data (`'use cache'`, cached `fetch`, module-level caches); only audience-wide content such as rendered help may be cached.
- [ ] The UI shows/hides/disables actions only by `allowedActions`; no permission logic from roles or visibility; no CASL in the browser.
- [ ] No Server Actions as a backend (only `changeLanguage`); Route Handlers only for the BFF proxy, Auth.js, back-channel logout and `/api/health`.
- [ ] Data: `queryOptions` in `features/<feature>/queries.ts`, mutations in `mutations.ts` (with `If-Match` and invalidation), generated `openapi-fetch` client, no `fetch` in components or data fetching in `useEffect`.
- [ ] State: server data only in TanStack Query, view state in Zod-parsed URL params (never free-text search), no global store.
- [ ] Forms: React Hook Form + Zod resolver with the contract schema, `Field` components, `useWatch` not `watch()`.
- [ ] No new `useMemo`/`useCallback`/`memo` (React Compiler); `'use no memo'` only for a library incompatibility recorded in [`.ai/memory/react-compiler.md`](.ai/memory/react-compiler.md).
- [ ] Code not needed for the first paint is in a `lazy-<name>.tsx` wrapper; no `next/dynamic`.
- [ ] Security headers and CSP only in `apps/web/src/proxy.ts` ([§13.5](docs/spec/13-non-functional.md)).

### Data, Prisma and migrations ([§17.2](docs/spec/17-conventions.md), [§18.3](docs/spec/18-code-patterns.md))

- [ ] One use case = one `prisma.$transaction(async (tx) => …)`; collaborators take `tx` first; activity events, audit log entries and outbox events are written in that transaction.
- [ ] A module writes only its own models; explicit `select`; services return contract types via `to<Resource>Response`.
- [ ] Raw SQL only in `<feature>.sql.ts` with `$queryRaw` tagged templates; no `Prisma.raw` with input, `$queryRawUnsafe` or concatenation; no TypedSQL.
- [ ] Migrations: Prisma Migrate, snake_case name, **forward-only**; data-losing changes split into compatible steps or marked breaking; non-modelled objects created in SQL ([§17.2](docs/spec/17-conventions.md) "Migrations"). Read [`.ai/memory/prisma.md`](.ai/memory/prisma.md).
- [ ] No generic soft delete; tickets are never deleted; activity events store values, not foreign keys to deletable records ([§17.2](docs/spec/17-conventions.md) "Deleting data").
- [ ] Prisma enums match their contract enums (unit test); no Prisma ORM 8.

### Worker and outbox ([§17.2](docs/spec/17-conventions.md), [§18.3](docs/spec/18-code-patterns.md) "Events and background jobs")

- [ ] Every side effect starts from an outbox event; nothing is sent from the request after the commit; no in-process event bus.
- [ ] Event payloads carry IDs and changed values only – no free text or personal data; webhook payloads are versioned schemas in `@trybun/contracts`.
- [ ] One job per consumer; processors run in `LogContext.runJob`, validate job data, call one service method and are idempotent (deterministic `jobId`, unique constraints).
- [ ] Timers use debounce deduplication by subject key and re-check state; recurring work uses `upsertJobScheduler`; job IDs contain no `:` and are not digits only ([`.ai/memory/bullmq.md`](.ai/memory/bullmq.md)).
- [ ] Processors are registered only in `<feature>-worker.module.ts` (API never consumes queues).

### UI ([§2.6](docs/spec/02-agent-rules.md), [§2.9](docs/spec/02-agent-rules.md), [§18.6](docs/spec/18-code-patterns.md), [§13.4](docs/spec/13-non-functional.md))

- [ ] New UI elements are `@trybun/ui` components from shadcn/ui on Base UI (existing ones extended first); presentational, cva variants, `className` merged with `cn`, Base UI prop names, no `forwardRef`/`asChild`/Radix/`vaul` ([`ui-component`](.ai/skills/ui-component/SKILL.md), [`.ai/memory/shadcn.md`](.ai/memory/shadcn.md)).
- [ ] Only Tailwind theme tokens: no arbitrary values, literal colours, inline `style`, or other styling approach; long class lists stay inside `@trybun/ui`.
- [ ] Mobile first from 360 px: 44 px touch targets on phone/tablet, 16 px form text, bottom sheets on phones, safe areas, no hover-only actions, drag-and-drop alternatives.
- [ ] No string literals in JSX; texts via `next-intl` with keys in **both** EN and PL catalogues of `@trybun/i18n`; dates/numbers via the `next-intl` formatter ([§13.1](docs/spec/13-non-functional.md)).
- [ ] Storybook stories for all states on `Phone`, `Tablet`, `Desktop` with `play` tests (light and dark, axe).
- [ ] A changed view covered by a tour updates the tour (`features/product-tours/tours/`, `data-tour` targets, `PRODUCT_TOUR_VERSIONS` when steps change) ([§2.4](docs/spec/02-agent-rules.md)); a new key page is added to the Lighthouse budget ([§2.9](docs/spec/02-agent-rules.md)).

### Tests ([§2.14](docs/spec/02-agent-rules.md) "Testing approach", [§18.7](docs/spec/18-code-patterns.md))

- [ ] Business rules have table-driven unit tests (`it.each`); services and endpoints have `*.integration.spec.ts` against PostgreSQL and Valkey in Testcontainers with factories.
- [ ] The database, Prisma and the project's own services are **never mocked**; doubles only at external boundaries (MSW, fixed clock, adapters).
- [ ] E2E: page objects, `getByRole`/label/text locators, never CSS classes; key paths on phone, tablet and desktop ([`.ai/memory/e2e.md`](.ai/memory/e2e.md)).
- [ ] No `@ts-ignore`, lint-disable, `v8`/`istanbul`/`c8` ignore comments, skipped tests, lowered thresholds or new coverage exclusions in `vitest.config.ts` ([§2.14](docs/spec/02-agent-rules.md) "Fix the cause, never the gate").

### Docs, spec and memory

- [ ] `docs/spec/` updated in the same PR; behaviour/requirement changes are listed under "Specification changes", in a separate `docs(spec):` commit, and never decided by the agent ([§2.8](docs/spec/02-agent-rules.md)); glossary, permission matrix and plan kept consistent.
- [ ] Functionality PRs have an approved change specification, moved to `.ai/specs/implemented/` ([§2.8](docs/spec/02-agent-rules.md)).
- [ ] User docs in `docs/user/` updated in **EN and PL** under the same path, Diátaxis category, `views` front matter ([§2.3](docs/spec/02-agent-rules.md), [`docs/user/README.md`](docs/user/README.md)).
- [ ] `README.md` and the `AGENTS.md` commands table updated when commands, setup, env vars or structure change ([§2.5](docs/spec/02-agent-rules.md)); English in code and technical docs.
- [ ] New pitfalls recorded in `.ai/memory/` with the index in sync; no secrets or personal data ([§2.7](docs/spec/02-agent-rules.md)).
- [ ] The completed plan task is marked `[x]` in [`docs/plan/implementation-plan.md`](docs/plan/implementation-plan.md); a new pattern is proposed in [§18](docs/spec/18-code-patterns.md), a changed one has an ADR in `docs/adr/` ([§2.12](docs/spec/02-agent-rules.md)).

### Dependencies ([§2.10](docs/spec/02-agent-rules.md))

- [ ] A new dependency is really needed, maintained, widely used, MIT-compatible ([§2.14](docs/spec/02-agent-rules.md) "License policy"), at least 7 days old (security fixes excepted), stable, added with an explicit range – never a dist-tag. See [`.ai/memory/toolchain.md`](.ai/memory/toolchain.md).
- [ ] Lockfile committed; install scripts only via `allowBuilds`; Actions pinned to SHA and images to digest; accepted advisories listed with a reason.
- [ ] No second validation library (Zod only), DI container, styling approach, UI primitive library, Redis server, MinIO, WYSIWYG editor, external AI API or SVAR Gantt PRO ([`AGENTS.md`](AGENTS.md) "Never").

### Commits and PR ([§2.11](docs/spec/02-agent-rules.md), [§2.14](docs/spec/02-agent-rules.md), [`CONTRIBUTING.md`](CONTRIBUTING.md))

- [ ] PR title and commits are Conventional Commits with a scope from the closed list of [§2.14](docs/spec/02-agent-rules.md); every commit has a `Signed-off-by` line.
- [ ] One focused task per PR, linked spec sections, branch name `KEY-123-…`, `S0-01-…` or `cez/<id>`; template filled, non-applicable DoD items marked "n/a" with a reason.
- [ ] Breaking changes (removed/renamed env var, manual update step, removed feature, removed API version, higher server requirements) marked with `!` or `BREAKING CHANGE:` describing the Administrator's steps.
- [ ] No hand-edited versions, `CHANGELOG.md` or `Release-As:` footer.

## 4. Severity guidance

Severities follow `om-code-review` (blocker / major / minor / nit). Trybun examples:

| Severity | Examples |
|---|---|
| **blocker** | A suppression (`@ts-ignore`, lint-disable, coverage-ignore), skipped test, lowered threshold or new coverage exclusion; permission or visibility logic outside CASL abilities, a query without `accessibleBy`, or `403` for an invisible record; a token reaching the browser or per-user API data cached across requests; personal data, tokens or content in logs, URLs or event payloads; a mocked database in integration tests; raw SQL with unparameterized input; an unmarked breaking change or a broken protected surface of [`BACKWARD_COMPATIBILITY.md`](BACKWARD_COMPATIBILITY.md); a behaviour change not listed as a specification change; a failing gate; missing DCO sign-off |
| **major** | A second pattern for a covered problem (side effect outside the outbox, repository layer, global store, `fetch` in a component); a write outside the use-case transaction; a non-idempotent job; missing permission tests for a new action; missing EN or PL user docs, or a missing PL catalogue text; missing integration test for a new endpoint; touch targets under 44 px or a hover-only action; spec, README or help content not updated; a dependency added by dist-tag or inside the cooldown |
| **minor** | Missing Storybook state or viewport; manual memoization in new code; `utils`/`helpers` naming; missing memory entry for a pitfall found during the task; missing `select`; plan checkbox not ticked |
| **nit** | Wording of docs or comments, ordering within a file, naming polish not enforced by lint |

### `risk-high` areas in Trybun

[`SDLC.md`](SDLC.md) defines the `risk-high` areas and the evidence they need. In this repository they map to: **auth and sessions** – `apps/server/src/platform/authentication/`, `apps/web/src/lib/auth/`, the BFF proxy, `docker/keycloak/`; **permissions and data scoping** – `*.abilities.ts`, `platform/authorization/`, `accessibleBy` queries, `allowedActions`; **schema migrations** – `apps/server/prisma/`; **shared contracts** – the protected surfaces of [`BACKWARD_COMPATIBILITY.md`](BACKWARD_COMPATIBILITY.md): error codes and webhook payload schemas in `@trybun/contracts`, `/api/v1` endpoints, webhook payloads, environment variables. Trybun has no money area.
