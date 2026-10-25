# 0008 – Attachment serving

- Status: proposed
- Date: 2026-10-25
- Deciders: the maintainer (`@dtk7c2`)
- Specification: [§13.3](../spec/13-non-functional.md), [§13.5](../spec/13-non-functional.md), [§14.2](../spec/14-architecture.md), [§14.4](../spec/14-architecture.md), [§17.2](../spec/17-conventions.md), [§18.3](../spec/18-code-patterns.md)
- Change specification of the gaps found: [`.ai/specs/2026-10-25-attachment-serving.md`](../../.ai/specs/2026-10-25-attachment-serving.md)

## Context and problem statement

The specification fixes **what** happens to an attachment ([§13.3](../spec/13-non-functional.md), [§14.4](../spec/14-architecture.md)): uploads through the API into a quarantine area of an S3-compatible object storage, a fixed allowlist with type detection from the content, a ClamAV scan in the Worker before the file becomes `available` (`attachment.status`: `quarantine` → `available` or `infected`), EXIF stripping, draft attachments purged after 24 hours, and downloads only through `GET /api/v1/attachments/{id}/content`, which checks access and streams the file with forced headers. The libraries are named in [§14.2](../spec/14-architecture.md): `@aws-sdk/client-s3`, ClamAV over TCP with the `clamscan` client, `file-type`, `sharp`.

It does not fix **how** these pieces fit together: how the browser reaches the stable path through the BFF of `web` without a token, where the quarantine is in the storage and how a file leaves it, what the scan job does when ClamAV fails, and how inline images get past the Content Security Policy of [§13.5](../spec/13-non-functional.md). This ADR records that design for S1-08 (and the comment-audience checks of S1-12).

The state on 2026-10-25 (versions pinned in the repository, the latest stable libraries on npm):

