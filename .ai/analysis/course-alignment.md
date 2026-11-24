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
| 1 | Repository, stack, standards, AGENTS.md, `.ai/`, CI safety net | PW, L01–L02 | done; issues #487–#494 |
| 2 | Skills, `om-setup-agent-pipeline`, labels, issue → PR → review flow | L03, extras: skills | done; issues #498, #499 |
| 3 | Discovery, product brief, synthetic users, backlog | L04, extras: discovery | open |
| 4 | Specification for agents (spec, delta, grill-me, review by another model) | L05, L07, L25 | open |
| 5 | Design system and prototype (tokens, Storybook, a11y in CI) | L06–L07 | open |
| 6 | Interactive coding (phases, subagent per task, tracking) | L08 | open |
| 7 | Security of AI tools and of the product | L09, L16 | open |
| 8 | Context engineering (JIT router, `check:agents`, measuring context) | L10 | open |
| 9 | Autonomy and parallel work (feedback loop, `om-auto-*`, worktrees, Cezar, WIP) | L11, L13 | open |
| 10 | Tests, fixes, QA (E2E, RED/GREEN, static analysis, `qa-*`) | L12, L14, L18 | open |
| 11 | Review and acceptance (deterministic gates, branch protection, multi-model review) | L17, L21 | open |
| 12 | CI workflows: necessity, correctness and efficiency of every workflow, action, hook and Dependabot setting; flaky tests | project step, not a lesson | open |
| 13 | Releases and deployment (triage, changelog, compatibility, preview per PR) | L22, L24 | open |
| 14 | Maintenance and retrospective (knowledge audit, weekly maintenance, production errors) | L15, L25 | open |
| 15 | Company AI SDLC and skills hardening; then team adoption and local models if still needed | L23, extras: skills hardening; L19, L20 | open |

