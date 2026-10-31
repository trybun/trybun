# GFM editor and the shared Markdown pipeline

| | |
|---|---|
| Status | `draft` |
| Created | 2026-10-26 |
| Plan task | `S1-07` |
| System specification sections | §6.2, §14.2; also §8.4, §13.3, §13.4, §13.5, §14.6, §18.2, §18.5, §18.6, §18.9 |
| Related issues / PRs | [ADR 0008](../../docs/adr/0008-attachment-serving.md), [attachment serving](2026-10-25-attachment-serving.md) (item 5: previews of draft attachments) |

## Context

Ticket descriptions, comments and internal notes are written in GitHub Flavored Markdown ([§6.2](../../docs/spec/06-comments-notifications.md)). The editor works like GitHub's: a toolbar, "Write" and "Preview" tabs, task lists, code blocks with syntax highlighting, tables and keyboard shortcuts, where Ctrl+K inserts a link instead of opening the command palette ([§8.4](../../docs/spec/08-team-views.md)). Rendered HTML is sanitized following OWASP. Images are shown only from the ticket's own attachments, referenced by their stable path `/api/v1/attachments/{id}/content` ([§13.3](../../docs/spec/13-non-functional.md)). Images with external URLs are shown as links. [§14.2](../../docs/spec/14-architecture.md) names the stack: an own textarea-based editor in `@trybun/ui`, rendering with `react-markdown` + `remark-gfm` + `rehype-sanitize`, and the same unified pipeline on the server for e-mails.

Current state:

- `@trybun/ui` has a `Markdown` component (S0-09, used by the help viewer). It renders GFM with GitHub's sanitize schema and the default URL transform of `react-markdown`. It has no syntax highlighting, no image rule and no editor.
- `@trybun/ui` has no `Textarea` and no `Tabs` component.
- The server has no Markdown rendering. Lint does not let `apps/server` import `@trybun/ui` ([§14.6](../../docs/spec/14-architecture.md), `apps/server/eslint.config.js`), so the server cannot reuse the pipeline of the `Markdown` component.
- No view writes Markdown yet. The ticket forms (S1-09, S1-10), comments (S1-12) and notification e-mails (S1-15) will be the consumers. Uploads come with S1-08.

S1-07 builds the editor and the single rendering pipeline those tasks use. This specification proposes the behaviour and the structure for approval.

## Goals

- One editor component for descriptions, comments and notes. It works by mouse, touch and keyboard on phones, tablets and desktops.
- One rendering rule set (parsing, sanitizing, image and link rules) for the web views, the Preview tab and e-mails, verified by one set of XSS test cases.
- Done when: `<script>` and `javascript:` links are removed in the preview and in e-mails · an external image renders as a link · an attachment image of another ticket is not displayed · Ctrl+K in the textarea inserts a link.

## Non-goals

- WYSIWYG editing ([§14.2](../../docs/spec/14-architecture.md) and the plan forbid it).
- Uploading files, the attachment list and the "Checking…" state (S1-08). S1-07 provides only the editor's entry points for files (Q7).
- `@mentions` and their suggestions (S1-12), ticket references such as `ERP-123` as links, emoji shortcodes, saved replies.
- Ticking task-list checkboxes in the rendered view (Q6).
- The command palette and the command registry (later tasks). S1-07 only makes sure the editor's Ctrl+K never reaches them (Q2).
- E-mail templates and sending (S1-15). S1-07 provides the function that renders Markdown for an e-mail.
- Using the editor in a form. Each form task adds it to its own form.

## Proposed change

### What the user sees

- **Write tab** (default): a textarea with a toolbar above it. The textarea grows with its content up to a maximum height, then scrolls. On phones and tablets it uses 16 px text ([§18.6](../../docs/spec/18-code-patterns.md), Rule 9).
- **Toolbar** ([§6.2](../../docs/spec/06-comments-notifications.md)), with the shortcut of each button (Cmd instead of Ctrl on macOS, as on GitHub):

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
  | Task list | `- [ ] ` | Ctrl+Shift+L |
  | Attach files | opens the file chooser (Q7) | – |

  Write and Preview are switched with the tabs (also by keyboard); there is no shortcut, because Firefox reserves Ctrl+Shift+P. Tables have no button, as on GitHub. They are typed and rendered. A second press on Bold, Italic, Code, Quote or a list removes the formatting it would add.
