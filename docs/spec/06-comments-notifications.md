# 06 – Comments and notifications

## 6.1 Comments and internal notes

| Kind | Code | Visible to | Who can add |
|---|---|---|---|
| Public comment | `public` | everyone who can see the ticket, including the requester | all roles (end users on tickets they can see, [§5.4](05-visibility-and-search.md)) |
| Internal note | `internal` | team only (Developer and above) | Developer and above |

- For team members the default kind is **internal note**. A public comment requires a deliberate switch, which prevents accidentally sending a technical discussion to the customer.
- Internal notes are clearly distinguished visually (e.g. a different background color, plus an icon/label – never color alone, [§13.4](13-non-functional.md)).
- `@mentions` notify the mentioned person. End users can mention members of their organization and team members ([§7.3](07-users-organizations-permissions.md)).

## 6.2 Editor

The editor works like GitHub's (issues and pull requests) and is based on **GitHub Flavored Markdown (GFM)**. It is used for ticket descriptions, comments and notes.

- toolbar with basic formatting (bold, italic, headings, lists, quotes, links, code),
- "Write" and "Preview" tabs,
- inserting images and files by drag and drop, pasting from the clipboard, or choosing from disk (attachments, [§13.3](13-non-functional.md)),
- task lists (`- [ ]`), code blocks with syntax highlighting, tables,
- keyboard shortcuts (e.g. Ctrl+B, Ctrl+K for a link).

Using GFM also simplifies the GitHub integration: ticket content goes into issues without format conversion ([§11.4](11-github-integration.md)).

Security (Rule 1): rendered HTML is sanitized according to OWASP recommendations to prevent XSS.

## 6.3 E-mail replies

- Requesters and watchers receive new public comments and public status changes by e-mail ([§6.6](#66-events-and-settings)).
- A reply to such an e-mail is added to the ticket as a public comment, so the user does not need to log in. Incoming e-mail is handled by an e-mail provider that converts messages into webhooks ([§14.4](14-architecture.md)).
- The reply is matched to the ticket and the sender's account; e-mails from unknown senders are rejected.

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
- Several changes to the same ticket within a short time window (e.g. 2 minutes) are combined into one notification to avoid notification floods.
- Notifications about internal events are never sent to end users.
- Notifications and e-mails are sent in the recipient's language ([§13.1](13-non-functional.md)).