Step 12 has no lesson of its own. The course rates whether the safety net and the gates exist (L02, L14, L17), not whether each workflow is needed and well written, so the maintainer added it on 2026-11-24. It follows steps 10 and 11, which rate tests and gates from the course side, and comes before the release step, which covers `release.yml`. Sources to research: the GitHub Actions documentation (security hardening, `permissions`), the tools built for such audits (actionlint, zizmor, OpenSSF Scorecard), and established practice for flaky tests. The flaky component test found during step 1 was filed on its own (#496) because it failed on `main`, and fixed in #497.

## Step 0 – Baseline map

The baseline map was taken on 2026-11-24 at `main` `7e16ee32`. At that point the implementation plan had Stage 0 done (22 of 22 tasks) and 13 Stage 1 tasks done, with 56 tasks open across Stages 1–9. GitHub had 147 issues (19 open) and 289 merged pull requests.

The "first look" column comes from a listing of files and settings, not from reading them. It is a pointer for the step, not a rating; each step verifies it.

| Course topic | Step | Evidence in Trybun | First look |
|---|---|---|---|
| Stack, monorepo, standards | 1 | pnpm + Turborepo monorepo (`apps/web`, `apps/server`, `packages/*`), ADRs 0002–0003, [`docs/spec/17-conventions.md`](../../docs/spec/17-conventions.md), [`18-code-patterns.md`](../../docs/spec/18-code-patterns.md) | present |
| AGENTS.md and `.ai/` | 1, 8 | [`AGENTS.md`](../../AGENTS.md) (rules, DoD, commands), `apps/web/AGENTS.md`, `CLAUDE.md`, `.ai/` (specs, memory, skills, runs, qa, trackers, scripts) | present |
| CI safety net | 1, 11, 12 | [`ci.yml`](../../.github/workflows/ci.yml): format/lint, type check, tests + coverage, build, E2E + Lighthouse, spec consistency, vulnerability audit, dependency review; `codeql.yml`, `image-scan.yml`, `advisory-audit.yml`, `commitlint.yml`; Git hooks in `.githooks/` | present, broad |
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
| Releases | 13 | release-please (`release-please-config*.json`, maintenance branches), `release.yml`, `CHANGELOG.md`, [`BACKWARD_COMPATIBILITY.md`](../../BACKWARD_COMPATIBILITY.md), ADR 0006 | present |
| Deployment | 13 | install/update/restore/backup in `deploy/trybun`, `compose.yaml`, `docker/`; no preview environment per PR found | partial? |
| Maintenance and production feedback | 14 | `.ai/memory/` (18 topics), dependabot, daily advisory audit; no production error loop found (no production yet) | to check |
| Retrospective | 14 | `om-pipeline-retro` skill installed; no retro records found | to check |
| Company AI SDLC, skills hardening | 15 | `om-judge-agent-session`, `om-evolve-harness`, `om-create-skill` installed | to check |

## Step 1 – Repository, stack, standards, AGENTS.md, `.ai/`, CI safety net

Course sources: knowledge-base leaves of prework (team work on GitHub, Open Mercato), L01 (tools, basic terms, checklist) and all eleven leaves of L02. Checked on 2026-11-24 at `main` `7e16ee32`.

### Ratings

| # | Course practice | Evidence in Trybun | Rating |
|---|---|---|---|
| 1.1 | GitHub is the single source of truth: tasks in issues, code and specifications in pull requests, CI on GitHub (L01, PW) | Issues, pull requests and Actions; specifications in `docs/spec/` and `.ai/specs/`; `SDLC.md` | Full |
| 1.2 | The stack is chosen for the project, popular, and its reasons are recorded with the project (L02 "Wybór stacku") | [ADR 0002](../../docs/adr/0002-technology-stack.md), [§14](../../docs/spec/14-architecture.md) | Full |
| 1.3 | `AGENTS.md` is the entry point and `CLAUDE.md` imports it (L02) | `CLAUDE.md` is `@AGENTS.md`; `AGENTS.md` starts with the session start steps | Full |
| 1.4 | Nested `AGENTS.md` files hold the rules of a folder and load only there (L02) | Only `apps/web/AGENTS.md`, which holds the block written by `next dev`; no `AGENTS.md` in `apps/server` or the packages; the rules per area live in `docs/spec/` and are reached through links | Rated in step 8 (context routing, L10) |
| 1.5 | Knowledge lives as Markdown in the repository, not in an external wiki (L02) | `docs/`, `.ai/`, `SDLC.md`, `CODE_REVIEW.md`; Claude Code auto memory is off (`.claude/settings.json`) | Beyond |
| 1.6 | `.ai/specs/` with `YYYY-MM-DD-slug.md`, `implemented/` and `archive/` (L02 prompt 1) | `.ai/specs/` with `README.md`, `TEMPLATE.md`, `implemented/` (37), `archive/`, `research/` | Full |
| 1.7 | `.ai/runs/`: one log per AI task, a fixed header (goals, specification link, status), an entry of 2–5 lines in every commit of the task, a handoff after an interruption (L02 prompt 1) | 50 execution plans in `.ai/runs/` written by the `om-auto-*` skills (goal, scope, phases, a progress list with commit SHAs). No project rule says when a run log is written: bug fixes and changes made outside those skills have none (e.g. #477, #467, #444) | Partial – decided in step 6 |
| 1.8 | The structure of `.ai/` is described in `AGENTS.md`, with instructions that enforce its use (L02 prompt 1) | The "Where things are" table lists `.ai/specs/`, `.ai/memory/`, `.ai/skills/`, the pipeline configuration and `.ai/cezar/`, but not `.ai/runs/`, `.ai/qa/`, `.ai/scripts/` or `.ai/analysis/` | Partial – #494 |
| 1.9 | Lessons recorded by the agent as long-term memory (`lessons.md`) (L02 prompt 1) | `.ai/memory/` with an index and 18 topic files; Rule 7; session start step 1; "Learn from corrections" | Beyond |
| 1.10 | Working rules in `AGENTS.md`: plan complex tasks, verify changes, record lessons after corrections (L02 prompt 2) | "Plan first, re-plan when it goes wrong", "Self-review before the PR", "Learn from corrections", the Definition of Done, the `verify-change` skill | Full |
| 1.11 | Monorepo with packages that agents can read directly (L02) | pnpm workspaces + Turborepo: `apps/web`, `apps/server`, `packages/ui`, `contracts`, `i18n`, `markdown`, `tsconfig`, `eslint-config` ([ADR 0003](../../docs/adr/0003-module-system-and-server-bundling.md)) | Full |
| 1.12 | Engineering standards: naming conventions, a reusable API and UI layer, a procedure for adding a domain concept, a reference implementation (L02 "Engineering standards – architektura") | [§17 Conventions](../../docs/spec/17-conventions.md), [§18 Code patterns](../../docs/spec/18-code-patterns.md) with reference implementations (§18.9), Rule 12, the "Never" list of `AGENTS.md`, lint rules for names and imports (`packages/eslint-config/src/base.js`) | Beyond |
| 1.13 | Principles, a security minimum, code quality rules and a review checklist (L02 "Engineering standards – bezpieczeństwo i review") | [`CODE_REVIEW.md`](../../CODE_REVIEW.md) (priorities, checks per area, severity, `risk-high` areas), [§13](../../docs/spec/13-non-functional.md); the security content is rated in step 7 | Full |
| 1.14 | Local start: clone, Compose, `.env.example`, migrations, `dev`; the README is the test of the instructions (L02 "Uruchomienie lokalne") | `pnpm dev` starts Compose, waits for Keycloak, migrates, seeds and starts the apps; `.env.example`; README "Getting started" and "Signing in locally" | Beyond |
| 1.15 | CI on every pull request: build, lint, unit tests, integration tests on an ephemeral database (Testcontainers), browser tests of the running application (L02 "Safety net") | [`ci.yml`](../../.github/workflows/ci.yml): format and lint, type check, tests and coverage (Testcontainers), build, E2E and Lighthouse (Playwright, three viewports, axe), specification consistency, vulnerability audit, dependency review; plus CodeQL, commit messages, DCO | Beyond |
| 1.16 | CI artifacts, e.g. screenshots of the tested screens (L02 "Podsumowanie") | `coverage` and `playwright-report` artifacts in `ci.yml` | Full |
| 1.17 | No merge with failing required checks; the checks are enforced by branch protection (L02 "Safety net", GitHub Free pitfall) | Ruleset "Protect main" (active, no bypass actors) requires the 13 checks of CI, CodeQL, commit messages and DCO; squash only; the repository is public, so the ruleset is enforced on GitHub Free | Full |
| 1.18 | Coverage: every new feature has 100 % unit test coverage (L02 "Safety net" prompt) | [§2.14](../../docs/spec/02-agent-rules.md) thresholds on the combined unit, component and integration result: lines ≥ 80 % and branches ≥ 75 % for domain modules, lines ≥ 70 % elsewhere; a closed list of excluded files. No reason for these values is recorded, and there is no gate on the coverage of the changed code | Different, reason not recorded – #493 |
| 1.19 | Lint also detects deprecated APIs and old framework versions (L02 "Safety net") | `@typescript-eslint/no-deprecated` is off: `base.js` uses `recommendedTypeChecked`, which does not contain it (`strictTypeChecked` does). A test run with the rule on (see below) reports 68 uses of deprecated APIs | Missing – #487–#492 |
| 1.20 | Each team member has their own GitHub account and access as a collaborator (PW) | One maintainer (`CODEOWNERS`: `* @dtk7c2`); contributors use their own accounts ([§16.4](../../docs/spec/16-open-source.md)); the project's agents use the maintainer's ([ADR 0011](../../docs/adr/0011-maintainer-account-and-workflow-approval.md)) | Full |
| 1.21 | Model per task: Sonnet for mechanical work, Opus for research (L02 "Tryb i model") | No model guidance in `AGENTS.md`; `engine.executorTier: "standard"` in `agentic.config.json` | Rated in step 11 (multi-model, L21) |
| 1.22 | Sandbox or local environment, WSL2 on Windows (L01, PW) | Linux machine of the agents; Docker is required for the infrastructure and Testcontainers | N/A – the Sandbox path of the course is not used |

### Test: deprecated APIs in the code (1.19)

On 2026-11-24 each workspace with TypeScript sources was linted with its own configuration plus `@typescript-eslint/no-deprecated: error` for `*.ts` and `*.tsx` (temporary configuration file, removed afterwards).

| Workspace | Hits | Deprecated API (count) | Rule time |
|---|---|---|---|
| `apps/web` | 61 | TanStack Query `prefetchInfiniteQuery` (15), `prefetchQuery` (12), `fetchQuery` (12), `fetchInfiniteQuery` (12), `ensureQueryData` (1) – "will be removed in the next major version", replaced by `queryClient.query()` / `infiniteQuery()`; next-intl `requestLocale` (8) – replaced by `next/root-params`; `BeforeUnloadEvent.returnValue` (1) | 5.0 s (11.4 %) |
| `packages/ui` | 6 | `document.execCommand` (6) in `markdown-editor.tsx` and its stories | 1.8 s (16.8 %) |
| `apps/server` | 1 | CASL `Subjects` type – "use union of `T & ForcedSubject<TName>` directly" | 0.7 s (4.3 %) |
| `packages/contracts`, `i18n`, `markdown` | 0 | – | < 0.1 s each |

The first attempt used `--rule` on the command line. It failed on the untyped files (configuration files lint with `disableTypeChecked`) and reported nothing, so the rule has to be added in the typed block of the configuration. The rule cannot be switched on alone: the "Never" list forbids suppressions, so every hit has to be migrated first. The TanStack Query calls follow the data-loading pattern of [§18.5](../../docs/spec/18-code-patterns.md), so their migration changes a code pattern (Rule 12: ADR and migration of the existing code).

### Gap proposals

**1.19 Deprecated APIs – accepted: #487–#492.** The course practice is backed by other sources: typescript-eslint names `no-deprecated` as the successor of `eslint-plugin-deprecation` and turns it on in `strict-type-checked`.

Options considered:

- **(a) `@typescript-eslint/no-deprecated` in the typed block of `base.js` – recommended.** It uses the type information that typed linting already loads, and it costs 1–17 % of the lint time measured above.
- **(b) Switching to `strictTypeChecked`.** This would also turn on many other rules, which is a broader change than the gap.
- **(c) `import-x/no-deprecated`.** It needs no type information, but it sees only JSDoc `@deprecated` on imports. It misses members such as `queryClient.prefetchQuery` and DOM APIs.
- **(d) `eslint-plugin-deprecation`.** The predecessor that (a) replaced.

The 68 current hits come before the rule. The proposal is one issue per migration, then one that turns the rule on:

1. #487: TanStack Query calls → `query()` / `infiniteQuery()`, with an update of §18.5 and an ADR.
2. #488: next-intl `requestLocale` in the i18n tests (`next/root-params` may not apply without a locale in the URL).
3. #489: `execCommand` in the Markdown editor. Its replacement still needs research: there is no standard successor for editing commands, and the `allow` option with a recorded reason is a possible outcome.
4. #490: `returnValue` in `use-unsaved-changes.ts`. MDN still documents it as the legacy way to trigger the prompt, so `allow` with a reason is likely.
5. #491: CASL `Subjects`.
6. #492: turn the rule on in `base.js`.

**1.8 `.ai/` structure in `AGENTS.md` – accepted: #494.** Add `.ai/runs/`, `.ai/qa/`, `.ai/scripts/` and `.ai/analysis/` to the "Where things are" table, with one line each. This is a correction of the existing table, so no other option applies.

**1.18 Coverage – accepted (b): #493.**

Sources:

- **Google, "Code Coverage at Google"** (Ivanković, Petrović, Just, Fraser; ESEC/FSE 2019; read in full). The paper is built on five years of data and 512 survey answers. Its key sentence: "A key aspect of making coverage information actionable is to apply it at the level of changesets and code review." Google measures **project coverage** daily and **changelist coverage** (the lines of the change) on every change, and shows the latter in code review. "Google does not enforce any code coverage thresholds across the entire codebase"; projects opt into voluntary levels:
  - Level 3: project ≥ 60 %, changelist ≥ 70 %.
  - Level 4: project ≥ 75 %, changelist ≥ 80 %.
  - Level 5: project ≥ 90 %, changelist ≥ 90 %.

  No level asks for 100 %.
- **SonarQube "Sonar way"** (vendor docs, 10.x and Cloud): the default quality gate requires ≥ 80 % coverage **on new code** and advises against conditions on overall code ("Clean as You Code").
- **Codecov** (vendor docs): a `patch` status measures only the lines changed in the pull request, next to a `project` status for overall coverage.
- **Martin Fowler, "TestCoverage"** (2012): "I would be suspicious of anything like 100%"; coverage is "a useful tool for finding untested parts of a codebase", of "little use as a numeric statement of how good your tests are"; thoughtful testing reaches "the upper 80s or 90s". Codecov and SEI CMU make the same argument against 100 % (search summaries only).
- **Criticism of changed-lines gates** (issues of individual projects, local experience only):
  - lines that are hard to reach fail the gate;
  - the gate rewards tests that only execute lines;
  - code the coverage tool does not instrument passes by vacuum;
  - a gate that is not a required check, or is skipped, does not block (HashiCorp `consul-k8s` #5839).

Options:

- **(b) Recommended: a required gate on the coverage of the changed lines, ≥ 80 % of lines, next to the current thresholds, with the reason of all values recorded in §2.14.** The project thresholds stay: lines ≥ 80 % and branches ≥ 75 % for domain modules sit at Google's Level 4, and ≥ 70 % elsewhere sits between Levels 3 and 4. The changed-lines gate adds what the Google paper names as the key to actionable coverage, at the value of Level 4 and of Sonar way.

  The criticism is answered as follows:
  - 80 % leaves room for lines that cannot be reached;
  - the closed list of excluded files of §2.14 already defines what is measured, so the gate must use the same list;
  - the gate becomes a required check of "Protect main", and a skip must fail it rather than pass it;
  - test quality beyond executed lines (e.g. mutation testing) belongs to step 10.

  This is a change of §2.14, so it starts with a change specification approved by the maintainer.
- **(a) Rejected: keep the thresholds and only record their reason.** It leaves the coverage of each change invisible at review, which the Google paper names as the point where coverage becomes actionable.
- **(c) Rejected: 100 % for new code, as the course says.** No source supports 100 % as a gate: Google's highest level is 90 %, and Fowler, Codecov and SEI argue against it. At 100 %, the criticism of hard-to-reach lines and of tests that only execute lines weighs most.

The tool is chosen in the change specification, with a real test on Trybun's coverage output. Candidates:

- **`diff-cover`**: Apache-2.0, reads LCov, runs locally against `origin/main`, `--fail-under`. The README does not say whether it needs full Git history.
- **A project script** like the existing `scripts/check-*.js`.
- **Codecov `patch`**: rejected in advance. It sends coverage to an external service, its uploader was compromised in 2021 (Codecov post-mortem, CISA alert), and it adds a third party to CI next to the supply-chain hardening of [§2.10](../../docs/spec/02-agent-rules.md) (Rule 10).

The coverage configuration then needs an `lcov` reporter (today: `text-summary`, `json-summary`, `html`). A first test of `diff-cover` on 2026-11-24 did not run: installing it from PyPI on the agents' machine was refused by the session's permission check.

**1.7 Run logs – research not finished.** Trybun's execution plans follow the format of the `om-auto-*` skills, which is newer than the run log of L02. Before a recommendation, still open:

- what the course says about run logs in L08 and L11 (steps 6 and 9);
- whether a handoff for tasks outside these skills is needed at all, given the issue and pull request history.

This decision moves to step 6.

## Step 2 – Skills, `om-setup-agent-pipeline`, labels, issue → PR → review

Course sources: the ten knowledge-base leaves of L03, extras "Opis działania skilli" (about the catalogue, setup and configuration), extras "Brownfield: skille i SDLC" and the FAQ "Setup projektu i skille". Checked on 2026-11-24 at `main` `37985c9f`.

### Ratings

| # | Course practice | Evidence in Trybun | Rating |
|---|---|---|---|
| 2.1 | A repeated flow becomes a skill that loads only when needed, next to `AGENTS.md` (L03 "Czym są skille") | Project skills `ui-component` and `verify-change` in `.ai/skills/`; `AGENTS.md` "Repeated work → propose a skill in `.ai/skills/`" | Full |
| 2.2 | The catalogue is installed per project and linked for Claude Code and Codex (L03 "Instalacja") | `skills-lock.json` (60 `om-*` skills), `.agents/skills/` and links in `.claude/skills/`; install and update commands in [`.ai/skills/README.md`](../skills/README.md) | Full |
| 2.3 | The whole team works with the same version of the skills (extras "Brownfield": keep them in the repository) | The lock records a `computedHash` per skill. A test on 2026-11-24 recomputed it with the algorithm of the skills CLI README for all 60 installed skills: 60 match. The lock has **no `commit` field**: the CLI pins entries to a commit only since v1.9.0 (2026-11-16, vercel-labs/skills #2735), after the last update of the skills (#306, 2026-11-12). A restore elsewhere (`npx skills experimental_install`, another agent's machine) then fetches the latest upstream, not the version recorded here. Upstream has 12 commits since 2026-11-12, including changes of `UPGRADE_NOTES.md` | Partial – #498 |
| 2.4 | `om-setup-agent-pipeline` writes `.ai/agentic.config.json`, `SDLC.md`, `CODE_REVIEW.md` and `BACKWARD_COMPATIBILITY.md`, which are reviewed and committed (L03) | All four are in the repository; `SDLC.md` and the configuration change through reviewed PRs (#336, #340, #395) | Full |
| 2.5 | After an update of the skills, the configuration is reconciled with their upgrade notes (extras "Setup": `om-apply-upgrade-notes`) | #306 applied the upgrade notes (tracker and browser descriptors replaced with the shipped copies) | Full |
| 2.6 | At least one catalogue skill is adapted by an override of the same name in `.ai/skills/` (L03 homework) | No override exists. The mechanism is documented ([`.ai/skills/README.md`](../skills/README.md), "Extending an `om-*` skill"). Trybun adapts the catalogue through rules every skill reads: `AGENTS.md` (e.g. the feature route of `om-auto-fix-issue` stops at the open specification PR), `SDLC.md` and `agentic.config.json`. No skill-specific rule was found that these cannot hold | Different – one place for the rules that apply to every skill; an override is added when a rule concerns one skill only |
| 2.7 | GitHub labels carry the state of issues and PRs (`review`, `changes-requested`, `merge-queue`, …) (L03 "Katalog") | Labels in `agentic.config.json`, `SDLC.md` "Label state machine"; the 28 pipeline PRs among the last 30 merged all carry category, pipeline, QA, priority and risk labels. The three PRs opened by hand in this analysis (#486, #495, #497) carry none or only category, priority and risk: they skipped `om-open-pr` and `om-check-and-commit`, which normalize the labels (`SDLC.md` "PR"). Adding `review` and `skip-qa` to #495 afterwards was refused by the session's permission check, rightly so for `skip-qa`, which waives the QA gate | Full for the pipeline; the analysis PRs need the maintainer's labels |
| 2.8 | The skills claim work with a lock so that agents do not overwrite each other (L03 "Katalog") | Claim protocol of `SDLC.md` with atomic `refs/om-locks/*` (`.ai/trackers/github.md`); in use (a live lock on PR #475 on 2026-11-24; #496 was claimed and released with it) | Full |
| 2.9 | `om-prepare-issue` turns a short need into a ready issue with SDLC labels and a risk rating (L03) | Definition of Ready in `SDLC.md`; issues follow its template (e.g. #426) | Full |
| 2.10 | `om-auto-fix-issue` chains verify → root cause → fix → PR → review; a feature goes through a specification first (L03) | `SDLC.md` lifecycle; reviews on the pipeline PRs: 24 of the 28 pipeline PRs among the last 30 merged have one or more reviews; #429, #455, #466 and #478 were merged without one, which step 11 (review and acceptance) checks against `SDLC.md` | Full; merges without a review go to step 11 |
| 2.11 | `om-code-review` reads `CODE_REVIEW.md`, and its rules grow with the project: new contracts, recurring classes of defects (L03 "om-code-review") | `CODE_REVIEW.md` has not changed since 2026-10-26, while 232 commits landed. In November, 7 fix PRs repaired one class of defect – a client query without its loading, error or refused (`429`) state (#429, #432, #448, #469, #470, #478, #400) – and `CODE_REVIEW.md` has no check for it | Partial – #499 |
| 2.12 | Interactive skills first; autonomous ones after the rules are agreed with the team (FAQ "Setup") | `SDLC.md` (QA gate, claim protocol, specification before implementation), ADR 0011 | Full |
| 2.13 | Cezar coordinates parallel agents (L03 "Cezar") | `.ai/cezar/` | Rated in step 9 |

### Gap proposals

**2.3 Skills pinned to a commit – accepted (a): #498.**

- **Source:** the skills CLI README, the primary documentation of the tool Trybun uses. It describes the `commit` of a lock entry ("`skills install` … fetches that commit, not the latest commit on `ref`, so a restore still matches `computedHash`") and `install --frozen-lockfile`, which fails when the files differ from the lock. This is the same pattern as a package lockfile with a frozen install (`pnpm install --frozen-lockfile`), which Trybun already uses for its dependencies.

**Options:**

- **(a) Recommended:** update the skills with skills CLI ≥ 1.9.0. `skills update` adds `commit` to every entry. Apply the upgrade notes (`om-apply-upgrade-notes`) and change the restore command in `.ai/skills/README.md` to the frozen install.
- **(b) Rejected:** commit `.agents/skills/` (the brownfield advice). It adds about 60 copied skills to every diff and review, while (a) gives the same single version with a lock the tool checks.
- **(c) Rejected:** keep the lock without commits. A restore silently gets another version.

Whether Cezar provisions the locked version into its tasks is checked in step 9.

**2.11 `CODE_REVIEW.md` follows the recurring defects – accepted (a): #499.**

- **Sources** (practitioners' guidance; no controlled study found):
  - derive checklist items from the defects that recur;
  - keep each item specific and answerable yes or no;
  - remove items that no longer apply, because a checklist that only grows goes unused.

**Options:**

- **(a) Recommended:** add one item to the "Web BFF" or "UI" checks. Every client query shows its loading state, its error and the refused-read notice (`QueryErrorAlert`, `RateLimitedAlert`, [§18.5](../../docs/spec/18-code-patterns.md)), with a component test of the failed read.
- **(b) Rejected:** no item, relying on §18.5 alone. Seven fix PRs in one month show that the rule in the specification was not enough at review.

How `CODE_REVIEW.md` keeps following the defects over time (for example from `om-pipeline-retro`) is rated in step 14 (retrospective).
