# Tours "Creating a ticket" and "Kanban board", reference pages and help for every MVP view

| | |
|---|---|
| Status | `draft` |
| Created | 2026-10-26 |
| Plan task | `S1-18` |
| System specification sections | §2.3, §2.4, §4.1–§4.4, §5.1–§5.4, §7.5, §18.5, glossary |
| Related issues / PRs | Builds on S0-09 ([#67](https://github.com/trybun/trybun/pull/67)) and S0-10 ([#68](https://github.com/trybun/trybun/pull/68), [specification](implemented/2026-10-24-product-tours.md)). Sibling specifications: S1-01 [#111](https://github.com/trybun/trybun/pull/111), S1-02 [#112](https://github.com/trybun/trybun/pull/112), S1-03 [#113](https://github.com/trybun/trybun/pull/113), S1-06 [#116](https://github.com/trybun/trybun/pull/116), S1-07 [#117](https://github.com/trybun/trybun/pull/117), S1-08 [#119](https://github.com/trybun/trybun/pull/119), S1-09 [#118](https://github.com/trybun/trybun/pull/118), S1-10 [#120](https://github.com/trybun/trybun/pull/120), S1-11 [#121](https://github.com/trybun/trybun/pull/121), S1-12 [#122](https://github.com/trybun/trybun/pull/122), S1-13 [#123](https://github.com/trybun/trybun/pull/123), S1-14 [#124](https://github.com/trybun/trybun/pull/124), S1-15 [#125](https://github.com/trybun/trybun/pull/125), S1-16 [#126](https://github.com/trybun/trybun/pull/126), S1-17 [#127](https://github.com/trybun/trybun/pull/127) |

## Context

Stage 1 ends when "user documentation exists for all MVP views, and the tours 'First login', 'Creating a ticket' and 'Kanban board' exist" (exit criteria of Stage 1). S1-18 is the last group of the stage. Its plan row: tours "Creating a ticket" and "Kanban board"; user documentation for all MVP views; reference pages for statuses, visibility and permissions. Done when every MVP view has a help page in EN and PL, and both tours pass the E2E target check on phone, tablet and desktop.

What exists, or is proposed by the sibling specifications:

- **Help** (S0-09, [§2.3](../../docs/spec/02-agent-rules.md)): pages in `docs/user/<language>/<audience>/<category>/<name>.md`; `views` in the front matter make a page the contextual help (**Help for this view**) of the routes it names; the generator fails on a missing translation and on a view claimed twice by one audience. Nothing checks that a view *has* a page.
- **Tours** (S0-10, [§2.4](../../docs/spec/02-agent-rules.md), [§18.5](../../docs/spec/18-code-patterns.md) "Product tours"): one tour, `first_login`, for the team on `/`. The E2E check `apps/web/e2e/product-tours.spec.ts` opens each tour's `view` as the signed-in team member and asserts every target; it asserts that no tour is for end users yet ("its first tour signs in as an end user here").
- **Help pages of the views.** Rule 3 delivers documentation with the feature, so the sibling specifications assign the pages of their own views to themselves: S1-09 the portal pages ([#118](https://github.com/trybun/trybun/pull/118) Q16, which also says that S1-18 "checks that every MVP view has a page"), S1-10 "Create a ticket" and "Ticket view", S1-11 the visibility how-to pages ([#121](https://github.com/trybun/trybun/pull/121) Q15), S1-12 the comment pages ([#122](https://github.com/trybun/trybun/pull/122) Q17), S1-13 "Ticket list", S1-14 "Kanban board" and the `data-tour` targets of its tour ([#124](https://github.com/trybun/trybun/pull/124) Q17), and S1-01, S1-02, S1-03, S1-08, S1-15, S1-16 and S1-17 the pages of theirs. S1-06 has no view and leaves the statuses reference to S1-18 ([#116](https://github.com/trybun/trybun/pull/116) Q14).

Three gaps remain for S1-18 besides the tours and the reference pages:

1. **The board has no route of its own.** It is the layout `board` of the list page: `/tickets?layout=board` ([#124](https://github.com/trybun/trybun/pull/124) Q1). Help `views` and a tour's `view` match only the path (`matchesView` of `features/help/help-routes.ts`). So S1-13's "Ticket list" and S1-14's "Kanban board" both claim `/tickets` – the generator rejects that – and a board tour would start on the list, where its targets do not exist ([Q1](#open-questions)).
2. **"Every MVP view has a help page" is not checkable.** No list of views exists, and nothing fails when a view lacks a page ([Q8](#open-questions)).
3. **Tours start before their targets exist.** S0-10 starts a tour as soon as its view renders and shows a step with a missing target centred. The board shows a project picker instead of columns until a project is chosen ([#124](https://github.com/trybun/trybun/pull/124) Q19), and an empty board has no card, so the board tour would start with centred tips about things that are not there ([Q4](#open-questions)).

## Goals

- The tour "Creating a ticket" for end users on the portal ticket form, and the tour "Kanban board" for the team on the board; both pass the E2E target check on phone, tablet and desktop.
- Reference pages, in EN and PL, for the ticket statuses, ticket visibility and the roles and permissions of Stage 1, for the audiences that need them.
- A unit test that fails when a view of the team application or of the portal has no help page for its readers, so "every MVP view has a help page" holds now and for every later view.
- No page that a sibling task writes is written twice.

## Non-goals

- The help pages of the individual views: their tasks write them (above). S1-18 writes a page for a view only if the coverage check finds one missing when S1-18 is implemented.
- The tours of the triage queue, roadmap, Gantt chart and command palette ([§2.4](../../docs/spec/02-agent-rules.md)): they come with their views (S2-xx, S4-xx, S5-xx).
- A team tour of the full ticket form (`/tickets/new`) ([Q2](#open-questions)).
- A first-login tour for end users: the portal tour of S1-18 is about creating a ticket only.
- Administrator-only help pages ([S1-19](../../docs/plan/implementation-plan.md)). The coverage check works with the audiences as they are and keeps working after S1-19.
- Screenshots or videos in help pages: the help pages contain no images today ([#117](https://github.com/trybun/trybun/pull/117)).
- Changes to the content of `docs/spec/`, `docs/plan/` or README in this specification PR. The implementation PR updates `docs/spec/` (table below) and `docs/user/README.md`.

## Proposed change

### Tour "Creating a ticket" (`create_ticket`, version 1)

End users, on the simplified ticket form of the portal, `/portal/projects/[projectId]/tickets/new` ([#118](https://github.com/trybun/trybun/pull/118)). Name: "Creating a ticket" (PL „Tworzenie zgłoszenia”), shown in the help menu as "Take the tour: Creating a ticket". Four steps ([Q3](#open-questions)):

| # | Target (`data-tour`) | Title EN / PL | Text EN / PL |
|---|---|---|---|
| 1 | `ticket-form-title` | Describe the problem in a few words / Opisz problem kilkoma słowami | A short title helps the team find your ticket. It is the only required field. / Krótki tytuł pomaga zespołowi odnaleźć zgłoszenie. To jedyne wymagane pole. |
| 2 | `ticket-form-description` | Add the details / Dodaj szczegóły | Follow the hints in the field: what happened, what you expected and how to reproduce it. You can attach screenshots and files below. / Skorzystaj z podpowiedzi w polu: co się stało, jaki był oczekiwany efekt i jak odtworzyć problem. Poniżej możesz dołączyć zrzuty ekranu i pliki. |
| 3 | `ticket-form-visibility` | Choose who can see it / Wybierz, kto widzi zgłoszenie | By default only you and the team see your ticket. Widen it only when it contains no confidential data; sharing with all customers needs the team's approval. / Domyślnie zgłoszenie widzisz tylko Ty i zespół. Poszerz widoczność tylko wtedy, gdy nie zawiera poufnych danych; udostępnienie wszystkim klientom wymaga zgody zespołu. |
| 4 | `ticket-form-submit` | Send it / Wyślij | After sending you will see your ticket and its status. We will let you know by e-mail when it needs your reply. / Po wysłaniu zobaczysz swoje zgłoszenie i jego status. Gdy będzie potrzebna Twoja odpowiedź, powiadomimy Cię e-mailem. |

- `ticket-form-visibility` is the target S1-11 names ([#121](https://github.com/trybun/trybun/pull/121)); S1-18 adds the other three to S1-09's form. The view part `ticket-form` is shared with the team form, so a later team tour can reuse the names.
- Targets sit on elements of the first paint ([Q4](#open-questions)): the `Field` wrapper of the description, not the `MarkdownEditor` inside it, which is loaded lazily (`lazy-markdown-editor.tsx`).
- Step 4 sets `phoneSheetSide: 'top'`: the buttons sit at the bottom of the form on phones ([#118](https://github.com/trybun/trybun/pull/118)), so the sheet must not cover them.
- No step is optional: every target is rendered whenever the form is (an archived project shows no form, [#118](https://github.com/trybun/trybun/pull/118)).
- The texts describe behaviour of earlier Stage 1 tasks only: visibility and approval (S1-11), the e-mail when the public status needs a reply (S1-15).

### Tour "Kanban board" (`kanban_board`, version 1)

The team, on the board, `/tickets?layout=board` ([#124](https://github.com/trybun/trybun/pull/124), [Q1](#open-questions)). Name: "Kanban board" (PL „Tablica Kanban”). Four steps on the targets S1-14 adds ([#124](https://github.com/trybun/trybun/pull/124) Q17):

| # | Target (`data-tour`) | Title EN / PL | Text EN / PL |
|---|---|---|---|
| 1 | `kanban-board-view-switch` | The board of a project / Tablica projektu | Each column is a status. Switch between the list and the board at any time – your filters stay. / Każda kolumna to jeden status. Między listą a tablicą możesz przełączać się w każdej chwili – filtry zostają. |
| 2 | `kanban-board-column-header` | Columns and WIP limits / Kolumny i limity WIP | The header shows how many cards a column holds and its WIP limit, if one is set. Done shows the last 14 days. / Nagłówek pokazuje liczbę kart w kolumnie i jej limit WIP, jeśli go ustawiono. Kolumna Zakończone pokazuje ostatnie 14 dni. |
| 3 | `kanban-board-card` | Move a card / Przenieś kartę | To change the status, drag the card to another column or choose **Move to** in its menu. / Aby zmienić status, przeciągnij kartę do innej kolumny albo wybierz **Przenieś do** w jej menu. |
| 4 | `kanban-board-card-menu` (optional) | Reject or mark as duplicate / Odrzuć lub oznacz jako duplikat | Rejected and Duplicate have no column: choose them in the card menu, with a reason or the original ticket. / Statusy Odrzucone i Duplikat nie mają kolumny: wybierz je w menu karty, podając powód albo zgłoszenie pierwotne. |

- The labels in bold are those of S1-14's catalogue; the implementation copies them from there ([#124](https://github.com/trybun/trybun/pull/124) Q11: no drag on phones, **Move to** instead, so step 3 holds on every device).
- Step 4 is optional: the card menu is shown only when `allowedActions` allow a status change, e.g. not in an archived project ([§18.5](../../docs/spec/18-code-patterns.md) "Product tours").
- On phones the board shows one column at a time ([#124](https://github.com/trybun/trybun/pull/124) Q11); the visible column header and card are used, as the runner already does for several elements with one target.

### Starting a tour: one view syntax, and only when its targets are there

- **View with a search condition** ([Q1](#open-questions)): a help page's `views` entry and a tour's `view` may end with `?name=value[&…]`, e.g. `/tickets?layout=board`. It matches a URL when the path matches (as today, `[param]` segments match any value) and every listed search parameter has exactly that value. For one URL, the matching entry with the most conditions wins, and an entry with a condition wins over the same route without one, so **Help for this view** on the board opens "Kanban board" and on the list "Ticket list". The generator's "a view claimed twice by one audience" compares whole entries. One matcher (`matchesView` of `features/help/help-routes.ts`) serves the help menu, the help generator and the tour runner, so there is still one way to name a view (Rule 12); `matchesView` and `helpPageOfPath` take the search parameters next to the path. This relies on the board always carrying `layout=board` in its URL, as #124 proposes (`list` is the default when the parameter is absent). Existing entries have no condition and behave as today, so nothing is migrated.
- **Automatic start waits for the targets** ([Q4](#open-questions)): a tour starts automatically only when the targets of all its required steps are rendered; until then nothing starts and nothing is recorded. While the view is open, the runner watches for the targets (a `MutationObserver` limited to the `data-tour` values of the tour, disconnected when the path changes or the tour starts), so the board tour starts once a project is chosen and its columns and cards have loaded; on an empty board it waits for a later visit with cards. A tour restarted from the help menu still starts at once, with a centred tip for a missing target, as in S0-10. A target belongs on an element that the view renders without user action – for a form, the field wrapper rendered with the first paint, never an element inside a lazily loaded component. `first_login` is unaffected: its targets are in the shell.

### Reference pages

S1-18 writes these pages in EN and PL, Diátaxis category by content ([Q5](#open-questions), [Q6](#open-questions), [Q7](#open-questions)). They name no `views`: the help of a view stays the page of that view, and links lead from there to the reference.

| Page (path under `docs/user/<language>/`) | Title EN / PL | Content (only what exists after Stage 1) |
|---|---|---|
| `end-user/reference/ticket-statuses.md` | Ticket statuses / Statusy zgłoszeń | The five public statuses with the descriptions of [§4.2](../../docs/spec/04-ticket-lifecycle.md); "Awaiting your reply" as the only moment to act; resolution confirmation (**Yes, solved** / **No, still a problem**, the e-mail links, automatic close after 7 days); commenting on a resolved ticket within 14 days reopens it, later and for closed tickets "Create a new ticket" ([§4.3](../../docs/spec/04-ticket-lifecycle.md)) |
| `team/reference/ticket-statuses.md` | Ticket statuses and the workflow / Statusy zgłoszeń i przepływ pracy | The nine internal statuses with their kind and the main flow; the mapping to public statuses with the descriptions end users see; initial statuses; waiting reasons and the automatic return after the requester's reply; reason for `rejected`, original for `duplicate` (no chains, reopening removes the link); resolution confirmation and its 7 days; reopening ([§4.1](../../docs/spec/04-ticket-lifecycle.md)–[§4.4](../../docs/spec/04-ticket-lifecycle.md)). Without GitHub, integrations and SLA (later stages) |
| `end-user/explanation/ticket-visibility.md` | Who can see your ticket / Kto widzi Twoje zgłoszenie | **Only me** as the default, **My organization** (only when organizations exist), **All customers** after the team's approval and the warning; what other customers see of a shared ticket and that they see you as "Customer"; narrowing your own ticket while it is not shared; comments keep the audience they were written for ([§5.1](../../docs/spec/05-visibility-and-search.md)–[§5.4](../../docs/spec/05-visibility-and-search.md)) |
| `team/explanation/ticket-visibility.md` | Ticket visibility and sharing / Widoczność i udostępnianie zgłoszeń | Effective visibility and the sharing request (`pending`, `rejected`); one approval by a project member, redaction before approving, refusal with a public reason; sharing a `my_organization` ticket on the team's initiative; never sharing `only_me` – the redacted copy and `duplicate` instead; comment audience; widening and narrowing rules; organization changes; why an invisible ticket shows "not found" ([§5.1](../../docs/spec/05-visibility-and-search.md)–[§5.4](../../docs/spec/05-visibility-and-search.md), [§7.3](../../docs/spec/07-users-organizations-permissions.md)) |
| `team/reference/roles-and-permissions.md` | Roles and permissions / Role i uprawnienia | The account kinds and the roles Developer, Project manager and Administrator ([§7.1](../../docs/spec/07-users-organizations-permissions.md), [§7.2](../../docs/spec/07-users-organizations-permissions.md)); the rows of [§7.5](../../docs/spec/07-users-organizations-permissions.md) whose feature exists after Stage 1, as a table with the four columns; archived projects are read-only for everyone; records you cannot see answer "not found" |
| `end-user/how-to/take-a-product-tour-again.md` | Take a product tour again / Ponowne uruchomienie przewodnika | The end-user counterpart of the team page of S0-10 – deferred by S0-10 until the first end-user tour ([S0-10 changelog](implemented/2026-10-24-product-tours.md)); **Take the tour** in the help menu, what skipping means ([Q10](#open-questions)) |

Rows of [§7.5](../../docs/spec/07-users-organizations-permissions.md) for later features (roadmap, SLA, GitHub, API tokens, labels, sub-tickets, "I have the same problem", saved views, triage queue) are left out until their task adds the feature; that task adds its row to the page in the same PR (Rule 3), as it adds its CASL rules ([plan](../../docs/plan/implementation-plan.md), "Cross-cutting parts grow with the features").

**Links** ([Q11](#open-questions)): S1-18 links the new pages from the pages that exist by then – the team "Getting started" tutorial, "Ticket view", "Ticket list", "Kanban board" (statuses, visibility, permissions); the end-user "Getting started", "Report a problem", "Follow your tickets" (statuses, visibility). The two getting-started tutorials name the tours of their audience and the help menu. "Report a problem" and "Create a ticket" gain one sentence that the Administrator maintains the templates of the form, as S1-17 expects ([#127](https://github.com/trybun/trybun/pull/127)).

### Every MVP view has a help page

**MVP view** ([Q8](#open-questions)): a route rendered inside the team application shell or the portal shell after Stage 1 – the views with the help menu. Routes outside both shells have no help menu and are not views in this sense: `/sign-in`, `/setup`, `/invitations/…` (S1-03), `/unwatch` (S1-15), `/deletion-requested` (S1-16).

**The check**: a unit test of `apps/web` (`features/help/view-coverage.spec.ts`) collects the routes from the `page.tsx` files of the shells' route groups, notes the shell from the route-group folder (`(team)` or `(portal)`) before removing it from the route (`[param]` kept), adds the layouts that are separate views without their own route (the board, `/tickets?layout=board`, declared in the test with the reason), and asserts for every route that a help page claims it in `views` for the readers of its shell:

- portal routes: a page of the audience `end-user`;
- team routes outside `/admin`: a page of the audience `team` or `end-user` (the team receives both) – never only an `administrator` page, which Developers and Project managers do not receive after S1-19;
- routes under `/admin`: a page of the audience `administrator`;
- a route rendered in both shells (e.g. `/settings`, if S1-03 builds one route for both): a page for the readers of each shell, which an `end-user` page satisfies;
- `/help`: the help index, `end-user` ("Search the help"); `/help/[...slug]` is a help page itself and is excluded.

The test also fails on a `views` entry or a tour `view` that matches no route, so a renamed route cannot leave its help or tour behind. Both languages are covered by the generator, which already fails on a page without its translation. The test reads the routes from the file system, so a later task that adds a view without a page fails `pnpm test` (Rule 3).

The expected result after Stage 1, from the sibling specifications (the test, not this table, is the authority):

| View | Help page | Written by |
|---|---|---|
| `/` (team home) | team tutorial "Getting started for the team" | S0-09 (exists) |
| `/tickets` | team reference "Ticket list" (predefined views incl. "Pending sharing approvals", bulk actions) | S1-13 [#123](https://github.com/trybun/trybun/pull/123) |
| `/tickets?layout=board` | team reference "Kanban board" | S1-14 [#124](https://github.com/trybun/trybun/pull/124) |
| `/tickets/new`, `/tickets/[identifier]` | team how-to "Create a ticket", reference "Ticket view" | S1-10 [#120](https://github.com/trybun/trybun/pull/120) |
| `/projects`, `/projects/[projectId]/settings` | S1-01's project pages, reference "Project settings" | S1-01 [#111](https://github.com/trybun/trybun/pull/111) |
| `/settings` | how-to "Change your language and time zone" (with S1-16's "Your data") | S1-03 [#113](https://github.com/trybun/trybun/pull/113), S1-16 [#126](https://github.com/trybun/trybun/pull/126) |
| `/admin`, `/admin/about` | administrator tutorial "Set up Trybun", reference "About Trybun" | S0-12 (exist) |
| `/admin/organizations`, `/admin/organizations/[id]` | administrator how-to "Manage organizations" | S1-02 [#112](https://github.com/trybun/trybun/pull/112) |
| `/admin/…` accounts | administrator reference "Accounts", how-to "Deactivate or reactivate an account" | S1-03 [#113](https://github.com/trybun/trybun/pull/113) |
| `/admin/…` deletion requests, data retention | administrator how-to "Handle a deletion request", "Set the retention period" | S1-16 [#126](https://github.com/trybun/trybun/pull/126) |
| `/admin/ticket-templates`, `/admin/ticket-templates/[id]` | administrator how-to "Edit ticket templates" | S1-17 [#127](https://github.com/trybun/trybun/pull/127) |
| `/portal` | end-user tutorial "Getting started" | S1-09 [#118](https://github.com/trybun/trybun/pull/118) |
| `/portal/projects/[projectId]`, `…/tickets/new` | end-user how-to "Report a problem" | S1-09 |
| `/portal/tickets`, `/portal/tickets/[identifier]`, `…/resolution-confirmation` | "Follow your tickets", "Confirm that your problem is solved" | S1-09 |
| `/help` | end-user how-to "Search the help" | S0-09 (exists) |

When S1-18 is implemented, any view the test reports without a page gets one in S1-18; the implementation PR lists these views and their new pages in its description, so the reviewer checks their content.

### E2E

- `product-tours.spec.ts` runs the target check per audience: team tours as the seeded team member, end-user tours as the seeded end user of the demo dataset (S1-09 gives it projects and tickets). It replaces the assertion "no tour is for end users" ([Q9](#open-questions)).
- A tour whose `view` has a `[param]` or needs data (the form of a project, a board with a project and cards) is opened at a concrete URL from the deterministic demo dataset: a map `TOUR_E2E_URLS: Record<ProductTourId, string>` in the E2E folder, so a new tour without an entry fails the type check. Optional targets are checked too, as today (the seeded accounts may perform all actions of the view).
- Two behaviour tests with axe: the portal help menu of the form offers "Take the tour: Creating a ticket" and runs it, on the three devices (the step 4 sheet at the top on a phone); the board tour does not start while the project picker is shown, and starts once a project is chosen, for the newcomer (Nina Newcomer, S0-10), whose progress is cleared before the test. The newcomer test runs in the `desktop` project only, like the newcomer test of S0-10, because the projects share the newcomer's server-side progress.
- The demo dataset records `create_ticket` and `kanban_board` as `completed` for the demo accounts (`PRODUCT_TOUR_VERSIONS`, [§18.5](../../docs/spec/18-code-patterns.md)), so other E2E tests and demos are not interrupted.

## Changes to the system specification

| Section | Change |
|---|---|
| §2.3 | A `views` entry may carry a search condition (`/tickets?layout=board`) and wins over the same route without one; every view of the team application and of the portal has a help page for its readers, checked by a unit test; routes outside the shells are not views |
| §2.4 | A tour starts automatically only when the targets of its required steps are rendered, which the runner watches for while the view is open; restarting from the help menu is unchanged |
| §18.5 "Product tours" | `view` uses the help view syntax including the search condition; targets on elements of the first paint; a tour opened with data in E2E gets its entry in `TOUR_E2E_URLS`; end-user tours are checked as the seeded end user |
| §18.5 (help) | The coverage test `features/help/view-coverage.spec.ts` and how a new view satisfies it |
| §18.9 | No change: S0-09 and S0-10 remain the reference implementations |
| Glossary | No new term (tour names are catalogue texts; "Board / Tablica" exists) |

`docs/user/README.md` (implementation PR) documents the search condition of `views` and the coverage test for writers.

## Open questions

Implementation must not start until every question has an answer. The answers below are proposals of an unattended run; each awaits human approval and is approved only by merging this specification.

1. ⚠ NEEDS HUMAN CONFIRMATION **How a help page and a tour name the board.** The board is `/tickets?layout=board` ([#124](https://github.com/trybun/trybun/pull/124) Q1, itself ⚠), but views match paths only, so S1-13's and S1-14's pages collide on `/tickets` and the board tour would start on the list. — **Answer (proposed, awaiting approval):** a `views` entry and a tour `view` may carry a search condition (`?layout=board`); an entry with a condition wins over the same route without one; one matcher for help and tours. S1-14 needs it first, for its help page (group 7), so S1-14 should add the matcher; S1-18 adds it only if S1-14 was implemented without it. This is proposed as an extension of the help and tour pattern of [§18.5](../../docs/spec/18-code-patterns.md), not a change: existing entries keep their meaning and nothing is migrated, so no ADR (Rule 12). If the maintainer counts it as a change, the implementation PR adds an ADR. If #124 Q1 is answered with a separate route (`/projects/{projectId}/board`), this question disappears and the tour uses that route.
2. **Which form gets "Creating a ticket".** — **Answer (proposed, awaiting approval):** the simplified portal form only, for end users: they create most tickets, often once, and the form is where they need guidance; S1-11 already placed `ticket-form-visibility` for this tour. The team's full form is covered by S1-10's how-to "Create a ticket"; a team tour (`create_ticket_team`, reusing the `ticket-form-*` targets) can follow if users ask for it.
3. **The steps and texts of both tours.** — **Answer (proposed, awaiting approval):** four steps each, as in the tables above (≤ 5 per [§2.4](../../docs/spec/02-agent-rules.md)); the card menu step of the board is optional.
4. **When a tour starts automatically.** S0-10 starts it when the view renders and centres a step whose target is missing; the board's project picker and an empty board would produce centred tips about absent elements. — **Answer (proposed, awaiting approval):** start automatically only when every required target is rendered, watching for the targets while the view is open; nothing is recorded before that, so on an empty board the tour waits for a later visit. Restarting from the help menu is unchanged. The `first_login` tour is unaffected (its targets are in the shell). Alternative: keep S0-10's behaviour and make every data-dependent step optional, which would let the board tour finish without ever showing its cards.
5. **Which pages S1-18 writes.** — **Answer (proposed, awaiting approval):** the five reference and explanation pages and the end-user how-to "Take a product tour again" in the table above, plus links and the two tutorials; no page of a view, since the siblings write those (#118 Q16, #120, #121 Q15, #122 Q17, #123, #124 Q17, #127). A view still without a page when S1-18 is implemented gets one in S1-18.
6. **Category of the visibility pages.** The plan says "reference pages for … visibility"; [§2.3](../../docs/spec/02-agent-rules.md) gives visibility as its example of an explanation ("how e.g. visibility or SLA works"). — **Answer (proposed, awaiting approval):** `explanation`, following the system specification; the statuses and permissions pages are `reference`. The plan's wording is read as "pages to look things up", not as the Diátaxis category.
7. **Audience and scope of the permissions page.** — **Answer (proposed, awaiting approval):** one `team` page (Developers and Project managers need to know who may do what; it holds no customer data), with only the rows of [§7.5](../../docs/spec/07-users-organizations-permissions.md) whose feature exists after Stage 1, since help describes only existing behaviour ([`docs/user/README.md`](../../docs/user/README.md)). End users get no permissions page: their rights are explained by the visibility and statuses pages. Each later task adds its rows to the page with its feature.
8. **What an "MVP view" is and how the Done-when is checked.** — **Answer (proposed, awaiting approval):** every route of the team and portal shells, plus the board layout; routes outside the shells (no help menu) are excluded. A unit test reading the route files enforces it now and for every later view, which turns Rule 3 for views into a CI gate. Alternative: a one-off review by S1-18 with no lasting check.
9. **E2E for end-user tours.** — **Answer (proposed, awaiting approval):** the target check signs in as the seeded end user for end-user tours; tours that need a concrete URL get it from `TOUR_E2E_URLS`, typed by tour ID; no new demo account (the newcomer of S0-10 covers the automatic-start test of the board).
10. **An end-user how-to for restarting tours.** — **Answer (proposed, awaiting approval):** yes, now that the first end-user tour exists, as S0-10 deferred it.
11. **Editing pages written by sibling tasks.** — **Answer (proposed, awaiting approval):** S1-18 only adds links to the new pages, the tours in the two tutorials, and the sentence about templates ([#127](https://github.com/trybun/trybun/pull/127)); it does not rewrite their content.
12. **One specification or two.** Tours and documentation could ship separately. — **Answer (proposed, awaiting approval):** one specification and one PR, as the plan row defines, built in phases; the board tour depends on the view syntax of Q1, which the coverage check of Q8 also uses. The runner change and the coverage check could ship alone, but they have no user-visible effect without the tours and pages, and Q1 moves the matcher to S1-14 anyway.

## Acceptance criteria

- [ ] Every view of the team application and of the portal has a help page in EN and PL: the coverage test passes, and fails when a page's `views` entry is removed.
- [ ] Both tours pass the E2E target check on phone, tablet and desktop.
- [ ] The board tour does not start while the project picker is shown and starts once a project is chosen; it never starts on the list layout.
- [ ] **Help for this view** opens "Kanban board" on `/tickets?layout=board` and "Ticket list" on `/tickets`.
- [ ] An end user can run "Creating a ticket" from the help menu of the portal form; axe finds no violations.
- [ ] The reference and explanation pages exist in EN and PL and describe only behaviour that exists after Stage 1; the tour texts match the merged forms and board.
- [ ] Works on phone, tablet and desktop (Rule 9).
- [ ] User documentation and product tours updated (Rules 3, 4); `docs/spec/` updated as in the table above (Rule 8).

## Implementation plan

Starts after the Stage 1 tasks of groups 1–7 and S1-17 are merged. Each step leaves the application working.

**Phase 0 – Check the merged siblings.** Before writing texts, compare the targets, labels and behaviour the tours and pages rely on (the `ticket-form-*` and `kanban-board-*` targets, **Move to**, the attachments field of the portal form, the board's URL) with the merged S1-09, S1-11 and S1-14; a difference is fixed in the texts, or raised on this specification if it changes a step.

**Phase 1 – Views and starting tours**

1. The search condition in `matchesView` and `helpPageOfPath` (search parameters next to the path; most conditions win), the generator's duplicate check on whole entries, the tour runner using the same matcher – unless S1-14 already added it ([Q1](#open-questions)). Unit tests: the board and the list resolve to different pages; a condition never matches a URL without the parameter; of two matching entries the one with more conditions wins.
2. Automatic start only with all required targets rendered, watching for them while the view is open ([Q4](#open-questions)). Component test of `ProductTourProvider`: no start with a missing required target, start when the target appears later; the observer is disconnected on a path change; restart from the help menu unchanged.
3. `features/help/view-coverage.spec.ts` ([Q8](#open-questions)), with the excluded routes and the board layout declared with reasons; it also fails on a view or tour `view` that matches no route. Pages for any view it reports without one.

**Phase 2 – Tours**

4. `create_ticket`: definition, ID in `productTourIdSchema`, `data-tour` on S1-09's form, texts in the `productTours` namespace (EN, PL), `PRODUCT_TOUR_VERSIONS`. E2E: target check as the end user, the help menu run, the phone sheet.
5. `kanban_board`: the same with S1-14's targets. E2E: target check; no start with the picker; start after choosing a project (newcomer).

**Phase 3 – Documentation**

6. The five reference and explanation pages and the end-user how-to, links from the existing pages, the tutorials, `pnpm help:generate`. Test: `pnpm lint` (help content up to date), the help search finds each new page in both languages. The PR description names, per page, the system specification sections and merged specifications it was checked against (the permissions page: every §7.5 row either on the page or listed as not yet built).
7. `docs/spec/` (§2.3, §2.4, §18.5) and `docs/user/README.md` as approved; this file moved to `implemented/`; `pnpm lint:spec`.

## Changelog

- 2026-10-26 – Created.
