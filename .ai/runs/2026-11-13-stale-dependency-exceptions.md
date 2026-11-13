# Execution plan — Stale exceptions of `pnpm-workspace.yaml` in the daily advisory audit

**Source doc:** `.ai/specs/implemented/2026-11-13-stale-dependency-exceptions.md` (spec PR #335, issue #333)
**Branch:** `feat/stale-dependency-exceptions` · **Base:** `main`

## 🎯 Goal

The daily advisory audit also reports stale exceptions of `pnpm-workspace.yaml` – `minimumReleaseAgeExclude` entries older than `minimumReleaseAge`, and `auditConfig.ignoreGhsas` entries whose advisory gained a fix or was withdrawn – in a *Stale exceptions* section of the existing tracking issue, which stays open while advisories or stale exceptions remain.

## Scope

- `scripts/advisory-audit.js`: `parseConfig`, `checkExceptions` (injected `now`, `publishTime`, `advisory`), the *Stale exceptions* section and its marker, `planSync` and `sync` over both sets, the registry `fetch` and `gh api /advisories/…` lookups with retries.
- `scripts/advisory-audit.spec.js` and fixtures in `scripts/fixtures/advisory-audit/` (`pnpm config list --json` of this repository; advisory API responses for GHSA-g3hv-75wg-m249, GHSA-gcqx-w48m-w2h4, GHSA-vfj7-8cjw-p6xm).
- `.github/workflows/advisory-audit.yml`: the `pnpm config list --json` step.
- `pnpm-workspace.yaml`: remove the withdrawn GHSA-vfj7-8cjw-p6xm; comments above both settings.
- §2.10, `README.md`, `.ai/memory/toolchain.md`; the spec moves to `.ai/specs/implemented/` with status `implemented`.

## Non-goals

- Removing entries from the job, unneeded `overrides` and exclusions outside the lockfile (#337), the PR gate, `.trivyignore.yaml`.

## Risks

- The workflow runs on GitHub only after merge (spec step 6); the logic is covered by unit tests with injected lookups and fixtures captured from the real registry and API.
- Network lookups can fail; retries, then a failed run with the issue untouched (spec Q7).

## Progress

PR: #339

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Stale exceptions in the daily advisory audit

- [x] 1.1 Fixtures and parseConfig with unit tests — 6822827
- [x] 1.2 checkExceptions with injected lookups and unit tests — 6822827
- [x] 1.3 Stale exceptions section, marker and planSync over both sets — 6822827
- [x] 1.4 sync wiring, registry and advisory lookups, workflow step — 6822827, 3fcbde3
- [x] 1.5 Remove the withdrawn GHSA; specification, README, memory and pnpm-workspace.yaml updates; spec to implemented — ea7236d

Post-merge (spec step 6, outside this PR): **Run workflow** on a test branch (dry run) and on `main`; record the run links on #333.
