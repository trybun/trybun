# Execution plan: ticket list filter pickers – Phase 1, API search and lookup

Source doc: .ai/specs/2026-11-10-ticket-list-filter-pickers.md (spec PR #280)
Issue: #279

## Goal

The API lets the pickers of the ticket list filters (§8.1) search projects, organizations and people on the server and name chosen values by ID: `query` and repeated `id` on `GET /api/v1/projects` and `GET /api/v1/organizations`, and the new `GET /api/v1/project-members`.

## Scope

- `packages/contracts` – `MAX_TICKET_FILTER_VALUES` and `oneOrMore` move to `pagination` (re-exported from `tickets`); `LIST_SEARCH_QUERY_MAX_LENGTH` (renamed from `MEMBER_CANDIDATE_QUERY_MAX_LENGTH`) and the shared `listSearchQuerySchema`; `query` and `id` on the two list queries; the schemas of `GET /project-members`.
- `apps/server` – `ProjectsService.list`, `OrganizationsService.list`, the new `ProjectMembersController` and `ProjectsService.listMemberAccounts`; integration tests (Testcontainers).
- `apps/web/src/api` – generated OpenAPI client only (`pnpm api:generate`); the import of the renamed constant in `assignee-control.tsx`.
- `docs/spec` §7.5, §12.1, §17.2.

Non-goals: `packages/ui` (Phase 2), the web filter bar and pickers (Phase 3), §8.1, §18.5, §18.6 (Phase 3), user documentation.

## Risks

Substring search without an index (sequential scan, accepted at today's sizes by the spec). Prisma `contains` may not escape `_` and `%` – covered by an integration test, escaped in the service if needed.

## Progress

PR: #284

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: API search and lookup

- [x] 1.1 Contracts: shared pagination pieces, query and id, project-members schemas — a6d3592
- [x] 1.2 Search and lookup of the project and organization lists — ca8e47a
- [x] 1.3 GET /project-members — f5a3c1a
- [x] 1.4 OpenAPI client and §7.5, §12.1, §17.2 — 0411ba0