- On phones the toolbar shows Bold, Italic, Link, Bulleted list, Task list and Attach files. The other buttons are in a "More formatting" menu (the existing `DropdownMenu`). All targets are at least 44 px. Nothing depends on hover.
- **Undo**: every toolbar action and shortcut can be undone with Ctrl+Z, like typing.
- **Preview tab**: the content rendered exactly as it will appear after saving (same component, same rules). Empty content shows "Nothing to preview" (PL „Brak podglądu”).
- **Rendered content** (in views, the preview and e-mails):
  - GFM: headings, emphasis, lists, task lists (read-only checkboxes, Q6), tables (scroll sideways on phones), strikethrough, autolinks, footnotes.
  - Code blocks with a language (` ```ts `) are highlighted in the views and the preview (Q3). E-mails show them as plain monospaced blocks.
  - Raw HTML in the source is not rendered (Q5). `<script>` and every other tag disappear.
  - Links keep only the `http`, `https` and `mailto` protocols and paths relative to the site (starting with a single `/`, or none). Any other link, including `javascript:`, `data:` and `vbscript:`, renders as plain text. Links to other sites, including protocol-relative ones (`//example.com`), get `rel="nofollow ugc noopener noreferrer"`.
  - Images: an `<img>` is rendered only when its source is exactly the stable path of an attachment in the set the view allows (the ticket's attachments; while writing, also the writer's own drafts **if** item 5 of [attachment serving](2026-10-25-attachment-serving.md) is approved – S1-07 only takes the set as given). Every other image renders as a link with its alt text, or with its URL when there is no alt text (Q4); an image whose source the sanitizer removed renders as its alt text only. This includes external URLs, attachments of other tickets and unknown IDs. E-mails always show images as links ([§13.3](../../docs/spec/13-non-functional.md)).
- **Accessibility** ([§13.4](../../docs/spec/13-non-functional.md)):
  - The toolbar is a labelled `role="toolbar"` with one Tab stop and arrow-key navigation (Base UI `Toolbar`).
  - Every button has a label from the catalogues and `aria-keyshortcuts`.
  - Write/Preview are ARIA tabs (Base UI `Tabs`).
  - The textarea is labelled by the form's `FieldLabel` and described by its `FieldDescription` and `FieldError`.
  - Drag and drop of files always has the "Attach files" button as an alternative (WCAG 2.5.7).
- **Texts** in the `ui` namespace of `@trybun/i18n` (EN, PL).

### What the system does

- **Shared pipeline** (Q1): a new package `@trybun/markdown` holds the rules that the web application and the server must apply identically. It has no React and no app code:
  - `markdownSanitizeSchema` – GitHub's schema of `hast-util-sanitize` (as today) with the protocols above and the `user-content-` prefix for IDs;
  - `rehypeAttachmentImages({ allowedIds })` – runs after sanitizing and replaces every disallowed `img` with a link, as described above;
  - `rehypeExternalLinks` – adds the `rel` value;
  - `attachmentContentPath(id)` and `parseAttachmentContentPath(src)` – the stable path of [§13.3](../../docs/spec/13-non-functional.md), matched exactly (relative, a UUID, nothing appended);
  - `markdownRehypePlugins(options)` – the ordered list `[sanitize, attachment images, external links]` that both renderers use.

  The package depends only on npm packages (`unified` ecosystem). `@trybun/ui` and `apps/server` may import it.
- **Web rendering**: the `Markdown` component of `@trybun/ui` uses `markdownRehypePlugins` and adds `rehype-highlight` last (after sanitizing, so its classes are trusted) with the token-based highlight theme in `globals.css`. A new prop `attachmentImageIds` (default: none) is the allowed set. The help viewer passes nothing; the help pages contain no images today. `Markdown` stays usable in Server Components, so content in views is highlighted on the server and adds no JavaScript to the page. Only the Preview tab renders on the client, inside the lazily loaded editor ([§18.5](../../docs/spec/18-code-patterns.md)).
- **E-mail rendering** (server): `apps/server/src/platform/markdown/` exports `renderEmailMarkdown(source, { baseUrl })`:
  - It runs `remark-parse` → `remark-gfm` → `remark-rehype` → `markdownRehypePlugins({ allowedIds: none })` and a step that makes relative URLs absolute against `baseUrl`, which the caller passes from the typed configuration (`https://${TRYBUN_DOMAIN}`). Attachment links in e-mails need a session like any other link (ADR 0008); whether a recipient may see an attachment is decided when the e-mail is built (S1-15), never by the renderer.
  - It converts the tree with `hast-util-to-jsx-runtime` into React elements styled with inline styles, for the React Email templates of S1-15.
  - Task-list checkboxes become the characters ☐/☑, because e-mail clients drop form controls.
  - It has no syntax highlighting.
- **Editor**: `MarkdownEditor` in `@trybun/ui` (`packages/ui/src/components/markdown-editor.tsx`), built from the new `Textarea` and `Tabs` components (shadcn/ui on Base UI, Rule 6), Base UI `Toolbar`, `DropdownMenu` and `Markdown`.
  - Its props follow Base UI: `value` / `defaultValue` / `onValueChange`, `name`, `placeholder`, `disabled`, `invalid`, `ref`, `attachmentImageIds`, and `onFilesAdd` (Q7).
  - It is presentational ([§18.6](../../docs/spec/18-code-patterns.md)): no fetching, no routing, no API paths except through `@trybun/markdown`.
  - The text changes of the toolbar and shortcuts are pure functions `(text, selection) → { text, selection }` in `markdown-editor-format.ts`, tested with tables.
  - They are applied with `document.execCommand('insertText')`, which keeps the textarea's native undo history (also used by GitHub's `markdown-toolbar-element`). Where the browser rejects it, `setRangeText` plus an `input` event is the fallback, without undo.
  - Keyboard shortcuts are handled by the editor on its own textarea (Q2). A handled shortcut calls `preventDefault()` and `stopPropagation()`, so Ctrl+K never reaches the command palette.
