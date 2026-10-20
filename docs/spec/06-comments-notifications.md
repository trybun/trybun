# 06 – Comments and notifications

## 6.1 Comments and internal notes

| Kind | Code | Visible to | Who can add |
|---|---|---|---|
| Public comment | `public` | everyone who can see the ticket, including the requester | all roles (end users on tickets they can see, [§5.4](05-visibility-and-search.md)) |
| Internal note | `internal` | team only (Developer and above) | Developer and above |

- For team members the default kind is **internal note**. A public comment requires a deliberate switch, which prevents accidentally sending a technical discussion to the customer.
- Internal notes are clearly distinguished visually (e.g. a different background color, plus an icon/label – never color alone, [§13.4](13-non-functional.md)).
- `@mentions` notify the mentioned person. End users can mention members of their organization and team members ([§7.3](07-users-organizations-permissions.md)).
- **Editing**: the author can edit their own comment or note. Edited comments show "edited" (PL: „edytowano”) and the previous versions are available in the edit history to everyone who can see the comment (pattern: GitHub). The ticket description can be edited by its author and by the team, also with history.
- **Deleting**: the author can delete their own comment or note; the team (Developer and above) can delete any comment, e.g. to remove personal data. A deleted comment leaves the entry "Comment deleted" (PL: „Komentarz usunięty”) with author and time in the activity timeline ([§4.5](04-ticket-lifecycle.md)); its content and attachments are removed.
- Editing or deleting a comment never sends notifications.

## 6.2 Editor

The editor works like GitHub's (issues and pull requests) and is based on **GitHub Flavored Markdown (GFM)**. It is used for ticket descriptions, comments and notes.

- toolbar with basic formatting (bold, italic, headings, lists, quotes, links, code),
- "Write" and "Preview" tabs,
- inserting images and files by drag and drop, pasting from the clipboard, or choosing from disk (attachments, [§13.3](13-non-functional.md)),
- task lists (`- [ ]`), code blocks with syntax highlighting, tables,
- keyboard shortcuts (e.g. Ctrl+B, Ctrl+K for a link).

Using GFM also simplifies the GitHub integration: ticket content goes into issues without format conversion ([§11.4](11-github-integration.md)).

Security (Rule 1): rendered HTML is sanitized according to OWASP recommendations to prevent XSS. Images are displayed only from the ticket's own attachments; images referenced by external URLs are not loaded (they could track readers and bypass the Content Security Policy) and are shown as links instead.

## 6.3 E-mail replies

- Requesters and watchers receive new public comments and public status changes by e-mail ([§6.6](#66-events-and-settings)).
- A reply to such an e-mail is added to the ticket as a public comment, so the user does not need to log in. Incoming e-mail is received by an e-mail provider that forwards messages as webhooks; the server handles them through an **adapter interface**, so providers can be added without changing the domain logic. Outgoing e-mail is sent via SMTP and works with any provider ([§14.2](14-architecture.md)).
- Every notification e-mail uses a **personal reply address** with a signed token identifying the ticket and the recipient (e.g. `reply+<token>@<domain>`). A reply is accepted only if the token is valid and the e-mail provider reports a successful SPF and DKIM check; the sender address alone is never trusted, because it can be forged.
- Replies that fail these checks, come from users who no longer have access, or refer to closed or archived projects are rejected, and the sender receives a short explanation.

## 6.4 Watching tickets

Notifications go to the **watchers** of a ticket. A person becomes a watcher:

- automatically: the requester, the assignee, people mentioned with `@mention`, people who added a comment, and people who clicked "I have the same problem" ([§5.6](05-visibility-and-search.md)),
- manually: with the "Watch" button (PL: „Obserwuj”) on the ticket.

"Unwatch" (PL: „Przestań obserwować”) is available on the ticket and in every notification (one click).

## 6.5 Channels

- **In-app notification center** (bell icon with unread count): list of notifications linking to the ticket, mark as read individually or all at once.
- **E-mail**: with the possibility to reply directly ([§6.3](#63-e-mail-replies)) and an unwatch link.

## 6.6 Events and settings

Team members choose, per event type, which channel they want (pattern: GitHub). Defaults:

| Event | In-app | E-mail |
|---|---|---|
| `@mention` | ✅ | ✅ |
| Ticket assigned to me | ✅ | ✅ |
| New comment on a watched ticket | ✅ | – |
| Status change of a watched ticket | ✅ | – |
| New ticket waiting for triage (Project manager) | ✅ | – |
| Requester replied to a ticket in `waiting_for_requester` | ✅ | ✅ |
| All sub-tickets completed (assignee of the parent, [§3.5](03-ticket-model.md)) | ✅ | – |
| Shared-ticket approval requested ([§5.2](05-visibility-and-search.md)) | ✅ | – |
| SLA at risk (assignee, Project manager, [§9.5](09-sla.md)) | ✅ | – |
| SLA breached (assignee, Project manager) | ✅ | ✅ |
| Import finished ([§12.5](12-api-webhooks-import.md)), webhook disabled ([§12.4](12-api-webhooks-import.md)) (Administrator) | ✅ | ✅ |

End users do not configure channels. They receive an e-mail and an in-app notification for public comments and public status changes of tickets they watch.

## 6.7 Rules

- Nobody is notified about their own actions.
- Permissions are checked again **at the moment of sending**. A watcher who has lost access to the ticket (e.g. after narrowing its visibility, a change of organization or deactivation) receives nothing and is removed from the watchers.
- Several changes to the same ticket within a short time window (e.g. 2 minutes) are combined into one notification to avoid notification floods.
- Notifications about internal events are never sent to end users.
- Notifications and e-mails are sent in the recipient's language ([§13.1](13-non-functional.md)).
