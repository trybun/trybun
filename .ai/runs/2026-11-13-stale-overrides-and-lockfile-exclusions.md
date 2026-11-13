# Execution plan — Unneeded overrides and exclusions outside the lockfile in the daily advisory audit

**Source doc:** `.ai/specs/implemented/2026-11-13-stale-overrides-and-lockfile-exclusions.md` (spec PR #342, issue #337)
**Branch:** `feat/stale-overrides-and-lockfile-exclusions` · **Base:** `main`

## 🎯 Goal

The daily advisory audit also lists, under *Stale exceptions*, `overrides` entries whose vulnerable version no dependency asks for any more and `minimumReleaseAgeExclude` entries whose version is not in the lockfile, reading the lockfile with `pnpm list -r --depth Infinity --lockfile-only --json`.

## Scope

- `scripts/advisory-audit.js`: `satisfies`, `parseLockfile`, `overrides` in `parseConfig`, the two checks in `checkExceptions` (injected `lockfile` and `manifest`), the `accept` option of `registryJson`, the new rows, marker tokens and footer, `sync` with a third argument.
- `scripts/advisory-audit.spec.js` and fixtures (`lockfile.json` trimmed from `pnpm list`, abbreviated registry documents of the parents).
- `.github/workflows/advisory-audit.yml`: the `pnpm list` step.
- `pnpm-workspace.yaml`: remove `multer@2.4.0: 2.5.0`; comments above `minimumReleaseAgeExclude` and `overrides`.
- §2.10, §15.4, `README.md`, `.ai/memory/toolchain.md`; the spec moves to `.ai/specs/implemented/` with status `implemented`.

## Non-goals

- The checks of #339, removing entries from the job, `peerDependencyRules`, `allowBuilds`, `.trivyignore.yaml`.

## Risks

- The workflow runs on GitHub only after merge (spec step 6); the logic is covered by unit tests with injected lookups and captured fixtures.
- A gap in `satisfies` fails the run rather than flagging an entry.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Unneeded overrides and exclusions outside the lockfile

- [ ] 1.1 satisfies with its table test
- [ ] 1.2 Fixtures, parseLockfile and overrides in parseConfig with unit tests
- [ ] 1.3 checkExceptions: exclusions outside the lockfile and unneeded overrides
- [ ] 1.4 Rows, marker tokens, footer, sync wiring and the workflow step
- [ ] 1.5 Remove the multer override; specification, README, memory and pnpm-workspace.yaml updates; spec to implemented

Post-merge (spec step 6, outside this PR): **Run workflow** on a test branch (dry run) and on `main`; record the run links on #337.
