# Execution plan: ticket list filter pickers – Phase 3, one picker per field

Source doc: .ai/specs/2026-11-10-ticket-list-filter-pickers.md (spec PR #280)
Issue: #279

## Goal

A team member filters the ticket list (§8.1) through **+ Add filter** and one searchable picker per field whose changes apply at once; projects, organizations and people are searched on the server (Phase 1, #284) with the Combobox parts of Phase 2 (#285).

## Scope

- `apps/web/src/features/tickets/` – `queries.ts` (search and name factories instead of the every-page option lists of #276), `ticket-list.tsx` (`placeholderData: keepPreviousData`), new `ticket-filter-picker.tsx`, `ticket-filter-options.ts` (fixed options and per-field hooks), `ticket-filter-bar.tsx` (field list, chips with reopen and ×, popover from the tablet width on, two-step bottom sheet on phones, `data-tour="ticket-list-filter"`); `ticket-filter-panel.tsx` and `lazy-ticket-filter-panel.tsx` removed.
- `packages/i18n/messages/{en,pl}.json` – texts of the bar and the pickers.
- `docs/user/{en,pl}/team/reference/ticket-list.md` and the generated help content (`pnpm help:generate`).
- `docs/spec` §8.1, §18.5, §18.6 and the approved §18.3 pattern "Text search of lists goes through `containsText()`".
- `apps/web/e2e/ticket-list.spec.ts` – search a project by part of its key, then an assignee, reload keeps both; axe on the open picker.

Non-goals: the API and `@trybun/ui` (Phases 1 and 2, merged), the change specification file (maintainer decision Q7 lands through #286), saved views, counts per option, a product tour of the list.

## Decisions

- **The picker is an inline Combobox inside the bar's popover or bottom sheet** (Base UI `inline`): the spec's flow swaps the popover's content from the field list to the picker, and on phones the picker is the second step of one sheet; one picker variant serves both. `ComboboxTrigger`/`ComboboxContent` are therefore not used; the focus rule of Q7 (mouse or keyboard → the search input, touch → the popup) is reproduced by the bar from the pointer type of the opening press and covered by component tests.
- Chips of projects show the key ("Project: QM150 +2"); the picker rows show `KEY · Name`.

## Risks

Each toggle reads the list again (accepted by the spec, `keepPreviousData` keeps the rows). Focus handling of the inline picker is custom – covered by tests on mouse, keyboard and touch.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data

- [ ] 1.1 Search and name query factories
- [ ] 1.2 Keep the previous rows while a filter change loads

### Phase 2: Pickers and bar

- [ ] 2.1 One picker per field
- [ ] 2.2 Filter bar with field list, chips and two-step sheet

### Phase 3: Docs, specification and E2E

- [ ] 3.1 Translations, user documentation and specification
- [ ] 3.2 E2E and validation gate
