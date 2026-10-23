# Scope of the coverage measurement

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-10-21 |
| Plan task | `S0-02` |
| System specification sections | §2.14, §18.7 |
| Related issues / PRs | #5 (approval), #8 (S0-02) |

## Context

[§2.14](../../../docs/spec/02-agent-rules.md) ("Automated quality gates") sets coverage thresholds for every pull request: lines ≥ 80 % and branches ≥ 75 % for the domain modules of `apps/server` and `@trybun/contracts`, lines ≥ 70 % for every other package and application, measured with Vitest and V8 coverage, with E2E tests not counted.

Two things the CI pipeline of task S0-02 needs are not specified:

1. **Which tests count.** Only E2E tests are excluded. Unit tests (`*.spec.ts`, `pnpm test`) and integration tests (`*.integration.spec.ts`, `pnpm test:integration`) run as separate commands ([§18.7](../../../docs/spec/18-code-patterns.md), [§15.12](../../../docs/spec/15-deployment.md)), so it is open whether the thresholds apply to the unit run alone or to both runs together. Following "functional core, imperative shell" ([§18.1](../../../docs/spec/18-code-patterns.md)), services are integration-tested only; measuring unit tests alone would count every service of `apps/server` as uncovered.
2. **Which files are measured.** Nothing says which files may be excluded from the measurement. Without a rule, each task decides on its own, the thresholds can be met by excluding code, and entry points, generated code and configuration lower the result although testing them adds nothing. The rule against suppressions ([§2.14](../../../docs/spec/02-agent-rules.md), "Fix the cause, never the gate") forbids comments in the code but does not say whether exclusions in the Vitest configuration are allowed.

## Goals

- One unambiguous definition of the coverage measurement before the CI gate is built in S0-02.
- The thresholds measure tested code, not bootstrapping, generated code or tooling.
- Exclusions are visible, reviewed and closed – never decided case by case in a task.

## Non-goals

- Changing the threshold values.
- New gates (coverage of changed lines, a no-decrease rule, mutation testing). They can be proposed separately.
- Choosing the exact Vitest options; they belong to the implementation in S0-02.

## Proposed change

### Tests counted

- Unit tests and integration tests both count. The CI pipeline collects coverage of both runs and checks the thresholds once, on the **combined** result.
- E2E tests stay excluded, as today.
- The thresholds are a CI gate. A local `pnpm test` or `pnpm test:integration` run may report coverage but does not fail on the thresholds, because a single run does not see the other half of the tests.

### Files measured

Coverage is measured for the source files of every application and package, except the following closed list:

| Excluded | Examples | Reason |
|---|---|---|
| Test code | `*.spec.ts(x)`, `*.integration.spec.ts`, the `test/` folders (factories, MSW handlers, set-up), `e2e/` | Not product code |
| Storybook stories | `*.stories.tsx` | Documentation of components; components are tested by their own tests |
| Process entry points that only bootstrap | `apps/server/src/main.ts`, `apps/server/src/worker.ts` | Start-up wiring; covered by starting the built application (S0-01) and by E2E tests |
| Generated code | Prisma client, `openapi-typescript` types, Keycloak theme messages generated from `@trybun/i18n` | Not written by hand; its source is tested |
| Configuration files | `*.config.ts`, `*.config.mjs` (Vitest, Next.js, Playwright, ESLint, Prisma) | Tooling, not product code |
| Type declarations | `*.d.ts` | No runtime code |
| Database seed scripts | `apps/server/prisma/seed.ts` and the demo dataset | Tooling; the demo data is exercised by E2E tests |

- The list lives in [§2.14](../../../docs/spec/02-agent-rules.md) and in one shared Vitest coverage configuration. Adding a pattern to it is a specification change for approval.
- Coverage-ignore comments in the code (`/* v8 ignore … */`, `/* istanbul ignore … */`, `/* c8 ignore … */`) are suppressions and are not allowed, like `@ts-ignore` and lint-disable comments.

## Changes to the system specification

| Section | Change |
|---|---|
| §2.14 "Automated quality gates" | After the coverage thresholds table: unit and integration tests count, checked on the combined result in CI; the closed list of excluded files; coverage-ignore comments are suppressions and not allowed |
| §2.14 "Working practices" ("Fix the cause, never the gate") | Name coverage-ignore comments among the forbidden suppressions and adding exclusions to the coverage configuration among the forbidden ways of weakening a gate |
| §18.7 | One sentence: integration tests count toward coverage ([§2.14](../../../docs/spec/02-agent-rules.md)) |
| Implementation plan, S0-02 | "unit tests with coverage thresholds" → "unit and integration tests with coverage thresholds on the combined result ([change specification](2026-10-21-coverage-measurement-scope.md))" |

New or changed glossary terms: none.

## Open questions

Implementation must not start until every question has an answer.

1. Do integration tests count toward the coverage thresholds? — **Proposed answer:** yes, on the combined result of both runs (see "Tests counted"). Approved by merging this specification.
2. Is the list of excluded files complete and acceptable? — **Proposed answer:** yes, the closed list in "Files measured". Approved by merging this specification.

## Acceptance criteria

- [x] A pull request whose combined unit and integration coverage meets the thresholds passes, although its unit coverage alone is below them.
- [x] A pull request whose combined coverage is below a threshold is blocked.
- [x] `main.ts`, `worker.ts`, generated code, configuration files, stories and test code do not appear in the coverage report.
- [x] A `/* v8 ignore */` (or `istanbul` / `c8`) comment in the source fails CI.
- [x] §2.14, §18.7 and the S0-02 task describe the measurement as above.
- Works on phone, tablet and desktop (Rule 9): not applicable – no user interface.
- User documentation and product tour: not applicable – no user-facing change.

## Changelog

- 2026-10-21 – Created.
- 2026-10-21 – Approved by merging #5.
- 2026-10-21 – Implemented in S0-02: root `vitest.config.ts` (`pnpm test:coverage`), lint rule `no-warning-comments` against coverage-ignore comments, §2.14, §18.7 and the plan updated.
