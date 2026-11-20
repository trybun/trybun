# One start command for cezar Preview and the QA skills: `test-env-up.sh --foreground`

| | |
|---|---|
| Status | `draft` |
| Created | 2026-11-20 |
| Plan task | – (agent tooling) |
| System specification sections | none (agent tooling outside `docs/spec/`); §13.5 and §14.4 are relied on and left unchanged |
| Related issues / PRs | #383, #352 (machine-wide lock, `--reset`), #355 (SSH tunnel of 3000 and 8080), #400 / #410 (orphaned `next start`) |

## 📝 TLDR

The maintainer starts Trybun from the **Preview** tab of a cezar task, and `sv-prepare-qa-tests` reads its start command from the same place. Both read a `startApp` recipe, and Trybun has none. The `om-*` QA skills start the application with `.ai/scripts/test-env-up.sh`, which boots the environment, prints its address and exits. A Preview service has to keep running for as long as the application runs. Proposed: a `--foreground` flag that makes `test-env-up.sh` stay attached. It owns what it booted and tears that down when its terminal tab closes. When it only attached to a running environment, it never stops it. A documented project-scope recipe, `sh .ai/scripts/test-env-up.sh --foreground` at `http://localhost:3000`, then gives all three entry points one start command. Following the maintainer's decision on #383, the application is used in a separate browser tab; its framing ban (§13.5) stays.

## 📝 Problem Statement

