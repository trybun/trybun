# Markdown: rule set, renderers and the GFM editor

Non-obvious behaviour found while building the rule set `@trybun/markdown`, the `Markdown` component, the e-mail renderer and the `MarkdownEditor` (S1-07, November 2026, `react-markdown` 10, `rehype-sanitize` 6, `rehype-highlight` 7, `hast-util-to-jsx-runtime` 2, Base UI 1.9). Decisions: [§6.2](../../docs/spec/06-comments-notifications.md), [§14.2](../../docs/spec/14-architecture.md), the change specification `.ai/specs/implemented/2026-10-26-gfm-editor.md`.

## Rendering

- `react-markdown` passes the hast `node` to every custom component; destructuring it only to drop it fails `no-unused-vars`. `@trybun/ui`'s `Markdown` styles the elements with descendant variants (`[&_h2]:…`) instead of a `components` map.
- Without `rehype-raw`, raw HTML in the source is not rendered at all; `rehype-sanitize` still guards the generated HTML. `urlTransform` replaces the default protocol filter, so `Markdown` runs `defaultUrlTransform` first and the caller's transform after it.
- `remark-rehype` already prefixes the footnote IDs and links with `user-content-`. GitHub's sanitize schema adds the same prefix again (`id="user-content-user-content-fn-1"`), which breaks every footnote link, so `markdownSanitizeSchema` sets `clobberPrefix: ''`. Raw HTML, the only other source of IDs, is never rendered.
- `hast-util-sanitize` compares protocols case-sensitively: `HTTPS://…` loses its `href` like `javascript:`. Safe, but a link written in capitals renders as text.
- `mdast-util-to-hast` percent-encodes URLs: `[x](/\evil.example)` becomes `href="/%5Cevil.example"`, a path of the site, so the browser never reads it as `//evil.example`.
- A link the sanitizer emptied stays an `<a>` without `href`; `rehypeExternalLinks` unwraps it into its text. An image inside a link would become a link inside a link, so `rehypeAttachmentImages` turns it into text there.
- axe requires an accessible name for the read-only task-list checkboxes; `rehypeTaskListLabels` names each by its item's text (without nested lists).
- Highlight colours: on `muted`, `--destructive` of the dark theme reaches only 4.2:1, so keywords are bold in the text colour instead of red.
- Shared test tables live in `packages/markdown/test/markdown-cases.ts`, exported as `@trybun/markdown/testing`, so `@trybun/ui` and the server run the same XSS and image cases. `unsafeHtmlFindings` strips quoted attribute values before looking for `on…=`, otherwise a link title containing `onmouseover=` is a false positive.

## Server

- The server bundle inlines `@trybun/markdown` from source but keeps npm packages external, so every npm package the inlined code imports (`rehype-sanitize`, `unified`) must also be a dependency of `apps/server`, or the production image fails at start (`zod` is the same case for `@trybun/contracts`).
- `hast-util-to-jsx-runtime` types its result with the global `JSX` namespace, which React 19's types no longer declare; without it the result is an error type and lint reports `no-unsafe-return`. `apps/server/src/platform/markdown/jsx.d.ts` declares it from `React.JSX`.

## Editor

- `execCommand('insertText')` writes into the **focused** element: an upload that finishes while the writer is in another field or on the Preview tab (hidden panel, cannot take focus) must not use it. The editor replaces the placeholder with `setRangeText` and an `input` event when the textarea does not have the focus (no undo entry).
- Office applications put an image of a copied range in the clipboard next to its text; a paste with text and files pastes the text, and without `onFilesAdd` a paste is never prevented.
- File names go into link text escaped (`escapeLinkText`: every ASCII punctuation character, line breaks as spaces), otherwise a name like `<https://…>` nests links and two names with backticks merge into one link.
- `new URL(href, base)` throws for some protocol-relative links (`//%20`, `//[`): the e-mail renderer checks with `URL.canParse` and renders such a link as text, so one comment cannot fail a notification.
- `remark-rehype` gives the footnotes' heading the fixed ID `footnote-label`; two rendered texts with footnotes on one page repeat it. Not writer-controlled; a per-text `clobberPrefix` of `remark-rehype` would fix it when comments render together (S1-12).
- Edits of the toolbar go through `document.execCommand('insertText')` (or `'delete'` for an empty insert) on the replaced range only (`textEdit`), so Ctrl+Z undoes them; `setRangeText` plus an `input` event is the fallback without undo. React's value tracker sees the change and calls `onChange`.
- `Textarea` is a Base UI `Field.Control` with `render={<textarea />}`, so `FieldLabel` and `FieldDescription` link to it; `value` and `defaultValue` go to the control, the other props to the textarea.
- Disabled buttons of a Base UI `Toolbar` keep focus and get `aria-disabled`, not `disabled`.
- Story tests: `user-event` types into its own copy of the value and ignores `setSelectionRange` and `Shift+Arrow` selections, so a play function selects with `setSelectionRange` and types with `document.execCommand('insertText')`; Ctrl+Z is `document.execCommand('undo')`, because synthetic key events trigger no native undo. Menu items render in a portal: query them with `screen`.
- The first story-test run after adding a dependency can fail with "Vitest failed to find the current suite" while Vite optimizes the new dependency; the next run passes.
