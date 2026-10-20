# 12 – Public API, outgoing webhooks and data import

## 12.1 API

- **Versioned REST API** with the version in the path (`/api/v1/...`). Breaking changes are introduced only in a new version; the previous version is deprecated with `Deprecation` and `Sunset` headers and kept for at least one more MAJOR product version (Rule 11, [§2.11](02-agent-rules.md)).
- **OpenAPI documentation** generated automatically from the code and published with the API.
- Conventions (Rule 1):
  - cursor-based pagination,
  - errors in the *Problem Details* format (RFC 9457) with stable error codes, the same as in the internal API ([§17.2](17-conventions.md)),
  - rate limits with information in response headers,
  - support for the `Idempotency-Key` header when creating resources, so a retried request does not create a duplicate.
- The public API is **the same API** the web application uses. Permissions and visibility work identically ([§14.4](14-architecture.md)).

## 12.2 Tokens

| Kind | Owner | Acts with the permissions of | Created by |
|---|---|---|---|
| **Personal access token** | team member | the token owner, limited by the token scope | Developer and above, for themselves |
| **Integration token** | project | the integration principal of the token, limited by the token scope | Administrator |

- Every token has a **scope** and an **expiration date** of at most **1 year**.
- Scopes are a closed list defined in `@trybun/contracts`: `tickets:read`, `tickets:write`, `comments:write`, `integration:report`. New scopes are added by changing this list.
- **Effective permissions** of a personal access token are the intersection of its scope and the owner's **current** permissions ([§7.5](07-users-organizations-permissions.md)): when the owner loses a role, the token loses it too.
- An **integration token** acts as a system principal of its project (shown as the integration's name in the activity timeline). With `integration:report` it may create integration tickets and report occurrences ([§12.3](#123-integration-tickets)); with `tickets:read` it may read only tickets with source `integration` of its project. It never reads internal notes or tickets of end users.
- Token format: a prefix identifying the kind (`trybun_pat_…`, `trybun_int_…`) followed by a random secret of at least 128 bits. The prefix allows secret scanning to detect leaked tokens.
- A token is displayed **only once** at creation and stored as a **SHA-256 hash** ([§13.5](13-non-functional.md)).
- Tokens can be revoked at any time. Token usage (last used date) is visible to the owner and the Administrator.

## 12.3 Integration tickets

- Tickets created with an integration token get source `integration`, type `bug` by default, start in status `new` and are visible to the team only.
- **Grouping of repeated errors** (pattern: Sentry): the application can send an error **fingerprint**. Fingerprints are scoped **per project**. If an open ticket (non-terminal status) with the same fingerprint exists, the system does not create a new one; it increases its **occurrence count** and records the time of the last occurrence.
- At most one open ticket per project and fingerprint exists, also when occurrences arrive concurrently (enforced by the database); the occurrence count is incremented atomically.
- An occurrence with the fingerprint of a ticket in a terminal status (when no open ticket exists):
  - `done` – the most recent such ticket is **reopened** as a regression: it moves to `new` (back to triage) and a "Regression" event is added to the activity timeline ([§4.5](04-ticket-lifecycle.md));
  - `rejected` – no reopen; only the occurrence count and the time of the last occurrence are updated;
  - `duplicate` – the occurrence is counted on the original ticket, following the "duplicate of" relation ([§3.5](03-ticket-model.md)).
- The occurrence count is shown in the list and can be used for sorting ([§8.1](08-team-views.md)).

## 12.4 Outgoing webhooks

- The Administrator defines a webhook: target URL, projects, subscribed events (e.g. `ticket.created`, `ticket.status_changed`, `comment.created`).
- **SSRF protection**: target URLs must use HTTPS; addresses in private, loopback, link-local and cloud-metadata ranges are rejected, both when the webhook is saved and when each delivery is sent (including after redirects and DNS resolution).
- Every event payload contains a `version` field of its format (Rule 11).
- Every request carries an **HMAC signature** in a header (pattern: GitHub) and a unique event identifier that lets the receiver skip duplicates.
- "At least once" delivery: failed deliveries are retried with exponential backoff.
- **Delivery log** with request payload, response and a "Redeliver" button. Delivery logs are kept for 30 days ([§13.2](13-non-functional.md)); deliveries containing data of an anonymized user are never redelivered.
- A webhook is **disabled automatically** after 15 consecutive failed delivery attempts or when deliveries have failed continuously for 3 days, and the Administrator is notified ([§6.6](06-comments-notifications.md)).
- Webhooks of an archived project stop sending ([§7.3](07-users-organizations-permissions.md)).
- Events may contain internal and personal data, so target receivers are added to the list of data processors ([§13.2](13-non-functional.md)).

## 12.5 Data import

### Sources

- **GitHub issues** – through the installed GitHub App ([§11.1](11-github-integration.md)).
- **CSV files** – e.g. when migrating from another tool. CSV files follow the size limit of attachments ([§13.3](13-non-functional.md)).

### Import wizard

1. Choose the source and the target project.
2. **Column mapping** to ticket fields – matched automatically by name, adjustable.
3. **Value mapping** – statuses, priorities, types, labels; people matched by e-mail address.
4. **Preview** with a list of validation errors before the import starts.
5. The import runs in the background (Worker, [§14.1](14-architecture.md)); the Administrator is notified with a report when it finishes.

### Rules

- Original creation dates and authors are preserved. Every imported ticket has a link to its source and an "Imported" event in the activity timeline; content attributed to existing users by e-mail matching is marked "Imported – originally by <name>" and the import is recorded in the audit log ([§13.5](13-non-functional.md)).
- **Source and visibility** of imported tickets: tickets imported from GitHub issues get source `developer`; for CSV the source is mapped explicitly in the wizard (default `developer`). Imported tickets always get visibility `only_me` and are never shared; the visibility column cannot be mapped. The organization is taken from the matched requester's membership.
- People who do not exist in the system get **inactive accounts**. Invitations are not sent automatically (GDPR, [§13.2](13-non-functional.md)); the Administrator can send them manually.
- **Safe re-runs**: records are identified by their external ID, so re-running an import skips already imported records.
- **Undo import**: a whole import batch can be rolled back in one action within 7 days (in case of a wrong mapping). This is the only exception to the rule that tickets are never deleted ([§17.2](17-conventions.md)):
  - undo is possible only if no ticket of the batch has any activity event other than "Imported";
  - the tickets of the batch are deleted physically; their numbers are retired and never reused, so a gap in numbering is accepted;
  - inactive accounts created by the batch that have no other activity are deleted;
  - the external IDs of the batch are removed, so a later re-run imports the records again;
  - the undo is recorded in the audit log.
- Imports are performed by the Administrator.