- **Storage**: SeaweedFS 4.48 (`compose.yaml`, profile `seaweedfs`; one S3 identity from `TRYBUN_S3_ACCESS_KEY_ID`/`_SECRET_ACCESS_KEY`, anonymous requests get 403); an external S3 storage replaces it ([§15.3](../spec/15-deployment.md)). Its S3 API supports `CopyObject`, multipart uploads, range and conditional `GetObject`, and lifecycle configuration without transition rules ([SeaweedFS wiki: Amazon S3 API](https://github.com/seaweedfs/seaweedfs/wiki/Amazon-S3-API)). The backup service copies the whole storage with rclone (`RCLONE_CONFIG_OBJECTS_*`, [§15.10](../spec/15-deployment.md)).
- **Scanner**: `clamav/clamav:1.5.4` (profile `clamav`, internal network plus `outbound` for `freshclam`, 3 GB memory limit). The image listens on TCP 3310 and is configured only by mounting files over `/etc/clamav` ([ClamAV docs: Docker](https://docs.clamav.net/manual/Installing/Docker.html)). Defaults of `clamd.conf` 1.5.4 ([`clamd.conf.sample`](https://github.com/Cisco-Talos/clamav/blob/clamav-1.5.4/etc/clamd.conf.sample)): `StreamMaxLength 100M` (clamd closes the connection above it), `MaxFileSize 100M` and `MaxScanSize 400M` (data above them is **not scanned**), `AlertExceedsMax no` (so such a file is reported clean), `AlertEncryptedArchive no`, `MaxThreads 10`, `ReadTimeout 120`.
- **Libraries** (not yet dependencies; S1-08 adds them under Rule 10):
  - `file-type` 22.2.0 (MIT, sindresorhus, released 2026-10-14, ESM only, Node ≥ 22 – the server is ESM on Node 24). It detects `png`, `jpg`, `gif`, `webp`, `pdf`, `zip`, `docx`, `xlsx`, `pptx`, `odt`, `ods` and `cfb` (the container of encrypted Office files); it does **not** detect plain text, CSV or JSON, which have no magic bytes. It does not report ZIP encryption.
  - `yauzl` 3.4.0 (MIT, released 2026-06-07): reads the central directory of a ZIP through a random-access reader and reports `entry.isEncrypted()`.
  - `sharp` 0.35.5 (Apache-2.0, released 2026-09-27): removes all metadata – EXIF including orientation, XMP, IPTC, ICC – unless `keepMetadata`/`withMetadata` is asked for; defaults `autoOrient: false`, `animated: false` (first frame only), `limitInputPixels: 268402689`, `failOn: 'warning'`.
  - `clamscan` 2.4.0 (MIT, no dependencies, about 230,000 downloads a week): `scanStream` speaks the clamd `INSTREAM` protocol over TCP. Its last release and its last commit are from **2024-10-21** – see "Open questions".
  - `@aws-sdk/client-s3` and `@aws-sdk/lib-storage` 3.1156.0 (Apache-2.0): `Upload` streams a body of unknown length as a multipart upload.
  - `multer` 2.5.0 (MIT), used by `FileInterceptor`/`FilesInterceptor` of `@nestjs/platform-express` 12, accepts a custom storage engine that receives each file as a stream.
- **BFF** (`apps/web/src/lib/bff/bff-proxy.ts`): forwards request bodies as streams (`duplex: 'half'`) and returns `response.body` as a stream, keeps the response headers except hop-by-hop ones, `content-encoding`, `content-length` and `set-cookie`, and attaches the session's access token. The proxy of `apps/web/src/proxy.ts`, which sets the CSP, does not run for `/api/` (it would buffer upload bodies). The CSP allows `img-src 'self' data: blob:`. The API does not compress responses.

## Decision drivers

- [§13.3](../spec/13-non-functional.md) and [§14.4](../spec/14-architecture.md): the storage is never reachable from the browser; every download passes the API's access check (ticket visibility, comment kind and audience, invisible records 404) and gets the API's headers; GFM refers only to the stable path.
- [§14.4](../spec/14-architecture.md): tokens never reach the browser; the web server never caches per-user API data across requests.
- [§17.2](../spec/17-conventions.md): nothing is released unscanned; while ClamAV is unavailable files stay in quarantine; side effects start from the outbox; jobs are idempotent.
- [§18.3](../spec/18-code-patterns.md): the object storage and ClamAV are adapters; retries are BullMQ retries, never loops in request handlers.
- Memory limits of [§15.9](../spec/15-deployment.md): the API and the Worker never hold whole files (up to 10 × 25 MB per upload) in memory.
- Rule 1 and Rule 12: the established mechanisms of NestJS, S3 and BullMQ; no second way of solving a covered problem.

## Considered options

### A. Downloads

1. **Streamed by the API through the BFF** – the browser requests the stable path from `web`, the BFF attaches the token, the API checks access and pipes the object from the storage.
2. **Presigned URLs of the object storage** – the API checks access and answers with a redirect to a short-lived signed `GetObject` URL.
3. **Internal redirect in the reverse proxy** – the API answers with a header (`X-Accel-Redirect` style) and Caddy fetches the object itself.

### B. Quarantine and available areas

1. **Two prefixes in one bucket** – `quarantine/{id}` and `available/{id}`, the move after the scan as copy (or re-encoded write) and delete.
2. **Two buckets** – `trybun-quarantine` and `trybun-attachments`.
3. **One object, status only in the database** – the key never changes; only `attachment.status` separates the areas.

### C. Where the type is detected

1. **In the API during the upload request**, from the object already streamed into quarantine.
2. **In the API from a sample of the request stream** before anything is stored.
3. **In the Worker together with the scan**.

## Decision outcome

**A1, B1, C1**, built as follows.

### Upload (API)

- `POST /api/v1/attachments` (multipart, at most 10 files, through the BFF, which streams the body and applies the CSRF `Origin` check) uses `FilesInterceptor` with a **custom multer storage engine** of the attachments module: each file is streamed with `@aws-sdk/lib-storage` `Upload` to `quarantine/{id}` (`id` a new UUID generated before the upload; the key never contains the file name). multer's `limits.fileSize` (the configured maximum) and `limits.files` stop an oversized request while it streams; a stopped upload is aborted and its object deleted.
- **Type detection (C1)**: after the upload, `file-type` (`fileTypeFromStream` on the object's `GetObject` body, which reads only the bytes it needs and is then closed) gives the detected format. The file is accepted only when the detected format belongs to the extension of the file name in the allowlist (`jpg`/`jpeg` are one format); otherwise the object is deleted and the request fails with `attachment.type_not_allowed`. A `zip` is opened with `yauzl` through a random-access reader over ranged `GetObject` requests; any encrypted entry rejects it. Password-protected Office files are CFB containers, so they fail the type check. For `txt`, `log`, `csv` and `json` no magic bytes exist: the proposed rule is in the change specification (open question 1).
- `Content-Type` of the download is the type of the **allowlist entry** of the extension (e.g. `image/jpeg`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain; charset=utf-8`), stored with the attachment; the type sent by the client is ignored.
- The attachment row (`status` `quarantine`, uploader, size, file name, allowlist type, no ticket or comment – a draft) and the outbox event `attachment.uploaded` are written in one transaction ([§18.3](../spec/18-code-patterns.md)); the response returns the attachments with their status, so the form shows "Checking…" at once.

### Quarantine and available areas (B1)

- One bucket – the bucket of the storage configuration (its variables arrive with S1-08, [§15.3](../spec/15-deployment.md)) – with the prefixes `quarantine/` and `available/`. The object key is the attachment ID only.
- Only the Worker reads `quarantine/`; the download endpoint reads only `available/`. With an external storage, the Administrator can enforce this with prefix-scoped policies, but one identity for both keeps the default set-up simple.
- **The move after the scan**: a clean raster image is re-encoded into `available/{id}` (see EXIF stripping); any other clean file is copied server-side with `CopyObject` (S3 has no rename; the 5 GB limit of a single copy is far above the size limit). Then the row is set to `available` in a transaction with the outbox event `attachment.available` (live update of the ticket), and only then is `quarantine/{id}` deleted. Each step is idempotent: a retried job overwrites the same key, and the status update applies only to a row still in `quarantine`.

### Scan job (Worker)

- The consumer of `attachment.uploaded` (its own job, `jobId` the outbox event ID, [§17.2](../spec/17-conventions.md)) streams `quarantine/{id}` to clamd (`clamav:3310`) with `INSTREAM` through the ClamAV adapter (`clamscan` `scanStream`), with a timeout below clamd's `ReadTimeout`.
- **Clean** → the move above. **Infected** → the object is deleted, the row is set to `infected` with the outbox event `attachment.infected`, whose consumer notifies the uploader in-app ([§6.6](../spec/06-comments-notifications.md)); the signature name may be logged, the file name never.
- **Failure** (clamd unreachable, timeout, `INSTREAM size limit exceeded`, storage error): the adapter throws an `AppError`, BullMQ retries the job with exponential backoff, and the file stays in quarantine. Because a long ClamAV outage outlasts the attempts, a recurring job (`upsertJobScheduler`, every 5 minutes) checks clamd with `PING` and, when it answers, retries the failed scan jobs with `job.retry()` – so files leave quarantine on their own once ClamAV is back, as [§17.2](../spec/17-conventions.md) requires, and never unscanned. The same holds locally with the `clamav` profile switched off.
- **clamd configuration**: the deployment package mounts its own `clamd.conf` (`docker/clamav/`) so that a file clamd cannot scan completely is never reported clean: `AlertExceedsMax yes`, `AlertEncryptedArchive yes`, and `StreamMaxLength`/`MaxFileSize` at least the largest allowed attachment. How such a result is shown to the user and whether the configurable size has an upper bound is open question 2 of the change specification.

### EXIF stripping

- In the Worker, after a clean scan, every raster image (PNG, JPEG, GIF, WebP) is re-encoded with `sharp` into its own format: `autoOrient: true` first (so a photo keeps its orientation once the EXIF orientation is gone), `animated: true` for GIF and WebP (all frames), the default metadata removal (no `keepMetadata`), and the default `limitInputPixels` against decompression bombs. JPEG and lossy WebP are re-encoded at high quality; PNG, GIF and lossless WebP stay lossless. The stored size is updated.
- An image that `sharp` cannot decode keeps its metadata, so it is never released as it is; what the user then sees is part of open questions 1 and 2 (proposed: removed like a file that cannot be scanned completely).
- Only the Worker processes images, so a fault in the image decoder never affects the API.

### Download (A1) and the browser

- The browser requests `https://${TRYBUN_DOMAIN}/api/v1/attachments/{id}/content` – a same-origin path. Caddy routes it to `web`, whose BFF route handler reads the session cookie (`SameSite=Lax` cookies are sent with same-origin image requests and navigations), attaches the access token and forwards the `GET` to the same path of the API. **No token, signed URL or storage address ever reaches the browser**, and the BFF needs no special case: `GET` needs no `Origin` check, and the API's headers pass through.
- The API loads the attachment through the CASL ability (ticket visibility [§5.1](../spec/05-visibility-and-search.md), comment kind and audience [§6.1](../spec/06-comments-notifications.md) – S1-12, a draft only for its uploader); an invisible attachment returns **404**. It pipes the `GetObject` body of `available/{id}` as a `StreamableFile` with `Content-Type` from the allowlist, `Content-Disposition` (`inline` for raster images, otherwise `attachment`, with the file name as `filename` and RFC 8187 `filename*`), `X-Content-Type-Options: nosniff`, `Cache-Control: private`, `Content-Length` and an `ETag` (the content of an ID never changes, so `If-None-Match` answers `304`). An attachment that is not `available` is not streamed (its response is open question 3).
- The BFF drops `content-length` because `fetch` decodes compressed bodies; the API sends attachments uncompressed, so S1-08 keeps `content-length` in the BFF when the response has no `content-encoding`, which gives downloads a progress bar.
- **GFM images**: the editor inserts `![name](/api/v1/attachments/{id}/content)`. `react-markdown` renders a plain `<img src="/api/v1/attachments/{id}/content">`, which the browser resolves against the page origin and loads through the BFF as above. The renderer drops any image whose path is not the attachment path of an attachment of the same ticket ([§6.2](../spec/06-comments-notifications.md)) and shows external images as links. Images are never rendered with `next/image`: its optimizer would fetch the file on the web server without the user's session and cache it across users ([§14.4](../spec/14-architecture.md)).
- **CSP**: the image is same-origin, so `img-src 'self'` of the existing policy allows it without a change; previews of files chosen on the device before the upload use `blob:` URLs, already allowed. Only raster formats are allowlisted – no SVG, which could carry scripts – and `nosniff` stops the browser from interpreting a file as another type. The attachment response itself gets no page CSP, because the proxy does not run for `/api/`; a restrictive policy on that response is proposed in open question 4.
- E-mails show attachments as links to the stable path ([§13.3](../spec/13-non-functional.md)); opening one asks for sign-in when there is no session.

### Purge of draft attachments

- A recurring Worker job (`upsertJobScheduler`, hourly) deletes attachments that are linked to neither a ticket nor a comment and were uploaded more than 24 hours ago: the row first (with a condition that it is still unlinked, so a link made at the same moment wins or fails cleanly), then both possible objects. Linking a draft when a ticket or comment is saved updates only drafts of the same uploader that are still unlinked.
- The same job deletes objects under `quarantine/` older than 24 hours that have no row – left behind when a process stopped between the upload and the transaction (`ListObjectsV2` by prefix). An S3 lifecycle rule is not used, because an external storage may not support it and the rule would live outside the repository.

### Consequences

- Good: the storage stays private on every S3 implementation; every byte a browser receives has passed the access check and the API's headers, and an access change applies to the next request.
- Good: no new route, header exception or CSP source – the BFF, the CSP and the routing of Caddy stay as they are.
- Good: the API and the Worker hold only stream buffers; an upload that exceeds the limit stops while it streams.
- Good: a ClamAV outage never releases a file and needs no manual action to recover.
- Bad: every download passes through `web` and the API, which costs CPU and network on the server compared with presigned URLs; at the project's scale (25 MB per file, one server) this is acceptable.
- Bad: a rejected upload has already been stored once in quarantine and is deleted at once; a crash between upload and transaction leaves an object for at most 24 hours.
- Bad: the original image, with its EXIF data, exists in quarantine until the scan finishes; a backup taken in that window contains it until the backup expires.
- Neutral: images in tickets synchronized to GitHub ([§11.4](../spec/11-github-integration.md)) point to the stable path, which GitHub cannot load without a session; this is decided with the GitHub integration, not here.

## Pros and cons of the other options

- **A2 – presigned URLs**: no download traffic through the server, but the storage must be reachable from the browser (a new Caddy route to SeaweedFS, or a public external endpoint), which [§13.3](../spec/13-non-functional.md) forbids; the URL is a bearer credential that ends up in history, logs and `Referer`, cannot be revoked when visibility changes, and cannot be the stable path of GFM; `nosniff` and `Cache-Control: private` cannot be forced on every S3 implementation; the CSP would need the storage origin in `img-src`.
- **A3 – internal redirect in Caddy**: Caddy can follow a response header with `handle_response`, but the response travels through `web`, not from the API to Caddy, so the redirect would have to cross the BFF, and Caddy would need credentials for the storage – more moving parts for the same traffic.
- **B2 – two buckets**: clearer policies on an external storage, but the Administrator must create and configure two buckets, rclone and restore must copy both, and the move is the same copy and delete.
- **B3 – status only in the database**: the simplest – no copy – but quarantine would be only a flag: a single mistake in a query (or an S3 policy) could serve an unscanned file, and the backup or storage view could not tell scanned files from unscanned ones. [§13.3](../spec/13-non-functional.md) asks for a quarantine **area**.
- **C2 – a sample of the request stream** (`fileTypeStream`, 4100 bytes by default): nothing is stored for a rejected file, but Office formats are recognized from ZIP entries that may lie beyond the sample, and the encryption check needs the ZIP's central directory at the end of the file – random access the request stream cannot give.
- **C3 – in the Worker**: one place for all checks, but the upload could no longer be rejected with `attachment.type_not_allowed` in the response, and `attachment.status` has no value for a rejected file.

## Open questions

These belong to the specification and are proposed in [`.ai/specs/2026-10-25-attachment-serving.md`](../../.ai/specs/2026-10-25-attachment-serving.md); S1-08 starts only once they are answered.

1. **Text formats without magic bytes** (`txt`, `log`, `csv`, `json`) and images that cannot be decoded: what "detected from the content" means for them.
2. **ClamAV limits**: whether the configurable maximum size has an upper bound (clamd's `StreamMaxLength`/`MaxFileSize`, 100 MB by default), and how a file is shown that clamd reports as not completely scannable (`Heuristics.Limits.Exceeded`, `Heuristics.Encrypted.*`) – today `attachment.status` knows only `available` and `infected`, and "malware detected" would be wrong.
3. **Content of an attachment that is not `available`**: the response of the content endpoint for a visible attachment in `quarantine` or `infected` (no error code exists).
4. **Headers of the content response**: whether `Content-Security-Policy: default-src 'none'; sandbox` and `Cross-Origin-Resource-Policy: same-origin` join the forced headers, so a file opened directly in a tab can never run scripts and no other site can embed it.
5. **Previews of draft attachments**: the renderer shows images only of the same ticket, but in a new ticket or a comment being written the images are drafts that belong to no ticket yet.
6. **Encrypted PDF files**: only encrypted ZIP archives are rejected; ClamAV cannot scan an encrypted PDF either.
7. **`clamscan` maintenance** (not a specification gap, but a Rule 10 question for the maintainer): the client named in [§14.2](../spec/14-architecture.md) has had no release or commit since 2024-10-21. It has no dependencies and the `INSTREAM` protocol is stable, so this ADR keeps it behind the ClamAV adapter, covered by an integration test with the EICAR file on the pinned ClamAV image; if the maintainer prefers a maintained client, the alternative is a small `INSTREAM` client inside the adapter (`node:net`), which needs a change of [§14.2](../spec/14-architecture.md).
