# Product tour infrastructure and the "First login" tour

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-10-24 |
| Plan task | `S0-10` |
| System specification sections | §2.4, §2.9, §14.2, §18.2, §18.5, §18.9, glossary |
| Related issues / PRs | [#35](https://github.com/trybun/trybun/issues/35), [#68](https://github.com/trybun/trybun/pull/68) (specification) |

## Context

Rule 4 ([§2.4](../../../docs/spec/02-agent-rules.md)) requires interactive product tours for the relevant views. Each tour is short, can be skipped or closed at any moment and restarted from the help menu, and starts automatically only once per user – remembered **on the server**, so it works the same on every device. Tours are role-aware, translated and accessible, target stable `data-tour` attributes, and E2E tests check that all targets exist. On phones, tips appear as bottom sheets instead of tooltips ([§2.9](../../../docs/spec/02-agent-rules.md)). [§14.2](../../../docs/spec/14-architecture.md) allows `driver.js` or our own components built from the `@trybun/ui` Popover and Drawer.

None of this exists yet:

- no tour library or component, and no `data-tour` attribute in the code;
- no Popover in `@trybun/ui`;
- the help entry of the header is a single icon link to the help page of the view (S0-09), not a menu;
- the database has no table for tour progress;
- there is no pattern in [§18](../../../docs/spec/18-code-patterns.md) for tours, and no mutation in the web application yet.

S0-10 builds the infrastructure that later tasks use for their tours ([§2.4](../../../docs/spec/02-agent-rules.md): creating a ticket, the triage queue, Kanban, roadmap, Gantt, command palette), plus the first tour, "First login". This specification proposes the user-facing behaviour and the pattern for approval.

## Goals

- Tours start automatically once per user and tour version, on any device, and never again after they are completed or skipped – unless the user restarts them.
- A tour can be closed with Esc, the close button or Skip, and restarted from the help menu.
- A removed or renamed `data-tour` target fails E2E.
- One reusable pattern that later tasks follow when they add a tour to their view.
- The "First login" tour for team members on the Home view.

## Non-goals

- The tours of later views (creating a ticket, triage queue, Kanban, roadmap, Gantt, command palette): each comes with its view's task.
- A first-login tour for end users: the end-user portal does not exist yet and seeded end users cannot sign in (Stage 0 has no portal shell). The infrastructure supports end-user tours; their first tour comes with the portal.
- A setting to "show all tours again": a tour is restarted from the help menu of its view.
- Analytics of tour use (how many people skip a step).

## Proposed change

### What the user sees

- **Automatic start.** When a person opens a view that has a tour and has no progress for the current version of that tour, the tour starts after the view has rendered. At most one tour runs at a time. A tour never starts automatically while a dialog, sheet or menu is open.
- **A step** shows a short title, one or two sentences, "Step 2 of 4", and the buttons **Back**, **Next** (**Done** on the last step) and **Skip tour**, plus a close button. The target element is highlighted with a focus-coloured ring; the rest of the page is **not** dimmed or blocked – a tour never blocks work (Rule 2).
  - Tablet and desktop: a tip next to the target (a non-modal popover anchored to it), scrolled into view.
  - Phone: a bottom sheet at the bottom of the screen; the target is scrolled into view above it and highlighted.
  - A step without a target (e.g. a welcome step) is shown as a centred tip (desktop, tablet) or the bottom sheet (phone).
- **Closing.** Esc, the close button and **Skip tour** end the tour and record it as `skipped`; **Done** records it as `completed`. Leaving the view while a tour runs also records `skipped`, so the tour does not reappear on its own (Rule 2).
- **Restart from the help menu.** The help icon of the header opens a **help menu** instead of going straight to the help page:
  - **Help for this view** – the help page of the current view, as the icon does today (or the help index for a view without one);
  - **Take the tour** – one item per tour of the current view that the person may see (the tour's name, e.g. "Take the tour: Getting started"); shown only when the view has a tour.

  Restarting is always possible, whatever the recorded status; finishing or skipping a restarted tour updates the record.
- **Version.** Every tour has a version (an integer starting at 1). Increasing it – only when its steps change materially – makes the tour start automatically once more for everyone; small text corrections keep the version.
- **Role-aware.** A tour belongs to a view of the team application or of the end-user portal, so end users never get a team tour. Within a tour, a step about an action is shown only when its target is rendered – the view renders it only when the API's `allowedActions` allow the action – so the tour itself contains no permission logic (the web application only follows `allowedActions`). Such steps are marked optional in the tour definition.
- **Accessibility** ([§13.4](../../../docs/spec/13-non-functional.md)): the tip is a labelled non-modal dialog (`role="dialog"`, `aria-labelledby` the step title, `aria-describedby` its text); focus moves to the tip when a step opens and returns to the element that had it when the tour ends; all buttons are reachable with Tab and have touch targets ≥ 44 px; scrolling and transitions are instant with `prefers-reduced-motion`; the step counter is announced with the step.
- **Texts** are in the message catalogues (EN, PL) like every other text ([§13.1](../../../docs/spec/13-non-functional.md)).

### The "First login" tour (`first-login`, version 1)

Team members, on the **Home** view (`/`), four steps:

1. **Welcome to Trybun** – no target: what Trybun is for the team and that the tour takes four short steps.
2. **Main navigation** – `data-tour="app-shell-navigation"` (the side navigation on tablet and desktop, the bottom navigation on phones): where the views of Trybun are.
3. **Help** – `data-tour="app-header-help"`: the help for each view, and that this tour can be taken again from here.
4. **Your account** – `data-tour="app-header-account-menu"`: the language switch and signing out.

The search and the notifications get their steps with their tasks (S1-xx), by increasing the tour's version only if the change is material.

### What the system does

- **Server – product tour progress.** A new table `product_tour_progresses` (Prisma model `ProductTourProgress`): `user_id` (→ `users`), `tour_id`, `tour_version`, `status` (`completed` / `skipped`), `updated_at`; one row per user and tour (unique `user_id, tour_id`). Two endpoints of the current user, in the `users` module:
  - `GET /api/v1/users/me/product-tours` – the person's progress for all tours: `{ items: [{ tourId, tourVersion, status, updatedAt }] }`. The list is bounded by the number of tours (a few dozen), so it uses the envelope of [§18.4](../../../docs/spec/18-code-patterns.md) with `nextCursor` always `null` and accepts no `cursor` (see open question 7).
  - `PUT /api/v1/users/me/product-tours/{tourId}` with `{ tourVersion, status }` – records (creates or replaces) the progress and returns it. Idempotent; the row belongs only to the person, has no `version` and needs no `If-Match` ([§17.2](../../../docs/spec/17-conventions.md) "Concurrency"): the last write wins, which is correct for two devices finishing the same tour.
  - The tour identifiers are a closed enum in `@trybun/contracts` (`productTourIdSchema`); an unknown `tourId` returns `422`. The server stores no tour definitions or steps.
  - A person only ever reads and writes their own progress (derived from the principal, never from the request); this needs no CASL ability, like `GET /users/me`.
- **Web – tour definitions** live in `apps/web/src/features/product-tours/tours/<tour-id>.ts`: `id`, `version`, `view` (route), the audience (`team` or `end_user`, chosen by the shell the view belongs to), and the steps (`target` – the `data-tour` value or none, the catalogue keys of title and text, `optional`). The registry `tours/index.ts` lists all tours; it is the single source for the automatic start, the help menu and the E2E check.
- **Web – runtime.** The progress is a query (`features/product-tours/queries.ts`, prefetched in the shell with the current user, [§18.5](../../../docs/spec/18-code-patterns.md)); recording it is the first mutation hook (`features/product-tours/mutations.ts`), which updates the query cache on success. The tour that is running is client state of one provider in the shell (`ProductTourProvider`, React context) – not a global store ([§18.5](../../../docs/spec/18-code-patterns.md) "State"). A step's target is looked up by `[data-tour="…"]` when the step opens; an optional step whose target is missing is left out; a missing required target ends the tour without recording it and logs the tour and target IDs in the browser's error reporting (S0-17), never in production UI.
- **UI components.** `@trybun/ui` gets a **Popover** (shadcn/ui on Base UI, Rule 6) and a **TourTip** component (title, text, step counter, Back / Next / Skip / close), which renders as a popover anchored to an element on tablet and desktop and as a non-modal bottom sheet on phones; both with stories for all states and the phone, tablet and desktop viewports. We build our own components instead of `driver.js`: `driver.js` renders its own popover markup and styles outside `@trybun/ui` (a second UI primitive and styling approach), has no bottom-sheet layout for phones, and needs extra work for focus management and screen-reader labels – all of which Base UI provides.
- **`data-tour` attributes** follow `data-tour="<view>-<element>"` ([§17.1](../../../docs/spec/17-conventions.md)) and are used only for tours ([§18.7](../../../docs/spec/18-code-patterns.md)). A shared element of the shell uses the view `app-header` or `app-shell`.
- **E2E.**
  - `e2e/product-tours.spec.ts` checks, for every tour of the registry and in every project (phone, tablet, desktop), that the target of every required step exists and is visible on its view – so removing or renaming a target fails E2E. Optional targets are checked with a seeded account that may perform all actions of the view.
  - It also checks: a tour completed on desktop does not start again on a phone for the same user; Esc closes the tour; the help menu restarts it.
  - The demo dataset ([§15.12](../../../docs/spec/15-deployment.md)) records the current tours as `completed` for the existing demo accounts, so demos and the other E2E tests are not interrupted, and adds a team account **Nina Newcomer** (`newcomer@example.com`) without tour progress. The tour E2E tests sign in as her and clear her progress before each run.
- **User documentation** (EN, PL): a how-to "Take a product tour again" for the team and for end users (restart from the help menu, what skipping means), and the team's getting-started tutorial mentions the tour and the help menu instead of the help icon link.

### Pattern for later tasks

A new section "Product tours" in [§18.5](../../../docs/spec/18-code-patterns.md) and a row in the quick reference of [§18.2](../../../docs/spec/18-code-patterns.md): a tour is added by (1) a definition file in `features/product-tours/tours/` registered in `tours/index.ts`, (2) its ID in `productTourIdSchema`, (3) `data-tour` attributes on the targets, (4) texts in the catalogues; the E2E check covers it without new test code. §18.9 lists `apps/web/src/features/product-tours/`, `packages/ui/src/components/tour-tip.tsx` and `apps/server/src/modules/users/` (progress endpoints) as the reference implementation of S0-10, and `features/product-tours/mutations.ts` as the first mutation hook until S1-01 builds the full feature-module reference.

## Changes to the system specification

| Section | Change |
|---|---|
| §2.4 | States the closing behaviour (Esc, close and Skip record `skipped`, leaving the view too; Done records `completed`), that the page is not dimmed or blocked, that restarting is always possible, and that steps about actions appear only when their target is rendered |
| §2.3 or §2.4 | The help icon of the header opens the help menu: "Help for this view" and "Take the tour" per tour of the view |
| §2.9 | Product tours row: "Bottom-sheet tips instead of tips next to elements; the target is scrolled above the sheet and highlighted" |
| §14.2, §14.5 | Product tours row: own components (`@trybun/ui` Popover and TourTip, bottom sheet on phones); §14.5 lists `driver.js` as considered and not used, with the reason above |
| §18.2, §18.5 | New "Product tours" pattern (above) |
| §18.4 | A list bounded by a small closed set (the tours) returns the envelope without pagination |
| §18.9 | Reference implementation of S0-10 |
| §15.12 / demo dataset | The account Nina Newcomer and the seeded tour progress of the demo accounts |
| Glossary | `product_tour_progress` gets its fields; new status enum |

New or changed glossary terms (code identifier, EN/PL labels):

- `product_tour_progress.status` – enum `completed` (Completed / Ukończony), `skipped` (Skipped / Pominięty).
- `product_tour.version` – Tour version / Wersja przewodnika: integer increased when the steps change materially.

## Open questions

Implementation must not start until every question has an answer.

1. Own components on `@trybun/ui` (Popover, TourTip) or `driver.js`? — **Proposed answer:** own components, for the reasons under "UI components". Approved by merging this specification.
2. The help icon becomes a menu (one more tap to the help page) to hold "Take the tour". Is that acceptable under Rule 2, or should the tour be restarted elsewhere (e.g. a button on the help page of the view)? — **Proposed answer:** the help menu, as §2.4 requires and as common products do (GitHub, Linear, Jira: a "?" menu with help and tours). Approved by merging this specification.
3. Does leaving the view during a tour count as `skipped`? — **Proposed answer:** yes; otherwise an interrupted tour would start again on the next visit, which Rule 2 forbids ("never reappears unless the user asks for it"). Approved by merging this specification.
4. Is the page left undimmed (no overlay) during a tour? — **Proposed answer:** yes; the highlight ring marks the target and the user can keep working, so the tour never blocks work. Approved by merging this specification.
5. Do the steps of "First login" (above) cover what a new team member needs in Stage 0? — **Proposed answer:** yes; search and notifications are added with their tasks. Approved by merging this specification.
6. Is a new demo account (Nina Newcomer) acceptable for the tour E2E tests, with the existing demo accounts seeded as having completed the tours? — **Proposed answer:** yes; it keeps the other E2E tests and demos free of tours and gives the tour tests a repeatable starting point. Approved by merging this specification.
7. Every list endpoint uses cursor pagination ([§18.4](../../../docs/spec/18-code-patterns.md)). Is a list bounded by a closed set (the tours, a few dozen) allowed to return the whole envelope at once (`nextCursor: null`)? — **Proposed answer:** yes; paginating a list whose size is fixed by the code adds round trips without benefit. §18.4 states the exception. Approved by merging this specification.

## Acceptance criteria

- [x] A tour completed on desktop does not start again on a phone for the same user.
- [x] A removed `data-tour` target fails E2E.
- [x] The tour can be closed with Esc and restarted from the help menu.
- [x] The "First login" tour starts once for a new team member on Home and is recorded as `completed` or `skipped` on the server.
- [x] Increasing a tour's version starts it once more.
- [x] Popover and TourTip in `@trybun/ui` with stories for all states and viewports; axe finds no violations in the tour E2E test.
- [x] Works on phone, tablet and desktop (Rule 9).
- [x] User documentation (EN, PL) and the §18 pattern updated (Rules 3, 4, 12).

## Changelog

- 2026-10-24 – Created.
- 2026-10-24 – Approved by merging #68.
- 2026-10-24 – Implemented (S0-10), with these refinements found while implementing:
  - The tour identifier is `first_login`: enum values of the contracts are snake_case ([§17.1](../../../docs/spec/17-conventions.md)); the definition file stays `first-login.ts`.
  - A step whose target is missing is shown centred instead of ending the tour: the E2E check prevents missing targets, and a centred tip still never blocks work. The tour starts as soon as its view renders, before a dialog, sheet or menu can be opened, so no separate check for open overlays is needed.
  - On phones, a tip about an element at the bottom edge of the screen (the bottom navigation) opens as a sheet at the top edge, so the sheet does not cover its target.
  - The table is `product_tour_progresses`: table names are the plural of the model name ([§17.1](../../../docs/spec/17-conventions.md), checked by `pnpm lint`).
  - The tip component is loaded only when a tour starts, so the application shell keeps its Lighthouse budget.
  - The progress list uses the new envelope `pageSchema` of `@trybun/contracts/pagination` with `nextCursor: null`.
  - User documentation: a how-to for the team only (`team/how-to/take-a-product-tour-again`); end users get theirs with the first end-user tour, since the portal has no tour yet. The help pages that named the help icon now name **Help for this view**.
  - The help menu offers **All help topics** instead of **Help for this view** on a view without a help page.
