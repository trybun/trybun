# Stale exceptions of `pnpm-workspace.yaml` in the daily advisory audit

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-11-13 |
| Plan task | – (follow-up of #327, deferred Q2 and Q6) |
| System specification sections | §2.10 |
| Related issues / PRs | #333, #335, #339, #327, #332, #337 |

Extends: `.ai/specs/implemented/2026-11-12-daily-advisory-audit.md`

## 📝 TLDR

Two kinds of exception in `pnpm-workspace.yaml` go stale silently: a `minimumReleaseAgeExclude` entry stays in place after its pinned version has passed the 7-day cooldown, and an `auditConfig.ignoreGhsas` entry stays in place after its advisory has gained a fixed version. pnpm leaves accepted advisories out of the audit, so the daily advisory audit (`advisory-audit.yml`) never sees either. Proposed: the daily advisory audit also checks these exceptions and lists stale ones in a separate *Stale exceptions* section of the existing tracking issue *Vulnerability advisories on main*. The issue stays open while there are advisories **or** stale exceptions; the run never blocks a pull request.

## 📝 Problem Statement

- §2.10 says an accepted advisory is "removed as soon as a fixed version exists", and the comment above `minimumReleaseAgeExclude` says each entry "is removed once that version is older than 7 days". Nothing checks either rule; in #325 stale exclusions had to be found and removed by hand.
- A stale `ignoreGhsas` entry is a **fixable vulnerability hidden by an exception**: pnpm leaves the GHSA out of `advisories`, so the tracking issue of #327 stays closed while a fix is available. That repeats #324 (findings that exist but are seen nowhere).
- A stale `minimumReleaseAgeExclude` entry is a hygiene problem: the cooldown of Rule 10 is skipped for that version for longer than needed, and the list keeps growing.

Who has it: the maintainer and every agent that updates dependencies.

## 📝 Proposed Solution

The channel, decided by the maintainer on #333: the same daily workflow and **the same tracking issue**, with a separate section. Q2 and Q6 ship together.

1. The workflow also writes the effective pnpm settings: `pnpm config list --json > "$RUNNER_TEMP/config.json"` (observed with pnpm 12.13 on this repository: the workspace settings appear as `minimumReleaseAge`, `minimumReleaseAgeExclude`, `audit.ignore` — the accepted GHSAs of `auditConfig.ignoreGhsas` — and `registry`). Still no `pnpm install`, so no dependency code runs in the job.
2. `node scripts/advisory-audit.js sync <audit.json> <config.json>` checks each exception:
   - **`minimumReleaseAgeExclude`**: an entry `name@version` is stale when the registry's publish time of that version is at least `minimumReleaseAge` minutes ago. The publish time is `time[version]` of the package document at `new URL(name.replace('/', '%2F'), base)`: only the `/` of a scoped name is escaped, the npm convention (npm-registry-fetch). `base` is the registry of the name's scope in `registries` when the scope is listed there (e.g. `@jsr` → `https://npm.jsr.io/`), otherwise `registry`. A bare package name without a version is listed as *not pinned*: the convention of `pnpm-workspace.yaml` pins each exclusion to the exact fixed version. A pattern (`@scope/*`) fails the name allowlist and is listed as `(invalid)`.
   - **`auditConfig.ignoreGhsas`**: an entry is stale when its `withdrawn_at` is set, or when the GitHub advisory (`gh api /advisories/{ghsa}`) has **at least one** entry of `vulnerabilities[]` with `package.ecosystem` `npm` and **every** such entry has a non-null `first_patched_version`. This is the rule the tracking issue already uses for "patched". An advisory without any npm entry is listed as *unknown advisory*.
3. The tracking issue body gets a second section, *Stale exceptions*, after the advisories table: one row per stale entry with the setting, the entry and the reason (`published 2026-11-09, older than 7 days`, `patched: 11.0.1 (minimatch)`, `withdrawn 2026-10-23`, `not pinned`). Its footer says what to do: remove the entry; for a patched GHSA, update the dependency or add an `overrides` entry first. The texts that assume advisories only change with the two sets:
   - The body intro: with stale exceptions but no advisories, one line says that `pnpm audit` finds no advisory that is not accepted.
   - The reopen comment: "Reopened: the advisory audit finds advisories or stale exceptions again.", followed by both lists.
   - The close comment: "…no advisory remains that is not accepted in `auditConfig.ignoreGhsas`, and no exception of `pnpm-workspace.yaml` is stale."
   - The empty job summary and the outcome line "No tracking issue: the audit is clean and no exception is stale."

   The size limit (`BODY_LIMIT`) counts both sections. The stale section is always rendered in full: it has one short row per entry of a hand-kept list. Only the advisory paths and rows are cut, as today.
4. The issue is opened, or reopened, while advisories **or** stale exceptions exist, and closed when both lists are empty. A comment is added only when either set changes: a new or gone advisory, a newly patched advisory, a new or gone stale exception. The title, the labels and the lookup stay unchanged.
5. The job summary shows both sections. A dry run (**Run workflow** outside the default branch) reports both and writes no issue, as today.

**Alternatives considered:**

- **A second tracking issue**: two places to watch for one task (editing `pnpm-workspace.yaml`); rejected by the maintainer on #333.
- **A manual step of dependency updates**: the problem of #325, which nobody does reliably.
- **Expiry dates on the entries**, as `.trivyignore.yaml` does (`expired_at`), Trivy and Snyk (`expires`): pnpm has no expiry field for either setting, and a date guessed by hand is less precise than the publish time and the advisory's own state.
- **Failing the scheduled run** on a stale exception: the channel #327 rejected.

Prior art: cargo-deny warns about ignored advisories it no longer detects, and audit-ci warns about allowlist entries that are no longer needed. Both do it in the same run and report as the audit itself, which is the shape chosen here.

## 📝 Architecture

No application code, contract, schema or runtime dependency changes. Changed files only:

- `.github/workflows/advisory-audit.yml`: one more step, `pnpm config list --json > "$RUNNER_TEMP/config.json"`, before the sync step, and the second argument for the sync step. The permissions stay `contents: read` and `issues: write`. The advisory API needs no extra grant: it is public and `gh` uses `GITHUB_TOKEN`.
- `scripts/advisory-audit.js`, extended with exported pure functions plus I/O injected into `sync`, as now:
  - `parseConfig(json)` validates the pnpm output: `minimumReleaseAge` a non-negative integer (absent → 0, no exclusion is stale by age), `minimumReleaseAgeExclude` and `audit.ignore` arrays of strings (absent → empty), and `registry` and every key of `registries` `https:` URLs, each scope of `registries` a valid npm scope. Anything else throws and fails the run.
  - `checkExceptions(config, { now, registryJson, advisory })` returns the stale exceptions. `registryJson(url)` reads the package document from the registry with Node's `fetch` (`redirect: 'error'`, a 30-second timeout, two retries with backoff on a network error, 429 or 5xx; 404 means *not on the registry*). `advisory(ghsa)` calls `gh api /advisories/{ghsa}` with the same retries. Both are injected, so the unit tests need no network. An entry is validated **before** it is used in a URL or an argument: the npm name allowlist and an exact semver version for an exclusion, the GHSA pattern for an accepted advisory. An entry that fails is listed as `(invalid)` and never sent anywhere.
  - Rendering follows #327: allowlisted fields in code spans, never escaped free text. The patched versions from the advisory API are checked against an exact version pattern and the dates against an ISO date, so no API or registry text can add Markdown, HTML, links, mentions or cross-references to the issue.
  - A second hidden marker, built only from validated values, carries the sorted stale set, e.g. `<!-- stale-exceptions: release-age:eslint-plugin-import-x@4.18.1:aged,ignore-ghsa:GHSA-vfj7-8cjw-p6xm:withdrawn -->`.
    - **Grammar:** comma-separated tokens `release-age:<entry>:<aged|not-pinned|not-on-registry>`, where `<entry>` is a validated `name[@version]` (`not-pinned` exactly when there is no `@version`), and `ignore-ghsa:<GHSA>:<patched|withdrawn|unknown>`.
    - **Parsing:** validated npm names, versions and GHSA ids contain neither `,` nor `:` nor `>`, so a token splits unambiguously on its first and last `:`.
    - **Invalid entries:** an entry that failed validation is never written to the marker. It is listed as `(invalid)` and keeps the issue open.
    - Round-trip tests cover scoped names.
  - `planSync(advisories, issue, { stale })` compares both markers to decide on the comment, and `sync(auditText, configText, io)` takes the settings. The existing `planSync` and `sync` tests of `scripts/advisory-audit.spec.js` change with the new arguments: an empty stale set keeps their expectations. A body from before this change has no second marker, which reads as an empty stale set.
- `scripts/advisory-audit.spec.js`: unit tests with fixtures. `scripts/fixtures/advisory-audit/config.json` is captured from `pnpm config list --json` of this repository; the advisory API responses are captured from `gh api /advisories/…` for an advisory with a fix (GHSA-g3hv-75wg-m249), one without (GHSA-gcqx-w48m-w2h4) and one withdrawn (GHSA-vfj7-8cjw-p6xm, withdrawn on 2026-10-23).

## 📝 Edge Cases & Failure Scenarios

- **Registry or advisory API unavailable, or an unparsable response** (after the retries): the run fails and the issue is left untouched, as with a failed audit. A partial check would make an exception look "gone" and then "new" again, notifying twice for nothing. The registry is also what `pnpm audit` needs, so the run gains no new single point of failure. The advisory API uses `GITHUB_TOKEN`, with its rate limit of 1,000 requests per hour, which is far above the number of entries.
- **Version not on the registry** (unpublished, typo): it has no publish time, so it is listed as *not on the registry*. The entry protects nothing.
- **Advisory not found** (404, e.g. a typo in the GHSA): listed as *unknown advisory*. Any other API error fails the run.
- **Advisory of several packages, only some of them patched**: not stale. The entry is still needed for the unpatched package.
- **A patched GHSA whose fix does not fit the parents' ranges**: still listed. The fix is an `overrides` entry (#325), which the footer names; removing the entry alone would make the PR gate fail on a high or critical advisory.
- **`minimumReleaseAge` removed or set to 0**: no exclusion is stale by age. Every exclusion is unnecessary then, but pnpm ignores them, so they do no harm.
- **Clock**: the age is counted from the registry's publish time to the run's time. An exclusion becomes stale on the first daily run after its 7 days, i.e. within 24 hours.
- **An exclusion replaced by a newer version**: a different token, so one comment lists the old one as gone and the new one as new – intended, and covered by a test.
- **Tracking issue closed by hand while stale exceptions remain**: the next run reopens it, as for advisories.
- **An accepted advisory that is already stale**: GHSA-vfj7-8cjw-p6xm (braces) was withdrawn on 2026-10-23, and `pnpm audit` has not reported it since. Without action, the first run on `main` would open the tracking issue for it. The implementation PR therefore removes that entry and its comment from `auditConfig.ignoreGhsas`, a one-time hand edit, not the job's (see *Non-goals*), so `main` starts clean.
- **Older issue body without the second marker**: an empty previous stale set, so the first run after the change comments on the stale exceptions it finds.

## 📝 Risks & Impact Review

Low and reversible: one workflow step and an extended script, both reverted to roll back. No new permission, secret or dependency. Outbound calls go to the npm registry (already used by `pnpm audit`) and the GitHub API (already used by `gh`). The tracking issue may now be open without any advisory, which its intro line and section headings make clear. Notifications stay at most one comment per change.

## Changes to the system specification

| Section | Change |
|---|---|
| §2.10 *Where it is checked*, row *Continuously on the main branch* | The daily advisory audit also checks the exceptions of `pnpm-workspace.yaml`: `minimumReleaseAgeExclude` entries older than `minimumReleaseAge` and `auditConfig.ignoreGhsas` entries whose advisory has a fixed version or was withdrawn. The tracking issue lists them in a section *Stale exceptions*, stays open while advisories or stale exceptions remain, and closes when both are gone. |
| §2.10 *Response times* | After "removed as soon as a fixed version exists": the daily advisory audit reports an entry that is no longer needed. |

Also: `pnpm-workspace.yaml` (remove the withdrawn GHSA-vfj7-8cjw-p6xm with its comment), `README.md` (the CI line of `advisory-audit.yml`, Rule 5), the `pnpm 12 audit` entry of `.ai/memory/toolchain.md`, and the comments above `minimumReleaseAgeExclude` and `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml` (the audit reports stale entries). No user documentation (`docs/user/`), glossary, UI or ADR change.

## Non-goals

- Removing stale entries automatically or opening pull requests from the job.
- Changing `minimumReleaseAge`, the PR gate *Vulnerability audit* or the `overrides` entries; flagging `overrides` that are no longer needed (a later follow-up if wanted).
- Flagging an exclusion whose version is no longer in the lockfile.
- `.trivyignore.yaml`: its entries already expire after at most 30 days (§2.10).

## Resolved assumptions (autonomous defaults)

| # | Question | Applied default | Why |
|---|---|---|---|
| Q1 | Channel? | The same tracking issue, with a section *Stale exceptions*; open while advisories or stale exceptions exist. | **Decided by the maintainer** on #333. |
| Q2 | Ship Q2 and Q6 of #327 together or separately? | Together. | **Decided by the maintainer** on #333. |
| Q3 | How does the script read `pnpm-workspace.yaml`? | `pnpm config list --json`, captured by the workflow. | No YAML parser and no `pnpm install` in a job holding `issues: write`; pnpm resolves the settings exactly as it applies them. |
| Q4 | When is an `ignoreGhsas` entry stale? | When every npm package of the advisory has a first patched version, or the advisory is withdrawn. | Matches §2.10 and the "patched" rule the tracking issue already uses. |
| Q5 | Age threshold? | The `minimumReleaseAge` value of the settings, not a hard-coded 7 days. | One source of truth, no drift if Rule 10's cooldown changes. |
| Q6 | An exclusion that is not `name@exact-version`? | Listed as *not pinned*. | The convention in `pnpm-workspace.yaml` pins every exclusion. A pattern would skip the cooldown indefinitely, the risk Rule 10 guards against. |
| Q7 | A registry or API error? | The run fails and the issue is left untouched. | Same as a failed audit; a partial result would notify twice for nothing. |
| Q8 | Also flag exclusions not in the lockfile, or unneeded `overrides`? | No, deferred. | Smallest scope that ships; reversible. |

## Acceptance criteria

- [ ] Unit tests with the captured fixtures cover every row of *Edge Cases* (the primary evidence).
- [ ] **Run workflow** on a test branch that adds an exclusion of an old version (e.g. `minimatch@11.0.4`, published on 2026-11-02) and an accepted GHSA that has a patched version (e.g. GHSA-g3hv-75wg-m249) lists both under *Stale exceptions* in the job summary (dry run, no issue written); the run is green.
- [ ] On `main` with stale exceptions and no advisory, the run opens or reopens the tracking issue listing them. Once they are removed, the next run closes it (when no advisory remains).
- [ ] A second run with the same result changes nothing; a new or gone stale exception adds one comment.
- [ ] An unreachable registry or advisory API fails the run and leaves the issue untouched.
- [ ] Exception entries and registry/API fields that fail their allowlist are never sent in a request and cannot add Markdown, HTML, links, mentions or cross-references to the issue (unit tests).
- [ ] `pnpm lint` (supply-chain checks) and `pnpm test` stay green; §2.10, README, `toolchain.md` and the comments in `pnpm-workspace.yaml` updated.

## 📋 Implementation Plan

**Phase 1 – stale exceptions in the daily advisory audit (one PR)**

1. Capture the fixtures: `pnpm config list --json` of this repository, and `gh api /advisories/{ghsa}` for an advisory with a fix, GHSA-gcqx-w48m-w2h4 (no fix) and a withdrawn advisory. Add `parseConfig` with unit tests: the fixture, absent keys, wrong types, and a non-`https` registry.
2. Add `checkExceptions` with injected `now`, `registryJson` and `advisory`, plus unit tests: aged and young exclusions, the exact boundary, not pinned, not on the registry, invalid entries never passed to the lookups, an advisory patched for all, for some and for none of its packages, a withdrawn and an unknown advisory, and a lookup error that throws.
3. Extend the rendering and `planSync`: the *Stale exceptions* section and its marker, the intro for "stale exceptions only", open/reopen/close on either set, and comments on a change of either set. A body without the second marker reads as an empty stale set. Update the existing `planSync` tests and add new ones, including the allowlists (`@`, `#`, `owner/repo#`, HTML, `-->`) on every new field.
4. Wire `sync` (second argument, the registry `fetch` with a timeout and the scope registries, `gh api /advisories/…` through `execFileSync`) with unit tests on the injected runner, and add the `pnpm config list --json` step to `advisory-audit.yml`; run `pnpm lint`.
5. Remove the withdrawn GHSA-vfj7-8cjw-p6xm from `auditConfig.ignoreGhsas`, and check with `pnpm audit --audit-level high` that the PR gate stays green. Update §2.10, `README.md`, `.ai/memory/toolchain.md` and the comments in `pnpm-workspace.yaml`. Run the validation gate. In the implementation PR, set this specification to `implemented`, move it to `implemented/` and add its changelog entry.
6. After merge, run the workflow with **Run workflow** on a test branch (dry run) and on `main`, and record the run links on #333.

## Changelog

- 2026-11-13 – Created (autonomous defaults; the channel and the scope decided by the maintainer on #333).
- 2026-11-13 – Specification review: registry URL encoding and no redirects, retries before failing, the marker grammar, the advisory API fields, fixture tests as the primary evidence.
- 2026-11-13 – Review of #335: the withdrawn GHSA-vfj7-8cjw-p6xm is removed in the implementation PR, the marker grammar is corrected, an advisory needs at least one npm entry, the texts of the stale-only and mixed states, the size limit, the scope registries.
- 2026-11-13 – Implemented (#339): `parseConfig`, `checkExceptions` and the *Stale exceptions* section in `scripts/advisory-audit.js`, the `pnpm config list --json` step in `advisory-audit.yml`; the withdrawn GHSA-vfj7-8cjw-p6xm removed from `auditConfig.ignoreGhsas`. The stale set is passed to `planSync` and `renderReport` as an option, so a body without stale exceptions is unchanged; a scoped name is escaped as npm does (`@scope%2Fname`). Follow-up for unneeded `overrides` and exclusions outside the lockfile: #337.
- 2026-11-13 – Review of #339: the stale marker is read back as strictly as it is written (an edited issue body cannot inject into a comment); a timeout while the registry sends a document, a rate-limited or hung `gh` call are retried; `gh`'s error is kept for the log; one exact version per exclusion is documented in `pnpm-workspace.yaml`.
