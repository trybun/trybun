# Execution plan: width-sensitive E2E checks in a pseudo-locale

Source doc: .ai/specs/2026-11-18-pseudo-locale-layout-checks.md (spec PR #377)
Issue: #301

## Goal

The width-sensitive E2E checks of the ticket list also run in a test-only pseudo-locale `en-XA` – English accented, stretched by the lower bounds of the W3C expansion rates and put between `[` `]` – as a blocking CI check, without the pseudo-locale ever being offered to people or reaching the production web container or the Keycloak theme.

## Scope

- `packages/i18n`: `src/pseudo/` (`./pseudo` export), the ICU parser becomes a runtime dependency.
- `apps/web/src/lib/env/env.ts`, `apps/web/src/lib/i18n/*`: the test-only switch, `RequestLocale`, `productLocale`, pseudo messages; consumers of the request language.
- `apps/web/playwright.config.ts`, `apps/web/e2e/locales.ts`, `apps/web/e2e/ticket-list.spec.ts`: `TEST_LOCALES`.
- `.env.example`, `docs/spec/02-agent-rules.md` (§2.9), `docs/spec/13-non-functional.md` (§13.1), `docs/spec/15-deployment.md` (§15.3), `.ai/memory/e2e.md`.

Non-goals (spec): bidi pseudo-locale, pseudo-localized API/e-mail/Keycloak/help texts, Storybook, other E2E specs, Lighthouse. The spec file itself merges through #377 and is moved to `implemented/` after it lands.

## Risks

- The probe may find layouts that overflow in the pseudo-locale; local fixes are in scope, a design decision stops the run with a question.
- `AppConfig.Locale` widens: every consumer of the request language is revisited (type checker).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The pseudo-locale in @trybun/i18n

- [x] 1.1 Add pseudoLocalize with unit tests — afc5527

### Phase 2: The web application accepts it behind the switch

- [x] 2.1 Add the test-only switch with its guards — 251f6a9
- [x] 2.2 Resolve and serve the pseudo-locale, map the consumers — d9e086c

### Phase 3: E2E in the pseudo-locale

- [ ] 3.1 Run the ticket list checks in TEST_LOCALES (probe)
- [ ] 3.2 Fix what the probe found
- [ ] 3.3 Update the specification, memory and .env.example
