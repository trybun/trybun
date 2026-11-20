# A translated, descriptive browser tab title for every page

| | |
|---|---|
| Status | `draft` |
| Created | 2026-11-20 |
| Plan task | – (follow-up of #404 / [#406](https://github.com/trybun/trybun/pull/406)) |
| System specification sections | §13.1, §13.4, §14.4, §18.5 |
| Related issues / PRs | [#407](https://github.com/trybun/trybun/issues/407), [#406](https://github.com/trybun/trybun/pull/406), [ADR 0014](../../docs/adr/0014-not-found-title-through-metadata.md), [ADR 0015](../../docs/adr/0015-page-titles-through-absolute-metadata.md) (proposed here) |

## 📝 TLDR

Every page of the web application has the same tab title, "Trybun", except the not-found page ("Page not found – Trybun", #404). That fails WCAG 2.2 SC 2.4.2 *Page Titled* (Level A). With this change, every page **will** show its own translated title (`error.tsx` keeps a page's title only when its render fails, see Non-goals). The page-specific part comes first and "Trybun" comes last, e.g. "CP-3 Sign-in page crashes on Safari – Trybun" or "Project settings – Website – Trybun". One helper of `features/app-shell` builds every title, and the API is read no more often than today.

## 📝 Problem Statement

- A person with several Trybun tabs cannot tell them apart. Browser history and bookmarks list identical "Trybun" entries.
- A screen reader announces the title when a page opens. Today it says only "Trybun".
- WCAG 2.2 SC 2.4.2 (Level A): "Web pages have titles that describe topic or purpose". For single-page applications, "the title of the page should also be changed dynamically to reflect the content or topic of the current view" ([Understanding 2.4.2](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html)). §13.4 requires WCAG 2.2 AA, which includes every Level A criterion.
- QA of #406 (steps 5 and 8) found it on every shell: the team ticket view, the ticket list, the projects, the project settings, the Administrator panel, help, the portal and the account settings.

Today `app/layout.tsx` returns `title: t('title')` ("Trybun"). 12 of the 25 `page.tsx` files export a `generateMetadata`, but only to reach the not-found title (ADR 0014). All of them return `{}`.

## 📝 Proposed Solution

### The title scheme (maintainer's answers to #407, Q1 and Q2)

**`{what the page shows} – {the record or section it belongs to} – Trybun`**: the most specific part comes first and "Trybun" last. Parts are separated by a spaced en dash, as in the existing "Page not found – Trybun".

- The first part is the page's main heading, i.e. what its `h1` says. Inside the Administrator panel it is the section's `h2`, because the panel's `h1` is "Administration". On a page whose `h1` names its record, the first part is the name of the view, and the record follows:
  - On the project settings page the `h1` is the project name and the view is its subtitle `projects.settings.title` ("Project settings", `features/projects/components/project-settings.tsx`).
  - On the resolution confirmation page the `h1` is the ticket title, and the view is a new `tabTitle` entry ("Resolution confirmation" / „Potwierdzenie rozwiązania”).
- The GOV.UK service manual supports basing the title on the heading: "The `<title>` should be based on the `<h1>`" ("Where do you live? - Register to vote - GOV.UK", [Writing for user interfaces](https://www.gov.uk/service-manual/design/writing-for-user-interfaces)). G88 asks for a title that identifies the subject, makes sense out of context and is short; naming the site is optional ([G88](https://www.w3.org/WAI/WCAG22/Techniques/general/G88)).
- A record page names its record. A ticket shows its identifier and its title. The maintainer decided this in Q2: the identifier alone did not describe the page well enough. Project, organization and help-topic pages show their name.
- A middle part appears only where the heading alone is ambiguous across tabs: the project of a project-scoped page, and "Administration" for the sections of the panel.

| Page (`apps/web/src/app/…`) | Title (EN) | Title (PL) |
|---|---|---|
| `(team)/page.tsx` | Home – Trybun | Strona główna – Trybun |
| `(team)/tickets/page.tsx` | Tickets – Trybun | Zgłoszenia – Trybun |
| `(team)/tickets/new/page.tsx` | New ticket – Trybun | Nowe zgłoszenie – Trybun |
| `(team)/tickets/[identifier]/page.tsx` | CP-3 Sign-in page crashes on Safari – Trybun | CP-3 Sign-in page crashes on Safari – Trybun |
| `(team)/projects/page.tsx` | Projects – Trybun | Projekty – Trybun |
| `(team)/projects/[projectId]/settings/page.tsx` | Project settings – {project} – Trybun | Ustawienia projektu – {project} – Trybun |
| `(team)/settings/page.tsx`, `(portal)/portal/settings/page.tsx` | {Account settings heading} – Trybun | {its PL heading} – Trybun |
| `(team)/admin/page.tsx` | {Getting started heading} – Administration – Trybun | … – Administracja – Trybun |
| `(team)/admin/accounts/page.tsx` | Accounts – Administration – Trybun | Konta – Administracja – Trybun |
| `(team)/admin/organizations/page.tsx` | Organizations – Administration – Trybun | Organizacje – Administracja – Trybun |
| `(team)/admin/organizations/[organizationId]/page.tsx` | {organization} – Administration – Trybun | {organization} – Administracja – Trybun |
| `(team)/admin/about/page.tsx` | {About heading} – Administration – Trybun | … – Administracja – Trybun |
| `(portal)/portal/page.tsx` | Your projects – Trybun | Twoje projekty – Trybun |
| `(portal)/portal/projects/[projectId]/page.tsx` | {project} – Trybun | {project} – Trybun |
| `(portal)/portal/projects/[projectId]/tickets/new/page.tsx` | New ticket – {project} – Trybun | Nowe zgłoszenie – {project} – Trybun |
| `(portal)/portal/tickets/page.tsx` | My tickets – Trybun | Moje zgłoszenia – Trybun |
| `(portal)/portal/tickets/[identifier]/page.tsx` | CP-3 {title} – Trybun | CP-3 {title} – Trybun |
| `(portal)/portal/tickets/[identifier]/resolution-confirmation/page.tsx` | Resolution confirmation – CP-3 {title} – Trybun | Potwierdzenie rozwiązania – CP-3 {title} – Trybun |
| `help/page.tsx` | Help – Trybun | Pomoc – Trybun |
| `help/[...slug]/page.tsx` | {topic title} – Help – Trybun | {topic title} – Pomoc – Trybun |
| `invitations/page.tsx` | Accept the invitation – Trybun | Przyjmij zaproszenie – Trybun |
| `setup/page.tsx` | Setup – Trybun | Konfiguracja – Trybun |
| `sign-in/page.tsx` | {Sign-in heading} – Trybun | … – Trybun |
| every `not-found.tsx` | Page not found – Trybun | Nie znaleziono strony – Trybun |
| `(team)/projects/[projectId]/page.tsx` | – (only redirects to `/`, never rendered) | – |

The braces stand for a heading text that already exists in the catalogues or a value of a record. The implementation reuses the existing heading entries and adds a key only where a page has none, or where the heading already names the brand (`setup.tabTitle`, so "Set up Trybun" does not become "Set up Trybun – Trybun"). The table is the contract for the first part and the order; the exact wording of a heading stays in `@trybun/i18n`. Filters in the address (the ticket list's views, "My tickets" of one project, the state tabs of the lists) do not change the title. A list stays the same page with other rows, as in its `h1`.

### Mechanism

- **`pageTitle(...parts)`** of `features/app-shell` (server-only, beside `notFoundMetadata()`) returns `{ title: { absolute } }`. The absolute string is built with one new catalogue entry, `app.titlePart`: `"{part} – {rest}"`, the same in EN and PL, written PL first. It folds the parts from the right, ending with `app.title`. So `pageTitle(t('settings.title'), project.name)` gives "Project settings – Website – Trybun". The translators own the separator. Record values are message arguments, inserted literally, never parsed as ICU.
- **Pages without a record** export a `generateMetadata` that calls `pageTitle()` with their translated heading. They read nothing.
- **Pages with a record** keep their `cache()` loader of ADR 0014. `metadataAfterRead(read, { title, rateLimitedTitle })` takes two title sources:
  - `title: (data) => string[]` gives the parts from the read's data.
  - `rateLimitedTitle: string[]` gives the parts the page can name without the record. Each page builds them from its translated heading and its parameters.

  A `notFound()` of the read still reaches the not-found metadata first, and `title` is never called then. So an invisible or missing record never gives its name to the tab (§14.4). On a `429` the function returns `pageTitle(...rateLimitedTitle)`, and the page shows `RateLimitedNotice`. The record is never read a second time.

  For tickets, `rateLimitedTitle` is the identifier from the address, e.g. "CP-3 – Trybun". It reaches the title only after `getTicketPage()` has accepted it: the upper-case canonical form, valid against `ticketIdentifierSchema`, which runs before the API is called. So it is bounded and reveals nothing beyond the person's own input. The resolution confirmation uses "Resolution confirmation – CP-3 – Trybun".
- **Ticket pages** take the title from the data `getTicketPage()` already reads, through a catalogue entry `tickets.tabTitle`: `"{identifier} {title}"`.
- **`notFoundMetadata()`** returns `pageTitle(t('tabTitle'))`, and `notFoundPage.tabTitle` drops its own " – Trybun" (EN "Page not found", PL "Nie znaleziono strony"). The visible result is unchanged.
- **The root layout** keeps `title: t('title')` ("Trybun") as the title of what has none of its own: the `error.tsx` pages (see Non-goals) and the moment before a page's metadata streams in.

**Alternatives considered:**

1. **`title.template: '%s – Trybun'` in the root layout**, the hypothesis of #407 and the documented Next.js way to suffix child titles (`dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`, `title.template`). Rejected after reading Next.js 16.4.5:
   - **User text is mangled.** `resolveTitleTemplate()` (`dist/esm/lib/metadata/resolvers/resolve-title.js`) runs `template.replace(/%s/g, title)`, so `$&`, `` $` `` and `$'` in a ticket, project or organization name are replacement patterns. With the template above, a title "Price $& and $' x" renders "Price %s and  – Trybun x – Trybun" (tested with Node 24). Escaping `$` in every record value would be a second rule to remember on every page.
   - **The template does not reach every page.** It is not applied to a page or `not-found.tsx` in the segment of the layout that defines it ("`title.template` defined in `layout.js` will not apply to a `title` defined in a `page.js` of the same route segment"; `accumulateMetadata()` skips the leaf layout), which is the case for `app/not-found.tsx`. A plain string `title` in any nested layout also resets the template for everything below it (`titleTemplates` is re-read from each segment's resolved title). So the template would be one rule with three exceptions.

   `title.absolute` from one helper is one rule without exceptions. The maintainer's Q1 answer, "the suffix via `title.template`", was recorded before this was found; the scheme they chose is kept exactly. See [Resolved assumptions](#resolved-assumptions-autonomous-defaults), A1.
2. **Identifier only for tickets** ("CP-3 – Trybun"). Rejected by the maintainer in Q2. A ticket title is already copied outside the database by design: the notification e-mail subject (S1-15), and the title-redaction spec lists those copies as a non-goal ([title redaction](2026-10-26-title-redaction.md), Non-goals). The tab shows only what the signed-in person already sees on the page.
3. **A client component setting `document.title`.** Rejected in ADR 0014 for the same reasons: a refresh of the metadata overwrites it, and it adds a client module to every page.

## 📝 Architecture

- `features/app-shell`: `pageTitle()`, beside `notFoundMetadata()` (new code, server-only).
- `lib/api-client/server-api-client.ts`: `metadataAfterRead()` takes the title function (changed). Its 12 callers pass one.
- 12 pages gain a `generateMetadata` (none of them reads the API in it); the redirect-only `(team)/projects/[projectId]` needs none. The 12 existing ones return a title. `help/[...slug]` returns the topic title from `findHelpPage()`, which reads bundled content and makes no API call.
- `@trybun/i18n`: `app.titlePart`, `tickets.tabTitle`, the changed `notFoundPage.tabTitle`, and any missing heading keys, PL first.
- No API, schema or contract change. Next.js renders the title on the server for a page load, and resolves the metadata again on a client-side navigation and on the `router.refresh()` of a language switch. ADR 0014 verified both paths for the not-found title, so translated titles follow both.

## 📝 Edge Cases & Failure Scenarios

- **An invisible or missing record**: the read calls `notFound()` before the title function runs, so the tab shows "Page not found – Trybun". The answer is the same for "does not exist" and "may not see" (§14.4).
- **A `429` on a record page**: the title without the record ("CP-3 – Trybun", "Project settings – Trybun", "Administration – Trybun" for an organization), plus `RateLimitedNotice`. Never "Trybun" alone, never the not-found title.
- **Other errors**: `metadataAfterRead()` throws them on as today.
  - An error only while the page renders keeps the page's own title over the `error.tsx` content, e.g. "Tickets – Trybun" with "Something went wrong".
  - An error of the read itself (e.g. a `500` of the API) fails the metadata too, so the tab shows the root title "Trybun". See Non-goals.
- **A very long ticket title** (up to 255 characters): the identifier comes first, so a truncated tab still tells tickets apart. Browsers truncate the rest; the title is not cut in code.
- **A record value with `{`, `}`, `$` or `%s`**: it is a message argument of next-intl and is inserted as is. A unit test covers it.
- **The ticket renamed while its page is open**: the tab keeps the old title until the next server render (a navigation, a reload, a language switch). See A3.
- **The redirecting pages** (`(team)/projects/[projectId]`, the portal root with one project, a lower-case identifier): the redirect target sets the title.

## 📝 Risks & Impact Review

- **Personal data in the tab title.** A ticket title can contain personal data, and the browser keeps titles in history and may sync them across devices. The maintainer accepted this in Q2. The exposure stays within what the signed-in person sees, the same as the page itself and the notification e-mail. Redacting a title ([title redaction](2026-10-26-title-redaction.md), approved, not yet built) cannot recall browser history. That is the same limit it already accepts for e-mails already sent. Its implementation should name browser history beside e-mails in its warning and help page. This spec cannot change that approved spec, so the PR records it as a follow-up note.
- **Broad, mechanical edit** (`risk-high`): 25 pages and the `metadataAfterRead()` contract. A unit scan fails for a page without a title, so a future page cannot ship without one.
- Easy to reverse: no data, API or persistent state change.

## Changes to the system specification

| Section | Change |
|---|---|
| §13.4 | New rule: every page has a translated, descriptive title (WCAG 2.2 SC 2.4.2). The scheme is `{page heading} – {record or section} – Trybun`, with the record's identifier and title for tickets. |
| §13.1 | The tab title is a translated text: built from `app.titlePart` in every locale. |
| §14.4 | An invisible or missing record gives only the not-found title. The metadata reads the record through the page's read, after its not-found check. |
| §18.5 | Pattern ([ADR 0015](../../docs/adr/0015-page-titles-through-absolute-metadata.md)): every `page.tsx` exports a `generateMetadata` that returns `pageTitle()` of `features/app-shell`, never a `<title>` element or `title.template`. Record pages pass `title` and `rateLimitedTitle` to `metadataAfterRead()`. `app/page-titles.spec.ts` fails for a page without one. |

No new glossary terms.

## Non-goals

- Other metadata: description, Open Graph, Twitter cards (#407, Out of scope).
- The Keycloak login screen (#407, Out of scope).
- A title of its own for `error.tsx`. **This is a compromise against SC 2.4.2, recorded here.** Next.js requires `error.tsx` to be a Client Component, which cannot export metadata. ADR 0014 rejected the alternatives, a `<title>` element and `document.title`, because they conflict with the metadata title.
  - The common case is an error while rendering. The tab then keeps the page's own descriptive title.
  - Only an error of the page's read leaves "Trybun". That comes from a failing API, for which §18.5 already shows "Something went wrong".
  - Closing that last case would need a second title mechanism, which Rule 12 forbids, so it stays open until Next.js offers metadata for error boundaries.
- Updating the tab title live when a ticket is renamed in an open page (A3).
- Recalling titles from browser history after a title redaction.

## Resolved assumptions (autonomous defaults)

The maintainer answered the blocking questions of #407 in the session ([issue comment](https://github.com/trybun/trybun/issues/407#issuecomment-7043966434)). Q1: most specific part first, en dash, "Trybun" last. Q2: identifier and title for tickets. The defaults below cover what those answers left open.

| # | Question | Default | Rationale |
|---|---|---|---|
| A1 | Mechanism of the suffix: `title.template` (named in the Q1 answer) or `title.absolute` from one helper? | `title.absolute` through `pageTitle()`, recorded in ADR 0015 (`proposed`) | Next.js 16.4.5 interprets `$`-patterns of user text in a template and skips the template for the root `not-found.tsx` and below any layout with a plain title. The scheme of Q1 is unchanged; only the mechanism differs. Reversible. |
| A2 | Middle parts: which pages carry a second part? | Project-scoped pages (the project) and the sections of the Administrator panel ("Administration"); nothing for list filters | The heading alone is ambiguous across tabs only there. GOV.UK bases the title on the `h1` plus the service. Keeps titles short (G88). |
| A3 | (#407 Q3, non-blocking) Follow a ticket renamed while its page is open? | No: the title refreshes on the next server render | The default of #407 itself. A live update would need a client-side title mechanism (rejected in ADR 0014) or a `router.refresh()` after every edit. |
| A4 | Title on a `429` of a record page? | The title without the record (the identifier from the address for tickets) | The record was not read. The address is the person's own input and reveals nothing (§14.4). |
| A5 | Title of `error.tsx`? | The page's own title when only its render fails; "Trybun" when its read fails | A Client Component cannot export metadata, and a second title mechanism is forbidden (Non-goals, recorded compromise). |

## Acceptance criteria

- [ ] Every page of the table has the listed title in EN and PL. A unit test per page covers its `generateMetadata`.
- [ ] `app/page-titles.spec.ts` fails for a `page.tsx` without a `generateMetadata`. Only the redirect-only `(team)/projects/[projectId]/page.tsx` is listed as an exception.
  - The scan reads the source text, so it proves that the export exists. The unit test of each page proves that the export returns the title.
  - The scan replaces the scan of `app/not-found-metadata.spec.ts`, which then checks a subset of the same property. The per-page unit tests keep checking that pages with a not-found read call it in `generateMetadata`.
- [ ] An invisible or missing ticket, project or organization gives "Page not found – Trybun" ("Nie znaleziono strony – Trybun"), and no part of the record reaches the metadata.
- [ ] A `429` gives the title without the record and `RateLimitedNotice`.
- [ ] One API read per request for every record page, unchanged: the unit tests assert that the loader's API call happens once when `generateMetadata` and the page run in the same request, as the tests of #406 do.
- [ ] E2E `toHaveTitle`:
  - One page per shell (team ticket, portal ticket, a help topic, a public page), each checked after a page load, after a client-side navigation to it, and after a language switch on it.
  - An unmatched address after a page load, since only a full load reaches it.
- [ ] §13.1, §13.4, §14.4 and §18.5 updated. [ADR 0015](../../docs/adr/0015-page-titles-through-absolute-metadata.md), added as `proposed` with this specification, is set to `accepted` in the file and in the ADR index, which already lists it as `proposed`.
- [ ] Works on phone, tablet and desktop (Rule 9): the E2E projects of all three viewports.
- [ ] User documentation and product tours: no change. A tab title is standard browser behaviour with nothing to explain, and no tour targets it.

## 📋 Implementation Plan

### Phase 1 – the helper and the static pages

1. Add `app.titlePart` (PL, then EN) and `pageTitle()` to `features/app-shell`, with unit tests: one part, two parts, record values with `{`, `$&` and `%s`.
2. Change `notFoundPage.tabTitle` to the bare text, make `notFoundMetadata()` return `pageTitle(t('tabTitle'))`, and keep the not-found E2E of #406 green.
3. Add `generateMetadata` with `pageTitle()` to the 12 pages that read nothing for their title, adding the missing heading keys. Add a unit test per page.
4. Add `app/page-titles.spec.ts`, the scan over every `page.tsx`, and remove the scan it replaces from `not-found-metadata.spec.ts`.

### Phase 2 – the record pages

1. Extend `metadataAfterRead(read, { title, rateLimitedTitle })`. Unit tests: found, not found (`title` is not called), `429` (`rateLimitedTitle`), other error.
2. Ticket pages (team, portal, resolution confirmation): `tickets.tabTitle` from the data of `getTicketPage()`. Unit tests, including an invisible ticket.
3. The project and organization pages, the pages of the Administrator panel and the help topic. Unit tests per page.

### Phase 3 – end-to-end checks, specification and docs

1. E2E `toHaveTitle` per shell: page load, client-side navigation, language switch, and the unmatched address.
2. Update §13.1, §13.4, §14.4 and §18.5. Set ADR 0015 to `accepted`.
3. Set the status to `implemented`, add the changelog entry and move this file to `implemented/`.

## Changelog

- 2026-11-20 – Created (#407). Q1 and Q2 answered by the maintainer; A1–A5 resolved as autonomous defaults for review; ADR 0015 proposed. Revised after an independent review: the `429` title contract, the resolution-confirmation title, the setup title, test scope, and the `error.tsx` compromise. Revised after the review of #408: a page whose `h1` names its record takes the view's name first (project settings, resolution confirmation).
