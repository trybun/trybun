---
title: Comments and internal notes
description: Who sees a comment or a note, mentions, editing, deleting and redacting, and the history of comments and descriptions.
---

You write comments in the form at the end of the timeline of a ticket ([ticket view](ticket-view.md)). The text is formatted like the description ([format text](../../end-user/reference/formatting-text.md)), and you can attach files to it ([attach files](../../end-user/how-to/attach-files.md)).

## Two kinds

Above the form, choose the kind:

| Kind | Who sees it | Button |
|---|---|---|
| **Internal note** | The team of the project and the Administrator only. It never reaches customers | **Add internal note** |
| **Public comment** | The team and the customers who see the ticket, see **Who sees a public comment** below | **Comment publicly** |

**Internal note** is preselected on every new form, so nothing reaches a customer by accident. In the timeline and in the form, an internal note has its own background, a lock icon and the label **Internal note**.

The kind of a comment never changes. To publish what a note says, write a public comment.

## Who sees a public comment

A public comment is visible to the customers who see the ticket at the moment you write it. With **Public comment** chosen, a hint under the switch says who that is:

- "Visible to the requester" – the ticket is visible to **Only me**;
- "Visible to organization X" – the ticket is visible to **My organization**;
- "Visible to all customers of the project" – the ticket is shared with **All customers**.

This audience is set once and never changes, whatever happens to the visibility of the ticket later. Sharing a ticket does not reveal its earlier comments to other organizations; narrowing a shared ticket hides it, with its comments, from the customers who can no longer see it. The author of a comment always sees their own comment while they can see the ticket.

The reason you give when you set a ticket to **Rejected**, or when you refuse a sharing request ([share a ticket with all customers](../how-to/share-a-ticket-with-all-customers.md)), is added as a public comment by you. The visibility field then shows "Refused – the reason is in the timeline".

## Mention people

Type `@` in the form and choose a person from the list: the comment then shows `@` and their name. You can mention only people who can see the ticket and the comment:

- in an internal note: the team of the project;
- in a public comment: the team, the requester and – when the ticket is visible to their organization or to all customers – the people of the requester's organization.

Customers can mention only the team members who take part in the ticket – its assignee and those who wrote a public comment they can read – and the people of their own organization when the ticket is visible to it. A mention never gives anyone access to the ticket. A text can mention at most 50 people.

## Edit and delete

Open the **⋯** menu of your comment or note:

- **Edit** changes the text in place. Only the author edits a comment, also on a closed ticket. The comment then shows **edited**.
- **Delete** removes the comment with its files after a confirmation; it cannot be undone. The author deletes their own comments; the team can delete any comment. The team timeline keeps the entry **Comment deleted** with who deleted it and when; customers simply no longer see the comment.

## Edit history

Select **edited** to open the earlier versions, newest first, each with who wrote it and when. The team sees the history of every text. Customers see the history only of their own texts – their comments and the description of a ticket they reported; for other texts **edited** is plain text.

The description of a ticket has the same marker and history.

## Redact

When a comment or a description contains something that must not stay – a password or personal data – the team can remove it from the text and from its history:

1. Select **Redact** for the comment, in its **⋯** menu, or for the description.
2. Change the text. The replaced text is not kept as a version.
3. Choose the earlier versions to remove. All are selected; clear those you want to keep.
4. Confirm. Redaction cannot be undone.

The timeline shows **Content redacted** to the team. E-mails that were already sent and the backups keep the earlier text; backups until they are replaced by newer ones.

## Hide events

**Hide events** in the timeline hides the changes of the ticket and shows only the comments and notes.
