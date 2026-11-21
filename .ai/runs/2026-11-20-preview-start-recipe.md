# Execution plan: one start command for cezar Preview and the QA skills

Source doc: .ai/specs/implemented/2026-11-20-preview-start-recipe.md
Issue: #383 (spec PR #415, merged)

## Goal

`sh .ai/scripts/test-env-up.sh --foreground` starts the QA test environment and stays attached: as the owner it stops what it booted when its terminal closes, as a viewer it stops nothing. A documented cezar `startApp` recipe uses it, so Preview, `sv-prepare-qa-tests` and `om-prepare-test-env` share one start command.

## Scope

- `.ai/scripts/test-env-up.sh`: the `--foreground` outer layer (owner and viewer), the additive `TEST_ENV_RUN_ID` line, the boot-interrupt cleanup with the long steps in their own sessions, the reworded refusal messages.
- `.ai/scripts/test-env-down.sh`: `stopping` before it signals the applications.
- `.ai/scripts/test-env-up.spec.js`: asynchronous harness, blocking-step stub switch, tests for every role and the interrupt cleanup.
- README subsection, `.ai/memory/e2e.md`, the script `history:` headers, the spec moved to `implemented/`.

## Non-goals

- Changes to cezar, framing the application (§13.5 unchanged), several environments per machine, a `beforeRemove` hook, a PowerShell twin (spec Non-goals).

## Implementation Plan

### Phase 1: The boot path (no flag)

1. Characterize the default path and extend the harness (spec step 1).
2. `stopping` in `test-env-down.sh` and the `TEST_ENV_RUN_ID` line (spec step 2).
3. Boot-interrupt cleanup with the long steps in their own sessions (spec step 3).

### Phase 2: `--foreground`

1. The outer layer and the owner role (spec step 4).
2. The viewer role (spec step 5).
3. The refusal messages (spec step 6).

### Phase 3: Documentation and verification

1. README subsection, script history headers, memory, spec to `implemented/` (spec step 7).
2. Full validation gate; the cezar verification of spec step 8 needs the maintainer's word to set the local recipe.

## Risks

- Step 3.2: the full validation gate passed. The cezar check of spec step 8 is the PR's manual QA (`needs-qa`). It needs the project recipe set in the local cezar configuration, at the maintainer's word.

- How cezar stops a service and whether it closes terminals before removing a worktree are unverified (spec Risks); the design handles a group `SIGHUP` and a signal to the PID alone.
- Signal timing in tests: every wait in the tests is bounded, and the stubs keep their port for one second after `SIGTERM`, as the API does.

## Progress

PR: #417

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The boot path (no flag)

- [x] 1.1 Characterize the default path and extend the harness — f64408f
- [x] 1.2 `stopping` in test-env-down.sh and the TEST_ENV_RUN_ID line — bba9ebf
- [x] 1.3 Boot-interrupt cleanup with the long steps in their own sessions — 59f9f3e

### Phase 2: `--foreground`

- [x] 2.1 The outer layer and the owner role — f1a4c11
- [x] 2.2 The viewer role — f1a4c11
- [x] 2.3 The refusal messages — 5e64379

### Phase 3: Documentation and verification

- [x] 3.1 README, script history, memory, spec to implemented — 01a2291
- [x] 3.2 Full validation gate and verification — 29eeadc