- **Forms**: the editor is a controlled field like any other ([§18.5](../../docs/spec/18-code-patterns.md) "Forms"): `Controller` + `Field`. Forms load it through a `lazy-markdown-editor.tsx` wrapper of their feature.

### Tests

- `@trybun/markdown`: a table of XSS cases from the OWASP XSS Filter Evasion Cheat Sheet. Each case runs through the web renderer (`Markdown`, rendered with `prerender`) and through `renderEmailMarkdown`, and both outputs are checked for no script, no event-handler attribute and no `javascript:`/`data:` URL. Cases include `<script>`, `<img onerror>`, `[x](javascript:alert(1))`, entity-encoded and mixed-case protocols, `<svg>`, `<iframe>`, `<a href="&#106;avascript:…">` and protocol-relative or backslash URLs (`//evil.example`, `/\evil.example`) as links and images. The image and link rules have their own table cases: external image, image of another ticket's attachment, unknown ID, path with a suffix, allowed attachment.
- `markdown-editor-format.ts`: table tests of every toolbar action, with and without selection, and for the second press.
- Storybook stories of `Textarea`, `Tabs` and `MarkdownEditor` for every state (empty, filled, preview, disabled, invalid, with an allowed image) in the three viewports. Play functions check that:
  - Ctrl+K inserts a link, Ctrl+B makes text bold, and Ctrl+Z undoes it;
  - the toolbar's arrow-key navigation works and every target is at least 44 px;
  - the preview of a `<script>` and a `javascript:` link shows neither.

## Changes to the system specification

