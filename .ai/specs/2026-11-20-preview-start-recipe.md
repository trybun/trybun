# One start command for cezar Preview and the QA skills: `test-env-up.sh --foreground`

| | |
|---|---|
| Status | `approved` |
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

The flag combines with `--force-rebuild` and `--reset`. `--foreground --force` is rejected with exit `2`: `--force` cannot replace a running environment (item 2), so the combination has no meaning. Without `--foreground`, `om-prepare-test-env`, `om-auto-qa-pr` and `om-integration-tests` keep calling the script without flags. They get the same `TEST_ENV_*` lines on stdout (plus one additive line, item 2), the same exit codes and the same descriptor. The boot-interrupt fix (item 3) and the reworded refusal messages on stderr also apply without the flag, because today's interrupted boot carries on, which is the same defect.

**Shape: a thin outer layer of the same script.** With `--foreground`, the script does not boot in its own process. It:
1. runs itself without the flag as a child (`sh "$ROOT/.ai/scripts/test-env-up.sh" <other flags> & wait $!`; the absolute path, because the script has already changed into `$ROOT`). The child's stderr, the boot log, streams to the terminal. Its stdout goes to a file under `.ai/qa/logs/` and is printed after `wait`. A pipe through `tee` would make `$!` and the exit status those of `tee`, and the `TEST_ENV_*` lines come only at the end anyway;
2. reads the child's `TEST_ENV_REUSED` and `TEST_ENV_RUN_ID` lines once the child exits `0`;
3. stays attached in the resulting role.

The boot, its machine-wide lock and its exit path stay exactly the code path the QA skills use. The child releases the lock when it exits after the boot, as today, so no long-running process ever holds it. A child that exits non-zero ends the outer layer with the same code.

Each run with the flag ends in one of two roles:

| Role | When | While attached | When its terminal tab closes (`SIGHUP`, `SIGINT`, `SIGTERM`) | When the applications stop on their own |
|---|---|---|---|---|
| **Owner** | The child booted the environment: `TEST_ENV_REUSED=0` (a fresh boot, a restart of a stale one, or `--reset`). | Waits while the API, the Worker and the web application live. | Runs `test-env-down.sh`: the applications, and the Compose infrastructure when that boot started it. Exits. | When the descriptor still records its run as `running`, one process crashed: stop the rest with `test-env-down.sh` and exit `1`. Otherwise (`stopping`, `stopped`, or another `runId`) something else stopped or replaced the environment: print which, and exit `0` without touching anything. |
| **Viewer** | The child reused this checkout's healthy environment: `TEST_ENV_REUSED=1`. | Waits while those processes live. | Exits `0`. **Never stops anything.** | Prints which (stopped, or replaced by run *X*), and exits `0`. |

Details that make the roles hold:

1. **`test-env-down.sh` marks the descriptor `stopping` before it signals the applications.** Today it writes `stopped` only after killing them and waiting up to 30 s. This is the one change to the down script.
   - Without it, an owner that sees its processes end while the descriptor still says `running` mistakes a manual down for a crash. The same goes for a replacement from another invocation in the same checkout: the stale restart after a code change or after the 8-hour TTL (`test-env-down.sh --keep-services`, line 148), or a `--reset` (line 156).
   - The owner would then run a second, full teardown, including Compose `down` under the new boot.
   - The reuse check reads only `running`, so a down that is interrupted while `stopping` is never reused.
