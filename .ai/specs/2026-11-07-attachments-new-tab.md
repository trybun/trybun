# Images of the attachment list open in a new tab

| | |
|---|---|
| Status | `draft` |
| Created | 2026-11-07 |
| Plan task | – |
| System specification sections | §13.3, §13.4 |
| Related issues / PRs | #246 (request), #244 (S1-08 attachments) |

## 📝 TLDR

Today an available attachment in the attachment list is a plain `<a href>`: opening an image replaces the Trybun tab – in the ticket form this leaves the unsaved form – and closing the image closes the application. Proposed: **an available raster image (PNG, JPEG, GIF, WebP) in the attachment list opens in a new tab** (`target="_blank" rel="noopener noreferrer"`), and its accessible name announces it (EN "opens in a new tab", PL „otwiera się w nowej karcie”, WCAG technique G201). Every other file is a download and keeps its same-tab link, which never leaves the page.

## Context

`AttachmentItem` (`packages/ui/src/components/attachment-list.tsx`) renders an `available` file as a link to its stable content path, stretched over the whole item (a 44 px target). Its consumers are the attachment list of a ticket (`apps/web/src/features/attachments/components/ticket-attachments.tsx`) and the drafts of the ticket form (`attachment-drafts.tsx`); both pass `contentType`.

The content endpoint (§13.3) serves raster images with `Content-Disposition: inline` and every other file with `attachment`. So only an image ever navigates the tab; a download starts and the page stays. The maintainer found the problem during the manual QA of #244.

Conventions: links open in the same tab by default; for documents outside the web page the long-standing NN/g guideline is a new window, so closing the document does not close the application; WCAG technique G201 asks to warn when a link opens a new window or tab. GitHub opens images of issue content through `target="_blank"` links.

## Goals

- Clicking (or activating with the keyboard) an available image in the attachment list – on a ticket and in the ticket form – opens it in a new tab; the Trybun tab, and an unsaved form, stays.
- The link's accessible name announces the new tab, in EN and PL.
- A non-image file still downloads in place and leaves no empty tab behind, in every browser.

## Non-goals

- No new tab for downloads: they never navigate away, and a `target="_blank"` download leaves an empty tab in some browsers (see A1).
- No change to images in rendered Markdown: an allowed attachment image is an `<img>`, not a link; a disallowed one becomes a plain link to a path the view does not show as an image (§6.2), left as is (A3).
- No PDF preview in the browser – excluded by the maintainer's decision (§13.3, ADR 0008).
- No change of the content endpoint, its headers or the API.

## Proposed change

### `AttachmentItem`

- An item is an **inline image** when `contentType` is one of the media types §13.3 serves inline: `image/png`, `image/jpeg`, `image/gif`, `image/webp` (a constant next to `FILE_KINDS`, with a comment tying it to §13.3). Without `contentType` the item is treated as a download.
- An available inline image renders its link with `target="_blank"` and `rel="noopener noreferrer"`, and appends a visually hidden text to the link: `<span className="sr-only"> ({t('opensInNewTab')})</span>`. The accessible name becomes "screenshot.png (opens in a new tab)". The visible name, the 44 px hit area, the focus ring and the thumbnail are unchanged.
- Every other available file keeps its link exactly as today.
- New catalogue key `ui.attachmentList.opensInNewTab` in `packages/i18n/messages/en.json` ("opens in a new tab") and `pl.json` („otwiera się w nowej karcie”).
- The props of `AttachmentItem` do not change; callers need no edit.

### Tests and stories

- Component tests of `AttachmentItem` (Vitest, jsdom, `@trybun/ui`): an available PNG has `target="_blank"`, `rel="noopener noreferrer"` and the accessible name with "(opens in a new tab)" in EN and PL; an available PDF and an item without `contentType` have neither `target` nor the hint; a non-available image is no link.
- The stories of `attachment-list.stories.tsx` cover an available image and an available download, with play assertions on `target` and `rel`.

## Changes to the system specification

