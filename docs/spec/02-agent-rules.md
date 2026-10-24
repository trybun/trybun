# 02 – Rules for AI agents

The rules below take precedence over all other implementation guidelines in this specification.

## 2.1 Rule 1 – Conventions and best practices first

Everything newly implemented in the project (code, data structures, API, UI, configuration, naming) must **first** be checked against the conventions and best practices commonly used by developers worldwide.

Before implementing, the agent:

1. Checks whether a recognized standard or pattern exists for the problem (e.g. language/framework naming conventions, REST/HTTP, SOLID, OWASP, Semantic Versioning, Conventional Commits).
2. Chooses the solution that follows the standard instead of inventing its own.
3. If it deliberately departs from a convention, documents the reason in an ADR ([§2.14](#214-agent-workflow)).

## 2.2 Rule 2 – Minimum number of user steps (UX/UI)

The UI is designed so that the number of steps a user needs to reach a goal is **reduced to the necessary minimum**.

Rule 2 is **directly subordinate to Rule 1**: every UX/UI solution is also verified against conventions and best practices (e.g. Nielsen's usability heuristics, WCAG, patterns users know from popular tools). Shortening a path must never sacrifice predictability or accessibility.

Examples:

- sensible defaults instead of required fields,
- contextual actions (no navigating to separate screens),
- keyboard shortcuts for frequent operations,
- no confirmation dialogs for reversible actions (offer "Undo" instead).

## 2.3 Rule 3 – User documentation from day one

Every feature is delivered **together with user documentation**. Documentation exists from the first version of the system and is updated in the same change that alters the documented behavior.

Rule 3 is **subordinate to Rules 1 and 2**.

Per Rule 1:

- Documentation follows **docs-as-code**: Markdown files in the repository, versioned with the code and reviewed in the same pull requests.
- Its structure follows the **Diátaxis** model: tutorials (getting started), how-to guides ("how do I do X"), reference (fields, statuses, permissions) and explanations (how e.g. visibility or SLA works).
- Documentation is bilingual (EN and PL, [§13.1](13-non-functional.md)) and organized by audience: end user, team, Administrator.

Per Rule 2:

- Help is **contextual**: the help icon in a view opens the relevant documentation page.
- How-to guides describe the shortest path to the goal, step by step.
- Documentation is accessible from within the application and searchable.

## 2.4 Rule 4 – Interactive in-app help

For relevant views the agent creates **interactive product tours** that guide the user step by step: they highlight the element to click or fill in and show a short description next to it.

Rule 4 is **subordinate to Rules 1 and 2**.

Per Rule 1 (practices of onboarding tools and tour libraries):

- A tour is **short**: at most a few steps (about 5). Longer processes are split into separate tours.
- A tour can be **skipped or closed** at any moment and **restarted** from the help menu.
- A tour starts automatically **only once**: on a person's first visit to a given view. Completion or skipping is remembered **per user on the server** (product tour progress: user, tour, status `completed`/`skipped`, tour version), so it works the same on every device. Increasing a tour's version shows it again only when its steps change materially.
- Tours are role-aware: end users never see steps about team-only features.
- Elements targeted by tours are marked with stable attributes (e.g. `data-tour="…"`), never CSS classes, so visual changes do not break tours. E2E tests verify that all targets exist.
- Tours are translated ([§13.1](13-non-functional.md)) and accessible ([§13.4](13-non-functional.md)): keyboard support, correct focus management, screen-reader labels, respect for reduced-motion settings.

Per Rule 2:

- Tours work on phones and tablets (Rule 9).
- A tour **complements** a well-designed UI; it never replaces it. If a view needs a long tour, that signals a UI design problem to be fixed first.
- A tour never blocks work and never reappears unless the user asks for it.

Tours exist at least for: first login, creating a ticket, the triage queue, the Kanban board, the roadmap, the Gantt chart and the command palette.

## 2.5 Rule 5 – Up-to-date README.md from day one

The repository has a `README.md` from the first commit. The README is updated **in the same change** that alters anything it describes (e.g. how to run the project, prerequisites, environment variables, project structure).

Per common convention, the README, code comments, identifiers, commit messages, pull request descriptions and technical documentation (including this specification) are written **in English**. User documentation (Rule 3) and the UI remain bilingual ([§13.1](13-non-functional.md)).

Per Rule 1 the README contains at least:

- a short description of the project and its purpose,
- prerequisites (tools and versions),
- running the local environment (one command, [§14.4](14-architecture.md)),
- the monorepo structure and the role of each package,
- available scripts (build, test, lint, migrations),
- configuration: list of environment variables with a reference to `.env.example`,
- deployment to a VPS with Docker Compose ([15-deployment.md](15-deployment.md)),
- links to user documentation (Rule 3) and API documentation ([§12.1](12-api-webhooks-import.md)),
- links to `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` and `SECURITY.md` ([§16.2](16-open-source.md)),
- a "Support the project" section ([§16.6](16-open-source.md)) and the "License" section ([§16.1](16-open-source.md)).

## 2.6 Rule 6 – New components are always reusable

Every new component – UI components, but also backend modules, services and validation schemas – is designed to be **reusable**.

Rule 6 is **subordinate to Rules 1 and 2**.

Per Rule 1:

- **Check what already exists first.** Before creating a component, the agent checks the project's component library. If a similar component exists, it extends it or composes from it instead of creating a copy.
- UI components form the **project component library** (a separate internal monorepo package `packages/ui`, named `@trybun/ui`), built on Base UI primitives (the default of shadcn/ui), not from scratch. **shadcn/ui** is the starting point ([§14.2](14-architecture.md)): if shadcn/ui offers a suitable component, it is added to `packages/ui` with the shadcn CLI and then adapted; a component is built from scratch only when shadcn/ui has nothing suitable.
- A component copied from shadcn/ui becomes **project code** and is adapted before first use:
  - styling uses only the project's design tokens,
  - touch targets meet Rule 9 (at least 44 × 44 px on touch devices),
  - all texts come from translation resources ([§13.1](13-non-functional.md)),
  - accessibility is verified (keyboard, focus, labels, [§13.4](13-non-functional.md)),
  - it gets a component catalog entry with all states.
- Every UI component has a **component catalog entry** (Storybook) with usage examples and all states (e.g. empty, loading, error, disabled).
- UI components are **presentational**: no domain logic and no API calls. They receive data and actions through props. Domain logic lives in the application layer and the API ([§14.4](14-architecture.md)).
- Styling uses **Tailwind CSS** ([§14.2](14-architecture.md)) and is based on **design tokens** (colors, spacing, typography, radii, shadows) defined once in the Tailwind theme (`@theme`, CSS variables). Brand colours and the typeface come from [`docs/brand/`](../brand/README.md). Rules:
  - only theme tokens are used – no arbitrary values such as `bg-[#E0482C]` or `p-[13px]` (enforced by lint),
  - long class lists live inside `@trybun/ui` components, never copied across views; component variants use class-variance-authority, classes are combined with `cn` (the shadcn/ui package),
  - class order is sorted automatically (official Prettier plugin for Tailwind CSS),
  - dark mode is implemented through the tokens, not with separate classes in every component,
  - no inline `style` attributes and no other styling approach (CSS-in-JS, separate CSS files per component) is mixed in.
- Components contain no hard-coded texts. All texts come from translation resources ([§13.1](13-non-functional.md)).
- Accessibility ([§13.4](13-non-functional.md)) is built into the component, not added at the call site.
- On the backend, reusability means shared monorepo packages (e.g. validation schemas, types, status mapping) and NestJS modules with clearly defined interfaces.
- **Reusable does not mean over-generic.** A component supports known use cases with a simple, deliberate interface. No speculative options (YAGNI).

Per Rule 2:

- The same elements (person picker, label picker, visibility switch, status badge, GFM editor) look and behave **identically across the system**. Users learn them once and recognize them everywhere (Nielsen's "consistency and standards").
- An improvement made in a component (e.g. a new keyboard shortcut) immediately works everywhere the component is used.

## 2.7 Rule 7 – Project memory lives in the repository

Knowledge that agents gain while working on the project is stored **only in the repository**, in the project memory, so that every session, every person and every tool starts with it.

Rule 7 is **subordinate to Rule 1**.

### What goes where

| Document | Purpose |
|---|---|
| System specification (`docs/spec/`) | **What** the system must do. The source of truth |
| Change specifications (`.ai/specs/`) | **What changes and why** in one unit of work ([§2.8](#28-rule-8--the-specification-is-kept-up-to-date)) |
| ADRs | Significant technical **decisions** and their rationale ([§2.14](#214-agent-workflow)) |
| Project memory (`.ai/memory/`) | Knowledge gained during work that is in neither of the above: pitfalls, non-obvious behavior of libraries and tools, proven ways of solving recurring problems, agreements from discussions |

- Project memory **never overrides the specification**. If an agent finds a contradiction between memory and the specification, it handles it according to Rule 8 instead of "fixing" the specification through memory.
- Memory does not duplicate the specification or ADRs; it links to them instead.

### Structure and loading

- `.ai/memory/MEMORY.md` is the **index**: one line per topic file, saying what the file contains and when to read it.
- Topic files (`.ai/memory/<topic>.md`) contain the knowledge itself.
- `AGENTS.md` links to the index, and the agent **reads the index at the start of every session**. Topic files are read **on demand**, only when relevant to the current task. Paths in the index are written in backticks, so tools do not import all files at start-up.

### Tool memory is disabled

- Built-in, tool-specific memory stored outside the repository (e.g. Claude Code auto memory in the user's profile directory) is **disabled for this project**. Agents neither write to it nor rely on it.
- Claude Code: the committed `.claude/settings.json` sets `"autoMemoryEnabled": false`. Where that is not honored (e.g. CI or another environment), set the environment variable `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, which overrides all settings. Other tools with built-in memory are configured equivalently.
- The memory is plain Markdown, so it works the same for every tool (Claude Code, Codex and others).

### Writing to memory

- New knowledge is written in the **same pull request** in which it was gained, so it goes through human review like code.
- Memory is written in English (Rule 5).
- Hygiene:
  - no secrets and no personal data,
  - short, concrete entries,
  - outdated entries are updated or removed – never contradicted by a new entry next to them,
  - no duplicates; extend an existing topic file before creating a new one,
  - the index always matches the folder contents,
  - when a topic file grows too large, it is split by topic and the index is updated.

## 2.8 Rule 8 – The specification is kept up to date

The system specification (`docs/spec/`) always describes the system **as it actually is and is meant to be**. Like the README (Rule 5) and user documentation (Rule 3), it is updated **in the same pull request** as the change that affects it, never "later".

Rule 8 is **subordinate to Rule 1** (specification-as-code, versioned and reviewed like code).

### What kind of change, and how

| Situation | What the agent does |
|---|---|
| The implementation follows the specification exactly | No specification change |
| The implementation **makes the specification more precise** without changing meaning (e.g. a concrete error code, an API path, a limit value, a field's exact validation) | Updates the specification in the same PR |
| The implementation reveals a **gap or contradiction**, or a change of **requirements or behavior** is needed | Does **not** decide on its own. Proposes the specification change in the PR, marked as a **specification change for approval**, with the reason; the human reviewer approves or rejects it explicitly |
| A human decides to change a requirement | The specification is changed first (or in the same PR), then the implementation |

- Specification changes are clearly visible in review: a separate commit `docs(spec): …` and a filled-in "Specification changes" section in the PR description.
- A change that alters behavior is never introduced silently through the code alone, and never through project memory (Rule 7).

### Change specifications

New functionality and changes of behavior or requirements start with a **change specification** in `.ai/specs/` (pattern used by Cezar and the Open Mercato skills). Details: [`.ai/specs/README.md`](../../.ai/specs/README.md).

- Name: `YYYY-MM-DD-slug.md`, created from `.ai/specs/TEMPLATE.md`.
- The change specification is proposed in its own pull request. Merging it is the human approval of the change; **implementation never starts while open questions remain unanswered**.
- The implementation pull request updates the system specification (`docs/spec/`), marks the change specification as `implemented` and moves it to `.ai/specs/implemented/`. Abandoned or superseded specifications go to `.ai/specs/archive/` with the reason.
- Required for tasks of the implementation plan that deliver functionality; optional for infrastructure tasks; not used for bug fixes, dependency updates and documentation-only changes.
- The change specification never replaces the system specification: after implementation, `docs/spec/` alone must describe the system completely.

### Consistency

With every specification change the agent keeps the specification consistent:

- the glossary ([00-glossary.md](00-glossary.md)) – new or changed terms with code identifiers and UI labels,
- the index ([README.md](README.md)) – if a file is added or its scope changes,
- cross-references (`§N.M`) and links – after renumbering or moving sections,
- the permission matrix ([§7.5](07-users-organizations-permissions.md)) – if an action is added or its permissions change,
- the implementation plan ([`docs/plan/`](../plan/implementation-plan.md)) – if tasks, scope or task status change,
- user-facing texts in both languages (EN and PL).

CI includes an automated **specification consistency check**: every link and `§N.M` reference must point to an existing file and section ([§2.14](#214-agent-workflow)).

### Scope of the specification

The specification describes **what** the system does and the rules it follows. It does not describe **how** the code implements it: implementation details belong in the code and its comments, decisions in ADRs, and knowledge gained during work in project memory (Rule 7). The code patterns ([18-code-patterns.md](18-code-patterns.md)) are rules the code follows: they name the pattern used for each recurring problem, while code examples live in the reference implementations and project skills (Rule 12).

## 2.9 Rule 9 – Designed for phones and tablets from the start

The whole user interface – every page, view, dialog, menu, form, notification and product tour – is designed from the start to work on **phones and tablets** as well as on desktop. Mobile support is never added "later" and no view is desktop-only.

Rule 9 is **directly subordinate to Rule 2** (and through it to Rule 1): on small touch screens the minimum number of steps matters even more, and mobile patterns follow established conventions instead of invented ones.

### Approach (Rule 1)

- **Mobile-first, responsive design**: layouts are designed for the narrowest screen first and extended for wider screens with CSS breakpoints. One application for all devices, no separate mobile version.
- Supported widths start at **360 px**. Reference breakpoints: phone < 768 px, tablet 768–1279 px, desktop ≥ 1280 px. Both portrait and landscape orientation are supported.
- Supported browsers: current versions of Chrome, Safari (including iOS/iPadOS), Firefox and Edge.
- **Touch targets** are at least 44 × 44 px (Apple HIG; Material Design recommends 48 dp), with enough spacing between them – more than the WCAG 2.2 minimum ([§13.4](13-non-functional.md)).
- **No hover-only interactions**: everything available on hover is also available by tap.
- Forms use the correct input types (`email`, `tel`, `number`, `date`) so phones show the right keyboard, and form fields use at least 16 px text so iOS does not zoom in on focus.
- The layout respects device safe areas (notches, home indicators).
- A **web app manifest** with the brand icons ([`docs/brand/`](../brand/README.md)) lets users add Trybun to the home screen. Offline operation is not required.

### Patterns per element

| Element | Phone | Tablet |
|---|---|---|
| Navigation | Bottom navigation or compact menu; header with search button | Collapsible side navigation |
| Dialogs and pop-ups | Full-screen sheets or bottom sheets | Centered dialogs |
| Tables and lists ([§8.1](08-team-views.md)) | Cards with the key fields; full details on tap | Table with fewer columns or horizontal scroll inside the table |
| Kanban board ([§8.2](08-team-views.md)) | One column at a time, swipe or column picker to switch; status change also from the card menu | Several columns with horizontal scroll; drag and drop by touch |
| Triage queue ([§8.3](08-team-views.md)) | One ticket per screen, quick actions as large buttons | As on desktop |
| Gantt chart ([§10.4](10-roadmap-gantt.md)) | Read-only timeline, scrollable; scheduling through ticket fields instead of dragging | Full chart with touch editing |
| Command palette ([§8.4](08-team-views.md)) | Opened from the search button in the header | Opened from the search button or keyboard |
| GFM editor ([§6.2](06-comments-notifications.md)) | Compact toolbar; images from camera and gallery | As on desktop |
| Product tours (Rule 4) | Bottom-sheet tips instead of tooltips next to elements | As on desktop |
| E-mails ([§6.5](06-comments-notifications.md)) | Responsive templates readable on phones | – |

Keyboard shortcuts remain a desktop accelerator; every action they trigger is also reachable by touch.

### Performance

- Pages are usable on mobile networks: code splitting and lazy loading of heavy views (Gantt, editor), optimized images.
- Performance budget checked in CI with Lighthouse (mobile profile): Performance and Accessibility scores of at least 90, LCP < 2.5 s, TBT < 200 ms and CLS < 0.1 for the **key pages**. Key pages are listed per stage and extended by the task that adds a page:
  - Stage 0: sign-in redirect, empty application shell,
  - Stage 1: portal project home, ticket creation form, ticket view (end user and team), team list view, Kanban board,
  - later stages: triage queue, roadmap, Gantt chart, SLA report.

### Verification

- E2E tests ([§2.14](#214-agent-workflow)) run the key user paths (the user paths of the key pages above, plus the paths named in the "Done when" criteria of the implementation plan) on **phone, tablet and desktop** viewports (Playwright device profiles, e.g. a current iPhone, an Android phone and an iPad).
- Every UI component in the component catalog (Rule 6) is shown in phone, tablet and desktop viewports.

## 2.10 Rule 10 – Dependencies are monitored and kept up to date

All dependencies – npm packages, frameworks, the Node.js runtime, container base images, GitHub Actions and third-party services in Docker Compose (PostgreSQL, Valkey, Keycloak, SeaweedFS, Caddy, ClamAV) – are **continuously monitored for vulnerabilities** and **kept up to date**.

Rule 10 is **subordinate to Rule 1** (OWASP: *Vulnerable and Outdated Components*; supply-chain security practices).

### Up to date, but not on day one

"Up to date" means the **latest stable version after a short cooldown**, not a version published minutes ago. Freshly published releases are the most common vehicle of supply-chain attacks (a compromised maintainer account publishes a malicious version that is removed within days). Therefore:

- **Security fixes** are applied **immediately** (no cooldown).
- **Regular updates** (patch, minor) are applied only after the version has been public for at least **7 days**.
- **Major updates** (e.g. a new Next.js, NestJS or Prisma major) are separate, planned tasks: the agent reads the release notes and migration guide, updates the code and the specification if needed (Rule 8).
- Only stable releases are used – no alpha, beta, release candidates or `latest`/`next` tags.
- The Node.js runtime uses only **LTS** versions; base images follow the same Node.js LTS line.

### Where it is checked

| Stage | What happens | Blocking? |
|---|---|---|
| **Adding a dependency** (agent) | The agent checks that the package exists, is actively maintained and widely used, has no known vulnerabilities, has an MIT-compatible license ([§16.1](16-open-source.md)), and adds its latest stable version that is at least 7 days old (the cooldown applies to new dependencies too; security fixes excepted) with an explicit version range – never through a dist-tag, because `latest` may point to a release candidate (in October 2026 `prisma@latest` was a Prisma ORM 8 release candidate). It prefers fewer dependencies: no package for what a few lines of code or an existing dependency already do | Agent's responsibility; verified in review |
| **Every pull request** (CI) | Dependency review of added/changed packages, vulnerability audit of the lockfile, license check. Install only from the committed lockfile (`--frozen-lockfile`) | **Yes**, for new vulnerabilities of severity high or critical |
| **Continuously on the main branch** (scheduled, at least daily) | Vulnerability alerts for all dependencies (GitHub Dependabot alerts), scan of container images ([§15.4](15-deployment.md)) | Opens an alert and a fix pull request |
| **Automated update pull requests** | Dependabot: security updates immediately; patch and minor updates weekly, grouped, with a 7-day cooldown; GitHub Actions and base images included. Major updates arrive as separate pull requests; none for `prisma` and `@prisma/*` ([§14.2](14-architecture.md)), for `typescript` (TypeScript 7 waits for tool support, [ADR 0002](../adr/0002-technology-stack.md)) and for the Node.js base image (LTS line) and `@types/node` (its major follows the runtime and moves with the move to the next LTS line) | Normal review and CI apply |
| **Release** ([§15.4](15-deployment.md)) | Scan of the built images; a **software bill of materials (SBOM)** in CycloneDX or SPDX format is attached to the GitHub Release | **Yes**: no release with known critical vulnerabilities |
| **Monthly** (planned task) | Review of outdated dependencies and pending major updates; planning of major upgrades; review of upstream changes to components copied from shadcn/ui (`shadcn diff`) and deliberate porting of relevant fixes | – |

### Response times

| Severity | Fix released within |
|---|---|
| Critical | 7 days |
| High | 14 days |
| Medium | 30 days |
| Low | next planned update |

If no fixed version exists, the agent documents the risk and the mitigation in the pull request or an ADR, and the vulnerability is tracked until it is fixed. An accepted advisory is listed with its reason in the audit configuration (`auditConfig.ignoreGhsas` in `pnpm-workspace.yaml`) and removed as soon as a fixed version exists. Vulnerabilities in Trybun itself are handled through `SECURITY.md` ([§16.2](16-open-source.md)).

### Supply-chain hardening

- The lockfile (`pnpm-lock.yaml`) is always committed and reviewed.
- GitHub Actions are pinned to a full commit SHA; container base images are pinned to a digest, written in the `FROM` line of the Dockerfile (Dependabot does not read images from `ARG` values) and in `image:` of the Compose files; the images of the integration tests use the references of the Compose files. Dependabot keeps them up to date (`.github/dependabot.yml`); `pnpm lint` checks the pinning (`scripts/check-supply-chain.js`).
- Package install scripts are allowed only for explicitly approved packages (pnpm `allowBuilds` in `pnpm-workspace.yaml`, the pnpm 12 successor of `onlyBuiltDependencies`); the install of a package with an install script that is not listed fails.

## 2.11 Rule 11 – Versioning

Versions are **derived automatically from the commit history** and released only by a **human decision**. Agents never invent version numbers and never edit the changelog by hand.

Rule 11 is **subordinate to Rule 1** (Semantic Versioning, Conventional Commits, Keep a Changelog).

### What is versioned, and how

| Element | Versioning | Reason |
|---|---|---|
| **Product** (the whole monorepo) | One Semantic Versioning number `MAJOR.MINOR.PATCH` for all apps and internal packages | Internal packages are not published separately. Administrators install "Trybun 1.4.0", not a set of component versions |
| **Public API** | Version in the path: `/api/v1`, `/api/v2` ([§12.1](12-api-webhooks-import.md)) | The API changes less often than the product; product 1.9 may still serve only `/api/v1` |
| **Webhook events** | `version` field in every event payload ([§12.4](12-api-webhooks-import.md)) | Receivers must know which payload format they get |
| **Database schema** | Prisma migrations, forward-only, shipped with the product release | Migrations run during updates ([§15.7](15-deployment.md)) |
| **Specification and documentation** | Versioned with the code; the release tag (e.g. `v1.4.0`) is also the version of the specification | The specification for 1.4.0 is the repository state at that tag |

### What counts as MAJOR, MINOR, PATCH

For a self-hosted product, **MAJOR** is anything that requires the Administrator's attention:

- a renamed or removed environment variable or configuration option,
- a manual step during an update,
- a removed feature,
- removal of an old public API version,
- increased server requirements ([§15.2](15-deployment.md)).

**MINOR** is new functionality that is backwards compatible. **PATCH** is a backwards-compatible fix.

Before `1.0.0` (stages 0–7 of the implementation plan), following the common convention for `0.x` versions:

- `feat:` commits and breaking changes increase **MINOR** (e.g. `0.3.0` → `0.4.0`); a MINOR release may contain breaking changes,
- `fix:` and all other release-relevant commits increase **PATCH**.

release-please is configured accordingly (`bump-minor-pre-major: true`). The stage versions in the implementation plan ([`docs/plan/`](../plan/implementation-plan.md)) result from this rule. The only allowed manual version is a **human-authored** `Release-As:` footer (used for `1.0.0` at the end of Stage 7); agents never write it.

### Commits are the source of versions

- Every commit follows **Conventional Commits**: `fix:` → PATCH, `feat:` → MINOR, `feat!:` / `fix!:` or a `BREAKING CHANGE:` footer → MAJOR. Other types (`docs:`, `test:`, `refactor:`, `chore:`, `ci:`) do not trigger a release on their own.
- A breaking change must always be marked with `!` or `BREAKING CHANGE:`, and its footer describes what the Administrator has to do. These texts end up in the release notes.
- Agents never set version numbers in files and never edit `CHANGELOG.md` manually.

### Release process

Releases are prepared by **release-please**:

1. Changes are merged into `main` through reviewed pull requests ([§2.14](#214-agent-workflow)).
2. release-please keeps an open **release pull request** with the next version number calculated from the commits and the generated `CHANGELOG.md` entry (Keep a Changelog format).
3. A **human decides** when to release by merging the release pull request (optionally after testing a release candidate, see below).
4. Merging creates the tag `vX.Y.Z` and the GitHub Release; CI then builds, scans and publishes the images and the deployment package ([§15.4](15-deployment.md)).

**Release candidates**: before a release that deserves testing, a pre-release `X.Y.Z-rc.N` is published and deployed to the test environment. Pre-releases are never marked as the latest release.

**Maintenance branches**: when a fix must be released without the new features already on `main` (e.g. an urgent security fix), a branch `release/X.Y.x` is created from the release tag, the fix is cherry-picked onto it, and release-please prepares a separate PATCH release from that branch.

### Upgrade path and support

- Updating is possible from any version of the same MAJOR series directly to its latest version.
- Moving to a new MAJOR version goes through the **latest release of the previous series** (e.g. `1.x` → `1.9.3` → `2.0.0`). This allows old migrations and compatibility code to be removed.
- Security fixes (Rule 10) go to the latest MINOR version. After a new MAJOR version is released, the last release of the previous series receives security fixes for **6 months**.
- When a new public API version appears, the previous one is marked as deprecated (`Deprecation` and `Sunset` response headers) and keeps working for at least one more MAJOR product version. The same applies to webhook event versions.

### Where the version is visible

- the "About" page of the Administrator panel ([§15.4](15-deployment.md)),
- the health endpoint (`/health`) of the API; the status of its dependencies is reported by `/health/ready` ([§17.2](17-conventions.md)),
- container image tags: `ghcr.io/trybun/<service>:X.Y.Z`, plus moving tags `:X.Y` and `:X`. The deployment package always pins the exact version `X.Y.Z` and never uses `latest`.

## 2.12 Rule 12 – One pattern per problem

For every recurring problem in the code – where a file belongs, how an endpoint checks permissions, how a change triggers side effects, how the web application reads and changes data – the project uses **exactly one pattern**. Code written by different agents at different times must read as if one team wrote it.

Rule 12 is **subordinate to Rule 1**: the patterns are chosen from the conventions and best practices of each technology and recorded in the pattern catalogue ([18-code-patterns.md](18-code-patterns.md)).

- Before writing code, the agent looks up the pattern for each problem in the catalogue and follows its **reference implementation** ([§18.9](18-code-patterns.md#189-enforcement-and-changes)) in structure, naming, error handling and tests.
- The agent never introduces a second way of solving a problem the catalogue covers, even where it considers another approach better. A better approach is proposed as a change of the pattern.
- A recurring problem the catalogue does not cover: its first implementation proposes the pattern in the catalogue in the same pull request, marked as a specification change for approval (Rule 8).
- Changing a pattern requires an ADR approved by a human ([§2.14](#214-agent-workflow)). The same pull request updates the catalogue, the reference implementation and the affected skills; existing code is migrated in it or in a task added to the implementation plan. Two patterns for the same problem never coexist without such a task.
- Patterns that can be checked automatically are enforced by lint rules in CI.

## 2.13 Definition of Done

An implementation task is done only when:

1. the solution has been checked against conventions and best practices (Rule 1),
2. the user path has been verified for the minimum number of steps (Rule 2),
3. user documentation has been created or updated (Rule 3),
4. the product tour has been created or updated if the change affects a view covered by a tour (Rule 4),
5. README.md reflects the current state of the project (Rule 5),
6. new components are reusable and UI components have a component catalog entry (Rule 6),
7. knowledge gained during the task has been recorded in project memory and the memory index is up to date (Rule 7),
8. the specification reflects the change, and any change of requirements is marked for approval (Rule 8),
9. the UI works on phones, tablets and desktop and is verified on these viewports (Rule 9),
10. no new known vulnerabilities are introduced and new dependencies are at their latest stable version (Rule 10),
11. commits follow Conventional Commits and breaking changes are marked with the steps required from the Administrator (Rule 11),
12. the code follows the patterns of the catalogue, and a new or changed pattern is proposed for approval (Rule 12),
13. tests pass and the new functionality is covered by tests,
14. all automated quality gates in CI pass,
15. the change has been reviewed and approved by a human.

## 2.14 Agent workflow

### Agent instructions in the repository

- The repository contains **`AGENTS.md`** (the open convention for coding-agent instructions) with a condensed version of these rules, project conventions, build and test commands and a link to this specification. Tool-specific files (e.g. `CLAUDE.md`) reference `AGENTS.md` instead of duplicating it.
- This specification lives in the repository (`docs/spec/`) and is versioned with the code.
- At the start of every session, the agent reads the project memory index (Rule 7).
- Before starting a task, the agent reads the specification files the task refers to (and the glossary), and the memory topic files relevant to the task.

### Tasks and changes

- Work is split into **small, well-defined tasks**. Every task names the specification sections it implements.
- One task = one pull request of limited scope, easy for a human to review.
- Agents never push directly to the main branch. The main branch is protected and accepts changes only through approved pull requests.
- The project's own agents (run by the maintainer, e.g. through Cezar) push branches and open pull requests **only as the project's GitHub App** ([§16.5](16-open-source.md), [ADR 0005](../adr/0005-github-app-as-agent-identity.md)), never as the maintainer. The maintainer approves the pull request as **code owner**; agents never approve pull requests. External contributors and their agents use their own GitHub accounts ([§16.4](16-open-source.md)).
- If the implementation reveals a gap or contradiction in the specification, the agent **does not resolve it on its own**: it proposes a specification change marked for human approval (Rule 8).
- Significant technical decisions, including deliberate departures from conventions (Rule 1), are recorded as **ADRs** (Architecture Decision Records) in the repository.
- Other agents may be working on other tasks in parallel (separate worktrees, e.g. through Cezar). Keep changes within the scope of the task and keep the branch up to date with `main` before opening a pull request.

### Working practices

These practices follow recommendations of the Claude Code team and apply to every agent.

- **Plan first, re-plan when it goes wrong.** For a non-trivial task the agent first writes a plan (in the change specification or the pull request description) and only then implements it. If the implementation goes sideways – repeated failures, growing workarounds, a design that no longer fits – the agent **stops, re-plans** and updates the plan or the change specification instead of pushing through with patches.
- **Learn from every correction.** When a human corrects the agent, the agent makes sure the mistake does not repeat:
  - a specific pitfall or technique → project memory (`.ai/memory/`, Rule 7),
  - a general working rule → a proposed change to `AGENTS.md` in the pull request, for human approval.
- **Turn repeated work into skills.** When the agent performs the same sequence of steps repeatedly, it proposes a project skill in `.ai/skills/` instead of repeating the steps by hand.
- **Fix the cause, never the gate.** When CI fails, the agent reads the logs and fixes the cause. It **never** disables, skips or weakens tests, lowers coverage or performance thresholds, adds exclusions to the coverage configuration, removes quality gates or adds suppressions (e.g. lint-disable comments, `@ts-ignore`, coverage-ignore comments) to make CI pass. If a gate itself is wrong, the agent proposes changing it as a separate, explained change for human approval.
- **Self-review before the pull request.** Before opening a pull request the agent reviews its own diff against the specification, the code patterns (Rule 12) and the Definition of Done and asks: *knowing everything I know now, is there a simpler, cleaner solution?* If so, it reworks the change before handing it over for review.

### Branching and merging

- **Trunk-based development**: short-lived branches from `main`, one per task, merged through pull requests with **squash merge**, so every merged PR is one Conventional Commit on `main`.
- The squash commit takes the **PR title** as its title and the commit messages as its body, so the PR title must be a Conventional Commit with a scope from the list below (or none); commitlint checks it.
- `main` is protected by the ruleset "Protect main" (no bypass actors): a pull request with 1 approval and Code Owners review ([§16.3](16-open-source.md)); stale approvals are dismissed on push, and the most recent push must be approved by someone other than its pusher; squash is the only merge method; force pushes and deletion are blocked. The CI gates below are its required status checks. Branches are deleted after merge.
- Branch names: `KEY-123-short-description` for tickets, `S0-01-short-description` for tasks of the implementation plan, `cez/<id>` for branches created by Cezar; maintenance branches `release/X.Y.x` only according to Rule 11.
- Commit scopes form a closed list: `web`, `server`, `ui`, `contracts`, `i18n`, `config` (shared tooling: `@trybun/tsconfig`, `@trybun/eslint-config`, root configuration), `deploy` (Docker Compose, Caddy, Keycloak configuration, install, update and backup scripts), `docs` (user documentation), `spec`, `plan`, `adr`, `agents` (`AGENTS.md`, `CLAUDE.md`, `.ai/skills/`), `memory` (`.ai/memory/`), `brand`, `repo` (community and GitHub files), `ci`, `deps`, `release`. A new scope is added by changing this list. The scope is optional for repository-wide changes (e.g. `chore: …`). The commit message check (commitlint) enforces this list.

### Architecture Decision Records

- ADRs are stored in `docs/adr/` as `NNNN-short-title.md` (sequential number, kebab-case) in the **MADR** format: context, decision, considered options, consequences, status (`proposed`, `accepted`, `superseded by NNNN`).
- `docs/adr/README.md` is the index. ADRs are never deleted; a changed decision gets a new ADR that supersedes the old one.

### Testing approach

- **Unit tests** (Vitest) for domain logic: visibility, permissions, status transitions, SLA calculation, scheduling.
- **Integration tests** (Vitest + Testcontainers) run against real PostgreSQL and Valkey; the database is never mocked. External HTTP services (GitHub, e-mail provider) are simulated with MSW.
- **Permission tests**: every row of the permission matrix ([§7.5](07-users-organizations-permissions.md)) is an automated test, for both allowed and denied cases.
- **E2E tests** (Playwright) cover the key user paths on phone, tablet and desktop viewports (Rule 9) and include accessibility checks (axe).
- Test data is created with **factories** (`@faker-js/faker`); tests never depend on each other's data. A separate, deterministic **demo dataset** is used for the local and test environments, documentation screenshots and product tours.

### Automated quality gates

Every pull request passes at least the following in CI:

- formatting and lint,
- type checking in strict mode (TypeScript `strict`),
- unit, integration and E2E tests with the coverage thresholds below; E2E on phone, tablet and desktop viewports (Rule 9),
- Lighthouse mobile performance and accessibility budget (Rule 9, [§2.9](#29-rule-9--designed-for-phones-and-tablets-from-the-start)),
- accessibility tests with axe ([§13.4](13-non-functional.md)): rule tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`; zero violations of impact `serious` or `critical`,
- security analysis: dependency review and vulnerability audit (Rule 10), secret scanning, static application security testing (SAST), license check,
- specification consistency check: links and `§N.M` references (Rule 8),
- building all applications.

**Coverage thresholds** (Vitest, V8 coverage; E2E tests are not counted):

| Scope | Lines | Branches |
|---|---|---|
| Domain modules of `apps/server` and `@trybun/contracts` | ≥ 80 % | ≥ 75 % |
| Every other package and application | ≥ 70 % | – |

- **Tests counted:** unit and integration tests. CI runs both together (`pnpm test:coverage`) and checks the thresholds once, on the combined result. A local `pnpm test` or `pnpm test:integration` run checks no thresholds, because a single run does not see the other half of the tests.
- **Files measured:** the source files (`src/`) of every application and package, except this closed list:

  | Excluded | Examples | Reason |
  |---|---|---|
  | Test code | `*.spec.ts(x)`, `*.integration.spec.ts`, the `test/` folders (factories, MSW handlers, set-up), `e2e/` | Not product code |
  | Storybook stories | `*.stories.tsx` | Documentation of components; components are tested by their own tests |
  | Process entry points that only bootstrap | `apps/server/src/main.ts`, `apps/server/src/worker.ts` | Start-up wiring; covered by starting the built application and by E2E tests |
  | Generated code | Prisma client, `openapi-typescript` types, Keycloak theme messages generated from `@trybun/i18n` | Not written by hand; its source is tested |
  | Configuration files | `*.config.ts`, `*.config.mjs` (Vitest, Next.js, Playwright, ESLint, Prisma) | Tooling, not product code |
  | Type declarations | `*.d.ts` | No runtime code |
  | Database seed scripts | `apps/server/prisma/seed.ts` and the demo dataset | Tooling; the demo data is exercised by E2E tests |

- The list lives here and in one shared Vitest coverage configuration (the root `vitest.config.ts`); adding a pattern to it is a specification change for approval.
- Coverage-ignore comments in the code (`/* v8 ignore … */`, `/* istanbul ignore … */`, `/* c8 ignore … */`) are suppressions and are not allowed, like `@ts-ignore` and lint-disable comments; lint reports them.

**Tools of the gates:**

| Gate | Tool |
|---|---|
| SAST | GitHub CodeQL |
| Secret scanning | GitHub secret scanning with push protection |
| Dependency review and license check | `actions/dependency-review-action` with a license allowlist |
| Vulnerability audit of the lockfile | `pnpm audit` (high and critical block) |
| Container image scan (release, [§15.4](15-deployment.md)) | Trivy |
| SBOM (release) | Syft, CycloneDX format |
| Commit messages | commitlint (Conventional Commits, closed scope list) for the title of the pull request and its commits (project script `scripts/check-commit-messages.js`); Dependabot's commits are exempt – it chooses the case of their subject – and the title of its pull requests is corrected before merge |
| DCO ([§16.3](16-open-source.md)) | Project script `scripts/check-dco.js` (job `DCO sign-off`) |
| Specification consistency | link checker (lychee) and a project script for `§N.M` references |

**License policy** ([§16.1](16-open-source.md)):

- Allowed for npm dependencies: MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, MIT-0, BlueOak-1.0.0, CC0-1.0, Unlicense, Python-2.0, and CC-BY-4.0 for data packages (e.g. `caniuse-lite`).
- Denied for npm dependencies: AGPL, GPL, SSPL and other strong copyleft or source-available licenses.
- Documented exceptions (listed in the allowlist configuration with a reason): MPL-2.0 for development-only dependencies (e.g. `axe-core`); LGPL for dynamically loaded optional binaries (e.g. libvips of `sharp`); OFL-1.1 for fonts (e.g. the brand typeface Manrope).
- Third-party services running in their own containers (e.g. ClamAV, GPL-2.0) are aggregated, not linked, and are allowed.

### Agent safety

- Before adding a dependency, the agent follows Rule 10 ([§2.10](#210-rule-10--dependencies-are-monitored-and-kept-up-to-date)): the package must exist, be actively maintained and widely used, have no known vulnerabilities and a compatible license. This also protects against packages whose names imitate popular libraries.
- Agents have no access to production secrets or production data. They work with test data.
