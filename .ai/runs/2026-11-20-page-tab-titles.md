# Execution plan – a translated, descriptive tab title for every page

Source doc: .ai/specs/2026-11-20-page-tab-titles.md
Issue: #407 · Specification PR: #408 (merged)

## Goal

Every page of the web application gets the translated tab title of the specification: `{what the page shows} – {record or section} – Trybun`, built by one helper, `pageTitle()`, with `title.absolute` (ADR 0015).

## Scope

- `apps/web`: `pageTitle()` in `features/app-shell`, `metadataAfterRead()` with `title` and `rateLimitedTitle`, a `generateMetadata` on every `page.tsx` except the redirect-only project page, unit tests per page, the `app/page-titles.spec.ts` scan, and E2E `toHaveTitle` per shell.
- `@trybun/i18n`: `app.titlePart`, `tickets.tabTitle`, `notFoundPage.tabTitle` without the suffix, and the missing heading keys (PL first).
- Specification §13.1, §13.4, §14.4 and §18.5; ADR 0015 accepted; `.ai/memory/toolchain.md`; the change specification moved to `implemented/`.

## Non-goals

- Other metadata (description, Open Graph), the Keycloak login screen, a title of its own for `error.tsx`, and a live title update on a rename (specification, Non-goals).
- The title-redaction amendment (#409).

## Implementation Plan

### Phase 1: the helper and the static pages

1. `app.titlePart` and `pageTitle()`, with unit tests (one part, several parts, record values with `{`, `$&` and `%s`).
2. `notFoundPage.tabTitle` without the suffix; `notFoundMetadata()` returns `pageTitle()`.
3. `generateMetadata` with `pageTitle()` on the 12 pages that read nothing for their title, with a unit test per page.
4. `app/page-titles.spec.ts` replaces the scan of `app/not-found-metadata.spec.ts`.

### Phase 2: the record pages

1. `metadataAfterRead(read, { title, rateLimitedTitle })`, with unit tests (found, not found, `429`, other error).
2. Ticket pages (team, portal, resolution confirmation) through `tickets.tabTitle`.
3. The project and organization pages, the pages of the Administrator panel and the help topic.

### Phase 3: end-to-end checks, specification and docs

1. E2E `toHaveTitle` per shell: page load, client-side navigation, language switch, and the unmatched address.
2. §13.1, §13.4, §14.4 and §18.5; ADR 0015 accepted; `.ai/memory/toolchain.md`.
3. The change specification set to `implemented`, with a changelog entry, moved to `implemented/`.

## Risks

- A broad edit across 25 pages (`risk-high`): the scan and a unit test per page guard each title.
- Next.js resolves metadata of record pages through the same `cache()` read; one API read per request is kept by passing the title function to `metadataAfterRead()`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: the helper and the static pages

- [ ] 1.1 `app.titlePart` and `pageTitle()`
- [ ] 1.2 `notFoundMetadata()` through `pageTitle()`
- [ ] 1.3 Titles of the pages that read nothing
- [ ] 1.4 The `page-titles` scan

### Phase 2: the record pages

- [ ] 2.1 `metadataAfterRead()` with the title sources
- [ ] 2.2 Ticket pages
- [ ] 2.3 Project, organization, Administrator and help pages

### Phase 3: end-to-end checks, specification and docs

- [ ] 3.1 E2E `toHaveTitle` per shell
- [ ] 3.2 Specification, ADR 0015 and memory
- [ ] 3.3 Change specification implemented
