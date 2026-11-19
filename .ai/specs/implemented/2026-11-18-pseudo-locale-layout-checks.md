# Width-sensitive E2E checks in a pseudo-locale with stretched text

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-11-18 |
| Plan task | – (follow-up of #295 and #299) |
| System specification sections | §2.9, §13.1, §15.3 |
| Related issues / PRs | #301, #377, #378, #295, #299 |

## 📝 TLDR

The width-sensitive E2E checks (§2.9) run in every language of `@trybun/i18n` (#299), so they catch only the overflow that today's English and Polish texts cause. A layout that fits them can still break when a language with longer labels lands (German, Finnish). Proposed: a **pseudo-locale `en-XA`**, generated from the English catalogue for tests only. Every message is stretched by the W3C expansion rates (short texts the most) and put between visible markers. The width-sensitive checks also run in it, as a blocking CI check. It is never offered to people and never reaches the production web container or the Keycloak theme.

## 📝 Problem Statement

- `ALL_LOCALES` of `apps/web/e2e/locales.ts` is `LOCALES` of `@trybun/i18n/catalogues`. `ticket-list.spec.ts` loops over it, so `expectListFits` and the type checks of the ticket list run in `en` and `pl` (#295, #299). They can only find overflow caused by translations that already exist.
- W3C Internationalization, [*Text size in translation*](https://www.w3.org/International/articles/article-text-size): translations of English source texts into European languages grow to 200–300 % for texts of up to 10 characters, 180–200 % for 11–20, 160–180 % for 21–30, 140–160 % for 31–50, 151–170 % for 51–70 and about 130 % beyond 70. Short labels, which are the column headers, chips and buttons of the ticket list, are the ones most likely to break a layout.
- Today such a break is found only after the translation is merged, usually on a narrow tablet (`.ai/memory/e2e.md`, "The tablet project misses the narrowest tablet and the other languages").

## 📝 Proposed Solution

This is pseudo-localization, the established way to test text expansion before translations exist:

- Android: `en-XA` (accented text, expanded, every message in brackets), enabled only in developer builds (`pseudoLocalesEnabled`), [Android docs](https://developer.android.com/guide/topics/resources/pseudolocales).
- Firefox/Fluent: the `accented` strategy with bracket markers, switched on by a runtime preference (`intl.l10n.pseudo`).
- FormatJS: `formatjs compile --pseudo-locale en-XA`.

Trybun follows them:

1. **Generation.** `pseudoLocalize(messages)` is a pure, deterministic function in a new entry point, `@trybun/i18n/pseudo/messages`. The tag, its type and the helpers of the web application live in the lightweight `@trybun/i18n/pseudo`, so client components never bundle the generator. It parses every message with `@formatjs/icu-messageformat-parser`, which the package already uses to check the catalogues. It changes **only literal text**, including the literal text inside `plural`/`select` options and rich-text tags, and prints the message again with the parser's `printer`. Argument names, `#`, tag names, the `plural`/`select` keywords, offsets and option keys stay as they are.
   - The letters that have an accented form within Latin-1 are accented (`a → á`, `e → é`, `n → ñ`, `d → ð`, …), so text that does not come from the catalogues stands out in screenshots. Latin-1 only, because that range is in the `latin` subset the web font preloads (`app/layout.tsx`); the other subsets, Latin Extended included, load on first use. The stretched text is therefore measured without waiting for a subset loaded later.
   - The factor of a message comes from `L`, the length of its literal text, with arguments counted as zero; for `plural`/`select`, the longest option counts. Every literal of the message that holds a letter grows to `ceil(length × factor)` characters, in every `plural`/`select` option and tag. Literals without a letter, such as the spaces and punctuation between arguments, stay as they are. The factor is the **lower bound of the W3C band**: ≤ 10 characters × 2.0; 11–20 × 1.8; 21–30 × 1.6; 31–50 × 1.4; 51–70 × 1.5; > 70 × 1.3. For example, `Bug` (3) becomes 6 letters and `Pending sharing approvals` (25) becomes 40 characters.
   - The extra characters of a literal are spread over its words in proportion to their length, by repeating their vowels (or the last letter, when a word has none). The number of words, and so the number of places where a line can break, stays as in English. Each word gets longer, the way German and Finnish compounds do.
   - The message starts with `[` and ends with `]`, so a cut-off text shows a missing marker. The markers come on top of the target length, so even the shortest label grows by the full factor.
2. **Not a language of the product.** `PSEUDO_LOCALE = 'en-XA'` is exported next to the function. `en-XA` is a valid BCP 47 tag with a region from the private-use range of ISO 3166 (`XA`–`XZ`), the tag Android and Chromium use. It is **not** in `CATALOGUES` or `LOCALES`, so it never appears in the language switch, the account settings, `TRYBUN_DEFAULT_LANGUAGE`, the API, e-mails or the Keycloak theme. `generate-keycloak-theme.js` reads `messages/*.json`, and the pseudo-locale is generated in memory, never written there.
3. **Web application, behind a test-only switch.** The web server accepts `en-XA` as the language of a request only when it is enabled:
   - `TRYBUN_PSEUDO_LOCALE=true` (validated boolean, default `false`). Playwright sets it for the `next start` it launches in CI. It is listed in `.env.example` as a commented-out, test-only variable, like the raised rate limits of the E2E tests.
   - `next dev` enables it too, so a local `pnpm e2e` that reuses `pnpm dev` runs the same checks, like Android's developer builds.
   - The web server refuses to start with `TRYBUN_PSEUDO_LOCALE=true` unless the host of `NEXTAUTH_URL` is a loopback address (`localhost`, `127.0.0.1`, `::1`). The E2E and QA environments run there, and a real installation never does, so a variable set by mistake (a Compose override, `docker run -e`) stops the start-up with a clear message instead of serving the pseudo-locale.
   - `compose.yaml` passes an explicit list of variables to the `web` container and never lists this one. A unit test reads `compose.yaml` and fails if the variable appears there.

   When enabled, `resolveLocale` takes `en-XA` from the `NEXT_LOCALE` cookie, or from `Accept-Language`. The ranges are taken by quality as today, and a range that is exactly `en-XA` (case-insensitive) selects the pseudo-locale **before** its primary subtag would select `en`. A higher-quality range of another language still wins, so `pl,en-XA;q=0.5` gives `pl`. `getWebMessages('en-XA')` returns the pseudo catalogue without the server namespaces. `catalogueOf` of `@trybun/i18n/pseudo/messages` generates it once per process and is the one source of it for the web server, its unit tests and the E2E names. All of this code is server-only. The browser receives only the stretched texts of its route (§18.5).
4. **Only the texts change, never the language.** `request.ts` (`getRequestConfig`) returns the pseudo messages, while `locale` stays `productLocale(requestLocale)`, which is English for `en-XA`. next-intl keeps `locale` and `messages` independent: its configuration may share or merge messages across locales. So `AppConfig.Locale` stays `Locale`, and every `useLocale()`/`getLocale()` consumer receives a language of the product. That covers help pages, the language of an invitation acceptance, Keycloak's `ui_locales`, ticket templates, and the language switch and the settings. No consumer can pass `en-XA` outside the catalogues. This holds by construction, which matters because the type checker alone could not prove it: some consumers take the language as a `string` (`ui_locales`, `KeycloakSignInOptions.locale`), and one checks it only at runtime (`languageSchema.parse` of the invitation acceptance). The cost is accepted: `<html lang>` and `Intl` formatting say `en`, which describes the stretched English text correctly. The language switch shows English as checked.
5. **E2E.** `apps/web/e2e/locales.ts` gains `TEST_LOCALES = [...ALL_LOCALES, PSEUDO_LOCALE]` next to `ALL_LOCALES`. `messagesOf(locale)` returns the pseudo messages for `en-XA`, so tests find elements by their stretched names. Width-sensitive checks loop over `TEST_LOCALES`. Today those are the loops of `ticket-list.spec.ts`: every view, on phone, at 768 px and 1024 px in the tablet project, and on desktop. `ONE_LINE_TYPE_LOCALES` stays `en` and `pl`: a stretched type label is checked for overflow, not failed for wrapping. That is the rule #299 already set for languages that have not been checked yet.

**Alternatives considered:**

- **A separate Playwright project for the pseudo-locale.** It would run every spec again, not only the width-sensitive ones, and cost about a third more E2E time. `TEST_LOCALES` reuses the loops that already exist. Rejected.
- **A separate pseudo build of the web application.** The E2E tests and the Lighthouse budget run against the production build (CI comment of the `e2e` job). A second build would test an artifact nobody ships. Rejected in favour of the runtime switch that Firefox and Chromium (`--lang=en-XA`) also use.
- **`en-XA` as the request language (`AppConfig.Locale = Locale | 'en-XA'`), mapped back to English by each consumer.** It needs a mapping in every consumer that hands the language on (help, invitations, Keycloak, templates, settings). The type checker finds only some of them, so a missed or future `string` consumer could leak `en-XA` to the API or Keycloak. Rejected for the texts-only variant above.
- **`formatjs compile --pseudo-locale en-XA`.** It requires `--ast` output (next-intl reads message strings), a native binding and a new dependency. Its expansion (doubled vowels, about +30 %) is below the W3C rates for short texts. Rejected.
- **Committing `en-XA.json` to `messages/`.** It would become a language of the product: the catalogue tests require one catalogue per file, and the Keycloak theme reads every file there. Rejected.

## 📝 Architecture

- `packages/i18n`: `src/pseudo/index.ts` (`./pseudo` export) with `PSEUDO_LOCALE`, `PseudoLocale`, `RequestLocale`, `productLocale` and `negotiateRequestLocale`, and `src/pseudo/messages.ts` (`./pseudo/messages`) with `stretchFactor(length)`, `PSEUDO_MARKERS`, `pseudoLocalizeMessage`, `pseudoLocalize(messages)` and the memoized `catalogueOf(locale)`. The parsing of `Accept-Language` stays in one place: `languageRanges` and `localeOfRange` of the catalogues. `@formatjs/icu-messageformat-parser` moves from `devDependencies` to `dependencies`: it is used at runtime now. It is no new package, since `next-intl` already brings it through `intl-messageformat`.
- `apps/web/src/lib/env/env.ts`: `TRYBUN_PSEUDO_LOCALE` → `isPseudoLocaleEnabled` (`true` also under `next dev`), refused unless the host of `NEXTAUTH_URL` is a loopback address.
- `apps/web/src/lib/i18n/`:
  - `locale.ts` (`resolveLocale` with the switch, returning a `RequestLocale`);
  - `messages.ts` (`getWebMessages` over `catalogueOf`);
  - `request.ts` (pseudo messages, `locale` of the product). `AppConfig.Locale` and every consumer of the language stay unchanged.
- `apps/web/src/features/tickets/components/ticket-filter-bar.tsx`: the probe of step 4 found that a long filter chip pushed its × 8 px past a 360 px screen. The chip's trigger inherited `shrink-0` from `Button`, so its `min-w-0`/`truncate` never applied; it now shrinks.
- `apps/web/src/lib/env/env.spec.ts`: the guard test reads `compose.yaml` and `docker/web/Dockerfile`.
- `apps/web/playwright.config.ts`: `TRYBUN_PSEUDO_LOCALE: 'true'` in the `env` of the `next start` web server. `.ai/scripts/test-env-up.sh` sets it too, because the test environment of the QA skills runs `next start` as CI does.
- `apps/web/e2e/locales.ts` and `ticket-list.spec.ts`: `TEST_LOCALES`, `messagesOf` for the pseudo-locale.
- Untouched: the API and the Worker, the e-mails, the Keycloak theme, the OpenAPI document, `LOCALES` and the help content.

## 📝 UI/UX

The pseudo-locale adds nothing people see: no new text, no language added to the switch or the settings, and no help or tour change. The one visible change is the fix its first run found: on a narrow phone a long filter chip now truncates its name, and its × stays on screen, in every language. In the E2E run the pages show accented, stretched text between brackets, e.g. `[Búúúúg]` for `Bug`. Screenshots of a failing pseudo-locale test therefore show the stretched text and any text that is not translated (no accents).

## 📝 Edge Cases & Failure Scenarios

- **The switch is off and a browser asks for `en-XA`**: negotiation falls back to `en`, as today. A `NEXT_LOCALE=en-XA` cookie is ignored, as any unknown value is today.
- **The switch is on and a request asks for `en-XA`**: the API still answers in English, because it does not know the pseudo-locale. Its messages (errors, server-rendered texts) appear unstretched and without accents. This is a known limit, accepted as out of scope, and it does not affect the ticket list checks.
- **A message the parser cannot print again identically**: before 3.5.23 the printer of `@formatjs/icu-messageformat-parser` lost an argument after a literal that ends with an apostrophe (`{a}''{b}` printed as `{a}'''{b}`; fixed upstream in formatjs/formatjs#7891). A later printer bug can do the same, so `pseudoLocalizeMessage` compares the structure of the printed message with the source and throws instead of breaking it silently. The catalogue-wide unit test therefore fails `pnpm test` in the PR that adds such a message. A server that still met one would fail its first `en-XA` request with that error.
- **A pseudo-locale check fails**: the CI job fails like any other E2E failure, with a trace and a screenshot. The fix goes into the layout, not the test. When the fix needs a design decision, the implementation PR stops and asks the maintainer; it never skips the check.
- **E2E time**: the ticket list loops run for three locales instead of two, about 50 % more time for that file. The other specs are unchanged.

## 📝 Risks & Impact Review

The change is reversible and test-oriented. Apart from the filter-chip fix, people see no change, and the API, schema and permissions are untouched. The new runtime surface is the test-only `TRYBUN_PSEUDO_LOCALE` switch of the web server. The code ships in the image, so the guard is twofold: the web server refuses the switch outside a loopback `NEXTAUTH_URL`, and `compose.yaml` never passes it (unit test). Even when it is on, the pseudo-locale only changes the texts; it grants no access, and the language every consumer sees stays a language of the product. The one dependency change is moving an existing dependency from `devDependencies` to `dependencies`.

## Changes to the system specification

| Section | Change |
|---|---|
| §2.9 | Width-sensitive E2E checks also run in the pseudo-locale `en-XA`: English stretched by the W3C expansion rates (short texts the most) and put between `[` `]`. A failure there **blocks CI** like any other E2E failure. |
| §13.1 | A pseudo-locale `en-XA`, generated from the English catalogue, exists for tests only. It is not a language of the product: it is not offered in the language switch or the settings, not stored in accounts, not used by the API, e-mails or Keycloak. The web server accepts it only with `TRYBUN_PSEUDO_LOCALE=true` or under `next dev`. |
| §15.3 | `TRYBUN_PSEUDO_LOCALE` – test-only switch of the web application, default `false`, refused unless `NEXTAUTH_URL` is a loopback address. `compose.yaml` and the `web` image never set it (unit test). |

New glossary terms: none. `en-XA` is a test fixture, not a domain term.

## Non-goals

- A bidirectional or right-to-left pseudo-locale (`en-XB` / `ar-XB`). It is deferred until a right-to-left language is planned.
- Pseudo-localizing the API messages, the e-mails, the Keycloak login theme or the help pages (`docs/user/`).
- Pseudo-locale runs of the Storybook story tests of `@trybun/ui`, of the axe-only and functional E2E specs, or of the Lighthouse budget.
- Width-sensitive checks for other pages than the ticket list. Those that loop over `ALL_LOCALES` later should use `TEST_LOCALES` (recorded in `.ai/memory/e2e.md`), but this change adds none.
- Offering the pseudo-locale to people in any build.

## Open questions

None open: each question of the issue is answered below.

## Resolved assumptions (autonomous defaults)

| # | Question | Applied default | Why |
|---|---|---|---|
| Q1 | Does a pseudo-locale failure block CI or only warn? | **Blocks**, like every E2E failure | The project never weakens CI gates (`AGENTS.md`, "Never"). A warning-only check is ignored, and a layout that fails at the W3C lower bounds will fail in a real language. |
| Q2 | A `TEST_LOCALES` list or a separate Playwright project? | **`TEST_LOCALES`** next to `ALL_LOCALES` | It runs only the width-sensitive loops. A project would rerun every spec, at about a third more E2E time, for no extra coverage. |
| Q3 | How much stretching? | The **lower bound of each W3C band** (× 2.0 / 1.8 / 1.6 / 1.4 / 1.5 / 1.3), markers on top | It follows the issue and W3C. The lower bound is what real translations reach routinely; the upper bound would fail layouts that no real language breaks. |
| Q4 | How is it kept out of production? | Not in `LOCALES`/`CATALOGUES`; accepted only with `TRYBUN_PSEUDO_LOCALE=true` or `next dev`; the switch is refused outside a loopback `NEXTAUTH_URL`; `compose.yaml` never passes the variable (unit test) | E2E must test the production build. The runtime switch is the Firefox/Chromium model, and the explicit Compose environment list keeps it out of the shipped container. |
| Q5 | Which locale tag? | `en-XA` | The Android, Chromium and FormatJS convention. It is a valid BCP 47 tag with a private-use region. |
| Q6 | What is out of scope? | See *Non-goals* | This is the smallest change that meets the acceptance criteria of #301. |

## Acceptance criteria

- [ ] `pseudoLocalize(CATALOGUES.en)` keeps every key, and every message is valid ICU with the same arguments, plural/select options and tags as English. Each message has the `[` `]` markers. Every literal with a letter has at least `ceil(length × factor(L))` characters, and every other literal is unchanged (unit tests of `@trybun/i18n`).
- [ ] The output is deterministic: the same input gives the same messages (unit test).
- [ ] `en-XA` is not in `LOCALES` or `CATALOGUES` (unit test). It therefore never reaches, by construction, the Keycloak theme (generated from `messages/*.json`, `locales=en,pl` asserted by `generate-keycloak-theme.spec.js`) or the language switch and the account settings, which list `LOCALES` and only ever receive a language of the product (`request.spec.ts`).
- [ ] With the pseudo-locale, the request configuration returns the pseudo messages and the product language `en`, and a language passed explicitly (the ticket templates) gets its real texts (unit tests).
- [ ] `resolveLocale` returns `en-XA` only with the switch on, from the cookie or an exact `Accept-Language` range ranked by quality; with it off, `en-XA` negotiates to `en` (unit tests).
- [ ] The web server refuses `TRYBUN_PSEUDO_LOCALE=true` with a non-loopback `NEXTAUTH_URL` (unit test).
- [ ] `compose.yaml` and `docker/web/Dockerfile` do not set `TRYBUN_PSEUDO_LOCALE` (unit test).
- [ ] The width-sensitive E2E checks of the ticket list run in `en-XA` on phone, at 768 px and 1024 px, on the tablet device and on desktop, and pass in CI.
- [ ] §2.9, §13.1, §15.3, `.env.example` and `.ai/memory/e2e.md` describe the pseudo-locale, how to run it locally (`pnpm dev` + `pnpm e2e`), and that its failure blocks CI.
- [ ] Works on phone, tablet and desktop (Rule 9). This change is the check itself.
- [ ] No user documentation, tour or README change is needed (Rules 3–5): nothing changes for people. The README only gains the variable if it lists environment variables.

## 📋 Implementation Plan

### Phase 1 – the pseudo-locale in `@trybun/i18n`

1. Add `src/pseudo/index.ts` and `src/pseudo/messages.ts` with their exports. Move `@formatjs/icu-messageformat-parser` to `dependencies`. Add unit tests for keys, ICU validity, arguments, markers, length and determinism over the whole English catalogue, plus focused cases for `plural`, `select`, `#`, tags and apostrophes.

### Phase 2 – the web application accepts it behind the switch

2. `env.ts`: `TRYBUN_PSEUDO_LOCALE` → `isPseudoLocaleEnabled` (also `true` under `next dev`). Refuse it outside a loopback `NEXTAUTH_URL`. Add it to `.env.example` as a commented-out, test-only variable. Add the `compose.yaml` guard test. Unit tests.
3. `locale.ts`/`messages.ts`/`request.ts`: the switch-aware `resolveLocale` and the pseudo messages, with `locale` kept a language of the product. Unit tests for resolution with the switch on and off and for the request configuration.

### Phase 3 – E2E in the pseudo-locale

4. `playwright.config.ts`: `TRYBUN_PSEUDO_LOCALE: 'true'` for `next start`. In `e2e/locales.ts`, add `TEST_LOCALES` and the pseudo `messagesOf`. In `ticket-list.spec.ts`, loop over `TEST_LOCALES`. Run the file on all projects (`--repeat-each 3`) and list every failing check in the PR description: this is the probe.
5. Fix what the probe found. A fix that stays inside the overflowing component and its Storybook story, with no change of the specified layout (§8.1), is in scope. A fix that needs a layout or design decision stops the PR with a question to the maintainer. It is never resolved by skipping the check or by excluding the pseudo-locale from it.
6. Documentation: update §2.9, §13.1 and §15.3, `.ai/memory/e2e.md` (the pseudo-locale, `TEST_LOCALES` for new width-sensitive checks, the local run) and the README, if it lists environment variables. This specification merges first, through #377. #378 then rebases, sets it to `implemented`, adds a changelog line and moves it to `implemented/` before it merges.

## Changelog

- 2026-11-18 – Created from #301 by `om-auto-write-spec` (autonomous defaults, readiness waived by the maintainer).
- 2026-11-18 – Aligned with the implementation PR #378: accents within Latin-1, a lightweight `./pseudo` entry next to `./pseudo/messages`, stretching per literal, the language switch unmapped, and the switch in the QA test environment.
- 2026-11-18 – Specification review of #377: only the texts change, never the request language (`AppConfig.Locale` stays `Locale`); the filter-chip fix of the probe, `catalogueOf`, the printer guard, the Dockerfile guard and the merge order of #377 and #378 are described.
- 2026-11-18 – Approved by the maintainer through the merge of #377.
- 2026-11-18 – Implemented (#378): `@trybun/i18n/pseudo` and `./pseudo/messages`, the test-only `TRYBUN_PSEUDO_LOCALE` with its loopback and Compose/image guards, texts-only request configuration, `TEST_LOCALES` in the ticket list E2E, and the filter-chip fix the probe found; §2.9, §13.1 and §15.3 updated.
- 2026-11-18 – Corrected the reason for Latin-1-only accents (manual QA of #378): the web font declares Latin Extended too; `latin` is the subset it preloads.
- 2026-11-19 – `@formatjs/icu-messageformat-parser` 3.5.23 (#379) prints `{a}''{b}` back correctly; the printer guard stays, and its unit test now simulates a lossy printer instead of relying on that bug.
