# AGENTS.md – Trybun

Instructions for AI coding agents in the **Trybun** repository. The project is built with an **AI Engineering** approach: agents implement, humans review and approve every change. This file is a short entry point – the details live in the specification; read only what your task needs.

## Start of every session

1. Read the project memory index [`.ai/memory/MEMORY.md`](.ai/memory/MEMORY.md); open topic files only when relevant.
2. Read the specification sections your task refers to (index: [`docs/spec/README.md`](docs/spec/README.md)) and the change specification in `.ai/specs/`, if the task has one.
3. Use the code identifiers from the [glossary](docs/spec/00-glossary.md).
4. Before writing code, look up its pattern in the [pattern catalogue](docs/spec/18-code-patterns.md) and follow the listed reference implementation.

## Where things are

| Path | Content |
|---|---|
| `docs/spec/` | System specification – the source of truth ([rules](docs/spec/02-agent-rules.md), [architecture](docs/spec/14-architecture.md), [conventions](docs/spec/17-conventions.md), [code patterns](docs/spec/18-code-patterns.md)) |
| `docs/plan/` | Implementation plan and task status – mark a task `[x]` in the PR that completes it |
| `docs/adr/` | Architecture Decision Records (MADR) |
| `docs/brand/` | Logo, colours, typeface – never draw your own |
| `docs/user/` | User documentation (EN, PL), shown in the help of the web application ([structure](docs/user/README.md)) |
| `.ai/specs/` | Change specifications (`YYYY-MM-DD-slug.md`, `implemented/`, `archive/`) |
| `.ai/memory/` | Project memory |
| `.ai/skills/` | Project skills |
| `.ai/agentic.config.json`, `.ai/trackers/`, `.ai/browsers/` | Agent pipeline configuration: validation gate, labels, QA gate, GitHub and browser operations ([`SDLC.md`](SDLC.md)) |
| `SDLC.md`, `CODE_REVIEW.md`, `BACKWARD_COMPATIBILITY.md` | Delivery process (labels, QA gate, claims), review rules, protected contract surfaces |
| `.ai/cezar/` | Managed by Cezar – do not edit its state files |

## Rules

Full text: [`docs/spec/02-agent-rules.md`](docs/spec/02-agent-rules.md). Rules 2–12 are subordinate to Rule 1; Rules 3, 4, 6 and 9 also to Rule 2.

1. **Conventions first** – follow established standards; record deliberate deviations in an ADR.
2. **Minimum user steps** – shortest path to the user's goal, never at the cost of predictability or accessibility.
3. **User documentation** – docs-as-code (Diátaxis, EN + PL), updated in the same PR.
4. **Product tours** – short, skippable, shown once, role-aware; targets `data-tour="view-element"`.
5. **README always current** – updated in the same PR; English for code, commits and technical docs.
6. **Reusable components** – start from shadcn/ui in `@trybun/ui`, adapt (tokens, 44 px targets, translations, a11y, Storybook); Tailwind theme tokens only.
7. **Project memory in the repo** – `.ai/memory/` only; tool memory outside the repo is disabled.
8. **Specification always current** – update `docs/spec/` in the same PR; changes of requirements go through a change specification approved by a human.
9. **Phones and tablets first** – every view from 360 px, touch targets ≥ 44 px, no hover-only actions.
10. **Dependencies secure and current** – latest stable after a 7-day cooldown (security fixes immediately); no new high/critical vulnerabilities.
11. **Versioning** – SemVer from Conventional Commits via release-please; never set versions or edit `CHANGELOG.md` by hand; mark breaking changes.
12. **One pattern per problem** – write code with the patterns of [§18](docs/spec/18-code-patterns.md) and its reference implementations; a missing pattern is proposed for approval, a changed one needs an ADR and migrates the existing code.

## Never

