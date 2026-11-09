---
title: Create a ticket
description: Create a ticket in the full form, with the description template of its type and an assignee.
views: ['/tickets/new']
---

1. Select **New ticket** in the header. On a phone it is the plus icon.
2. In **Project**, choose the project of the ticket. When you can create tickets in only one project, it is already chosen. The list shows only the active projects in which you can create tickets; when there is none, the form says "You cannot create tickets in any project yet."
3. Choose the **Type**: **Bug**, **Feature**, **Task** (the default) or **Question**.
4. In **Title**, describe the ticket in one sentence.
5. Fill in the **Description**. It starts with the template of the type – headings such as **Steps to reproduce** for a bug, or a checklist of **Acceptance criteria** for a feature. You can format the text: see [Format text](../../end-user/reference/formatting-text.md). Optionally, attach files: drag them onto the description, paste them, or select **Attach files** ([attach files](../../end-user/how-to/attach-files.md)).
6. Check the **Priority**. It follows the type – **Low** for a question, **Normal** for the others – until you choose one yourself.
7. Optionally, choose the **Assignee**:
   - As a Project manager or the Administrator, search for the person by name or GitHub login, or choose **Assign to me**. Only the people who can be assigned in the project are listed.
   - As a Developer, tick **Assign to me** – a Developer can assign tickets only to themselves.
8. Select **Create ticket**.

The new ticket opens in the [ticket view](../reference/ticket-view.md), and a message confirms its identifier, for example "Ticket ERP-12 created".

## Templates

Each type has its own template:

| Type | Template |
|---|---|
| **Bug** | Problem, Steps to reproduce, Expected result, Actual result, Environment |
| **Feature** | Goal, Proposed solution, Acceptance criteria (a checklist) |
| **Task** | Scope of work, Completion criteria (a checklist) |
| **Question** | Question, Context |

The template is in the language of your account (**Account settings**). While the description is empty or still exactly the template, choosing another type replaces it with the template of that type. Once you have written in it, your text is never replaced. A template is inserted only when you create a ticket: changing the type of an existing ticket keeps its description.

## Leaving the form

If you leave the form after typing a title or a description – through a link or with the back button of your browser or phone – Trybun asks "Discard your changes?" first. Select **Keep editing** to return to the form. If you close or reload the tab, your browser asks instead.
