# 13 – Non-functional requirements

## 13.1 Internationalization

- The UI is available from the start in **English and Polish**. Further languages can be added without code changes, only by adding translation files.
- No UI text is hard-coded. All texts come from translation resources (Rule 1).
- Each user chooses their language in account settings. On first login it is set from the browser language; if unsupported, from the system default language (set by the Administrator, default Polish).
- The language is never part of the URL. The web application takes the language of a request from the language chosen in the application (the `NEXT_LOCALE` cookie, set by the language switch), else from the browser language (`Accept-Language`), else from the system default language (`TRYBUN_DEFAULT_LANGUAGE`). Switching the language renders the current page again with every text in the new language, without loading another URL. The sign-in passes the language to Keycloak (`ui_locales`), so the login screen appears in the same language.
- Dates, times and numbers are formatted according to the user's locale and shown in the user's time zone; until the user has set one, in the system default time zone (`TRYBUN_DEFAULT_TIME_ZONE`, an IANA name).
- Also translated: public status names and descriptions ([§4.2](04-ticket-lifecycle.md)), e-mails (in the recipient's language), error and warning messages, templates ([§3.4](03-ticket-model.md)), product tours (Rule 4), login screens (Keycloak themes).
- Content entered by users (tickets, comments) is not translated.
- Every catalogue has exactly the keys of the English one, with valid ICU messages and the same arguments; CI fails on a missing, extra or malformed translation and on a key used in code that the catalogues do not define.

## 13.2 Personal data protection (GDPR)

- **Right to erasure** is implemented as **anonymization** of the account: name and e-mail are removed and the author is shown as "Deleted user" (PL: „Użytkownik usunięty”). Ticket and comment content remains, but the team can redact it if it contains personal data ([§6.1](06-comments-notifications.md)). This reconciles the right to erasure with the immutable history ([§4.5](04-ticket-lifecycle.md)).
- **Data processors**: the list of external services processing data (e.g. GitHub, e-mail provider, hosting, webhook receivers) is maintained in the system documentation. Rules for transferring data to GitHub: [§11.6](11-github-integration.md).
- Personal data never goes into technical logs, except the pseudonymous identifiers allowed in [§13.5](#135-security).

### Deletion requests

1. A user submits a deletion request from account settings. The account is **deactivated immediately** ([§7.4](07-users-organizations-permissions.md)), the Administrator receives an in-app and e-mail notification ([§6.6](06-comments-notifications.md)), and the request is recorded in the audit log ([§13.5](#135-security)).
2. A request has the state `requested`, `completed` or `rejected`. A rejection requires a reason, which is sent to the user (e.g. a legal obligation to keep the data).
3. The Administrator completes the request within **30 days** (GDPR Art. 12(3)); the request shows its due date, and the Administrator is reminded 7 days before it.
4. Completing the request executes the anonymization described below.

### Anonymization

Anonymization of an account affects every store of personal data:

| Store | Effect |
|---|---|
| Account (name, e-mail, language, time zone, GitHub login, avatar) | Removed; the account becomes a tombstone shown as "Deleted user" |
| Keycloak user and its linked identities (GitHub, Google, Microsoft) | Deleted |
| Personal access tokens, sessions | Revoked and deleted |
| Saved views, notification settings, notifications, watcher entries | Deleted |
| Attachments uploaded by the user | Deleted |
| Tickets and comments authored by the user | Content kept; author shown as "Deleted user"; edit-history revisions of the user's own text are purged ([§6.1](06-comments-notifications.md)) |
| Activity events and audit log entries | Kept; actor and person references point to the tombstone |
| Outgoing webhook delivery logs | Payloads containing the user are purged; they are never redelivered after anonymization ([§12.4](12-api-webhooks-import.md)) |
| Search index and embeddings ([§5.6](05-visibility-and-search.md)) | Recomputed from the anonymized data |
| Backups ([§13.6](#136-reliability-and-backups)) | Not modified; the data expires with the backup retention, which is stated in the privacy information |

### Retention period

- The Administrator sets, in months, after what time since a ticket reached a terminal status its personal data is anonymized automatically. Retention is **off by default**; the minimum value is 1 month.
- A daily Worker job processes tickets past the retention period: references to the requester and to other end-user participants (commenters, watchers) are replaced with the tombstone, and attachments uploaded by end users are deleted. Free-text content is not changed automatically; personal data in it is removed only by manual redaction ([§6.1](06-comments-notifications.md)).
- Each automatic anonymization run is recorded in the audit log.

### Right of access and portability

- Users download their data self-service as a **ZIP archive** prepared asynchronously: `data.json` with a versioned schema and an `attachments/` folder. The user is notified when it is ready; the download link is valid for 24 hours.
- The archive contains the account data, the tickets the user created (with their public comments and public events), the user's own comments and the files the user uploaded. Internal notes and internal events are never included; the content is filtered by the same permission rules as the UI ([§7.5](07-users-organizations-permissions.md)).

### Retention of technical records

| Record | Retention |
|---|---|
| Notifications | 90 days |
| Published outbox events ([§17.2](17-conventions.md)) | 7 days after publication |
| Completed background jobs ([§17.2](17-conventions.md)) | 24 hours |
| Failed background jobs ([§17.2](17-conventions.md)) | 30 days |
| Outgoing webhook delivery logs ([§12.4](12-api-webhooks-import.md)) | 30 days |
| Security and access logs with IP addresses, and the IP addresses of the administrative audit log ([§13.5](#135-security)) | 14 days |
| Keycloak login and admin events | 90 days |
| Administrative audit log | Kept for the lifetime of the installation; the IP address of an entry is removed after 14 days |

## 13.3 Attachments

How these requirements are built – upload, quarantine and scan, type detection, EXIF stripping, the purge of drafts and the download through the BFF – is recorded in [ADR 0008](../adr/0008-attachment-serving.md).

- Maximum file size configurable by the Administrator (default **25 MB per file**); at most **10 files per upload**.
- Allowed file types are a fixed allowlist of extensions: `png`, `jpg`, `jpeg`, `gif`, `webp`, `pdf`, `txt`, `log`, `csv`, `json`, `docx`, `xlsx`, `pptx`, `odt`, `ods`, `zip`. Other types are rejected.
- The file type is detected from the **file content** (magic bytes), not from the name or the type declared by the client. A file whose content does not match its extension, or is not on the allowlist, is rejected with the error code `attachment.type_not_allowed`. Encrypted ZIP archives are rejected, because they cannot be scanned.
- Only raster images (PNG, JPEG, GIF, WebP) are displayed inline. All other files are always served as downloads (`Content-Disposition: attachment`).
- Files are uploaded through the API into a **quarantine** area and every file is **scanned for malware** by ClamAV in the Worker before it becomes available. Until the scan completes, the file is shown as "Checking…" (PL: „Sprawdzanie…”). An infected file is deleted; the attachment shows "File removed: malware detected" (PL: „Plik usunięty: wykryto złośliwe oprogramowanie”) and the uploader receives an in-app notification.
- Every attachment has a state `attachment.status`: `quarantine` → `available` or `infected`.
- Files can be uploaded before the ticket or comment exists (e.g. dragged into the form). Such draft attachments belong to the uploader; if they are not linked to a ticket or comment within **24 hours**, a Worker job deletes them.
- EXIF metadata (including GPS location) is stripped from images.
- Files are stored in S3-compatible object storage ([§14.2](14-architecture.md)), never in a public directory, and the storage is never reachable from the browser. Files are downloaded only through the API endpoint `GET /api/v1/attachments/{id}/content`, which checks access against the ticket's visibility ([§5.1](05-visibility-and-search.md)), the comment kind and audience ([§6.1](06-comments-notifications.md)) and streams the file with:
  - `Content-Type` determined from the allowlist (never the value sent by the uploader),
  - `Content-Disposition` (`inline` for raster images, otherwise `attachment`),
  - `X-Content-Type-Options: nosniff`,
  - `Cache-Control: private`.
- GFM content references attachments by this stable path (`/api/v1/attachments/{id}/content`), never by a temporary URL. The renderer displays an image only if the referenced attachment belongs to the same ticket ([§6.2](06-comments-notifications.md)). E-mails show attachments as links, not as embedded images.

## 13.4 Accessibility

- Compliance with **WCAG 2.2 level AA**.
- Touch targets of at least 44 × 44 px on phones and tablets (Rule 9, [§2.9](02-agent-rules.md)).
- Full keyboard operation, visible focus, sufficient contrast, labels for screen readers.
- Every drag-and-drop operation (Kanban, roadmap, Gantt chart) has an alternative without dragging, e.g. a context menu or keyboard shortcut (WCAG 2.2 criterion 2.5.7).
- Information is never conveyed by color alone (e.g. SLA states and internal notes also have an icon or text).

## 13.5 Security

- Reference for security requirements: **OWASP ASVS** (Rule 1).
- Dependencies are monitored for vulnerabilities and kept up to date according to Rule 10 ([§2.10](02-agent-rules.md)).
- HTTPS only, with HSTS.
- Security headers set in one place – the proxy of the web application (`apps/web/src/proxy.ts`, [§18.5](18-code-patterns.md)) for every page – a strict Content Security Policy with nonces (Next.js), HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` with only the features used, and framing denied (`frame-ancestors 'none'`, `X-Frame-Options: DENY`). Keycloak sets its own headers on its sign-in pages.
  - The policy: `default-src 'self'`; scripts only with the nonce of the request (`script-src 'self' 'nonce-…' 'strict-dynamic'`, `'unsafe-eval'` only under `next dev`); style elements only with the nonce, style attributes allowed (`style-src-attr 'unsafe-inline'`: they cannot run scripts, and `next/image` and the positioning of overlays use them); images also from `data:` and `blob:`; `object-src 'none'`; `base-uri 'none'`; forms only to the web application and Keycloak; `upgrade-insecure-requests` on HTTPS.
  - Every page is rendered per request, because Next.js adds the nonce while rendering. Browser code never needs `eval`: Zod validates without compiling its schemas (`jitless`, set in `instrumentation-client.ts`).
- Passwords follow the password policy of [§7.4](07-users-organizations-permissions.md) (OWASP ASVS 5.0 V6, NIST SP 800-63B); its offline blocklist of common and breached passwords (`docker/keycloak/password-blocklists/`, from SecLists) is part of the deployment package and is updated with the dependencies (Rule 10); no password data is sent to an online breach service.
- Protection against brute-force login attempts (brute-force detection in Keycloak), rate limiting of the API ([§14.4](14-architecture.md)), expiry of inactive sessions, CSRF protection.
- Secrets (e.g. the GitHub App private key) are kept out of code and the repository, in a secure secret store / environment configuration ([§15.3](15-deployment.md)).
- API tokens ([§12.2](12-api-webhooks-import.md)) are stored only as hashes.
- Keycloak admin impersonation of users is disabled in the realm configuration.

### Logs

- Technical logs may contain **pseudonymous identifiers** (user, ticket, project and organization UUIDs). They never contain names, e-mail addresses, free text (ticket content, search queries), tokens or passwords ([§17.2](17-conventions.md)).
- IP addresses appear only in security and access logs and in the security events of the administrative audit log, all with the retention given in [§13.2](#132-personal-data-protection-gdpr).
- Access logs never record query strings, `Authorization` or `Cookie` headers. Secrets (invitation, setup and reply tokens) and search text are never placed in URL query strings.
- Keycloak login and admin events are enabled, with the retention given in [§13.2](#132-personal-data-protection-gdpr).

### Administrative audit log

The following are recorded with author, timestamp, target and (for security events) IP address. The log is immutable – except that the IP address of an entry is removed after 14 days ([§13.2](#132-personal-data-protection-gdpr)) – and available to the Administrator.

- An entry (`audit_log_entries`) holds the action (`resource.event`, [§17.1](17-conventions.md), e.g. `setup_token.used`), the acting account (none for the system), the target record (model name and ID), optional `details` and the client IP of a security event. It is written in the transaction of the change it records ([§18.3](18-code-patterns.md)). `details` (JSONB) holds further identifiers and non-personal values an entry with one target needs – e.g. the user and the role of a membership change – typed per action in `AuditLogEntriesService`, under the rule of outbox payloads: never content or personal data ([§18.3](18-code-patterns.md)); a user ID points to the tombstone after anonymization, like the acting account.
- Immutability is enforced by the database: a trigger refuses every `DELETE` and `TRUNCATE` of the table and every `UPDATE` except one that only sets the IP address of an entry to `NULL` – `details` included. A recurring job of the Worker removes, every hour, the IP addresses of the entries older than 14 days ([§17.2](17-conventions.md)); the entry itself is kept. The entries have no foreign keys, so they never block or follow the deletion of a record; anonymization keeps the IDs, which then point to the tombstone ([§13.2](#132-personal-data-protection-gdpr)).
- Recorded so far: the use of the setup token (`setup_token.used`, by the Administrator it created, with the client IP); the creation, archiving, unarchiving and deletion of a project (`project.created`, `project.archived`, `project.unarchived`, `project.deleted`; one deletion entry stands for the memberships it removes); adding a member, changing their role and removing them (`project_member.added`, `project_member.role_changed`, `project_member.removed`, target the project, `details` the user and the role – for a role change also the previous one). Changes of a project's name, key or resolution confirmation are not recorded. Each feature task adds the entries of its actions from the list below.

- Changes of roles, project membership, organizations and their members and e-mail domains, SLA policies, templates, integration configuration and GitHub repository linking.
- Creation and revocation of tokens, webhook configuration, imports and their rollbacks.
- Invitations issued, accepted and revoked; account deactivation and reactivation; use of the setup token and of the break-glass Administrator account.
- Visibility changes by the team, shared-ticket approvals and refusals ([§5.2](05-visibility-and-search.md)), redaction and deletion of comments by the team ([§6.1](06-comments-notifications.md)).
- Data exports, deletion requests and their outcome, account anonymizations and automatic retention runs ([§13.2](#132-personal-data-protection-gdpr)).
- Archiving and unarchiving of projects and organizations.

## 13.6 Reliability and backups

- Automatic backups of the database and the object storage at least once a day, encrypted and stored in a different location than the system ([§15.10](15-deployment.md)).
- Backup retention configurable (default 30 days).
- Restore tests: an automated restore test runs in CI for every release, and a manual restore test on a separate server is performed at least once a quarter.
  - The automated test (`scripts/restore-test.sh`, job "Restore test" of the release workflow, with exactly the scanned images and the deployment package of the release) installs the package, creates an end user in Keycloak, an object in the object storage and a setup token, backs up to an S3 storage outside the server, destroys the server (containers, volumes and folder), restores onto a new folder from the package, `.env` and the passphrase alone, and checks that the user signs in with the same ID and the objects and records are the same. A failure stops the release before anything is published ([§15.4](15-deployment.md)).
  - The quarterly manual test follows the user documentation "Restore a backup" on a separate server with the backups of the external S3 storage and checks a sign-in with 2FA and the stored files.
- Availability monitoring (health checks) and structured technical logs. Health endpoints (`/health`, `/health/ready`) are defined in [§17.2](17-conventions.md); `/health` also reports the system version (Rule 11).