2. **Ownership is checked by run id, printed by the boot.** `print_result` adds one line, `TEST_ENV_RUN_ID=<runId>`. It is the `runId` the boot wrote into `.ai/qa/test-env.json`, or the reused one. Reading it from stdout rather than the descriptor leaves no window in which a concurrent replacement could be mistaken for this run. The line is additive: consumers read the `TEST_ENV_*` lines by key. The owner tears down only while the descriptor still names that run as `running`. A later replacement from the same checkout makes the old owner exit without stopping its successor. (`--force` does not replace a running environment: it skips the reuse check and then refuses on the occupied ports, as today. That is why the flag list above leaves it out.)
3. **A signal during the boot stops what was started so far, with or without the flag.** This covers a cold boot of ~40 s or more with a build.
   - Today's trap (`trap 'rm -rf "$LOCK_DIR"' EXIT INT TERM`) only removes the lock and lets the boot continue. It becomes one handler for `HUP`, `INT` and `TERM`. On a signal before the boot completes, the handler stops:
     - the boot step running at that moment;
     - the process groups already started;
     - the Compose infrastructure (`docker compose -p trybun-test … down`) when this boot brought it up.
   - It then removes the lock, last, and only once this run has acquired it (as today's trap, installed by `acquire_lock`), and exits non-zero. No descriptor is left in `running` state.
   - A POSIX shell runs a trap only after its current foreground command ends. Killing the shell of a background step leaves that step's children running (checked under `dash` on 2026-11-20). So the long boot steps run like `start_bg`: in their own session (`setsid … & wait $!`). These are the install and build, `compose up --wait`, and the migration and seed. The handler stops the running step's whole process group (`kill -- -PID`). The exit status `wait` returns is unchanged.
   - The handler is idempotent, because the terminal's `SIGHUP` reaches the outer layer and the child together. Each teardown command ends in `|| true`, so a failing `docker compose down` cannot skip the lock removal. Variables it reads before they are set use `${VAR:-}` under `set -u`.
4. **The outer layer forwards signals.** It forwards with `SIGTERM`, never `SIGINT`: the child is an asynchronous command of a shell without job control, which ignores `SIGINT` and `SIGQUIT` (POSIX; `SigIgn` 0x6 checked on 2026-11-20).
   - A signal during the boot is forwarded to the child. The outer layer waits for the child's cleanup and exits non-zero without a teardown of its own.
   - A signal while attached runs the role's action from the table.
   - The handler decides by state, not by phase. A signal that arrives after the child exited `0` but before the role is set is handled as the role the child's output already names, so `TEST_ENV_REUSED=0` still tears down.
5. **Signals are handled promptly.** The wait loop sleeps as `sleep 2 & wait $!`. A trapped signal interrupts `wait` (POSIX; checked under `dash`: within a second), so the tab closes within a moment instead of after the current `sleep`.
6. **A teardown is never cut off.** Every teardown runs in its own session and the handler waits for it: the owner's `test-env-down.sh`, and the child's interrupt cleanup (item 3). `sv-prepare-qa-tests` stops the app with `kill -- -<pgid>` and then `kill -9` "if it is still alive after a few seconds" (its SKILL.md, "Finish and clean up"). That `SIGKILL` hits the outer layer's process group, but not a teardown running in another session. `test-env-down.sh` can take up to 30 s while the API runs its shutdown hooks, and it completes anyway, so the descriptor never stays `stopping` with live applications.
7. **A closed terminal does not break the cleanup.** After `SIGHUP` the terminal is gone. Each handler first redirects its own output to `.ai/qa/logs/foreground.log`, so a failed write under `set -eu` cannot abort the teardown.
8. **PIDs come from the processes.** The script runs as `sh …` without job control, so the children of `setsid` are not process-group leaders, `setsid` does not fork, and `$!` is the session's PID. The process groups that `test-env-down.sh` signals (`kill -- -PID`) are therefore the applications' own. Checked under `dash` on 2026-11-20: `$!` equalled the child's PGID and SID. A test asserts this (Implementation Plan, step 3), so a later change cannot regress into the orphaned-`next start` failure of #410.
9. **Output.** After the child's `TEST_ENV_*` lines the outer layer prints one line naming the role: `[test-env] attached in the foreground as the owner – closing this terminal stops the environment`, or `… as a viewer of an environment started elsewhere – closing this terminal stops nothing`. `TEST_ENV_BASE_URL` stays `http://localhost:3000`, the host of the recipe `url`, so cezar's detected address and the recipe agree.

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
- **A long-running boot in the script's own process** (the first draft of this spec). Rejected after review: it held the machine-wide lock across the attached wait, so the lock had to be released mid-run. That needed a `trap - EXIT` and an ownership check of the lock: more hand-kept code that `om-prepare-test-env --regenerate` can drop, and a way to delete another checkout's lock if done wrong. The outer layer gets the same roles from the published `TEST_ENV_*` lines.
- **A separate wrapper script** (e.g. `test-env-foreground.sh`). It is equivalent to the outer layer, but it is a second entry point beside the one #383 names (`--foreground` in `test-env-up.sh`).
- **Attaching across checkouts.** Rejected, see above.
- **Framing the application in Preview** through a test-environment exception to §13.5, or a relaxed development realm. Rejected by the maintainer on #383: it would change a security requirement, and the test environment would differ from a deployment.

## 📝 Architecture

- **Changed:**
  - `.ai/scripts/test-env-up.sh`: the `--foreground` outer layer with its two roles, the additive `TEST_ENV_RUN_ID` line, boot-interrupt cleanup with the long steps in their own sessions, refusal messages.
  - `.ai/scripts/test-env-down.sh`: marks the descriptor `stopping` before it signals the applications (item 1). Otherwise unchanged: it stops only what its checkout's descriptor records, waits for the ports and stops Compose only when the boot started it.
  - `.ai/scripts/test-env-up.spec.js` (Vitest, stubs of `docker`, `curl` and `pnpm` in a throwaway checkout). It gains:
    - an asynchronous `spawn` helper that waits for a line of output and sends signals (today's `spawnSync` helper blocks until the script exits);
    - a `pnpm` stub switch that blocks a named boot step (`install`, `build`, `db:migrate`) and starts a grandchild process, so an interrupt can be tested while a step runs.
- **Unchanged:** the descriptor shape `.ai/qa/test-env.json` (contract v2), as the QA skills read it; stdout gains only the additive `TEST_ENV_RUN_ID` line. The new transient `stopping` value of `status` is never `running`, so readers that check for `running` are unaffected. Product code, the API, the web application, Keycloak, §13.5 and the CI gates stay as they are.
- **Consumers today:**
  - the maintainer's cezar Preview, with the recipe;
  - `sv-prepare-qa-tests`. It reads the recipe first and runs it detached (`setsid nohup <cmd> > .qa-session/app.log 2>&1 & echo $! > .qa-session/app.pid`), then polls the URL (its SKILL.md, "Start the application"). A command that stays attached is what it expects: without `--foreground`, its saved PID would be gone after the boot. It stops the app with `SIGTERM` to that PID's process group, then `SIGKILL` after a few seconds ("Finish and clean up"). `nohup` makes `SIGHUP` ignored, so the outer layer handles the `SIGTERM` as the owner, and the detached teardown (item 6) survives the `SIGKILL`. It must never stop a process it did not start, and the viewer role matches that.
  - `om-prepare-test-env` / `om-auto-qa-pr` / `om-integration-tests`, which call the script without the flag.
- **ShellCheck:** the script stays POSIX `sh` and passes ShellCheck in `pnpm lint`.

## 📝 UI/UX

There is no Trybun UI change. The developer's flow in cezar:

1. Open Preview in a task → cezar starts the recipe's service in a terminal tab. The terminal shows the boot log, then the `TEST_ENV_*` lines and the role line.
2. Open `http://localhost:3000` in a separate browser tab, from the detected address or the recipe `url`, and sign in with a demo account (Keycloak included).
3. Close the terminal tab → an owner stops the environment. A viewer stops nothing.

Leaving the Preview tab makes cezar forget the started application (out of scope, cezar behavior). Opening Preview again starts the service again, and the reuse check attaches within seconds as a viewer: no second boot. That holds while the checkout's sources and the 8-hour TTL still match the running environment. After a code change the new start replaces it with a fresh boot, a few seconds when the build cache allows, and becomes its owner; the old owner exits `0` (edge cases). Closing only the preview frame stops nothing; the terminal tab owns the process.

## 📝 Edge Cases & Failure Scenarios

| Case | Behavior |
|---|---|
| Preview restarted while its first terminal (the owner) still runs | The second run attaches as a viewer. Closing the first terminal stops the environment; the viewer then sees its processes end and exits `0` with a message. |
| A QA skill of the same checkout reused the environment the Preview owner booted | Closing the owner's terminal stops it under that QA run. This is consistent with "closing the Preview tab stops what it started". The README says to keep the Preview terminal open during a QA run. |
| `test-env-down.sh` run by hand while an owner is attached | The descriptor turns `stopping` before any process ends, so the owner exits `0` without a second teardown. |
| Another start in the same checkout replaces the environment while an owner is attached (code changed, the 8-hour TTL expired, or `--reset`) | The replacement runs `test-env-down.sh --keep-services`: the descriptor turns `stopping`, then gets the new boot's `runId`. The old owner prints that it was replaced by run *X*, exits `0`, and leaves the new boot and its Compose stack alone. When the replacement was a Preview start, that terminal is the new owner. When it was a QA skill, the new environment has no foreground owner, and the next Preview attaches to it as a viewer. |
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
- **How cezar stops a service (unverified).** Closing a terminal normally sends `SIGHUP` to its foreground process group, and the design also handles a signal sent to the script's PID alone (items 3 and 4). Step 8 records which one cezar sends.
- **cezar worktree removal (unverified).** If cezar removes a worktree without closing its terminals first, that worktree's applications keep running and its descriptor disappears. The next boot then refuses on the occupied ports, with the message naming how to recover. A `beforeRemove` hook is deferred (Resolved assumptions, Q2).

## Changes to the system specification

None. The test environment of the QA skills is agent tooling and not described in `docs/spec/`. §13.5 (framing denied) and §14.4 (BFF) are relied on, not changed.

## Non-goals

- Changes to cezar itself (e.g. Preview remembering a running application).
- Framing the application or Keycloak in Preview, or any change of the §13.5 security headers or the realm headers (decided on #383).
- More than one test environment per machine (per-checkout ports or Compose projects).
- A PowerShell twin. None exists, and the QA skills run on Linux and macOS.

## Resolved assumptions (autonomous defaults)

Confirmed as they stand by the maintainer on 2026-11-20 (in the session, recorded on #415).

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
- [ ] Closing the terminal tab of an owner stops the applications, and the Compose infrastructure when that boot started it. Starting Preview again while the environment runs, with unchanged sources and within the 8-hour TTL, attaches within seconds. Closing a viewer's tab stops nothing. Another checkout's environment is never stopped, and the second checkout gets the refusal message.
- [ ] The machine-wide bootstrap lock is free while an owner or a viewer is attached (the child that booted has exited).
- [ ] `om-prepare-test-env` and `sv-prepare-qa-tests` start the application with the same script. `sv-prepare-qa-tests` runs the recipe detached and stops it through its saved PID. Without `--foreground` the script's exit codes and its `TEST_ENV_*` lines are unchanged, apart from the additive `TEST_ENV_RUN_ID`.
- [ ] README documents the recipe, the separate-tab use, the SSH-tunnel ports and the one-environment rule; `.ai/memory/e2e.md` lists `--foreground` among the hand-kept features.
- [ ] `.ai/scripts/test-env-up.spec.js` covers every row of the role table and the boot-interrupt cleanup; ShellCheck (`pnpm lint`) passes.

## 📋 Implementation Plan

### Phase 1 – `--foreground` (one PR)

1. **Characterize the default path and extend the harness.** Add the asynchronous `spawn` helper and the `pnpm` blocking-step switch (Architecture). Add tests asserting that `test-env-up.sh` without flags exits right after printing `TEST_ENV_STATUS=running` (fresh boot and reuse) and keeps the lock free afterwards. Commit them green on the unchanged scripts.
2. **`stopping` and `TEST_ENV_RUN_ID`.** Make `test-env-down.sh` write `stopping` before it signals, and add the `TEST_ENV_RUN_ID` line to `print_result`. Tests:
   - the descriptor is `stopping` while the stubbed applications keep their port after `SIGTERM`, and `stopped` afterwards;
   - a fresh boot and a reuse print the `runId` of the descriptor.
3. **Boot-interrupt cleanup.** One `HUP`/`INT`/`TERM` handler, idempotent, with every teardown command ending in `|| true` and the lock removed last. The install and build, `compose up --wait`, and the migration and seed run in their own sessions (`setsid … & wait $!`). Tests, without `--foreground`, with a boot step blocked by the stub and `SIGTERM` sent to the script's PID alone:
   - no stub process or grandchild survives;
   - no lock and no `running` descriptor are left;
   - the exit code is non-zero;
   - Compose `down` runs only when this boot started the infrastructure;
   - the cleanup runs in its own session and completes even when the script's process group gets `SIGKILL` two seconds after the `SIGTERM`;
   - each recorded application PID is the leader of its own process group (item 8).
4. **Owner role.** The `--foreground` outer layer: run the child, forward `SIGTERM` to it during the boot, read `TEST_ENV_REUSED` and `TEST_ENV_RUN_ID`, then wait with `sleep 2 & wait $!` while the three PIDs live. The owner's handler redirects its output, checks the `runId` and runs `test-env-down.sh`. Tests:
   - `SIGTERM` and `SIGHUP` stop the stubbed applications and mark the descriptor `stopped`;
   - Compose `down` runs only when that boot started it;
   - the lock is absent while attached;
   - a crashed application gives exit `1` and a teardown;
   - a manual `test-env-down.sh` gives exit `0` and no second teardown;
   - a replacement (`--reset` from a second invocation) makes the old owner exit `0` without stopping its successor or its Compose stack;
   - `SIGTERM` during the boot leaves the same clean state as step 3, with no second teardown from the outer layer;
   - `SIGTERM` and then, two seconds later, `SIGKILL` to the outer layer's process group, with a stubbed slow shutdown, still end in a `stopped` descriptor and no live stub (item 6);
   - a signal between the child's exit and the role being set still tears down (item 4);
   - `--foreground --force` exits `2`.
5. **Viewer role.** After a reuse, wait the same way; the handler only exits. Tests:
   - a signal exits `0`, the descriptor stays `running` and the applications stay alive;
   - processes stopped elsewhere give exit `0` with the message.
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
   - a second checkout refuses;
   - `sv-prepare-qa-tests` starts the app through the recipe and stops it through its saved PID.

   Attach the terminal output and a screenshot of the signed-in application to the PR.

## Changelog

- 2026-11-20 – Created (#383), with the maintainer's no-framing decision recorded on the issue.
- 2026-11-20 – Review of #415: `--foreground` becomes an outer layer that runs the boot as a child, so no long-running process holds the lock. The run id is read from an additive `TEST_ENV_RUN_ID` line. Long boot steps run in their own sessions so an interrupt reaches their children. The interrupt tests block a boot step. `sv-prepare-qa-tests` is checked and verified. Re-review: teardowns are detached, so the `kill -9` of `sv-prepare-qa-tests` cannot cut them off. The child's stdout goes to a file. The handler decides by state. The child is run by its absolute path. `--foreground --force` is rejected.
- 2026-11-20 – Approved: the maintainer accepted Q1–Q6 and decided the merge in the session.
