# AGENTS.md – Trybun

Instructions for AI coding agents working in the **Trybun** repository. This project is delivered with an **AI Engineering** approach: agents implement, humans review and approve every change.

## Start of every session

1. Read the project memory index: [`.ai/memory/MEMORY.md`](.ai/memory/MEMORY.md). Read topic files from it only when relevant to the task.
2. Read the specification files your task refers to, and the change specification in `.ai/specs/` if the task has one.

## Source of truth

- Specification: [`docs/spec/README.md`](docs/spec/README.md) (index). Read only the files your task refers to.
- Terms and code identifiers: [`docs/spec/00-glossary.md`](docs/spec/00-glossary.md). Always use these identifiers in code.
- Full rules: [`docs/spec/02-agent-rules.md`](docs/spec/02-agent-rules.md). This file is a summary.
- Implementation plan and task status: [`docs/plan/implementation-plan.md`](docs/plan/implementation-plan.md). Mark a task `[x]` in the same PR that completes it.
- Keep the spec up to date in the same PR (Rule 8). If it has a gap or contradiction, **do not decide yourself** – propose a spec change marked for approval.

## Rules (in order of precedence)

1. **Conventions first.** Check for an established standard or pattern before implementing; follow it. Record deliberate deviations as an ADR.
2. **Minimum user steps.** Design the shortest path to the user's goal – but never at the cost of conventions, predictability or accessibility (subordinate to Rule 1).
3. **User documentation from day one.** Docs-as-code, Diátaxis structure, EN + PL, contextual help. Update docs in the same PR.
4. **Interactive tours.** Short (≤ ~5 steps), skippable, shown once, role-aware, accessible, translated; targets marked with `data-tour` attributes and checked by E2E tests.
5. **README.md always current.** Update it in the same PR as the change it describes.
6. **Reusable components.** Check `@trybun/ui` (`packages/ui`) and shared packages first; presentational UI components with Storybook entries, design tokens, no hard-coded text; no speculative options (YAGNI).
   shadcn/ui is the starting point: add components with the shadcn CLI into `packages/ui`, then adapt them (tokens, 44 px touch targets, translated texts, accessibility, Storybook entry) – they are project code from then on. Build from scratch only if shadcn/ui has nothing suitable.
   Styling: Tailwind CSS only, theme tokens only (no arbitrary values like `bg-[#…]`), variants via `cva`, merge via `tailwind-merge`, Prettier class sorting, dark mode through tokens.
7. **Project memory in the repo.** Store knowledge gained during work (pitfalls, non-obvious behavior, proven solutions) only in `.ai/memory/` and keep the index `MEMORY.md` current. Tool-specific memory outside the repo (e.g. Claude Code auto memory) is disabled for this project (`.claude/settings.json`: `"autoMemoryEnabled": false`). Memory never overrides the spec; it does not duplicate the spec or ADRs. Write it in the same PR, in English, without secrets or personal data.
8. **Specification always current.** Update `docs/spec/` in the same PR as the change. Clarifications (exact error codes, paths, limits) – update directly. Changes of requirements or behaviour, gaps and contradictions – propose in the PR as a *specification change for approval*, in a separate `docs(spec): …` commit. Keep glossary, index, `§` references, permission matrix and plan consistent. The spec says *what*, not *how*.
   Change specifications: new functionality and behaviour changes start with `.ai/specs/YYYY-MM-DD-slug.md` (from `TEMPLATE.md`) in its own PR; never implement while open questions are unanswered; the implementation PR updates `docs/spec/` and moves the change spec to `.ai/specs/implemented/`. Not used for bug fixes, dependency updates or docs-only changes.
