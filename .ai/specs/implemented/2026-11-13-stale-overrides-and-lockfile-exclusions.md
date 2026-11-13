# Unneeded overrides and exclusions outside the lockfile in the daily advisory audit

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-11-13 |
| Plan task | – (follow-up of #333, deferred Q8 of the stale exceptions specification) |
| System specification sections | §2.10, §15.4 |
| Related issues / PRs | #337, #342, #343, #333, #335, #339 |

Extends: `.ai/specs/implemented/2026-11-13-stale-dependency-exceptions.md`

## 📝 TLDR

Since #339 the daily advisory audit (`advisory-audit.yml`) lists stale `minimumReleaseAgeExclude` and `auditConfig.ignoreGhsas` entries of `pnpm-workspace.yaml` in the section *Stale exceptions* of the tracking issue *Vulnerability advisories on main*. Two more kinds still go stale silently: an `overrides` entry whose vulnerable version no package of the lockfile asks for any more, and a `minimumReleaseAgeExclude` entry whose version is no longer in the lockfile. Proposed: the same run reads the lockfile with `pnpm list --lockfile-only` (still no `pnpm install`) and lists both kinds in the same section, with the same rules.

## 📝 Problem Statement

- The comment above `overrides` says "Remove an entry once the parent depends on the fixed version", and nothing checks it. It is already stale today: `multer@2.4.0: 2.5.0` was added because `@nestjs/platform-express` 12.2.0 pinned `multer` 2.4.0, while the lockfile of `main` now resolves `@nestjs/platform-express` 12.3.3, which declares `multer` `2.5.0`, and `@trybun/server` declares `^2.5.0` (registry, 2026-11-13). The entry only obscures the dependency tree, and the next maintainer cannot tell whether it still protects anything.
- An exclusion whose version left the lockfile (the dependency moved on, or the update was reverted) protects nothing even before it is 7 days old, and keeps the cooldown of Rule 10 open for that version.

Who has it: the maintainer and every agent that updates dependencies (#337).

## 📝 Prior spec drift

None material: the stale exceptions check of #339 (`parseConfig`, `checkExceptions`, the *Stale exceptions* section and its marker in `scripts/advisory-audit.js`) matches `2026-11-13-stale-dependency-exceptions.md`, including the changelog entries of its review.

## 📝 Proposed Solution

1. The workflow also writes the dependency tree of the lockfile: `pnpm list -r --depth Infinity --lockfile-only --json > "$RUNNER_TEMP/lockfile.json"` (pnpm 12.13 on this repository: 0.12 s, about 1.6 MB, no `node_modules` needed). It reads `pnpm-lock.yaml` only, so the job still runs no dependency code and needs no YAML parser. `pnpm config list --json` already prints `overrides`, so the settings need no new step.
2. `node scripts/advisory-audit.js sync <audit.json> <config.json> <lockfile.json>` checks two more things:
   - **`overrides`**: a key `name@version` (an exact version) is **unneeded** when no package of the lockfile that depends on `name` declares a range for `name` that `version` satisfies. That is pnpm's own rule: pnpm 12.13 applies a key `name@version` to every dependency on `name` whose declared range intersects it (checked in a scratch project: a key `minimatch@10.0.0: 11.0.4` also replaces a dependency on `^10.0.0`, which would resolve to 10.2.x; on `main`, `minimatch@10.2.6` replaces `^10.2.4`, `^10.0.1` and `^9.0.3 || ^10.1.2 || ^11.0.1` alike), so once no declared range includes the key version, the entry changes nothing. The declared range of a package comes from the registry (`dependencies`, `optionalDependencies` and `peerDependencies` of that version, the abbreviated package document, one request per package name; peers count so that the check errs towards *needed*); the range of a workspace project comes from its `package.json` (`dependencies`, `devDependencies`, `optionalDependencies`). A key that is not pinned to an exact version is listed as *not pinned*, as for exclusions: the convention of `pnpm-workspace.yaml` pins each key to the exact vulnerable version, and only an exact key can be checked. A bare name is shown as its entry. A range (`glob@^10`) or a parent selector (`a>b`) fails the `name[@version]` allowlist, so it is shown as `(invalid)` with the reason *not pinned to an exact version*, and it is left out of the marker like every invalid entry of #339.
   - **`minimumReleaseAgeExclude`**: an entry `name@version` whose version does not appear in the lockfile's tree is listed as *not in the lockfile*. This is checked first and needs no request; an entry that is in the lockfile goes on to the age check of #339 unchanged.
3. The *Stale exceptions* section gets the new rows, e.g. `| \`overrides\` | \`multer@2.4.0\` | no dependency asks for this version |` and `| \`minimumReleaseAgeExclude\` | \`x@1.2.3\` | version not in the lockfile |`. The footer adds: "For an `overrides` entry, check `pnpm install` after removing it; the vulnerability audit of pull requests must stay green." Everything else stays as in #339: allowlisted fields only, a comment only when the set changes, the issue open while anything remains, the dry run outside the default branch.
4. The stale marker grammar gets two token kinds: `override:<entry>:<unused|not-pinned>` and the release-age reason `not-in-lockfile`. `<entry>` is a validated `name[@version]`, as for exclusions, and `not-pinned` occurs exactly when it has no version. A key that fails the allowlist never becomes a token, but its row keeps the issue open. A body from before this change simply has no such token.

**Alternatives considered:**

- **Parse `pnpm-lock.yaml` in the script**: the lockfile of pnpm 12 holds two YAML documents (the package manager's own and the project's), and the script has no YAML parser; a line-based reader would be fragile. `pnpm list --lockfile-only` gives pnpm's own reading as JSON.
- **`pnpm why`**: pnpm 12.13 has no `--lockfile-only` for `why` (`error: unexpected argument '--lockfile-only'`), and without `node_modules` it finds nothing.
- **Re-resolve without each override** (`pnpm install --lockfile-only` in a copy, one per entry) and look for the key version: exact, but a full resolution per entry, minutes of registry traffic, and a resolver run in a job holding `issues: write`.
- **The lockfile alone, without the registry**: pnpm's lockfile v9 stores resolved versions, not the ranges the parents declare; after an override the key version is never in the lockfile, whether the entry is needed or not.
- **The `semver` package for range matching**: the job installs nothing, so the script would have to bundle it. A small `satisfies(version, range)` of node-semver's range grammar is enough here (see *Architecture*).

## 📝 Delta

### Capability: daily-advisory-audit

**ADDED** – Unneeded `overrides` entries are stale exceptions

- WHEN an `overrides` key `name@version` is pinned to an exact version AND no package in the lockfile that depends on `name` declares a range satisfied by `version` THEN the *Stale exceptions* section lists it as `overrides` with the reason *no dependency asks for this version*, and the issue stays open while it remains.
- WHEN at least one such package declares a range that `version` satisfies THEN the entry is not listed.
- WHEN an `overrides` key is not `name@exact-version` THEN it is listed as *not pinned*: a bare name with its entry, a range or parent selector as `(invalid)` and left out of the marker.

**MODIFIED** – Stale `minimumReleaseAgeExclude` entries (from `2026-11-13-stale-dependency-exceptions.md`)

- WHEN an exclusion `name@version` is not in the lockfile's dependency tree THEN it is listed as *version not in the lockfile*, without a registry request.
- WHEN it is in the lockfile THEN the age rule of #339 applies unchanged.
- Frozen by: the existing `checkExceptions` tests of `scripts/advisory-audit.spec.js` (aged, young, boundary, not pinned, not on the registry), run with a lockfile fixture that contains their versions.

## 📝 Architecture

No application code, contract, schema or runtime dependency changes. Changed files only:

- `.github/workflows/advisory-audit.yml`: one more step, `pnpm list -r --depth Infinity --lockfile-only --json > "$RUNNER_TEMP/lockfile.json"`, and the third argument of the sync step. Permissions stay `contents: read` and `issues: write`.
- `scripts/advisory-audit.js`, extended with exported pure functions and the I/O injected into `sync`, as now:
  - `parseConfig` also reads `overrides` (absent → empty; an object whose values are strings, anything else throws).
  - `parseLockfile(json, root)` reads the `pnpm list` output into (a) the set of `name@version` present and (b) for every package name, the packages that depend on it: `{ name, version }` of a registry package, or the `package.json` of a workspace project. It reads only `name`, `version` and `path` of each top-level entry (the workspace projects) and the keys plus `version` of the nested `dependencies`, `devDependencies` and `optionalDependencies`; the nested `path` and `resolved` fields (paths under `node_modules/.pnpm`, which does not exist in the job) are ignored. A child whose `version` is not an exact version (`link:` to a workspace project) has no registry range to read and is skipped as a parent. A project `path` must lie inside `root` (the checkout); anything unexpected throws and fails the run. Names and versions are validated with the existing `PACKAGE` and `VERSION` allowlists before they reach a URL or a path.
  - `satisfies(version, range)`: node-semver's range grammar for one exact version — `||`, hyphen ranges, x-ranges (`*`, `x`, `1.x`), `~`, `^`, the comparators `<`, `<=`, `>`, `>=`, `=`, and its prerelease rule (a prerelease version only satisfies a comparator with a prerelease on the same `major.minor.patch`). A declared spec that is not a range (`npm:` alias, `workspace:`, a URL, a git or file spec, a dist-tag) never matches, as in pnpm. A spec of range characters (`RANGE`) the function cannot read throws and fails the run, so a parser gap never flags an entry by mistake. A table test compares it with node-semver's documented examples.
  - `checkExceptions(config, { now, registryJson, advisory, lockfile, manifest })`: `lockfile` is the parsed tree; `manifest(path)` reads a workspace `package.json`. The override check fetches the abbreviated package document (`Accept: application/vnd.npm.install-v1+json`) of each parent name once, through the existing `registryJson` with its retries, timeout and `redirect: 'error'`. `registryJson` gains an `accept` option for this: the exclusion lookups keep `application/json`, because they need `time`, which the abbreviated document lacks. On `main` that is 12 package names (the parents of `multer`, `minimatch` and `glob`; the 13th parent, `@trybun/server`, is a workspace project), sequential, well inside the job's 10 minutes. A transport error fails the run as in #339. A parent that the registry does not know (404) or whose version is missing from its document counts as asking for the key version, with a line in the log: the entry is then reported as needed rather than guessed unneeded, and the audit of advisories is not blocked by one odd parent.
  - Rendering and the marker follow #339: allowlisted fields in code spans, `parseToken` as strict for the new tokens as for the old ones, round-trip tests with scoped names.
- `scripts/advisory-audit.spec.js` and `scripts/fixtures/advisory-audit/`: a `lockfile.json` fixture captured from `pnpm list -r --depth Infinity --lockfile-only --json` of this repository and trimmed to the packages the tests need, plus captured abbreviated registry documents of the parents of `multer` and `minimatch`.

## 📝 Edge Cases & Failure Scenarios

- **Registry unavailable or an unparsable answer** (after the retries): the run fails and the issue is left untouched, as in #339.
- **`pnpm list` fails or prints no JSON**: the step fails the job, as `pnpm config list` does today.
- **Override whose key version a workspace project asks for directly** (e.g. `apps/server` declares `multer` `2.4.0`): needed; the `package.json` range counts like a registry range.
- **Override whose package is no longer in the tree at all**: no package depends on `name`, so it is unneeded.
- **A parent's range includes the key version but would resolve higher** (e.g. `^2.4.0` while 2.5.1 exists): counted as *needed*, because pnpm still applies the key to that range and the entry still changes the result (it pins the replacement). Whether to drop or retarget such an entry stays the maintainer's call; the check reports only entries that change nothing.
- **A parent unknown to the registry or a parent version missing there** (unpublished, a private or git source): counted as asking for the key version and logged, so the entry is not reported.
- **Several keys for one package** (`glob@10.5.0` and `glob@13.0.6`): each is checked on its own.
- **Override whose key range fits a parent that is itself only a development tool**: still needed; the check does not judge which dependencies matter.
- **Exclusion of a version that is both outside the lockfile and older than the cooldown**: listed once, as *not in the lockfile* (checked first).
- **Lockfile out of date with `package.json`**: CI's frozen install keeps `main` consistent; the check reads what the lockfile says.
- **The stale `multer@2.4.0` entry on `main`**: without action, the first run after merge would open the tracking issue for it. The implementation PR removes the entry and its comment from `overrides` (a one-time hand edit, as the withdrawn GHSA in #339) after `pnpm install` and `pnpm audit --audit-level high` confirm nothing changes, so `main` starts clean.

## 📝 Risks & Impact Review

Low and reversible: one workflow step and an extended script, both reverted to roll back. No new permission, secret or dependency. The registry is already called by `pnpm audit` and #339; the new requests are one abbreviated document per parent name of an overridden package (about ten today). A false "unneeded" would only cause a wrong suggestion in the issue, and the footer asks to check `pnpm install` before removing the entry; a parser gap fails the run instead of guessing.

## Changes to the system specification

| Section | Change |
|---|---|
| §2.10 *Where it is checked*, row *Continuously on the main branch* | The exceptions of `pnpm-workspace.yaml` also include `minimumReleaseAgeExclude` entries whose version is not in the lockfile and `overrides` entries whose vulnerable version no dependency asks for any more. |
| §15.4 daily advisory audit paragraph | The same two kinds in its list of stale exceptions. |

Also: `README.md` (the CI line of `advisory-audit.yml`, Rule 5), the `pnpm 12 audit` entry of `.ai/memory/toolchain.md` (pnpm's intersecting override keys, `pnpm list --lockfile-only`), the comments above `minimumReleaseAgeExclude` and `overrides` in `pnpm-workspace.yaml` (each override key pins the exact vulnerable version; the audit reports unneeded entries), and the removal of `multer@2.4.0: 2.5.0`. No user documentation (`docs/user/`), glossary, UI or ADR change.

## Non-goals

- Changing the checks of #339.
- Removing entries automatically or opening pull requests from the job.
- Judging whether a *needed* override could be replaced by a dependency update.
- Checking `peerDependencyRules`, `allowBuilds` or `.trivyignore.yaml`.

## Resolved assumptions (autonomous defaults)

| # | Question | Applied default | Why |
|---|---|---|---|
| Q1 | How does the job read the lockfile without `pnpm install`? | `pnpm list -r --depth Infinity --lockfile-only --json`, written by the workflow. | The issue left it to this specification. pnpm's own reading of the lockfile as JSON; no YAML parser, no `node_modules`, no dependency code; 0.12 s here. `pnpm why` has no lockfile-only mode in pnpm 12.13. |
| Q2 | When is an `overrides` entry unneeded? | When no package of the lockfile that depends on the name declares a range satisfied by the key version (ranges from the registry, or `package.json` for workspace projects). | Mirrors how pnpm 12.13 applies a versioned key (intersecting ranges, verified). The lockfile alone cannot tell, because it stores resolved versions only. |
| Q3 | How are ranges evaluated? | A small `satisfies(version, range)` in the script; an unreadable range fails the run. | The job installs nothing, so no `semver` package; failing loud keeps a parser gap from flagging an entry. |
| Q4 | An `overrides` key that is not `name@exact-version`? | Listed as *not pinned*: a bare name with its entry, a range or parent selector as `(invalid)` and outside the marker. The convention is documented in `pnpm-workspace.yaml`. | Same rule as exclusions in #339; every key on `main` is exact today. |
| Q5 | An exclusion outside the lockfile that is also old? | One row, *not in the lockfile*, checked before the registry. | One reason per entry; no request needed. |
| Q6 | The stale `multer@2.4.0` override on `main`? | Removed by hand in the implementation PR after `pnpm install` and `pnpm audit --audit-level high` show no change. | Same as the withdrawn GHSA in #339: `main` starts clean, and the job never edits the file. |
| Q7 | Both checks in one PR, or two specifications? | One specification and one PR, with separate steps. | The issue asks for both; they share the lockfile step, the section and the marker. The exclusion check needs no registry request, so it is its own step and test set. |

## Acceptance criteria

- [ ] Unit tests with the captured fixtures cover an override whose key version no dependency asks for, one still asked for by a registry package, one asked for by a workspace project, a *not pinned* bare key, a range key and a parent-selector key (shown as `(invalid)`, absent from the marker), an exclusion absent from the lockfile, and every row of *Edge Cases* (the primary evidence).
- [ ] `satisfies` passes a table of node-semver's documented range examples, and an unreadable range throws.
- [ ] **Run workflow** on a test branch that restores `multer@2.4.0: 2.5.0` and adds an exclusion of a version absent from the lockfile (e.g. `minimatch@11.0.1`) lists both under *Stale exceptions* in the job summary (dry run, no issue written); the run is green. This depends on the registry of the day (`@nestjs/platform-express` 12.3.3 declaring `multer` `2.5.0`); the unit tests with captured fixtures are the primary evidence.
- [ ] A second run with the same result changes nothing; a new or gone stale exception adds one comment; an unreachable registry fails the run and leaves the issue untouched.
- [ ] Entries and registry fields that fail their allowlist are never sent in a request or read as a path, and cannot add Markdown, HTML, links, mentions or cross-references to the issue (unit tests).
- [ ] `pnpm lint` (supply-chain checks), `pnpm test` and `pnpm audit --audit-level high` stay green; §2.10, §15.4, README, `toolchain.md` and the comments in `pnpm-workspace.yaml` updated.

## 📋 Implementation Plan

**Phase 1 – unneeded overrides and exclusions outside the lockfile (one PR)**

1. Add `satisfies(version, range)` with its table test (characterization of node-semver's examples, prerelease rule, non-range specs, an unreadable range that throws).
2. Capture `lockfile.json` (trimmed) and the abbreviated registry documents of the parents; add `parseLockfile` and the `overrides` part of `parseConfig` with unit tests (the fixture, workspace paths outside the root, invalid names and versions, absent `overrides`).
3. Extend `checkExceptions` with the lockfile check of exclusions and the override check, with injected `lockfile` and `manifest`. Characterization first: the existing exclusion tests run with a lockfile fixture containing their versions and keep their expectations. Then the new cases of *Acceptance criteria*.
4. Extend the rendering, the marker tokens and `parseToken` (round trips, allowlists on every new field), the footer, and `sync` (third argument, `manifest` reading inside the checkout); add the `pnpm list` step to `advisory-audit.yml`; run `pnpm lint`.
5. Remove `multer@2.4.0: 2.5.0` after `pnpm install` and `pnpm audit --audit-level high` confirm nothing changes. Update §2.10, §15.4, `README.md`, `.ai/memory/toolchain.md` and the comments in `pnpm-workspace.yaml`. Run the validation gate. In the implementation PR, set this specification to `implemented`, move it to `implemented/` and add its changelog entry.
6. After merge, run the workflow with **Run workflow** on a test branch (dry run) and on `main`, and record the run links on #337.

## Changelog

- 2026-11-13 – Created from #337 (autonomous defaults; the lockfile is read with `pnpm list --lockfile-only`, override keys are matched as pnpm 12.13 does).
- 2026-11-13 – Specification review: peers and unknown parents count as *needed*, the fields read from `pnpm list`, the request count, ranges that include the key but would resolve higher.
- 2026-11-13 – Review of #342: how *not pinned* keys that fail the allowlist are shown and kept out of the marker, the `accept` option of `registryJson`, and the parent count.
- 2026-11-13 – Implemented (#343): `satisfies`, `parseLockfile` and the two checks in `scripts/advisory-audit.js`, the `pnpm list` step in `advisory-audit.yml`; the unneeded `multer@2.4.0` override removed. `pnpm list` nests a workspace project under its dependents as a `link:` entry with its own tree, so such an entry counts as that project (its `package.json`), and every occurrence of a package is walked, because its children can differ with its peers.
