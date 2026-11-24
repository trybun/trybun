# A per-user rate-limit override for manual QA in the QA test environment

Extends: .ai/specs/implemented/2026-11-20-preview-start-recipe.md

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-11-23 |
| Plan task | – (agent tooling) |
| System specification sections | none (agent tooling outside `docs/spec/`); §14.4 (rate limits) and §15.12 (local environment) are relied on and left unchanged |
| Related issues / PRs | #426, #424 (guided QA that needed a low limit), #355 (limits raised in QA), #381, #383 (`--foreground`), #429 |

## 📝 TLDR

A person doing manual QA of rate-limit behaviour needs the QA test environment's API to run with a low per-user limit. Today `.ai/scripts/test-env-up.sh` always exports `TRYBUN_RATE_LIMIT_PER_USER=10000`, and the only working workaround is a temporary, untracked copy of the script, which cannot serve `--foreground` (cezar Preview). Proposed: the script reads an optional `TEST_ENV_RATE_LIMIT_PER_USER` (default `10000`), records the limit in the descriptor and its boot log, and restarts a running environment of this checkout whose limit differs instead of reusing it.

## 📝 Problem Statement

- **No override.** `test-env-up.sh:60` exports `TRYBUN_RATE_LIMIT_PER_USER=10000 TRYBUN_RATE_LIMIT_PER_IP=10000` unconditionally (#355: parallel QA requests share the seeded accounts). An exported `TRYBUN_RATE_LIMIT_PER_USER` is overwritten by it.
- **Both workarounds failed in the guided QA of #424 (2026-11-21).** Restarting only the API ends the environment under `--foreground`: the owner watches the API, Worker and web PIDs and tears everything down when one ends. A burst from the browser console reached only about 950 requests per minute through the Preview or an SSH tunnel (6 connections per host plus latency), far below 10 000.
- **The copy-based workaround cannot serve `--foreground`** (#426, QA of #429): the foreground owner starts the tracked `.ai/scripts/test-env-up.sh` as its child, so a modified copy's export never reaches the API. A session needing a low limit has to boot the copy without `--foreground` and stop it with `test-env-down.sh`. `.ai/memory/security.md` ("Default limits in QA") records the whole workaround.

## 📝 Proposed Solution

1. **The override.** Near the existing export, the script resolves `RATE_LIMIT_PER_USER=${TEST_ENV_RATE_LIMIT_PER_USER:-10000}` (POSIX `${parameter:-word}`: unset or empty gives the default) and exports `TRYBUN_RATE_LIMIT_PER_USER="$RATE_LIMIT_PER_USER"`. `TRYBUN_RATE_LIMIT_PER_IP=10000` is unchanged. The name follows the script's existing `TEST_ENV_*` inputs (`TEST_ENV_CACHE_TTL_SECONDS`, `TEST_ENV_LOCK_DIR`).
2. **Validation before anything starts.** At the export (before the flag parsing), a value that is not a positive decimal integer without a leading zero ends the script with exit `2` and `TEST_ENV_RATE_LIMIT_PER_USER must be a positive whole number of requests per minute, got '<value>'` on stderr: no lock, no reuse check, no stop. The check is a `case` pattern on the whole value (`0*|*[!0-9]*` → refuse; `:-` has already turned an empty value into the default), not a line-based `grep`, so a value with a newline is refused too, and the echoed value is quoted. This mirrors the API's own rule (`z.coerce.number().int().min(1)`, `apps/server/src/platform/config/config.schema.ts`) and fails fast instead of a boot that waits for an API that refused its configuration.
3. **The API receives it.** The applications inherit the exported value. `.env` cannot override it: `node --env-file-if-exists` (the `start` scripts of `apps/server`) gives an exported variable precedence over the file (Node.js CLI docs; checked on Node 24: `X=fromenv node --env-file-if-exists=<file with X=fromfile>` prints `fromenv`). Under `--foreground` the outer layer passes its environment to the child boot unchanged, so `TEST_ENV_RATE_LIMIT_PER_USER=10 sh .ai/scripts/test-env-up.sh --foreground` works as the plain form does.
4. **Visible where the environment is described.** The descriptor gains `app.rateLimitPerUser` (a number, additive, like `app.runIdInEnvironment` of #453), written right after `runIdInEnvironment` and before `apiUrl` (`"runIdInEnvironment": true, "rateLimitPerUser": <N>, "apiUrl": …`). The position matters: `json_get` (`test-env-up.sh:113`) ends a value at `"`, `,` or `}`, so as the last key of `app` the value would read as `<N> ` with the space before `}` and never match, restarting the environment on every start. A test pins the round trip (Implementation Plan, step 3). and its `notes` gain one sentence: `Per-user rate limit: <N> requests per minute (TEST_ENV_RATE_LIMIT_PER_USER, default 10000).` The boot log (stderr) prints `per-user rate limit: <N> requests per minute` before the applications start, and a reuse logs the limit of the reused environment. No new `TEST_ENV_*` stdout line: stdout stays the contract the QA skills parse.
5. **The reuse check compares the limit.** The existing conditions (applications of the recorded run, health of the web application and the API, `401` from `users/me`, TTL, `sourceFingerprint`) gain `app.rateLimitPerUser` = the requested limit, as the last condition and in its own branch: when every other condition holds and only the limit differs, the script logs `the running environment <runId> has a per-user rate limit of <A>; this start asks for <B> – restarting it` and takes the existing restart path (`test-env-down.sh --keep-services`, then a boot). A descriptor without the field (written before this change) does not match and restarts once. With `--foreground`, a previous owner of the replaced run sees it stopped (`stopping`, which `test-env-down.sh` records before it signals anything) or replaced, and exits `0` without stopping anything, as for any restart today.
6. **Documentation.** The README subsection of the start command names the variable with the example and says where a manual session sets it: in its terminal, or prefixed to the command of a local `startApp` recipe for cezar Preview. Its "Owner or viewer" sentence becomes "already runs with the same sources and the same per-user limit". It also warns that a start with another limit replaces this checkout's running environment, so a low-limit session starts only when no other QA run uses it. `.ai/memory/security.md` ("Default limits in QA") replaces the temporary-copy workaround with the override. The script's `# history:` header gets a line.

### Alternatives considered

- **Refuse a mismatching warm environment** (the issue's second option). Rejected: it adds a new refusal that every caller, including the QA skills that start without the variable, would have to handle, while the script already restarts an environment that no longer matches its sources. A configuration change recreating what runs is the established practice: `docker compose up` "picks up the changes by stopping and recreating the containers" (Docker Compose reference), and Testcontainers reuses a container only when "the container configuration must be the same".
- **Honour an exported `TRYBUN_RATE_LIMIT_PER_USER` directly.** Rejected: any shell or `.env`-exporting setup that sets the production variable would silently change QA, and the raised limit of #355 exists exactly because the defaults broke QA. A `TEST_ENV_` name is an explicit opt-in.
- **Restart only the API with the new limit.** Rejected: the `--foreground` owner tears the environment down when a watched PID ends (#383), and teaching it to accept a replaced API widens the identity checks of #456 for one QA case.
- **A per-IP override too.** Deferred (Resolved assumptions, Q2): nothing needs it yet.

## 📝 Architecture

Only `.ai/scripts/test-env-up.sh` changes, in three places: the project-specific facts (resolve, validate, export), the reuse check (one more condition with its own log line) and the descriptor write (field and notes). `test-env-down.sh`, `test-env-processes.sh`, the API, `compose.yaml` and `playwright.config.ts` (the E2E API) are untouched. The entrypoint stays contract v2 and the descriptor `version` 1: the new field is additive and no reader depends on its absence.

## 📝 Edge Cases & Failure Scenarios

- **Empty value** (`TEST_ENV_RATE_LIMIT_PER_USER=`): the default `10000`, as `:-` defines.
- **Invalid value** (`0`, `-5`, `10/min`, `010`, ` 10`): exit `2` with the message of item 2; nothing is started or stopped.
- **A value the API rejects although it is all digits** (beyond `Number.MAX_SAFE_INTEGER`): the API exits on its configuration check, and the boot fails as any API start failure does today, naming `api.log`. Not worth a second validation of the API's bound.
- **A start without the variable while a manual low-limit session runs in the same checkout** (a QA skill, cezar Preview's Start app with the plain recipe, `sv-prepare-qa-tests`): the limit differs, so the environment restarts with `10000` and the manual session's owner exits. This is the same as a source change today; the README says the limit belongs to each start.
- **The reverse: a manual low-limit start while an automated QA run uses the environment:** the restart takes the run's applications away, and the new environment answers its requests with `429`. The README warning (item 6) covers it; the script cannot tell a running QA session from an idle environment.
- **Another checkout's environment runs:** unchanged – the port refusal; the limit is never compared across checkouts.
- **Two starts at once with different limits** (e.g. a QA skill and a manual session): the reuse check runs before the bootstrap lock, as today for a source change, so both may decide to restart; the machine-wide lock then serialises their boots, and the later boot replaces the earlier one. Unchanged behaviour, not widened by this change.
- **`--reset` or `--force`:** skip the reuse check as today; the requested limit applies to the boot.

## 📝 Risks & Impact Review

Low. QA tooling only; the default stays `10000`, so the QA skills, E2E and production limits are unchanged. The only behaviour change without the variable is one restart of an environment whose descriptor predates the field. Rollback: revert the commit; older descriptors with the extra field are still read correctly. After a revert the old script does not compare the limit, so a running low-limit environment would be reused as if it had `10000` until it is stopped or its sources change; stop it with `test-env-down.sh` when reverting.

## Changes to the system specification

None (agent tooling). §14.4 already says the limits can be changed with `TRYBUN_RATE_LIMIT_PER_USER`.

## Non-goals

- The limits of production, of `pnpm dev` and of the E2E API (`playwright.config.ts`).
- A per-IP or per-token override.
- Changing the limit of a running environment without a restart.

## Resolved assumptions (autonomous defaults)

Accepted by the maintainer in the session on 2026-11-24 ([#476](https://github.com/trybun/trybun/pull/476#issuecomment-7125501345)).

| # | Question | Default applied | Rationale |
|---|---|---|---|
| Q1 | A warm environment with a different limit: restart it or refuse? | Restart, through the existing stale-environment path, with a log line naming both limits. | Same as a source change today; recreate-on-config-change is the practice of Docker Compose and Testcontainers; no new refusal for the QA skills to handle. |
| Q2 | Also an override of the per-IP limit? | No. | The issue scopes the per-user limit; no QA case needs a low IP limit yet (Build for a real consumer). |
| Q3 | Where is the active limit shown? | `app.rateLimitPerUser` and a sentence in the descriptor `notes`, plus a boot-log line on stderr; no new stdout line. | Meets "the descriptor `notes` or the boot output" of the issue without touching the stdout contract the QA skills parse. |
| Q4 | Validate the value in the script or leave it to the API? | Validate in the script (positive integer, exit `2`). | Fails before the lock and any stop, with a message naming the variable, instead of a health-wait timeout. |

## Acceptance criteria

- [ ] With `TEST_ENV_RATE_LIMIT_PER_USER=10`, the API of the QA environment runs with `TRYBUN_RATE_LIMIT_PER_USER=10`, with and without `--foreground`; the descriptor's `app.rateLimitPerUser` and `notes`, and the boot log, show `10`.
- [ ] Without the variable (or with it empty) the limit is `10000`, as today.
- [ ] An invalid value exits `2` with a message naming the variable, starting and stopping nothing.
- [ ] A running environment of this checkout with the same limit is reused; with a different limit (or none recorded) it is restarted with a log line naming both limits.
- [ ] `.ai/scripts/test-env-up.spec.js` covers each criterion above.
- [ ] README start-command subsection (the variable, where Preview sets it, the replacement warning, the "Owner or viewer" sentence), `.ai/memory/security.md` ("Default limits in QA") and the script's `# history:` updated.
- [ ] Manual check: `TEST_ENV_RATE_LIMIT_PER_USER=10 sh .ai/scripts/test-env-up.sh --foreground`, then two or three reloads of a signed-in page show "Too many requests" (`RateLimitedNotice`).

## 📋 Implementation Plan

### Phase 1 – the override (one PR)

1. **Override, validation and export.** Resolve and validate `TEST_ENV_RATE_LIMIT_PER_USER`, export it as `TRYBUN_RATE_LIMIT_PER_USER`, log it. Tests in `test-env-up.spec.js`; the `pnpm` stub (which already logs its arguments to `STUB_LOG`) also logs `TRYBUN_RATE_LIMIT_PER_USER` for `--filter @trybun/server start`, so a test reads the value the API got, also through the `--foreground` child boot: the default `10000`, an override of `10`, an empty value, invalid values exiting `2` with nothing started, and `--foreground` passing the override to the API.
2. **Descriptor.** Write `app.rateLimitPerUser` and the `notes` sentence. Tests: both show the requested limit.
3. **Reuse check.** Compare the recorded limit. Tests: same limit → reused (`TEST_ENV_REUSED=1`; this also pins that `json_get` reads the field back exactly), different limit → restarted (`TEST_ENV_REUSED=0`, log line), a descriptor without the field → restarted.
4. **Documentation.** README start-command subsection, `.ai/memory/security.md`, the script's `# history:` header; move this spec to `implemented/` with status `implemented` (`.ai/specs/README.md`).
5. **Gate and manual check.** The full validation gate, then the manual check of the acceptance criteria.

## Changelog

- 2026-11-23 – Created (autonomous defaults Q1–Q4, #426).
- 2026-11-23 – Review of #476: field position for `json_get`, README sentences and Preview, the reverse replacement case, rollback note, wording fixes.
- 2026-11-24 – Defaults Q1–Q4 accepted by the maintainer.
- 2026-11-24 – Implemented in #482. One wording refinement: for a descriptor without the field the restart line reads `the running environment <runId> has no per-user rate limit recorded; this start asks for <B> – restarting it`, since there is no recorded limit to name; a reuse logs `reusing the running environment <runId> (per-user rate limit: <N> requests per minute)`.
