# Tell the person when a ticket list filter reaches 50 values

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-11-12 |
| Plan task | – |
| System specification sections | §8.1 |
| Related issues / PRs | [#291](https://github.com/trybun/trybun/issues/291), [#290](https://github.com/trybun/trybun/pull/290), [#279](https://github.com/trybun/trybun/issues/279) |

## Context

One filter of the ticket list takes at most 50 values (`MAX_TICKET_FILTER_VALUES`, `packages/contracts`). The searchable pickers of #290 make it easy to choose more. A 51st value made the address invalid for the list query, and the web app dropped the whole filter silently: the person saw a list that did not match their choice, with no message.

## Goals

- The person can never choose a 51st value, and the picker says why.
- An address with more than 50 values of one filter never silently loses the filter.

## Non-goals

- Raising the limit or changing the API: `GET /api/v1/tickets` keeps answering `422` for more than 50 values.
- Telling the person about other invalid values of an address (they still drop their filter).

## Proposed change

Following the pattern of Linear and GitHub Projects:

- Once a filter has 50 values, its picker disables the values not chosen and its status line says "Up to 50 values per filter" (PL: „Do 50 wartości w jednym filtrze”), announced through `ComboboxStatus`. A chosen value can still be cleared, which frees a place.
- An address with more than 50 values of a filter keeps its first 50, and the list names the filter below the filter bar: "Project: only the first 50 values are used – a filter takes up to 50 values." (PL: „Projekt: użyto tylko pierwszych 50 wartości – filtr przyjmuje do 50 wartości.”). The next change of the filters writes the shortened address, which removes the message.

## Changes to the system specification

| Section | Change |
|---|---|
| §8.1 | States the limit of 50 values per filter, the disabled options with their status, and how an address with more values is read |

New or changed glossary terms: none.

## Open questions

None – the behaviour was proposed in #291 by the maintainer.

## Acceptance criteria

- [x] The 51st value cannot be chosen, and the picker says why (EN and PL, announced to screen readers).
- [x] An address with more than 50 values never silently loses the filter.
- [x] §8.1 states the limit.
- [x] Works on phone, tablet and desktop (Rule 9) – the picker is shared by the popover and the bottom sheet.
- [x] User documentation updated (Rule 3); no product tour is affected (Rule 4).

## Changelog

- 2026-11-12 – Created and implemented with the fix of #291.
