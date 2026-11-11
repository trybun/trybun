# Ticket list: the type on phone cards and in the tablet table

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-11-10 |
| Plan task | – (follow-up of `S1-13`) |
| System specification sections | §8.1 |
| Related issues / PRs | [QA of #290](https://github.com/trybun/trybun/pull/290#issuecomment-6778339622), [S1-13 spec](2026-10-26-team-list-view.md), #293 (specification), #294 (implementation) |

## Context

The team's ticket list (§8.1) shows the ticket type only on the desktop. The table hides the **Type** column below the desktop width (`xl`, 1280 px). The phone card shows the identifier, the title, the status, the priority and the assignee. On a phone, a tablet or a small laptop the type of a ticket can therefore only be learned by opening it, or by filtering by **Type**.

The S1-13 specification lists the card's fields and the hidden tablet columns without giving a reason. Hiding **Project** costs nothing, because the identifier (`ERP-12`) carries the project key. Nothing else on the card or the row tells the type. Trybun mixes questions from customers with bugs, features and tasks of the team, across projects, in one list. "Question" and "Bug" call for different reactions, and an end user's ticket has no type until triage (§3.2).

The QA reviewer noticed the missing type during the manual QA of #290.

Established tools show the type in their lists: GitHub shows an issue type "on any lists of issues", and Jira puts the type's icon next to the issue key. GitLab proposes a type indicator for its lists so that types can be told apart "at a glance". Linear has no type field at all, which shows that a list can work without it. This is why the type is shown in a compact form here, not as a new card row or tablet column.

## Goals

- Show the type of every ticket in the list on every device, without adding height to the phone card or a column to the tablet table.
- Show "Not set" („Nie ustawiono”) for a ticket without a type, as the desktop column does, so triage can see which tickets still need one.

## Non-goals

- Type icons or colours: the type is text (WCAG 1.1.1, 1.4.1), as in the desktop column.
- Showing the project or the organization on phones or tablets: the identifier already carries the project key.
- Configurable list properties (Linear's display options).
- Changes to the Kanban board cards (§8.2) or the portal lists.

## Proposed change

- **Phone card:** the line of the identifier also shows the type, as small muted text after a separator: `ERP-12 · Bug`. That line is short and has free space today, so the card keeps its height. A long identifier and type wrap within the line.
- **Tablet table (`md` to `xl`):** the **Title** cell shows the type below the title, in the same small muted text, so the table gets no new column ([Q4](#open-questions)). The title column takes the free width and is at least 112 px wide, wider than the longest label („Funkcjonalność”, 88 px), so the type neither widens the table nor breaks within a word, and the table still fits the content area without horizontal scrolling, as S1-13 requires. A row grows by the type's line (about 18 px), and the **ID** cell keeps only the identifier ([Q3](#open-questions)).
- **Desktop (`xl` and wider):** unchanged. The **Type** column stays, and the **ID** cell shows only the identifier, so the type is not shown twice.
- **No type:** "Not set" („Nie ustawiono”), the same label as the desktop column.
- **Assistive technology:** the separator is hidden from the accessibility tree. The type is part of the ticket's link on the card, so the link's accessible name is the identifier, the type and the title, in this order.

The type comes from the list response that the table already uses (`type` of `GET /api/v1/tickets`), and its label from `useTicketFieldLabels`. The change needs no API change and no new texts.

## Changes to the system specification

| Section | Change |
|---|---|
| §8.1 | The phone card also shows the type next to the identifier. On tablets the title cell shows the type below the title, while the type column stays hidden until the desktop width. A ticket without a type shows "Not set". |

New or changed glossary terms: none.

User documentation (EN, PL): `team/reference/ticket-list.md`, section "Table and cards", is updated in the implementation PR, and the help content is regenerated.

## Open questions

1. What do the card and the tablet table show when a ticket has no type? — **Answer:** "Not set" („Nie ustawiono”), as the desktop column; it helps triage (decided by the maintainer, 2026-11-10).
2. Where is the type placed? — **Answer:** next to the identifier on the card and below the title in the tablet table; the desktop keeps its column (proposed after the QA of #290 and accepted by the maintainer, 2026-11-10; the tablet placement changed from the ID cell to the title cell by Q4).
3. Does a tablet row keep its 44 px with the type in it? — **Answer:** no. A row grows by the type's line, with the padding of the shared `TableCell` unchanged. Keeping 44 px would need a smaller padding in this one cell, a special case in the shared table, while rows with a two-line title are taller already (raised by the specification review of #293, 2026-11-10; approved by the maintainer with the merge of #293).
4. What if the longest translated label does not fit one line on the narrowest tablet? — **Answer:** the type moves below the title on tablets. In the ID cell, at 768 px in Polish, „Funkcjonalność” and „Nie ustawiono” widened the table by up to 48 px when kept on one line (review of #294); wrapping them there broke labels within a word at every tablet width, also „Questio|n” in English, because the title column takes all free width and leaves the ID column at its minimum; a minimum width of the label widened the table again by up to 22 px. The title column is flexible and at least 112 px wide, so there the type fits on one line in English and Polish at every tablet width, without making the table wider than before. The common practice is to design for text expansion in translation (W3C Internationalization), to show secondary data as a line below the title (GitHub, Jira, two-line list items of Material Design) and not to hide it behind scrolling or a tooltip that touch screens cannot reach (Rule 9) (decided by the maintainer, 2026-11-10, after measuring the three options).

## Acceptance criteria

- [x] At 360 px every card of the demo dataset shows `<identifier> · <type>` on one line, and the link of a card with a one-line title stays 44 px high (E2E on the phone).
- [x] A ticket without a type shows "Not set" / „Nie ustawiono” on the card and in the tablet title cell.
- [x] From `md` to below `xl` the title cell shows the type below the title on one line, the column set is unchanged (no **Type** column) and the table has no horizontal scrolling; at 768 px in Polish the longest labels stay on one line (E2E on the tablet, with the check of S1-13).
- [x] From `xl` on, the **Type** column is shown and the title cell shows only the title (E2E on the desktop).
- [x] The accessible name of the card's link has the identifier, the type and the title in this order, without the separator. Axe passes on the list (E2E).
- [x] Component tests cover the content of the card and of the title cell, including a ticket without a type. The breakpoints are checked in E2E, because jsdom applies no CSS.
- [x] Works on phone, tablet and desktop (Rule 9)
- [x] User documentation updated (EN, PL) and help content regenerated (Rule 3); no product tour change (Rule 4)

## Changelog

- 2026-11-10 – Created after the manual QA of #290.
- 2026-11-10 – Specification review of #293: corrected the tablet row height (about 52 px for a one-line title, Q3), added the criterion of no horizontal scrolling, and made the accessible name and the test level of the criteria precise.
- 2026-11-10 – Implemented in #294.
- 2026-11-10 – Review of #294: on tablets the type moves from the ID cell below the title, so long translations neither widen the table nor break within a word (Q2, Q3, Q4).