9. **Phones and tablets from the start.** Every page, dialog, form and tour is mobile-first and responsive from 360 px; touch targets ≥ 44 px; no hover-only actions; dialogs become full-screen/bottom sheets on phones; Kanban one column at a time on phones; Gantt read-only on phones. E2E on phone, tablet and desktop viewports; Lighthouse mobile ≥ 90.
10. **Dependencies secure and current.** New dependency: exists, maintained, widely used, no known vulnerabilities, MIT-compatible licence, latest stable version – and only if really needed. Security fixes immediately; other updates after a 7-day cooldown; majors as planned tasks; stable releases and Node.js LTS only. CI blocks new high/critical vulnerabilities; lockfile committed; Actions pinned to SHA, images to digest.
11. **Versioning.** One SemVer version for the whole product, produced by release-please from Conventional Commits; a human releases by merging the release PR. Never set version numbers or edit `CHANGELOG.md` by hand. Mark breaking changes with `!`/`BREAKING CHANGE:` and describe the Administrator's steps. MAJOR = anything requiring the Administrator's attention. Public API versioned in the path, webhook events with a `version` field.

Rules 2–11 are subordinate to Rule 1; Rules 3–6 and 9 are also subordinate to Rule 2.

## Naming and brand

**Trybun** in text, `trybun` in every technical identifier: npm scope `@trybun/`, images `ghcr.io/trybun/<service>`, env prefix `TRYBUN_`, Keycloak realm `trybun`. Full table: [`docs/spec/01-overview.md`](docs/spec/01-overview.md) §1.4. Logo, colours and font only from [`docs/brand/`](docs/brand/README.md) – never draw your own.

## Repository structure (agent-relevant)

| Path | Purpose |
|---|---|
| `docs/spec/` | System specification – source of truth |
| `docs/plan/` | Implementation plan and task status |
| `docs/brand/` | Logo, colours, typeface |
| `.ai/specs/` | Change specifications (`implemented/`, `archive/`) |
| `.ai/memory/` | Project memory (`MEMORY.md` index + topic files) |
| `.ai/skills/` | Project-specific skills for Cezar and agents (when created) |
| `.ai/cezar/` | Managed by Cezar – do not edit its state files; workflows and skills are committed |

## Language

English for code, identifiers, comments, commits, PR descriptions, README and technical docs. UI and user docs are bilingual (EN, PL) – no hard-coded UI text.

## Architecture essentials

- TypeScript monorepo (pnpm + Turborepo): Next.js web app styled with Tailwind CSS, NestJS API and Worker, shared packages under the `@trybun/` npm scope (Zod schemas, types, `@trybun/ui`).
- PostgreSQL via Prisma; raw SQL only parameterized and only where Prisma is insufficient (full-text search, pgvector).
- **Permissions and visibility are decided only by the API.** The frontend never contains this logic.
- Authentication only via Keycloak. Never implement custom security mechanisms.
- Background work (webhooks, SLA, scanning, e-mail, imports) runs in the Worker via BullMQ on Valkey. Object storage: SeaweedFS by default (any S3-compatible storage via config). Do not use Redis or MinIO.
- Everything runs in Docker Compose; the system must run on any Linux VPS.

## Definition of Done

1. Conventions checked (Rule 1) · 2. Shortest user path verified (Rule 2) · 3. User docs updated (Rule 3) · 4. Tour updated if affected (Rule 4) · 5. README current (Rule 5) · 6. Components reusable, Storybook entry (Rule 6) · 7. Project memory and its index updated (Rule 7) · 8. Spec updated, requirement changes marked for approval (Rule 8) · 9. Works on phone, tablet and desktop (Rule 9) · 10. No new vulnerabilities, deps current (Rule 10) · 11. Conventional Commits, breaking changes marked (Rule 11) · 12. Tests added and passing · 13. All CI quality gates pass · 14. Human review approved.

## Workflow

- Small tasks; one task = one focused PR referencing spec sections (e.g. `§5.2`).
- Never push to `main`; PRs only.
- Conventional Commits; branch names `KEY-123-short-description`.
- CI gates: format, lint, strict type check, spec consistency check, Lighthouse mobile budget, unit/integration/E2E tests with coverage threshold, accessibility tests, dependency review and vulnerability audit, secret scanning, SAST, build.
- No access to production secrets or data; use test data.
- The project is open source under MIT ([`docs/spec/16-open-source.md`](docs/spec/16-open-source.md)). Every commit needs a DCO `Signed-off-by` line. Never add conditions to the license text and never add prompts asking for donations in the application, installer or scripts.

## Commands

<!-- Fill in when the repository is scaffolded: install, dev, build, test, lint, typecheck, migrate, storybook. Keep in sync with README.md (Rule 5). -->
