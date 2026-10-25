# Attachment serving – gaps of the attachment requirements

| | |
|---|---|
| Status | `draft` |
| Created | 2026-10-25 |
| Plan task | `S0-22` (found while writing [ADR 0008](../../docs/adr/0008-attachment-serving.md)); implemented by `S1-08` |
| System specification sections | §13.3, §14.2, §6.2, §17.1 |
| Related issues / PRs | – |

## Context

[ADR 0008](../../docs/adr/0008-attachment-serving.md) designs the upload, scan, storage and download of attachments for S1-08 from [§13.3](../../docs/spec/13-non-functional.md) and [§14.4](../../docs/spec/14-architecture.md). While checking the requirements against the pinned ClamAV 1.5.4 and the libraries of [§14.2](../../docs/spec/14-architecture.md), it found cases the specification does not decide. Agents never decide such gaps themselves (Rule 8), so they are proposed here; S1-08 starts once every question below has an answer.

## Goals

- Every allowlisted file type has a defined content check.
- No file that ClamAV could not scan completely is ever released, and its state is shown truthfully.
- The responses of the content endpoint are defined for every attachment state.

## Non-goals

- Changing the allowlist, the default size limit or the download design of [§13.3](../../docs/spec/13-non-functional.md).
- Comment audiences of attachments (S1-12).

## Proposed change

Each item states the gap and the proposed answer; the reviewer accepts, changes or rejects each one in the open questions.

1. **Text formats.** `txt`, `log`, `csv` and `json` have no magic bytes; `file-type` detects none of them. Proposed: a file with one of these extensions is accepted when no binary format is detected and its content is valid UTF-8 (an optional BOM allowed) without NUL bytes; `json` must also parse. It is served as `text/plain; charset=utf-8`, `text/csv; charset=utf-8` or `application/json`, always as a download. A raster image whose signature matches but which the image library cannot decode (so its EXIF data cannot be stripped) is never released; it is removed like a file that cannot be scanned completely (item 2).
2. **Files ClamAV cannot scan completely.** clamd 1.5.4 does not scan data above `MaxFileSize` (100 MB) or `MaxScanSize` (400 MB of extracted content) and by default reports such files clean; `StreamMaxLength` (100 MB) closes the stream above it. Proposed:
   - the maximum file size configurable by the Administrator is at most **100 MB**, and the deployment package's `clamd.conf` sets `AlertExceedsMax yes` and `AlertEncryptedArchive yes`;
   - a new status value **`rejected`** (EN "File removed: could not be checked", PL „Plik usunięty: nie można go sprawdzić”) for a file that the scanner reports as not completely scannable (`Heuristics.Limits.Exceeded`, `Heuristics.Encrypted.*`) or that the image library cannot decode; the file is deleted and the uploader is notified like for an infected file. Alternative: treat these files as `infected` with the existing message.
3. **Content of an attachment that is not available.** Proposed: for a visible attachment in `quarantine` the content endpoint answers `409` with the new error code `attachment.not_available`; for `infected` (and `rejected`) `410` with `attachment.removed`. Invisible attachments keep answering `404`.
4. **Headers of the content response.** The page CSP of [§13.5](../../docs/spec/13-non-functional.md) is not set on API responses. Proposed: the content endpoint also sends `Content-Security-Policy: default-src 'none'; sandbox` and `Cross-Origin-Resource-Policy: same-origin`, so a file opened directly in a tab cannot run scripts and other sites cannot embed it.
5. **Previews of draft attachments.** [§13.3](../../docs/spec/13-non-functional.md) and [§6.2](../../docs/spec/06-comments-notifications.md) show an image only if it belongs to the same ticket; a ticket or comment being written references drafts that belong to no ticket yet. Proposed: the Write/Preview of a form also shows images of the current user's own draft attachments; once saved, the rule of the same ticket applies.
6. **Encrypted PDF files.** Only encrypted ZIP archives are rejected; ClamAV cannot scan the content of an encrypted PDF either. Proposed: encrypted PDFs are rejected at upload with `attachment.type_not_allowed`, like encrypted ZIP archives. Alternative: accept them (they are always downloads) and leave the scan as it is.
7. **ClamAV client.** `clamscan` ([§14.2](../../docs/spec/14-architecture.md)) has had no release or commit since 2024-10-21. Proposed: keep it behind the ClamAV adapter with an integration test on the pinned ClamAV image (no change). Alternative: replace it with a small `INSTREAM` client inside the adapter, changing [§14.2](../../docs/spec/14-architecture.md).

## Changes to the system specification

| Section | Change |
|---|---|
| §13.3 | Item 1: content check of text formats. Item 2: upper bound of the configurable size; files that cannot be scanned completely. Item 3: responses for attachments that are not available. Item 4: two more forced headers. Item 5: previews of drafts. Item 6: encrypted PDFs |
| §6.2 | Item 5: previews of the user's own draft attachments |
| §14.2 | Item 7, only if the alternative is chosen |
| §17.1 / contracts | Item 3: error codes `attachment.not_available`, `attachment.removed` |

New or changed glossary terms (code identifier, EN/PL labels):

- Item 2: `attachment.status` value `rejected` – "File removed: could not be checked" / „Plik usunięty: nie można go sprawdzić”.

## Open questions

Implementation must not start until every question has an answer.

1. Content check of `txt`, `log`, `csv`, `json`, and images that cannot be decoded (item 1) — **Answer:** …
2. Upper bound of the size limit and the state of files that cannot be scanned completely: a new status `rejected` or `infected` (item 2) — **Answer:** …
3. Responses of the content endpoint for `quarantine` and `infected` attachments (item 3) — **Answer:** …
4. `Content-Security-Policy: default-src 'none'; sandbox` and `Cross-Origin-Resource-Policy: same-origin` on the content response (item 4) — **Answer:** …
5. Previews of the user's own draft attachments (item 5) — **Answer:** …
6. Encrypted PDF files: rejected or accepted (item 6) — **Answer:** …
7. Keep `clamscan` or an own `INSTREAM` client in the adapter (item 7) — **Answer:** …

## Acceptance criteria

- [ ] A `.csv` file with valid UTF-8 text is accepted; a `.csv` file with binary content is rejected with `attachment.type_not_allowed`
- [ ] A ZIP whose content exceeds the scan limits is never `available`
- [ ] The content endpoint answers each attachment state as decided, and `404` for an invisible attachment
- [ ] Images of the user's own drafts appear in the preview of a new ticket and of a new comment
- [ ] Works on phone, tablet and desktop (Rule 9)
- [ ] User documentation and product tour updated where relevant (Rules 3, 4)

## Changelog

- 2026-10-25 – Created from the open questions of ADR 0008.
