# Execution plan — Bump jsdom to 31.0.0 with every gate green (adopted from PR #366)

**Origin:** adopted — reconstructed by `om-auto-continue-pr` on 2026-11-17 because PR #366 carried no execution plan.
**PR:** #366 · **Branch:** `dependabot/npm_and_yarn/jsdom-31.0.0` · **Base:** `main`
**Author:** @dependabot — this plan interprets its intent; correct it by editing this file or commenting on the PR.

## 🎯 Goal

Update the development dependency `jsdom` of `apps/web` from 30.1.3 to 31.0.0, so the component tests of the web application (ADR 0012) run on the current major and every gate stays green.

## Scope

- `apps/web/package.json` and `pnpm-lock.yaml` (already bumped by Dependabot).
- Checking the breaking changes of jsdom 31 against the jsdom component tests of `apps/web` and the jsdom behaviour recorded in `.ai/memory/`.

## Non-goals

- Any other dependency update.
- Optional canvas support (`@napi-rs/canvas`): no test draws on a canvas, so the optional peer stays uninstalled.
- New component tests that use the CSS features jsdom 31 adds (cascade layers, `@scope`, adopted stylesheets).

## Evidence

| Conclusion | Drawn from | Confidence |
|---|---|---|
| The goal is the 30.1.3 → 31.0.0 bump of a dev dependency | PR title, body and diff (`apps/web/package.json`, `pnpm-lock.yaml`) | high |
| The Rule 10 cooldown (7 days) holds | npm publish times: jsdom 31.0.0 2026-11-05, newest new transitive (`parse5` 8.1.1, `parse5-parser-stream` 8.1.1) 2026-11-07; `minimumReleaseAge: 10080` of `pnpm-workspace.yaml` | high |
| The Node runtime is supported | jsdom 31 `engines.node` `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`; `.node-version` 24.22.1 | high |
| Vitest accepts jsdom 31 | `vitest@5.1.0` peer range `jsdom: *` | high |
| The canvas backend change does not apply | no `getContext`, `toDataURL` or `toBlob` in `apps/web/src` or `apps/web/test` | high |
| The async parsing change does not apply | no `new JSDOM`, `JSDOM.fromURL` or `JSDOM.fromFile` in the repository; Vitest's jsdom environment builds the document | high |
| The window-only `load` event change does not apply | no `load` listener on `document` in `apps/web` | high |
| The CSS engine change has no visible effect | the only `getComputedStyle` (`scrollMarginOf` of `product-tour.ts`) reads scroll margins, and component tests load no stylesheet; CI "Tests and coverage" green on 15db6c9 | high |
| Every CI check is green on the PR head | `gh pr checks 366` (13 checks, including E2E and Lighthouse) | high |
| The jsdom behaviour recorded in `.ai/memory/` still holds | release notes mention no Navigation API, `execCommand` or history-state change; the focus fix-up only affects elements that become non-focusable | medium |

## Assumptions

- The local gate on Node 24.22.1 is representative of CI (same `.node-version`).

## Risks

- **Blocked by `main` (2026-11-17):** the required check "E2E and Lighthouse" fails on `main` itself since `a5c676c` (#359): the empty shell's simulated LCP is 2503–2576 ms against the budget of 2500 ms (#372). Two runs on this PR's head failed the same way (2514, 2571 ms) while the first run on 15db6c9 passed. jsdom is a development dependency and does not reach the client bundle, so Step 2.3 waited for #372. Resolved 2026-11-18: #372 was fixed by #373, the latest `main` was merged (0ea5ded), and all 13 checks passed.
- jsdom 31 moves focus asynchronously when a focused element becomes non-focusable; a test that relied on the old synchronous focus could become timing-dependent. Mitigation: the full test suite (`pnpm test`, `pnpm test:coverage`) runs locally in addition to CI.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Already landed on this PR (reconstructed)

- [x] 1.1 Bump jsdom of apps/web to 31.0.0 with its lockfile — 15db6c9

### Phase 2: Verify the bump

- [x] 2.1 Check the jsdom 31 breaking changes against the web app's component tests — 1e5eef7
- [x] 2.2 Run the full local validation gate — 1e5eef7
- [x] 2.3 Get every required check green on the PR head — 0ea5ded
