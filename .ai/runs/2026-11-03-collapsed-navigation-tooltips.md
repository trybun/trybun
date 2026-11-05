# Execution plan: item names as tooltips on the collapsed side navigation

Source doc: .ai/specs/implemented/2026-11-03-collapsed-navigation-tooltips.md
Issue: #217 · Spec PR: #220

## Goal

Every icon of the collapsed side navigation (tablet and desktop) shows its translated name in a tooltip on hover and keyboard focus, through a new reusable `Tooltip` in `@trybun/ui`.

## Scope

- `@trybun/ui`: `Tooltip` component and stories, `DESKTOP_MEDIA_QUERY`.
- `features/app-shell/components/side-navigation.tsx`, its component test.
- E2E in `apps/web/e2e/app-shell.spec.ts`.
- §2.9 and §18.6 of the spec, the user docs in EN and PL, the help content.

## Non-goals

Phones, touch tooltips, a tooltip on the collapse toggle, keyboard shortcuts. The spec document itself merges through #220.

## Implementation Plan

### Phase 1: Tooltips on the collapsed side navigation

1. `Tooltip` component with stories.
2. `DESKTOP_MEDIA_QUERY`.
3. `SideNavigation` wiring with a component test.
4. E2E on tablet and desktop.
5. Spec §2.9, §18.6, user docs EN and PL, `pnpm help:generate`.

## Risks

- Hydration: `useMediaQuery` is `false` on the server; harmless because a tooltip renders nothing until opened.

## Progress

PR: #221

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Tooltips on the collapsed side navigation

- [x] 1.1 `Tooltip` component with stories — b0fe14f
- [x] 1.2 `DESKTOP_MEDIA_QUERY` — b0fe14f
- [x] 1.3 `SideNavigation` wiring with a component test — 0db6a7f
- [x] 1.4 E2E on tablet and desktop — 638cb3f
- [x] 1.5 Spec, user docs and help content — a0d8219
