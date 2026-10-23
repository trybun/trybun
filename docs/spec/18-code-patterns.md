# 18 – Code design patterns

This chapter defines **one pattern for every recurring problem in the code** (Rule 12, [§2.12](02-agent-rules.md)), so that code written by different agents at different times looks as if one team wrote it. The patterns follow the conventions of each technology in the stack (Rule 1, [§14.2](14-architecture.md)). The chapter states which pattern is used where; code examples live in the reference implementations and the project skills ([§18.9](#189-enforcement-and-changes)). Naming conventions are in [§17.1](17-conventions.md), data and integration conventions in [§17.2](17-conventions.md).

## 18.1 Principles

- **One way to do it.** A problem covered by this chapter is solved only with its pattern, even where another approach would also work. Improvements change the pattern for the whole codebase ([§18.9](#189-enforcement-and-changes)); they are never introduced in one place.
- **Framework conventions, no in-house framework.** NestJS modules and dependency injection, the Next.js App Router, React hooks and TanStack Query are used as their documentation describes. No abstractions on top of them: no generic base classes (`BaseService<T>`, `BaseRepository<T>`, generic CRUD controllers) and no wrappers that duplicate a framework feature.
- **Vertical slices.** Code is organized by feature, not by technical layer. A feature has the same name in the server (`modules/<feature>/`), in the contracts (`<feature>/`) and in the web application (`features/<feature>/`): the plural of its main resource from the [glossary](00-glossary.md), e.g. `tickets`, `saved-views`.
- **Functional core, imperative shell.** Business rules (visibility, status transitions, SLA time, scheduling, error grouping) are pure functions without I/O, framework or database access. Services around them load data, call the rules and store the result. Rules are unit-tested; services are integration-tested against real databases ([§2.14](02-agent-rules.md)).
- **Explicit data flow.** Dependencies come through constructor injection; the acting principal, the database transaction and the current time are passed as parameters. No global mutable state, no service locator (`ModuleRef.get` at run time), no request-scoped providers.
- **Simple first (KISS, YAGNI).** Composition over inheritance. An interface with a single implementation exists only at the boundary to an external service ([§18.3](#183-server-application)). No speculative options or extension points (Rule 6).
- **Named by responsibility.** No files or folders named `utils`, `helpers`, `common`, `shared` or `misc` in applications (as for packages, [§14.6](14-architecture.md#146-monorepo-structure)). The only exception is `lib/utils.ts` with `cn` in `@trybun/ui`, kept where the shadcn CLI expects it.
- **Named exports.** Default exports only where a framework requires them (Next.js route files, configuration files).

## 18.2 Quick reference

| Problem | Pattern | Section |
|---|---|---|
| A new domain area | Feature module in the server, resource folder in the contracts, feature folder in the web – same name | [§18.3](#183-server-application), [§18.5](#185-web-application) |
| A business rule | Pure function in the module's `domain/` folder; the current time is a parameter | [§18.3](#183-server-application) |
| An HTTP endpoint | Thin controller method calling one service method; request and response schemas from the contracts | [§18.3](#183-server-application) |
| Order of checks (404 before 403, 422, 412, 428) | The fixed request pipeline | [§18.3](#183-server-application) |
| A permission or visibility rule | CASL rule in `<feature>.abilities.ts`; every query through `accessibleBy` | [§18.3](#183-server-application) |
| Showing only permitted actions in the UI | `allowedActions` sent by the API | [§18.3](#183-server-application), [§18.5](#185-web-application) |
| Changing data | Service use case in one transaction: change, activity events, audit log entry, outbox event | [§18.3](#183-server-application) |
| Concurrent edits | `version` with `If-Match` and a conditional update | [§18.3](#183-server-application) |
| A side effect of a change | Outbox event handled by an idempotent Worker job | [§18.3](#183-server-application) |
| Delayed or recurring work | Delayed job deduplicated by a subject key (debounce) that re-checks the state, or a job scheduler | [§18.3](#183-server-application) |
| Using another module | Its exported service; its records are written only through it | [§18.3](#183-server-application) |
| An external service | Adapter interface and implementation; MSW in tests | [§18.3](#183-server-application) |
| An error | `AppError` with a code from the contracts, rendered as Problem Details | [§18.3](#183-server-application) |
| Raw SQL | Parameterized `$queryRaw` in `<feature>.sql.ts` returning IDs; records loaded through the ability | [§18.3](#183-server-application) |
| Configuration, logging, current time | Typed configuration, injected logger, injected clock | [§18.3](#183-server-application) |
| A schema, type, enum or error code used by two applications | `@trybun/contracts/<feature>`; types from `z.infer` | [§18.4](#184-contracts-and-packages) |
| A list endpoint | Cursor pagination with the shared envelope | [§18.4](#184-contracts-and-packages) |
| A page | Thin route file: parse parameters, prefetch, compose feature components | [§18.5](#185-web-application) |
| Reading data in the browser | `queryOptions` factory in `queries.ts`; prefetch on the server and hydrate | [§18.5](#185-web-application) |
| Changing data from the browser | Mutation hook in `mutations.ts` | [§18.5](#185-web-application) |
| View state | URL search parameters parsed with Zod (never free text); otherwise local state | [§18.5](#185-web-application) |
| A form | React Hook Form with the Zod resolver and the contract schema | [§18.5](#185-web-application) |
| Memoization | React Compiler; no manual `useMemo`, `useCallback` or `memo` in new code | [§18.5](#185-web-application) |
| Live updates | Thin real-time event that invalidates queries | [§18.3](#183-server-application), [§18.5](#185-web-application) |
| Texts, dates and numbers | `next-intl` messages and formatter | [§18.5](#185-web-application) |
| A keyboard shortcut or palette command | One entry in the command registry | [§18.5](#185-web-application) |
| A UI element | `@trybun/ui` component from shadcn/ui: presentational, composable, variants with cva | [§18.6](#186-ui-components) |
| Tests | Unit tests for rules, integration tests on real databases, test doubles only at external boundaries | [§18.7](#187-tests) |

## 18.3 Server application

### Layout

```
apps/server/
  prisma/                       Prisma schema and migrations
  src/
    main.ts                     API entry point (ApiModule)
    worker.ts                   Worker entry point (WorkerModule, application context)
    api.module.ts               root module of the API process
    worker.module.ts            root module of the Worker process
    modules/<feature>/          domain feature modules, e.g. tickets, comments, projects
      <feature>.module.ts         wiring; exports the services other modules may use
      <feature>.controller.ts     HTTP endpoints
      <feature>.service.ts        use cases
      <feature>.abilities.ts      CASL rules for the feature's subjects
      <feature>.sql.ts            parameterized raw SQL queries, if the feature needs them
      <feature>.processor.ts      queue job handlers
      <feature>-worker.module.ts  registers the processors and job schedulers
      domain/                     pure business rules, files named by concept (status-transitions.ts)
    platform/<concern>/         technical modules: config, database, authentication, authorization,
                                errors, outbox, queues, logging, health, clock, mail, storage, …
  test/                         factories, MSW handlers and set-up of integration tests
```

- A file exists only when the module needs it; a module without endpoints has no controller.
- `platform` never imports `modules`. Feature modules use each other only through the services exported by `<feature>.module.ts`; dependencies between modules form no cycles (no `forwardRef`).
- Processors and job schedulers are registered only in `<feature>-worker.module.ts`, imported only by `WorkerModule`, so the API process never consumes queues.

### Layers

| Layer | Contains | May use | Never |
|---|---|---|---|
| Transport: controller, gateway, processor | Route or job, request and response schemas, principal and `If-Match` extraction; one service call | Services of its module | Prisma, business rules, mapping errors with `try/catch` |
| Application: service | One public method per use case: authorization, transaction, persistence, activity, audit, outbox, response mapping | Domain rules, Prisma, exported services of other modules, adapters | HTTP types (`Request`, `Response`, NestJS HTTP exceptions) |
| Domain: `domain/` | Pure functions and types of the business rules | Other domain files, `@trybun/contracts`, `AppError` | NestJS, Prisma, I/O, reading the clock (`new Date()`, `Date.now()`) |

### Request pipeline

Every endpoint follows the order of checks of [§17.2](17-conventions.md) through the NestJS request lifecycle (guards → interceptors → pipes → handler):

1. **Authentication guard** (global): resolves the principal from the session's access token or an API token; otherwise `401`.
2. **Target record guard**, declared on the handler with one decorator (subject, path parameter, action): the records addressed by the path are looked up through the principal's ability; a missing or invisible record returns `404`; a visible record on which the action is not permitted returns `403` (or the code of the denying rule, see "Authorization"). It runs before validation, so the response for an invisible record never depends on the body or the headers.
3. **Idempotency interceptor** on creating endpoints: replays the first response for a repeated `Idempotency-Key` ([§12.1](12-api-webhooks-import.md)).
4. **Validation** (global `StandardSchemaValidationPipe` with `errorHttpStatusCode: 422`): every `@Body`, `@Query`, `@Param` and `@MessageBody` declares its contract schema with the `schema` option, because a parameter without it is not validated; one `exceptionFactory` turns the issues into `422` with `errors[]`. A missing `If-Match` on a versioned record returns `428`.
5. **Controller**: calls one service method with the principal, the identifiers, the input and the expected version.
6. **Service**: loads the records it changes inside its transaction through the ability; referenced records (e.g. a milestone, the original of a duplicate) not visible, `404`; field-level permission rules (e.g. a Developer assigns only themselves), `403`; business rules, `422` or `409`; stale version, `412`.
7. **Serialization** (global `StandardSchemaSerializerInterceptor`): the response schema is declared once per handler with the project's response decorator `@ResponseSchema()`, which combines `@SerializeOptions({ schema })` with `@ApiResponse({ standardSchema })`. The schema's output is sent, so fields outside the schema are stripped and a record never carries fields its audience must not see; a response that does not match its schema is a server error (`500`).
8. **Exception filter** (global): every error becomes Problem Details ([§17.2](17-conventions.md)); unexpected errors are logged once with the request ID and returned as `500` without details.

### Authorization

- **Principal**: every request and job acts as a principal – a user (session or personal access token limited by its scope), an integration token or the system ([§12.2](12-api-webhooks-import.md)). It is resolved once per request and passed to service methods as their first parameter.
- **Abilities**: one ability factory (`platform/authorization`) builds the CASL ability of a principal from the rules each module defines in `<feature>.abilities.ts`. Global restrictions – the token scope ([§12.2](12-api-webhooks-import.md)) and the archived state of projects ([§7.5](07-users-organizations-permissions.md)) – are added last as `cannot` rules, so they override every other rule. A rule that stands for a state of a record carries its error code as the reason (e.g. `project.archived`), which is returned with that code's status instead of `403`.
- Subjects are the Prisma model names; actions are snake_case codes from a closed list per subject in `@trybun/contracts` (e.g. `read`, `update`, `change_status`, `assign`, `redact`).
- **Queries**: every query that returns records to a principal adds `accessibleBy(ability, action)` to its `where`. Lists and details use the same rule, so a list never returns a record its detail would refuse ([§14.4](14-architecture.md#144-architectural-principles)). A record is never loaded first and checked for visibility afterwards.
- **Allowed actions**: responses of records the UI acts on contain `allowedActions` – the codes of the actions the principal may perform on that record, computed with the same ability. Actions on a project come with the project; global actions (e.g. creating a project) with the current account. The web application adapts the UI only to these values ([§18.5](#185-web-application)).
- **Permission tests**: `<feature>.abilities.spec.ts` lists the rows of [§7.5](07-users-organizations-permissions.md) for the module as a table, each with an allowed and a denied case.

### Writing data

- **One use case, one transaction.** A service method that changes data opens one interactive transaction (`prisma.$transaction(async (tx) => …)`). Inside it, only the transaction client `tx` is used.
- **Collaborators take `tx`.** Methods that must take part in the caller's transaction – activity events, audit log entries, outbox events, writes of other modules – take the transaction client as their first parameter (before the principal, if they need one); they never open a transaction or use `PrismaService` themselves.
- **Same transaction**: activity events ([§4.5](04-ticket-lifecycle.md)), audit log entries ([§13.5](13-non-functional.md)) and outbox events ([§17.2](17-conventions.md)) are written in the transaction of the change. Field changes are turned into activity events by one function of the activity module, from the record before and after the change.
- **Ownership**: a module writes only its own models; it changes the records of another module only through that module's exported service. Reads may join across models through Prisma relations.
- **Optimistic locking**: versioned records ([§17.2](17-conventions.md)) are changed with one conditional update on `id` and `version` that increments `version`; no affected row returns `412`. It is implemented once in `platform/database` and used by every versioned update.
- **Identifiers**: UUIDv7 from the Prisma schema default; code that needs an ID before the insert (e.g. an outbox event) uses the one ID function of `platform/database`.

### Reading data

- `PrismaService` (`platform/database`) is the only database client and is injected only into services and platform modules. Cross-cutting database behaviour (e.g. the extension required by `@casl/prisma`) is added once to this client as a Prisma client extension.
- Every query uses an explicit `select` for its response shape; services return contract types, never Prisma models. Each response shape has one mapping function next to its service (`to<Resource>Response`), which also adds `allowedActions`.
- **Raw SQL** (full-text search, pgvector, trigram similarity, [§14.4](14-architecture.md#144-architectural-principles)) lives only in `<feature>.sql.ts`: one function per query, written as a `$queryRaw` tagged template with a declared row type. Fragments are composed with `Prisma.sql` and `Prisma.join`; input never reaches `Prisma.raw`, `$queryRawUnsafe` or string concatenation. TypedSQL is not used while it is a Prisma preview feature (Rule 10). A raw query that finds records for a principal returns identifiers and ranking only; the records are then loaded through the ability, so visibility rules are never re-implemented in SQL.

### Events and background jobs

- **After the commit, only through the outbox.** Every side effect – notifications, webhooks, GitHub synchronization, search indexing, live updates – starts from an outbox event ([§17.2](17-conventions.md)). Nothing is sent from the request after the transaction, and no in-process event bus is used for side effects.
- **Event payloads** carry identifiers and the changed values consumers need (e.g. the previous and the new status), never free-text content or personal data; handlers load the current state. Internal event schemas live in the producing module (`<feature>.events.ts`); payloads of outgoing webhooks are versioned schemas in `@trybun/contracts` ([§12.4](12-api-webhooks-import.md)).
- **Handlers**: every consumer of an event type is its own job, so a retry of one consumer never repeats another. A processor validates the job data with its schema, calls one service method and is idempotent ([§17.2](17-conventions.md)): deterministic `jobId`s, unique constraints or delivery IDs prevent double effects.
- **Timers** are delayed jobs deduplicated by a subject key in BullMQ's debounce mode; they carry only identifiers and re-check the state when they run, so they are never cancelled. **Recurring work** uses job schedulers (`upsertJobScheduler`); work enqueued only once uses a custom `jobId` – all as defined in [§17.2](17-conventions.md). Queue names, job names and key builders are constants and functions of the owning module.
- **Principal of a job**: the system principal. Where permissions decide the outcome (e.g. the recipients of notifications, [§6.7](06-comments-notifications.md)), the job checks them with the ability of the affected user.
- **Live updates** are produced from outbox events: a real-time event is a thin message (subject, ID, version, event name) without record content; the gateway checks the permissions of each socket before delivering it ([§14.4](14-architecture.md#144-architectural-principles)); clients load the data through the API.

### External services

- Every external service – SMTP, the e-mail provider, object storage, ClamAV, GitHub, the Keycloak Admin API, the embedding model – is used through an **adapter**: an interface owned by the consuming module and an implementation bound to it with a DI token. Business code depends only on the interface; adapters translate external errors into `AppError` codes and never expose SDK types.
- Retries of external calls use BullMQ job retries with exponential backoff ([§17.2](17-conventions.md)); request handlers contain no retry loops.
- Requests to URLs configured by users (outgoing webhooks) go only through the one HTTP client with SSRF protection ([§12.4](12-api-webhooks-import.md)).

### Errors, configuration, logging and time

- **Errors** are thrown as `AppError` with an error code from the closed list in `@trybun/contracts`, which also defines the HTTP status of each code, and optional field errors (`pointer`, `code`). `AppError` has no framework dependencies; the global exception filter renders it as Problem Details. Code that cannot handle an error lets it propagate: no empty `catch`, no catch-log-rethrow.
- **Configuration** is read only by `platform/config`, validated with Zod at start-up ([§14.4](14-architecture.md#144-architectural-principles)) and injected as a typed object; `process.env` is not used anywhere else.
- **Logging** uses the injected Pino logger with constant messages and structured fields (`{ ticketId, code }`), never personal data or content ([§17.2](17-conventions.md)); `console` is not used.
- **Time** comes from the injected clock (`platform/clock`); domain functions receive `now` as a parameter, and tests use a fixed clock.

## 18.4 Contracts and packages

- `@trybun/contracts` is organized by feature (`src/<feature>/`): request, response and event schemas of the feature's resources, their enums, action codes ([§18.3](#183-server-application)) and error codes. Shared building blocks (pagination envelope, Problem Details, error-code registry) have their own folders.
- Request schemas are named after the action (`createTicketSchema`, type `CreateTicketDto`), response schemas after the resource (`ticketSchema`, type `Ticket`) ([§17.1](17-conventions.md)). Types are always inferred with `z.infer` and exported next to their schema; no application declares a second type for a shape that has a schema.
- Enum values are the glossary codes, defined once with `z.enum`; a unit test verifies that each Prisma enum has the same values as its contract enum.
- **Lists**: every list endpoint uses cursor pagination ([§12.1](12-api-webhooks-import.md)) with one envelope defined in the contracts – query parameters `cursor` and `limit`, response `{ items, nextCursor }` – from the first list endpoint on.
- Packages expose subpath entry points through `exports` (e.g. `@trybun/contracts/tickets`, `@trybun/ui/components/button`); no barrel file re-exports a whole package or folder.

## 18.5 Web application

### Layout

```
apps/web/src/
  app/                          routes only (App Router)
    (portal)/                   end-user portal (§5.7)
    (team)/                     team views and the Administrator panel
    api/                        Route Handlers allowed by §14.4
  features/<feature>/           same name as the server module
    components/                 feature components, composed from @trybun/ui
    queries.ts                  query keys and queryOptions factories of the feature
    mutations.ts                mutation hooks of the feature
    search-params.ts            Zod schema of the feature's URL state, if it has one
  lib/<concern>/                api-client, auth, i18n, query-client, realtime, commands, errors, env
  proxy.ts                      security headers and the CSP nonce (§13.5)
```

- Route files (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`) stay thin: they parse parameters with a Zod schema, prefetch data and compose feature components.
- Dependencies point one way: `app` → `features` → `lib` → packages. Features may use each other's components, queries and mutations; imports between features form no cycles.
- Modules for the server only start with `import 'server-only'` (session, server API client, environment); modules for the browser only start with `import 'client-only'`.

### Rendering and reading data

- Components are Server Components by default; `'use client'` marks only the smallest component that needs state, effects or browser APIs.
- **Memoization** is left to the React Compiler ([§14.2](14-architecture.md)): new code has no `useMemo`, `useCallback` or `memo`, except as an escape hatch for a value whose identity must stay stable (e.g. an effect dependency). `'use no memo'` is used only for a library incompatibility recorded in project memory, never to work around a defect of the project's own code.
- Data tables use TanStack Table 9 (`useTable`); a nested row or cell component that receives only table objects reads its state through `Subscribe`.
- Data rendered only by Server Components is read with the server API client (internal network, the session's token, [§14.4](14-architecture.md#144-architectural-principles)). Data used by client components is defined once as a `queryOptions` factory in `features/<feature>/queries.ts`, prefetched on the server and passed to the client with `HydrationBoundary`; the client reuses the same query options.
- Query keys are hierarchical and start with the feature (`['tickets', 'detail', id]`); they are built only in `queries.ts`. Paginated lists use `infiniteQueryOptions` with the cursor envelope ([§18.4](#184-contracts-and-packages)).
- All API calls use the generated typed client (`openapi-fetch`); no `fetch` in components and no data fetching in `useEffect`.
- **No cross-request caching** of API data on the web server (`'use cache'`, cached `fetch` and similar): responses depend on the user's permissions. Only content that is identical for every user of an audience and language, such as rendered user documentation ([§2.3](02-agent-rules.md)), may be cached.
- The session is read only through one server-only function of `lib/auth`, cached per request with React `cache()` and used by the server API client, layouts and pages; without a session it redirects to sign-in. `proxy.ts` makes only optimistic checks and is never the only check (Next.js authentication guidance). These checks only shape the UI; the API decides access ([§14.4](14-architecture.md#144-architectural-principles)).
- Loading states use `<Suspense>` boundaries and `loading.tsx` with skeleton components of `@trybun/ui`.

### Changing data

- Every change is a mutation hook in `features/<feature>/mutations.ts` built on `useMutation`. It sends `If-Match` with the version from the query data, invalidates the affected query keys on success and uses the common error handling: the translated error code, and for `412` the standard conflict message ([§17.2](17-conventions.md)).
- Optimistic updates are used only where Rule 2 needs immediate feedback (drag and drop on the Kanban board, toggles such as watching) and are rolled back on error.
- Reversible actions show a toast with "Undo" that performs the inverse API call (Rule 2); changes are never delayed on the client to make undo possible.

### State

| State | Where |
|---|---|
| Server data | TanStack Query cache only; never copied into other state |
| Shareable view state (filters, sorting, view mode, tab) | URL search parameters, parsed with the feature's Zod schema. Free-text search never goes into the URL ([§8.5](08-team-views.md), [§17.2](17-conventions.md)) |
| Local UI state | `useState` / `useReducer` in the component |
| UI state shared by a subtree (e.g. the selection in the list) | React context inside the feature |

No global client state library is used.

### Forms

- React Hook Form with the Zod resolver and the request schema from `@trybun/contracts` – the same schema the API validates ([§14.4](14-architecture.md#144-architectural-principles)) – rendered with the `Form` components of `@trybun/ui`.
- A form submits through the feature's mutation hook. Field errors of a Problem Details response (`errors[].pointer`) are applied to the form fields by one helper; other errors show the translated message.
- Watched field values are read with `useWatch({ control, name })`; `watch()` of `useForm()` is not used, because the React Compiler cannot memoize it.

### Permissions, live updates, texts and errors

- **Permissions**: the web application never derives permissions from roles or visibility. Actions are shown, hidden or disabled only according to `allowedActions` ([§18.3](#183-server-application)); the account kind returned by the API decides only between the portal and the team views.
- **Live updates**: one real-time client (`lib/realtime`) holds the Socket.IO connection; feature hooks subscribe, and a received event only invalidates (or updates) the matching queries through the feature's query keys.
- **Commands and keyboard shortcuts**: every action that has a shortcut or appears in the command palette is registered once in the command registry (`lib/commands`) with its shortcut, its label key and the action code it requires; views, the command palette and shortcut hints read the registry ([§8.4](08-team-views.md)). Components never bind keys on their own.
- **Texts**: `next-intl` (`useTranslations`, `getTranslations`) with the keys of the feature's namespace ([§17.1](17-conventions.md)); no string literals in JSX.
- **Dates and numbers** are formatted only with the `next-intl` formatter in the user's locale and time zone ([§13.1](13-non-functional.md)); calculations use `date-fns` ([§14.2](14-architecture.md)); never `toLocaleString` or hand-made formats.
- **Errors**: a Problem Details response becomes one typed error whose code is shown through `errors.<code>` ([§17.2](17-conventions.md)); a `404` from the API in a Server Component calls `notFound()`; unexpected errors reach the route's `error.tsx`.

## 18.6 UI components

- shadcn/ui first, adapted before first use (Rule 6). The folder layout created by the shadcn CLI is kept, so the CLI and `shadcn diff` keep working.
- **Presentational**: data and callbacks come through props. No data fetching, no imports from applications, no routing; links are passed in through the `render` prop of Base UI.
- **Composition**: complex components are compound components following the shadcn/ui structure (`Dialog`, `DialogTrigger`, `DialogContent`), not configuration objects.
- **Variants** use class-variance-authority; every component accepts `className`, merged last with `cn`.
- **Props** follow the naming of Base UI: `value` / `defaultValue` / `onValueChange`, `open` / `defaultOpen` / `onOpenChange`; event props start with `on`. `ref` is a regular prop (React 19); no `forwardRef` in new components.
- **Texts**: content comes through props and children; texts owned by a component (e.g. the screen-reader label of a close button) come from the `ui` namespace of `@trybun/i18n` through `next-intl`.
- Every component has stories for all states and the three viewports (Rules 6 and 9).

## 18.7 Tests

- **Unit tests** (`*.spec.ts`) cover business rules and other pure functions, written as tables (`it.each`) with the cases of the specification.
- **Integration tests** (`*.integration.spec.ts`, run by `pnpm test:integration`) cover services and endpoints through the Nest application against PostgreSQL and Valkey in Testcontainers ([§2.14](02-agent-rules.md)). Each test creates its own data with factories. Integration tests count toward the coverage thresholds ([§2.14](02-agent-rules.md)).
- **Test doubles only at external boundaries**: MSW for external HTTP services, the fixed clock, adapters of services without a container. The project's own services, Prisma and the database are never mocked.
- **Factories**: one per model (`test/factories/<model>.factory.ts`) with `@faker-js/faker` defaults and overrides.
- **E2E tests** (Playwright) use one page object per view and locate elements by role, label or text (`getByRole`); `data-tour` attributes only for tours; never CSS classes.

## 18.8 Alternatives considered

| Alternative | Assessment |
|---|---|
| Repository classes over Prisma | Rejected – Prisma already is a typed data-access layer; a wrapper per model adds a layer without protecting any rule. Integration tests use the real database, so no abstraction for mocking is needed |
| Generic base classes and generic CRUD controllers | Rejected – they couple unrelated resources and hide the permission, activity and outbox steps every use case needs |
| Clean or hexagonal architecture for the whole server (ports for every dependency, use-case classes, mappers per layer) | Rejected – multiplies files in a framework that already has dependency injection; ports are used only for external services |
| `@nestjs/cqrs`, event sourcing | Rejected – the specification needs neither separate read models nor event-sourced state; the activity timeline is written in the transaction of the change |
| In-process events (`@nestjs/event-emitter`) for side effects | Rejected – events are lost when the process stops after the commit; the transactional outbox is used ([§17.2](17-conventions.md)) |
| Transaction propagation through AsyncLocalStorage (`@nestjs-cls/transactional`) | Not used – it removes the `tx` parameter, but adds a dependency and implicit behaviour; can replace explicit passing later through an ADR |
| Request-scoped providers for the principal | Rejected – NestJS documents their performance cost, and they do not exist in the Worker |
| `@nestjs/authorization` (NestJS 12) | Not used – version 0.1; the specification needs one definition for action checks and Prisma query filters, which CASL with `@casl/prisma` provides ([§14.4](14-architecture.md#144-architectural-principles)) |
| A state machine library (e.g. XState) for ticket statuses | Rejected – the workflow is not a hard-enforced state machine ([§4.3](04-ticket-lifecycle.md)); transition rules are pure functions |
| Sending CASL rules to the browser (`@casl/react`) | Rejected – permission logic would run in the frontend ([§14.4](14-architecture.md#144-architectural-principles)); the API sends `allowedActions` |
| Record content in real-time events | Rejected – it would bypass response serialization per audience; events are thin and clients reload through the API |
| Server Components only, without a client cache | Rejected – live updates, optimistic moves on the Kanban board and the command palette need a client cache |
| Global client state library (Redux, Zustand) | Rejected – server data is in TanStack Query, shareable view state in the URL |
| Manual memoization without the React Compiler | Rejected – every author decides differently where to memoize; the compiler memoizes components and hooks consistently, as the React team recommends for new code |
| React Compiler in annotation mode (`'use memo'`) | Rejected – meant for gradual adoption in existing code; in a new codebase it would split components into optimized and unoptimized ones |
| Server Actions | Rejected ([§14.5](14-architecture.md#145-alternatives-considered)) |
| Bulletproof React's ban on imports between features | Not adopted – its folder structure is used, but shared domain widgets (e.g. an assignee picker) are needed by several features; cycles are forbidden instead |
| Feature-Sliced Design | Rejected – more layers and naming rules than the application needs |
| Barrel files | Rejected – in Next.js they mix server-only and client modules and slow builds; packages use subpath exports |

## 18.9 Enforcement and changes

- **Lint** (`@trybun/eslint-config`, [§17.1](17-conventions.md)) enforces in CI: the layer and module boundaries of [§18.3](#183-server-application) and [§18.5](#185-web-application) (domain files import no NestJS or Prisma, transport files no Prisma, `platform` and `lib` no feature code, no cycles between modules or features), a `schema` on every parameter decorator of a route or gateway handler, no `asChild` and no imports of `radix-ui`, `@radix-ui/*` or `vaul` in project code, the `recommended` preset of `eslint-plugin-react-hooks` (including the React Compiler rules), no `process.env` outside the configuration, no `console`, no string literals in JSX, no default exports outside framework files.
- **Reference implementations**: the task listed below builds the first example of a pattern and replaces the planned path with the actual one in the same PR. Later code follows the reference in structure, naming, error handling and tests; when the reference turns out wrong, it is fixed under the rules for changing a pattern.

| Pattern | Reference implementation (planned) | Task |
|---|---|---|
| Server and web layout, lint boundaries | `apps/server/src/`, `apps/web/src/`, `packages/eslint-config/src/` | S0-01 |
| Integration test set-up: containers, MSW | `apps/server/test/setup/`, `apps/server/test/msw/` | S0-02 |
| Transaction with an outbox event and a Worker handler | `apps/server/src/platform/outbox/` | S0-04 |
| UI component with variants and stories | `packages/ui/src/components/button.tsx` | S0-07 |
| Server query, prefetch and hydration in the web | `apps/web/src/features/` (application shell) | S0-08 |
| Request pipeline, Problem Details, optimistic locking | `apps/server/src/platform/` | S0-17 |
| Feature module with endpoints, list, form and mutations | `modules/projects/`, `features/projects/` | S1-01 |
| Abilities, `accessibleBy` queries, `allowedActions`, permission tests | `modules/projects/projects.abilities.ts` | S1-04 |
| Real-time event and query invalidation | `modules/notifications/`, `lib/realtime/` | S1-15 |

- **Skills**: recurring tasks (a feature module, an endpoint, a background job, a UI component) get project skills in `.ai/skills/` that list the steps and link to the reference implementation instead of copying its code, so they cannot drift from it.
- **Review**: the self-review ([§2.14](02-agent-rules.md)) and the human review check every change against this chapter.
- **A problem without a pattern**: its first implementation proposes the pattern in this chapter in the same PR, marked as a specification change for approval (Rule 8).
- **Changing a pattern** requires an ADR approved by a human. The same PR updates this chapter, the reference implementation and the skills; existing code is migrated in that PR or in a task added to the implementation plan. Two patterns for the same problem never coexist without such a task.
