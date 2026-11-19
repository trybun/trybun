# A deterministic check of the first load of the application shell

| | |
|---|---|
| Status | `draft` |
| Created | 2026-11-19 |
| Plan task | – (follow-up of #373, review nit 3) |
| System specification sections | §2.9, §2.14, §18.5 |
| Related issues / PRs | #374, #372, #373, #163 |

## 📝 TLDR

Today, the only thing that stops client code from reaching the first load of the empty application shell is the Lighthouse budget (§2.9). It measures a simulated LCP that moves in steps of ~200–650 ms between runs of one build. So a regression like #372, the full Zod API (~28 KB gzip) in the initial chunks of `(team)/layout`, can pass on one run and fail on the next. Proposed: after `next build`, the web application's `build` script also runs a check that reads, from the build output, the JavaScript every first load of the shell's layouts (`(team)`, `(portal)`, `help`) carries. The check fails the build when that JavaScript contains Zod. The same build always gives the same result, and the result is the same in CI and locally.

## 📝 Problem Statement

- The Lighthouse test (`apps/web/e2e/lighthouse.spec.ts`) checks the median of three simulated LCPs of the empty shell against 2.5 s. Over 31 CI runs, one build landed on ~2000, ~2450 or 2540–2660 ms (`.ai/memory/e2e.md`, "The LCP steps in CI", #163). The largest chunk in the Lantern graph sets the LCP, so ~28 KB of extra JavaScript moves it only on some runs.
- #372: #359 gave `features/invitations/queries.ts` value imports of two Zod modules, and `ProductTourProvider` imported `features/users/queries.ts`, which imports the invitations queries. The full Zod API joined the initial chunks of `(team)/layout`: 241.8 → 269.9 KB of client JavaScript, with a median LCP of 2510–2576 ms on `main`. The pull request that caused it had passed CI. #373 fixed it, and the review of #373 asked for a deterministic guard (nit 3).
- The diagnosis of #372 and #373 already used the deterministic technique: list the `entryJSFiles` of the layout in `.next/server/app/(team)/page_client-reference-manifest.js` after `next build`, and search them for `ZodObject`.

## 📝 Proposed Solution

A script, `apps/web/scripts/check-first-load.ts`, runs right after `next build` in the `build` script of `@trybun/web` (`next build && node scripts/check-first-load.ts`). It runs with Node's type stripping, like `generate-help-content.ts`. It does this:

1. It reads the **first load of each guarded layout** from the build output. That is the union of:
   - `rootMainFiles` and `polyfillFiles` of `.next/build-manifest.json`, which every page loads: the framework, the Turbopack runtime and `instrumentation-client.ts`, which imports `zod/v4/core`;
   - the `entryJSFiles` of the layout in every `page_client-reference-manifest.js` under `.next/server/app/`, which contain the chunks of the root layout and of the layout itself.
2. The guarded layouts are the layouts of the shell that render the key pages of §2.9: `app/(team)/layout`, `app/(portal)/layout` and `app/help/layout`.
3. The check **fails** when a chunk of that first load contains `ZodObject`. In Zod 4 that string is the `$constructor` name of `z.object` (and `$ZodObject` of `zod/v4/core`). It is a string literal, so minification keeps it. A failure names the layout and the chunk, and links §18.5, which says how to keep a module out of the first load.
4. The check also **fails** when a guarded layout has no entry in any manifest, when a listed chunk is missing, or when the manifests cannot be read. A Next.js upgrade that changes this internal build format therefore breaks the build loudly and never passes it silently.
5. On success, it prints one line per layout with its number of chunks and their gzip size. The size is information for diagnosis, not a budget.

The CI **Build** job runs `pnpm build`, so it runs the check with no new job or step. So do the E2E job (which builds too), the validation gate of the agent pipeline and every local production build. `pnpm dev` does not run it.

**Alternatives considered:**

- **A separate CI step or Vitest test over the build output.** The issue allows either. A separate command can be forgotten locally, and a Vitest test would have to build first or depend on a build from another job. Running the check as part of `build` makes every production build fail on the regression, wherever it runs. This is the way Next.js itself fails a build on type errors.
- **A gzip size budget per layout** (the "optional" item of #374). It would also catch growth other than Zod, like Base UI's `Menu` or `openapi-fetch` in the earlier regressions of `.ai/memory/e2e.md`. But every intended change to the shell would then have to raise a figure of §2.9. Deferred as Q2 below: the printed sizes make it easy to add once the maintainer wants it.
- **Bundle analysers** (`@next/bundle-analyzer`, `size-limit`). `@next/bundle-analyzer` works on webpack stats, and the build uses Turbopack. `size-limit` measures files given by a pattern, not the chunks of a route. Both would add a dependency to read what the build's own manifests already list.
- **Module-level detection** (searching for module paths instead of a string). The `clientModules` of the manifest list only the `'use client'` boundaries, not every module bundled behind them, so they cannot show Zod.

## 📝 Architecture

Web application only (`apps/web`):

- New `scripts/check-first-load.ts`. A pure `checkFirstLoad({ layouts, rootFiles, manifests, readChunk })` returns the result per layout: its chunks, their gzip size and the chunks that hold a forbidden marker. A thin `main` reads `.next/` and prints the result. A missing layout, chunk or manifest throws. The forbidden marker (`ZodObject`) and the guarded layouts are constants of the script.
- The manifest files are JavaScript (`globalThis.__RSC_MANIFEST["/(team)/page"] = {…}`). They are evaluated with `node:vm` in an empty context of their own, never `require`d into the process. They are the build's own output.
- New `scripts/check-first-load.spec.ts` (Vitest, picked up by `scripts/**/*.spec.ts`). It covers a clean first load, Zod in a layout chunk, Zod in a root main file, a missing layout, a missing chunk, and keys from several manifests merged.
- `package.json` of `@trybun/web`: `build` becomes `next build && node scripts/check-first-load.ts`. The Turbo `build` task and its outputs stay as they are.

No change to the API, contracts, the Lighthouse test or its budget.

## 📝 Edge Cases & Failure Scenarios

- **A page legitimately loads Zod** (forms, URL state): pages and nested layouts are not guarded. Only the three shell layouts and the root files are.
- **Zod mini or the core in the first load**: `zod/v4/core` loaded by `instrumentation-client.ts` today contributes only `config`. A `$ZodObject` in the first load also fails the check, because it brings the schema classes that #372 was about.
- **A Next.js upgrade changes the manifest format or the `[project]/` keys of Turbopack**: the check fails with "layout … not found in any client reference manifest" and the format is updated in the same upgrade PR.
- **A layout is renamed or moved**: the same failure; the constant is updated with the move.

## 📝 Risks & Impact Review

Low and reversible. The cost of the check is milliseconds after a build. The risk is a false failure after a Next.js upgrade, which the check reports as a missing layout rather than a pass. Because the check reads an internal build format, the upgrade owns updating it.

## Changes to the system specification

| Section | Change |
|---|---|
| §2.9 (Performance) | Every production build checks the first load of the shell's layouts (`(team)`, `(portal)`, `help`) and fails when it contains Zod, a regression the simulated LCP of the Lighthouse budget catches only on some runs. |
| §2.14 (Automated quality gates) | The build gate includes the first-load check of the shell. |
| §18.5 | The rule "a client module that imports a feature's `queries.ts` brings … Zod with them" names the check (`scripts/check-first-load.ts`), which enforces it for the shell. |

## Non-goals

- Changing the Lighthouse budget or its test.
- Guarding pages or nested layouts, or libraries other than Zod.
- A gzip size budget (Q2).

## Resolved assumptions (autonomous defaults)

| # | Question | Applied default | Why |
|---|---|---|---|
| Q1 | Script in CI's Build job, or a Vitest test over the build output? | A script run by the web application's `build` script, so the Build job and every local production build run it. | Deterministic everywhere, no new CI step or job, nothing to forget locally. Reversible: moving it to its own step is a one-line change. |
| Q2 | Also a gzip size budget per layout? | No; the check prints the sizes, and a budget is deferred. | The smallest scope that meets the "Done when" of #374. A budget would make every intended change to the shell a change of §2.9. |
| Q3 | Which files make up the first load? | `rootMainFiles` and `polyfillFiles` of `build-manifest.json`, plus the layout's `entryJSFiles`. | `instrumentation-client.ts` imports Zod's core and is in the root files, not in `entryJSFiles`. Leaving them out would miss a Zod import there. |
| Q4 | Which marker identifies Zod? | `ZodObject`. | It is the marker the diagnosis of #372 used. It is a string literal of Zod 4 that minification keeps, and it is absent from today's shell. |

## Acceptance criteria

- [ ] `pnpm build` (and so the CI **Build** job) fails when Zod reaches the first load of `(team)/layout`, `(portal)/layout` or `help/layout`, and names the layout and the chunk.
- [ ] It fails when a guarded layout cannot be found in the build output, so it never passes silently.
- [ ] Built from `c983cc9^` (the commit before #373), the check fails for all three layouts; built from `main`, it passes. Measured while writing this spec: 127.6 KB gzip with Zod before #373, 99.8 KB on `main`.
- [ ] §2.9, §2.14 and §18.5 name the check; the README and `AGENTS.md` describe `pnpm build` with it.

## 📋 Implementation Plan

**Phase 1 – the check (one PR)**

1. Add `apps/web/scripts/check-first-load.ts` with the pure `checkFirstLoad` and its unit tests (`check-first-load.spec.ts`): a clean load, Zod in a layout chunk, Zod in a root file, a missing layout, a missing chunk, manifests merged.
2. Run it from the `build` script of `@trybun/web`. Verify it against a build of `main` (it passes) and of `c983cc9^` (it fails for all three layouts).
3. Update §2.9, §2.14 and §18.5, the README and `AGENTS.md` (the `pnpm build` row) and `.ai/memory/e2e.md`, then run the validation gate. Setting this spec to `implemented` and moving it to `implemented/` follow once this spec PR and the implementation PR have both merged.

## Changelog

- 2026-11-19 – Created (autonomous defaults, #374).
