# Lighthouse budget with a CPU slowdown calibrated to the runner

| | |
|---|---|
| Status | `draft` |
| Created | 2026-11-25 |
| Plan task | – |
| System specification sections | §2.9 (Performance) |
| Related issues / PRs | #508; amends `.ai/specs/implemented/2026-11-25-lighthouse-applied-throttling.md` (#503, PR #506, PR #507); follow-up #509 |

## Context

Since #503 the Lighthouse budget of §2.9 uses applied throttling (`throttlingMethod: 'devtools'`) with the default CPU slowdown of 4×. LCP is now stable. TBT is not: a fixed multiplier slows each runner by the same factor, so a slower runner emulates a slower device.

**Data from CI.** Ten attempts of the job "E2E and Lighthouse" on one commit of PR #507 (run 45582787139; [measurements](https://github.com/trybun/trybun/pull/507#issuecomment-7163042297)). TBT of the empty shell falls into bands by the runner's benchmark index (`environment.benchmarkIndex`):

| Runner benchmark index | Attempts | Shell TBT median | Shell LCP median |
|---|---|---|---|
| ~3400–3600 | 7–10 | 47–49 ms | 1606–1637 ms |
| ~3050 | 4 | 68 ms | 1630 ms |
| ~2450–2600 | 3, 5, 6 | 119, **166**, **157** ms | 1637–1648 ms |

Attempts 5 and 6 broke the stop rule of the approved specification (TBT ≤ 150 ms, a quarter of the budget kept), although every attempt passed the budget of 200 ms. GitHub assigns at least two CPU classes to the same `ubuntu-24.04` label. More runs cannot remove the bias, because all runs of a job share one machine.

**Why the earlier non-goal was wrong.** The approved specification rejected calibration because "a multiplier derived from the runner would move the budget whenever GitHub changes the runner hardware". The data shows the opposite: the fixed 4× is what moves with the hardware. A calibrated multiplier keeps the emulated device constant.

