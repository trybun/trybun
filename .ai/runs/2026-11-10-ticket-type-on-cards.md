# Execution plan: ticket type on phone cards and in the tablet table

Source doc: .ai/specs/2026-11-10-ticket-type-on-cards.md (spec PR #293)

## Goal

The team's ticket list (§8.1) shows every ticket's type on phones and tablets too: after the identifier on the phone card (`ERP-12 · Bug`) and below the identifier in the tablet ID cell; the desktop keeps its **Type** column. A ticket without a type shows "Not set".

## Scope

- `apps/web/src/features/tickets/components/` – `ticket-card-list.tsx` (type after the identifier, separator `aria-hidden`), `ticket-list-columns.tsx` (ID cell shows the type below the identifier, hidden from `xl` on), component tests in `ticket-list.spec.tsx`.
- `apps/web/e2e/ticket-list.spec.ts` – card line and link height on the phone, ID cell on the tablet, Type column and plain ID cell on the desktop, accessible name of the card link.
- `docs/user/{en,pl}/team/reference/ticket-list.md` and the generated help content.
- `docs/spec` §8.1; the change specification set to `implemented` and moved to `implemented/`.

Non-goals: type icons or colours, project/organization on phones or tablets, Kanban cards (§8.2), portal lists, API changes.

## Decisions

- The spec has no Implementation Plan section; the repository's spec template does not require one, and the change is small – this plan derives the steps from "Proposed change" and the acceptance criteria.
- Q3 (tablet row about 52 px) is treated as approved: the spec PR #293 was merged by the maintainer with "approved with this pull request unless the maintainer answers otherwise".

## Risks

The tablet ID cell gets wider ("Funkcjonalność", "Nie ustawiono") – checked by the existing no-horizontal-scrolling E2E on the tablet.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: List

- [ ] 1.1 Type on the phone card and in the tablet ID cell, with component tests
- [ ] 1.2 E2E on phone, tablet and desktop

### Phase 2: Documentation and specification

- [ ] 2.1 User documentation, help content, §8.1 and the change specification
