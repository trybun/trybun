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

### Carried forward

Questions found in one step that belong to a later one. Each step reads its rows before it rates, and the final review pass checks that none is left open.

| Step | Question | Found in |
|---|---|---|
| 6 | When a run log in `.ai/runs/` is written outside the `om-auto-*` skills (1.7) | step 1 |
| 8 | Nested `AGENTS.md` files per folder (1.4) | step 1 |
| 9 | Whether Cezar provisions the locked skill versions into its tasks (2.3, #498) | step 2 |
| 10 | Test quality beyond executed lines, e.g. mutation testing (1.18, #493) | step 1 |
| 10 | The Compose infrastructure `trybun-test` was running without a descriptor in `.ai/qa/` (up 41 h on 2026-11-25); `test-env-up.sh` adopted it as `discovered`, so `test-env-down.sh` leaves it running by design. Who started it, and whether a leftover environment should be found and reported | #503 measurements |
| 11 | Model per task (1.21) | step 1 |
| 11 | Four pipeline PRs merged without a review (#429, #455, #466, #478), with `required_approving_review_count: 0` in the ruleset "Protect main" | step 2 |
| 12 | `ci.yml` and `codeql.yml` run every job on every pull request, also on documentation only (about 12 min; #495 failed on the flaky Lighthouse budget). A path filter on the workflow would leave the required checks unreported and block the PR, so the question is a job-level condition. Risks to research: Markdown that is part of the application (help pages in `apps/web`), the required CodeQL check, pushes to `main` | #506 |
| 12 | Flaky classes that came back after a fix: animations under axe (#72, #270 → #502, and again after its fix → #514) and the simulated LCP (#163, #372 → #503). A third class: lazily loaded modules in component tests (#326, #496 → #511), which five specs had worked around with longer timeouts. A fourth: a background program checked before it has run, in the stubs of `test-env-up.spec.js` (#520, #522). And the calibrated Lighthouse slowdown (#515) failed to converge on a noisy runner (#523). Why the earlier fixes did not hold, and how flaky tests are detected and reported (quarantine, retry reports) | step 3 |
| 12 | `.github/labels.yml` lists 33 labels, GitHub has 50, and no workflow or script reads the file | step 2 |
| 12 | Editing a PR body re-runs `Commit messages and title` and cancels the run in progress, which shows as a cancelled check next to the passing one (#504, #506) | #506 |
| 12 | A CI run takes 11.5–14 min. The critical path is `pnpm test:coverage` (389–642 s) and `pnpm e2e` (472–633 s); the spread follows the runner pool (AWS fast, Azure slow, read from the `Cloud:` line of the job log). An idle VPS ran `pnpm test:coverage` in 249 s (9908 tests, warm Testcontainers images). Self-hosting is advised against: GitHub's secure-use docs say self-hosted runners should almost never serve public repositories, the PyTorch and runner-images compromises and the Shai-Hulud 2.0 worm used them, and the VPS holds the maintainer's `gh` credentials, the agents' worktrees and the QA stacks, with the `docker` group root-equivalent. Options to weigh: Vitest shards with thresholds checked on the merged coverage, Playwright shards with merged reports, Lighthouse as its own job, the infrastructure started early, one gate job (`re-actors/alls-green`) or the kept check names for the ruleset; then a managed per-job-VM runner (Ubicloud, Blacksmith, Namespace). Larger GitHub runners need a paid plan | session 2026-11-25 |
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
