# 13 – Non-functional requirements

## 13.1 Internationalization

- The UI is available from the start in **English and Polish**. Further languages can be added without code changes, only by adding translation files.
- No UI text is hard-coded. All texts come from translation resources (Rule 1).
- Each user chooses their language in account settings. On first login it is set from the browser language; if unsupported, from the system default language (set by the Administrator, default Polish).
- Dates, times and numbers are formatted according to the user's locale and shown in the user's time zone.
- Also translated: public status names and descriptions ([§4.2](04-ticket-lifecycle.md)), e-mails (in the recipient's language), error and warning messages, templates ([§3.4](03-ticket-model.md)), product tours (Rule 4), login screens (Keycloak themes).
- Content entered by users (tickets, comments) is not translated.

## 13.2 Personal data protection (GDPR)

- **Right to erasure** is implemented as **anonymization** of the account: name and e-mail are removed and the author is shown as "Deleted user" (PL: „Użytkownik usunięty”). Ticket and comment content remains, but the team can redact it if it contains personal data. This reconciles the right to erasure with the immutable history ([§4.5](04-ticket-lifecycle.md)).
- A user submits a deletion request from account settings; the Administrator executes the anonymization (recorded in the audit log, [§13.5](#135-security)).
- **Right of access and portability**: users can download their data (account, tickets, comments, attachments) in a machine-readable format (JSON), self-service.
- **Retention period**: the Administrator sets after what time since a ticket reached a terminal status the personal data in it is anonymized automatically.
- **Data processors**: the list of external services processing data (e.g. GitHub, e-mail provider, hosting, webhook receivers) is maintained in the system documentation. Rules for transferring data to GitHub: [§11.6](11-github-integration.md).
- Personal data never goes into technical logs.

## 13.3 Attachments

- Maximum file size configurable by the Administrator (default 25 MB).
- Allowed file types are defined by an allowlist, e.g. images, PDF, office documents, text and log files, ZIP archives. Other types are rejected.
- Files are uploaded through the API into a **quarantine** area and every file is **scanned for malware** by ClamAV in the Worker before it becomes available. Until the scan completes, the file is shown as "Checking…" (PL: „Sprawdzanie…”); infected files are deleted and the uploader is informed.
- EXIF metadata (including GPS location) is stripped from images.
- Files are stored in S3-compatible object storage ([§14.2](14-architecture.md)), never in a public directory. Access to every file is checked against the ticket's visibility ([§5.1](05-visibility-and-search.md)) and the comment kind ([§6.1](06-comments-notifications.md)); after the check the API issues a **short-lived signed URL** (e.g. 5 minutes) for the download.
- Files other than images are served as downloads, not opened directly in the browser.

## 13.4 Accessibility

- Compliance with **WCAG 2.1 level AA**.
- Touch targets of at least 44 × 44 px on phones and tablets (Rule 9, [§2.9](02-agent-rules.md)).
- Full keyboard operation, visible focus, sufficient contrast, labels for screen readers.
- Every drag-and-drop operation (Kanban, roadmap, Gantt chart) has an alternative without dragging, e.g. a context menu or keyboard shortcut (WCAG 2.2 criterion 2.5.7).
- Information is never conveyed by color alone (e.g. SLA states and internal notes also have an icon or text).

## 13.5 Security

- Reference for security requirements: **OWASP ASVS** (Rule 1).
- Dependencies are monitored for vulnerabilities and kept up to date according to Rule 10 ([§2.10](02-agent-rules.md)).
- HTTPS only, with HSTS.
- Security headers set in one place: a strict Content Security Policy with nonces (Next.js), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` with only the features used, and framing denied (`frame-ancestors 'none'`).
- Protection against brute-force login attempts (rate limiting), expiry of inactive sessions, CSRF protection.
- Secrets (e.g. the GitHub App private key) are kept out of code and the repository, in a secure secret store / environment configuration ([§15.3](15-deployment.md)).
- API tokens ([§12.2](12-api-webhooks-import.md)) are stored only as hashes, like passwords.
- **Administrative audit log**: changes of roles, organizations, SLA policies, templates, integration configuration, creation and revocation of tokens, webhook configuration, imports and their rollbacks, and account anonymizations are recorded with author and timestamp. The log is immutable and available to the Administrator.

## 13.6 Reliability and backups

- Automatic backups of the database and the object storage at least once a day, encrypted and stored in a different location than the system ([§15.10](15-deployment.md)).
- Backup retention configurable (default 30 days).
- Regular restore tests from backups.
- Availability monitoring (health checks) and structured technical logs. The API health endpoint (`/health`) also reports the system version (Rule 11).