- Never expose tokens to the browser – the web app is a BFF ([§14.4](docs/spec/14-architecture.md)); never cache per-user API data across requests on the web server.
- Never put permission or visibility logic outside the server's CASL abilities – the web app only follows the API's `allowedActions`; invisible records return **404, never 403**.
- Never introduce a second way of solving a problem the [pattern catalogue](docs/spec/18-code-patterns.md) covers – e.g. no repository layer or generic base classes, no in-process event bus instead of the outbox, no global client state store.
- Never implement your own authentication, password, 2FA or crypto mechanisms – use Keycloak and proven libraries.
- Never disable, skip or weaken tests, thresholds or CI gates, and never add suppressions (`@ts-ignore`, lint-disable) to go green.
- Never mock the database in integration tests – use Testcontainers.
- Never add a second validation library (Zod only), a second DI container (NestJS only), a second styling approach (Tailwind only) or a second UI primitive library (Base UI only).
- Never run a Redis server (use Valkey; Redis-protocol client libraries and adapters are allowed); never use MinIO, WYSIWYG editors, external AI APIs for ticket content, or the SVAR Gantt PRO edition.
- Never put personal data, tokens or ticket content into logs.
- Never decide a gap or contradiction in the specification yourself – propose a change for approval.
- Never push to `main`; never access production secrets or data.

## Working practices

- **Small tasks**: one task = one focused PR referencing the spec sections (e.g. `§5.2`); stay in scope, other agents may work in parallel; rebase on `main` before the PR.
- **Plan first, re-plan when it goes wrong** – don't pile up patches.
- **Learn from corrections**: a specific pitfall → `.ai/memory/`; a general working rule → propose an `AGENTS.md` change.
- **Repeated work** → propose a skill in `.ai/skills/`.
- **Self-review before the PR**: knowing what you know now, is there a simpler, cleaner solution?
- Trunk-based, squash merge; Conventional Commits with the closed scope list ([§2.14](docs/spec/02-agent-rules.md)); branch names `KEY-123-short-description` (tickets) or `S0-01-short-description` (plan tasks); DCO `Signed-off-by` on every commit.
- New dependency: exists, maintained, widely used, no known vulnerabilities, MIT-compatible licence – and only if really needed; add a stable version with an explicit range, never by dist-tag (`latest` may be a release candidate).

## Definition of Done

Checklist (full text: [§2.13](docs/spec/02-agent-rules.md)):

- [ ] Conventions checked (Rule 1) and shortest user path verified (Rule 2)
- [ ] User docs, tours and README updated where affected (Rules 3–5)
- [ ] Components reusable, Storybook entry (Rule 6)
- [ ] Project memory updated (Rule 7)
- [ ] Specification updated; requirement changes approved (Rule 8)
- [ ] Works on phone, tablet and desktop (Rule 9)
- [ ] No new vulnerabilities; dependencies current (Rule 10)
- [ ] Conventional Commits; breaking changes marked (Rule 11)
- [ ] Code follows the pattern catalogue; new or changed patterns proposed for approval (Rule 12)
- [ ] Tests added and passing; all CI gates green
- [ ] Human review approved

## Commands

Run from the repository root; local environment: [§15.12](docs/spec/15-deployment.md). Keep in sync with README.md (Rule 5). Commands marked with a task arrive with it.

| Command | Purpose |
|---|---|
| `pnpm install` | Install dependencies from the lockfile |
| `pnpm dev` | Start the infrastructure in Docker Compose, apply the migrations and the demo dataset, then the web application, the API and the Worker with hot reload |
| `pnpm test` | Unit tests and the story tests of `@trybun/ui` (Vitest; Chromium: `pnpm --filter @trybun/ui exec playwright install chromium`) |
| `pnpm test:integration` | Integration tests (Vitest + Testcontainers; needs Docker) |
| `pnpm test:coverage` | Unit, component and integration tests with the coverage thresholds of CI (needs Docker) |
| `pnpm storybook` | Component catalogue of `@trybun/ui` on port 6006 |
| `pnpm e2e` | E2E tests (Playwright, phone/tablet/desktop, axe) and the Lighthouse budget against the local environment |
| `pnpm api:generate` | OpenAPI document of the API and the typed API client of `web` after a change of the endpoints |
| `pnpm help:generate` | Help content of `web` (pages and search indexes) after a change of the user documentation in `docs/user/` |
| `pnpm lint` | Lint, formatting, Keycloak login theme up to date with the catalogues, help content up to date with `docs/user/`, Prisma checks (schema mappings, no Prisma ORM 8) and supply-chain checks (fork-safe triggers, SHA and digest pinning) and ShellCheck of the shell scripts (`trybun`, backup service, restore test) |
| `pnpm lint:spec` | Specification consistency: `§N.M` references (links: lychee in CI) |
| `pnpm format` | Format all files with Prettier |
| `pnpm typecheck` | TypeScript strict type check |
| `pnpm build` | Build all applications and generate the Keycloak login theme from the message catalogues |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:seed` | Load the deterministic demo dataset |
