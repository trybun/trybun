# Ticket list filters: every option beyond one page

| | |
|---|---|
| Status | `draft` |
| Created | 2026-11-10 |
| Plan task | – (follow-up of `S1-13`) |
| System specification sections | §8.1, §18.5 |
| Related issues / PRs | #272, #270, [S1-13 spec](implemented/2026-10-26-team-list-view.md) |

## 📝 TLDR

People who filter the team's ticket list (§8.1) choose projects, organizations and assignees from option lists that today load **one page of at most 100 entries** per list and stop there. Proposed: the web application follows `nextCursor` until every option is loaded, up to a bound of 20 pages (2,000 entries) per list, so every project, organization and member the person can see can be chosen and its chip shows its name. No API, contract or schema change.

## 📝 Problem Statement

`apps/web/src/features/tickets/queries.ts` reads the options of the filter panel with one request per list:

- `projectFilterOptionsQueryOptions` – one page of 100 active and one of 100 archived projects;
- `organizationFilterOptionsQueryOptions` – one page of 100 active and one of 100 archived organizations;
- `assigneeFilterOptionsQueryOptions` – one page of 100 members per chosen project.

Beyond 100 entries the rest is silently missing: it cannot be chosen in the panel, and a filter value of such a record (from a shared link or a saved URL) shows the chip "Unknown" („Nieznany”), the label S1-13 Q5 reserves for records the person **cannot** see. The demo dataset and today's installations are far below the limit, so this is a scaling gap, not a current bug (#272).

## 📝 Proposed Solution

Load every page of each option list with the cursor envelope of §18.4 (`limit` = `MAX_PAGE_LIMIT`, i.e. 100), sequentially per list, until `nextCursor` is `null` or the bound of 20 pages is reached. The lists stay parallel to each other (active / archived / per project), as today. Because every visible record is then among the options, `useFilterValueLabel` resolves its chip by name without any extra lookup; "Unknown" stays for values that match no option – the records the person cannot see (S1-13 Q5).

A small shared helper in `lib/api-client` reads every page of a list endpoint up to a bound; `creatableProjects()` of `new-ticket-page.ts`, which already loops over the pages of `GET /api/v1/projects` by hand, moves onto it, so there is one way to read a whole list (Rule 12).

**Alternatives considered:**

- **Searchable picker (combobox with a server-side `query`)**, as the assignee picker of S1-10. Better for very large lists, but `GET /api/v1/projects` and `GET /api/v1/organizations` have no `query` parameter today: it adds public contract surface, and a combobox per filter changes the panel's interaction on phones. Deferred until an installation comes near the bound.
- **Resolve chip labels by ID** (`GET /api/v1/projects/{projectId}` etc. for values outside the options). Unnecessary once all options load; the organization detail endpoint is Administrator-only (S1-13 Q6), so it would need a new read rule. Deferred with the picker.
- **`useInfiniteQuery` with "Load more" in the panel.** Leaves the chip problem unsolved for values on unloaded pages and adds a step for the user (Rule 2).

## 📝 Architecture

Web application only (`apps/web`):

- new `lib/api-client/all-pages.ts`: `allPageItems(fetchPage, { maxPages })` (default bound `ALL_PAGES_MAX_PAGES` = 20) – calls `fetchPage(cursor)` with `null`, then each `nextCursor`, concatenating `items`, and stops at `null` or after `maxPages` pages. A failed page rejects the whole read (`dataOf()` already turns it into an `ApiError`), so the query shows its error state rather than a silently partial list.
- `features/tickets/queries.ts`: the three filter-option factories use the helper with `limit: MAX_PAGE_LIMIT` and its default bound; the three per-list limit constants are removed. Query keys and the `{ id, label }` result shapes are unchanged, so `ticket-filter-options.ts` and the panel stay as they are.
- `features/tickets/new-ticket-page.ts`: `creatableProjects()` uses the helper (same bound).

The API, contracts, OpenAPI document and the CASL abilities are untouched; each page is read through the BFF with the person's session, as today.

## 📝 UI/UX

