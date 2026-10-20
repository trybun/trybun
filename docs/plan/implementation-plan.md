# Trybun – implementation plan

This plan splits the implementation of the specification ([`docs/spec/`](../spec/README.md)) into stages. Each stage ends with a **working, deployable system** that is better than the previous one. The **MVP (Minimum Viable Product)** is delivered in the first stages (0 and 1); later stages extend the working system.

## How to use this plan

- Every task below is meant to be **one pull request** ([§2.13](../spec/02-agent-rules.md)). If a task turns out larger, split it before starting and update this plan in the same PR.
- Every task lists the specification sections it implements. Read them (and the glossary) before starting.
- Every task follows the **Definition of Done** ([§2.12](../spec/02-agent-rules.md)): conventions, minimum user steps, user docs, tours, README, reusable components, project memory, up-to-date specification, phone and tablet support, dependency security, versioning, tests, CI gates, human review.
- Tasks within a stage are listed in a sensible order; tasks marked with the same group number can be done in parallel.
- A stage is finished when all its tasks are merged and its **exit criteria** are met. Each finished stage is released ([§15.4](../spec/15-deployment.md)) and deployed to the test environment.
- Task status is tracked in this file: `[ ]` open, `[x]` done.

## Versioning of stages

| Stage | Release | Meaning |
|---|---|---|
| 0 | `0.1.0` | Foundation – deployable skeleton with login |
| 1 | `0.2.0` | **MVP** – real users report tickets, the team handles them |
| 2 | `0.3.0` | Team productivity and search |
| 3 | `0.4.0` | GitHub integration |
| 4 | `0.5.0` | Planning and SLA |
| 5 | `0.6.0` | Gantt chart |
| 6 | `0.7.0` | Public API, webhooks and import |
| 7 | `1.0.0` | Semantic search and production hardening |
| 8 | `1.1.0` | Voluntary project funding |

---

## Stage 0 – Foundation

**Goal:** a deployable skeleton that already follows every rule: monorepo, CI quality gates, Docker Compose, login through Keycloak, translations, component library, documentation and tour infrastructure. No business features yet.

**Exit criteria:**

- `git clone` + one command starts the full local environment.
- A release package installs on a clean Linux VPS with the install script; the first-run wizard creates the Administrator; HTTPS works.
- A user can log in (Keycloak), switch language EN/PL and see an empty, translated application shell.
- All CI gates run on every pull request.

