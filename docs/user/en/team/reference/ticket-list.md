---
title: Ticket list
description: The tickets of all your projects in one list – views, filters, sorting, selection and bulk actions with their results.
views: ['/tickets']
---

Select **Tickets** in the main navigation to open the list of the tickets of all your projects. You see the tickets you can see in the [ticket view](ticket-view.md); select the title of a ticket – on a phone, its card – to open it.

## Table and cards

On a tablet or a computer the list is a table with the columns **ID** (the identifier), **Title**, **Status**, **Priority**, **Type**, **Assignee**, **Project**, **Organization** and **Updated** (how long ago the ticket changed). Tablets hide **Type**, **Project** and **Organization** and show the type below the identifier in **ID** instead, and **Organization** is shown only once organizations exist.

On a phone every ticket is a card with its identifier and type (for example `ERP-12 · Bug`), title, status, priority and assignee, and a checkbox to select it.

A ticket without a type shows **Not set**: it still needs a type, for example in the **Triage** view.

The list shows 50 tickets; **Show more** at the end loads the next 50. The list shows no descriptions: open a ticket to read its description and files.

## Views

The views above the list – tabs on a tablet or a computer, a list to choose from on a phone – cover all your projects. A view is a set of filters with its own order:

| View | Lists | Order |
|---|---|---|
| **My open tickets** | Tickets assigned to you that are not closed | Priority, highest first |
| **Triage** | Tickets in **New** or **Triage** | Oldest first |
| **Critical** | Tickets with the priority **Critical** that are not closed | Last changed first |
| **Unassigned** | Tickets without an assignee that are not closed – also those whose assignee was deactivated or removed from the project | Priority, highest first |
| **Pending sharing approvals** | Tickets whose author asks to share them with all customers, in any status | Oldest first |

**Tickets** opens **My open tickets**. "Not closed" means every status except **Done**, **Rejected** and **Duplicate**.

When you change a filter, no view is marked any longer: the list shows **Custom filter**. Choose a view again to go back to its filters.

## Filters

Select **Add filter** and choose a field – on a phone the fields open at the bottom of the screen. The field opens its own list of values with a search box on top: type part of a name – for a project also part of its key – to narrow the list, and select the values you want. Each value you select or clear applies at once, and the list stays open for further choices; close it with Esc, by selecting outside it, or – on a phone – with **Done**, and use **Filters** there to go back to the fields.

The values you chose are listed first. Projects, organizations and people are searched among all you can see; when more exist than the list shows, it says "Type to find more".

Each filter can have several values: a ticket matches when it has one of the values of a filter, and all filters together.

| Filter | Values |
|---|---|
| **Project** | Your projects, active and archived |
| **Organization** | The organizations with access to one of your projects, and none; shown only once organizations exist |
| **Type** | **Bug**, **Feature**, **Task**, **Question**, **Not set** |
| **Status** | The statuses, grouped as in the ticket view; **Open** selects every status that is not closed |
| **Priority** | **Low**, **Normal**, **High**, **Critical** |
| **Assignee** | **Me**, **Unassigned**, and the members of the projects chosen in **Project** – choose a project first to find people |
| **Source** | **User** (from the portal), **Developer** (the team), and **Integration** once a ticket comes from one |
| **Sharing request** | **Pending**, **Refused** |

The active filters are shown as chips next to **Add filter**, with the first value and how many more, for example "Status: New +1". Select a chip to change its values, its **×** to remove that filter, or **Clear filters** to remove all of them; without filters the list shows every ticket you can see.

The view, the filters and the order are part of the address of the page, so they survive a reload and you can share them as a link – for example `/tickets?view=triage`. A list without any filter has the address `/tickets?view=custom`. When a link names something you cannot see – for example a project you are no longer a member of – its chip shows "Unknown" and matches no ticket; remove it, and the other values still apply.

## Sorting

On a tablet or a computer, select the heading of **ID**, **Status**, **Priority** or **Updated** to sort by it, and again to reverse the order. On a phone choose the order in **Sort**, which also offers the creation date. Tickets with the same value follow the last update. Statuses sort in the order of the workflow, **New** first; identifiers by project, then number. Changing the order keeps the view.

## Selection

Select the checkbox of a ticket to select it; the checkbox in the heading of the table selects every loaded ticket. You can select at most 100 tickets – then the other checkboxes are disabled with "You can change at most 100 tickets at once." Changing the view, a filter or the order clears the selection.

Once you select a ticket, a bar shows how many are selected, with **Status**, **Priority**, **Assignee** and **Clear selection**. On a phone it is at the bottom of the screen. See [Change many tickets at once](../how-to/change-many-tickets-at-once.md).

## Bulk actions

| Action | Choices |
|---|---|
| **Status** | Every status except **Duplicate**, which needs its own original ticket for each ticket. **Rejected** asks for one reason, added to every ticket as your public comment |
| **Priority** | **Low**, **Normal**, **High**, **Critical** |
| **Assignee** | **Assign to me**, **Unassigned**; when all selected tickets are in one project and you can assign people there, also the people who can be assigned in it |

An action is offered when at least one selected ticket allows it. Each ticket is changed on its own, with the rules of the [ticket view](ticket-view.md): a ticket you may not change is not changed, and the others are. Bulk changes have no **Undo**.

## Results

When every ticket was changed, a message says so, for example "20 tickets updated". A **Done** in a project that asks requesters to confirm the solution counts as changed; the message adds how many tickets are waiting for the requester's confirmation.

Otherwise a window – on a phone at the bottom of the screen – says how many were changed, for example "19 of 20 tickets updated", and lists every ticket that was not changed with its identifier, title and reason:

| Reason | Meaning |
|---|---|
| "Changed by someone else – reload to see the latest version" | Someone changed the ticket after the list was loaded |
| "You are not allowed to do this" | Your role does not allow this change of the ticket, for example assigning someone else as a Developer |
| "No longer available" | You can no longer see the ticket, for example because you were removed from its project |
| "The project is archived" | The ticket's project is archived and read-only |
| A rule's message, for example "Only active team members of the project can be assigned." | The change breaks a rule of the ticket's project |

The tickets that were not changed stay selected. **Reload and retry** loads the list again and repeats the change on them; a ticket that no longer appears in the list leaves the selection, and the result says how many did.

## Pending sharing approvals

In **Pending sharing approvals** every ticket has **Approve sharing** and **Refuse sharing**, if your role allows them:

- **Approve sharing** asks for a confirmation, with a link to the ticket: check its description and files first, because once shared every customer of the project sees them. Approving has no **Undo**.
- **Refuse sharing** asks for the **Reason**, which is added to the ticket as your public comment.

After either decision the ticket leaves the view. If a colleague decided first, Trybun says "This sharing request has already been decided." See [Share a ticket with all customers](../how-to/share-a-ticket-with-all-customers.md).

## When the list is empty

The list says why, for example "No open tickets are assigned to you." in **My open tickets**, "No sharing requests are waiting for approval." in **Pending sharing approvals**, or "No tickets match these filters." with **Clear filters** for your own filters.
