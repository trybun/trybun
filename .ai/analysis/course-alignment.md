# Course alignment – AI Tech Leaders

This analysis compares Trybun's delivery process and agent harness with the practices taught in the **AI Tech Leaders** course (prework, 25 lessons, extras). It goes through the course step by step. For each practice it records what Trybun has, the evidence, and a rating. Each gap gets a decision.

The course is the reference here, not the final authority. Every gap that is accepted is researched against established practice before it becomes an issue, and project rules win over the course ([`AGENTS.md`](../../AGENTS.md), [`SDLC.md`](../../SDLC.md), [`docs/spec/`](../../docs/spec/README.md)).

Product scope stays in the [implementation plan](../../docs/plan/implementation-plan.md). This file covers the process and the harness around the agents, and its accepted gaps become GitHub issues of their own.

## Method

Every step works in this order:

1. **Course practices.** Read the knowledge-base leaves of the step (and the lesson source when a leaf is not enough). List the practices as checkable statements.
2. **Evidence.** Check each statement in Trybun and give the file, workflow or setting that shows it.
3. **Rating.** Rate each statement on the scale below.
4. **Gap proposal.** For each gap, research established practice (not only the course) and propose a solution with the options considered.
5. **Decision.** The maintainer decides. An accepted gap becomes an issue that meets the Definition of Ready of `SDLC.md`; an "intentionally different" rating records the reason here.

### Rating scale

| Rating | Meaning |
|---|---|
| **Missing** | The practice is absent. |
| **Partial** | Some of it is present, or it is present but not enforced. |
| **Full** | Present and enforced or used as the course describes. |
| **Beyond** | Present and stricter or broader than the course. |
| **Different** | Deliberately done another way. The reason is recorded. |
| **N/A** | Does not apply to Trybun. The reason is recorded. |

## Steps

| # | Step | Course part | Status |
|---|---|---|---|
| 0 | Baseline map | all | done |
| 1 | Repository, stack, standards, AGENTS.md, `.ai/`, CI safety net | PW, L01–L02 | open |
| 2 | Skills, `om-setup-agent-pipeline`, labels, issue → PR → review flow | L03, extras: skills | open |
| 3 | Discovery, product brief, synthetic users, backlog | L04, extras: discovery | open |
| 4 | Specification for agents (spec, delta, grill-me, review by another model) | L05, L07, L25 | open |
| 5 | Design system and prototype (tokens, Storybook, a11y in CI) | L06–L07 | open |
| 6 | Interactive coding (phases, subagent per task, tracking) | L08 | open |
| 7 | Security of AI tools and of the product | L09, L16 | open |
| 8 | Context engineering (JIT router, `check:agents`, measuring context) | L10 | open |
| 9 | Autonomy and parallel work (feedback loop, `om-auto-*`, worktrees, Cezar, WIP) | L11, L13 | open |
| 10 | Tests, fixes, QA (E2E, RED/GREEN, static analysis, `qa-*`) | L12, L14, L18 | open |
| 11 | Review and acceptance (deterministic gates, branch protection, multi-model review) | L17, L21 | open |
| 12 | Releases and deployment (triage, changelog, compatibility, preview per PR) | L22, L24 | open |
| 13 | Maintenance and retrospective (knowledge audit, weekly maintenance, production errors) | L15, L25 | open |
| 14 | Company AI SDLC and skills hardening; then team adoption and local models if still needed | L23, extras: skills hardening; L19, L20 | open |

## Step 0 – Baseline map

The baseline map was taken on 2026-11-24 at `main` `7e16ee32`. At that point the implementation plan had Stage 0 done (22 of 22 tasks) and 13 Stage 1 tasks done, with 56 tasks open across Stages 1–9. GitHub had 147 issues (19 open) and 289 merged pull requests.

The "first look" column comes from a listing of files and settings, not from reading them. It is a pointer for the step, not a rating; each step verifies it.