| # | Group | Task | Spec |
|---|---|---|---|
| [ ] S0-01 | 1 | Monorepo scaffold: pnpm workspaces, Turborepo, apps `web` (Next.js), `api` and `worker` (NestJS), packages `shared` (Zod schemas, types), `ui`, all under the `@trybun/` npm scope; TypeScript `strict`; lint and formatting; `README.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `docs/ai/memory/` | §1.4, §2.5, §2.7, §14.2 |
| [ ] S0-02 | 2 | CI pipeline in GitHub Actions: format, lint, type check, unit tests with coverage threshold, build, dependency review and vulnerability audit blocking new high/critical issues, `--frozen-lockfile`, secret scanning, SAST, specification consistency check (links and `§` references); branch protection on `main`; Conventional Commits check | §2.8, §2.13 |
| [ ] S0-03 | 2 | Docker Compose for development and production: PostgreSQL (pgvector, Polish dictionary), Redis, MinIO (profile), Keycloak, Caddy, ClamAV; named volumes, log rotation, memory limits, health checks, internal network | §14.1, §14.4, §15.3, §15.9 |
| [ ] S0-04 | 2 | Prisma setup: base schema, migration workflow, migrations as a one-off Compose service; seed data for tests | §14.4, §15.7 |
| [ ] S0-05 | 3 | Keycloak configuration as code: realm, clients, login with GitHub (team) and e-mail/password + Microsoft/Google (end users), mandatory 2FA for team, translated login screens; API token validation in NestJS | §7.4, §15.5 |
| [ ] S0-06 | 3 | Internationalization infrastructure: EN/PL resources in web, API messages and e-mail templates; language detection and user setting; locale-aware dates/numbers and time zones | §13.1 |
| [ ] S0-07 | 3 | Component library `packages/ui` (`@trybun/ui`): Tailwind CSS 4 theme with design tokens based on the brand colours and typeface from `docs/brand/` (light and dark), class-variance-authority and tailwind-merge, lint rule against arbitrary values, Prettier class sorting; Radix UI primitives, Storybook with accessibility addon, light/dark themes; first components (button, input, select, dialog/bottom sheet, menu, badge, toast), each shown in phone, tablet and desktop viewports in Storybook | §1.4, §2.6, §14.2, §13.4 |
| [ ] S0-08 | 4 | Application shell, mobile-first: responsive layout (phone, tablet, desktop), navigation, header with search button, user menu, language switch, help icon slot, notification bell slot; web app manifest with brand icons; E2E test setup (Playwright + axe) with phone, tablet and desktop device profiles; Lighthouse mobile budget in CI | §2.2, §2.9, §13.4 |
| [ ] S0-09 | 4 | Documentation infrastructure: docs-as-code structure (Diátaxis, EN/PL, per audience), in-app help viewer with contextual links and search | §2.3 |
| [ ] S0-10 | 4 | Product tour infrastructure: tour definitions, `data-tour` targets, show-once tracking per user, restart from help menu, E2E check that targets exist; tour "First login" | §2.4 |
| [ ] S0-11 | 5 | Release pipeline: release-please (release PR, SemVer from Conventional Commits, `CHANGELOG.md`, support for `release/X.Y.x` maintenance branches and `-rc` pre-releases), SemVer tags, image vulnerability scan blocking critical issues, SBOM (CycloneDX or SPDX) attached to releases, images to `ghcr.io/trybun/<service>`, `CHANGELOG.md` from Conventional Commits, GitHub Release with deployment package; image tags `X.Y.Z`, `X.Y`, `X`; version in `/health` and on the "About" page | §2.11, §15.4 |
| [ ] S0-12 | 5 | Install script and first-run wizard: prerequisite checks, generated secrets, `.env`, one-time setup token, first Administrator with 2FA | §15.5, §15.6 |
| [ ] S0-13 | 5 | Update and restore scripts with automatic pre-update backup; backup service to external S3 (encrypted, retention); restore test procedure | §13.6, §15.7, §15.10 |
| [ ] S0-14 | 6 | Security baseline: HTTPS only, CSRF protection, session expiry, rate limiting, security headers; administrative audit log (infrastructure and first entries) | §13.5 |
| [ ] S0-15 | 1 | Open source setup: `LICENSE` (MIT), SPDX identifiers, `CONTRIBUTING.md` (incl. DCO and AI contribution policy), `CODE_OF_CONDUCT.md` (Contributor Covenant), `SECURITY.md`, issue forms, PR template, `CODEOWNERS`, labels, GitHub Discussions | §16.1–§16.4 |
| [ ] S0-16 | 2 | Repository security and contribution checks: DCO check and dependency license check in CI, no secrets for fork PR workflows, Dependabot (alerts, security updates, grouped weekly version updates with 7-day cooldown, GitHub Actions pinned to SHA and base images pinned to digest), pnpm `onlyBuiltDependencies`, private vulnerability reporting, mandatory 2FA in the GitHub organization | §2.10, §16.1, §16.3, §16.5 |

---

## Stage 1 – MVP

**Goal:** the system is usable in production. End users report tickets in a project; the team handles them through the list and the Kanban board, communicates with public comments and internal notes, and everyone is notified. Organizations and visibility protect customer data from the start.

**Exit criteria:**

- An Administrator creates a project and an organization, a Project manager invites team members and end users.
- An end user creates a ticket (with attachments and visibility), sees its public status and replies in comments.
- The team handles the ticket through statuses on the list and the Kanban board, with internal notes and assignment.
- Watchers receive in-app and e-mail notifications.
- GDPR baseline works: data export, deletion request, anonymization.
- User documentation and tours exist for all MVP views.

| # | Group | Task | Spec |
|---|---|---|---|
| [ ] S1-01 | 1 | Projects: model, key, CRUD for Administrator, project membership with per-project team roles | §3.1, §7.1, §7.2 |
| [ ] S1-02 | 1 | Organizations: model, e-mail domains, project access, membership; hiding organization UI when none exist | §7.3 |
| [ ] S1-03 | 2 | Invitations and accounts: invite by e-mail (Keycloak), domain-based organization assignment, deactivation, user settings (language, time zone) | §7.4 |
| [ ] S1-04 | 2 | Permission layer in the API: roles, hierarchy, policy checks for every endpoint, visibility filtering in queries; permission matrix as executable tests | §7.5, §14.4 |
| [ ] S1-05 | 3 | Ticket model: fields, per-project sequential identifiers, source, type, priority, requester, assignee; activity events for every field change | §3.2, §4.5 |
| [ ] S1-06 | 3 | Statuses: internal and public statuses, mapping, transition rules (initial statuses, reason for `rejected`, link for `duplicate`, return from `waiting_for_requester`, reopen) | §4.1–§4.4 |
| [ ] S1-07 | 4 | GFM editor component: toolbar, write/preview, task lists, code highlighting, tables, shortcuts; OWASP-compliant HTML sanitization | §6.2 |
| [ ] S1-08 | 4 | Attachments: upload to S3 storage, allowlist, size limit, ClamAV scanning in the Worker with "Checking…" state, EXIF stripping, access checks, download disposition | §13.3 |
| [ ] S1-09 | 5 | End-user portal: project home, simplified ticket form with visibility switch and template placeholder, "my tickets", ticket view with public status and public timeline | §3.3, §3.4, §5.1, §5.4 |
| [ ] S1-10 | 5 | Team ticket view and full form: all fields, type-dependent templates, assignment rules, internal statuses, full activity timeline with "hide events" toggle | §3.3, §3.4, §4.5 |
| [ ] S1-11 | 5 | Visibility: `only_me`, `my_organization`, `all_customers` with team approval, shared tickets, widening/narrowing rules, warning text | §5.1–§5.4 |
| [ ] S1-12 | 6 | Comments and internal notes: kinds, default internal for team, visual distinction, `@mentions` with scope rules | §6.1 |
| [ ] S1-13 | 6 | Team list view: filters, sorting, predefined saved views, bulk actions | §8.1 |
| [ ] S1-14 | 6 | Kanban board: status columns, `waiting_for_requester` column, recent `done` only, card menu for `rejected`/`duplicate`, drag with keyboard alternative, optional WIP limits | §8.2, §13.4 |
| [ ] S1-15 | 7 | Watching and notifications: automatic/manual watchers, in-app notification center, outgoing e-mails in recipient's language, batching window, no self-notifications, never internal events to end users | §6.4, §6.5, §6.7 |
| [ ] S1-16 | 7 | GDPR baseline: self-service data export (JSON), deletion request, anonymization by Administrator, retention setting with automatic anonymization job, audit log entries | §13.2, §13.5 |
| [ ] S1-17 | 8 | Ticket templates management for the Administrator (EN/PL versions) | §3.4 |
| [ ] S1-18 | 8 | Tours and user documentation for MVP views: creating a ticket, Kanban board; reference pages for statuses, visibility and permissions | §2.3, §2.4 |

---

## Stage 2 – Team productivity and search

**Goal:** the team works faster and end users find existing tickets before creating duplicates.

**Exit criteria:** triage queue in daily use; similar tickets are suggested while typing; command palette and global search work; tickets can be structured with sub-tickets, relations and labels; users can reply by e-mail.

| # | Group | Task | Spec |
|---|---|---|---|
| [ ] S2-01 | 1 | Full-text search service (PostgreSQL, Polish dictionary) respecting visibility | §5.6, §14.4 |
| [ ] S2-02 | 2 | Similar ticket detection while typing the title; "I have the same problem" with requester count and watcher | §5.6 |
| [ ] S2-03 | 2 | End-user portal search with "Create ticket" fallback and Ctrl+K focus | §5.5 |
| [ ] S2-04 | 2 | Global search for the team opening the List view with the query | §8.5 |
| [ ] S2-05 | 3 | Command palette: search by key and text, navigation, permission-aware actions, shortcut hints, recent items, ARIA combobox; tour | §8.4, §2.4 |
| [ ] S2-06 | 3 | Triage queue: `new`/`triage` tickets one by one, inline field completion, quick actions, shortcuts, pending sharing approvals; tour | §8.3, §2.4 |
| [ ] S2-07 | 4 | Sub-tickets: nesting, cycle prevention, inline creation, progress, notification when all are completed | §3.5 |
| [ ] S2-08 | 4 | Relations: blocks/blocked by, relates to, duplicate of; bidirectional display, "blocked" markers, cycle prevention | §3.5 |
| [ ] S2-09 | 4 | Labels: per-project labels, inline creation, management by Project manager, reserved prefixes, filters | §3.5, §8.1 |
| [ ] S2-10 | 5 | User-defined saved views | §8.1 |
| [ ] S2-11 | 5 | Notification settings per event and channel for team members, with defaults | §6.6 |
| [ ] S2-12 | 5 | Incoming e-mail replies through the e-mail provider webhook, matching ticket and sender, rejection of unknown senders | §6.3 |

---

## Stage 3 – GitHub integration

**Goal:** code and tickets are connected; developers create issues from tickets and statuses follow the work in GitHub.

**Exit criteria:** a GitHub App is installed and linked to a project; branches and PRs with the ticket key move the ticket automatically; issues are created from tickets via preview; one-way and two-way sync work per project; no internal or personal data reaches GitHub.

| # | Group | Task | Spec |
|---|---|---|---|
| [ ] S3-01 | 1 | GitHub App registration and installation flow; repository linking with default repository; configuration in the Administrator panel | §11.1, §11.2 |
| [ ] S3-02 | 2 | Incoming webhook endpoint: signature verification, idempotency, queueing, loop protection | §11.1 |
| [ ] S3-03 | 3 | Linking branches, commits and PRs by ticket key; "Copy branch name"; automatic status changes; display in the ticket | §11.3 |
| [ ] S3-04 | 3 | "Create issue" with editable preview and field mapping (labels, milestone, assignee, sub-issues); links both ways | §11.4 |
| [ ] S3-05 | 4 | Issue synchronization: one-way and two-way per project, status mapping, comment sync limited to team comments | §11.5, §11.6 |

---

## Stage 4 – Planning and SLA

**Goal:** the Project manager plans work with milestones and a roadmap; customer agreements are tracked with SLA.

**Exit criteria:** milestones with automatic progress and state; internal and public roadmap; SLA policies with business calendars assigned to organizations and projects; deadlines, warnings and reports visible to the team.

| # | Group | Task | Spec |
|---|---|---|---|
| [ ] S4-01 | 1 | Milestones: model, automatic progress and state, assignment from ticket, list and roadmap; GitHub milestone mapping | §10.1, §11.4 |
| [ ] S4-02 | 2 | Internal roadmap view with progress, expansion and at-risk highlighting; tour | §10.2, §2.4 |
| [ ] S4-03 | 2 | Public roadmap and "Planned: <period>" in the end-user ticket view | §10.3 |
| [ ] S4-04 | 3 | Business calendars and SLA policies (Administrator), assignment to organizations and project default | §9.1–§9.3 |
| [ ] S4-05 | 4 | SLA engine in the Worker: time counting in working hours, pause, priority change, reopen; at-risk and breached events | §9.4, §9.5 |
| [ ] S4-06 | 5 | SLA presentation: ticket countdown, list column and "SLA at risk" view, Kanban badge, triage ordering; notifications | §9.5, §6.6 |
| [ ] S4-07 | 5 | SLA reports for Project manager and Administrator | §9.6 |

---

## Stage 5 – Gantt chart

**Goal:** the Project manager schedules work over time with dependencies.

**Exit criteria:** tickets have start and due dates; the Gantt chart shows bars, milestones, dependencies (= "blocks" relations), summary bars for parents, the "Show unscheduled" panel and warnings; every drag action has a keyboard alternative.

| # | Group | Task | Spec |
|---|---|---|---|
| [ ] S5-01 | 1 | Ticket start/due dates and dependency scheduling logic (finish-to-start, automatic shifting, cycle prevention) | §3.2, §10.4 |
| [ ] S5-02 | 2 | Gantt chart view: bars, milestones, today line, zoom levels, parent summary bars, collapse/expand | §10.4 |
| [ ] S5-03 | 3 | Editing on the chart: drag to move/resize, drag connectors for dependencies, keyboard/menu alternatives | §10.4, §13.4 |
| [ ] S5-04 | 3 | "Show unscheduled" panel with drag-to-schedule, remembered per user; warnings; tour | §10.4, §2.4 |

---

## Stage 6 – Public API, webhooks and import

**Goal:** other systems integrate with the ticket system, and existing data can be migrated in.

**Exit criteria:** documented, versioned public API with tokens; applications report errors with fingerprint grouping; outgoing webhooks deliver signed events reliably; GitHub issues and CSV files can be imported and undone.

| # | Group | Task | Spec |
|---|---|---|---|
| [ ] S6-01 | 1 | Public API conventions: `/api/v1`, OpenAPI publication, cursor pagination, Problem Details, rate-limit headers, `Idempotency-Key` | §12.1 |
| [ ] S6-02 | 2 | Personal access tokens and integration tokens: scopes, expiry, show-once, hashing, revocation, last-used tracking | §12.2, §13.5 |
| [ ] S6-03 | 3 | Integration tickets: source `integration`, fingerprint grouping, occurrence count, regression reopen | §12.3 |
| [ ] S6-04 | 3 | Outgoing webhooks: configuration, HMAC signatures, retries with backoff, delivery log with redelivery, automatic disabling | §12.4 |
| [ ] S6-05 | 4 | Import wizard (CSV): column and value mapping, preview with validation, background import, report | §12.5 |
| [ ] S6-06 | 5 | Import from GitHub issues; safe re-runs by external ID; undo of an import batch | §12.5 |

---

## Stage 7 – Semantic search and production hardening

**Goal:** the target version of search, and readiness for `1.0.0`.

**Exit criteria:** semantic similar-ticket detection in use; accessibility and security audits passed; documentation complete for all audiences; restore from backup verified on a clean server.

| # | Group | Task | Spec |
|---|---|---|---|
| [ ] S7-01 | 1 | Semantic search with pgvector: embeddings, indexing job in the Worker, hybrid ranking with full-text; used by similar detection, portal and global search | §5.6 |
| [ ] S7-02 | 2 | Accessibility audit against WCAG 2.1 AA (and 2.5.7) of all views; fixes | §13.4 |
| [ ] S7-03 | 2 | Security review against OWASP ASVS; fixes; audit log completeness check | §13.5 |
| [ ] S7-04 | 3 | Documentation completeness review (Diátaxis, EN/PL, all audiences) and tour review | §2.3, §2.4 |
| [ ] S7-05 | 3 | Disaster recovery exercise: install on a clean VPS and restore from backup following `INSTALL.md` only | §13.6, §15.5, §15.7 |

---

## Stage 8 – Voluntary project funding

**Goal:** people and companies who benefit from the project can voluntarily support the author, without any impact on the license or on users' work.

**Exit criteria:** the "Sponsor" button appears on the repository page and leads to an active GitHub Sponsors profile; README, documentation and the "About" page mention support unobtrusively; no prompts for support appear anywhere else.

| # | Group | Task | Spec |
|---|---|---|---|
| [ ] S8-01 | 1 | **Human task:** set up the GitHub Sponsors profile for the author's account (onboarding, payout and tax information, tiers). Agents cannot do this | §16.6 |
| [ ] S8-02 | 2 | `.github/FUNDING.yml` with the GitHub Sponsors account; `funding` field in all `package.json` files | §16.6 |
| [ ] S8-03 | 2 | "Support the project" section in README (before "License") with link/badge and optional sponsors list; "Support the project" page in the documentation (EN/PL) | §16.6, §2.3, §2.5 |
| [ ] S8-04 | 3 | "Support the project" link on the "About" page of the Administrator panel; E2E test that no support prompts appear for end users | §16.6, §15.4 |