| Section | Change |
|---|---|
| §6.2 | Toolbar buttons and shortcut table; raw HTML is not rendered; disallowed images (external, another ticket's, unknown) are shown as links with their alt text; allowed link protocols and `rel` of external links; task lists are read-only in rendered content; e-mails have no syntax highlighting and show task items as ☐/☑ |
| §14.2 | "Markdown (GFM)" row: the shared package `@trybun/markdown`, `rehype-highlight` for code highlighting (Q3), `hast-util-to-jsx-runtime` for e-mails |
| §14.6 | The package `@trybun/markdown` in the tree and its boundaries: imported by `@trybun/ui` and `apps/server`, imports no other project package (Q1) |
| §18.5 | "Commands and keyboard shortcuts": text-editing shortcuts of a text control in `@trybun/ui` (the GFM editor) are handled by the component on its own element and stop propagation; the registry holds application-level shortcuts (Q2) |
| §18.2, §18.9 | Quick reference row "Rendering or writing GFM → `Markdown` / `MarkdownEditor` of `@trybun/ui`, rules of `@trybun/markdown`"; reference implementation `packages/markdown/`, `packages/ui/src/components/markdown-editor.tsx`, `apps/server/src/platform/markdown/` (S1-07) |

New or changed glossary terms: none.

## Open questions

Implementation must not start until every question has an answer. Every answer below is a **proposal awaiting human approval**.

1. ⚠ NEEDS HUMAN CONFIRMATION **Where the shared pipeline lives.** The plan requires the same pipeline on the server, but `apps/server` may not import `@trybun/ui`, and `@trybun/contracts` holds schemas and codes, not processing code. — **Answer (proposed, awaiting approval):** a new internal package `@trybun/markdown` (`packages/markdown/`). It meets the rule of [§14.6](../../docs/spec/14-architecture.md) (used by two applications, one responsibility in its name). `@trybun/ui` and `apps/server` may import it, and it imports no project package; §14.6 and the lint boundaries change. Alternatives:
   - Let `apps/server` import a React-free subpath `@trybun/ui/markdown-pipeline`. No new package, but the server would depend on the component library.
   - Two copies of the configuration with a parity test. Rejected: two places to change one security rule.
2. ⚠ NEEDS HUMAN CONFIRMATION **Editor shortcuts and the command registry.** [§18.5](../../docs/spec/18-code-patterns.md) says every shortcut is registered once in the command registry of `apps/web` and that components never bind keys. But the editor lives in `@trybun/ui`, which may not import the web application, and its shortcuts edit text in one focused textarea, like a native text control. — **Answer (proposed, awaiting approval):** the editor handles its text-editing shortcuts on its own textarea and stops their propagation. The registry stays the only place for application-level shortcuts. §18.5 gets one sentence for this case, as a clarification of the pattern; if the maintainer sees it as a change of the pattern, the implementation PR adds an ADR (Rule 12). The shortcut table lives in §6.2, so the palette can still list it in a help section later.
3. **Library for syntax highlighting.** Not named in [§14.2](../../docs/spec/14-architecture.md). — **Answer (proposed, awaiting approval):** `rehype-highlight` (MIT, `lowlight` with highlight.js grammars) with its `common` language set. It marks tokens with classes, so the strict CSP of [§13.5](../../docs/spec/13-non-functional.md) needs no change and the colours come from theme tokens (light and dark). It runs synchronously in Server Components. Alternative: Shiki (`@shikijs/rehype`). Its highlighting is more exact, but it is larger, ships its themes as inline styles, and needs a WebAssembly or JavaScript regex engine that is asynchronous to load. Reversible: only the last plugin changes.
4. **What a disallowed image shows.** [§6.2](../../docs/spec/06-comments-notifications.md) says external images are shown as links. For an image of another ticket, the Done-when says only "not displayed". — **Answer (proposed, awaiting approval):** every disallowed image is shown the same way, as a link labelled by its alt text (or its URL), whatever the reason. The reader sees that something is referenced. Opening an attachment link still passes the API's access check, which answers 404 for an invisible attachment. Alternative: drop images of other tickets entirely.
5. **Raw HTML.** GitHub renders a safe subset of raw HTML (`<details>`, `<kbd>`, `<sub>`, …). — **Answer (proposed, awaiting approval):** no raw HTML at all, as the `Markdown` component does today. The source keeps the tags, so they reach GitHub unchanged ([§11.4](../../docs/spec/11-github-integration.md)), but Trybun does not render them. A subset can be allowed later with `rehype-raw` before the sanitizer.
6. **Ticking task-list items in the rendered view.** GitHub lets readers who may edit a text tick its checkboxes. — **Answer (proposed, awaiting approval):** not in S1-07. Rendered checkboxes are read-only, and ticking means editing the text in the editor. Ticking in place is an edit of a description or comment with a version and `If-Match`, so it belongs to the editing tasks (S1-10, S1-12) if wanted.
7. **Scope of files in the editor.** [§6.2](../../docs/spec/06-comments-notifications.md) inserts images and files by drag and drop, pasting or choosing from disk; uploads arrive with S1-08 (same group). — **Answer (proposed, awaiting approval):** S1-07 builds the three entry points and the text handling:
   - It calls `onFilesAdd(files)`, which returns, per file, a promise of `{ id, name, isImage }`.
   - It inserts a placeholder `[Uploading name…]()` at the cursor and then replaces it with `![name](/api/v1/attachments/{id}/content)` for an image or `[name](/api/v1/attachments/{id}/content)` for another file, as ADR 0008 describes. A rejected promise removes the placeholder.

   The upload mutation and the error messages come with S1-08. A form without `onFilesAdd` hides the Attach files button and ignores dropped or pasted files.
8. **One specification or two.** The editor (web) and the e-mail renderer (server) could ship separately. — **Answer (proposed, awaiting approval):** one specification and one PR, as the plan defines one task. Its point is that both renderers share one rule set and one XSS test table. Neither half has a consumer before group 5.

## Phasing and implementation plan

One phase, one PR. Each step leaves the application working.

1. Package `@trybun/markdown`: schema, plugins, path helpers. Lint boundaries of §14.6. Test: the XSS and image/link tables against a plain unified processor.
2. `Markdown` of `@trybun/ui` on `markdownRehypePlugins` with `attachmentImageIds` and `rehype-highlight`; highlight theme tokens. Test: the shared tables through `prerender`; the help viewer's existing tests pass unchanged; the stories of `Markdown` gain code, table and image states.
3. `renderEmailMarkdown` in `apps/server/src/platform/markdown/`. Test: the shared tables, absolute URLs, images as links, ☐/☑.
4. `Textarea` and `Tabs` in `@trybun/ui` with stories (Rule 6).
5. `markdown-editor-format.ts` and `MarkdownEditor` with toolbar, tabs, shortcuts, the phone menu and the file entry points. Test: format tables; stories with play functions (Ctrl+K, Ctrl+B, undo, preview sanitizing, 44 px targets, keyboard toolbar).
6. User documentation, specification changes of the table above, §18.9 reference row, project memory (`help.md` Markdown notes moved or extended), this file moved to `implemented/`. Test: `pnpm lint`, `pnpm lint:spec`.

## Acceptance criteria

- [ ] `<script>` and `javascript:` links are removed in the preview and in e-mails (shared XSS table, both renderers)
- [ ] An external image renders as a link
- [ ] An attachment image of another ticket is not displayed; an image of an allowed attachment is
- [ ] Ctrl+K in the textarea inserts a link and does not propagate; Ctrl+Z undoes it
- [ ] Every toolbar action works by touch, mouse and keyboard; the toolbar is one Tab stop with arrow-key navigation
- [ ] Code blocks are highlighted in views and the preview without a CSP change; e-mails show them plain
- [ ] `@trybun/ui` stories for `Textarea`, `Tabs` and `MarkdownEditor` in all states and viewports (Rule 6)
- [ ] Works on phone, tablet and desktop (Rule 9)
- [ ] User documentation: a reference page "Formatting text" (EN, PL) for team members and end users with the syntax and the shortcut table; no product tour (the "Creating a ticket" tour comes with S1-18) (Rules 3, 4)

## Changelog

- 2026-10-26 – Created (draft) for S1-07.