| Section | Change |
|---|---|
| §13.3, the bullet "Only raster images … are displayed inline" | Add: "In the attachment list an available image opens in a new tab (`target="_blank"`, `rel="noopener noreferrer"`), so the application tab stays, and its accessible name says so (EN "opens in a new tab", PL „otwiera się w nowej karcie”); every other file is downloaded from a link in the same tab." |

No glossary changes; no new pattern in §18.

## Edge Cases & Failure Scenarios

- **Pop-up blockers** do not block a new tab opened by a user's click on a link.
- **Middle click, Ctrl/Cmd+click, long press on touch** keep their browser behaviour (new tab or link menu) for both kinds of item.
- **The image is no longer available** (deleted, or the content answers `410`/`404`) – the new tab shows the API's error response, and the Trybun tab keeps its state; the attachment list updates as today.
- **Installed web app (standalone display mode)**: `target="_blank"` opens the image in the browser or an in-app browser view, not in the app window – the intended outcome.
- **`contentType` mismatch**: the media type comes from the API, which determines it from the file content (§13.3), so the list and the endpoint agree on which files are images.

## Risks & Impact Review

Low and fully reversible: two attributes and a hidden text in one component, one catalogue key per language, one sentence of specification. No API, schema or protected contract surface (`BACKWARD_COMPATIBILITY.md`) changes. The list of inline media types is duplicated from the server's rule in the UI; the comment and §13.3 tie them together, and a mismatch only means an image downloads in place or opens in a new tab – never a security effect, because the content endpoint's headers (`sandbox` CSP, `nosniff`) apply in any tab.

## Resolved assumptions (autonomous defaults)

The ticket left the browser question open with its own fallback; these choices were made autonomously and can be overridden on the specification pull request.

| # | Question | Default | Rationale |
|---|---|---|---|
| A1 | New tab for all files, or for images only? | Images only (the ticket's fallback) | A download never leaves the page, so it gains nothing from a new tab; Chrome and Firefox close the blank tab of a `target="_blank"` download, but Safari's behaviour is not guaranteed across versions. Images only satisfies every acceptance criterion in every browser and announces the new tab only where it is true. |
| A2 | How is the new tab announced? | Visually hidden "(opens in a new tab)" in the link's accessible name; no visible icon | Meets G201 for screen-reader users; sighted users see the image open in a tab, and the item already shows a thumbnail. A visible external-link icon can be added later without changing the contract. |
| A3 | Also images in rendered Markdown? | No | Allowed attachment images render as `<img>`, not links; disallowed images become links whose behaviour §6.2 defines for all links. |
| A4 | Who decides that an item opens in a new tab? | `AttachmentItem`, from `contentType` | No new prop, no caller change; both callers already pass `contentType`. |
| A5 | User documentation | None | The user documentation has no page about opening attachments; the behaviour is self-evident. |

## Acceptance criteria

- [ ] Clicking an available image in the attachment list of a ticket and of the ticket form opens it in a new tab; the Trybun tab stays.
- [ ] The link's accessible name announces the new tab (EN and PL).
- [ ] A non-image file still downloads from a same-tab link and leaves no empty tab behind.
- [ ] The stories and component tests cover `target` and `rel`; §13.3 states the behaviour.
- [ ] Works on phone, tablet and desktop (Rule 9)
- [ ] User documentation and product tour updated where relevant (Rules 3, 4) – none affected (A5)

## 📋 Implementation Plan

Phase 1 – one pull request, `Closes #246`:

1. Add `ui.attachmentList.opensInNewTab` to `en.json` and `pl.json`; in `AttachmentItem`, add the inline image media types and render `target`, `rel` and the hidden hint for an available inline image. Component tests as in "Tests and stories". The app works; downloads are unchanged.
2. Extend `attachment-list.stories.tsx` with an available image and an available download and play assertions on `target` and `rel`.
3. Update §13.3 with the sentence above; set this specification to `implemented`, add its changelog entry and move it to `implemented/`.

## Changelog

- 2026-11-07 – Created (autonomous draft from #246).
