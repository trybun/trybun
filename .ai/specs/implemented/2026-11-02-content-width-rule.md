# Content width of pages in the application shell

|                               |                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| Status                        | `implemented`                                                                                            |
| Created                       | 2026-11-02                                                                                               |
| Plan task                     | –                                                                                                        |
| System specification sections | §2.9, §18.2, §18.5                                                                                       |
| Related issues / PRs          | #179 (request), #175 (manual QA where the question came up), #193 (specification), #194 (implementation) |

## 📝 TLDR

Every page in the application shell limits its content to `max-w-3xl` (768 px), so on a desktop the Projects list stops at about half of the screen. Proposed: **forms, settings and detail pages keep the readable `max-w-3xl` width, while lists, tables and boards use the full width of the content area**, the way GitHub, Linear and Jira do. The maintainer approved this rule on 2026-11-02 (#179). This specification records it in the system specification and applies it to the existing pages.

## Context

The width is set only in the code. `docs/spec` and `docs/brand` do not define a content width:

| Page                                                                   | Container                                                                                                                     | Kind         |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Projects (`app/(team)/projects/page.tsx`)                              | `max-w-3xl` on the page root                                                                                                  | list         |
| Administration (`app/(team)/admin/layout.tsx`)                         | `max-w-3xl` on the **layout**, so every section inherits it: Getting started, Accounts, Organizations, an organization, About | mixed        |
| Account settings (`app/(team)/settings/page.tsx`)                      | `max-w-3xl`                                                                                                                   | form         |
| Project settings (`features/projects/components/project-settings.tsx`) | `max-w-3xl`                                                                                                                   | form         |
| Help (`app/(team)/help/page.tsx`, `help-article.tsx`)                  | `max-w-prose`                                                                                                                 | reading text |

The `<main>` of the application shell (`features/app-shell/components/app-shell.tsx`) already fills the space beside the navigation, with `px-4` / `md:px-6` padding. Long lists and tables will arrive next (tickets, the List view of §8.5), and there the narrow width costs columns and long titles.

## Goals

- One written rule for content width that every page in the application shell follows (Rule 12: one pattern per problem).
- The Projects, Accounts and Organizations lists use the full width of the content area from the tablet breakpoint on.
- Forms, settings and detail pages keep a readable line length, as now.

## Non-goals

- Pages outside the application shell (setup wizard, invitations, the account-deactivated and setup-pending notices). They keep their centred narrow cards.
- Help pages. They keep `max-w-prose` for reading text.
- New layout components in `@trybun/ui` or a page-template abstraction.
- Changing the inner layout of lists, such as the column widths or truncation of the Accounts table, or the card layout of lists on phones (§2.9 "Tables and lists").
- A maximum width for very wide screens (see Resolved assumptions, Q3).

## Proposed change

### The rule (approved 2026-11-02)

The content of a page in the application shell has one of two widths, chosen by what the page is for:

| Page kind                                                                                                               | Width                                                                     | Why                                                                          |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Form, settings or detail of one record**: account settings, project settings, an organization, Getting started, About | Readable: `max-w-3xl` (768 px) on the page's root container               | Line length and eye travel; the labels of a form stay near their fields      |
| **List, table or board**: Projects, Accounts, Organizations, and later the ticket views of §8                           | Full width of the content area: no `max-w-*` on the page's root container | Columns and long titles have room; the convention of GitHub, Linear and Jira |
| Reading text (help)                                                                                                     | `max-w-prose`, unchanged                                                  | Typography of long text                                                      |

The page's header (title and primary action) takes the width of its page. On a list page the primary action (e.g. **New project**) therefore sits at the right edge of the content area. On phones (< 768 px) nothing changes, because both widths already fill the screen.

### Applying it

- **Projects**: the root container of the page loses `max-w-3xl`.
- **Administration**: `max-w-3xl` moves from the shared layout into the pages that are not lists. The title and the section navigation of the layout take the full width.
  - full width: Accounts, Organizations;
  - `max-w-3xl`: Getting started, About, an organization (`admin/organizations/[organizationId]`). An organization is the detail of one record. Its member list is part of that detail, not a page-level table.
- **Account settings, project settings**: unchanged (`max-w-3xl`).

### UI/UX

No new states or flows. The change is visible only from the tablet breakpoint on. Pages must not overflow sideways at 360, 768 or 1280 px (§2.9). Focus order, touch targets and the product tours are unchanged: the `data-tour` targets stay on the same elements, and the tour tip follows its target (#188).

Mockups: none. The change only removes a width limit on three existing screens. The current-state screenshot is attached to #179.

## Changes to the system specification

| Section               | Change                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §2.9 Approach         | A new bullet **Content width**: forms, settings and the detail of one record use a readable width (768 px); lists, tables and boards use the full width of the content area; help text keeps the prose width. |
| §18.2 Quick reference | A new row: _The width of a page's content_ → `max-w-3xl` on the root container of a form, settings or detail page; no `max-w-*` on a list, table or board page; never on a shared layout → §18.5.             |
| §18.5 Layout          | A bullet stating that the page (its route file or its root feature component) sets the width of its content according to §2.9. A layout shared by both kinds of page never limits the width.                  |

No new glossary terms.

## Resolved assumptions (autonomous defaults)

The blocking question of #179 (which rule) was answered by the maintainer on 2026-11-02. The remaining design questions were resolved with the most reversible option:

| #   | Question                                                                                                      | Assumed answer                                                      | Rationale                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | A shared layout component (e.g. `PageContainer` with a `width` variant) or Tailwind classes on the page root? | Tailwind classes on the page root, written down as a pattern in §18 | No new public surface in `@trybun/ui`. After the change, 5 page roots use one class. A component can be proposed later under Rule 12 when the ticket views add more kinds of page. |
| Q2  | Is an organization's detail page (with its member list) a list page?                                          | No, it stays `max-w-3xl`                                            | It is the detail of one record. Its member list is short and secondary. This is the smallest visible change and easy to flip.                                                      |
| Q3  | Cap the full width on very wide screens (e.g. `max-w-screen-2xl`)?                                            | No cap                                                              | It is the approved rule as written, the convention of Linear and Jira, and a cap can be added later without other changes.                                                         |
| Q4  | Widen the Accounts table's truncated cells (`max-w-48`, `max-w-64`)?                                          | No, out of scope                                                    | It is the inner layout of a list, not the page's width.                                                                                                                            |
| Q5  | User documentation or product tour changes (Rules 3, 4)?                                                      | None                                                                | No feature, step or target changes. Only the available width changes.                                                                                                              |

No assumption needs human confirmation.

## Edge Cases & Failure Scenarios

- **Admin title and navigation on a form page**: they span the full width while the form below is 768 px wide. This is accepted. It matches GitHub's settings pages, where the tab bar runs across the page.
- **Empty or short lists at full width**: the "no projects" text stays left-aligned. No centring is added.
- **Horizontal overflow**: removing a `max-w` cannot create overflow. The E2E checks still assert none at 360, 768 and 1280 px.
- **Layout shift (CLS)**: the width is static CSS, with no client-side measurement, so the Lighthouse CLS budget is not affected.

## Risks & Impact Review

Low risk, CSS only: no data, API, contract or permission impact, and no `BACKWARD_COMPATIBILITY.md` surface. Rollback is reverting the class changes. No existing test asserts the `max-w-3xl` class. The new tests pin both widths.

## Acceptance criteria

- [ ] §2.9, §18.2 and §18.5 state the content-width rule.
- [ ] Projects, Accounts and Organizations: the page's root container has no `max-w-*`. At 1280 px the list is wider than 768 px.
- [ ] Getting started, About, an organization, account settings and project settings: the root container is `max-w-3xl`.
- [ ] The admin layout sets no `max-w-*`.
- [ ] No horizontal overflow at 360, 768 and 1280 px on the changed pages (E2E). The Lighthouse budget passes.
- [ ] Works on phone, tablet and desktop (Rule 9).
- [ ] User documentation and product tour updated where relevant (Rules 3, 4): none needed (Q5).

## 📋 Implementation Plan

### Phase 1 – the rule and its application (one PR)

1. **Specification**: add the Content width bullet to §2.9 and the row and bullet to §18.2 and §18.5. `pnpm lint:spec` passes.
2. **Projects**: remove `max-w-3xl` from the root of `app/(team)/projects/page.tsx`. Test: the page spec asserts that the page root has no `max-w-*` class.
3. **Administration**: remove `max-w-3xl` from `app/(team)/admin/layout.tsx`. Add `max-w-3xl` to the root element of the feature components that own those pages: `GettingStartedChecklist` (`<section>`), `AboutDetails` (`<section>`) and `OrganizationDetail` (`<div>`). This is the same place where `ProjectSettings` sets it today, and the route files stay thin. Test: the layout spec asserts no width limit, and the component tests of the three components assert `max-w-3xl`. The roots of Accounts and Organizations (`accounts/page.tsx`, `organizations/page.tsx`: `flex flex-col gap-6`) and their layouts (providers only) already have no width limit.
4. **E2E**: in `projects.spec.ts`, `accounts.spec.ts` and `organizations.spec.ts`, the existing `horizontalOverflow()` checks stay and cover the widened pages. Add one assertion, on the desktop profile only (1280 px), that the list is wider than 768 px. Phones and tablets are excluded because the width limit never applied below 768 px.
5. **Close**: run the validation gate and the E2E suite with the Lighthouse budget. Set this spec to `implemented`, add the changelog entry and move it to `implemented/`.

## Changelog

- 2026-11-02 – Created. The maintainer approved the rule (#179).
- 2026-11-02 – Implemented in #194.
