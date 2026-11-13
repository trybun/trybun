# Daily advisory audit of `main` with one tracking issue

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-11-12 |
| Plan task | – (follow-up of #324, #325) |
| System specification sections | §2.10, §15.4 |
| Related issues / PRs | #327, #324, #325 |

## 📝 TLDR

Moderate and low advisories in the lockfile can stay open on `main` unnoticed for weeks: the PR gate *Vulnerability audit* blocks only high and critical (§2.10), and Dependabot alerts sit in the Security tab nobody watches (#324: three alerts, 1–1.5 weeks). Proposed: a daily workflow `advisory-audit.yml` runs `pnpm audit --audit-level low --json` on `main` and keeps **one tracking issue** up to date – opened, or reopened, while there are advisories not accepted in `auditConfig.ignoreGhsas`, closed when the audit is clean. It never blocks a pull request.

## 📝 Problem Statement

- `ci.yml` job *Vulnerability audit* runs `pnpm audit --audit-level high`; moderate and low advisories pass silently. That threshold is the maintainer's decision and stays (wrap-up of #325).
- Dependabot opens a fix PR only when a patched version fits the parents' version ranges. In #324 none did (the fix needed `overrides`, #325), so the only signals were the alerts in the Security tab and the "found 3 vulnerabilities" line of `git push`.
- Rule 10 asks for security fixes immediately and §2.10 sets response times for medium (30 days) and low (next planned update) severity, but nothing makes such an advisory visible where the maintainer and the agents work: the issue list (`gh issue list`).

## 📝 Proposed Solution

A scheduled workflow on `main`, shaped like `image-scan.yml` (cron plus **Run workflow**, `permissions: {}` with per-job grants, SHA-pinned actions, no secrets, no environment):

1. `pnpm audit --audit-level low --json` against the committed lockfile – the same input as the PR gate, with the accepted risks of `auditConfig.ignoreGhsas` already left out by pnpm.
2. `node scripts/advisory-audit.js` turns the result into a report and synchronises **one tracking issue**, titled *Vulnerability advisories on main*, labelled `security` and `dependencies`:
   - advisories found and no issue → open it;
   - advisories found and the issue is closed → reopen it (never a duplicate) with a comment listing the current set, so whoever closed it sees why it came back;
   - advisories found and the issue is open → rewrite its body in place only when its content changed, and add a comment **only when the set changed** – a new or gone GHSA, or a GHSA that gained a patched version – so every notification means something new;
   - audit clean and the issue is open → close it as completed with a comment; clean and no open issue → nothing.
3. The same table goes to the job summary.
4. Only a run on the default branch writes the issue; **Run workflow** on another branch is a dry run that writes the job summary only, so testing a branch never touches the tracking issue of `main`.
5. The run is **green when it finds advisories** – a finding is reported through the issue, not a red run; it fails only when the audit itself cannot run (registry error, unparsable output) or the issue cannot be written.

The body lists, per advisory: GHSA (a link built from the validated id), severity, package, vulnerable range, patched versions (or "none"), and the dependency paths (shortened to the first few), ordered by severity, then GHSA. It carries no advisory title or overview (free text); the GHSA page has them. It ends with what to do: fix (update, `overrides`) or accept with a reason in `auditConfig.ignoreGhsas` (§2.10), and a note not to rename or relabel the issue. The body carries no timestamp, so an unchanged result changes nothing; the run link is in the job summary. A hidden marker `<!-- advisory-audit: GHSA-…:patched,GHSA-…:none -->`, built only from validated ids, carries the sorted set with whether a patched version exists, which is how the next run detects a change.

**Alternatives considered** (decided by the maintainer on #327):

- **A failing scheduled run** as the channel for findings – notifies only the workflow's creator or last cron editor by e-mail, is invisible to agents, and a red run for something that cannot be fixed the same day teaches people to ignore red.
- **Job summary only** – pull-only; repeats #324.
- **SARIF upload to code scanning** (the mechanism of `image-scan.yml`) – lands in the same Security tab where the Dependabot alerts of #324 went unnoticed, and duplicates them.
- **One issue per advisory** (as `rustsec/audit-check` does) – more noise for the same information; one aggregated issue updated in place follows Renovate's *Dependency Dashboard*.

## 📝 Architecture

New files only; no application code, contract, schema or runtime dependency changes.

- `.github/workflows/advisory-audit.yml` – `schedule` (daily, off the hour, e.g. `17 5 * * *`) and `workflow_dispatch`; `concurrency` group per workflow and ref without cancellation, so two runs never race to open the issue. One job, `ubuntu-24.04`, `timeout-minutes: 10`, permissions `contents: read` and `issues: write`. Steps: `actions/checkout` (`persist-credentials: false`), `pnpm/action-setup`, `actions/setup-node` with `.node-version`, then `pnpm audit --audit-level low --json > "$RUNNER_TEMP/audit.json" || true` and `node scripts/advisory-audit.js sync "$RUNNER_TEMP/audit.json"` with `GH_TOKEN: ${{ github.token }}`. Like the *Vulnerability audit* job, no `pnpm install`: `pnpm audit` reads the lockfile, so no dependency code or install script runs in a job holding a write token.
- `scripts/advisory-audit.js` – following `scripts/release.js`: exported pure functions plus a small CLI.
  - `parseAudit(json)` – validates the pnpm output (an `advisories` object and `metadata`; anything else throws, which fails the run). A failed audit is recognised by its output, not by its exit code: pnpm exits with 1 both for findings and for an error, and on an error pnpm 12.13 prints the message to standard error and nothing to standard output, also with `--json` (observed for an unreachable registry and for a missing lockfile), so the file is empty. The message stays in the job log, because only standard output is redirected. An advisory without a fix has `patched_versions: null` (observed for GHSA-gcqx-w48m-w2h4), rendered as "none". The list comes from `advisories`, never from `metadata.vulnerabilities`, which still counts ignored advisories (observed with pnpm 12.13: `advisories: {}` and `low: 1` for the accepted GHSA-gcqx-w48m-w2h4).
  - `renderReport(advisories)` – the Markdown table and the marker. Advisory fields are **validated against allowlists, not escaped**: the GHSA id against `^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$`, the severity against `low` / `moderate` / `high` / `critical`, the package name against the npm name characters, ranges and paths against the semver and path characters, each rendered in a code span; a field that fails is replaced by `(invalid)` and the run logs it. The one exception to "not escaped" is the `|` of a range with alternatives (`<1.2.3 || >=2.0.0 <2.0.1`), written as `\|`: in a GFM table an unescaped `|` ends the cell even inside a code span. So no advisory text can add Markdown, HTML, links, mentions (`@…`) or cross-references (`#…`, `owner/repo#…`) to the issue, or close the marker. The body stays below GitHub's 65,536-character limit by truncating paths first.
  - `planSync(advisories, existingIssue)` – a pure decision: `open` / `reopen` (with comment) / `update` / `update+comment` / `close` / `none`, with the comment text of the change (added, gone and newly patched GHSAs); an unchanged body is `none`.
  - `sync` – a `schedule` run always runs on the default branch; a `workflow_dispatch` run writes the issue only when `GITHUB_REF` is `refs/heads/<default branch>` (from `gh api repos/$GITHUB_REPOSITORY --jq .default_branch`), otherwise it only writes the job summary. The dry run keeps test branches away from the tracking issue; it is a convenience, not a security boundary (the branch's own script runs with the job's token, and only collaborators can push branches or run workflows). Otherwise it finds the tracking issue through REST, which has no search-index lag (`gh api --paginate 'repos/{repo}/issues?state=all&labels=security&creator=github-actions[bot]'`, pull requests left out, exact title match, oldest first), and applies the plan with `gh` through `execFileSync` with argument arrays and body files, never a shell string.
- `scripts/advisory-audit.spec.js` – unit tests in the `scripts` project of `vitest.config.ts`, so `pnpm test` runs them, against a fixture captured from real pnpm 12 output (`scripts/fixtures/advisory-audit/*.json`, from a scratch project with a known moderate advisory), not a hand-written shape.
- `pnpm lint` (`scripts/check-supply-chain.js`) needs no change: the workflow uses `schedule` and `workflow_dispatch` only and pins every action to a SHA.

## 📝 Edge Cases & Failure Scenarios

- **Registry unavailable or pnpm error** – `parseAudit` throws, the run fails, the issue is left untouched (a failed audit never closes it as "clean"). A broken job is reported the conventional way – a red run with GitHub's failure notification – which is what a red run should mean here; a closed issue therefore means "clean as of the last green run", and the Actions page shows the last run.
- **Scheduled workflow disabled** – GitHub disables scheduled workflows of a public repository after 60 days without activity; the repository is active, and the README names the workflow so a disabled one is noticed.
- **High or critical advisory published after merge** – it is listed too (`--audit-level low` includes every severity above); the PR gate keeps blocking new ones.
- **Accepted advisory** – pnpm leaves `ignoreGhsas` entries out of `advisories`; adding one is how a finding is accepted, and the next run closes the issue if nothing else remains.
- **Issue closed by a human while advisories remain** – the next run reopens it; to silence a finding, accept or fix it.
- **Issue retitled or relabelled by a human** – the search no longer finds it and the next finding opens a new one; documented in the issue body ("do not rename").
- **Two matching issues** (e.g. one opened by hand with the same title by the bot account) – `sync` uses the oldest; the other can be closed by hand. Runs are serialised by `concurrency`.
- **Autofix pipeline** – the tracking issue carries no `cez-autofix` label, so the autofix sweep does not pick it up; fixing an advisory is a normal task that references it.
- **Huge result** – paths truncated, then rows; the body says how many were cut and points to the job summary.
- **Advisory text with Markdown, HTML, mentions or cross-references** – never reaches the issue: only allowlisted fields are rendered, free text is left out.

## 📝 Risks & Impact Review

Low and reversible: one new workflow and script, deleted to roll back; the tracking issue is closed by hand. The only new permission is `issues: write` in one job, with the default `GITHUB_TOKEN`, in a job that installs and runs no dependency code. Issues created with `GITHUB_TOKEN` do not trigger other workflows. Notifications go to repository watchers, at most one per change of the advisory set.

## Changes to the system specification

| Section | Change |
|---|---|
| §2.10 *Where it is checked* | Row *Continuously on the main branch*: add the daily advisory audit (`advisory-audit.yml`, `pnpm audit --audit-level low` with the accepted risks of `auditConfig.ignoreGhsas`); outcome column: it keeps one tracking issue open while advisories remain and closes it when the audit is clean; it never blocks a pull request. |
| §2.10 tool table (line *Vulnerability audit of the lockfile*) | Add: daily on `main`, every severity, reported through the tracking issue. |
| §15.4 | One sentence next to the daily image scan: the daily advisory audit of the lockfile and its tracking issue, permissions `contents: read` and `issues: write`, no secrets. |

Also: `README.md` (CI section, next to `image-scan.yml`, Rule 5) and the `pnpm 12 audit` entry of `.ai/memory/toolchain.md` (the tracking issue replaces "check `pnpm audit --audit-level low` by hand"). No user documentation (`docs/user/`), glossary or UI change.

## Non-goals

- Changing the threshold of the PR gate *Vulnerability audit* (high and critical keep blocking).
- Fixing any particular advisory.
- Flagging `minimumReleaseAgeExclude` entries older than 7 days (Q2, deferred).
- Re-checking accepted `ignoreGhsas` entries for a newly published fix (Q6, deferred).
- Replacing or dismissing Dependabot alerts.

## Resolved assumptions (autonomous defaults)

| # | Question | Applied default | Why |
|---|---|---|---|
| Q1 | Reporting channel? | One tracking issue, updated in place, comment only on a changed set, closed when clean, reopened not duplicated; green run on findings; table also in the job summary. | **Decided by the maintainer** on #327. |
| Q2 | Also flag `minimumReleaseAgeExclude` entries older than 7 days? (non-blocking) | No – deferred to a follow-up issue. | Separate capability (it needs registry publish dates, not the audit) – smallest scope that ships; reversible. |
| Q3 | Run `pnpm install --frozen-lockfile` before the audit (as the issue suggests)? | No. | `pnpm audit` reads the lockfile; the PR gate does the same without install. Not running dependency code in a job with `issues: write` is the safer default. |
| Q4 | Severities listed? | Every severity from low up (`--audit-level low`). | A high or critical advisory published after merge is just as invisible today; one list, no second channel. |
| Q5 | One issue per advisory or one aggregated issue? | One aggregated issue. | Less noise; the maintainer's decision on #327 names "one tracking issue". |
| Q6 | Also flag accepted `ignoreGhsas` entries that have gained a fixed version (§2.10: "removed as soon as a fixed version exists")? | No – deferred to the same follow-up issue as Q2 (stale exceptions of `pnpm-workspace.yaml`). | pnpm leaves accepted advisories out of the audit, so it needs the GitHub advisory API – a second capability; reversible. |

## Acceptance criteria

- [ ] **Run workflow** on a branch whose lockfile has a known moderate advisory reports its GHSA, package and paths in the job summary (dry run, no issue written); the run is green.
- [ ] On `main` with an advisory that is not accepted, the run opens the tracking issue listing it; the run is green.
- [ ] A second run with the same result changes nothing: no body edit, no comment.
- [ ] After the GHSA is added to `auditConfig.ignoreGhsas`, or the dependency is fixed, the next run closes the issue; a later finding reopens the same issue.
- [ ] A failing `pnpm audit` (no valid JSON) fails the run and leaves the issue untouched.
- [ ] Advisory fields that fail their allowlist cannot add Markdown, HTML, links, mentions or cross-references to the issue (unit tests).
- [ ] `pnpm lint` (supply-chain checks) and `pnpm test` stay green; §2.10, §15.4, README and `toolchain.md` updated.

## 📋 Implementation Plan

**Phase 1 – the daily advisory audit (one PR)**

1. Capture the pnpm 12 fixtures (a scratch project with a known moderate advisory; the clean output of this repository with its accepted advisories; the empty output of a failed audit). Add `scripts/advisory-audit.js` with `parseAudit`, `renderReport` and `planSync`, and `scripts/advisory-audit.spec.js`: the fixtures, ignored advisories counted only in `metadata`, invalid JSON; the allowlists (Markdown, HTML, `@`, `#`, `owner/repo#`, `-->` in each field); a range with `||` keeping its table row intact; truncation under the body limit; every `planSync` branch (open, reopen with comment, update without comment, update with comment on an added, a gone and a newly patched GHSA, close, none for an unchanged body).
2. Add the `sync` CLI (default-branch check, REST issue lookup and `gh` calls through `execFileSync` with argument arrays) and the job-summary output; unit tests with an injected command runner for the dry run, the lookup and the calls of each plan.
3. Add `.github/workflows/advisory-audit.yml`; run `pnpm lint` (supply-chain checks).
4. Update §2.10, §15.4, `README.md` and `.ai/memory/toolchain.md`; run the validation gate; open one follow-up issue for Q2 and Q6. Setting this specification to `implemented`, moving it to `implemented/` and its changelog entry happen in the implementation PR once this specification has been approved and merged.
5. After merge: run the workflow with **Run workflow** on a test branch with a known moderate advisory (dry run) and on `main`, and record the run links on #327.

## Changelog

- 2026-11-12 – Created (autonomous defaults; the reporting channel decided by the maintainer on #327).
- 2026-11-12 – Specification review: allowlists instead of escaping, REST lookup instead of search, no daily body edit, a comment on reopen and on a newly patched GHSA, the default-branch check; Q6 deferred.
- 2026-11-13 – Review of the pull request (#331), checked against pnpm 12.13: a failed audit prints nothing to standard output (no `error` object), so the failure fixture is the empty output; `patched_versions: null` is "none"; a `|` in a range is escaped in the table.
- 2026-11-13 – Implemented (#327): `advisory-audit.yml` and `scripts/advisory-audit.js`; the fixtures were captured from pnpm 12.13 (`minimatch` 10.2.6 and `glob` 11.0.3 in a scratch project), and a dependency path is checked segment by segment (`.`, workspace folders and package names), so a path cannot carry a mention.
