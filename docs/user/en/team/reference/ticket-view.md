---
title: Ticket view
description: The parts of a ticket for the team – title, description, files, fields and activity – and how changes are saved and undone.
views: ['/tickets/[identifier]']
---

A ticket opens at its identifier, for example `/tickets/ERP-12`. On a computer its fields are in a panel on the right; on a phone or a tablet they are in the **Details** section below the title, and on a phone each field opens its choices at the bottom of the screen.

You can change only what your role allows; everything else is shown as text. In an archived project the whole ticket is read-only, and a note says so.

## Header

- The **identifier**, for example `ERP-12`, with a button that copies it.
- The **title**. Select **Edit title**, change it, and select **Save** or press **Enter**; **Cancel** or **Esc** keeps the old title.
- Who opened the ticket and when, and where it came from: **User** (from the portal), **Developer** (the team) or **Integration**.

## Description and files

The description is shown formatted ([format text](../../end-user/reference/formatting-text.md)). Select **Edit** to change it, then **Save**. If you select **Cancel** or leave the page with unsaved text, Trybun asks "Discard your changes?" first. The files of the ticket are listed below the description ([attach files](../../end-user/how-to/attach-files.md)).

## Fields

| Field | Meaning and how it changes |
|---|---|
| **Status** | The internal status, grouped into **Initial**, **Active**, **Paused** and **Closed**; a ticket waiting for the requester also shows why – **Waiting for information** or **Waiting for confirmation**. See **Statuses** below |
| **Assignee** | Who works on the ticket. See **Assignment** below |
| **Type** | **Bug**, **Feature**, **Task** or **Question**; **Not set** for a ticket from the portal that nobody has classified yet. Changing the type never changes the description |
| **Priority** | **Low**, **Normal**, **High** or **Critical** |
| **Project** | The project of the ticket; it cannot be changed |
| **Requester** | Who reported the ticket |
| **Organization** | The organization of the requester, shown only when there is one |
| **Created**, **Updated** | When the ticket was created and last changed, in your time zone |

## Saving and Undo

Type, priority and assignee are saved as soon as you choose a value. A message confirms the change and offers **Undo**, which changes the field back – this is a change of its own and appears in the activity too. There is no **Undo** after setting the type of a ticket whose type was **Not set**.

Title and description are saved only when you select **Save**.

If someone else changed the ticket in the meantime, Trybun says so and shows the ticket again; text you typed stays in the field, so you can save it again. An **Undo** that is no longer possible – for example because the previous assignee can no longer be assigned – shows why and is not repeated.

## Assignment

- **Project manager and Administrator**: choose any person who can be assigned in the project – search by name or GitHub login. **Assign to me** is the first choice when you can be assigned yourself, and **Unassigned** the last.
- **Developer**: **Assign to me** assigns the ticket to you, also when it is assigned to someone else; **Unassign me** removes you. A Developer cannot assign other people. Taking over a ticket from someone else has no **Undo**.

## Statuses

Choose the new status in **Status**:

- **Rejected** asks for the reason, which is required.
- **Duplicate** asks for the **Original ticket** of the same project – enter its identifier, for example `ERP-7` or just `7`, check its title and select **Mark as duplicate**.
- **Done** in a project that asks requesters to confirm the solution ([project settings](project-settings.md)) moves the ticket to **Waiting for requester** instead, with the message "The requester is asked to confirm that the problem is solved. The ticket closes automatically after 7 days."

A change between statuses that are not closed offers **Undo**. Closing or reopening a ticket, **Rejected**, **Duplicate**, a **Done** that waits for confirmation and leaving **Waiting for confirmation** have no **Undo**.

## Activity

**Activity** lists everything that happened to the ticket, oldest first: who opened it, and every change of its title, description, type, priority, assignee, status and files, with the old and the new value. Changes made automatically show **System** instead of a person; a person whose account was deleted shows as **Deleted user**. **Show more** at the end loads the later entries.

Switch on **Hide events** to hide these entries. Trybun remembers the choice for your account, so it applies on every device.
