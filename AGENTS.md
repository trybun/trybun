# AGENTS.md – Trybun

Instructions for AI coding agents working in the **Trybun** repository. This project is delivered with an **AI Engineering** approach: agents implement, humans review and approve every change.

## Start of every session

1. Read the project memory index: [`docs/ai/memory/MEMORY.md`](docs/ai/memory/MEMORY.md). Read topic files from it only when relevant to the task.
2. Read the specification files your task refers to.

## Source of truth

- Specification: [`docs/spec/README.md`](docs/spec/README.md) (index). Read only the files your task refers to.
- Terms and code identifiers: [`docs/spec/00-glossary.md`](docs/spec/00-glossary.md). Always use these identifiers in code.
- Full rules: [`docs/spec/02-agent-rules.md`](docs/spec/02-agent-rules.md). This file is a summary.
- Implementation plan and task status: [`docs/plan/implementation-plan.md`](docs/plan/implementation-plan.md). Mark a task `[x]` in the same PR that completes it.
- If the spec has a gap or contradiction, **do not decide yourself** – report it and propose a spec change.

## Rules (in order of precedence)

1. **Conventions first.** Check for an established standard or pattern before implementing; follow it. Record deliberate deviations as an ADR.
2. **Minimum user steps.** Design the shortest path to the user's goal – but never at the cost of conventions, predictability or accessibility (subordinate to Rule 1).
3. **User documentation from day one.** Docs-as-code, Diátaxis structure, EN + PL, contextual help. Update docs in the same PR.
4. **Interactive tours.** Short (≤ ~5 steps), skippable, shown once, role-aware, accessible, translated; targets marked with `data-tour` attributes and checked by E2E tests.
5. **README.md always current.** Update it in the same PR as the change it describes.
6. **Reusable components.** Check `@trybun/ui` (`packages/ui`) and shared packages first; presentational UI components with Storybook entries, design tokens, no hard-coded text; no speculative options (YAGNI).
7. **Project memory in the repo.** Store knowledge gained during work (pitfalls, non-obvious behavior, proven solutions) only in `docs/ai/memory/` and keep the index `MEMORY.md` current. Tool-specific memory outside the repo (e.g. Claude Code auto memory) is disabled for this project (`.claude/settings.json`: `"autoMemoryEnabled": false`). Memory never overrides the spec; it does not duplicate the spec or ADRs. Write it in the same PR, in English, without secrets or personal data.

Rules 2–7 are subordinate to Rule 1; Rules 3–6 are also subordinate to Rule 2.

## Naming and brand

**Trybun** in text, `trybun` in every technical identifier: npm scope `@trybun/`, images `ghcr.io/trybun/<service>`, env prefix `TRYBUN_`, Keycloak realm `trybun`. Full table: [`docs/spec/01-overview.md`](docs/spec/01-overview.md) §1.4. Logo, colours and font only from [`docs/brand/`](docs/brand/README.md) – never draw your own.

## Language

English for code, identifiers, comments, commits, PR descriptions, README and technical docs. UI and user docs are bilingual (EN, PL) – no hard-coded UI text.

## Architecture essentials

- TypeScript monorepo (pnpm + Turborepo): Next.js web app, NestJS API and Worker, shared packages under the `@trybun/` npm scope (Zod schemas, types, `@trybun/ui`).
- PostgreSQL via Prisma; raw SQL only parameterized and only where Prisma is insufficient (full-text search, pgvector).
- **Permissions and visibility are decided only by the API.** The frontend never contains this logic.
- Authentication only via Keycloak. Never implement custom security mechanisms.
- Background work (webhooks, SLA, scanning, e-mail, imports) runs in the Worker via BullMQ.
- Everything runs in Docker Compose; the system must run on any Linux VPS.

## Definition of Done

1. Conventions checked (Rule 1) · 2. Shortest user path verified (Rule 2) · 3. User docs updated (Rule 3) · 4. Tour updated if affected (Rule 4) · 5. README current (Rule 5) · 6. Components reusable, Storybook entry (Rule 6) · 7. Project memory and its index updated (Rule 7) · 8. Tests added and passing · 9. All CI quality gates pass · 10. Human review approved.

## Workflow

- Small tasks; one task = one focused PR referencing spec sections (e.g. `§5.2`).
- Never push to `main`; PRs only.
- Conventional Commits; branch names `KEY-123-short-description`.
- CI gates: format, lint, strict type check, unit/integration/E2E tests with coverage threshold, accessibility tests, dependency audit, secret scanning, SAST, build.
- Before adding a dependency, verify it exists, is maintained and widely used.
- No access to production secrets or data; use test data.
- The project is open source under MIT ([`docs/spec/16-open-source.md`](docs/spec/16-open-source.md)). Every commit needs a DCO `Signed-off-by` line. Never add conditions to the license text and never add prompts asking for donations in the application, installer or scripts.

## Commands

<!-- Fill in when the repository is scaffolded: install, dev, build, test, lint, typecheck, migrate, storybook. Keep in sync with README.md (Rule 5). -->
