# 12 – Public API, outgoing webhooks and data import

## 12.1 API

- **Versioned REST API** with the version in the path (`/api/v1/...`). Breaking changes are introduced only in a new version; the previous version is deprecated with `Deprecation` and `Sunset` headers and kept for at least one more MAJOR product version (Rule 11, [§2.11](02-agent-rules.md)).
- **OpenAPI documentation** generated automatically from the code and published with the API.
- Conventions (Rule 1):
  - cursor-based pagination,
  - errors in the *Problem Details* format (RFC 9457),
  - rate limits with information in response headers,
  - support for the `Idempotency-Key` header when creating resources, so a retried request does not create a duplicate.
- The public API is **the same API** the web application uses. Permissions and visibility work identically ([§14.4](14-architecture.md)).

## 12.2 Tokens

| Kind | Owner | Acts with the permissions of | Created by |
|---|---|---|---|
| **Personal access token** | team member | the token owner (limited by the token scope) | Developer and above, for themselves |
| **Integration token** | project | the token scope | Administrator |

- Every token has a **scope** (e.g. create tickets only) and an **expiration date**.
- A token is displayed **only once** at creation and stored as a hash ([§13.5](13-non-functional.md)).
- Tokens can be revoked at any time. Token usage (last used date) is visible to the owner and the Administrator.

## 12.3 Integration tickets

- Tickets created with an integration token get source `integration`, type `bug` by default, start in status `new` and are visible to the team only.
- **Grouping of repeated errors** (pattern: Sentry): the application can send an error **fingerprint**. If an open ticket (non-terminal status) with the same fingerprint exists, the system does not create a new one; it increases its **occurrence count** and records the time of the last occurrence.
- An occurrence with the fingerprint of a ticket in a terminal status **reopens** it as a regression: the ticket moves to `new` (back to triage) and a "Regression" event is added to the activity timeline ([§4.5](04-ticket-lifecycle.md)).
- The occurrence count is shown in the list and can be used for sorting ([§8.1](08-team-views.md)).

## 12.4 Outgoing webhooks

- The Administrator defines a webhook: target URL, projects, subscribed events (e.g. `ticket.created`, `ticket.status_changed`, `comment.created`).
- Every event payload contains a `version` field of its format (Rule 11).
- Every request carries an **HMAC signature** in a header (pattern: GitHub) and a unique event identifier that lets the receiver skip duplicates.
- "At least once" delivery: failed deliveries are retried with exponential backoff.
- **Delivery log** with request payload, response and a "Redeliver" button.
- A webhook that keeps failing is disabled automatically and the Administrator is notified ([§6.6](06-comments-notifications.md)).
- Events may contain internal and personal data, so target receivers are added to the list of data processors ([§13.2](13-non-functional.md)).

## 12.5 Data import

### Sources

- **GitHub issues** – through the installed GitHub App ([§11.1](11-github-integration.md)).
- **CSV files** – e.g. when migrating from another tool.

### Import wizard

1. Choose the source and the target project.
2. **Column mapping** to ticket fields – matched automatically by name, adjustable.
3. **Value mapping** – statuses, priorities, types, labels; people matched by e-mail address.
4. **Preview** with a list of validation errors before the import starts.
5. The import runs in the background (Worker, [§14.1](14-architecture.md)); the Administrator is notified with a report when it finishes.

### Rules

- Original creation dates and authors are preserved. Every imported ticket has a link to its source and an "Imported" event in the activity timeline.
- People who do not exist in the system get **inactive accounts**. Invitations are not sent automatically (GDPR, [§13.2](13-non-functional.md)); the Administrator can send them manually.
- **Safe re-runs**: records are identified by their external ID, so re-running an import skips already imported records.
- **Undo import**: a whole import batch can be rolled back in one action within 7 days (in case of a wrong mapping), provided the imported tickets have not been modified in the meantime.
- Imports are performed by the Administrator.