**Established practice** (research on PR #507, [summary](https://github.com/trybun/trybun/pull/507#issuecomment-7163698377)):

- Lighthouse, [throttling.md](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md): CPU throttling "is expressed relative to the performance of the host device… it's important to calibrate your device before attempting to compare different reports".
- Chrome DevTools calibrates per machine since Chrome 134 ([blog](https://developer.chrome.com/blog/devtools-grounded-real-world); `CalibrationController.ts` in devtools-frontend):
  - it measures Lighthouse's benchmark index under `Emulation.setCPUThrottlingRate`;
  - it corrects the rate until the throttled index is within 10 of a target: **1000, "mid-tier mobile, like a Pixel 5"**, or 264 for low-tier;
  - a host slower than the target is reported as too weak.
- PageSpeed Insights set its multiplier from its fleet's benchmark (GoogleChrome/lighthouse#16226, #16256).
- Criticism: the Lighthouse team (GoogleChrome/lighthouse#9085, 2019–2020) wrote that no benchmark captures the real cross-device multiplier of JavaScript, and that a single reading is noisy (#6907). The benchmark was redesigned since then, and the team itself now calibrates in PSI and DevTools.

**Test on the agents' machine** (2026-11-25, Playwright's Chromium, Lighthouse 13.5's `computeBenchmarkIndex`, `Emulation.setCPUThrottlingRate`, target 1000, tolerance 5 %; machine busy, load ~4–8):

| Trial | Unthrottled index (two readings) | Steps (rate → throttled index) |
|---|---|---|
| 1 | 2584 / 2781 | 2.78× → 904, 2.51× → 1086, 2.73× → 947, 2.59× → 1028 |
| 2 | 2819 / 2859 | 2.86× → 907, 2.59× → 1037 |
| 3 | 2704 / 2731 | 2.73× → 873, 2.38× → 1141, 2.72× → 944, 2.57× → 1043 |
| 4 | 2811 / 2813 | 2.81× → 937, 2.64× → 1020 |
| 5 | 2754 / 2871 | 2.87× → 923, 2.65× → 1023 |

Three findings:
- The throttled index reads ~8–13 % below "unthrottled / rate". The division alone misses the target, so the loop has to measure under throttling.
- The loop converges in 2–4 steps, and the final rate is 2.57–2.65× over five trials.
- Single readings vary by up to ~8 %.

## Goals

- Every run of the budget emulates the same device, whatever CPU class the runner has.
- Every median keeps the margin of the stop rule (LCP ≤ 1875 ms, TBT ≤ 150 ms) on every runner class.
- Every report shows the device it emulated.

## Non-goals

- Changing the budget values (LCP < 2.5 s, TBT < 200 ms, CLS < 0.1, scores ≥ 90), the median over three runs, the order of the runs or the first-load check of the build.
- The key pages of Stage 1 (#509).
- Dedicated or larger runners. Self-hosted runners are advised against for public repositories (GitHub's secure-use documentation); larger runners need a paid plan and promise no CPU model (#510).

## Proposed change

Before its Lighthouse runs, each key-page test calibrates the CPU slowdown in its own Chromium, then passes it to Lighthouse as `throttling.cpuSlowdownMultiplier`. Everything else stays as today: applied throttling, the mobile profile and its network values, the three runs and the median.

**Calibration** (the method of Chrome DevTools):

1. On a blank page, read Lighthouse's `computeBenchmarkIndex` unthrottled until two consecutive readings agree within 10 %. A cold first launch reads low.
2. Start from rate = unthrottled index / **1000**.
3. Set the rate with `Emulation.setCPUThrottlingRate` and read the index under it.
4. Correct the rate by throttled index / 1000.
5. Repeat until the throttled index is within **5 %** of 1000, at most 6 steps.
6. Remove the throttling before Lighthouse starts. Lighthouse applies the multiplier itself.

**Failure.** The test fails with a message naming the readings when:
- the unthrottled index is below the target (the rate would be below 1×), or
- the loop does not converge.

It never falls back to 4×.

**Report.** The test attaches to the Playwright report:
- the unthrottled readings, every step, and the multiplier used;
- the `environment.benchmarkIndex` Lighthouse measured in each run.

**Expected effect** (inference from the test above, verified by the acceptance criteria):
- The multiplier is ~2.6× on the agents' machine. On the CI runners it is ~2.3× on the slow class (~2500) and ~3.2× on the fast class (~3500).
- Today's 4× emulates a device of ~560–590 on the slow class and ~780–810 on the fast class (unthrottled index / 4, less the ~10 % measured above). The target 1000 is therefore a somewhat faster device than today on both, and TBT and LCP fall on both.
- The budget values describe the device of the target from now on, a mid-tier phone as DevTools defines it.

**Options considered:**

1. **Chosen (maintainer, 2026-11-25): calibration to the benchmark index 1000.** It is the only target with a published check against a real phone (the DevTools blog: a calibrated 3.7× gave 211 ms against 189 ms on a mid-tier device).
2. **Rejected: calibration to ~800**, roughly what 4× emulates on the fast runners where the earlier specification was measured. It keeps today's strictness on fast runners, but no source checks it against a device.
3. **Rejected: 1× or the desktop profile** (as Shopware does). The dependence on the host stays, and the budget would stop describing the mobile user of §2.9.
4. **Rejected: five runs or other aggregation.** All runs of a job share one machine, so the bias stays.
5. **Rejected: warn only, or a higher TBT budget.** Both weaken the gate.
6. **Rejected: retry or skip outside a benchmark band.** GitHub does not let a job pick its machine, so this costs re-runs or leaves a gap.

## Changes to the system specification

| Section | Change |
|---|---|
| §2.9 Performance | "Lighthouse (mobile profile, applied throttling)" → "Lighthouse (mobile profile, applied throttling with the CPU slowdown calibrated to a mid-tier phone: benchmark index 1000, as in Chrome DevTools)". |

New or changed glossary terms: none.

## Open questions

1. Should a run whose own `environment.benchmarkIndex` differs from the calibration's unthrottled reading by more than 20 % fail the test? That is a sign the runner became busier between the calibration and the run. — **Proposed answer:** no; record it in the report only. The median over three runs already covers a single run on a busier machine. A gate would fail a test on runner noise rather than on the page. If a median ever breaks the stop rule because of it, the report shows the drift and the decision returns to the maintainer.
2. Where to recheck the target when Playwright's Chromium is upgraded (the benchmark's definition can change with Chromium)? — **Proposed answer:** a memory entry in `.ai/memory/e2e.md`, and a comment at the target constant. On every Chromium upgrade, the Playwright upgrade PR compares the calibrated multipliers in its report with the previous ones.

## Acceptance criteria

- [ ] `apps/web/e2e/lighthouse.spec.ts` calibrates the CPU slowdown to the benchmark index 1000 as described, passes it as `throttling.cpuSlowdownMultiplier`, fails on a host below the target or without convergence, and attaches the calibration and each run's benchmark index to the report. The budget values, `RUNS` and the method are unchanged.
- [ ] 10 attempts of the job "E2E and Lighthouse" on one commit pass, and at least one ran on each runner class (benchmark index below and above 3000). The PR lists, per attempt and key page:
  - the runner's benchmark index and the calibrated multiplier;
  - the LCP, TBT and score medians.

  If the 10 attempts do not cover both classes, more attempts are run until they do.
- [ ] Every median keeps the stop margin: LCP ≤ 1875 ms and TBT ≤ 150 ms. If one comes closer, the implementation stops and the measurements return to the maintainer.
- [ ] The TBT medians of the two runner classes differ by less than the earlier bands did: today 47–68 ms against 119–166 ms. The PR reports both ranges.
- [ ] The PR reports the duration of the Lighthouse tests before and after (the calibration's cost). They stay within the test timeout (`RUNS × 120 s`) and the job's 30 minutes.
- [ ] §2.9, `.ai/memory/e2e.md` and the non-goal of `.ai/specs/implemented/2026-11-25-lighthouse-applied-throttling.md` (with a changelog line pointing here) are updated.
- [ ] Works on phone, tablet and desktop (Rule 9) – n/a: test configuration only.
- [ ] User documentation and product tour updated where relevant (Rules 3, 4) – n/a.

## Changelog

- 2026-11-25 – Created. The maintainer chose calibration and the target 1000 on 2026-11-25, after the stop rule broke on PR #507.
