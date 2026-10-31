# End-user portal – projects, ticket form, my tickets, ticket view and resolution confirmation

| | |
|---|---|
| Status | `draft` |
| Created | 2026-10-26 |
| Plan task | `S1-09` |
| System specification sections | §2.3, §2.4, §2.9, §3.1, §3.2, §3.3, §3.4, §4.1, §4.2, §4.3, §4.4, §4.5, §5.1, §5.4, §5.5, §5.7, §7.1, §7.3, §7.5, §17.2, §18.5, glossary |
| Related issues / PRs | Sibling specifications: S1-01 projects ([#111](https://github.com/trybun/trybun/pull/111)), S1-03 invitations and accounts ([#113](https://github.com/trybun/trybun/pull/113)), S1-04 permission layer ([#114](https://github.com/trybun/trybun/pull/114)), S1-05 ticket model ([#115](https://github.com/trybun/trybun/pull/115)), S1-06 statuses ([#116](https://github.com/trybun/trybun/pull/116)), S1-07 GFM editor ([#117](https://github.com/trybun/trybun/pull/117)); S1-08 attachments, S1-10 team ticket view and S1-11 visibility (written in parallel) |

## Context

End users are the customers of the teams that run Trybun. They report problems and follow them until they are solved ([§5.7](../../docs/spec/05-visibility-and-search.md)). Today an end user who signs in sees the empty home page of Stage 0 inside the team's application shell, and its help menu. No view creates, lists or shows a ticket.

S1-09 builds the **end-user portal**, the part of the web application where end users work:

- the portal root with the user's projects,
- the project home,
- the simplified ticket form with the visibility switch and the template placeholder ([§3.3](../../docs/spec/03-ticket-model.md), [§3.4](../../docs/spec/03-ticket-model.md)),
- "My tickets",
- the ticket view with the public status and the public timeline ([§4.2](../../docs/spec/04-ticket-lifecycle.md), [§4.5](../../docs/spec/04-ticket-lifecycle.md)),
- the resolution-confirmation actions ([§4.3](../../docs/spec/04-ticket-lifecycle.md)),
- the help of [§2.3](../../docs/spec/02-agent-rules.md) in the portal: the help icon in the portal header, and the help pages (`/help`) in the portal layout.

Out of scope according to the plan (→ S2-02/S2-03): similar tickets while typing, and the portal search.

The plan's "Done when" for S1-09:

- A user with one project lands directly in it after sign-in.
- A ticket is created in at most 2 steps from the project home.
- Internal events never appear in the end-user view.

The portal is built on the APIs of the sibling tasks, as proposed in their specifications: projects and memberships (S1-01), end-user access through organizations and invitations (S1-02, S1-03, S1-04), tickets and activity events (S1-05), public statuses and the requester's answer (S1-06), the editor (S1-07) and attachments (S1-08). S1-11 (visibility) is in the same group 5 as S1-09. S1-12 (comments) and S1-15 (watchers, e-mails) come later.

Reading §5.7 against the plan and the sibling proposals found gaps that the specification does not decide. Some are about the routes, some about the public status description, and some about which task owns which part of the ticket view. Agents may not decide them (Rule 8), so each one is listed under [Open questions](#open-questions) with a proposed answer for a human to accept, change or reject. The design below already assumes the proposed answers.

## Goals

- An end user reaches the place to report a problem without choosing anything they do not need. With one project they land in it directly after sign-in. Creating a ticket from the project home takes two steps: **Create ticket**, then **Submit**.
- An end user follows their tickets in one list. Tickets that need their reply come first and stand out ([§4.4](../../docs/spec/04-ticket-lifecycle.md)).
- The ticket view shows only what [§3.2](../../docs/spec/03-ticket-model.md) gives to end users: the identifier, title, description, attachments, public status with its description, and the public timeline. Internal statuses, internal events, priority, type and assignee never reach the browser. The API leaves them out of the response; the UI does not hide them.
- The requester answers "Is your problem solved?" with one press in the ticket view, or on the confirmation page that the e-mail's signed links open (S1-15).
- End users never see the team's application shell, and team members never see the portal ([§5.7](../../docs/spec/05-visibility-and-search.md)). The help works the same in both.
- Every view works from 360 px with 44 px touch targets (Rule 9), in EN and PL, with keyboard and screen reader ([§13.4](../../docs/spec/13-non-functional.md)).

## Non-goals

- Portal search, the large search field and Ctrl+K (S2-03). Similar tickets while typing and "I have the same problem" (S2-02). The project home in S1-09 has no search field and no placeholder for one ([Q5](#open-questions)).
- Comments: the comment field, the requester's reply that ends `waiting_for_requester` with reason `information`, and "Create a new ticket" instead of the comment field on terminal tickets (S1-12). Editing the title and description, and the edit history (S1-12) ([Q12](#open-questions)).
- The visibility rules, the sharing request, the warning text and the available options. These belong to S1-11. S1-09 places the switch in the form ([Q8](#open-questions)).
- Upload, scanning and serving of attachments (S1-08). S1-09 uses S1-08's attachment field and list in its form and its view.
- Watched tickets in "My tickets", the acknowledgement e-mail for a new ticket, notifications, and the signed links of the confirmation e-mail (S1-15) ([Q10](#open-questions), [Q14](#open-questions)).
- Identities of other customers ("Customer", [§5.4](../../docs/spec/05-visibility-and-search.md)) in tickets of other people (S1-11). Until S1-11, an end user sees only the tickets they requested (S1-05 Q2).
- Administrator-managed ticket templates (S1-17). S1-09 shows the placeholder from the message catalogues ([Q9](#open-questions)).
- The "Creating a ticket" tour (S1-18) and the reference pages for statuses and visibility (S1-18) ([Q16](#open-questions)).
- Administrator-only help pages (S1-19).

## Proposed change

### Routes and shells

The portal is the route group `(portal)` of [§18.5](../../docs/spec/18-code-patterns.md), under the path prefix `/portal` ([Q1](#open-questions)):

| Route | View |
|---|---|
| `/portal` | Portal root: the user's active projects; a server redirect to the project home when there is exactly one |
| `/portal/projects/{projectId}` | Project home: **Create ticket** and "My tickets" of that project |
| `/portal/projects/{projectId}/tickets/new` | Simplified ticket form |
| `/portal/tickets` | "My tickets" across all projects |
| `/portal/tickets/{identifier}` | Ticket view (`ERP-12`, resolved with `GET /api/v1/tickets?identifier=`, S1-05 Q12) |
| `/portal/tickets/{identifier}/resolution-confirmation?answer=solved\|not_solved` | Confirmation page of the resolution answer ([Q14](#open-questions)) |
| `/help`, `/help/…` | Help pages (S0-09), in the shell of the reader's account kind ([Q2](#open-questions)) |

**Account kind decides the shell** ([§18.5](../../docs/spec/18-code-patterns.md): "the account kind returned by the API decides only between the portal and the team views"). The decision happens on the server, from the prefetched current account (`GET /api/v1/users/me`). It only shapes the UI: the API still decides every access ([§14.4](../../docs/spec/14-architecture.md)).

- An end user who opens a team route is redirected to its portal counterpart. `/` goes to `/portal`, and `/tickets/{identifier}` (S1-10) goes to `/portal/tickets/{identifier}`. Other team routes go to `/portal`.
- A team member who opens a portal route is redirected to the team counterpart. `/portal/tickets/{identifier}` goes to `/tickets/{identifier}` once S1-10 has built that route (until then to `/`), and every other portal route goes to `/` ([§5.7](../../docs/spec/05-visibility-and-search.md), last bullet).
- A sign-in started from a deep link returns to that link (the `callbackUrl` of `requireSession`, S0-05), so a ticket link from an e-mail opens the ticket after sign-in. A plain sign-in returns to `/`, so an end user goes `/` → `/portal`, and from there to the only project, if there is just one. Accepting an invitation lands on the home of the invited project, `/portal/projects/{projectId}` (S1-03, ADR 0009). For an organization invitation it lands on `/portal`, as AQ4 of the [invitation acceptance specification](2026-10-25-invitation-acceptance.md) proposes.

The **portal shell** reuses the `AppShell` of S0-08 with portal navigation ([Q3](#open-questions)):

- **Projects** (`/portal`) and **My tickets** (`/portal/tickets`), in the bottom navigation on phones and the side navigation from tablets on. **Projects** is shown only when the user has more than one active project.
- The header has the brand, the help menu, and the user menu with **Account settings** (S1-03) and **Sign out**. It has no command palette and no notification bell (S1-15 adds the bell).
- `ProductTourProvider` runs in the portal shell too, so S1-18 can add the "Creating a ticket" tour without touching the layout.

### Portal root

`GET /api/v1/projects?state=active` (S1-01) returns the projects the end user can read: those of their organization and those they were invited to personally (S1-04). The list shows each project's name as a large card (one column on phones, two from tablets on).

- **Exactly one active project**: a server redirect (`307`) to its project home, without rendering the list. Archived projects do not count, so one active and several archived projects also redirect.
- **No active project** (also when the only project is archived): an empty state saying "You don't have access to any project yet. Ask the person who invited you to add you to one." (PL: „Nie masz jeszcze dostępu do żadnego projektu. Poproś osobę, która Cię zaprosiła, o dodanie do projektu.”), with a link to "My tickets" when the user has tickets in archived projects ([Q4](#open-questions)).
- Archived projects are not listed. Their tickets stay in "My tickets", read-only ([Q4](#open-questions)).

### Project home

- The project name as `h1`.
- **Create ticket** (PL: „Utwórz zgłoszenie”) is the primary button. On phones it is full width, right below the name. It is shown when the project's `allowedActions` contains `create_ticket` (S1-05). An archived project shows the read-only banner of S1-01 instead.
- **My tickets** of this project: the first 10 items of the [My tickets list](#my-tickets) filtered by the project, with **Show all** linking to `/portal/tickets?projectId=…`.
- No search field until S2-03 ([Q5](#open-questions)).

### Simplified ticket form

The route `/portal/projects/{projectId}/tickets/new` is a page, not a dialog ([Q6](#open-questions)). Its fields are those of [§3.3](../../docs/spec/03-ticket-model.md):

1. **Title**: a text field, required, 1–255 characters (S1-05 Q4).
2. **Description**: the `MarkdownEditor` of S1-07, loaded through `lazy-markdown-editor.tsx`. Its placeholder is the end-user template of [§3.4](../../docs/spec/03-ticket-model.md) in the creator's language, three lines that disappear when typing starts ([Q9](#open-questions)):

   ```
   What happened?
   What did you expect?
   How can we reproduce it?
   ```

3. **Attachments**: S1-08's attachment field (drafts linked at creation). It is optional and adds no step.
4. **Visibility**: a small switch below the description, default **Only me**. It shows only the options the API returns, and the one-sentence warning when **All customers** is chosen ([§5.1](../../docs/spec/05-visibility-and-search.md)). The options, the rules and the stored fields belong to S1-11 ([Q8](#open-questions)).
5. **Submit** (PL: „Wyślij”) and **Cancel**. On phones the buttons sit at the bottom of the form and keep the safe area (`pb-safe-offset-*`).

The form follows [§18.5](../../docs/spec/18-code-patterns.md) "Forms": React Hook Form with `createTicketSchema` of `@trybun/contracts/tickets` (S1-05; S1-11 adds `visibility`), the `Field` components, and the mutation hook `useCreateTicket` in `features/tickets/mutations.ts`. The hook sends an `Idempotency-Key` generated when the form opens, so a double press or a retry after a timeout creates one ticket (S1-05). After success, the browser goes to `/portal/tickets/{identifier}` and a toast says "Ticket ERP-12 created". The acknowledgement e-mail comes with S1-15.

**Steps from the project home**: (1) **Create ticket**, (2) fill in the title (and optionally more), **Submit**. This meets the "Done when". The E2E test counts navigations and presses.

### My tickets

`/portal/tickets` lists the tickets the user is involved in. In S1-09 that means the tickets they requested; S1-15 adds the tickets they watch ([Q10](#open-questions)). It uses a new list parameter of S1-05's endpoint:

- `GET /api/v1/tickets?involvement=mine&projectId?&cursor&limit`: tickets the principal requested, within what `accessibleBy(ability, 'read')` returns. The order is fixed: tickets with public status `awaiting_reply` first, then by `updatedAt` descending, then `id`. The cursor envelope of [§18.4](../../docs/spec/18-code-patterns.md) applies. The parameter is not limited to end users; the team may use it too.
- Each item shows the identifier, title, project name (in the list across projects), public status badge and "updated" time in the user's locale and time zone. Items with `awaiting_reply` carry the highlighted badge "Awaiting your reply" (PL: „Wymaga Twojej odpowiedzi”), are grouped under that heading, and carry an icon besides the colour, so the state does not rely on colour alone ([§13.4](../../docs/spec/13-non-functional.md)).
- `projectId` in the URL search parameters (Zod schema in `features/tickets/search-params.ts`) filters by project. Infinite scrolling uses `infiniteQueryOptions` with **Load more** as the keyboard and screen-reader alternative.
- Empty state: "You haven't created any tickets yet." with **Create ticket** when the filtered project allows it.

### Ticket view

`/portal/tickets/{identifier}` shows:

- the identifier, title and description (rendered with `Markdown` of `@trybun/ui`, S1-07, with the ticket's attachment images), and the attachments (S1-08);
- the **public status** badge and its description ([§4.2](../../docs/spec/04-ticket-lifecycle.md)), for example "We are testing the solution". It comes from a new end-user response field, `publicStatusDescription` ([Q11](#open-questions)). For `duplicate` it adds the link to the original when the API returns `duplicateOf` (S1-06);
- the **resolution-confirmation panel** when `allowedActions` contains `confirm_resolution` (S1-06): "Is your problem solved?" with **Yes, solved** and **No, still a problem**, both full width on phones. Each button calls `POST /api/v1/tickets/{ticketId}/resolution-confirmation` through `useConfirmResolution` and shows a toast with the result. A `409 ticket.resolution_confirmation_not_pending` (the team or the timer answered first) shows its translated message and reloads the ticket. The panel sits above the description, because this is the only moment the user has to act ([§4.4](../../docs/spec/04-ticket-lifecycle.md));
- the **public timeline**: the ticket's creation as its first item ("You created this ticket", as on GitHub, S1-05 Q11), then the public events from `GET /api/v1/tickets/{ticketId}/activity-events` (S1-05), oldest first. In Stage 1 the public events are the public status changes of S1-06, shown as "Status changed to In progress" with the actor's display name or "System" for automatic events. The end-user event response carries only public status codes ([Q11](#open-questions)), so no internal code reaches the browser. S1-12 interleaves the public comments, and S4 adds public milestones;
- an archived project's read-only banner (S1-01). `allowedActions` then lists no action, so the panel does not appear.

An invisible ticket, or one of a project the user lost access to, returns `404` from the API, and the page calls `notFound()` ([§18.5](../../docs/spec/18-code-patterns.md)). The data of the view is prefetched on the server and hydrated (`['tickets', 'detail', id]`, `['activity-events', 'list', ticketId]`), so the first paint has the content (Lighthouse budget, [§2.9](../../docs/spec/02-agent-rules.md)).

### Resolution-confirmation page

`/portal/tickets/{identifier}/resolution-confirmation?answer=solved|not_solved` is the page that the e-mail's signed links open (S1-06 [#116](https://github.com/trybun/trybun/pull/116), its Q11). It shows the ticket's identifier and title, the question, the chosen answer as one large button ("Yes, solved" or "No, still a problem"), and a smaller link to the other answer. Nothing changes until the button is pressed (`POST`), so link scanners in mail systems cannot trigger the change ([§4.3](../../docs/spec/04-ticket-lifecycle.md)). After the answer, or when the ticket no longer waits for confirmation, the page shows the result and a link to the ticket.

In S1-09 the page works for the signed-in requester. S1-15 adds the signed token, carried in the URL fragment because tokens never go into URLs ([§17.2](../../docs/spec/17-conventions.md)), and the token-authorized `POST`, on this same page ([Q14](#open-questions)).

### Help in the portal

- The help icon in the portal header opens the same `HelpMenu` as in the team shell: **Help for this view**, **All topics**, and the tours of the view. End users receive only the `end-user` pages ([§2.3](../../docs/spec/02-agent-rules.md)).
- `/help` moves out of `(team)` into its own segment, `app/help/`. Its layout renders the portal shell for end users and the team shell for team accounts ([Q2](#open-questions)). The addresses `/help/<audience>/<category>/<name>` do not change.
- The `views` of the end-user pages name the portal routes: `getting-started` changes from `/` to `/portal`, and the new how-to pages name their views ([Q16](#open-questions)).

### API and contracts

Owned by S1-09, built on S1-05 and S1-06:

| Change | Where |
|---|---|
| `involvement=mine` on `GET /api/v1/tickets`, with the fixed order above | `listTicketsQuerySchema` of `@trybun/contracts/tickets`; `TicketsService.list` |
| `publicStatusDescription` on `endUserTicketSchema`: a closed enum `publicStatusDescriptionSchema` with one code per row of [§4.2](../../docs/spec/04-ticket-lifecycle.md) (`received`, `analyzing`, `information_needed`, `confirmation_needed`, `scheduled`, `working`, `testing`, `resolved`, `rejected`, `merged`), mapped by `publicStatusDescriptionOf(status, waitingReason)` next to S1-06's `publicStatusOf` | `@trybun/contracts/tickets`, unit test over all combinations |
| `endUserActivityEventSchema`: for `status_changed`, `data` is `{ from, to }` **public** status codes, with `actor { id, displayName } \| null` and `automaticSource`. Events with `isPublic = false` are never returned to end users (S1-05) | `@trybun/contracts/activity-events`; the controller chooses the schema by account kind, as for tickets |
| End-user project response `endUserProjectSchema`: `id`, `name`, `key`, `state`, `allowedActions`, without `confirmResolution`, `version` and the member data | `@trybun/contracts/projects` ([Q7](#open-questions)) |

No new table, no migration, no outbox event and no new permission rule: every action used is defined by S1-04, S1-05 and S1-06. Integration tests check that an end-user response never contains `status`, `priority`, `type`, `assignee`, `source`, `organization` or an internal event, by parsing the response with the strict end-user schemas.

### Texts

The `portal` namespace of `@trybun/i18n` (EN, PL) holds the navigation, the headings, the empty states, the toasts, the confirmation page and the template placeholder ([Q9](#open-questions)). The status labels, the descriptions and the answers come from the `tickets` namespace (S1-06).

### Prior art

- **Jira Service Management**: the help center lists the service projects a customer can reach, and opens the only one directly. The portal home leads to "Raise a request", and "Requests" lists the customer's requests, with a filter for "Created by me" and "Where I'm a participant". This matches the root redirect, the project home, and "My tickets" with S1-15's watched tickets.
- **Zendesk help center**: "My activities" separates "My requests" from "Requests I'm CC'd on", and the request page shows the public conversation only, never internal notes. Like Trybun, Zendesk lets the requester mark a request as solved from the request page.
- **GitHub issues**: the issue body is the first item of the timeline, without a separate "created" event (S1-05 Q11).
- What these portals carry that S1-09 skips: request types with their own forms (Trybun has one universal form and template, [§3.4](../../docs/spec/03-ticket-model.md)), and a knowledge base (help pages are product documentation, not customer articles).

## Changes to the system specification

| Section | Change |
|---|---|
| §5.7 | Portal routes under `/portal`; the redirects between portal and team views by account kind (Q1) |
| §5.7 | Portal root: only active projects; the redirect counts active projects; the empty state without projects (Q4) |
| §5.7 | Project home without a search field until the portal search exists (Q5) |
| §5.7 | "My tickets" lists requested tickets, and watched ones once watching exists; `awaiting_reply` first, then last updated (Q10) |
| §4.2 | The description shown to the user is a code of the API response, so the internal status never reaches end users (Q11) |
| §4.3 | The confirmation page of the signed links is `/portal/tickets/{identifier}/resolution-confirmation`; the token is in the URL fragment (Q14) |
| §18.5 | Layout: `app/help/` outside the route groups, with a layout choosing the shell by account kind (Q2) |
| Plan | S1-12: the portal comment field, the terminal-ticket replacement and editing of the description in the portal (Q12). S1-15: watched tickets in "My tickets" and the token on the confirmation page (Q10, Q14). S2-03: the search field of the project home (Q5). S1-18: the documentation of S1-09's views exists already (Q16). The maintainer changes the plan |

New or changed glossary terms (code identifier, EN/PL labels):

- End-user portal – `portal` – End-user portal / Portal użytkownika: the part of the web application for end users ([§5.7](../../docs/spec/05-visibility-and-search.md)).
- Project home – Project home / Strona projektu.
- My tickets – `involvement=mine` – My tickets / Moje zgłoszenia.
- Public status description – `public_status_description` – the codes of Q11 with the descriptions of §4.2.

## Open questions

Implementation must not start until every question has an answer. Each answer below is a **proposal awaiting human approval**, chosen as the smallest and most reversible option. Answers marked ⚠ fix a public URL or change a sibling's shared contract, and need explicit confirmation.

1. ⚠ **Portal routes.** Next.js route groups cannot serve the same path twice, and `/` and `/help` already live in `(team)`. §5.7 names the views but not their paths. The ticket links of S1-15's e-mails will make the paths public. — **Answer (proposed, awaiting approval):** the portal lives under `/portal` (table under [Routes and shells](#routes-and-shells)). Server redirects by account kind connect the two sides: `/` → `/portal` and `/tickets/{identifier}` → `/portal/tickets/{identifier}` for end users, and the reverse for the team. E-mails link to the route of the recipient's kind. Projects are addressed by ID, because the key filter would be a new API filter. Alternatives: (a) the same paths for both kinds, with one layout per route that picks the shell (no redirects, but every route mixes two views); (b) the project key in the URL (`/portal/ERP`), which reads better but needs `GET /api/v1/projects?key=`.
2. **`/help` in the portal layout.** The plan wants the help pages "in the portal layout", but they live in `(team)`. — **Answer (proposed, awaiting approval):** move `app/(team)/help/` to `app/help/`. Its layout renders the portal shell for `end_user` and the team shell for `team`. The addresses do not change, and the pages and search indexes of S0-09 stay as they are.
3. **Portal shell.** — **Answer (proposed, awaiting approval):** reuse `AppShell` (header, bottom and side navigation) with portal navigation items, instead of a second shell (Rule 12). The navigation items of the portal (**Projects**, **My tickets**) are a second list in `features/app-shell/navigation.ts`, chosen by account kind. **Projects** is hidden with fewer than two active projects, from the project list of the layout.
4. **Projects on the portal root.** §5.7 says "lists the projects the user has access to" and "exactly one project" redirects. It does not say what archived projects or no project mean. — **Answer (proposed, awaiting approval):** only active projects are listed and counted. Archived projects cannot take new tickets, and their tickets stay reachable from "My tickets", read-only. With no active project, the root shows the empty state, plus a link to "My tickets" when the user has tickets.
5. **Search field before S2-03.** §5.7 puts the large search field on the project home, and the plan moves the portal search to S2-03. — **Answer (proposed, awaiting approval):** no field and no placeholder until S2-03. A field that does nothing would cost the user a step (Rule 2). S2-03 adds the field and Ctrl+K to the project home of S1-09.
6. **Form as a page or a dialog.** — **Answer (proposed, awaiting approval):** a page (`…/tickets/new`). On phones a description with attachments needs the full height, the URL survives a reload, and the back button works. The step count is the same as with a dialog: **Create ticket**, **Submit**.
7. **What end users receive for a project.** S1-01's project response carries settings (`confirmResolution`) and the version for the team's settings page. — **Answer (proposed, awaiting approval):** an end-user project response with `id`, `name`, `key`, `state` and `allowedActions`, chosen by account kind like S1-05's ticket responses. End users never see settings they cannot change.
8. **Boundary with S1-11 (visibility switch).** The plan gives the switch to S1-09 and the visibility field, its rules and the warning to S1-11, and both are in group 5. Which options are "meaningful" (§5.1) depends on the user's organization and on whether any organization exists, so the web application must not compute them (§14.4). — **Answer (proposed, awaiting approval):** S1-11 owns `visibility` in `createTicketSchema`, the rules, the warning text and the API field that lists the options a person may choose for a project. S1-09 places the switch below the description and renders exactly those options. Whichever of the two is merged second wires the switch into the form. Until then the form creates `only_me` tickets, the default of §5.1 and S1-05 Q2. S1-11's specification decides where the options come from (S1-09 suggests a field on the project response for the principal; if S1-11 chooses it, S1-11 adds it to `endUserProjectSchema`).
9. **Template placeholder before S1-17.** §3.4 makes the end-user template a managed template with language versions, and the management comes with S1-17. — **Answer (proposed, awaiting approval):** S1-09 takes the three lines of §3.4 from the `portal` catalogue in the creator's language. S1-17 moves them into the managed template and replaces the source of the placeholder. The text is the same, so users see no change.
10. **"My tickets" before watching exists.** §5.7 lists tickets the user "created or watches", and watchers come with S1-15. — **Answer (proposed, awaiting approval):** the list parameter `involvement=mine` (a public API parameter, available to every principal, because it filters only within what the principal may read) covers requested tickets in S1-09, and S1-15 widens it to watched ones without a new parameter. "First and highlighted" for `awaiting_reply` is one fixed order of the endpoint (`awaiting_reply` first, then `updatedAt` descending), so pagination stays one cursor. Alternative: two requests (an "Awaiting your reply" section and the rest), which duplicates the paging.
11. ⚠ **Public status description and public events.** §4.2 gives a description per internal status (for example "We are testing the solution" for `in_verification`). S1-06's end-user response carries only `publicStatus` and `waitingReason`, which cannot tell `todo`, `in_progress` and `in_verification` apart. S1-06's `status_changed` event stores internal codes, which must never reach end users. — **Answer (proposed, awaiting approval):** the end-user ticket response gains `publicStatusDescription`, a closed enum with one code per row of §4.2, mapped in `@trybun/contracts` next to `publicStatusOf`. The end-user event response maps `status_changed` data to public codes. Both are additions to the end-user schemas, which S1-06 leaves to S1-09. The descriptions are meant for users (§4.2), so revealing the stage this way is intended. Revealing the internal codes is not.
12. **Comments and editing in the portal.** §5.7 lists the comment field in the ticket view, and §7.5 lets end users edit their own title and description. The plan gives neither to S1-09; comments and editing with history are S1-12. — **Answer (proposed, awaiting approval):** the S1-09 ticket view has no comment field and no edit action. S1-12 adds both to the view, together with "Create a new ticket" instead of the field on terminal tickets (§4.3). Until S1-12, a requester whose ticket waits for information sees the description "We need more information from you" without a way to reply in the portal, and a `rejected` ticket shows "Ticket closed" without the reason, which S1-12 publishes as a public comment (S1-06 Q2). Both gaps last one plan group.
13. **One specification or several.** The plan row bundles the portal shell, the form, the list, the view and the confirmation. — **Answer (proposed, awaiting approval):** one specification and one plan task, delivered in the phases below, possibly as one PR per phase. None of the views is useful alone: a form without a view of the result, or a list without tickets, does not let an end user report and follow a problem.
14. **The confirmation page before S1-15.** S1-06 (its Q11) proposes that S1-09 builds the page the signed links open, and that S1-15 designs the link token and the token-authorized `POST`. — **Answer (proposed, awaiting approval):** S1-09 builds the page at `/portal/tickets/{identifier}/resolution-confirmation?answer=…` for the signed-in requester, using S1-06's `POST`. S1-15 adds the token in the URL fragment (§17.2), the request without a session, and the e-mail. The answer in the query string is not a secret. The page never changes anything on `GET`.
15. **Team members and end users on the wrong side.** §5.7 says team members who open the portal see the team views. — **Answer (proposed, awaiting approval):** server redirects in the layouts of `(portal)` and `(team)`, built on the prefetched current account, with the counterparts of Q1. `proxy.ts` makes no kind decision ([§18.5](../../docs/spec/18-code-patterns.md): optimistic checks only). After S1-09 an end user never renders the team shell.
16. **User documentation and S1-18.** Rule 3 delivers documentation with the feature. The plan's S1-18 has "user documentation for all MVP views". — **Answer (proposed, awaiting approval):** S1-09 writes the end-user how-to pages for its views, in EN and PL, with `views`: "Report a problem" (`/portal/projects/[projectId]`, `…/tickets/new`), "Follow your tickets" (`/portal/tickets`, `/portal/tickets/[identifier]`) and "Confirm that your problem is solved" (`…/resolution-confirmation`). It also updates the end-user "Getting started" tutorial. S1-18 adds the reference pages (statuses, visibility, permissions) and the tours, and checks that every MVP view has a page.

## Implementation plan

Each step leaves the application working and has its tests. Implementation starts after S1-01, S1-03, S1-04, S1-05, S1-06 and S1-07 are merged. S1-08 is needed for step 5, S1-11 for the switch ([Q8](#open-questions)), and S1-10's team ticket route for the redirect of a team member from a portal ticket ([Q1](#open-questions)).

**Phase 1 – Shell and routing**

1. Portal navigation in `features/app-shell/navigation.ts`; the `(portal)` layout with `AppShell`, the help menu and `ProductTourProvider`; `app/help/` with the shell chosen by account kind ([Q2](#open-questions)). Unit tests for the navigation per kind. Story for the portal shell on the three viewports. A test that every existing `/help/…` address still resolves for both account kinds, in the shell of the kind, and that a `team` page still answers "not found" to an end user.
2. Redirects by account kind in the `(portal)` and `(team)` layouts and pages ([Q1](#open-questions), [Q15](#open-questions)). Table-driven unit test of the route mapping over every route of the table, for both account kinds. E2E: an end user opening `/` lands on `/portal`; a team member opening `/portal/tickets/X` lands on `/tickets/X` (or `/` before S1-10).
3. End-user project response ([Q7](#open-questions)); portal root with the one-project redirect, the list and the empty state. Integration test: an end user receives the reduced schema. E2E on phone, tablet and desktop with axe: **a user with one project lands directly in it after sign-in**; a user with two sees the list.

**Phase 2 – Creating a ticket**

4. Project home with **Create ticket** (by `allowedActions`) and the archived banner; the form page with title, `MarkdownEditor` with the placeholder, `useCreateTicket` with `Idempotency-Key`, the redirect and the toast. E2E: **a ticket is created in at most 2 steps from the project home** (counted presses and navigations); the placeholder disappears when typing; field errors from `422` appear at their fields.
5. S1-08's attachment field in the form; the visibility switch, once S1-11's API exists ([Q8](#open-questions)). E2E: a ticket with an image attachment; the switch shows only the options of the API.

**Phase 3 – Following tickets**

6. `involvement=mine` with the fixed order, in contracts, service and tests ([Q10](#open-questions)). Integration tests: only requested tickets; `awaiting_reply` first; the cursor is stable across pages; another end user's ticket never appears.
7. `publicStatusDescription` and `endUserActivityEventSchema` ([Q11](#open-questions)). Unit test of the mapping over every status and waiting reason. Integration tests: an end-user response parses with the strict schema and has no internal field; **an internal event (title or priority change) never appears in the end-user list of events**; a public status change appears with public codes only.
8. "My tickets" (across projects and on the project home), and the ticket view with the public status, the description, the attachments and the public timeline. E2E with axe on the three devices: the highlighted `awaiting_reply` item comes first; the timeline of a ticket whose priority and internal status changed shows only the public status changes.

**Phase 4 – Resolution confirmation**

9. The confirmation panel in the ticket view, and the confirmation page ([Q14](#open-questions)), with `useConfirmResolution`. E2E: **Yes, solved** moves the ticket to "Resolved"; the page changes nothing until the button is pressed; an answer after the team closed the ticket shows the `409` message.

**Phase 5 – Documentation and data**

10. The how-to pages and the updated tutorial in EN and PL, `views` of the end-user pages, `pnpm help:generate` ([Q16](#open-questions)). The demo dataset gives the demo end user one project with tickets in each public status, one waiting for confirmation, and a second end user with two projects. `pnpm api:generate`.
11. Update §4.2, §4.3, §5.7, §18.5 and the glossary as approved; move this file to `implemented/`.

## Acceptance criteria

- [ ] A user with exactly one active project lands on its project home after sign-in (a `307` without the list); with two or more they see the list; with none, the empty state
- [ ] From the project home, a ticket is created in at most 2 steps (**Create ticket**, **Submit**); the new ticket opens with a toast; a double submit creates one ticket
- [ ] Optional attachments can be added in the form; the visibility switch, once wired (Q8), shows only the options the API returns
- [ ] An archived project shows the read-only banner and no **Create ticket**; an invisible ticket shows the not-found page
- [ ] The description shows the end-user template as a placeholder in the user's language, and it disappears on typing
- [ ] Internal events and internal fields never appear in the end-user view: end-user responses parse with the strict end-user schemas, the event list holds public events only, and the status events carry public codes only
- [ ] The ticket view shows the public status with its §4.2 description, including the distinction between scheduled, working and testing
- [ ] "My tickets" lists the requested tickets with `awaiting_reply` first and highlighted (not by colour alone), across projects and per project
- [ ] The requester answers the resolution question from the ticket view and from the confirmation page; the page changes nothing on `GET`; a late answer shows the `409` message
- [ ] An end user never sees the team shell, and a team member never sees the portal; both follow the redirects of Q1
- [ ] The help icon in the portal header opens the end-user help; `/help` renders in the portal shell for end users
- [ ] Works on phone, tablet and desktop (Rule 9): every portal view has an E2E test on the three devices with axe and the 44 px touch-target check
- [ ] User documentation and product tour updated where relevant (Rules 3, 4): the how-to pages of Q16 in EN and PL; no tour in S1-09, since "Creating a ticket" comes with S1-18, but the portal shell runs the tour provider

## Changelog

- 2026-10-26 – Created.
