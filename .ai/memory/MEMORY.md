# Project memory – index

Knowledge gained while working on this project that is not in the specification (`docs/spec/`) or in ADRs. Rules: [`docs/spec/02-agent-rules.md`](../../docs/spec/02-agent-rules.md) §2.7 (Rule 7).

- Read this index at the start of every session.
- Read a topic file only when it is relevant to the current task.
- One line per topic file: `path` – what it contains – when to read it.
- Keep this index in sync with the folder contents.

## Topics

- `.ai/memory/bullmq.md` – BullMQ 6: forbidden job ID characters, ignored duplicate IDs, debounce deduplication for timers, retention and retries, Valkey compatibility – read when adding queues, jobs, timers or schedulers.
- `.ai/memory/docker.md` – Docker Compose, images and infrastructure services: `up --wait` and one-off services, shared server image, Keycloak readiness, keycloak-config-cli versions, the sjp.pl dictionary archive, SeaweedFS credentials, internal networks, PostgreSQL 18 volume path, Dependabot and image pinning – read when changing `compose*.yaml`, `docker/` or the infrastructure services.
- `.ai/memory/github.md` – GitHub identity of agents: the GitHub App `dtk7c2-claude` and the code owner, its token helper, `gh` wrapper and git credential helper on the VPS, shared `gh` login in Cezar, the disabled merge button of Cezar with rulesets, https remote, PR title as squash commit, never approving with the agent identity, undocumented ruleset option, required status checks set by the maintainer, safe pull request workflows, the app's access to secrets and tags, the retired machine account `dtk7c2-2`, the DCO check and its exemptions – read before pushing, opening or merging a PR, or changing GitHub settings, workflows or releases.
- `.ai/memory/i18n.md` – next-intl 4 without routing (Vitest resolves the client build, typed keys, `@parcel/watcher`), JSON import attributes of the catalogues, Keycloak's Java MessageFormat, locale order of the login screen and the generated theme – read when adding texts, languages or formatting, or changing the Keycloak theme.
- `.ai/memory/keycloak.md` – keycloak-config-cli (checksum cache, substitution in comments, several files per realm, ignored user IDs), Keycloak `amr`, 2FA for a group, OTP credentials, back-channel logout timeouts, Auth.js 4 adapter and token flow – read when changing `docker/keycloak/`, the sign-in, sessions or token validation.
- `.ai/memory/nestjs.md` – NestJS 12 validation, serialization and OpenAPI pitfalls; ecosystem support of NestJS 12 – read when writing endpoints, gateways, request or response schemas, or when adding a NestJS library.
- `.ai/memory/prisma.md` – Prisma ORM 7 pitfalls: `latest` is the Prisma 8 release candidate, driver adapters, `prisma.config.ts`, client extensions and `@casl/prisma`, TypedSQL status, transactions – read when installing or updating Prisma, or changing the schema, queries or transactions.
- `.ai/memory/react-compiler.md` – React Compiler: set-up in Next.js and Storybook, incompatible library APIs (React Hook Form `watch()`, TanStack Table 8), diagnosing with `'use no memo'` – read when a client component shows stale data or when adding a React library.
- `.ai/memory/toolchain.md` – pnpm 12 (`allowBuilds`, release-age cooldown, audit exceptions), TypeScript 7 not yet usable, Next.js env loading and instrumentation, NestJS rspack bundling of workspace packages, Vitest with SWC, Vitest coverage projects and thresholds, Testcontainers, MSW 3, lychee, ESLint flat-config overrides – read when adding dependencies, scripts, tests, build, lint or CI configuration.
- `.ai/memory/shadcn.md` – shadcn/ui on Base UI: CLI flags, flavours of Drawer, Command and Toast, `asChild` → `render`, the `cn` package, monorepo set-up – read when adding or adapting components in `@trybun/ui`.

<!-- Example:
- `.ai/memory/prisma.md` – Prisma pitfalls (raw SQL for full-text search, migration order) – read when changing the database schema or queries.
-->
