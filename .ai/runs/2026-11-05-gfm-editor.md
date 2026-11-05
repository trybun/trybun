# Execution plan — implement the GFM editor and the shared Markdown pipeline (S1-07)

Source doc: .ai/specs/implemented/2026-10-26-gfm-editor.md
Spec PR: #117 (merged, design only)
Plan task: `S1-07`

## 🎯 Goal

Build S1-07 as the approved change specification decides: the package `@trybun/markdown` with the one rule set (sanitize schema, link protocols, attachment-image rule, external-link `rel`), the `Markdown` component of `@trybun/ui` on that rule set with `rehype-highlight`, the e-mail renderer `renderEmailMarkdown` of the server, and the `MarkdownEditor` (with a new `Textarea`) of `@trybun/ui`, verified by one XSS test table run against both renderers.

## Scope

- New package `packages/markdown/` (`@trybun/markdown`) and its lint boundaries (§14.6): imported by `@trybun/ui` and `apps/server`, imports no project package.
- `packages/ui/src/components/`: `markdown.tsx` (rule set, `attachmentImageIds`, highlighting), new `textarea.tsx`, new `markdown-editor.tsx` and `markdown-editor-format.ts`, their stories; highlight theme tokens in `globals.css`; `ui` catalogue texts (EN, PL).
- `apps/server/src/platform/markdown/`: `renderEmailMarkdown(source, { baseUrl })`.
- User documentation "Formatting text" (EN, PL) and the generated help content; system specification (§6.2, §14.2, §14.6, §18.2, §18.5, §18.9); plan status; project memory; the spec moved to `implemented/`.

## Non-goals

- Uploads, the attachment list, mentions, ticket references, emoji, saved replies, ticking task items in rendered content, raw HTML, the command palette and registry, e-mail templates and sending, using the editor in a form (spec Non-goals).

## Risks

- The server bundle inlines `@trybun/markdown` from source while its npm dependencies stay external: the server must declare every npm package the inlined code imports, or the production image fails at start.
- `document.execCommand('insertText')` is deprecated but the only way to keep the native undo history; the fallback has no undo. Story tests run in Chromium, which supports it.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Shared rule set and renderers

- [x] 1.1 Package @trybun/markdown with the XSS and image/link tables — 5ec3b89
- [x] 1.2 Markdown component on the shared rule set with highlighting — 8817dca
- [x] 1.3 renderEmailMarkdown of the server — 790ee80

### Phase 2: Editor

- [x] 2.1 Textarea component with stories — 7b7715d, ae228ba
- [x] 2.2 Format functions of the editor with table tests — b26f7db
- [x] 2.3 MarkdownEditor with toolbar, tabs, shortcuts and file entry points — ae228ba

### Phase 3: Documentation and specification

- [ ] 3.1 User documentation, specification, plan and project memory

### Phase 4: Review

- [ ] 4.1 Apply the findings of the code review
