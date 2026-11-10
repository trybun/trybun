# Execution plan: ticket filter options beyond one page

Source doc: .ai/specs/2026-11-10-ticket-filter-options-all-pages.md (spec PR #275)
Issue: #272

## Goal

The filter panel of the ticket list (§8.1) offers every project, organization and member of the chosen projects the person can see, up to 2,000 per list, by following `nextCursor`.

## Scope

- `apps/web/src/lib/api-client/all-pages.ts` – bounded all-pages helper (new).
- `apps/web/src/features/tickets/queries.ts` – the three filter-option factories.
- `apps/web/src/features/tickets/new-ticket-page.ts` – its cursor loop moves onto the helper.
- `docs/spec/08-team-views.md` (§8.1), `docs/spec/18-code-patterns.md` (§18.5).

Non-goals: searchable picker, API/contract changes, per-ID label lookups, other pickers. The spec file itself merges through #275 and is moved to `implemented/` after it lands.

## Risks

More requests to open the panel above 100 entries (bounded at 20 per list).

## Progress

PR: #276

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Every option of the filters

- [x] 1.1 Add the bounded all-pages helper with unit tests — c1a3f4f
- [x] 1.2 Move creatableProjects onto the helper — ae8afa6
- [x] 1.3 Load every page in the three filter-option factories with tests — f5a74df
- [x] 1.4 Update §8.1 and §18.5 and run the validation gate — 8853bfa
