# 02 – Rules for AI agents

The rules below take precedence over all other implementation guidelines in this specification.

## 2.1 Rule 1 – Conventions and best practices first

Everything newly implemented in the project (code, data structures, API, UI, configuration, naming) must **first** be checked against the conventions and best practices commonly used by developers worldwide.

Before implementing, the agent:

1. Checks whether a recognized standard or pattern exists for the problem (e.g. language/framework naming conventions, REST/HTTP, SOLID, OWASP, Semantic Versioning, Conventional Commits).
2. Chooses the solution that follows the standard instead of inventing its own.
3. If it deliberately departs from a convention, documents the reason in an ADR ([§2.13](#213-agent-workflow)).

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
- A tour starts automatically **only once**: on a person's first visit to a given view. Completion or skipping is remembered.
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
- UI components form the **project component library** (a separate monorepo package `packages/ui`, published as `@trybun/ui`), built on Radix UI primitives, not from scratch.
- Every UI component has a **component catalog entry** (Storybook) with usage examples and all states (e.g. empty, loading, error, disabled).
- UI components are **presentational**: no domain logic and no API calls. They receive data and actions through props. Domain logic lives in the application layer and the API ([§14.4](14-architecture.md)).
- Styling uses **Tailwind CSS** ([§14.2](14-architecture.md)) and is based on **design tokens** (colors, spacing, typography, radii, shadows) defined once in the Tailwind theme (`@theme`, CSS variables). Brand colours and the typeface come from [`docs/brand/`](../brand/README.md). Rules:
  - only theme tokens are used – no arbitrary values such as `bg-[#E0482C]` or `p-[13px]` (enforced by lint),
  - long class lists live inside `@trybun/ui` components, never copied across views; component variants use class-variance-authority, classes are combined with tailwind-merge,
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
| Specification (`docs/spec/`) | **What** the system must do. The source of truth |
| ADRs | Significant technical **decisions** and their rationale ([§2.13](#213-agent-workflow)) |
| Project memory (`docs/ai/memory/`) | Knowledge gained during work that is in neither of the above: pitfalls, non-obvious behavior of libraries and tools, proven ways of solving recurring problems, agreements from discussions |

- Project memory **never overrides the specification**. If an agent finds a contradiction between memory and the specification, it handles it according to Rule 8 instead of "fixing" the specification through memory.
- Memory does not duplicate the specification or ADRs; it links to them instead.

### Structure and loading

- `docs/ai/memory/MEMORY.md` is the **index**: one line per topic file, saying what the file contains and when to read it.
- Topic files (`docs/ai/memory/<topic>.md`) contain the knowledge itself.
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

The specification (`docs/spec/`) always describes the system **as it actually is and is meant to be**. Like the README (Rule 5) and user documentation (Rule 3), it is updated **in the same pull request** as the change that affects it, never "later".

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

### Consistency

With every specification change the agent keeps the specification consistent:

- the glossary ([00-glossary.md](00-glossary.md)) – new or changed terms with code identifiers and UI labels,
- the index ([README.md](README.md)) – if a file is added or its scope changes,
- cross-references (`§N.M`) and links – after renumbering or moving sections,
- the permission matrix ([§7.5](07-users-organizations-permissions.md)) – if an action is added or its permissions change,
- the implementation plan ([`docs/plan/`](../plan/implementation-plan.md)) – if tasks, scope or task status change,
- user-facing texts in both languages (EN and PL).

CI includes an automated **specification consistency check**: every link and `§N.M` reference must point to an existing file and section ([§2.13](#213-agent-workflow)).

### Scope of the specification

The specification describes **what** the system does and the rules it follows. It does not describe **how** the code implements it: implementation details belong in the code and its comments, decisions in ADRs, and knowledge gained during work in project memory (Rule 7).

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
- Performance budget checked in CI with Lighthouse (mobile profile): Performance and Accessibility scores of at least 90 for key pages.

### Verification

- E2E tests ([§2.13](#213-agent-workflow)) run key user paths on **phone, tablet and desktop** viewports (Playwright device profiles, e.g. a current iPhone, an Android phone and an iPad).
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
| **Adding a dependency** (agent) | The agent checks that the package exists, is actively maintained and widely used, has no known vulnerabilities, has an MIT-compatible license ([§16.1](16-open-source.md)), and adds its latest stable version. It prefers fewer dependencies: no package for what a few lines of code or an existing dependency already do | Agent's responsibility; verified in review |
| **Every pull request** (CI) | Dependency review of added/changed packages, vulnerability audit of the lockfile, license check. Install only from the committed lockfile (`--frozen-lockfile`) | **Yes**, for new vulnerabilities of severity high or critical |
| **Continuously on the main branch** (scheduled, at least daily) | Vulnerability alerts for all dependencies (GitHub Dependabot alerts), scan of container images ([§15.4](15-deployment.md)) | Opens an alert and a fix pull request |
| **Automated update pull requests** | Dependabot: security updates immediately; patch and minor updates weekly, grouped, with a 7-day cooldown; GitHub Actions and base images included | Normal review and CI apply |
| **Release** ([§15.4](15-deployment.md)) | Scan of the built images; a **software bill of materials (SBOM)** in CycloneDX or SPDX format is attached to the GitHub Release | **Yes**: no release with known critical vulnerabilities |
| **Monthly** (planned task) | Review of outdated dependencies and pending major updates; planning of major upgrades | – |

### Response times

| Severity | Fix released within |
|---|---|
| Critical | 7 days |
| High | 14 days |
| Medium | 30 days |
| Low | next planned update |

If no fixed version exists, the agent documents the risk and the mitigation in the pull request or an ADR, and the vulnerability is tracked until it is fixed. Vulnerabilities in Trybun itself are handled through `SECURITY.md` ([§16.2](16-open-source.md)).

### Supply-chain hardening

- The lockfile (`pnpm-lock.yaml`) is always committed and reviewed.
- GitHub Actions are pinned to a full commit SHA; container base images are pinned to a digest. Dependabot keeps both up to date.
- Package install scripts are allowed only for explicitly approved packages (pnpm `onlyBuiltDependencies`).

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

Before `1.0.0` (stages 0–7 of the implementation plan), a **MINOR** increase (e.g. `0.3` → `0.4`) may contain breaking changes and **PATCH** contains everything else, following the common convention for `0.x` versions.

### Commits are the source of versions

- Every commit follows **Conventional Commits**: `fix:` → PATCH, `feat:` → MINOR, `feat!:` / `fix!:` or a `BREAKING CHANGE:` footer → MAJOR. Other types (`docs:`, `test:`, `refactor:`, `chore:`, `ci:`) do not trigger a release on their own.
- A breaking change must always be marked with `!` or `BREAKING CHANGE:`, and its footer describes what the Administrator has to do. These texts end up in the release notes.
- Agents never set version numbers in files and never edit `CHANGELOG.md` manually.

### Release process

Releases are prepared by **release-please**:

1. Changes are merged into `main` through reviewed pull requests ([§2.13](#213-agent-workflow)).
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
- the health endpoint (`/health`) of the API, together with the status of its dependencies,
- container image tags: `ghcr.io/trybun/<service>:X.Y.Z`, plus moving tags `:X.Y` and `:X`. The deployment package always pins the exact version `X.Y.Z` and never uses `latest`.

## 2.12 Definition of Done

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
12. tests pass and the new functionality is covered by tests,
13. all automated quality gates in CI pass,
14. the change has been reviewed and approved by a human.

## 2.13 Agent workflow

### Agent instructions in the repository

- The repository contains **`AGENTS.md`** (the open convention for coding-agent instructions) with a condensed version of these rules, project conventions, build and test commands and a link to this specification. Tool-specific files (e.g. `CLAUDE.md`) reference `AGENTS.md` instead of duplicating it.
- This specification lives in the repository (`docs/spec/`) and is versioned with the code.
- At the start of every session, the agent reads the project memory index (Rule 7).
- Before starting a task, the agent reads the specification files the task refers to (and the glossary), and the memory topic files relevant to the task.

### Tasks and changes

- Work is split into **small, well-defined tasks**. Every task names the specification sections it implements.
- One task = one pull request of limited scope, easy for a human to review.
- Agents never push directly to the main branch. The main branch is protected and accepts changes only through approved pull requests.
- If the implementation reveals a gap or contradiction in the specification, the agent **does not resolve it on its own**: it proposes a specification change marked for human approval (Rule 8).
- Significant technical decisions, including deliberate departures from conventions (Rule 1), are recorded as **ADRs** (Architecture Decision Records) in the repository.

### Automated quality gates

Every pull request passes at least the following in CI:

- formatting and lint,
- type checking in strict mode (TypeScript `strict`),
- unit, integration and E2E tests with a minimum coverage threshold; E2E on phone, tablet and desktop viewports (Rule 9),
- Lighthouse mobile performance and accessibility budget (Rule 9),
- accessibility tests ([§13.4](13-non-functional.md)),
- security analysis: dependency review and vulnerability audit (Rule 10), secret scanning, static application security testing (SAST),
- specification consistency check: links and `§N.M` references (Rule 8),
- building all applications.

### Agent safety

- Before adding a dependency, the agent follows Rule 10 ([§2.10](#210-rule-10--dependencies-are-monitored-and-kept-up-to-date)): the package must exist, be actively maintained and widely used, have no known vulnerabilities and a compatible license. This also protects against packages whose names imitate popular libraries.
- Agents have no access to production secrets or production data. They work with test data.
