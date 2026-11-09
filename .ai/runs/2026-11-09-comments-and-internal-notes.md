# Execution plan — implement comments and internal notes (S1-12)

Source doc: .ai/specs/implemented/2026-10-26-comments-and-internal-notes.md
Spec PR: #122 (merged)

## 🎯 Goal

Implement the approved S1-12 specification: public comments with a stored audience and internal notes, `@mentions` limited to people who see the ticket and the comment, content revisions of comments and descriptions with redaction, the requester-reply status rules of §4.3, rejection and sharing-refusal reasons published as public comments (with the temporary columns migrated and dropped), and the comment UI in the team ticket view and the portal.

## Scope

- Server: new modules `comments` (with the service-only `CommentsCoreModule`) and `content-revisions`; `tickets` (comment creation, requester replies, reasons, description revisions and redaction), `activity-events` (comment event types, the end-user shaping moved into the module), `attachments` (comment parent and every draft site), `audit-log-entries`, the ability factory's clock (Q21, with an ADR), migrations, demo dataset.
- Contracts: comments, content revisions, tickets, attachments, activity events, errors; i18n catalogues.
- Packages: `@trybun/markdown` (`rehypeMentions`, footnote heading IDs), `@trybun/ui` (`MarkdownEditor` mention suggestions, `Markdown` mentions).
- Web: `features/comments/`, the team ticket view (S1-10), the portal ticket view (S1-09) with title and description editing.
- Docs: the `docs/spec/` changes of the spec's change table, the plan row, the ADR, user documentation (EN, PL).

## Non-goals

Everything the spec lists under Non-goals: notifications, watchers and live updates (S1-15), e-mail replies (S2-12), mentions in descriptions (Q5), GitHub-imported comments (Stage 3), SLA first response (S4), anonymization and export (S1-16), integration tokens (S6-02), ticking task-list items, search in comments (S2-03), `Idempotency-Key` (S6-01), a product tour (S1-18).

## Risks

- The comment audience decides what every end user reads. Lists equal details, the property test over the demo dataset and a denied case per rule guard it.
- Dropping `tickets.rejection_reason` and `tickets.sharing_refusal_reason` is forward-only; the copy migrations run before the drops and never abort.
- The ability factory gains the clock (a pattern change, ADR); every existing rule set must keep its behaviour.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Model, rules and reading

- [x] 1.1 Add the comment contracts, error codes and actions — 4fef7c5
- [x] 1.2 Add the comment migrations, Prisma models and factories — 930a36b
- [x] 1.3 Inject the clock into the ability factory with its ADR — c42455d
- [x] 1.4 Add the comment abilities and the attachment rules of comments — 7c24b23
- [x] 1.5 Add the comment list, detail and the merged timeline — 38f99b5

### Phase 2: Writing

- [x] 2.1 Add comments with the audience and attachments — c356550
- [x] 2.2 Add mentions with their scope and suggestions — 0c1ca00
- [x] 2.3 Edit comments and descriptions with content revisions — 2dbf624
- [x] 2.4 Delete comments — 66943aa
- [x] 2.5 Redact comments and descriptions — 885745e

### Phase 3: Status rules and reasons

- [x] 3.1 Apply the requester-reply rules — 3be25ab
- [x] 3.2 Publish rejection reasons as comments and migrate the column — 212d609
- [x] 3.3 Publish sharing refusal reasons as comments and migrate the column — b0c349a

### Phase 4: Web and documentation

- [x] 4.1 Render and suggest mentions in the Markdown editor — 098ecbe, aff4be8, 15201f2
- [ ] 4.2 Add comments to the team ticket view
- [ ] 4.3 Add comments and editing to the portal
- [ ] 4.4 Write the user documentation and extend the demo dataset
- [ ] 4.5 Apply the specification changes and move the spec to implemented

### Phase 5: Review

- [ ] 5.1 Apply the code review findings