No visible change below 100 entries. Above it, the panel lists every option (the panel already scrolls; every option keeps its 44 px row, Rule 9) and chips show names. No new texts, so no translation, help or tour change.

## 📝 Edge Cases & Failure Scenarios

- **More than 2,000 entries in one list** – the options stop at the first 2,000 by name (the API's order), and values beyond show "Unknown", as today beyond 100. Documented as a known limit; the searchable picker is the follow-up when it matters.
- **A page fails** – the option query fails as a whole, the panel shows no options for that list, as today when its single request fails; filtering itself is unaffected (the server applies filter values).
- **Cursor of a changed list** – a project created or archived between two page reads may be missed or listed twice for that read; the next refetch corrects it. The options deduplicate by ID (the members already do; projects and organizations gain the same `Map`-by-ID step).
- **Many chosen projects** – one paged read per chosen project, in parallel, as today.

## 📝 Risks & Impact Review

Reversible, web-only change; no contract, schema or permission surface. The cost is more requests to open the panel above 100 entries (at most 20 sequential requests per list); below it, the request count is unchanged.

## Changes to the system specification

| Section | Change |
|---|---|
| §8.1 | The filter panel offers every project, organization and member of the chosen projects the user can see (up to 2,000 per list); "Unknown" stays for records the user cannot see. |
| §18.5 | A whole list (all pages of a list endpoint) is read with `allPageItems` of `lib/api-client`, with a bound, never with a hand-written cursor loop. |

## Non-goals

- A searchable picker or any new `query` parameter on the project or organization list endpoints.
- Label lookups by ID for values beyond the bound.
- Changes to other pickers (the assignee picker of S1-10, the bulk assignee picker, the project picker of the new-ticket form beyond moving its loop onto the helper).

## Resolved assumptions (autonomous defaults)

| # | Question | Applied default | Why |
|---|---|---|---|
| Q1 | Follow `nextCursor` or a searchable server-side picker? | Follow `nextCursor`. | No new public contract, reuses the cursor envelope and the existing panel; the picker stays an open follow-up. Reversible. |
| Q2 | The upper bound? | 20 pages of 100 (2,000 entries) per list. | Far beyond today's installations; caps the requests to open the panel. A constant, easy to change. |
| Q3 | How are chip labels outside the loaded options resolved? | By loading every option up to the bound; no per-ID lookups. | Within the bound every visible record is an option; a lookup would need a new organization read rule (S1-13 Q6). |
| Q4 | Out of scope? | See **Non-goals**. | Smallest change that meets the acceptance criteria of #272. |

## Acceptance criteria

- [ ] With more than 100 (up to 2,000) projects, organizations or members per list, every one the person can see can be chosen in the filter panel (§8.1).
- [ ] The chip of a visible record within the bound shows its name; "Unknown" stays only for records the person cannot see (S1-13 Q5).
- [ ] A failed page fails the option list as a whole, never a silently partial list.
- [ ] Works on phone, tablet and desktop (Rule 9); the change is covered by tests.

## 📋 Implementation Plan

**Phase 1 – every option of the filters (one PR)**

1. Add `allPageItems` in `apps/web/src/lib/api-client/all-pages.ts` with unit tests: one page, several pages, the bound, a failed page.
2. Move `creatableProjects()` in `new-ticket-page.ts` onto the helper; existing tests stay green.
3. Use the helper in `projectFilterOptionsQueryOptions`, `organizationFilterOptionsQueryOptions` and `assigneeFilterOptionsQueryOptions`, deduplicating by ID; unit tests with a mocked client that returns more than one page (150 projects, 150 organizations, 150 members) and assert every option, and the chip label of an entry from the second page.
4. Update §8.1 and §18.5; run the validation gate. Setting this spec to `implemented`, moving it to `implemented/` and its changelog entry follow once both this spec PR and the implementation PR have merged (the implementation PR, #276, was opened before this spec reached `main`).

## Changelog

- 2026-11-10 – Created (autonomous defaults, #272).
- 2026-11-10 – Specification review: the bound is the helper's default `ALL_PAGES_MAX_PAGES`, as implemented in #276; the move to `implemented/` follows both merges.
