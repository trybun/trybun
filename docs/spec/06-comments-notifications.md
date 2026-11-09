# 06 – Comments and notifications

## 6.1 Comments and internal notes

| Kind | Code | Visible to | Who can add |
|---|---|---|---|
| Public comment | `public` | everyone who can see the ticket and the comment's audience ([§5.2](05-visibility-and-search.md)), including the requester | all roles (end users on tickets they can see, [§5.4](05-visibility-and-search.md)) |
| Internal note | `internal` | team only (Developer and above) | Developer and above |

- For team members the default kind is **internal note**. A public comment requires a deliberate switch, which prevents accidentally sending a technical discussion to the customer.
- Internal notes are clearly distinguished visually (e.g. a different background color, plus an icon/label – never color alone, [§13.4](13-non-functional.md)).
- **Kind and audience** are chosen when a comment is written and never change; to publish a note, the team writes a public comment.
- `@mentions` notify the mentioned person. A mention is stored in the text as `@{<userId>}`, plain GFM without the person's name, inserted from the suggestions of the editor ([§6.2](#62-editor)); the name is never part of the source, so it follows renames, anonymization and the identity rule of [§5.4](05-visibility-and-search.md). Mentions are offered in comments and internal notes only, not in descriptions. Who can be mentioned depends on the kind of the text and its author ([§5.2](05-visibility-and-search.md#comment-audience)): end users mention members of their organization and the team members who take part in the ticket – its assignee and the team members who wrote a public comment on it that they can read – not every team member ([§7.3](07-users-organizations-permissions.md)). A new mention outside that scope, or of an unknown ID, is refused with `422 comment.mention_not_allowed`; a mention kept from the previous version survives an edit even if the person left the scope. At most **50** distinct mentions per text (`422 comment.too_many_mentions`); both errors point at `/body` with the field code `field.invalid`. A mention never grants access.
- **Editing**: the author can edit their own comment or note, also on a closed ticket. The ticket description can be edited by its author and by the team. Edited comments and descriptions show "edited" (PL: „edytowano”). Emptying a description is an edit, not a deletion: there is no separate action to delete a description, and removing text from its history is a redaction.
- **Edit history** (pattern: GitHub): previous versions of comments and descriptions are kept as revisions, newest first, each with its author and the time it was written; an empty earlier description is not kept as a revision. Revisions are visible to the **team**; an end user sees the revisions of the texts they wrote – their own comments, and the description of a ticket they requested – and only the "edited" marker on every other text. The activity timeline records that a text was edited, never its content ([§4.5](04-ticket-lifecycle.md)).
- **Redacting**: the team (Developer and above) can **redact** any comment or description, e.g. to remove personal data or data identifying a customer before sharing ([§5.2](05-visibility-and-search.md)). Redacting replaces the content – the replaced text is **never** stored as a revision – and **purges** the selected earlier revisions; the dialog preselects all of them and says that e-mails already sent and backups keep the earlier text. The timeline shows "Content redacted" (PL: „Treść zredagowana”) with author and time, and the action is recorded in the audit log ([§13.5](13-non-functional.md)). Anonymization purges revisions in the same way ([§13.2](13-non-functional.md)).
- **Deleting**: the author can delete their own comment or note, also on a closed ticket; the team (Developer and above) can delete any comment, e.g. to remove personal data. A deleted comment leaves the internal entry "Comment deleted" (PL: „Komentarz usunięty”) with the person who deleted it and the time in the team's activity timeline ([§4.5](04-ticket-lifecycle.md)); its content, revisions, mentions and attachments are removed physically. Every deletion by a team member is recorded in the audit log ([§13.5](13-non-functional.md)).
- Editing, redacting or deleting a comment never sends notifications.
- **Comments on closed tickets**: the same rule applies in the portal and to e-mail replies ([§6.3](#63-e-mail-replies)). A public comment by the requester on a ticket in `done` within **14 days** of the terminal transition reopens it to `triage` (a reopen for SLA, [§9.4](09-sla.md)) and notifies the assignee. On tickets in `rejected` or `duplicate`, or later than 14 days after `done`, end users cannot comment (`409 ticket.comments_closed`, [§4.3](04-ticket-lifecycle.md)); the portal shows "Create a new ticket" (PL: „Utwórz nowe zgłoszenie”) instead of the comment field. The team can always comment.

## 6.2 Editor

The editor works like GitHub's (issues and pull requests) and is based on **GitHub Flavored Markdown (GFM)**. It is used for ticket descriptions, comments and notes.

- toolbar with basic formatting (bold, italic, headings, lists, quotes, links, code),
- "Write" and "Preview" tabs (PL: „Pisz”, „Podgląd”); the preview renders the text exactly as it appears after saving, an empty text shows "Nothing to preview" (PL: „Brak podglądu”),
- inserting images and files by drag and drop, pasting from the clipboard, or choosing from disk with the "Attach files" button (attachments, [§13.3](13-non-functional.md)); a paste that carries text as well as files (e.g. a range copied from a spreadsheet) pastes the text; a file appears, on a line of its own at the cursor (as GitHub inserts uploads), as the placeholder `[Uploading name…]()` until it is uploaded, then as `![name](/api/v1/attachments/{id}/content)` for an image or `[name](…)` for another file,
- task lists (`- [ ]`), code blocks with syntax highlighting, tables,
- in comments and internal notes, typing `@` opens a list of the people who may be mentioned ([§6.1](#61-comments-and-internal-notes)), searched on the server by display name (at most 10, team members first; the query is sent in the body, never in the URL); choosing a person inserts the token `@{<userId>}`, which the Write tab shows as it is (as GitHub shows `@login`),
- keyboard shortcuts (e.g. Ctrl+B; Ctrl+K inside the editor inserts a link, everywhere else it opens the command palette, [§8.4](08-team-views.md)).

The toolbar and its shortcuts (Cmd instead of Ctrl on macOS, as on GitHub):

| Button | Inserts or wraps | Shortcut |
|---|---|---|
| Heading | `### ` at the start of the line | – |
| Bold | `**…**` | Ctrl+B |
| Italic | `_…_` | Ctrl+I |
| Quote | `> ` before each selected line | Ctrl+Shift+. |
| Code | `` `…` ``, or a fenced block when the selection spans lines | Ctrl+E |
| Link | `[…](url)` with `url` selected; a selected URL becomes the target | Ctrl+K |
| Bulleted list | `- ` before each selected line | Ctrl+Shift+8 |
| Numbered list | `1. `, `2. `, … | Ctrl+Shift+7 |
| Task list | `- [ ] ` before each selected line | Ctrl+Shift+L |
| Attach files | opens the file chooser | – |

- A second press of Heading, Bold, Italic, Quote, Code or a list button removes the formatting it would add. Every toolbar action and shortcut can be undone with Ctrl+Z, like typing.
- Write and Preview have no shortcut (Firefox reserves Ctrl+Shift+P); tables have no button, as on GitHub.
- On phones the toolbar shows Bold, Italic, Link, Bulleted list, Task list and Attach files; the other buttons are in a "More formatting" menu (PL: „Więcej formatowania”).

Rendered content (views, the preview and e-mails):

- Raw HTML in the source is not rendered.
- Links keep only the `http`, `https` and `mailto` protocols and paths of the site; any other link, including `javascript:`, `data:` and `vbscript:`, renders as plain text. Links to other sites, including protocol-relative ones, get `rel="nofollow ugc noopener noreferrer"`.
- An image is rendered only when its source is exactly the stable path of an attachment the view allows: an available image of the same ticket or of one of its comments the viewer can read, and in the preview of a form also an available image among the current user's own draft attachments; once the text is saved, the rule of the same ticket applies ([§13.3](13-non-functional.md)). Every other image – an external URL, an attachment of another ticket, an unknown ID – renders as a link labelled by its alt text (or its URL); an image whose source the sanitizer removed renders as its alt text.
- Task-list checkboxes are read-only and named by the item's text; ticking means editing the text.
- **Mentions** render as `@Display name` (a `span` with the class `mention`, not a link) from the `mentions` map `{ id, displayName }` the API returns with each comment, built for the viewer with the identity rule of [§5.4](05-visibility-and-search.md); a token not in the map stays plain text. For a viewer who must not see a mentioned person, the API replaces that person's token – in the body and in revision bodies – with `@{customer}`, and the map has the entry `{ id: 'customer', displayName: null }`, which the web shows as "Customer" (PL: „Klient”) from its catalogue, as for any hidden person; no hidden user ID leaves the server, and the stored text keeps the real ID. On an edit, each `@{customer}` of the submitted text is replaced, in order, by the stored hidden-person tokens of the previous version; extra ones are refused with `422 comment.mention_not_allowed`.
- Several texts render on one page, so footnote IDs are prefixed per text.
- E-mails show every image as a link, have no syntax highlighting and show task items as ☐/☑.

Using GFM also simplifies the GitHub integration: ticket content goes into issues without format conversion ([§11.4](11-github-integration.md)).

Security (Rule 1): rendered HTML is sanitized according to OWASP recommendations to prevent XSS. Images are displayed only from the attachments of the ticket and of its comments the viewer can read (and, in the preview of a form, the current user's own drafts), referenced by their stable path ([§13.3](13-non-functional.md)); images referenced by external URLs are not loaded (they could track readers and bypass the Content Security Policy) and are shown as links instead.

## 6.3 E-mail replies

- Requesters and watchers receive new public comments and public status changes by e-mail ([§6.6](#66-events-and-settings)).
- A reply to such an e-mail is added to the ticket as a public comment, so the user does not need to log in. Incoming e-mail is received by an e-mail provider that forwards messages as webhooks; the server handles them through an **adapter interface**, so providers can be added without changing the domain logic. Outgoing e-mail is sent via SMTP and works with any provider ([§14.2](14-architecture.md)).
- Outgoing e-mails are sent from the address `TRYBUN_MAIL_FROM`. Every notification e-mail uses a **personal reply address** with a signed token identifying the ticket and the recipient, in a separate reply domain `TRYBUN_REPLY_DOMAIN` (default `reply.<domain>`), e.g. `reply+<token>@reply.example.com`. The reply domain has its own MX record pointing to the incoming e-mail provider, so the main domain's e-mail is not affected.
- **Before incoming e-mail is configured** (e.g. in Stage 1 of the implementation plan), notification e-mails use a no-reply From address and contain a "Reply in the portal" link (PL: „Odpowiedz w portalu”) instead of a reply address.
- A reply is accepted only if **all** of these hold:
  - the token's signature is valid and the token has not expired (tokens are valid for 90 days),
  - the provider's webhook signature is valid,
  - the provider reports a DMARC pass, or an SPF or DKIM pass aligned with the `From` domain,
  - the `From` address equals the current e-mail address of the token's recipient.
  The sender address alone is never trusted, because it can be forged.
- Each incoming message is processed **once**: duplicates (the same `Message-ID` and token, e.g. provider retries) are skipped.
- **Automatic replies** (out-of-office, mailing lists, bounces: `Auto-Submitted` other than `no`, `Precedence: bulk`, `list` or `auto_reply`, `X-Autoreply`) are dropped silently, without a comment or a notification (RFC 3834). All e-mails sent by the system carry `Auto-Submitted: auto-generated`.
- Quoted earlier messages and signatures below the reply marker are removed; only the new text becomes the comment. Attachments of a reply go through the attachment rules and malware scanning ([§13.3](13-non-functional.md)).
- Replies from users who no longer have access, replies to tickets on which the sender may not comment ([§6.1](#61-comments-and-internal-notes): `rejected`, `duplicate`, or `done` for more than 14 days) and replies to archived projects are rejected, and the sender receives a short explanation with a link to create a new ticket. A sender receives an explanation only if the authentication checks above passed; otherwise the message is dropped silently (no backscatter).

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
| Shared-ticket approval requested (Developers and Project managers of the project, [§5.2](05-visibility-and-search.md)) | ✅ | – |
| SLA at risk (assignee, Project manager, [§9.5](09-sla.md)) | ✅ | – |
| SLA breached (assignee, Project manager) | ✅ | ✅ |
| Import finished ([§12.5](12-api-webhooks-import.md)), webhook disabled ([§12.4](12-api-webhooks-import.md)) (Administrator) | ✅ | ✅ |
| Deletion request submitted or due soon ([§13.2](13-non-functional.md)) (Administrator) | ✅ | ✅ |

Events that do not exist yet in a stage of the implementation plan are added by the task that introduces them; the defaults above apply from the first stage in which an event exists, and the per-event settings UI is added later.

End users do not configure channels. They receive an e-mail and an in-app notification for public comments and public status changes of tickets they watch, and an in-app notification when an attachment they uploaded was removed as infected or because it could not be checked ([§13.3](13-non-functional.md)).

## 6.7 Rules

- Nobody is notified about their own actions. Exception: when an end user creates a ticket, they receive an **acknowledgement e-mail** with the ticket identifier (e.g. "We have received your ticket ERP-123", PL: „Otrzymaliśmy Twoje zgłoszenie ERP-123”), which also serves as the start of the e-mail thread ([§6.3](#63-e-mail-replies)).
- Permissions are checked again **at the moment of sending**. A watcher who has lost access to the ticket (e.g. after narrowing its visibility, a change of organization or deactivation) receives nothing and is removed from the watchers.
- **Batching**: changes to the same ticket for the same recipient are combined into one notification. The window is a trailing **2 minutes**: each further change within 2 minutes postpones sending until 2 minutes have passed without a change, but never more than 10 minutes after the first change. `@mention` and "Ticket assigned to me" are sent immediately and never batched.
- Notifications about internal events are never sent to end users.
- Notifications and e-mails are sent in the recipient's language ([§13.1](13-non-functional.md)).
