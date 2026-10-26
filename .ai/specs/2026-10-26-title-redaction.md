# Title redaction – removing personal data from a ticket title and its history

| | |
|---|---|
| Status | `draft` |
| Created | 2026-10-26 |
| Plan task | – (proposes a new plan task, see [Open questions](#open-questions)) |
| System specification sections | §4.5, §5.2, §6.1, §7.5, §13.2, §13.5, glossary |
| Related issues / PRs | Gap found by S1-16 GDPR baseline ([#126](https://github.com/trybun/trybun/pull/126) Q15). Builds on S1-05 ticket model and activity events ([#115](https://github.com/trybun/trybun/pull/115) Q11), S1-12 comments, revisions and redaction ([#122](https://github.com/trybun/trybun/pull/122) Q6, Q9, Q19), S1-16 guarded rewrite of activity events ([#126](https://github.com/trybun/trybun/pull/126) Q6), S1-11 sharing ([#121](https://github.com/trybun/trybun/pull/121) Q16), S1-06 ticket snapshots ([#116](https://github.com/trybun/trybun/pull/116) Q13) |

## Context

The team can **redact** a ticket description or any comment: it replaces the text and purges the selected earlier versions ([§5.2](../../docs/spec/05-visibility-and-search.md) "Redaction", [§6.1](../../docs/spec/06-comments-notifications.md), [§7.5](../../docs/spec/07-users-organizations-permissions.md), glossary "Redaction"). Anonymization purges a person's content revisions too ([§13.2](../../docs/spec/13-non-functional.md)). This works because descriptions and comments keep their history in **content revisions**, and the activity timeline records only "edited" ([§4.5](../../docs/spec/04-ticket-lifecycle.md)).

A ticket **title** has no such path:

- [§4.5](../../docs/spec/04-ticket-lifecycle.md) records every field change with its previous and new value, and S1-05 stores title changes as `title_changed` events with `{ from, to }` ([#115](https://github.com/trybun/trybun/pull/115) Q11). The history is immutable, so an old title stays in the database forever.
- Editing the current title is possible ([§7.5](../../docs/spec/07-users-organizations-permissions.md) "Edit any ticket title and description"), but the edit itself writes the old title into a new `title_changed` event.
- S1-05 Q11 and S1-16 Q15 both name the gap. S1-16 builds no title redaction, proposes a new plan task for it that reuses its guarded rewrite of activity events (Q6), and until then names the limitation in the **Complete** dialog and on the help page.

Who needs it:

- **The team before sharing a ticket** ([§5.2](../../docs/spec/05-visibility-and-search.md)). End users type titles such as "Invoice 2026/114 for Kowalski Ltd. not booked". Before approving `all_customers`, the team must remove data identifying the customer. The title is the most visible text of a shared ticket: in lists, in similar-ticket suggestions ([§5.6](../../docs/spec/05-visibility-and-search.md)) and in notification e-mails.
- **The Administrator handling an erasure request** ([§13.2](../../docs/spec/13-non-functional.md)). Free text is kept on anonymization and "the team can redact it if it contains personal data". For titles that promise cannot be kept today.

`title_changed` events are internal (S1-05: all its events are internal), so end users never see the title history. The exposure is the team timeline, the database and the backups.

## Goals

- The team can replace the current title of a ticket and remove earlier titles from its history, in one action, with the same rules as the redaction of a description.
- After a redaction with the default selection, no row of the database contains a removed title (backups expire with their retention, [§13.2](../../docs/spec/13-non-functional.md)).
- The history stays readable and honest: each title change remains an event with its author and time, and the redaction itself is recorded in the timeline and the audit log.
- The activity history stays immutable for every other change: the database refuses every update except the two guarded rewrites (anonymization from S1-16 and title redaction).

## Non-goals

- Automatic redaction of titles by anonymization or retention. Free text is never changed automatically ([§13.2](../../docs/spec/13-non-functional.md), S1-16).
- Redaction by end users. As for descriptions, only the team redacts ([§7.5](../../docs/spec/07-users-organizations-permissions.md)); an end user can edit their own title.
- Recalling copies outside the database: e-mails already sent (S1-15 puts the title into the subject), GitHub issues and their rename history (Stage 3), webhook deliveries already made (S6-04), backups.
- A second redaction mechanism: comments and descriptions keep S1-12's redaction unchanged.
- Re-deciding the questions of S1-05, S1-06, S1-11, S1-12 or S1-16. This specification builds on their proposed answers and only **extends** them additively: a second rule in S1-16's trigger function (Q2), nullable values in S1-05's `title_changed` data (Q3), an optional `type` filter on S1-05's events endpoint (Q8), one link in S1-11's approval dialog (Q9), and the removal of S1-16's "titles cannot be redacted yet" texts. If a sibling answer changes, this specification follows it.

## Proposed change

### Behaviour

A team member (Developer and above) opens **Redact title** on a ticket. The dialog shows:

- the current title in a text field, prefilled, to be replaced by a clean one;
- every earlier title from the ticket's `title_changed` events, newest first, with author and time, as checkboxes – **all checked** (as S1-12 Q9 preselects every revision);
- a warning that the removal cannot be undone, that e-mails already sent keep the old title, and – once the GitHub integration exists – that the linked issue keeps its own history.

On **Redact**, in one transaction:

1. The title is set to the new text (same validation as an edit: trimmed, 1–255 characters, S1-05 Q4). The replaced title is **not** written into a new `title_changed` event – a deliberate exception to "previous and new value" of [§4.5](../../docs/spec/04-ticket-lifecycle.md), as for descriptions ([Q3](#open-questions)).
2. Each selected `title_changed` event keeps its row, author, time and type, but its `data` becomes `{ "from": null, "to": null }`. A title is never `null`, so the value means "redacted" without ambiguity. The timeline shows "Anna changed the title (redacted)" / „Anna zmienił(a) tytuł (zredagowano)”.
3. The internal event `title_redacted` is written without content ("Content redacted" / „Treść zredagowana”, [§4.5](../../docs/spec/04-ticket-lifecycle.md)).
4. The audit entry `ticket.title_redacted` is written with the ticket as target ([§13.5](../../docs/spec/13-non-functional.md)).
5. The ticket's `version` increases. No notification is sent ([§6.1](../../docs/spec/06-comments-notifications.md): redaction never notifies).

The original title of a ticket appears only as the `from` of its first `title_changed` event, because creation writes no event (S1-05 Q11). With every event selected, no earlier title is left. A redaction may keep the current title and only purge history (the current title is already clean), or change only the current title with no event selected (a ticket never renamed). A request that changes neither returns `200` without an event and without a new `version`, as S1-05's `PATCH`.

### Guarded rewrite of `title_changed` events

S1-05's trigger refuses every `UPDATE` of `activity_events`; S1-16 relaxes it for exactly one update, computed by `anonymize_activity_event_data` ([#126](https://github.com/trybun/trybun/pull/126) Q6). This specification adds a **second allowed update** to the same trigger function:

- The use case first runs S1-05's conditional update of the ticket on `id` and `version` (`versionedUpdate`), which locks the ticket row; a stale version ends it with `412` before any event is touched. While the row lock is held, no other title change of the ticket can write an event.
- It then sets two transaction-local parameters with `set_config(…, true)`: `trybun.redact_title_ticket` (the ticket UUID) and `trybun.redact_title_events` (the selected event UUIDs as a PostgreSQL `uuid[]` literal), runs the update, and resets both to an empty string right after it, so no later statement of the transaction can use them. An empty or malformed value counts as not set.
- The trigger lets the `UPDATE` through only when all of these hold:
  - both parameters are set;
  - `OLD.ticket_id` equals the ticket parameter and `OLD.id` is in the event list;
  - `OLD.type` is `title_changed`;
  - `NEW.data` is exactly `{ "from": null, "to": null }`;
  - every other column is unchanged.
- An update must satisfy one of the two allowed rules completely (anonymization or title redaction); parts of both never combine.
- Every other update is still refused; S1-16's anonymization rule is unchanged, and `DELETE` stays as S1-05 defines it.

The update is one parameterized statement in `activity-events.sql.ts`, exported by the `activity-events` module as `redactTitleEvents(tx, ticketId, eventIds)`. The tickets module calls it; the arrows stay tickets → activity-events.

### Other copies of the title

A redaction is only complete if no other stored row keeps the old title. Stage 1 proposals already hold for most stores; this specification proposes the rule explicitly so later tasks keep it ([Q7](#open-questions)). The guarantee is about rows readable through the database: PostgreSQL removes the old row versions (and their entries in the GIN index of S1-16) at the next `VACUUM`, and backups expire with their retention ([§13.2](../../docs/spec/13-non-functional.md)).

| Store | Rule |
|---|---|
| `tickets.title` | Replaced by the redaction |
| `activity_events` of the ticket | `title_changed` values rewritten as above. Snapshots of **other** tickets in events never carry a title: they hold `{ id, number, projectKey }` (S1-06 Q13); later relation events (S2-07, S2-08) follow the same rule |
| `outbox_events` | Payloads never carry a title, only identifiers (S1-05 Q14 writes none for ticket changes; the task that adds `ticket.*` events (S1-15) keeps to identifiers) |
| Stored `Idempotency-Key` replays of `POST /api/v1/tickets` | Keep only the status and the ticket ID; a replay reloads the ticket through the ability ([§12.1](../../docs/spec/12-api-webhooks-import.md), as S1-12 Q19 for comments) |
| `audit_log_entries` | Hold no content, only the target ([§13.5](../../docs/spec/13-non-functional.md)) |
| Notifications (S1-15) | Read the title from the ticket at read time, so they show the new title |
| Queued e-mails and their job data (S1-15) | Carry identifiers only; the subject and body are rendered from the ticket when the e-mail is sent, so an e-mail still waiting in its batch carries the new title. E-mails already sent keep the old one |
| Stores added by later tasks (webhook delivery logs S6-04, import data S6-05, GitHub sync state Stage 3) | Either read the title at use time, or are covered by the redaction use case of that task, which extends this one |
| Data export archives (S1-16) | An archive already prepared keeps the old title until its link expires (24 hours); later exports contain the new one |
| Search index and embeddings (S2-01, Stage 7) | Proposed requirement for those tasks: recomputed on every title change, and a redaction counts as a title change |
| GitHub issue (Stage 3), webhooks already delivered (S6-04), e-mails already sent, backups | Outside Trybun or not modifiable; named in the dialog and the help page |

### API

| Endpoint | Action | Request / response |
|---|---|---|
| `POST /api/v1/tickets/{ticketId}/title-redaction` | `redact_title` | `{ title, purgeEventIds }`, `If-Match` of the ticket; returns the ticket. `purgeEventIds`: 0–1000 UUIDs, each a `title_changed` event of this ticket, else `422 field.invalid_value` at `/purgeEventIds/{index}`. `title` follows the ticket's title rules (`string.too_short` / `string.too_long`) |
| `GET /api/v1/tickets/{ticketId}/activity-events?type=title_changed` | `read` (S1-05) | S1-05's endpoint gains an optional `type` filter (a value of the closed event type list), so the dialog loads the title history without paging the whole timeline. An end user gets no internal events, as today |

Same shape as S1-12's `POST …/description-redaction` (`{ description, purgeRevisionIds }`). A stale `If-Match` returns `412`, so a redaction never runs against a title history the redactor has not seen: every title change increases the ticket's `version`. An invisible ticket returns `404`; an archived project refuses the action through S1-04's fail-closed restriction.

`allowedActions` of a ticket gains `redact_title`. The new event type `title_redacted` and the audit action `ticket.title_redacted` are added to the closed lists in `@trybun/contracts`.

### Permissions

| §7.5 row | Rule |
|---|---|
| "Redact a title, a description or any comment" (extended row) | `Ticket` `redact_title`, Developer and above, as `redact_description` (S1-12) |

`tickets.abilities.spec.ts` gets an allowed case (Developer) and a denied case (end user, also the requester) for `redact_title`.

### UI

- **Team ticket view** (S1-10): the title in the header gets a "⋯" menu (44 px, no hover-only action, [§13.4](../../docs/spec/13-non-functional.md)) with **Redact title**, shown exactly when `allowedActions` contains `redact_title` ([§18.5](../../docs/spec/18-code-patterns.md)).
- **Redaction dialog**: a `Dialog` (bottom sheet on phones), built like S1-12's redaction dialog – text field instead of the editor, the earlier titles as checkboxes. Strings in the `tickets` namespace, EN and PL.
- **Sharing approval** (S1-11): the approval dialog's reminder to check the content names the title and links to **Redact title**, so the shortest path to a clean shared ticket stays inside the approval flow (Rule 2).
- **User documentation** (Rule 3, EN and PL): the redaction section of S1-12's team help page covers titles; S1-16's "Personal data in Trybun" page and the **Complete** dialog drop the "titles cannot be redacted yet" limitation. No product tour (Rule 4: the tours of Stage 1 come with S1-18).

### Edge cases

- **Two team members redact at once:** the second gets `412` and the conflict message ([§17.2](../../docs/spec/17-conventions.md)).
- **Some titles kept:** unselected events keep their values. An earlier title can still appear as the `to` of a kept event; the dialog shows each title once per event, so the redactor sees what stays.
- **Requester edits the title after a redaction:** a normal edit, a new `title_changed` event with the redacted title as `from`.
- **Anonymization of a person who renamed the ticket:** S1-16's rewrite replaces the actor; the values of a redacted event are already `null`, so both rewrites compose in either order.
- **Event types other than `title_changed` in the list:** `422 field.invalid_value`; nothing changes.

### Research

- **GitHub** shows every rename as a timeline event with the old and new title; its edit-history deletion covers issue bodies and comments, not renames.
- **Jira** keeps summary changes in the issue history, which users cannot edit.
- **Zendesk** redacts text in ticket comments and attachments; the subject is changed by an edit, which stays in the ticket's audit.

As far as their public documentation shows, none of them redacts the title history. Trybun needs it because its history is immutable by design and [§13.2](../../docs/spec/13-non-functional.md) promises redaction as the answer to personal data in free text.

## Changes to the system specification

| Section | Change |
|---|---|
| §4.5 | Events stay immutable except two guarded rewrites: anonymization (S1-16) and title redaction, which sets the values of the selected `title_changed` events to `null` and records "Content redacted" (Q2, Q3) |
| §5.2 "Redaction" | The team can redact a ticket title, description or any comment; for a title, the selected earlier titles are removed from the activity history |
| §6.1 "Redacting" | Titles are redacted with the same rules; their history lives in `title_changed` events, not in content revisions (Q2) |
| §7.5 | Row "Redact a description or any comment" becomes "Redact a title, a description or any comment" (Q5) |
| §13.2 | "Ticket and comment content remains, but the team can redact it" now includes titles; free text is still not changed by anonymization or retention |
| §13.5 | The audit list names the redaction of titles (`ticket.title_redacted`) |
| §17.2 / contracts | Activity events referencing another ticket never store its title; outbox payloads and `Idempotency-Key` replays never carry a title (Q7) |

New or changed glossary terms (code identifier, EN/PL labels):

- **Redaction**: "Team action that replaces a title, description or comment and purges its earlier versions, leaving a 'Content redacted' event".
- `activity_event.type` value `title_redacted` – "Content redacted" / „Treść zredagowana”.
- Ticket action `redact_title` – "Redact title" / „Zredaguj tytuł”.

## Open questions

Implementation must not start until every question has an answer. Every answer below is a **proposal awaiting human approval**; the design above already assumes them.

1. ⚠ NEEDS HUMAN CONFIRMATION **Which plan task implements it.** S1-16 Q15 proposes a new task; its alternative is to put it into S1-16. Extending S1-12 is also possible, but S1-12 runs before S1-16 builds the guarded rewrite. — **Answer (proposed, awaiting approval):** a **new Stage 1 task** "Title redaction" in the group after S1-16 (it needs S1-05's events, S1-12's redaction dialog and S1-16's trigger change), with the "Done when": *after a redaction with the default selection no row of `tickets`, `activity_events` or `outbox_events` contains a removed title · an update of an activity event other than the two guarded rewrites is refused · an end user gets `403` for `redact_title`*. The maintainer assigns the number and changes the plan (#130 proposes S1-20, so the next free one). Alternatives: (a) inside S1-16, as its Q15 alternative (one more endpoint and dialog, same mechanism); (b) inside S1-12, which then builds the trigger exception before S1-16.
2. ⚠ NEEDS HUMAN CONFIRMATION **Where the title history lives.** S1-05 Q11 stores title values in events, and §4.5 requires the previous and new value of every field. — **Answer (proposed, awaiting approval):** keep S1-05's model and redact by a second guarded rewrite of the `title_changed` events, as S1-16 Q15 proposes. It relaxes §4.5's immutability once more, limited by the database to one event type and one value. Alternative: `title_changed` stores no values (like `description_edited`) and earlier titles become content revisions with a field discriminator; redaction then reuses S1-12's purge and needs no trigger change, but it changes S1-05's model and S1-12's `content_revisions`, and the timeline loses "old → new" for titles.
3. **What a redacted event looks like, and what the redaction records.** §4.5 forbids deleting events and records the previous and new value of every field change. — **Answer (proposed, awaiting approval):** the event stays with author, time and type; its values become `null` (the `title_changed` data schema of S1-05 widens to `string | null`, and every reader handles `null`), shown as "changed the title (redacted)". The redaction itself writes `title_redacted` without values, not a `title_changed` with the replaced title – the same exception §4.5 already makes for descriptions. Alternative: a marker `{ "redacted": true }` in `data` (more explicit, one more shape for readers of events).
4. **What a redaction keeps, and its limits.** — **Answer (proposed, awaiting approval):** as S1-12 Q9: the replaced title is never stored, every earlier title is preselected, and the team may keep some. At most 1000 event IDs per request, as S1-12 Q19 for revisions; a ticket renamed more often is redacted in several requests, and the dialog says so. Alternative: always purge every title event of the ticket (a flag instead of a list, no limit, but against "selected" in §6.1).
5. **Who redacts.** — **Answer (proposed, awaiting approval):** Developer and above, the existing §7.5 redaction row extended to titles; a new action `redact_title` next to `redact_description`. End users edit their own title but never remove its history.
6. **Timeline and audit.** — **Answer (proposed, awaiting approval):** an internal event `title_redacted` ("Content redacted", as S1-12's `description_redacted`) and the audit action `ticket.title_redacted`. Internal because `title_changed` is internal (S1-05) and end users never see the title history.
7. **Other copies of the title.** — **Answer (proposed, awaiting approval):** the rules of [Other copies of the title](#other-copies-of-the-title) become invariants in §17.2: ticket snapshots in events never carry a title (S1-06 Q13 already), outbox payloads and stored `Idempotency-Key` replays never carry one. Copies outside the database (e-mails, GitHub, webhook deliveries, backups) are named in the dialog and the help page, not recalled.
8. **Listing the title history.** — **Answer (proposed, awaiting approval):** an optional `type` filter on S1-05's `GET …/activity-events`, rather than a dedicated title-history endpoint. Alternative: `GET …/title-history` returning only the earlier titles.
9. **Link from the sharing approval.** S1-11 Q16 leaves redaction out and has the approval dialog remind the team. — **Answer (proposed, awaiting approval):** the reminder names the title and links to **Redact title**; S1-11's decision is unchanged, only its text and one link are added by this task.

## Acceptance criteria

- [ ] After a redaction with the default selection, no row of `tickets` or `activity_events` contains a removed title (integration test against PostgreSQL); the schemas of outbox payloads and stored `Idempotency-Key` replays have no title field (contract test)
- [ ] Each redacted `title_changed` event keeps its author, time and type, and the timeline shows "changed the title (redacted)"; the redaction appears as "Content redacted" in the team timeline and as `ticket.title_redacted` in the audit log
- [ ] The trigger refuses an update of a `title_changed` event without the parameters, for another ticket, for an event not in the list, with any other `data`, or changing any other column; every other event type stays immutable
- [ ] A redaction with a stale `If-Match` returns `412` and changes nothing, also when another title change happened after the dialog opened; an event ID of another type or ticket returns `422 field.invalid_value`; a request that changes nothing returns `200` without an event
- [ ] Title redaction and S1-16's anonymization of a person who renamed the ticket give the same result in either order
- [ ] An end user (including the requester) gets `403` for `redact_title`; an invisible ticket returns `404`; an archived project refuses the action
- [ ] No notification is sent by a redaction
- [ ] Works on phone, tablet and desktop (Rule 9)
- [ ] User documentation and product tour updated where relevant (Rules 3, 4)

## Implementation plan

Each step leaves the application working.

1. **Contracts**: `redact_title` action, `title_redacted` event type, `ticket.title_redacted` audit action, `redactTitleSchema`, nullable values in the `title_changed` data schema, the `type` filter of the activity events query. Catalogue texts EN and PL.
2. **Database**: migration extending S1-16's trigger function with the title-redaction rule; `redactTitleEvents` in `activity-events.sql.ts`. Migration test for every refused case of the acceptance criteria (no parameters, other ticket, event not listed, other `data`, other column changed, other event type, parameters after their reset).
3. **Use case and endpoint**: `POST …/title-redaction` in the tickets module with `If-Match`, the ability rule, the audit entry and the event in one transaction; `type` filter on the activity events endpoint. Integration tests for the acceptance criteria above.
4. **Web**: "⋯" menu and redaction dialog in the team ticket view, link from the sharing approval dialog, timeline text for redacted events; component stories and an E2E with axe on phone, tablet and desktop.
5. **Documentation**: help pages EN and PL; remove the S1-16 limitation texts; system specification changes of the table above in the same PR (Rule 8).

## Changelog

- 2026-10-26 – Created from S1-16 Q15 ([#126](https://github.com/trybun/trybun/pull/126)).
