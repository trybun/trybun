# Execution plan: a per-user rate-limit override for manual QA in the QA test environment

Source doc: .ai/specs/2026-11-23-qa-rate-limit-override.md
Issue: #426 (spec PR #476, merged; defaults Q1–Q4 accepted by the maintainer)

## Goal

`TEST_ENV_RATE_LIMIT_PER_USER=10 sh .ai/scripts/test-env-up.sh [--foreground]` starts the QA test environment with an API limited to 10 requests per user and minute; without the variable the limit stays 10000. The descriptor and the boot log show the limit, and a running environment of this checkout with another limit is restarted instead of reused.

## Scope

- `.ai/scripts/test-env-up.sh`: resolve, validate and export the override; `app.rateLimitPerUser` (before `apiUrl`) and a `notes` sentence in the descriptor; boot-log lines; the limit as the last condition of the reuse check, in its own branch with its own log line; a `# history:` line.
- `.ai/scripts/test-env-up.spec.js`: the `pnpm` stub logs the `TRYBUN_RATE_LIMIT_PER_USER` the API gets; tests for every acceptance criterion.
- README start-command subsection, `.ai/memory/security.md` ("Default limits in QA"), the spec moved to `implemented/`.

## Non-goals

- The limits of production, `pnpm dev` and the E2E API; a per-IP or per-token override; changing the limit of a running environment without a restart (spec Non-goals).
- `test-env-down.sh`, `test-env-processes.sh`, the API, `compose.yaml`, `playwright.config.ts` stay unchanged (spec Architecture).

## Implementation Plan

### Phase 1: The override

1. Override, validation, export and boot log, with tests (spec step 1).
2. Descriptor field and notes sentence, with tests (spec step 2).
3. Reuse check comparing the recorded limit, with tests (spec step 3).

### Phase 2: Documentation and verification

1. README, `.ai/memory/security.md`, script history, spec to `implemented/` (spec step 4).
2. Full validation gate and the manual check (spec step 5).

## Risks

- The manual check of the acceptance criteria (reloads showing "Too many requests") needs the real QA environment; it is the PR's manual QA when it cannot run here.
- Signal timing in the `--foreground` tests: every wait is bounded, as in the existing tests.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The override

- [ ] 1.1 Override, validation, export and boot log
- [ ] 1.2 Descriptor field and notes sentence
- [ ] 1.3 Reuse check comparing the recorded limit

### Phase 2: Documentation and verification

- [ ] 2.1 README, security memory, script history, spec to implemented
- [ ] 2.2 Full validation gate and the manual check