| Course topic | Step | Evidence in Trybun | First look |
|---|---|---|---|
| Stack, monorepo, standards | 1 | pnpm + Turborepo monorepo (`apps/web`, `apps/server`, `packages/*`), ADRs 0002–0003, [`docs/spec/17-conventions.md`](../../docs/spec/17-conventions.md), [`18-code-patterns.md`](../../docs/spec/18-code-patterns.md) | present |
| AGENTS.md and `.ai/` | 1, 8 | [`AGENTS.md`](../../AGENTS.md) (rules, DoD, commands), `apps/web/AGENTS.md`, `CLAUDE.md`, `.ai/` (specs, memory, skills, runs, qa, trackers, scripts) | present |
| CI safety net | 1, 11 | [`ci.yml`](../../.github/workflows/ci.yml): format/lint, type check, tests + coverage, build, E2E + Lighthouse, spec consistency, vulnerability audit, dependency review; `codeql.yml`, `image-scan.yml`, `advisory-audit.yml`, `commitlint.yml`; Git hooks in `.githooks/` | present, broad |
| Skills catalogue and overrides | 2 | 60 `om-*` skills from `skills-lock.json`, project skills `ui-component` and `verify-change`, override rules in [`.ai/skills/README.md`](../skills/README.md) | present |
| SDLC configuration and labels | 2 | [`agentic.config.json`](../agentic.config.json) (labels, QA gate, autofix, automerge), [`SDLC.md`](../../SDLC.md) (label state machine, claim protocol, DoR), `.github/labels.yml` | present |
| Discovery, product brief, synthetic users | 3 | `discovery.enabled: true` in `agentic.config.json`; market benchmark in `.ai/specs/research/`; no product brief or persona files found by name | possibly missing |
| Backlog → issues | 3 | issue templates in `.github/ISSUE_TEMPLATE/`; backlog lives in the implementation plan | to check |
| Specification for agents | 4 | system spec `docs/spec/` (19 chapters), change specs in `.ai/specs/` (template, lifecycle, 37 implemented), spec-before-code rule in `AGENTS.md` | present |
| Design system and prototype | 5 | `packages/ui` (shadcn/ui, Tailwind 4 tokens from `docs/brand/`), Storybook with story tests, axe in E2E; no prototype files found | partial? |
| Interactive coding and tracking | 6 | run logs in `.ai/runs/` (50 files), `.ai/trackers/github.md` | to check |
| Security of AI tools | 7 | `.claude/settings.json` with a narrow allow-list and no hooks; ADRs 0001, 0005, 0011 (agent identity, GitHub App, workflow approval) | partial? |
| Product security | 7 | [`docs/spec/13-non-functional.md`](../../docs/spec/13-non-functional.md), [`SECURITY.md`](../../SECURITY.md), CodeQL, Trivy, audit, `.ai/memory/security.md`, `risk-high` areas in `CODE_REVIEW.md` | present; threat model to check |
| Context engineering | 8 | AGENTS.md links to the spec sections; `lint:spec` checks § references; no `check:agents` script found | partial? |
| Autonomy, worktrees, Cezar | 9 | `.ai/cezar/` (automations, dispatch, worktrees), `om-auto-*` skills, autofix queue in `SDLC.md` | present |
| Tests and QA | 10 | Vitest unit/component/integration (Testcontainers), Playwright E2E on three viewports, coverage thresholds, QA test environment `.ai/scripts/test-env-*.sh`, `.ai/qa/knowledge-base/` | present, broad |
| Review and acceptance | 11 | [`CODE_REVIEW.md`](../../CODE_REVIEW.md), `CODEOWNERS`, PR template, rulesets "Protect main" and "Protect release tag" (active) | present; multi-model to check |
| Releases | 12 | release-please (`release-please-config*.json`, maintenance branches), `release.yml`, `CHANGELOG.md`, [`BACKWARD_COMPATIBILITY.md`](../../BACKWARD_COMPATIBILITY.md), ADR 0006 | present |
| Deployment | 12 | install/update/restore/backup in `deploy/trybun`, `compose.yaml`, `docker/`; no preview environment per PR found | partial? |
| Maintenance and production feedback | 13 | `.ai/memory/` (18 topics), dependabot, daily advisory audit; no production error loop found (no production yet) | to check |
| Retrospective | 13 | `om-pipeline-retro` skill installed; no retro records found | to check |
| Company AI SDLC, skills hardening | 14 | `om-judge-agent-session`, `om-evolve-harness`, `om-create-skill` installed | to check |
