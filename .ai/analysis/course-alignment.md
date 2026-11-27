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
| 3 | Discovery, product brief, synthetic users, backlog | L04, extras: discovery | done; issue #501 |
| 4 | Specification for agents (spec, delta, grill-me, review by another model) | L05, L07, L25 | done; issues #524–#526 |
| 5 | Design system and prototype (tokens, Storybook, a11y in CI) | L06–L07 | done; issues #530–#534 |
| 6 | Interactive coding (phases, subagent per task, tracking) | L08 | done; issues #537, #538 |
| 7 | Security of AI tools and of the product | L09, L16 | done; issue #540 |
| 8 | Context engineering (JIT router, `check:agents`, measuring context) | L10 | done; issue #542 |
| 9 | Autonomy and parallel work (feedback loop, `om-auto-*`, worktrees, Cezar, WIP) | L11, L13 | done; issue #544 |
| 10 | Tests, fixes, QA (E2E, RED/GREEN, static analysis, `qa-*`) | L12, L14, L18 | done; no new issue (#499, #493) |
| 11 | Review and acceptance (deterministic gates, branch protection, multi-model review) | L17, L21 | done; issue #549, #537 extended |
| 12 | CI workflows: necessity, correctness and efficiency of every workflow, action, hook and Dependabot setting; flaky tests | project step, not a lesson | done; issues #552–#555 |
| 13 | Releases and deployment (triage, changelog, compatibility, preview per PR) | L22, L24 | done; no new issue |
| 14 | Maintenance and retrospective (knowledge audit, weekly maintenance, production errors) | L15, L25 | open |
| 15 | Company AI SDLC and skills hardening; then team adoption and local models if still needed | L23, extras: skills hardening; L19, L20 | open |

Step 12 has no lesson of its own. The course rates whether the safety net and the gates exist (L02, L14, L17), not whether each workflow is needed and well written, so the maintainer added it on 2026-11-24. It follows steps 10 and 11, which rate tests and gates from the course side, and comes before the release step, which covers `release.yml`. Sources to research: the GitHub Actions documentation (security hardening, `permissions`), the tools built for such audits (actionlint, zizmor, OpenSSF Scorecard), and established practice for flaky tests. The flaky component test found during step 1 was filed on its own (#496) because it failed on `main`, and fixed in #497.

### Carried forward

Questions found in one step that belong to a later one. Each step reads its rows before it rates, and the final review pass checks that none is left open.

| Step | Question | Found in |
|---|---|---|
| before `1.0.0` | #562: a threat model (`docs/security/threat-model.md`), and with it the decision on DAST and an agentic security review (7.9–7.15); checked in step 13, it stays a trigger of the release | step 7 |
| 14 | After #525 and #537 have results: a reviewer of another model family for code PRs, the model per role (1.21), cheaper models for mechanical steps, and the peak context of the fix-issue runs measured again (above 300k, a subagent per step of `om-auto-fix-issue`) (6.4, 8.12, 9.9, 11.8–11.10) | steps 1, 6, 8, 9, 11 |
| 14 | When the product brief is refreshed (3.4, #501); how `CODE_REVIEW.md` keeps following the defects (2.11, #499); retrospectives | steps 2, 3 |
| 15 | The analysis commits use the scope `agents`, as the closed scope list of §2.14 has none for `.ai/analysis/`; whether one is needed | step 0 |

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

## Step 3 – Discovery, product brief, synthetic users, backlog

Course sources: the eight method leaves of L04 (overview, business case and workshop, `om-setup-discovery-pipeline`, `om-discover`, critical reading of the brief, synthetic users in practice, `om-backlog`, state and checklist) and the index of extras "Discovery". Checked on 2026-11-24 at `main` `a82ccf8b`.

### Ratings

| # | Course practice | Evidence in Trybun | Rating |
|---|---|---|---|
| 3.1 | A business case states what, for whom, what benefit and on what belief; the vision and the scope of the first release are written apart (L04 step 1) | [§1.1](../../docs/spec/01-overview.md) says what the system does and for whom (team, end users, integrations); the implementation plan separates the MVP (Stages 0–1) from later stages and unscheduled ideas. The benefit and the evidence that the problem is worth solving are not written down | Partial – part of 3.4 |
| 3.2 | Discovery material lives in `.ai/specs/research/` as text, with kind, date, sources and decisions (L04 step 2) | `.ai/specs/research/2026-11-09-market-benchmark.md` is a model of the format: date, kind, method, reliability, unverified items marked `(u)`, purpose. No stakeholder map, interview or other material on the people who have the problem | Partial – part of 3.4 |
| 3.3 | `om-setup-discovery-pipeline` adds the Discovery stage, the product owner role, the Definition of Ready, protected product decisions and routing from `AGENTS.md` (L04) | `SDLC.md`: Discovery stage, product owner role, Definition of Ready, "Product decisions as a protected contract"; `discovery.enabled: true`; `.ai/specs/research/` exists. `AGENTS.md` does not route to a brief or to the research folder | Partial – part of 3.4 |
| 3.4 | A product brief (`.ai/specs/product-brief.md`): problem, users, goals, Now / Later scope, business rules, decisions and non-goals with ids and owners, sources tagged by kind, open questions (L04 step 3) | **None.** Consequences: the product-decision gate of `om-code-review` ("when `product-brief.md` exists, read its Non-goals, Business rules, and Decisions") and the protected contract of `SDLC.md` never run, and the ticket-level Definition of Ready ("who has the need") has no shared source | Missing – #501 |
| 3.5 | The brief is read critically: claims tagged as interview, decision, assumption or synthetic; ambiguous words made precise (L04) | The benchmark separates verified from unverified claims; with no brief there is nothing else to read | Part of 3.4 |
| 3.6 | Synthetic users (optional) probe one key flow of the brief, and their findings stay marked as hypotheses (L04 step 4) | None | Decided after 3.4: the skill needs a brief and its key flows |
| 3.7 | The backlog: epics, stories with acceptance criteria and `Depends on:` in GitHub Issues, mapped in `.ai/specs/backlog.md` (L04 step 5) | The [implementation plan](../../docs/plan/implementation-plan.md) is the backlog: stages as Now and Later, groups for order and parallel work, "Done when" per task, "Ideas – unscheduled" for what is not decided, status in the file ("How to use this plan"). Tasks become work through their change specification and PR, not through issues (18 issues name a plan task, mostly of Stage 0) | Different – one source of the scope, recorded in "How to use this plan" |
| 3.8 | Continuous discovery: the brief is refreshed when new information changes it (`om-discover --refresh`) (L04 overview) | No brief to refresh | Part of 3.4 |
| 3.9 | Each decision records who made it, why and when to revisit it (L04 step 2) | Technical decisions: ADRs (MADR) with context and consequences. Product decisions: accepted by merging a change specification (approver: the maintainer), with no revisit date | Partial – part of 3.4 |

### Gap proposal

**3.4 Product brief – accepted (a): #501.** It also closes 3.1, 3.2, 3.3, 3.5, 3.8 and 3.9.

**Sources.** The course (L04) and the skills that read the brief. Practitioners' guides (Atlassian, Productboard, Aha!; vendor blogs) agree on a chain of documents: the brief answers why – the problem, who has it, the value – the requirements and specification answer what and how, and the brief stays a living document with one owner. They warn that a document that goes stale is worse than none, and that a long brief turns into a requirements document. Teresa Torres ("Continuous Discovery Habits") asks whether there is enough evidence for each assumption and revisits it as evidence comes in. No source prescribes a formal decision log; the `N`/`R`/`D` tables of the brief template come from the course skills.

**Options:**

- **(a) Recommended: a brief from `om-discover --mode existing`**, in an interactive session with the maintainer as product owner, reading `docs/spec/`, the implementation plan and `.ai/specs/research/`.
  - It writes `.ai/specs/product-brief.md`: the why, the people and the evidence; Now (Stages 0–1), Later (Stages 2–9) and not doing; non-goals, business rules and decisions with ids and owners; open questions.
  - It links the specification and the plan instead of repeating them: the brief says why, `docs/spec/` says what, the plan says when.
  - It adds the routing line in `AGENTS.md`.
  - The criticism is answered by keeping the brief short and linked, and by refreshing it with `--refresh`. When it is refreshed is rated in step 14 (maintenance).
- **(b) Rejected: product sections in [§1](../../docs/spec/01-overview.md).** The product-decision gate of `om-code-review` reads only `product-brief.md`, and the specification is the place of what the system does, not of why.
- **(c) Rejected: no brief.** The gate and the protected contract stay inert, and scope decisions keep no recorded basis.

Only the product owner can supply the problem, the people and the decisions (ticket-level tier of the Definition of Ready). The issue is therefore a session of the maintainer with the skill, not autonomous work.

Found during step 3: two flaky E2E checks, filed on their own because they fail on `main` and on unrelated PRs (step 12 rates how flaky tests are handled):

- #502: the accessibility check measured elements while they still animated. Fixed in #504: the check waits for the animations of the page.
- #503: the Lighthouse LCP budget of the empty shell, open.

## Step 4 – Specification for agents (spec, delta, grill-me, review by another model)

Course sources: the seven leaves of L05 (overview, spec as context engineering, user stories, `om-spec-writing` and grill-me, the live spec of issue #7, review by another model, process and state), the L07 leaf "from prototype to specification", the L25 leaf "new requirement = new specification", the L11 leaf on the input of autonomous work, and the extras on the specification skills and on context and specifications. Checked on 2026-11-26 at `main` `60d19f78`, over the 44 change specifications in `.ai/specs/implemented/` and their pull requests.

### Ratings

| # | Course practice | Evidence in Trybun | Rating |
|---|---|---|---|
| 4.1 | The requirement says what, the specification says how in this system; it is written before the code and is the shared reference of author, reviewer and tester (L05) | "Specification before implementation" in [`SDLC.md`](../../SDLC.md) and [`.ai/specs/README.md`](../specs/README.md): the implementation starts only after the specification pull request is merged, and the merge is the maintainer's acceptance. Two layers: the system specification [`docs/spec/`](../../docs/spec/README.md) says what the system is, a change specification says what changes and why | Beyond – the system specification is kept current by every change (Rule 8, [§2.8](../../docs/spec/02-agent-rules.md#28-rule-8--the-specification-is-kept-up-to-date)) |
| 4.2 | The specification is context engineering: scope, place in the architecture, reused components and patterns, changed flows, decisions, risks, edge cases, acceptance criteria, the link to the backlog and a history; not every line of code (L05) | The sections of `om-spec-writing` (TLDR, Problem Statement, Proposed Solution with the alternatives, Architecture, Edge Cases, Risks) and of [`TEMPLATE.md`](../specs/TEMPLATE.md) (Non-goals, Changes to the system specification, Acceptance criteria, Changelog, Related issues). The 44 implemented specifications average 175 lines | Full |
| 4.3 | User stories are the most important part: who, in what situation, wants to do what, sees what result, what the system does on the way and what happens next; without them an agent builds flat CRUD (L05) | None of the 44 specifications has user stories. The TLDR names who needs the change, and three specifications have `WHEN`/`THEN` scenarios in a Delta. Neither the template nor the installed skill asks for stories (the skill's "Phases (stories)" means delivery slices) | Missing – #524 |
| 4.4 | `om-spec-writing` recognises the project, asks the questions an agent must not decide, researches the code, then drafts; open questions stop the design (L05, extras) | `om-spec-writing` and `om-auto-write-spec` are installed; every one of the 44 specifications has "Open questions" or "Resolved assumptions (autonomous defaults)"; an assumption marked `⚠ NEEDS HUMAN CONFIRMATION` keeps the pull request a draft | Full |
| 4.5 | The human reads the specification first, decides what to keep and records the decisions in it (L05, L07) | The maintainer answers the open questions and the autonomous defaults in the session; the answers are written into the specification and posted on the pull request before the merge (e.g. #421, #506) | Full |
| 4.6 | A model other than the author reviews the specification, with a short prompt about contradictions, anti-patterns and over-complexity (L05) | `om-auto-review-pr` reviews every specification pull request in its specification mode, in a fresh context, but with the same model family: all 336 recorded Cezar runs use the `claude` runner. Codex CLI is installed on the maintainer's machine and unused | Missing – #525 |
| 4.7 | `grill-me` interviews the human after the review and surfaces the assumptions nobody wrote down (L05) | Not installed. The closest step is the open-questions gate of `om-spec-writing`, which asks before the design, not after the review | Missing – #526 |
| 4.8 | The delivery is split into phases and steps; each step leaves the application working and the order of the phases follows the dependencies (L05, extras) | "Implementation Plan" in 29 of the 44 specifications; the others are single-step changes. `om-auto-create-pr` runs the plan phase by phase | Full |
| 4.9 | What a prototype or a persona finds goes back into the specification before the code, as a checkable criterion or a recorded "not doing" (L07) | Belongs to step 5 (design and prototype), which rates the prototype itself; two specifications carry mockups | Rated in step 5 |
| 4.10 | A new requirement gets a new specification, the old one stays as the record of its time; the status follows the folder (active, `implemented/`, `archive/`) (L25) | The lifecycle of `.ai/specs/README.md` keeps the same three places. What the system does now is in `docs/spec/`, so an agent does not have to work out which of many change specifications applies | Beyond |
| 4.11 | A Delta (ADDED / MODIFIED / REMOVED with `WHEN`/`THEN`), `Extends` / `Supersedes`, a prior-spec drift check and `Frozen by:` characterization tests (L25) | The installed `om-spec-writing` asks for all of them (`references/delta-format.md`, `prior-specs.md`), but `TEMPLATE.md` and `README.md` mention none. 3 of the 44 specifications have a Delta, although more change observable behavior (e.g. `2026-11-20-page-tab-titles.md`); the specifications mix the skill's sections with the template's | Partial – #524 |
| 4.12 | An autonomous specification is its own pull request, the implementation another one; risky assumptions hold the merge (extras, L11) | `om-auto-write-spec` and `om-auto-implement-spec`; the implementation pull request refers to the specification pull request (`Refs`, `Source doc:`) | Full |
| 4.13 | With many specifications the agent is pointed at the one that matters and its links; the archive is kept apart (extras FAQ) | `docs/spec/README.md` indexes the system specification; change specifications by date in their status folders | Full |

### Gap proposals

The research was done on 2026-11-26. The maintainer accepted the recommended option of every gap on the same day.

**4.3 and 4.11 – one format with user scenarios and a Delta – accepted (A): #524.** These two gaps share one cause, so they get one proposal.

**What the repo shows.**

- **Two formats.** Of the 44 implemented specifications, 34 use the sections of `TEMPLATE.md` and 17 those of the skill; some use both. The installed `om-spec-writing` never reads `TEMPLATE.md`.
- **No user stories, in any revision.** None of the 20 upstream revisions of its `SKILL.md` asked for them. In Open Mercato they live in `om-app-spec-writing`.
- **A second source of truth.** `om-auto-implement-spec` archives every Delta into `.ai/specs/capabilities/<slug>.md` (`references/delta-archive.md`). That would be a second description of current behavior next to `docs/spec/`, against Rule 8. The three Deltas of Trybun escaped it only because their headings do not match the shape the skill looks for.

**Sources.**

- **User stories.** Sources disagree.
  - GitHub Spec Kit requires prioritised stories with Given/When/Then.
  - AWS Kiro writes stories with EARS criteria, and gives a bug fix a separate format: current, expected and unchanged behavior.
  - OpenSpec has no stories: requirements with scenarios, and none for tooling.
  - Mike Cohn: "not everything needs to be a user story".
  - Alan Klement's job stories put the situation before the persona.
- **Criticism.** Birgitta Böckeler (martinfowler.com, 2025) saw Kiro turn a small bug into 4 stories with 16 criteria, and found Spec Kit's Markdown tedious to review.
- **Where they agree.** Name the actor, the situation and the visible result, and confirm them with concrete scenarios. Do not force a story where nobody observes the behavior.
- **The two layers.** They are the model of OpenSpec: change specifications plus a living specification updated when a change is implemented. So "never rewrite an old specification" (L25) applies to `.ai/specs/`, and editing `docs/spec/` is that model's archive step.
- **Delta and the table.** `docs/spec/` is prose (no `SHALL`, no `WHEN`/`THEN`), so the Delta and the table "Changes to the system specification" do different jobs. The Delta covers behavior and its characterization tests; the table covers the sections, the glossary and the user documentation.
- **Characterization tests.** Michael Feathers (2004) and Mark Seemann (2025). An existing test named in `Frozen by:` is checked by breaking the code and seeing the test fail.

**Options.**

- **(A) Recommended: `TEMPLATE.md` becomes the one format**, and repo-local extensions make the skills follow it.
  - The template gains:
    - `Extends` / `Supersedes` lines and a prior-spec drift section;
    - **user scenarios**, required when someone observes the change (an end user, a role of the glossary, or the maintainer reading CI or audit output), built on the six questions of L05 with the situation first;
    - a **Delta** per `docs/spec/` section, with `SHALL`, `WHEN`/`THEN` and `Frozen by:`.
  - The table "Changes to the system specification" stays.
  - An extension of `om-spec-writing` writes this format.
  - An extension of `om-auto-implement-spec` replaces the `capabilities/` archive with the Rule 8 update of `docs/spec/`.
  - `README.md` describes all of it.
  - **Open risk.** `references/agentic-setup.md` says an extension can never "redirect outputs". If the skill reads the new archive target as such, the fix is an upstream proposal for a setting that names the living specification.
- **(B) Rejected: change only the template.** The skill does not read it, and the `capabilities/` conflict stays.
- **(C) Rejected: the skill's format only.** It loses the plan task, the glossary terms and Rules 3, 4 and 9, and the conflict stays.
- **(D) Rejected: OpenSpec capability files, or rewriting `docs/spec/` as requirements.** It duplicates or restructures the single source of truth, and OpenSpec itself advises against converting existing documents.

**4.6 – Review by another model – accepted (a1): #525.**

**What exists.**

- **Upstream already has it, staged only.** `open-mercato/skills` added `om-harness` and `om-setup-agent-harness` on 2026-10-31 (PR #152). In the "multi" profile, a fresh Claude context and blind advisors, Codex among them, review the same hash-bound packet, also of a specification (`prepare-review --kind spec`). The Codex reviewer runs:
  - in a read-only sandbox;
  - against a strict output schema;
  - with a check that the worktree did not change.
- **Not in the PR flow, and not installed.** The upstream `om-auto-review-pr` has no reviewer-model option. Trybun's lock has 60 of the 74 upstream skills, because `npx skills update` never adds new skills.
- **Codex CLI 0.171.0 can run unattended:** `exec -s read-only`, `--ephemeral`, `--output-schema`, `-o`.

**Evidence.**

- **For.**
  - Self-preference: Panickssery et al., NeurIPS 2024.
  - No self-correction without an outside signal: Huang et al., ICLR 2024.
  - Correlated errors: Goel et al., ICML 2025.
  - For documents, Song (arXiv, single author): one same-model and one cross-model review found 56.7 % of the planted errors, against 42.7 % for two same-model reviews.
- **Against.**
  - Xiang et al.: Codex reviewing Claude's code made the result worse (91.4 % → 82.8 %).
  - Broccia et al. (2026, n=34): LLM help lowered the requirement defects people found. So the maintainer reads the specification before the AI findings, as L05 teaches.
- **Practitioners.** The official `codex-plugin-cc`, PAL/zen MCP and others run Codex locally, read-only and blind, and check its findings before acting. None runs a specification review in CI on a public repository.

**Options.**

- **(a1) Recommended: install `om-harness` and `om-setup-agent-harness`**, locked by hash, with only the Codex reviewer configured. A repo-local extension of `om-auto-review-pr` runs a blind Codex advisor next to the fresh Claude review on specification pull requests.
  - **Findings.** Codex findings are attributed, checked against the code before they count toward the verdict, and never applied unchecked.
  - **Failures.** A failed or partial Codex run is reported as "not reviewed", never as a pass.
  - **Where it runs.** Locally in Cezar, so no secret reaches GitHub.
  - **What is still unchecked.** Whether the harness runtime can be called from the extension needs one test run of Codex.
  - **If it cannot.** (a2) The extension calls `codex exec` directly with the same flags.
  - **Upstream.** The maintainer may propose the reviewer option upstream (a3).
- **(b) Rejected: a manual step.** Nothing is recorded on the pull request.
- **(c) Rejected: a GitHub Action with another provider.** An API key in a public repository, and fork pull requests would need `pull_request_target`, the class of the known exfiltration attacks; it is also a settings change agents do not make.
- **(d) Rejected: the same model in a fresh context only.** That is the gap, and it can be closed.

**Quality.** The evidence that cross-model review helps with specifications in particular rests on one study. So the Codex review informs the maintainer and the reviewer, and it is not a merge gate.

**4.7 – grill-me – accepted (a): #526.**

**What it is.** `grill-me` (2026-08-15) is one line that calls `grilling` (MIT, Markdown only, 15 changes from June to October 2026).

- It maps the decisions as a tree and asks them in rounds, each question with a recommended answer.
- The agent looks up facts; the human makes every decision.
- It has no asynchronous mode, on purpose, and writes no file.

**How it differs from what Trybun has.** The gate of `om-spec-writing` covers only the critical unknowns, before the design, and `om-auto-write-spec` answers it with defaults. Grilling interviews the human after the review, so the two complement each other.

**Similar practices.** Spec Kit `/clarify` (at most five questions, answers written into the specification), the pre-mortem (Klein), structured interviews (Davis et al. 2006) and ClarifyGPT (FSE 2024). No study measures grill-me itself.

**Options.**

- **(a) Recommended: install `grilling` and `grill-me`** with `npx skills`, locked by hash, with the diff read at every update, since the skill changes often.
  - The `.gitignore` rule covers only the `om-*` links, so the new links need a rule; that is the maintainer's change.
  - The maintainer runs `/grill-me` after reading the specification and the reviews, and records the decisions as in 4.5.
  - A project skill that feeds the interview from the assumptions table and the review findings waits until real sessions show it is needed.
- **(b) Rejected: extend the gate of `om-spec-writing`.** It runs autonomously and before the review.
- **(c) Rejected: an asynchronous "grill memo" on the pull request.** Unanswered questions are the agent's opinion, not decisions.

Full reports: the research of 2026-11-26 in the session scratchpad, summarised here; the sources are named above.

Found during step 4, in the ten attempts of the CI experiment of #510: two flaky checks in code the experiment does not change, filed on their own:

- #522: a late line of the previous boot's API stub reached the log of the next run in `test-env-up.spec.js`; the health checks of the stub passed before the stubbed API had started.
- #523: the CPU slowdown calibration of the Lighthouse budget did not converge on a noisy runner.

## Step 5 – Design system and prototype (tokens, Storybook, a11y in CI)

Course sources: the fifteen leaves of L06 (context, generic AI look, the detector of exercise 1, layers and ready-made bases, tokens in three layers, from references to tokens, UX rules for the button and the form, the Storybook prompt and its run, visual foundations, AI errors and the CI check, the agent test, inspiration, homework, materials), the eight leaves of L07 (context, prototype question and screen map, the grey prototype of `om-mockup-prototype`, the clickable prototype from the design system, comments and variants, personas with `om-synthetic-users`, from prototype to specification, homework), and the extras on `om-mockup-prototype`, `om-synthetic-users` and `om-ux-setup`. The carried-forward table has no row for step 5; 4.9 of step 4 and 3.6 of step 3 are rated here. Checked on 2026-11-26 at `main` `6a9f832c`, with read-only commands (`grep`, `ls`, counts over `packages/ui/src/components/` and `.ai/cezar/runs.json`).

### Ratings

| # | Course practice | Evidence in Trybun | Rating |
|---|---|---|---|
| 5.1 | The interface is audited for the generic AI look before the design system is decided: a checklist prompt, a report with "checked" or "assumption" per finding, five decisions that move the UI away from the average (L06 exercise 1) | No audit report in the repository. The visual base is close to the shadcn/ui defaults the course calls the most common generic look: style `base-nova`, base colour `neutral`, Lucide icons (`packages/ui/components.json`), `--radius: 0.625rem`, which shadcn 4.23 names its `default` radius preset (checked in `node_modules/shadcn/dist`); the interactive Blue `#2563EB` is Tailwind's `blue-600`. Whether this is generic was not assessed by any document | Missing |
| 5.2 | A ready-made base is chosen and the reason recorded; behaviour and accessibility come from the library, the look is the product's own (L06 "Nie zaczynaj od zera") | [§2.6](../../docs/spec/02-agent-rules.md#26-rule-6--new-components-are-always-reusable) and [§18.6](../../docs/spec/18-code-patterns.md): shadcn/ui on Base UI, added with the CLI and adapted before first use; Radix and `asChild` blocked by lint (`configs.spec.js`) | Full |
| 5.3 | Likes and dislikes become numbered decisions with a source: reference and anti-reference cards, observation, take / do not take, character and anti-character words, conflicts left to the human; every token traces to a decision (L06 exercise 2) | [`docs/brand/README.md`](../../docs/brand/README.md) records the brand colours, their roles and the reasons (Vermilion not the focus ring, Blue for interactive states); [`2026-11-01-brand-interactive-colour.md`](../specs/implemented/2026-11-01-brand-interactive-colour.md) records one decision with the maintainer's rejection of the first option. No reference or anti-reference cards, no character words; type scale, spacing, radii and shadows are "those of Tailwind CSS" without a recorded reason | Partial |
| 5.4 | Colour tokens in three layers: raw values only in the token file, semantic tokens named by purpose, component tokens only when needed; each semantic token carries its origin (L06) | `packages/ui/src/styles/globals.css` (279 lines): raw `--ink`, `--vermilion`, `--blue` ("not utilities"); 28 semantic colour tokens (the 19 of the shadcn set plus `success`, `warning`, `info` with their foregrounds, `link`, `overlay`, `brand-accent`), with origin and contrast in comments; components use them through cva variants, no component tokens | Full |
| 5.5 | One spacing scale tied to relationships (in a group, between groups, inside a panel, between sections) and named text styles, so the agent picks a step, not a pixel (L06) | Tailwind's default spacing (`--spacing` steps) and type scale; no rule that maps a step to a relationship and no named text styles. The only spacing rules are the content widths of §2.9 and the touch-target sizes | Missing |
| 5.6 | The contrast of every text/background pair is computed in both themes and computed again after a change (L06) | Contrast of each pair in both themes in `globals.css` comments and the token table of `docs/brand/README.md`; axe `color-contrast` checks the rendered pairs in all 268 stories in light and dark and on 50 E2E call sites. No contrast table rendered in Storybook | Full |
| 5.7 | No hard-coded values (hex/rgb/oklch, palette classes, arbitrary `[13px]`) outside the token file, and a CI check that fails on them with explicit exit-code handling, not `! grep` (L06 "Sprawdzenie w CI") | Tailwind's palette is removed (`--color-*: initial`), so `bg-red-500` is an unknown class; `@trybun/eslint-config/src/tailwind.js` runs `better-tailwindcss/no-unknown-classes` and `no-restricted-classes` (arbitrary values in 44 token utility families, literal colours in any arbitrary value), with failing fixtures in `configs.spec.js`; job `Format and lint` (`pnpm lint`) fails on an ESLint error, so the `! grep` pitfall does not arise. Not covered: inline `style` (forbidden by §2.6 and `CODE_REVIEW.md`, no lint rule; 0 occurrences in `packages/ui` and `apps/web`) and raw values in plain CSS (2 CSS files, both token files). One literal outside: `themeColor: '#ffffff'` in `apps/web/src/app/layout.tsx` | Beyond |
| 5.8 | Storybook is an instruction manual, not a gallery: a component page with 13 sections (purpose, when to use, when not to use and what instead, anatomy, states, a11y, content, responsiveness, API, code, do/don't, related), Foundations, Patterns, "How to choose", "What to avoid", "What is missing", and an agent file routed from `AGENTS.md` (L06 exercise 3) | 27 story files with 268 stories, all under `Components/`; no MDX page, no `autodocs` tag, no "when not to use" in any story or component; no Foundations or Patterns pages, no product stories (`apps/` has 0 story files). The guidance an agent reads lives elsewhere: §2.6, §18.6 (choices for filters, tooltips, overlays, tables), the `ui-component` skill (19 lines) and `.ai/memory/shadcn.md` (46 lines of pitfalls). No `docs/design-system.md`; `AGENTS.md` routes to `docs/brand/` only | Partial |
| 5.9 | Every component has a state matrix, long content, a narrow screen and interaction tests in `play`; data is realistic, no lorem ipsum (L06 exercise 3, stage 2) | Rule in §2.6, §18.6 and step 4 of `ui-component`; 188 `play` functions; 27 of 27 story files have `Phone`, `Tablet`, `Desktop` stories (`viewports.ts`); 0 lorem ipsum; a missing state is a minor finding in `CODE_REVIEW.md` | Full |
| 5.10 | Story tests with a11y run in CI, fail on a violation (`a11y: { test: 'error' }`), in both themes (L06 homework) | `.storybook/preview.tsx`: `a11y.test: 'error'`, tags `wcag2a`–`wcag22aa`; `packages/ui/vitest.config.ts` projects `ui-stories-light` and `ui-stories-dark` (Chromium, `@storybook/addon-vitest`); run by `pnpm test:coverage` in job `Tests and coverage`, which installs Chromium first. Beyond the course: axe on 50 E2E call sites in 15 specs on three viewports. `build-storybook` (a script of `@trybun/ui`, which builds) does not run in CI | Beyond |
| 5.11 | The UX numbers live in the components: contrast 4.5:1 / 3:1, targets ≥ 24 × 24 px, visible focus, no sideways scroll at 320 px, lines of 45–75 characters (L06) | Targets 44 × 44 px on touch (§2.9, §13.4), checked by `e2e/touch-targets.ts` in 10 files and by the `Phone` stories; focus indicator specified to WCAG 2.4.13 (§13.4); `--input` 3:1 for field borders. Minimum width is 360 px, not 320 px (§2.9). Line length is bounded by width (forms ≤ 768 px), not by characters | Beyond |
| 5.12 | Heuristics are built into components, e.g. the form pattern: visible label, one validation schema with the server, error linked to the field, focus on the first error, no double submit, success only after the server (L06) | §18.5 "Forms": React Hook Form with the contract schema the API validates, `Field` links label, description and error; React Hook Form 7.92 defaults `shouldFocusError: true` (client errors); 21 files call `useForm` and 23 files disable a control while a mutation is pending or the form is submitting (counted by grep, not checked form by form); unsaved text is never lost without a question. Focus after a server-side field error not verified | Full |
| 5.13 | Dark mode: each token has a second value with the same meaning, contrast in both themes, the theme set on the root so dialogs and menus get it too (L06) | `.dark` block in `globals.css`; `withThemeByClassName` sets the class on `html` (addon default), so portals get it; every story tested in dark. The web application never sets `.dark` (no theme switch, no `prefers-color-scheme`), so the dark theme exists only in Storybook. Plan task S0-07 asked for light and dark themes of the library and its stories, but no section of the specification asks for a dark theme in the product. 22 `dark:` classes in 10 components (shadcn defaults) against "not with separate classes in every component" (§2.6) | Partial |
| 5.14 | Motion, fonts and icons are decisions: durations by purpose, animations off under `prefers-reduced-motion`, fonts in the project not from a CDN, one icon set (L06 "Fundamenty wizualne") | Manrope self-hosted (`next/font`, Fontsource); Lucide only. No motion tokens; `tw-animate-css` has no reduced-motion rule (checked in its `dist`). Most animated components only fade or change colour. Tooltips, the upload spinner, `scroll-fade` and the product tours (§2.4) honour the setting. The zoom and slide of `dialog`, `popover`, `dropdown-menu`, `select`, `combobox` (100 ms), `drawer` (450 ms), `toast` (500 ms) and the `switch` thumb do not | Partial |
| 5.15 | An agent in a fresh session builds a new screen only from the design system and labels every decision RULE / EXAMPLE / GUESS; every guess becomes a rule or a "What is missing" entry (L06 "Test agentem") | None recorded | Missing |
| 5.16 | A prototype starts from one question (role, look and feel, implementation) and a screen map: stable screen IDs, states per screen, roles, switchable scenarios, demo data, spec gaps as questions to the product owner (L07 exercise 1) | `SDLC.md` Design stage: "the flow and its states are settled before the code exists" (empty, loading, error, no permission), owned by `om-ux-shape` or a human; the spec-level Definition of Ready asks for "a link to the prototype or mockups". No screen map, no screen IDs, no prototype question in any specification; `om-ux-shape` has 0 of 336 recorded Cezar runs | Partial |
| 5.17 | A grey, neutral prototype of one flow with `om-mockup-prototype`, checked in a browser, versioned as `revision-NNN` (L07 exercise 2a) | Installed (`skills-lock.json`); 0 runs; no `.ai/prototypes/`. The skill stops without `.ai/specs/product-brief.md`, which does not exist (#501 open). `browser.provider: agent-browser` is configured | Missing – needs 3.4 (#501) |
| 5.18 | A clickable prototype built from the design system's components and tokens, every state reachable, simulations labelled, comments pinned to elements and exported, several versions of a screen compared (L07 exercise 2b, "Komentarze i warianty") | No `prototypes/`; `om-ux-design` installed, 0 runs. Two of the 44 implemented specifications (`2026-11-10-ticket-list-filter-pickers.md`, `2026-11-21-rate-limited-sign-out.md`) link static HTML+PNG mockups in `.ai/specs/assets/`, marked "illustrative, not accepted designs", with hard-coded colours rather than DS components; no comment loop | Missing |
| 5.19 | Synthetic personas walk the grey prototype in `validate` mode, two runs with fresh panels, only repeated findings kept, reported as hypotheses for real people (L07 exercise 3, optional) | `om-synthetic-users` installed, 0 runs; no `.ai/specs/research/walkthroughs/`. 3.6 deferred it until the brief exists | Missing – decided after 3.4 and 5.17 |
| 5.20 | What a prototype, a comment or a persona finds goes back into the specification before the code, as a checkable criterion tied to a screen ID or a recorded "not doing"; persona findings only as questions (L07, carried from 4.9) | The form exists: change specifications have "Acceptance criteria" and "Non-goals" (`TEMPLATE.md`) and are merged before the code. There is no prototype, comment export or persona report to feed it, and criteria carry no screen IDs | Partial – depends on 5.16–5.19 |
| 5.21 | The design system is extracted into a contract that the UX skills check against (`om-ux-setup` → `.uxproof/`; extras, optional in L07) | `SDLC.md` says the contract "is set up once" with `om-ux-setup`, that QA checks conformance to `.uxproof/` "when the repository has one", and that `om-ux-review-pr` gives every user-facing PR an advisory design pass. No `.uxproof/`; `om-ux-setup` and `om-ux-review-pr` have 0 recorded runs | Missing |

Not verified: whether each of the 21 forms disables its submit while pending (5.12 counts files by grep); whether the 13 animated components without `motion-safe` animate in practice (5.14 reads classes only); `om-*` runs outside Cezar (interactive sessions leave no record in `runs.json`).

### Gap proposals

The research was done on 2026-11-26; the maintainer accepted every recommendation, and the removal of the dark theme, on the same day. Each gap starts from its consumer today: the end users, the maintainer or the coding agents. Across 174 issues and 332 pull requests, none reports a spacing, look or dark-mode problem. The UX defect that does recur is a missing state: 7 fix pull requests and about 10 issues lacked a loading, error or "too many requests" state, which #499 addresses. A course practice without a consumer here is deferred, with the trigger that would make it needed.

**5.14 Reduced motion – accepted: #530.**

- **The consumer.** People who set "Reduce motion".
- **What moves today.** The zoom and slide of popups (100 ms), the drawer (450 ms), the toast (500 ms) and the `switch` thumb do not honour the setting, while tooltips, the spinner and the tours do. So the gap is inconsistency, not a missing policy.
- **The proposal.** One rule in `globals.css` turns off the zoom and slide of `tw-animate-css` under `prefers-reduced-motion: reduce` and keeps the fades. The drawer and the toast fade instead of sliding, and swipe stays. A line in §13.4 and one test with reduced motion emulated go with it.
- **Sources.** W3C Understanding 2.3.3 (C39, SCR40), MDN, WebKit (2017), GitHub Primer, and the advice to reduce motion rather than remove it.
- **Rejected:** the blanket 0.01 ms reset, which also removes harmless fades.
- **Still to check.** WCAG 2.3.3 is level AAA and the specification targets AA, so this goes beyond the target. Whether Base UI still closes its popups correctly with only a fade left is untested.

**5.13 Dark theme – accepted (b), removal: #531** (a change specification first, as it changes S0-07, §2.6 and §2.14). S0-07 asked for light and dark themes of the library, and the specification asks for none in the product.

- **(a) Ship it.** It follows the system setting: a change of the specification and dark checks in E2E.
- **(b) Remove it.** The `.dark` tokens, the `dark:` classes and the dark story project go, which also halves the story tests.
- **Rejected:** keeping it as it is, a cost without a consumer.
- **The research leans to (b)** unless the product brief (#501) names users who need it.

**5.21 `SDLC.md` – accepted: #532.**

- **The cause.** The UX steps come from the pipeline template, written whatever `designer: false` in `.ai/agentic.config.json` says. The setup skill does not overwrite `SDLC.md`, and no skill starts `om-ux-review-pr` on its own.
- **The proposal.** A hand edit says what runs: the UX skills on demand, and no `.uxproof/` contract until a trigger.
- **Rejected:** running `om-ux-setup` now. It would copy what lint already enforces and add a QA step for every UI pull request without a measured defect.

**5.3 / 5.5 Named text styles – accepted: #533**, as a refactor of measured drift.

- **The drift.** No heading component exists: `text-2xl font-bold` is copied 23 times for `h1`, and six `h3` headings use five styles.
- **The proposal.** Named text styles (a Tailwind `@utility` or a `Heading` component) and a line in §18.6. GOV.UK publishes its heading sizes the same way.
- **Deferred:** a spacing rule tied to relationships, until evidence. Atlassian ties spacing to size rather than strictly to relationships.

**5.15 Agent test – accepted: #534**, once, on the next real screen.

- **The test.** An agent builds the next new screen (S1-14 Kanban) only from the design system and labels each decision RULE, EXAMPLE or GUESS.
- **What it decides.** Its guesses settle 5.5 and any new rule in §18.6.

**5.16–5.20 Prototype loop – the light part only.**

- **What is done now.** #499 is finished, and UI specifications list the states of each screen in their acceptance criteria.
- **When to prototype.** Only when a specification has an open question of look and feel.
- **Waiting for the brief (#501):** 5.17 (grey prototype) and 5.19 (personas).
- **Already in place:** the form of 5.20.

**5.1 Generic look – accepted, one paragraph: #532.** `docs/brand/` says that the default radius, type scale, shadows and spacing were kept on purpose: familiar conventions (Jakob's Law) and no positioning yet. The full audit waits for the brief.

**Deferred, with triggers.**

- **5.8 Storybook as a manual.** No MDX manual, `llms.txt` or `design-system.md`. Agents already reach §18.6 through `AGENTS.md` and the `ui-component` skill, and a copy would drift. Storybook's manifest and MCP wait until they leave preview and agents can reach a running Storybook.
- **5.10 Storybook build in CI.** When Storybook is published or MCP is adopted.

## Step 6 – Interactive coding (phases, subagent per task, tracking)

Course sources: the ten leaves of L08 (input and scope of epic 01, the prototype README, the interactive implementation flow, the safety net and self-correction, review pitfalls and the choice of reviewer, the build of the phases, environment set-up and manual tests, tests of roles, sign-up and rate limit, GitHub OAuth, state after the lesson with its checklist). The carried-forward row of step 1 (1.7, run logs) is rated here as 6.2. Checked on 2026-11-26 at `main` `88269175`, with read-only commands: the skills under `.agents/skills/`, `.ai/agentic.config.json`, the 50 execution plans of `.ai/runs/`, the 336 runs of `.ai/cezar/runs.json` (task text, runner, `prRefs`) and the reviews of the 308 merged pull requests (`gh pr list`).

Trybun's agents work in two modes. The autonomous skills of the Open Mercato pipeline (`om-auto-*`, run by Cezar) and interactive sessions with the maintainer, such as the one writing this analysis. The course's flow is the interactive one; where Trybun's autonomous skills cover the same practice, they are rated.

### Ratings

| # | Course practice | Evidence in Trybun | Rating |
|---|---|---|---|
| 6.1 | Implementation starts from an approved specification and is split into phases and stable tasks before any code (L08 initial prompt) | "Specification before implementation" (`SDLC.md`, `AGENTS.md`): the specification PR is merged first. `om-auto-create-pr` step 4 drafts an execution plan with Phases and Steps from the specification and commits it before any code (step 6, "Never commit code before the execution plan lands"); `AGENTS.md` "Plan first, re-plan when it goes wrong" | Full |
| 6.2 | A tracker (`track.md`) lists phases and tasks, marks each done, keeps open points, and reflects the real state, so an interrupted session resumes from it and the last commit (L08) | The 50 execution plans of `.ai/runs/` have a Progress list, step → commit SHA (2–19 steps each); `om-auto-continue-pr` resumes from it; the loop engine adds `HANDOFF.md` and `NOTIFY.md`. No field for open points (the plans have Risks). Only `om-auto-create-pr` and its loop write one: the bug chain of `om-auto-fix-issue` and interactive sessions leave none, so their record is the issue, the PR body and the commits | Partial – 1.7 |
| 6.3 | A commit after every task, as the point to return to (L08) | `om-auto-create-pr`: one commit per Step, or per Phase, plus a Progress commit; the loop engine: exactly one commit per Step ("runs MUST bisect by Step"); `commit-msg` and `pre-push` hooks check every commit | Full |
| 6.4 | Each task is implemented by a subagent in its own context window, so the main thread keeps only the results (L08) | The loop engine dispatches `dispatch`/`group` Steps to sequential executor subagents (`engine.executorTier: standard`), but only above `engine.loopStepThreshold: 20` Steps; no execution plan in `.ai/runs/` has more than 19, and Cezar recorded one loop run. `om-auto-create-pr` and the bug chain implement in the main session. Trybun's own unit of isolation is the small task: one task = one focused PR (`AGENTS.md`), one agent run per PR. Whether runs exhaust their context was not measured (`tokensUsed` in `runs.json` is cumulative, not the context size) | Partial – measured in step 8 |
| 6.5 | After every task the agent runs deterministic checks (typecheck, lint, tests, build), not its own judgement (L08, Huang et al. 2024) | `om-auto-create-pr` step 7.3: a targeted subset of `validation.commands` after each Phase; step 8: the full gate of six commands (`pnpm lint`, `lint:spec`, `typecheck`, `test`, `test:coverage`, `build`) before completion; the `pre-push` hook runs the commit checks of CI; 13 required CI checks. `AGENTS.md` forbids weakening tests or gates | Beyond |
| 6.6 | The agent stops after each phase; a person tests by hand and reviews before the next phase builds on it (L08 "STOP") | Autonomous runs do not stop between phases. The checkpoint is the pull request: small PRs, review, the QA gate (`needs-qa`, `om-auto-qa-pr`, `qa-approved` owned by a person) and the maintainer's merge (`SDLC.md`, ADR 0011). The loop engine verifies at checkpoints every 5 Steps without stopping | Different |
| 6.7 | Each phase is reviewed in a new session, by a model of another family; the author's own session reviews poorly (L08: self-correction blind spot, self-preference, familiarity) | The skill chains review in the session that wrote the code: `om-auto-fix-issue` step 9 and `om-auto-create-pr` step 10 invoke `om-auto-review-pr --autofix` inline ("this run owns the PR"). Of 128 merged `feat`/`fix` PRs with a review, 106 have a single Cezar run, the one that implemented them; 9 were reviewed by a separate run; 13 have no or several runs. All 336 runs use the `claude` runner. A second family for specifications is #525; for code it is step 11 (L21) | Missing |
| 6.8 | Review findings go back to the implementation; blockers and majors are fixed before the next phase (L08) | `om-auto-review-pr --autofix` loops until a clean verdict or only non-actionable findings remain, with new commits and re-run validation; severities in `CODE_REVIEW.md`; `changes-requested` hands the PR back to its author | Full |
| 6.9 | Code review comes before manual testing, so the agent removes simple glitches first (L08) | `SDLC.md` pipeline: review → `needs-qa` → `qa`; `om-auto-fix-issue`: `om-auto-review-pr` (step 9) before `om-auto-qa-pr` | Full |
| 6.10 | The whole specification is reviewed at the end (L08) | `om-auto-review-pr` reviews the whole PR against the specification it cites; with a Delta, the finish check of `om-auto-implement-spec` (`references/delta-archive.md`) reports a missing capability file or characterization test | Full |
| 6.11 | After a phase the agent says what it built, what configuration and data it needs and how to run it, and writes a manual test guide with test accounts (L08) | The summary comment of `om-auto-create-pr` and the PR body template; `om-prepare-test-env` boots the application once and `om-auto-qa-pr` walks it in a browser; the seeded accounts with their password and TOTP secret are listed in `README.md` (§15.12) | Full |
| 6.12 | The local environment is reproducible: an example `.env`, generated secrets, mocks only locally and refused elsewhere, migrations and a seed with personas (L08) | `pnpm dev` starts Compose, applies the migrations and the demo dataset (§15.12); `.env.example` (165 lines) with development values, `./trybun install` generates real secrets (§15.5). No mock identity adapter: Keycloak runs locally with the development realm overlay, and password sign-in of seeded team accounts exists only in the local environment (§7.4). Personas include the newcomer without tour progress, the customer and the partner | Beyond |
| 6.13 | A failure is debugged to its root cause with evidence (the URL, the type-check output), not by guessing (L08) | `SDLC.md` Implement stage: `om-root-cause` (read-only) locates the change surface before the fix; the bug chain runs `om-verify-in-repo` → `om-root-cause` → `om-fix` with a regression test | Full |
| 6.14 | A third-party sign-in uses the least privilege, one application per environment, its secrets in `.env` (L08 GitHub OAuth) | GitHub sign-in goes through Keycloak (§7.4); the GitHub integration is a GitHub App with access only to selected repositories and the minimum permissions, no PAT (§11); client secrets only in `.env` (`TRYBUN_GITHUB_CLIENT_SECRET`); local contributors need no OAuth application (§7.4) | Full |
| 6.15 | The agent records what it learned (`lessons.md`) and keeps the instructions current (L08) | Rule 7 and the Definition of Done: project memory in `.ai/memory/`; "Learn from corrections" in `AGENTS.md` | Full |

Rated elsewhere: the joint input of specification and prototype and the screen states (5.16–5.20); watching the context during a long run with `/context` (L10, step 8).

Not verified: the scopes the Keycloak GitHub identity provider requests (6.14); which session submitted the reviews of the 8 PRs without a Cezar run, made in interactive sessions (6.7); whether any Cezar run was compacted (6.4).

**6.6 Different – the pull request is the checkpoint.** The course stops after every phase because one interactive session builds a whole epic (four phases, about 500 000 tokens). Trybun's tasks are small, one task per PR, so the run ends where the course stops: at review, QA and the maintainer's merge. Phases inside a PR are verified by the deterministic gate (6.5), which does not wait for a person.

### Gap proposals

The research was done on 2026-11-26, by two research passes that read the primary sources. On the same day the maintainer had the upstream skills checked first, then accepted (a) for 6.7 (#537) and the rule for 6.2 (#538).

**6.7 Review in a fresh context – accepted (a): #537.** The author's session reviewing its own change is the case every source warns against:

- Huang et al. (ICLR 2024): intrinsic self-correction lowers accuracy (GPT-4 on GSM8K 95.5 → 91.5 → 89.0 %).
- Tsui, Self-Correction Bench (COLM 2026): 14 models left 64.5 % of their own errors uncorrected that they corrected when shown as someone else's.
- Kamoi et al. (TACL 2024): self-correction works only with reliable external feedback.
- Reddy et al. (arXiv 2605.21537, 2026): the producing model approved 31.7 % of its own semantic-drift errors.

The direct measurement of a fresh context of the same model on code is thin: Song (arXiv 2603.12123 v2, one author, 30 artifacts) found a fresh session better than repeated self-review (p = 0.004) but not significantly better than one self-review (p = 0.26), and Guey & Bougault (arXiv 2606.20093) found no author bias on verifiable revisions, with effects under about 13 points not ruled out. What practice does is not thin: no tool maker reviews in the author's context. Claude Code's `/code-review` runs "in a fresh subagent that never saw your conversation", and its skills can run as one (`context: fork`, code.claude.com/docs/en/skills); GitHub's Copilot coding agent has a separate Copilot code review check its changes before it opens the PR (2026-02-26); OpenAI's Codex reviewer is run apart from the generator and warns against one verifier for both (2025-12-01).

**Upstream, checked at `open-mercato/skills` `7c861837` (2026-11-26) at the maintainer's request.** The pattern is already there, but not on the path Trybun uses:

- `om-auto-fix-issue` in **automerge mode** (#194, 2026-11-20): "the review and QA cycles each run in fresh-context subagents" (`references/automerge-mode.md`). Trybun's lock predates it, and the mode hands the merge to `om-auto-merge-buddy`, which ADR 0011 leaves to the maintainer.
- The staged-only skills `om-fix-issue` and `om-implement-feature` with the runtime `om-harness` (#152, 2026-10-31): even in the `standard` profile, `om-code-review` runs in "a new Claude context with no inherited implementation transcript"; the contract (`om-harness/references/code-review-contract.md`) gives the reviewer only the worktree, an immutable packet with its SHA-256 and the skill, has it attest `freshContext: true`, and stops if the host cannot create a fresh context. These skills never commit, push or open a PR, and are not installed in Trybun (#525 installs `om-harness` for its Codex reviewer).
- The default chains do not: `om-auto-create-pr` and `om-auto-create-pr-loop` are unchanged upstream, and the upstream `om-auto-review-pr` (changed since the lock by #193, #198 and #204) still reviews in the caller's context. `om-code-review` is unchanged.

Options:

- **(a) Accepted: the upstream pattern on Trybun's path.** The lock is first brought to the current upstream (with #498), then a repository extension `.ai/skills/om-auto-review-pr/SKILL.md` (the mechanism of `.ai/skills/README.md`, the same file #525 adds) runs the review of `om-code-review` in a subagent that gets only the PR number, the issue or specification and read access to the worktree, never the author's transcript; it returns the findings. The calling session, which knows the change, applies the fixes, as in the course ("uwagi wracają do sesji implementacyjnej"), and each re-review is again a fresh subagent. The reviewer gets the specification, because OpenAI traces many false alarms to a misread intent, and is asked for correctness, because "a reviewer that's asked to find problems will always find something" (Anthropic). Interactive sessions follow the same rule before they open a PR.
- **(b) Rejected: a separate Cezar run for every review.** The same isolation, but each autofix round would cross runs, the claim of the PR would pass between them, and the review would wait for the orchestrator. The 9 reviews made this way show it works, not that it is simpler.
- **(c) Rejected: keep the same session.** Against all the sources above.
- **Out of scope here:** a model of another family. It is #525 for specifications and step 11 (L21) for code.

Cost: one more context per review, which re-reads the diff and the specification. The extension has to be tested in a real run, because whether `context: fork` holds when one skill invokes another, and in Cezar, is not documented.

**6.2 and 1.7 Run logs – accepted (a): #538.** The sources agree that a progress file is for work that outlives one session or context window, runs for hours, has phases, or passes to another agent (Anthropic "Effective harnesses for long-running agents", 2025-11-26, and the Claude prompting best practices; OpenAI's ExecPlans, "for complex features or significant refactors"; Cline's memory bank; Harper Reed's `todo.md`, 2025-02-16). For short work, the PR is the record: GitHub's Copilot coding agent keeps its checklist in the PR body, and Cursor says that for quick changes "jumping straight to Agent mode is fine". No tool maker asks for a file on every task, which is what `track.md` in L08 does.

- **(a) Accepted: write the rule down.** `SDLC.md` says when a run log in `.ai/runs/` is written: by the `om-auto-create-pr` skills, and by any other task that spans more than one session, is planned in phases or is handed to another agent. A task done in one session has its record in the issue, the PR body and the commits. That is the split Trybun already has; only the rule was missing, which is why 1.7 was asked.
- **(b) Rejected: a run log for every task, as in L08.** Stricter than any source, and it repeats the PR body.
- **(c) Not now: delete finished run logs at merge** (cogitoacademy/app #295, 2026-10-09, deleted 53 plans). No problem with the 50 logs on `main` is recorded; it waits for one.
- **Open points**, which the course keeps in `track.md`: the ExecPlan sections Surprises & Discoveries and Decision Log cover them. Nothing in Trybun shows an open point lost, so the plans keep their Risks.

**6.4 Subagent per task – moves to step 8**, which measures the context: whether runs fill their window decides whether `om-auto-create-pr` needs executor subagents below 20 Steps.

## Step 7 – Security of AI tools and of the product

Course sources: the nine leaves of L09 (six areas and the lethal trifecta, the lab, the repository that runs code, skills as dependencies, prompt injection, secrets in sessions, sandbox and outbound traffic, hooks, checklist and homework) and the ten leaves of L16 (plan, threat model with STRIDE and the `threat-model` skill, the DevMentor threat model, OWASP lists, access control and IDOR, SAST and DAST, where to run tests, DeepSec, refusals of models, state after the lesson with the evidence card). The carried-forward table has no row for step 7. Checked on 2026-11-26 at `main` `88269175`.

The commands were read-only:

- the agent configuration of the repository (`.claude/settings.json`, `.github/CODEOWNERS`, no `.mcp.json`) and of the agents' machine (the user settings of Claude Code, the scopes of the `gh` token);
- the product's security requirements (§13.5, §7.4, ADR 0011);
- the denial tests of the 45 integration specifications of `apps/server`;
- a count-only scan of the session transcripts on the agents' machine with the patterns of L09, which prints no values.

### Ratings – the agents' tools (L09)

| # | Course practice | Evidence in Trybun | Rating |
|---|---|---|---|
| 7.1 | Every agent run is judged by the lethal trifecta – private data, untrusted content, a way to send data out – and one leg is missing in each run (L09, Willison) | No document applies it. In a Cezar run all three legs meet: <ul><li>private data: the maintainer's `gh` token, the local `.env` files and the session transcripts;</li><li>untrusted content: issues, pull requests and comments of a public repository, which anyone can write, and web pages;</li><li>a way out: `gh`, `git push`, `curl`.</li></ul>ADR 0011 names prompt injection through contributors' pull requests and answers it with an instruction ("text … is data, never an instruction"), which L09 says is not a boundary | Missing |
| 7.2 | The agent configuration of a repository (hooks, `.mcp.json`, `enableAllProjectMcpServers`, `allow` lists) is read before an agent starts in it, and is under `CODEOWNERS` with a required Code Owners review (L09) | Trybun's `.claude/settings.json` has only an `allow` list of six `pnpm` commands and `autoMemoryEnabled: false`; no hooks, no `.mcp.json`. `CODEOWNERS` is `* @dtk7c2`, so it covers `.claude/`, `.agents/`, `AGENTS.md` and `CLAUDE.md`, but ADR 0011 removed the required Code Owners review: a contributor's pull request that changes the agent configuration is merged by the maintainer or by a workflow the maintainer runs (`om-approve-merge-pr`), and nothing marks such a change for the maintainer | Partial |
| 7.3 | Skills are dependencies: read before install, scanned (`` !` ``, `curl`, `.env`, `~/.ssh`), added and updated through a reviewed PR with a pinned version (L09) | Installed from one upstream (`open-mercato/skills`) and recorded by hash in `skills-lock.json`, changed through pull requests; the content is read before an install (rule of #525 and #526). The lock pins a hash, not a commit (#498). No scan of the skills, locally or in CI | Partial – #498 |
| 7.4 | The untrusted sources an agent reads are known, a test with a hidden instruction is recorded, and the boundary is outside the model: permissions, sandbox, hooks (L09) | No list of the untrusted sources, no recorded test. Interactive sessions run in Claude Code's auto mode, whose classifier sees the intended action, not the tool output; the permission mode of Cezar's runs was not checked | Missing |
| 7.5 | Session transcripts are scanned and what they hold is rotated; `permissions.deny` covers `.env`, keys and credentials; secrets come from a manager; the agent has its own short-lived token with the least scope (L09) | No `deny` rule in the repository or the user settings. The agents use the maintainer's `gh` token (ADR 0011), which does not expire and has the scopes `repo`, `workflow`, `admin:org`, `user` and `gist`, for all the maintainer's repositories. Transcripts are kept 30 days by default; 2.6 GB in 435 project folders. The count-only scan found: <ul><li>Postgres URLs in 55 files, all local development and Testcontainers defaults;</li><li>the AWS documentation example key;</li><li>in other projects' sessions, one classic GitHub token and one private key; the maintainer was told.</li></ul>Trybun's own `.env` holds development values only, and production secrets are generated on the server (§15.5) | Missing |
| 7.6 | The agent's commands run in a sandbox: `enabled`, `allowUnsandboxedCommands: false`, `denyRead` for credential folders, a tested allowlist of domains, cloud metadata denied (L09) | Not configured. `bubblewrap` is installed on the agents' machine, `socat` is not; the agents' user is in the `docker` group, which is root-equivalent (step 12 row of the carried-forward table) | Missing |
| 7.7 | At least one blocking `PreToolUse` hook (exit 2), tested without the agent, read before use (L09) | No agent hooks. The Git hooks `commit-msg` and `pre-push` check commits, not the agent's tool calls | Missing |
| 7.8 | The permissions, skills and MCP servers can be reviewed in a minute (`security-notes.md`) (L09) | Skills: `skills-lock.json` and `.ai/skills/README.md`. Permissions: `.claude/settings.json`. The user-level plugins and MCP servers of the agents' machine and the scopes of the token are written down nowhere | Partial |

### Ratings – the product (L16)

| # | Course practice | Evidence in Trybun | Rating |
|---|---|---|---|
| 7.9 | A threat model of the real architecture: the four questions, STRIDE per entry point and trust boundary, a table with likelihood, impact, response, today's control and how it is verified, assumptions, re-run triggers, updated with stable IDs (L16 `threat-model`) | None. The security requirements are spread over the specification: §13.5 (OWASP ASVS as the reference, headers, brute force, CSRF, secrets), §7.4 (Keycloak, mandatory 2FA for the team, the password policy), §5 (visibility, 404), §14.4 (BFF, rate limits), §14 (upload quarantine with ClamAV). Nothing lists the threats, their likelihood and impact, or what verifies each | Missing |
| 7.10 | The OWASP lists that fit the product are chosen, and each category is a hypothesis checked against the code (L16) | §13.5: OWASP ASVS is the reference for security requirements; ASVS 5.0 V6 for passwords; OWASP's XSS guidance for Markdown (§6). Trybun has no LLM, agent or MCP in the product (`AGENTS.md`: no external AI APIs for ticket content), so the GenAI and agentic lists do not apply to it. No review of the code by category is recorded | Partial |
| 7.11 | An access-control test checks the positive path of both accounts, the denied read, the denied write and the data after the attempt, and this rule is in the agents' skills (L16) | The policy is central: CASL abilities on the server, an invisible record is 404, never 403 (`AGENTS.md`). The integration specifications test denials across projects, organizations and roles, e.g. "lists a ticket for every principal exactly when its detail is 200, else 404", refused writes in archived projects or for a Developer. The written rule (`SDLC.md`, risk table) asks for "the denied path and the wrong-scope read", not the denied write or the data after the attempt | Partial |
| 7.12 | SAST runs in CI on every PR, and a clean result is read together with its coverage (L16) | CodeQL (`javascript-typescript`, `actions`) on every PR and push; Trivy image scan daily (`image-scan.yml`); the advisory audit (`advisory-audit.yml`); `dependency-review`; ESLint security-relevant rules. Coverage of a CodeQL run is shown by GitHub, not recorded | Full |
| 7.13 | DAST (ZAP Baseline) against a local instance, with what it did not check (L16) | No DAST. What ZAP reported for DevMentor is specified and implemented in Trybun: one proxy sets a nonce CSP, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and denies framing (§13.5), with unit tests (`apps/web/src/proxy.spec.ts`) | Partial |
| 7.14 | Active tests run only in a disposable environment with synthetic data, under written rules of engagement (L16) | The QA test environment (`.ai/scripts/test-env-up.sh`, `om-prepare-test-env`) is disposable and loads the synthetic demo dataset; no rules of engagement for security tests, and no active security test has been run | Partial |
| 7.15 | An agentic security review of the repository (DeepSec, `om-auto-sec-report`) within a budget, each finding verified by a second agent and reproduced before it enters the backlog (L16) | `om-auto-sec-report` and `om-auto-sec-report-pr` are installed; 0 recorded runs | Missing |
| 7.16 | A confirmed finding gets a test that is red before the fix and green after (L16) | The bug chain observes the regression test failing first (`om-fix`, `SDLC.md`); a security fix follows the same chain | Full |

Not applicable now: the handling of model refusals in active tests (L16 step 8). It depends on 7.14 and 7.15.

Not verified:

- the permission mode and the tools Cezar gives its runs (7.4);
- whether the GitHub App `dtk7c2-claude` of ADR 0005 is still installed. A Cezar task of 2026-11-26 still names it, and ADR 0011 planned its removal (7.5);
- which CodeQL query suite runs (7.12).

### Gap proposals

The research was done on 2026-11-26 by two research passes over the primary sources (code.claude.com, docs.github.com, OWASP, Anthropic, Meta, Semgrep, Vercel). The maintainer decided the same day.

**7.1, 7.4–7.8 The agents' machine – risk accepted by the maintainer.** The maintainer accepted the risk: the course describes typical problems, few of which touch this machine, and all are acceptable to the maintainer. The proposal the maintainer rejected as disproportionate was an ADR that would cut one leg of the trifecta in every run. Its layers were:

- an isolated container or microVM per Cezar run;
- a fine-grained token for one repository, with an expiry;
- Meta's "Agents Rule of Two" per task;
- a sandbox in managed settings;
- `deny` rules and a hook;
- shorter transcript retention.

The research behind it, kept for a later decision:

- **The classifier and the instruction are no boundary.** Anthropic measured that auto mode let through 17 % of real overeager actions and 5.7 % of synthetic exfiltration attempts, and calls it "a per-action control, not an isolation boundary". Willison and Meta hold that detection never suffices.
- **The Bash sandbox is not enough for unattended runs**, says Anthropic's own documentation (`sandbox-environments`). It wraps Bash only, and a repository's `.claude/settings.json` can widen it unless managed settings fix it.
- **A narrower token is possible, with limits.** A fine-grained token can be limited to one repository with an expiry. It cannot use the Checks API or GitHub Packages, so GHCR would stay with CI's `GITHUB_TOKEN`.

What would reopen it: a second person or machine with access, real user data on the machine, a secret of production on it, or an incident.

**7.2 Contributors' changes to the agent configuration – deferred.** GitHub lets only accounts with write access merge, and no one else works on the repository. The remaining case is an agent merging an outside contributor's pull request that changes `.claude/`, `.agents/`, `.ai/skills/`, `AGENTS.md`, `CLAUDE.md` or `.github/` in the maintainer's name through `om-approve-merge-pr`. Trigger: the first pull request from an outside contributor. Then such pull requests are merged by the maintainer by hand, and no agent session starts inside their checkout. The second rule is own reasoning, not verified for Cezar.

**7.11 Access-control rule – accepted: #540.** Established practice uses two accounts and checks both the denied read and the denied write: OWASP's IDOR Prevention Cheat Sheet ("read, create, update, delete, export, administrative"), WSTG v4.2, and ASVS 5 8.2.1–8.2.3 and 8.1.2. The check that the data is unchanged after a denied write is own reasoning, since a 404 does not prove that nothing was written; no OWASP source names it. The tests, not a review, are the gate. Semgrep (2025-11-03) found LLM reviewers at 0 % true positives where authorization is spread across files or middleware, as with Trybun's CASL abilities.

**7.9, 7.10, 7.13–7.15 Threat model, DAST, agentic review – deferred, with triggers.**

- **Threat model** (7.9, 7.10): `docs/security/threat-model.md` before the first release `1.0.0`, when Trybun is installed on other people's servers; until then the architecture still changes.
  - **Method:** STRIDE with LINDDUN prompts for the personal data of tickets and e-mail, stable IDs, a "how we verify" column, and re-run triggers.
  - **Sources:** the Threat Modeling Manifesto, OWASP's Threat Modeling Cheat Sheet and ASVS 5 8.1.1.
  - **Drafting:** an LLM draft is a start only; arXiv 2505.04101 measured at best 72 % accuracy.
- **DAST** (7.13): decided by the threat model's "how we verify" column. The ZAP Baseline is passive and checks the headers that `proxy.spec.ts` already tests; an authenticated ZAP scan is what would add value.
- **Agentic security review** (7.14, 7.15): after the threat model, as a discovery tool under written rules of engagement, never a gate.
  - **Precision:** Semgrep (2025-09-02) measured 14 % true positives for Claude Code and 18 % for Codex.
  - **Non-determinism:** three identical runs gave 3, 6 and 11 findings.
  - **Before the backlog:** every finding is checked by a second agent and reproduced by a test.

**7.3 Skills.** The pinning is #498; the reading before an install is already a rule.

## Step 8 – Context engineering (JIT router, `check:agents`, measuring context)

Course sources: the twelve leaves of L10:

- what context engineering is;
- context rot;
- the four places context comes from;
- the AS / IS measurement;
- the AGENTS.md of DevMentor before the rebuild;
- the context cost of skills;
- repository structure, names and examples;
- task-driven context routing;
- subagents;
- the CI checks;
- dynamic context in a large project;
- state, homework and checklist.

The carried-forward rows of step 1 (1.4, nested `AGENTS.md`) and step 6 (6.4, a subagent per task) are rated here as 8.4 and 8.12. Checked on 2026-11-26 at `main` `fcbb96d4`. The measurements:

- **`/context`** in a fresh Claude Code session in the repository (Opus 5.5).
- **The session transcripts on the agents' machine.** The context of every main-model turn is read from `usage`, the sum of input, cache read and cache creation tokens. The measurement covers 234 sessions with more than three turns: 225 Cezar runs and 9 interactive sessions. Haiku side sessions and subagent turns are excluded.
- **File sizes**, and the skill descriptions read from the front matter.

### Measurement AS / IS

| What | AS / IS |
|---|---|
| Loaded at the start of a session (`/context`, deferred tools excluded) | 22.2k tokens |
| – skill descriptions (62 skills: 60 `om-*`, 2 project skills) | 10k |
| – root `AGENTS.md` (10.6 KB; `CLAUDE.md` is only `@AGENTS.md`) | 4.1k |
| – the maintainer's `~/CLAUDE.md` (outside the repository) | 2.2k |
| – MCP server instructions and tools of user-level plugins unrelated to Trybun (three DevExpress documentation servers, Claude Docs) | 3.0k |
| – system prompt and tools | 2.9k |
| Read next, by the first rule of `AGENTS.md`: `.ai/memory/MEMORY.md` | 16 KB, about 4k tokens |
| Context of the first turn, median (p10–p90) | 43k (35k–48k) |
| Peak context per session, median (p75, p90, max) | 171k (266k, 440k, 962k) |
| Sessions peaking above 300k / 500k | 49 / 17, all Cezar runs |
| of which "Fix GitHub issue" runs (the `om-auto-fix-issue` chain) | 31 of 104 above 300k |
| Sessions with a compaction | 1 marker; 9 with a drop of more than half the context |

### Ratings

| # | Course practice | Evidence in Trybun | Rating |
|---|---|---|---|
| 8.1 | Context is measured before anything is changed, AS / IS and TO BE (`/context`, Context Scope) (L10) | No measurement was recorded before this step; the table above is the first | Missing – measured here |
| 8.2 | Every line of the root `AGENTS.md` passes "would the agent act differently without it?"; no-op sentences, duplicates of skills, motivation and history are removed (`eliminate-no-op`) (L10) | 10.6 KB, under Claude Code's warning (40 000 characters) and Codex's limit (32 KiB). It is mostly routing ("Where things are"), rules, "Never", working practices, the Definition of Done and the commands. No line-by-line test was run: the twelve rules repeat their full text in `docs/spec/02-agent-rules.md`, and some "Never" items are also enforced by lint or CI | Partial |
| 8.3 | The root `AGENTS.md` is a router: per type of task, what to read and what not to read (L10 `task-router`) | "Start of every session" (memory, the specification sections the task cites, glossary, pattern catalogue) and the table "Where things are" route by place, not by type of task; skills route by task (bug → `om-auto-fix-issue`, spec → `om-auto-write-spec`) | Partial |
| 8.4 | Module details live with the module, in nested `AGENTS.md` files that load only when the agent works there (L10, agents.md) | One nested file, `apps/web/AGENTS.md`, written by `next dev`. Module rules live in the pattern catalogue §18 with its reference implementations and in `.ai/memory/<topic>.md`, both reached through the root file | Partial – 1.4 |
| 8.5 | `CLAUDE.md` holds only the import of `AGENTS.md` (L10) | `CLAUDE.md` is `@AGENTS.md` | Full |
| 8.6 | CI checks the size budget of `AGENTS.md` and of the lessons files, and that every path they name exists (L10 `check:agents`) | Paths: `lychee` checks the links of every Markdown file in CI, and `pnpm lint:spec` the `§N.M` references. No size budget for `AGENTS.md` or `.ai/memory/` | Partial |
| 8.7 | The lessons file, which grows over the project's life, is kept small and measured (L10) | `.ai/memory/MEMORY.md`, which every session reads first, is 16 KB for 33 lines: each line is an index entry with a long summary. It is larger than `AGENTS.md`. The 19 topic files total 243 KB and are opened on demand. No budget | Missing |
| 8.8 | Skill descriptions say when, not what; bodies stay under about 500 lines; unused skills are disabled and stale cached copies removed (L10) | Descriptions: 341 characters on average, 491 at most, all under 1 024; no `SKILL.md` over 500 lines. All 60 `om-*` skills are installed, and their descriptions cost 10k tokens in every session; Cezar's 336 runs used about 18 of them. No cached old copies (`.claude/skills/` links to `.agents/skills/`) | Partial |
| 8.9 | MCP servers that the project does not use are off (L10) | No MCP server in the repository. The maintainer's user-level plugins (DevExpress documentation, Claude Docs) load into every Trybun session, 3k tokens at start | Partial |
| 8.10 | A predictable structure: one convention, colocation by feature, names by role, dates where currency matters (L10) | Feature folders (`apps/web/src/features/<feature>`, NestJS modules per domain), dated change specifications (`YYYY-MM-DD-slug.md`), numbered ADRs, the glossary of code identifiers (§0), one pattern per problem (Rule 12) | Full |
| 8.11 | A current reference example instead of a paragraph describing a pattern, kept current (L10) | The pattern catalogue §18 names a reference implementation for each pattern, and Rule 12 makes a changed pattern migrate the code; the links are checked by `lychee` | Beyond |
| 8.12 | Subagents protect the main context of long work: a brief, a bounded scope, a cheaper model for research (L10, L08) | 49 of the 225 Cezar runs peaked above 300k tokens, where L10 places the drop in quality, and 17 above 500k; compaction is rare because the window is 1M. The fix-issue chain is the heaviest: 31 of 104 runs above 300k. It implements and reviews in one session (6.7, #537). The loop engine dispatches subagents only above 20 Steps (6.4) | Partial |
| 8.13 | Dynamic context for a large project: generated module facts, axes, a harness comparing declared and read context (L10, Open Mercato) | Trybun is one repository without framework modules in `node_modules` to describe; `apps/web/AGENTS.md` points to the Next.js guides in `node_modules/next/dist/docs/` | N/A |

A test for 8.4: a session started in `apps/web` loads neither `apps/web/AGENTS.md` nor, through the root `CLAUDE.md`, the root `AGENTS.md`; `/context` lists only the two `CLAUDE.md` files. Claude Code's memory documentation explains the first: a subdirectory `AGENTS.md` is read only where that directory has no `CLAUDE.md` mode of its own. Cezar starts its runs in the root of a worktree, where the root file loads.

Not verified: whether the start of a session shows a peak (L10, Context Scope; not installed); which of the 49 long runs lost quality; whether `apps/web/AGENTS.md` loads on demand when a session started in the root reads files in `apps/web`.

### Gap proposals

The research was done on 2026-11-26 over the primary sources: the Claude Code documentation (memory, skills, best practices), the agents.md and Codex documentation, Anthropic's engineering posts, and the studies listed below.

The evidence on instruction files is thin and points one way: keep them minimal and written by people.

- **Lulla et al.** (arXiv 2601.20404, ICSE JAWs 2026): a human-written `AGENTS.md` lowered the median runtime by 28.6 % and output tokens by 20 %; correctness was not measured.
- **Gloaguen et al.** (arXiv 2602.11988, 2026): developer-written files added about 2.4 points of success (not significant) but 6–42 % inference cost; generated files lowered success. Their advice: only the minimal requirements that are not in the README.
- **Claude Code's memory documentation:** "target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence." Its auto memory keeps `MEMORY.md` to one line per entry and loads at most 200 lines or 25 KB.
- **The course's threshold.** The ~300k of L10 is not in the Chroma study it cites, which shows a gradual decline with no threshold. NoLiMa (ICML 2025) found 11 of 13 models below half of their short-context score at 32k.

**8.8, 8.9 The skill catalogue – declined by the maintainer on 2026-11-26; recorded as an accepted cost.** Each listed skill costs context in every turn (Claude Code skills documentation), and the catalogue is the largest fixed cost measured: 10k of 22.2k.

- **(a) Proposed, declined:** `.claude/settings.json` turns off, with `skillOverrides: off`, the `om-*` skills no workflow of Trybun runs. The skills the used ones call stay on. The lock stays equal to upstream, so `npx skills update` keeps working, and turning a skill on is one line. The same file turns off the maintainer's user-level plugins that Trybun does not use (`enabledPlugins`). Done when `/context` is measured again (TO BE).
- **(b) Rejected: uninstall the unused skills** (`npx skills remove`). It makes the lock differ from upstream, and a skill another one calls can go missing silently.
- **(c) Rejected: keep all**, as upstream advises ("every skill is small until invoked"). That contradicts Anthropic's documentation, and upstream has an interest in the full install.

**8.2, 8.6, 8.7 Instruction and memory files – accepted (a): #542.**

- **(a) Accepted:**
  - **`MEMORY.md` as a real index:** one short line per entry, the details in the topic files.
  - **A line-by-line pass over `AGENTS.md`** with the course's test: a line that repeats `docs/spec/02-agent-rules.md`, a skill, or a rule that lint or CI already enforces goes, unless it changes what an agent does.
  - **A size budget for both in CI** with a small script like the existing `scripts/check-*.js`. Thresholds: about 200 lines for `AGENTS.md` and 25 KB for `MEMORY.md`, those of Claude Code's documentation.
- **(b) Rejected: `agnix` as the linter.** A new dependency for two numbers.
- **(c) Rejected: a router table by type of task (8.3).** Trybun's skills already route by task (bug, specification, review, QA), and a table would repeat them.

**8.4 and 1.4 Nested files – accepted (a): #542.**

- **(a) Accepted: `apps/web/CLAUDE.md` with `@AGENTS.md`**, so that the Next.js rule that `next dev` writes reaches Claude Code; pat-lewczuk's `task-router` places such a file next to every `AGENTS.md`.
- **Different: no further nested files.** The rules of a module are the pattern catalogue §18, the one source of the specification (Rule 8, Rule 12), reached from the root file; files per module would repeat it.

**8.12 and 6.4 Subagents in long runs – deferred until #537 is merged.** The evidence is mixed. Anthropic's harness post (2025-11-26) says "compaction isn't sufficient" for long work, while the current Claude Code best practices list "use subagents to protect your context window" as outdated advice. Their remaining reason for a subagent is independence ("it hasn't seen your reasoning"), which is #537. Trigger: after #537, the peak context of the fix-issue runs is measured again; if they still pass 300k, a subagent per step of `om-auto-fix-issue` is proposed.

## Step 9 – Autonomy and parallel work (feedback loop, `om-auto-*`, worktrees, Cezar, WIP)

Course sources: the eleven leaves of L11 and the eight leaves of L13.

- **L11:** fire and forget; loop engineering; worktrees, validation and ephemeral environments; communication and permissions; `om-auto-review-pr`; `om-auto-create-pr` and its loop variants; the input; the epic 02 demo; cheaper models and independent review; Cezar; the homework.
- **L13:** the queue and dispatch; the data and Amdahl's law; brain fry and the five rules; what to run in parallel; Cezar's functions; the alternatives; receiving the queue and merging; the homework.

The carried-forward rows rated here:

- 2.3, whether Cezar provisions the locked skill versions (as 9.4);
- 6.4 and 8.12, subagents in long runs (as 9.9).

Checked on 2026-11-26 at `main` `4f06e17a`, read-only: `.ai/cezar/` (the runs, the automations and their receipts, the task worktrees), `~/.cezar/config.json` and the open pull requests.

### Ratings

| # | Course practice | Evidence in Trybun | Rating |
|---|---|---|---|
| 9.1 | Autonomy starts from a repeatable flow with a clear end and leaves evidence of the work, so the result is judged without replaying the session (L11) | 99 autonomous Cezar runs and 34 started by an automation. Every `om-auto-*` run ends in a labelled PR or issue with a summary comment (`SDLC.md`); Cezar keeps a handoff file and an event log per run (`.ai/cezar/runs/<id>.handoff.md`, `.ndjson`) | Full |
| 9.2 | The loop plans, builds, verifies and updates its knowledge; verification is the key step (L11) | `om-auto-create-pr`: execution plan, the validation gate after each phase and in full before completion, the review loop; `.ai/memory/` (Rule 7) | Full |
| 9.3 | The unit of work is an issue or a PR: labels say who works on what and when a person is needed, results go into comments, artefacts into the PR (L11) | The pipeline labels and the claim protocol of `SDLC.md`: an `in-progress` label, an assignee, a claim comment and a lock ref per item, so two runs never take the same work | Beyond |
| 9.4 | Each task runs in its own worktree and branch (L11, L13) | Cezar creates a worktree per task (`.ai/cezar/worktrees/<id>`, branch `cez/<id8>`); the `om-auto-*` skills check a PR out into a temporary worktree and remove it. 2.3: a task worktree links only the skills it needs. `.claude/skills/om-*` points to the main checkout's `.agents/skills/`, which `npx skills` installed from `skills-lock.json`, and the hashes of `om-auto-review-pr`, `om-auto-fix-issue` and `om-approve-merge-pr` in a task worktree match the main checkout. So tasks run the locked versions whenever the main checkout is installed from the lock (pinning by commit: #498) | Full |
| 9.5 | The agent can rebuild an ephemeral environment many times: Testcontainers, a test environment with migrations and seed (L11) | Integration tests on Testcontainers (`AGENTS.md`: never mock the database); `.ai/scripts/test-env-up.sh` with `om-prepare-test-env`, also Cezar's `startApp` | Full |
| 9.6 | An autonomous run starts only from an accepted specification with functional acceptance criteria and mockups ("garbage in, garbage out") (L11) | "Specification before implementation" (`SDLC.md`); the change template has Acceptance criteria; the prototype part is 5.16–5.20 | Full |
| 9.7 | Permissions match the environment: YOLO or auto mode only where isolation allows it (L11, L13) | Autonomous runs in Claude Code without a sandbox, on the maintainer's machine and token; the maintainer accepted this risk in step 7 (7.1, 7.4–7.8) | Different |
| 9.8 | The review of an autonomous run is independent: a new context, another model (L11) | Same session today (6.7); accepted as #537 (fresh context) and #525 (Codex for specifications); code by another model is step 11 | Partial – #537 |
| 9.9 | A strong coordinator with cheaper subagents for mechanical steps; tasks in a fresh context (L11, L13 dispatch) | 279 of 336 runs on Opus, 38 on Sonnet, 8 on Opus 1M, 7 on Fable; no rule says which model runs which task (1.21 is step 11). The loop engine dispatches executor subagents only above 20 Steps. Of 104 fix-issue runs, 31 peaked above 300k tokens (8.12) | Partial – after #537 |
| 9.10 | The WIP limit is the number of streams a person really reviews; don't generate PRs nobody will read and merge soon (L13 rule 1) | Cezar's `maxParallel: 2` (`~/.cezar/config.json`), but runs overlapped up to 7 at once. 15 pull requests are open:<ul><li>the release PR of release-please (#224), open by design;</li><li>five specification drafts of 2026-10-26 (#124–#128, S1-14 to S1-18) and #129 (S1-19, `changes-requested` since 2026-11-05);</li><li>six Dependabot updates of 2026-11-23 and a memory note in `merge-queue` (#474), which wait for the maintainer's merge;</li><li>#543 of this analysis.</li></ul>Nothing records whether the drafts are parked on purpose until their plan tasks come up. The queue in front of the maintainer, not the agents, is where work waits, as L13's Amdahl argument predicts | Partial |
| 9.11 | Interruptions are batched; agents end in a gate, not in a question; "needs you" is a filter (L13 rules 2–4) | Autonomous Cezar runs decide and report ("nobody is waiting to answer questions"); the review and QA gates end the run. The maintainer's own batching is personal practice and not assessed | Full |
| 9.12 | A workflow has at least one deterministic check as its own step, whose result goes back to the agent (L13) | The validation gate (`validation.commands`) runs inside the skill, and a failure goes back to the same run, which fixes and re-runs it; CI runs the same commands as required checks. Cezar's own workflow steps are not used: every planned run has one step | Full |
| 9.13 | At least one automation for maintenance, at night or on a trigger, with a received result (L13) | Daily at 06:30 UTC "Issues for alerts of the daily image scan" (34 runs, last on 2026-11-26: 3 open Trivy alerts, both vulnerabilities already in open issues, US$ 0.16). Its prompt still names the GitHub App of ADR 0005 for a 403, which ADR 0011 replaced | Full |
| 9.14 | Tasks are classified by whether they are disjoint and checkable without a person: in parallel, two or three at a time, in sequence, interactively (L13) | No classification of the backlog; issues carry category, priority and risk labels, not a mode of work | Missing |
| 9.15 | Cost per task is visible, and people are not measured by tokens or agents (L13) | Cezar records the cost per run: US$ 57 752 in total at API prices (October 9 169, November 48 583), median 13, largest 15 542 (S1-08, attachment backups). Whether the account pays API prices or a subscription was not checked | Full |
| 9.16 | A person decides every merge; nothing merges by itself (L13) | The maintainer's word in the session, ADR 0011; the automerge mode of the skills is not used | Full |

Not verified: why runs overlapped beyond `maxParallel` (dispatch subtasks, interactive sessions or a changed setting); the billing basis of Cezar's costs.

### Gap proposals

No new research was needed beyond the lessons' sources. Each proposal below rests on the measurements above and on the course's own sources (METR 2026, Faros AI 2025, ParallelPilot, Geng and Neubig 2026). The one exception is the WIP limit as a Kanban practice, which is own knowledge and is marked so.

- **9.10 The review queue – accepted: a review of the queue and a rule (#544).** The work that waits is waiting for the maintainer, not for agents. The review, done on 2026-11-26, found:

  | PRs | State | Recommendation |
  |---|---|---|
  | #462, #463, #472 (Dependabot) | all checks green | review and merge |
  | #459, #460, #461 (Dependabot) | `Format and lint` fails on the supply-chain check (§2.10): Dependabot updates the image in the Compose files, but the Testcontainers set-up of the integration tests pins the same image again (`apps/server/test/keycloak/keycloak.ts`, `clamav/clamav.ts`, `storage/seaweedfs.ts`), and the check requires both to match. #461 still failed after a rebase on 2026-11-26. #459 also failed an E2E test of the Accounts page on 2026-11-23 | the test pins updated on each branch; the duplicate pin itself is #547 |
  | #474 (memory note of #428) | conflicts with `main`; `Tests and coverage` failed on 2026-11-24 | rebase, re-run, then merge |
  | #124, #125, #126 (S1-14, S1-15, S1-16 drafts) | gated by `om-auto-write-spec` on the maintainer's confirmation of assumptions (Q1 of #124 builds on #123, merged since; Q1–Q3 of #125); next in the plan (order 7, after S1-20) | refresh against `main`, then the maintainer answers the gated questions |
  | #127, #128 (S1-17, S1-18 drafts) | gated the same way; plan order 8 | keep as drafts until order 8 |
  | #129 (S1-19) | `changes-requested` since 2026-11-05 (the link rule misses two team help pages) | the findings applied with `om-auto-continue-pr`, or closed |

  The rule: a draft specification PR states in its body what it waits for (the gated questions and its plan order), not only in a run comment. Cezar's `maxParallel: 2` already limits the agents. The WIP limit as a Kanban practice is own knowledge.
- **9.14 Classification of tasks – different on purpose.** With one maintainer, a limit of two parallel runs and one task per PR, a mode-of-work label has no consumer; the course's quadrants are applied when a batch is started.
- **9.9 Cheaper models for mechanical steps – moves to step 11** with the model per task (1.21). The new measurement of the fix-issue runs follows #537.
- **9.13 The automation's prompt** names the GitHub App of ADR 0005 for a 403. The automation is Cezar state (`.ai/cezar/`, "do not edit"), so the maintainer corrects the text in Cezar.

## Step 10 – Tests, fixes, QA (E2E, RED/GREEN, static analysis, `qa-*`)

Course sources: the eight leaves of L12, the eight leaves of L14 and the nine leaves of L18.

- **L12:** deterministic tests compared with an agent's verification; Playwright compared with `agent-browser`; the test environment; fifteen practices against flaky tests; `om-integration-tests` with a local override; the demo test; regression and fix; the homework.
- **L14:** preparation; testing at the edges; a bug report for an agent; the `om-auto-fix-issue` chain; "fixed" is a hypothesis; a second agent looks for regressions; static analysis; closing and merge.
- **L18:** the tester's role with AI; the QA skill pipeline; plan, runbook and parallel testing; sandbox and test data; `om-qa-buddy`; the layers of instructions; exploring a specification; PR #58 as an example; the homework.

The carried-forward rows of step 1 (1.18, test quality beyond executed lines) and of the #503 measurements (the leftover `trybun-test` infrastructure) are rated here as 10.6 and 10.14. Checked on 2026-11-26 at `main` `09e0ac3c`, read-only. The sources were:

- `docs/spec/18-code-patterns.md` §18.7;
- the skills;
- `.ai/qa/`;
- the issue templates;
- the bodies of the last 15 merged fix PRs of product code;
- `docker ps`.

### Ratings

| # | Course practice | Evidence in Trybun | Rating |
|---|---|---|---|
| 10.1 | Deterministic end-to-end tests guard against regressions in CI: a browser framework, an isolated environment, readable scenarios (L12) | Playwright in CI on phone, tablet and desktop with axe and the Lighthouse budget (21 specification files in `apps/web/e2e/`); 48 integration specifications on Testcontainers (45 in `apps/server`, 3 in `apps/web`); component tests in jsdom (ADR 0012); story tests in Chromium. A one-off agent verification (`om-auto-qa-pr`) is kept apart from the tests | Beyond |
| 10.2 | The practices against flaky tests (L12 lists fifteen): behaviour, one case per scenario, Given–When–Then, determinism (no `wait(5000)`, fixed clock), independence, the shortest set-up, external integrations replaced at the boundary, positive, negative and boundary cases, idempotency, stable selectors (role, label, text), concrete assertions, names "action + condition + result", AI-written tests reviewed (L12) | §18.7 covers most of them: business rules as `it.each` tables from the specification, each integration test with its own factories, test doubles only at external boundaries (MSW, the fixed clock), never mocking the project's own services or the database, page objects with `getByRole`, never CSS classes. Two `waitForTimeout` calls remain, both waiting for a real clock period: the TOTP window and a tap delay. Given–When–Then is not a rule. Flaky tests still recur (four classes, step 12) | Full |
| 10.3 | Scenarios are also written in Markdown for testers and agents, linked to the test code, by area (`.ai/qa/{AREA}/…`), through a local override of `om-integration-tests` (L12) | No Markdown scenarios: the test names and the specification's acceptance criteria are the scenarios. No override of `om-integration-tests` | Different |
| 10.4 | A failing test is fixed at its root by the chain (`om-auto-fix-pr`, `om-integration-tests`), never by weakening the test (L12) | `AGENTS.md` ("Never disable, skip or weaken tests…"); `om-auto-fix-pr` installed; the flaky-test rule of the maintainer: a test that fails on `main` gets an issue and a root-cause fix (#496, #502, #511, #514, #520, #522, #523) | Full |
| 10.5 | Testing at the edges: empty states, boundaries, time, money, permissions (L14) | Required by the risk table of `SDLC.md` (auth, data scoping, money, migrations) and by §18.7 (cases of the specification); `CODE_REVIEW.md` checks only the states of Storybook stories, not the states of a screen (#499). The recurring user-visible defect is a missing loading, error or "too many requests" state: 7 fix PRs (#499) | Partial – #499 |
| 10.6 | "Fixed" is a hypothesis: the same test is red on the old code on the right assertion and green on the fix (L14) | `om-fix` requires "a unit test that fails without your fix and passes with it". 10 of the last 15 merged fix PRs of product code record the red run in their body (the 15 most recent merged PRs titled `fix(web|server|ui|contracts|i18n)` on 2026-11-26, searched for a red run or a failure without the fix). 1.18: beyond executed lines, #493 (the coverage of changed lines); mutation testing is decided in step 11 (#549) | Full |
| 10.7 | A bug report an agent can act on: where, how to reproduce, expected, actual, a suggested direction, short (L14, Waterloo/Microsoft study) | `om-prepare-issue`; `.github/ISSUE_TEMPLATE/bug_report.yml`; the Definition of Ready of `SDLC.md` ("for a bug, ready means reproducible", `om-verify-in-repo`) | Full |
| 10.8 | The autonomous fix chain: verify → root cause → fix → open PR → review, which may stop with `NO_ACTION_NEEDED` (L14) | `om-auto-fix-issue`, 124 Cezar runs ("Fix GitHub issue", 104 of them with a session transcript of more than three turns, step 8); `SDLC.md` Triage and Implement stages | Full |
| 10.9 | A second agent in a new session, of another model, looks for regressions (L14) | 6.7: the review runs in the author's session; #537 and #525; code by another model is step 11 | Partial – #537 |
| 10.10 | Deterministic static analysis as a merge gate: SAST with data flow, SCA, Dependabot; a quality gate as a required check (L14) | CodeQL on every PR and push, a required check; Dependabot, `dependency-review`, the advisory audit, Trivy; lint and type check. No SonarQube | Full |
| 10.11 | The merge gate checks that the evidence belongs to the current head (L14 `om-approve-merge-pr`) | `om-approve-merge-pr` compares `QA head:` with the PR head; the QA gate of `SDLC.md`; the maintainer merges by hand after green required checks | Full |
| 10.12 | A tester works in parallel with AI: a plan and runbook before the first click, an independent human pass, the results compared, a human verdict, a knowledge base kept also without defects (L18 `om-qa-buddy`) | The QA reviewer role, `needs-qa` → `qa-approved` owned by a person (`SDLC.md`); `om-auto-qa-pr` (3 Cezar runs) and `om-qa-buddy` installed; `.ai/qa/knowledge-base/` has `module-history.md` (6 sessions from 2026-11-19 to 2026-11-23, verdicts and defect counts) and `risk-hotspots.md`. No runbook is published before a run, and no comparison of a human pass with the AI's is recorded | Partial |
| 10.13 | Before a module is tested, its specification is explored for rules, risks and ambiguities, ending in a test charter (L18) | Not done as a QA practice; the specification review of `om-auto-review-pr` covers ambiguity at the design stage | Missing |
| 10.14 | The test environment is disposable and does not linger (L11, L12) | `.ai/scripts/test-env-up.sh` and `test-env-down.sh`. On 2026-11-26 the six containers of the Compose project `trybun-test` had been up for 34 hours, and `.ai/qa/test-env.json` says `status: stopped`, `mode: discovered`, `servicesStartedByScript: false`: a run that finds the infrastructure running adopts it and, by design, does not stop it. Which run started it could not be determined: the descriptor of the starting run was overwritten by the adopting one | Partial |

### Gap proposals

The maintainer decided on 2026-11-26. No proposal brings in a new practice, so no research beyond the lessons' sources was needed.

- **10.3 Markdown scenarios – different on purpose.** The acceptance criteria of the change specifications and the test names (§18.7) are the scenarios. A second description of each case in `.ai/qa/` would drift from the test and has no reader beyond the agents.
- **10.12 A runbook and a human pass in parallel – adopted by the maintainer, no change to the repository.** The maintainer uses `om-qa-buddy` for `needs-qa` work. It publishes the plan and runbook before it tests and keeps `.ai/qa/knowledge-base/`. The skill is installed and configured (`browser.provider: agent-browser`).
- **10.13 Exploring a specification before testing – not adopted.** `om-qa-buddy`'s plan step and the specification review cover it.
- **10.5 Missing states – #499**, already open.
- **10.14 The leftover test infrastructure.** The six `trybun-test` containers were stopped on 2026-11-26 with `docker compose -p trybun-test stop`, which keeps their volumes. `test-env-down.sh` keeps leaving adopted infrastructure running by design; it is reopened if a leftover environment is found again.

## Step 11 – Review and acceptance (deterministic gates, branch protection, multi-model review)

Course sources: the seven leaves of L17 and the ten leaves of L21.

- **L17:** the mental model and DORA 2025; whose move in the PR queue; `om-review-prs`; branch protection by ruleset; how much automated review finds; deterministic gates; the homework.
- **L21:** preparation; the three roles; correlated errors and three review rules; Cezar's multi-model mode; the two prompt examples; the multi skills in Claude Code; routers, panels and reviewers of other vendors; weaker models in a council and when it pays; the homework.

The carried-forward rows rated here:

- 1.21, the model per task (as 11.9);
- step 2, the PRs merged without a review (as 11.5);
- steps 8 and 9, the new measurement after #537 (as 11.9).

Checked on 2026-11-26, read-only: the rulesets (`gh api …/rulesets`), the reviews of the 77 PRs merged from 2026-11-19 to 2026-11-26 20:30 UTC (`main` `9e0bb259`), and the size of the 72 PRs titled `feat(…)` or `fix(…)` with a scope of product code (`web`, `server`, `ui`, `contracts`, `i18n`) among the 300 most recently merged on the same day.

### Ratings

| # | Course practice | Evidence in Trybun | Rating |
|---|---|---|---|
| 11.1 | A person owns both ends: the requirements and the merge decision (L17) | Change specifications and ADRs are approved by the maintainer (Rule 8, ADR 0011); every merge is the maintainer's word or a workflow the maintainer runs | Full |
| 11.2 | Whose move in the queue is read from the labels and the PR's history, not from the label alone (L17) | The pipeline labels, the claim protocol and the author hand-off of `om-auto-review-pr` (`SDLC.md`); one maintainer, so the queue is small (9.10) | Full |
| 11.3 | The whole queue is reviewed by `om-review-prs`, each review in a fresh subagent (`--subagents --parallel`), with its blind spots known (L17) | Installed, 0 runs. The skill skips PRs by the person who runs it, and every PR here is the maintainer's or Dependabot's, so the course's own note applies: an empty list is the correct result | N/A |
| 11.4 | The branch is protected by a ruleset: PR required, an approval by someone else (solo: an admin bypass for PRs only), approval of the last push, resolved conversations, no deletion or force push (L17) | "Protect main" (the default branch and `release/*`): PR required, squash only, no deletion, no force push, 13 required status checks, no bypass actors. No approval required (ADR 0011: the agents act as the maintainer, who cannot approve their own PR), so neither last-push approval nor resolved conversations apply | Different |
| 11.5 | Automated review is a sieve, not a gate: every PR gets one, the reviewer sees the diff and the specification without the author's rationale, several independent passes, small PRs (L17) | Of the 71 non-Dependabot PRs merged from 2026-11-19 to 2026-11-26 20:30 UTC, 24 have no review at all. They are: <ul><li>9 product code or its tests (#429, #478, #497, #507, #512, #515, #516, #518, #536);</li><li>4 the agents' tooling (#455, #466, #521, #529);</li><li>1 a specification (#513);</li><li>10 the steps of this analysis.</li></ul> They come from interactive sessions, including the one writing this analysis, where `om-auto-review-pr` is not part of the flow. The Definition of Done still says "Reviewed and approved – by a human or the review and QA gates". Size of the merged `feat`/`fix` PRs of product code: median 236 changed lines, p75 536, p90 2 415, 24 of 72 over 400. One review pass per PR; the reviewer reads the PR description | Partial |
| 11.6 | Deterministic gates beyond the model: specialised review skills, mutation testing (StrykerJS), API fuzzing (RESTler), a size limit of what the browser downloads (L17) | Size: `pnpm build` fails when Zod enters the first load of the application shell, and the Lighthouse budget runs on every PR (#508, #523). The coverage thresholds of CI hold. No mutation testing, no API fuzzing, no specialised skill beyond `ui-component` | Partial |
| 11.7 | A bug that came back despite review gets a deterministic check, red on the old code and green on the fix, required before merge (L17) | The flaky-test rule (an issue and a root-cause fix for each, 10.4) and the regression test of every fix (10.6). The recurring class of missing states has #499, a review rule, not a check | Partial |
| 11.8 | Reviewers of at least two model families get the diff, the specification, the criteria and the repository rules, without the implementer's rationale; every finding, even a single reviewer's, is checked (L21) | All 336 Cezar runs use Claude. #525 adds a blind Codex review of specification PRs; code PRs have none. 6.7 and #537 cover the fresh context | Missing – #525 for specifications |
| 11.9 | The model for each role is chosen, recorded with a date and checked again, because a newer version is not always better (L21) | No configuration of models per role: 287 of 336 runs on Opus (8 of them with the 1M window), 38 on Sonnet, 7 on Fable, no rule which (1.21) | Missing |
| 11.10 | The multi-model flow (orchestrator, one implementer, a council of reviewers, three rounds) is used for large features from a full specification, not for small fixes (L21) | Not used. Its skills (`om-implement-feature-multi`, `om-harness`) leave staged changes without a PR; `om-harness` arrives with #525 | N/A until #525 |

### Gap proposals

The maintainer accepted every recommendation on 2026-11-26.

- **11.5 Every PR gets a review – #537, extended.** The 24 PRs merged without a review came from interactive sessions. #537 now also asks an interactive session to have a fresh-context review posted on its PR before it asks the maintainer to merge. The sources:
  - SWE-PRBench (L17): one pass finds 15–31 % of the issues people report;
  - SWR-Bench: combining passes finds more;
  - the size of a PR is the strongest predictor of review quality.

  Several passes and a PR size limit wait for the measurements after #537.
- **11.6 Mutation testing – a trial first: #549.** StrykerJS on the permission layer, the code where step 7 found that review by a model does not find defects. Whether it becomes a gate is decided from its report. API fuzzing (RESTler) is deferred: L17 found nothing on a small application, and Trybun's integration tests already exercise the endpoints with denials.
- **11.8–11.10 Another model family, the model per role, the multi-model flow – deferred until #525 has results.** The evidence disagrees:
  - **For another family:** Greptile measured 8–9 points more serious bugs found by a reviewer of another vendor.
  - **Against Codex on Claude's code:** Xiang et al. found that Codex reviewing Claude's code lowered the result (91.4 % → 82.8 %).
  - **The open question:** what Codex adds on Trybun's specifications. That is measured by #525, from how many of its findings are real.
- **11.4 Branch protection – different on purpose**, ADR 0011.

## Step 12 – CI workflows: necessity, correctness and efficiency; flaky tests

There is no lesson for this step. The yardsticks are GitHub's workflow syntax and "Secure use" documentation, the audits of zizmor and actionlint, and the practice of flaky-test handling at Google, Meta, Microsoft, Spotify and GitLab together with the studies behind it.

The step had three research passes on 2026-11-26:

- an audit of the six workflows, the composite action `setup`, `dependabot.yml`, `dependency-review-config.yml` and `labels.yml`. It was done by hand: running actionlint and zizmor from their Docker images was refused by the session's permission check, so it is not the tools' output;
- the docs-only path of CI;
- flaky tests.

The carried-forward rows of step 12 are rated here.

### Ratings

| # | Practice | Evidence in Trybun | Rating |
|---|---|---|---|
| 12.1 | Actions pinned by commit SHA, the SHA matching its tag | All 17 action references pinned by SHA, each matching its `# vX` comment (annotated tags dereferenced through the API); `pnpm lint` enforces the pinning (`scripts/check-supply-chain.js`) | Beyond |
| 12.2 | Least privilege: `permissions` empty or read at workflow level, raised per job; no credentials left in checkouts | `{}` or `contents: read` at workflow level, write only per job and `contents: write` only in the environment-gated `publish`; `persist-credentials: false` on every checkout. The GitHub App tokens of `release.yml` (lines 34–37, 65–68) carry every permission of the app, while `create-github-app-token` v3.3.0 can narrow them (`permission-contents`, `permission-pull-requests`) | Full |
| 12.3 | No dangerous triggers or template injection | No `pull_request_target`, `workflow_run`, `secrets: inherit` or self-hosted runner; the PR title and SHAs reach `run:` through `env:`. Only a static `${{ matrix.service }}` is interpolated into `run:` (`release.yml` line 200), which zizmor's pedantic mode flags | Full |
| 12.4 | Shell steps fail on any failed command | No `defaults.run.shell`, so `run:` uses `bash -e` without `pipefail`. In `image-scan.yml` line 44 `node … supported-series … \| tee -a "$GITHUB_OUTPUT"` stays green when `node` fails. The `current` and `previous` slots then come out empty, and the empty SARIF uploads (lines 126–133) close every open alert of those categories. `release.yml` line 200 (`docker save … \| gzip`) has the same gap, which the restore test catches later | Partial |
| 12.5 | No cache in a privileged release path | `aquasecurity/trivy-action` in the `images` job of `release.yml` (line 181) keeps its default `cache: 'true'`. At the pinned SHA it restores the Trivy binary and database from caches that any job on `main` can seed, next to the Docker socket and before `docker save`. The pnpm store cache is used only outside `release.yml` | Partial |
| 12.6 | One toolchain in every job | The `audit` job of `ci.yml` (lines 122–133) has no `setup-node`, so it runs on the runner's Node, not `.node-version` | Partial |
| 12.7 | Work on a PR matches what the PR changes, while the required checks stay honest | Every PR runs every job. On PR #548, which changed only `.ai/`, `E2E and Lighthouse` took 13.3 min and `Tests and coverage` 7.5 min. A workflow-level `paths-ignore` would leave the required checks pending (GitHub: "Avoid requiring workflows that can be skipped"). A job skipped by `if:` reports Success, also when the job it depends on failed | Partial |
| 12.8 | A workflow re-runs only when its input changed | `commitlint.yml` runs on every `edited` event, also on body edits, and cancels the run in progress. The new run checks the same head SHA and the required check takes its result. Skipping body-only edits with `if:` would let a skipped run report Success for a SHA whose commits were never checked. Kept as a documented trade-off: about 40 s per edit | Full |
| 12.9 | One source of truth for the labels | `.github/labels.yml` lists 33 labels and nothing reads it; GitHub has 50. The same taxonomy is in `.ai/agentic.config.json` and in `ensure-label-taxonomy` of `.ai/trackers/github.md` | Partial |
| 12.10 | Dependabot covers every pin | The `docker` and `docker-compose` entries cover the Dockerfiles and both Compose files. The image pins of the integration tests are TypeScript literals that Dependabot cannot read | Partial – #547 |
| 12.11 | Flaky tests are detected and reported with evidence, and a class that comes back gets a class-level fix | The rule holds: an issue and a root-cause fix for every failure on `main`. But Playwright has `retries: 0` and no `failOnFlakyTests`, and Vitest no `retry`, so a flake shows as an unrelated red PR that "passed on re-run" (#495, #500, #502). The flake rate is unknown; there is no `flaky` label. Fixed waits are not linted (`eslint-plugin-playwright` not used; two `waitForTimeout`, both justified). Four classes came back after a fix:<ul><li>animations under axe, #502 → #514;</li><li>lazily loaded modules, #496 → #511;</li><li>the simulated LCP and the calibrated slowdown, #503, #523;</li><li>programs checked before they started, #520, #522, #528.</li></ul> | Partial |
| 12.12 | CI duration | The options of the carried-forward row were weighed in #510 and closed as not now on 2026-11-26 (Vitest shards wait for vitest 5.1.2); self-hosted runners were rejected for security | Decided – #510 |

Checked and found fine:

- every job has `timeout-minutes`;
- CI and CodeQL cancel only on PRs;
- both scheduled workflows have a consumer: the advisory issue, and the code scanning alerts;
- `lychee` runs offline;
- the job logic of `release.yml` (`!cancelled() && … == 'success'`) is sound;
- `dependency-review` encodes the scoped package correctly.

### Why the flaky fixes did not hold

The studies (Luo et al., FSE 2014: async wait 45 %, concurrency 20 %, test order 12 % of 201 fixes; Parry et al. 2021 and 2025) match the four classes:

- **Animations under axe (#502 → #514).** The fix waited for a signal that stands in for the settled state – the animations running at that moment – instead of the state itself, and missed animations not yet started on WebKit.
- **Lazily loaded modules (#496 → #511).** Five specs had raised their timeouts. Luo et al. found that a longer wait is what machine speed undoes. The cause was shared across tests, as Parry et al. (2025) found for 75 % of flaky tests, so fixing one test left the others.
- **Measurement noise (#503, #523).** A hard limit on a noisy metric fails by construction until its margin is measured against the variance of the runner.
- **Race conditions in the shell stubs (#520, #522, #528).** Each race was fixed on its own; Luo et al. found no single strategy for concurrency.
- **Verification.** Fixes were verified by repeat loops on an idle machine, while the variance shows on loaded runners. Parry et al. found CPU stress surfaces flakes faster.

### Gap proposals

The maintainer accepted all four on 2026-11-26:

- **12.2–12.6 – #552.** `defaults.run.shell: bash`, which brings `pipefail`; `cache: false` for Trivy in the release; narrowed App tokens; `matrix.service` through `env:`; `setup-node` in `audit`.
- **12.7 – #553.** A docs-only path behind one gate, specified first:
  - a `changes` job with plain `git diff`, as in CPython, because `tj-actions/changed-files` was compromised (CVE-2025-30066);
  - a fail-closed allowlist: `.ai/**`, and `docs/**` except `docs/user/**`;
  - the expensive jobs skipped only on docs-only PRs, everything on `push` to `main`;
  - `re-actors/alls-green` as the required check in place of the five application checks, the ruleset changed by the maintainer.
- **12.9 – #554.** `.github/labels.yml` removed; `.ai/agentic.config.json` stays the source.
- **12.11 – #555.** The rule stays, with evidence and classes:
  - Playwright `retries: 1` with `failOnFlakyTests: true` in CI;
  - a `flaky-test` label with a cause label, after GitLab's list;
  - a class-level fix when a class comes back;
  - the recommended rules of `eslint-plugin-playwright`;
  - `--repeat-each` under CPU stress for every flaky fix;
  - a pattern catalogue by class in `.ai/memory/e2e.md`;
  - quarantine rejected, after Habchi et al. 2021.

Found while committing this step: `.ai/tmp/`, where the review skills check out pull requests, is not ignored (#556). Kept: the `edited` trigger of `commitlint.yml` (12.8). Tracked elsewhere: the test image pins (#547) and CI duration (#510).

## Step 13 – Releases and deployment (triage, changelog, compatibility, preview per PR)

Course sources: the nine leaves of L22 and the four leaves of L24.

- **L22:** release management; the environment and Cezar on a VPS; triage of issues; the PR queue; preview, snapshots and nightly; preparing release 0.8.0; backward compatibility and upgrade notes; the changelog example; the homework.
- **L24:** the release 0.1.0 and its changelog; the release workflow; the options of deployment; Dokploy and Railway.

The carried-forward row of step 7 (the threat model before `1.0.0`) is rated here. Checked on 2026-11-26, read-only:

- `release.yml`, §2.11 and §15.7 of the specification, `BACKWARD_COMPATIBILITY.md`, `CHANGELOG.md`;
- the GitHub Releases;
- the open release PR #224.

### Ratings

| # | Course practice | Evidence in Trybun | Rating |
|---|---|---|---|
| 13.1 | A release has a defined scope, a point in the code and evidence of verification; people decide that it is ready (L22) | release-please keeps the release PR with the next version from the commits; the maintainer merges it; the tag `vX.Y.Z` and a draft release follow, then images built and scanned, SBOMs, the deployment package, a restore test and publication behind the GitHub Environment `release` (§2.11, ADR 0006) | Beyond |
| 13.2 | The changelog is generated from the merged PRs, grouped, with highlights and authors (L22, L24 `om-auto-update-changelog`) | Generated by release-please from Conventional Commits (Keep a Changelog: Added, Changed, Fixed), with links to PRs and commits; no highlights paragraph and no contributor list | Full |
| 13.3 | Breaking changes are protected by `BACKWARD_COMPATIBILITY.md`, and a needed one gets upgrade notes and a migration (L22) | `BACKWARD_COMPATIBILITY.md` (protected contract surfaces); a breaking change is marked `!` or `BREAKING CHANGE:` with the steps required from the Administrator, which reach the release notes (§2.11, Rule 11); `./trybun update <version>` shows the `CHANGELOG.md` entries between the versions, asks on a MAJOR change, backs up before any change, then migrates (§15.7). No separate `UPGRADE_NOTES.md`; the changelog carries the steps | Full |
| 13.4 | The release is repeatable from one action, with a tag to return to and protection against overwriting history (L24) | release-please and `release.yml`; the ruleset "Protect release tag"; the maintainer approves publication; release candidates `X.Y.Z-rc.N` by "Run workflow", deployed to the test environment; maintenance branches `release/X.Y.x` | Beyond |
| 13.5 | Rollback: the previous version can be restored, tested (L22 homework) | An automatic backup before every update (§15.7); the restore test runs in the release pipeline before publication (`restore-test` job); a restore that cannot work is refused before Trybun stops (#248) | Beyond |
| 13.6 | Issues are triaged into a queue from which the release scope is chosen (labels, milestones) (L22 `om-auto-manage-issues`) | Category, priority and risk labels from `SDLC.md`; issue templates; the implementation plan orders the work (`docs/plan/`); no milestones. One maintainer and a small queue | Full |
| 13.7 | Fixed issues are closed with a link to the fix on the release branch (L22 `om-close-fixed-issues`) | Closing keywords in PR bodies (`Closes #N`), so GitHub closes the issue at the merge into `main`, the release branch | Full |
| 13.8 | A preview environment per PR, so QA needs no local set-up (L22, L24) | None. QA runs locally on the disposable test environment (`test-env-up.sh`, Cezar's Preview); release candidates go to the maintainer's test installation on the VPS. Trybun is a self-hosted product without a hosting platform | Different |
| 13.9 | The release is deployed and checked on a real scenario, not only a green build (L24) | The test installation on the VPS (`.ai/memory/docker.md`); the update command checks the health checks of every service; the restore test boots the restored installation | Full |
| 13.10 | Releases follow the work instead of piling up (L22: choose the changes of a release and stabilise them) | The last release is `v0.4.0` of 2026-11-03. The release PR `0.5.0` (#224) has collected the work of three weeks: S1-04 to S1-13, the attachments, comments, visibility, the team list. The plan's stage 1 is not complete | Partial |

The threat model before `1.0.0` (carried from step 7) stays a trigger of the first `1.0.0` release.

### Gap proposals

- **13.10 – a decision of the maintainer, no issue.** When to release `0.5.0` is the maintainer's choice (§2.11). A release candidate `0.5.0-rc.1` on the test installation would test the deployment package and the update path of three weeks of changes before they grow further. It is the procedure §2.11 already describes.
- **13.2 – no change.** A highlights paragraph and a contributor list would mean replacing release-please's generator, or writing by hand what Rule 11 forbids. With one contributor, the list has no reader.
- **13.8 – different on purpose.** A self-hosted product has no hosting platform to give each PR a preview. The local QA environment and the release candidates on the test installation cover the same need.
