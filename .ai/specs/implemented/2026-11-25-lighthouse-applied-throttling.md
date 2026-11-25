# Lighthouse budget measured with applied throttling

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-11-25 |
| Plan task | – |
| System specification sections | §2.9 (Performance) |
| Related issues / PRs | #503; earlier work on the same budget: #72, #146, #163, #372, #374 |

## Context

The Lighthouse budget of §2.9 fails now and then in CI on unchanged code. Two examples: on `main` at `4a4e7ded` (a test-only change) and on PR #495 (documentation only). Both runs failed on "LCP of the empty application shell < 2.5 s". Each failure blocks a pull request until somebody re-runs the job.

**Data from CI.** 417 Lighthouse runs of the empty shell in 139 jobs between 2026-11-11 and 2026-11-24, taken from the Playwright reports of the CI artifacts:

- A single run reaches 2.5 s or more in **13.4 %** of the runs. The median of three, which §2.9 applies, did so in 4 of the 139 jobs (2.9 %). A binomial model of the single-run rate gives 4.9 %.
- The typical run lands on **2350–2430 ms**: 85 % of the runs are at 2.3 s or more, 42 % at 2.4 s or more. The budget passes with a margin of 70–150 ms. In October the most common step was ~2000 ms (#163), so the margin has shrunk.
- The client JavaScript of the shell grew from 338 KB to 349 KB (transfer size) over these two weeks.

**Cause.** The budget uses the default of Lighthouse, simulated throttling: Lighthouse records an unthrottled load and Lantern computes the metrics of a slow mobile load from it.

- Served from `localhost`, the document, the stylesheet and about 18 scripts (~300 KB) all arrive within 75–125 ms. That is about the moment of the first paint of the `h1`: the observed LCP is 77–143 ms.
- Lantern counts in the LCP every script that was downloaded and evaluated before that paint (`.ai/memory/e2e.md`, #163).
- A few milliseconds on the runner decide how many scripts that is. The simulated LCP of one build therefore lands on steps: ~1980, ~2350, ~2420 and ~3030 ms.
- The Lighthouse documentation says simulation "suffers from edge cases" ([throttling.md](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)) and that free CI environments are "typically quite volatile" ([variability.md](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md)).

In the simulation the LCP lies 1.4–2.1 s after the FCP. In a load with applied throttling the `h1` is painted together with the first paint: the LCP equals the FCP (measurements below). The simulated value is therefore an artefact of the model, not the experience of a user. §2.9 already says that the steps hide the growth of the first load, and it guards that growth deterministically with the first-load check of the build.

**Measurements** (2026-11-25; QA test environment on the agents' machine, 8 cores; production build of `main` `8ac1f566`; Lighthouse 13.5, mobile profile):

| Variant | Page | Runs | LCP (ms) | FCP (ms) | TBT (ms) | Performance |
|---|---|---|---|---|---|---|
| Simulated (today) | empty shell | 15 | 1983–3045, most 2345–2424 | 907–912 | 47–80 | 0.94–0.99 |
| **Applied (`devtools`)** | empty shell | 15 | **1605–1658** | = LCP | 95–125 | 0.98–0.99 |
| Simulated, 6 busy CPU loops | empty shell | 10 | 1697–3049 | 913–958 | 56–206 | 0.94–0.99 |
| **Applied, 6 busy CPU loops** | empty shell | 10 | **1613–1658** | = LCP | 101–168 | 0.97–0.99 |
| Simulated | sign-in redirect | 8 | 1689–2280 | 906–915 | 53–93 | 0.98–0.99 |
| **Applied** | sign-in redirect | 8 | **1651–1680** | = LCP | 75–97 | 0.98–0.99 |
| Simulated with `experimental.inlineCss` | empty shell | 15 | 2516–3202 | 910–1020 | 53–120 | – |

The local simulated runs reproduce the steps of CI. Inlining the CSS made it worse and the paint did not move earlier, so the stylesheet is not what holds the paint.

**The machine matters with applied throttling.** Lighthouse rates applied (DevTools) throttling "NO MITIGATION" for client hardware variability and client resource contention, against "PARTIALLY MITIGATED" for simulation ([variability.md](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md), "Effect of Throttling Strategies"): the 4× CPU slowdown runs on the real CPU. The measurements above come from the agents' machine only, so they predict CI only as far as the two machines compare. The benchmark index that Lighthouse writes into every report (`environment.benchmarkIndex`):

| Machine | Benchmark index | Simulated TBT of the empty shell |
|---|---|---|
| Agents' machine (8 cores; measured 2026-11-25 beside other sessions) | 2565–2706 | 47–80 ms |
| CI runner (`ubuntu-24.04`; reports of PR #506) | 3415–3542 | 27–30 ms |

Both point the same way: the CI runner runs the main thread faster, so the applied TBT and LCP in CI are expected at or below the local values. This is an inference; the acceptance criteria below verify it and say what happens when it does not hold.

## Goals

- The budget of §2.9 gives the same verdict on every run of an unchanged build.
- It measures what a user on a slow mobile connection sees, with a margin that shows how far the page is from the limit.

## Non-goals

- Changing the values of the budget (LCP < 2.5 s, TBT < 200 ms, CLS < 0.1, scores ≥ 90).
- Changing the first-load check of the build (no Zod in the first load of the shell). It stays the deterministic guard of the JavaScript of the first load.
- Adding the key pages of Stage 1 to the budget (open question 2).
- Inlining CSS (`experimental.inlineCss`): it is experimental, it costs returning visitors their cached stylesheet, and the measurement above shows it does not help.
- Calibrating the CPU slowdown to the runner (`cpuSlowdownMultiplier` from the benchmark index, throttling.md): the default 4× stays. A multiplier derived from the runner would move the budget whenever GitHub changes the runner hardware.

## Proposed change

The Lighthouse runs of the budget use **applied throttling** (`throttlingMethod: 'devtools'`) with the mobile profile of Lighthouse, instead of simulated throttling. Everything else stays:

- the key pages;
- the values of the budget;
- the median over three runs;
- the order: one page at a time, after the other E2E tests, with one worker (#146).

Options considered:

1. **Recommended: applied throttling.** LCP spread 53 ms on an idle machine and 45 ms with six busy CPU loops, against 1.1–1.4 s for the simulation. The LCP equals the FCP, as in a real throttled load. TBT is higher than simulated on an idle machine but not under load (worst 168 ms against 206 ms simulated), so the budget keeps its risk on TBT, not more. The Lighthouse documentation rates simulation as more mitigated against client variability; on this page the measurement shows the opposite for LCP, because the variability comes from the model's edge case, not from the machine. It also names Lantern "~6–13 % more inaccurate than DevTools throttling" ([lantern.md](https://github.com/GoogleChrome/lighthouse/blob/main/docs/lantern.md)).
2. **Rejected: five runs instead of three** (the median of five "is twice as stable as 1 run", variability.md). The failure rate would fall from ~4.9 % to ~2.0 % by the model, but the margin stays 70–150 ms, and each key page would take about a minute more.
3. **Rejected: less client JavaScript in the first load.** It would add margin to the simulated value, but #163 showed that trimming small chunks barely moves it: the largest framework chunk (React DOM with the Next.js runtime, ~72 KB) sets the step.
4. **Rejected: packet-level throttling** (`throttlingMethod: 'provided'` with an external throttle, the most accurate option of throttling.md). The whole stack of the test talks over the loopback interface, so shaping it would also slow the server-side calls of the web application to the API and Keycloak: the measurement would no longer model only the user's connection. It also needs a system-level tool (`tc`, run with `sudo` on the runner) outside the Playwright test.

## Changes to the system specification

| Section | Change |
|---|---|
| §2.9 Performance | "Lighthouse (mobile profile)" → "Lighthouse (mobile profile, applied throttling)". The sentence on the simulated LCP becomes: the first-load check guards the JavaScript of the first load deterministically, because a larger first load need not delay the LCP of the key pages. |

New or changed glossary terms: none.

## Open questions

1. Keep the median over three runs with applied throttling? — **Answer (maintainer, 2026-11-25):** yes. The LCP of applied throttling varies little, and the median still covers a single slow run of TBT.
2. The key pages of Stage 1 named in §2.9 (portal project home, ticket creation form, ticket view for the end user and the team, team list view, Kanban board) are not in the budget yet (`apps/web/e2e/lighthouse.spec.ts` has the two pages of Stage 0). Add them here, or in a task of their own? — **Answer (maintainer, 2026-11-25):** in a follow-up issue after this change, so that each new page is measured with the stable method and its own verdict.

## Acceptance criteria

- [ ] `apps/web/e2e/lighthouse.spec.ts` runs Lighthouse with applied throttling and the mobile profile (default 4× CPU slowdown); the budget values are unchanged. The comment on `RUNS`, which explains the median by the steps of the simulated LCP (#163), describes the new reason.
- [ ] 10 consecutive re-runs of the job "E2E and Lighthouse" on one commit pass. The PR lists, per run, the LCP, TBT and score medians of each key page, the margin to the budget and the benchmark index of the runner.
- [ ] Every one of these medians keeps at least a quarter of the budget as margin (LCP ≤ 1875 ms, TBT ≤ 150 ms; the quarter was confirmed by the maintainer on 2026-11-25). If a run fails or a median comes closer, the implementation stops and the PR returns the method to the maintainer with the measurements; it does not change the budget, the number of runs or the CPU slowdown on its own.
- [ ] The PR reports the duration of the Lighthouse tests before and after the change; they stay within the timeout of each test (`RUNS × 120 s`) and the 30-minute timeout of the job.
- [ ] §2.9 and `.ai/memory/e2e.md` describe the method and the measurements; the first-load check stays.
- [ ] Works on phone, tablet and desktop (Rule 9) – n/a: test configuration only.
- [ ] User documentation and product tour updated where relevant (Rules 3, 4) – n/a.

## Changelog

- 2026-11-25 – Created.
- 2026-11-25 – Review: benchmark indexes of both machines, the stop rule and the duration criterion added; the rejection of packet-level throttling corrected; Stage 1 key pages listed as in §2.9.
- 2026-11-25 – Approved: the maintainer answered both open questions as proposed and confirmed the stop margin of a quarter of the budget.
- 2026-11-25 – Implemented (#503): `throttlingMethod: 'devtools'` in `apps/web/e2e/lighthouse.spec.ts`, §2.9 and `.ai/memory/e2e.md` updated; the CI measurements are listed in the implementation pull request.
