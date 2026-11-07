# Execution plan: open attachment images in a new tab

Source doc: .ai/specs/2026-11-07-attachments-new-tab.md (spec PR #252)
Issue: #246

## Goal

An available raster image in the attachment list opens in a new tab (`target="_blank" rel="noopener noreferrer"`). Its accessible name announces the new tab in EN and PL. Every other file keeps its same-tab download link.

## Scope

- `packages/ui/src/components/attachment-list.tsx`, its stories and component tests
- `packages/i18n/messages/en.json`, `pl.json`: the key `ui.attachmentList.opensInNewTab`
- §13.3 of `docs/spec/13-non-functional.md`

## Non-goals

- Downloads, Markdown images, the content endpoint and the API (spec A1, A3)
- Moving the spec to `implemented/`: the spec reaches `main` through #252, so the move follows after that merge

## Risks

Low. The list of inline media types is duplicated from §13.3; a comment ties the two together.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: New tab for images

- [ ] 1.1 New-tab link and accessible hint for available images, with component tests
- [ ] 1.2 Stories for an available image and a download, with play assertions on target and rel
- [ ] 1.3 State the behaviour in §13.3
