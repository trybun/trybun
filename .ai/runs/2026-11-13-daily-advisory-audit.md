# Execution plan — Daily advisory audit of `main` with one tracking issue

**Source doc:** `.ai/specs/implemented/2026-11-12-daily-advisory-audit.md` (spec PR #331, issue #327)
**Branch:** `feat/daily-advisory-audit` · **Base:** `main`

## 🎯 Goal

A daily workflow audits the lockfile of `main` for advisories of every severity and keeps one tracking issue current – opened or reopened while advisories not accepted in `auditConfig.ignoreGhsas` remain, closed when the audit is clean – without ever blocking a pull request.

## Scope

- `scripts/advisory-audit.js` (pure `parseAudit`, `renderReport`, `planSync`; the `sync` CLI with an injected command runner) and `scripts/advisory-audit.spec.js` in the `scripts` Vitest project.
- Fixtures in `scripts/fixtures/advisory-audit/`, captured from pnpm 12.13: a scratch project (`minimatch` 10.2.6, `glob` 11.0.3 – one high, two moderate advisories, one with two paths), the clean output of this repository (`advisories: {}`, `low: 1` in `metadata` for the accepted GHSA-gcqx-w48m-w2h4) and the empty output of a failed audit (no lockfile).
- `.github/workflows/advisory-audit.yml`.
- §2.10, §15.4, `README.md`, `.ai/memory/toolchain.md`; the spec moves to `.ai/specs/implemented/` with status `implemented`.

## Non-goals

- The PR gate threshold, fixing any advisory, stale `minimumReleaseAgeExclude` / `ignoreGhsas` entries (Q2, Q6 – one follow-up issue), Dependabot alerts.

## Risks

- The workflow can only be exercised on GitHub after merge (spec step 5) – the `sync` logic is covered by unit tests with an injected runner; the post-merge runs are recorded on #327.
- `gh api --paginate` output of several pages is concatenated JSON arrays; parsed with `--jq '.[]'` per line to stay page-safe.

## Progress

PR: #332

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Daily advisory audit

- [x] 1.1 Fixtures, parseAudit, renderReport and planSync with unit tests — f3e92d6
- [x] 1.2 sync CLI with job summary and injected-runner unit tests — f3e92d6
- [x] 1.3 advisory-audit.yml workflow and supply-chain lint — 61a0d9d
- [x] 1.4 Specification, README and memory updates; follow-up issue for Q2 and Q6 (#333) — 056f61d

Post-merge (spec step 5, outside this PR): **Run workflow** on a test branch with a known moderate advisory (dry run) and on `main`; record the run links on #327.

Review: one `om-auto-review-pr` pass, no blocker or major; minor findings fixed in 45b5e3b.
