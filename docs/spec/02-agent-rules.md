# 02 – Rules for AI agents

The rules below take precedence over all other implementation guidelines in this specification.

## 2.1 Rule 1 – Conventions and best practices first

Everything newly implemented in the project (code, data structures, API, UI, configuration, naming) must **first** be checked against the conventions and best practices commonly used by developers worldwide.

Before implementing, the agent:

1. Checks whether a recognized standard or pattern exists for the problem (e.g. language/framework naming conventions, REST/HTTP, SOLID, OWASP, Semantic Versioning, Conventional Commits).
2. Chooses the solution that follows the standard instead of inventing its own.
3. If it deliberately departs from a convention, documents the reason in an ADR ([§2.9](#29-agent-workflow)).

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
- Styling is based on **design tokens** (colors, spacing, typography), never hard-coded values.
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
| ADRs | Significant technical **decisions** and their rationale ([§2.9](#29-agent-workflow)) |
| Project memory (`docs/ai/memory/`) | Knowledge gained during work that is in neither of the above: pitfalls, non-obvious behavior of libraries and tools, proven ways of solving recurring problems, agreements from discussions |

- Project memory **never overrides the specification**. If an agent finds a contradiction between memory and the specification, it reports it ([§2.9](#29-agent-workflow)) instead of "fixing" the specification through memory.
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

## 2.8 Definition of Done

An implementation task is done only when:

1. the solution has been checked against conventions and best practices (Rule 1),
2. the user path has been verified for the minimum number of steps (Rule 2),
3. user documentation has been created or updated (Rule 3),
4. the product tour has been created or updated if the change affects a view covered by a tour (Rule 4),
5. README.md reflects the current state of the project (Rule 5),
6. new components are reusable and UI components have a component catalog entry (Rule 6),
7. knowledge gained during the task has been recorded in project memory and the memory index is up to date (Rule 7),
8. tests pass and the new functionality is covered by tests,
9. all automated quality gates in CI pass,
10. the change has been reviewed and approved by a human.

## 2.9 Agent workflow

### Agent instructions in the repository

- The repository contains **`AGENTS.md`** (the open convention for coding-agent instructions) with a condensed version of these rules, project conventions, build and test commands and a link to this specification. Tool-specific files (e.g. `CLAUDE.md`) reference `AGENTS.md` instead of duplicating it.
- This specification lives in the repository (`docs/spec/`) and is versioned with the code.
- At the start of every session, the agent reads the project memory index (Rule 7).
- Before starting a task, the agent reads the specification files the task refers to (and the glossary), and the memory topic files relevant to the task.

### Tasks and changes

- Work is split into **small, well-defined tasks**. Every task names the specification sections it implements.
- One task = one pull request of limited scope, easy for a human to review.
- Agents never push directly to the main branch. The main branch is protected and accepts changes only through approved pull requests.
- If the implementation reveals a gap or contradiction in the specification, the agent **does not resolve it on its own**: it reports it and proposes a specification change for human approval.
- Significant technical decisions, including deliberate departures from conventions (Rule 1), are recorded as **ADRs** (Architecture Decision Records) in the repository.

### Automated quality gates

Every pull request passes at least the following in CI:

- formatting and lint,
- type checking in strict mode (TypeScript `strict`),
- unit, integration and E2E tests with a minimum coverage threshold,
- accessibility tests ([§13.4](13-non-functional.md)),
- security analysis: dependency audit, secret scanning, static application security testing (SAST),
- building all applications.

### Agent safety

- Before adding a dependency, the agent verifies that the package actually exists, is actively maintained and widely used. This protects against packages whose names imitate popular libraries.
- Agents have no access to production secrets or production data. They work with test data.