- **No recipe.** cezar's Preview starts an application from a `startApp` recipe: 1–5 `services` (each a long-running command in a terminal tab of the task) and an optional `url`. The recipe sits in the project scope (`.ai/cezar/config.json`, untracked) or the personal scope (`~/.cezar/config.json`). Trybun has neither, so Preview cannot start it. `sv-prepare-qa-tests` looks at the same recipe first, and without it guesses its own command.
- **The existing script returns.** `test-env-up.sh` starts the API, the Worker and the web application in their own sessions (`setsid`). It writes `.ai/qa/test-env.json` and exits, so a Preview service built on it ends at once. Closing the Preview terminal tab would then stop nothing, and nothing would own the environment it started.
- **Three entry points that drift.** Preview, `sv-prepare-qa-tests` and `om-prepare-test-env` (→ `test-env-up.sh`) can each start the application differently. That means different ports, builds, data and pseudo-locale settings (`TRYBUN_PSEUDO_LOCALE`, #301). The script already encodes every lesson of #149, #352, #355 and #400 (own Compose project `trybun-test`, machine-wide bootstrap lock, refusal to take over `pnpm dev`). A second start command would lose them.
- **Framing (decided on #383).** Every page of the web application sends `frame-ancestors 'none'` and `X-Frame-Options: DENY` (`apps/web/src/proxy.ts`, §13.5, `proxy.spec.ts`, `e2e/security-headers.spec.ts`). Keycloak sends its own framing headers too. The maintainer decided that neither changes: Preview starts the application, and the application is opened in a separate browser tab.

## 📝 Proposed Solution

### `--foreground` in `.ai/scripts/test-env-up.sh`

The flag combines with `--force`, `--force-rebuild` and `--reset`. Without it, `om-prepare-test-env`, `om-auto-qa-pr` and `om-integration-tests` keep calling the script without flags. They get the same `TEST_ENV_*` lines on stdout, the same exit codes and the same descriptor. The only differences on that path:
- the reworded refusal messages on stderr (below);
- the lock's ownership check;
- the boot-interrupt handling of item 4. It also applies without the flag, because today's trap lets an interrupted boot carry on, and that is the same defect.

Each run with the flag ends in one of two roles:

| Role | When | While attached | When its terminal tab closes (`SIGHUP`, `SIGINT`, `SIGTERM`) | When the applications stop on their own |
|---|---|---|---|---|
| **Owner** | This run booted the environment (fresh boot, a restart of a stale one, or `--reset`). | Waits while the API, the Worker and the web application live. | Runs `test-env-down.sh`: the applications, and the Compose infrastructure when this boot started it. Exits. | When the descriptor still records this run as `running`, one process crashed: stop the rest with `test-env-down.sh` and exit `1`. Otherwise (`stopping`, `stopped`, or another `runId`) something else stopped or replaced the environment: exit `0` without touching anything. |
| **Attached** | The reuse check found this checkout's healthy environment. | Waits while those processes live. | Exits `0`. **Never stops anything.** | Exits `0`. |

Details that make the roles hold:

1. **The machine-wide bootstrap lock is released once the boot is done, and only the run's own lock.**
   - Today the lock (`/tmp/trybun-test-env.lock`) is held until the script exits (`trap 'rm -rf "$LOCK_DIR"' EXIT INT TERM`). A long-running owner would otherwise block every other checkout's boot for its whole lifetime, ending in "another bootstrap still runs after 5 min".
   - On release the script removes the lock and clears that trap (`trap - EXIT`). Otherwise the owner's eventual exit would delete a lock another checkout acquired in the meantime. Under `--reset` that could remove volumes during another checkout's boot.
   - Every removal of the lock first checks that `owner.json` names this process (`$$`).
2. **`test-env-down.sh` marks the descriptor `stopping` before it signals the applications** (today it writes `stopped` only after killing them and waiting up to 30 s). This is the one change to the down script.
   - Without it, an owner that sees its processes end while the descriptor still says `running` mistakes a manual down for a crash. The same goes for the stale restart of another invocation in the same checkout (`test-env-down.sh --keep-services` after a code change or after the 8-hour TTL).
   - The owner would then run a second, full teardown, including Compose `down` under the new boot.
   - The reuse check reads only `running`, so a down that is interrupted while `stopping` is never reused.
3. **Ownership is checked by run id.** The owner keeps the `runId` it wrote into `.ai/qa/test-env.json`. It tears down only while the descriptor still names that run as `running`. A later `--reset` or stale restart from the same checkout replaces the run, and the old owner then exits without stopping its successor. (`--force` does not replace a running environment: it skips the reuse check and then refuses on the occupied ports, as today.)
4. **A signal during the boot stops what was started so far.** This covers a cold boot of ~40 s or more with a build.
   - The `--foreground` handler replaces today's `INT`/`TERM` trap, which only removes the lock and lets the boot continue. It adds `HUP`. On a signal before the health wait succeeds, it stops:
     - the boot step running at that moment;
     - the process groups already started;
     - the Compose infrastructure (`docker compose -p trybun-test … down`) when this boot brought it up.
   - It then releases the lock and leaves no descriptor in `running` state.
   - A POSIX shell runs a trap only after its current foreground command ends. Closing a terminal signals its whole foreground process group, but a `kill` of the script's PID alone would wait for the build. So the long boot steps run as `cmd & wait $!`: the build, `compose up --wait`, and the migration and seed. The running step's PID is recorded, so the handler can stop it. The exit status `wait` returns is unchanged.
   - Variables the handler reads before they are set use `${VAR:-}` under `set -u`.
5. **Signals are handled promptly.** The wait loop sleeps as `sleep 2 & wait $!`. A trapped signal interrupts `wait` (POSIX), so the tab closes within a moment instead of after the current `sleep`.
6. **A closed terminal does not break the cleanup.** After `SIGHUP` the terminal is gone. The handler first redirects its own output to `.ai/qa/logs/foreground.log`, so a failed write under `set -eu` cannot abort the teardown.
7. **PIDs come from the processes.** The script runs as `sh …` without job control, so the children of `setsid` are not process-group leaders, `setsid` does not fork, and `$!` is the session's PID. The process groups that `test-env-down.sh` signals (`kill -- -PID`) are therefore the applications' own. Checked under `dash` on 2026-11-20: `$!` equalled the child's PGID and SID. A test asserts this (Implementation Plan, step 2), so a later change cannot regress into the orphaned-`next start` failure of #410.
8. **Output.** The owner and the attached run print the same `TEST_ENV_*` lines as today, then one line naming the role: `[test-env] attached in the foreground as the owner – closing this terminal stops the environment`, or `… as a viewer of an environment started elsewhere – closing this terminal stops nothing`. `TEST_ENV_BASE_URL` stays `http://localhost:3000`, the host of the recipe `url`, so cezar's detected address and the recipe agree.

### Another checkout's environment is running

There is one environment per machine: the Compose project `trybun-test`, the fixed ports and the lock. When the Preview of task B starts while task A's environment runs, B **refuses** (exit `1`) and never attaches. Attaching would show A's build in B's Preview. It would also tie B's tab to processes B cannot own. The existing checks already refuse: "port 3000 is served by a process this script did not start" for 3000/3001, and "port N is published by …" for the infrastructure ports. Their advice changes to fit both causes and never invites stopping another session's work:

> `port 3000 is already served – by the test environment of another checkout or by pnpm dev. This checkout never stops it: stop it from where it was started (sh .ai/scripts/test-env-down.sh there), then start again.`

The infrastructure-port message keeps the name of the container and its Compose project, and gets the same "never stops it, stop it from where it was started" advice.

### The recipe (local cezar configuration, documented in the README)

```json
{ "startApp": { "services": ["sh .ai/scripts/test-env-up.sh --foreground"], "url": "http://localhost:3000" } }
```

- **Scope: project** (`.ai/cezar/config.json` of the repository, untracked), so every task of the project gets it. The personal scope is the per-user alternative.
- The cezar API does not version the recipe, so the README documents it as the single source. It lives in a new subsection *Test environment of the QA skills and cezar Preview*. That subsection lists:
  - the recipe;
  - that the application opens in a separate browser tab (the framing ban of §13.5);
  - the demo sign-in of *Signing in locally*;
  - for a remote cockpit, the SSH-tunnel ports the browser needs: web `3000` and Keycloak `8080` (#355). Mailpit `8025` is optional, for reading invitation and notification e-mails. The API `3001` is not one of them: the browser never calls it (BFF, §14.4).
  - the one-environment-per-machine rule and what Preview does in a second checkout.
- `.ai/memory/e2e.md` adds `--foreground` to the list of what `om-prepare-test-env --regenerate` does not know and must keep. The script's `history:` header records the change, as for `--reset`.

### Alternatives considered

- **A second start script for Preview** (e.g. `pnpm dev`, or a `next start` wrapper). Rejected: it is the third entry point this change removes. It would also lose the lessons the script holds (own Compose project, lock, pseudo-locale, Worker).
- **A wrapper that calls `test-env-up.sh` and then waits.** Rejected: the wrapper could not tell an owned boot from a reuse except by parsing `TEST_ENV_REUSED`. The boot-interrupt cleanup and the lock release need the script's internal state anyway.
- **Attaching across checkouts.** Rejected, see above.
- **Framing the application in Preview** through a test-environment exception to §13.5, or a relaxed development realm. Rejected by the maintainer on #383: it would change a security requirement, and the test environment would differ from a deployment.

## 📝 Architecture

- **Changed:**
  - `.ai/scripts/test-env-up.sh`: flag, roles, owned lock release, boot-interrupt cleanup, refusal messages.
  - `.ai/scripts/test-env-down.sh`: marks the descriptor `stopping` before it signals the applications (item 2). Otherwise unchanged: it stops only what its checkout's descriptor records, waits for the ports and stops Compose only when the boot started it.
  - `.ai/scripts/test-env-up.spec.js` (Vitest, stubs of `docker`, `curl` and `pnpm` in a throwaway checkout). It gains an asynchronous `spawn` helper that waits for the role line and sends signals; today's `spawnSync` helper blocks until the script exits. The `curl` stub gains a health switch (a `STUB_DIR/unhealthy` file) for an interrupted boot.
- **Unchanged:** the descriptor shape `.ai/qa/test-env.json` (contract v2), as the QA skills read it. The new transient `stopping` value of `status` is never `running`, so readers that check for `running` are unaffected. Product code, the API, the web application, Keycloak, §13.5 and the CI gates stay as they are.
- **Consumers today:** the maintainer's cezar Preview (with the recipe), `sv-prepare-qa-tests` (reads the recipe) and `om-prepare-test-env` / `om-auto-qa-pr` / `om-integration-tests` (call the script without the flag).
- **ShellCheck:** the script stays POSIX `sh` and passes ShellCheck in `pnpm lint`.

## 📝 UI/UX

There is no Trybun UI change. The developer's flow in cezar:

1. Open Preview in a task → cezar starts the recipe's service in a terminal tab. The terminal shows the boot log, then the `TEST_ENV_*` lines and the role line.
2. Open `http://localhost:3000` in a separate browser tab, from the detected address or the recipe `url`, and sign in with a demo account (Keycloak included).
3. Close the terminal tab → an owner stops the environment. A viewer stops nothing.

Leaving the Preview tab makes cezar forget the started application (out of scope, cezar behavior). Opening Preview again starts the service again, and the reuse check attaches within seconds as a viewer: no second boot. Closing only the preview frame stops nothing; the terminal tab owns the process.

## 📝 Edge Cases & Failure Scenarios

| Case | Behavior |
|---|---|
| Preview restarted while its first terminal (the owner) still runs | The second run attaches as a viewer. Closing the first terminal stops the environment; the viewer then sees its processes end and exits `0` with a message. |
| A QA skill of the same checkout reused the environment the Preview owner booted | Closing the owner's terminal stops it under that QA run. This is consistent with "closing the Preview tab stops what it started". The README says to keep the Preview terminal open during a QA run. |
| `test-env-down.sh` run by hand while an owner is attached | The descriptor turns `stopping` before any process ends, so the owner exits `0` without a second teardown. |
| A QA skill of the same checkout restarts the environment while an owner is attached (code changed, or the 8-hour TTL expired) | The stale restart runs `test-env-down.sh --keep-services`: the descriptor turns `stopping`, then gets the new boot's `runId`. The old owner exits `0` and leaves the new boot and its Compose stack alone. The new environment has no foreground owner; the next Preview attaches to it as a viewer. |
| Owner killed with `SIGKILL`, or cezar itself crashes | No handler runs and the environment keeps running without an owner. The next Preview attaches as a viewer, and `sh .ai/scripts/test-env-down.sh` stops it (README). |
| One application crashes | The owner stops the rest (`test-env-down.sh`), keeps the logs in `.ai/qa/logs/` and exits `1`, so the terminal shows the failure. |
| Boot fails (build, migration, health timeout) | As today: exit `1` with the log path. Started processes are stopped and the lock is released. |
| Terminal closed during the boot | What was started so far is stopped (Proposed Solution, item 3). |
| Another checkout's environment or `pnpm dev` holds 3000/3001 or an infrastructure port | Refuse with the message above, exit `1`, stop nothing. |
| Worktree removed while its owner terminal runs | If cezar closes the task's terminals before removing the worktree, the `SIGHUP` teardown runs normally. Whether it does is not verified and is outside this repository (risk below). |
| Cockpit opened as `127.0.0.1` | The recipe and `TEST_ENV_BASE_URL` use `localhost`, the host the cookie domain, Keycloak's redirect URIs and `NEXTAUTH_URL` use. The README says to open the application at `localhost`. |

## 📝 Risks & Impact Review

- **Low blast radius.** The change touches agent tooling only, behind an opt-in flag. The default path is pinned by the existing tests and a new "without the flag it returns" test. Rollback is a revert.
- **Regeneration.** `om-prepare-test-env --regenerate` does not know `--foreground`. Mitigation: the script's history header and the memory list of hand-kept features (as for `--reset`).
- **How cezar stops a service (unverified).** Closing a terminal normally sends `SIGHUP` to its foreground process group, and the design also handles a signal sent to the script's PID alone (item 4). Step 7 records which one cezar sends.
- **cezar worktree removal (unverified).** If cezar removes a worktree without closing its terminals first, that worktree's applications keep running and its descriptor disappears. The next boot then refuses on the occupied ports, with the message naming how to recover. A `beforeRemove` hook is deferred (Resolved assumptions, Q2).

## Changes to the system specification

None. The test environment of the QA skills is agent tooling and not described in `docs/spec/`. §13.5 (framing denied) and §14.4 (BFF) are relied on, not changed.

## Non-goals

- Changes to cezar itself (e.g. Preview remembering a running application).
- Framing the application or Keycloak in Preview, or any change of the §13.5 security headers or the realm headers (decided on #383).
- More than one test environment per machine (per-checkout ports or Compose projects).
- A PowerShell twin. None exists, and the QA skills run on Linux and macOS.

## Resolved assumptions (autonomous defaults)

| # | Question | Assumed answer | Rationale |
|---|---|---|---|
| Q1 | Preview in task B while task A's environment runs: attach or refuse? | **Refuse** with a clear message, never stop A's environment. | Attaching would show A's build in B's Preview and tie B's tab to processes it cannot own. Refusing is the existing behavior, with clearer advice. |
| Q2 | Add a `beforeRemove` worktree hook calling `test-env-down.sh`? | **No, deferred.** | The terminal tab already owns the teardown. The hook is optional in #383 and lives in local configuration. Whether cezar closes terminals before removal is unverified. It can be added later, because `test-env-down.sh` only stops its own checkout's environment. |
| Q3 | Recipe scope? | **Project** (`.ai/cezar/config.json`); personal documented as the alternative. | Every task of the project gets the same command, which is the point of #383. |
| Q4 | Where to document the recipe? | **README**, new subsection under *Getting started*; memory note in `.ai/memory/e2e.md`. | Rule 5 keeps the README current for developers; `AGENTS.md` stays a short entry point. |
| Q5 | Who sets the recipe in the local cezar configuration? | **The maintainer, once**, from the README. An agent sets it during verification only at the maintainer's word in the session. | It is local configuration outside the repository and outside a PR's reach. |
| Q6 | Which ports go into the SSH-tunnel list? | **3000 and 8080, plus optional 8025.** Not 3001. | The browser calls only the web application and Keycloak; the API is behind the BFF (§14.4). |

## Acceptance criteria

- [ ] In a cezar task on `main`, with the documented recipe, the Preview tab starts the application. A demo account signs in when `http://localhost:3000` is opened in a separate browser tab (Keycloak included). The §13.5 framing headers and their tests are unchanged.
- [ ] Closing the terminal tab of an owner stops the applications, and the Compose infrastructure when that boot started it. Starting Preview again while the environment runs attaches within seconds. Closing a viewer's tab stops nothing. Another checkout's environment is never stopped, and the second checkout gets the refusal message.
- [ ] The machine-wide bootstrap lock is free while an owner is attached.
- [ ] `om-prepare-test-env` and `sv-prepare-qa-tests` start the application with the same script. Without `--foreground` the script's output and exit codes are unchanged.
- [ ] README documents the recipe, the separate-tab use, the SSH-tunnel ports and the one-environment rule; `.ai/memory/e2e.md` lists `--foreground` among the hand-kept features.
- [ ] `.ai/scripts/test-env-up.spec.js` covers every row of the role table and the boot-interrupt cleanup; ShellCheck (`pnpm lint`) passes.

## 📋 Implementation Plan

### Phase 1 – `--foreground` (one PR)

1. **Characterize the default path and extend the harness.** Add the asynchronous `spawn` helper and the `curl` health switch (Architecture). Add tests asserting that `test-env-up.sh` without flags exits right after printing `TEST_ENV_STATUS=running` (fresh boot and reuse) and keeps the lock free afterwards. Commit them green on the unchanged scripts.
2. **Lock ownership and `stopping`.**
   - Clear the `EXIT` trap on release, and check `owner.json` against `$$` before every removal.
   - Make `test-env-down.sh` write `stopping` before it signals.
   - Tests: a lock acquired by another process after this run released its own survives this run's exit; the descriptor is `stopping` while the stubbed applications keep their port after `SIGTERM`, and `stopped` afterwards.
3. **Owner role.** Parse `--foreground`. After a fresh boot, release the lock, install the `HUP`/`INT`/`TERM` handler (redirected output, `runId` check, `test-env-down.sh`) and wait with `sleep 2 & wait $!` while the three PIDs live. Tests:
   - `SIGTERM` and `SIGHUP` stop the stubbed applications and mark the descriptor `stopped`;
   - Compose `down` runs only when this boot started it;
   - the lock is absent while attached;
   - a crashed application gives exit `1` and a teardown;
   - a manual `test-env-down.sh` gives exit `0` and no second teardown;
   - a stale restart (`--reset` from a second invocation) makes the old owner exit `0` without stopping its successor or its Compose stack;
   - each recorded PID is the leader of its own process group (item 7).
4. **Attached role.** After a successful reuse check, wait the same way. The handler only exits. Tests: a signal exits `0`, the descriptor stays `running` and the applications stay alive; processes stopped elsewhere give exit `0`.
5. **Boot-interrupt cleanup.** Run the long boot steps as `cmd & wait $!` with the running step's PID recorded. A signal before the health wait succeeds stops that step and the started process groups, runs Compose `down` when this boot started the infrastructure, and releases the lock. Tests, with the health switch off and the script interrupted by `SIGTERM` to its PID alone, with and without `--foreground`: no live stub, no lock, no `running` descriptor, exit non-zero.
6. **Refusal messages.** Reword the occupied-port messages (Proposed Solution). Test: an occupied 3000 gives exit `1`, the new message, and no `kill` or Compose `down`.
7. **Documentation.**
   - README subsection: recipe, scope, separate tab, sign-in, tunnel ports, one-environment rule, keep the Preview terminal open during QA.
   - `history:` lines in the script header.
   - `.ai/memory/e2e.md` hand-kept list.
   - Set this spec's status to `implemented` and move it to `implemented/` with a changelog entry.
8. **Verification.** Run the validation gate (`pnpm lint` including ShellCheck, `pnpm test`). Then, at the maintainer's word, set the project recipe and verify the acceptance criteria in a cezar task:
   - Preview starts the app;
   - a demo account signs in in a separate tab;
   - closing the terminal stops it, and the PR records which signal cezar sent;
   - a re-start attaches within seconds;
   - a second checkout refuses. Attach the terminal output and a screenshot of the signed-in application to the PR.

## Changelog

- 2026-11-20 – Created (#383), with the maintainer's no-framing decision recorded on the issue.
