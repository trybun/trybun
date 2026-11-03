# Item names as tooltips on the collapsed side navigation

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-11-03 |
| Plan task | – |
| System specification sections | §2.9, §18.6 |
| Related issues / PRs | #217 (request), #220 (specification), #221 (implementation), #215 / #219 (desktop collapse) |

## 📝 TLDR

When the side navigation is collapsed to icons (tablets by default, desktop since #219), a sighted user sees only icons: the item names exist only as `sr-only` text. Proposed: **every icon of the collapsed side navigation shows its translated name in a tooltip on pointer hover and keyboard focus**, through a new reusable `Tooltip` component in `@trybun/ui` (shadcn/ui on Base UI). The expanded navigation, phones and the accessible names of the links stay as they are.

## Context

`SideNavigation` (`apps/web/src/features/app-shell/components/side-navigation.tsx`) keeps one state per breakpoint – `isTabletExpanded` (768–1279 px) and `isDesktopCollapsed` (≥ 1280 px) – and CSS decides which applies. Collapsed, the label `<span>` is `sr-only`, which gives the link its accessible name. `@trybun/ui` has no tooltip; `Popover` and `TourTip` are the only floating elements. Base UI 1.9 ships `Tooltip` (`@base-ui/react/tooltip`), which the shadcn/ui Base UI flavour wraps.

## Goals

- Hovering (precise pointer) or focusing (keyboard) an icon of the collapsed navigation shows its name next to it (to the right), in the current language (EN, PL).
- Escape, moving the pointer away and moving focus away hide it; the tooltip can be hovered without disappearing (WCAG 2.2 SC 1.4.13).
- No tooltip while the navigation is expanded at the current width.
- The accessible name of each link is unchanged: the tooltip is not announced a second time.
- A reusable `Tooltip` in `@trybun/ui` with stories, for later icon-only controls.

## Non-goals

- No change on phones (bottom navigation shows labels).
- No tooltip on touch: Base UI opens tooltips only on hover and focus, not on a tap; a tap navigates. Touch users keep the expand toggle, and assistive technology keeps the `sr-only` names. This is expected, not a defect.
- No tooltip on the collapse/expand toggle in this change (its name is an action, not a destination; it can adopt `Tooltip` later).
- No keyboard shortcuts, no hover-opened `Popover`, no `title` attributes (unstyled, not shown on focus, announced twice by some screen readers).

## Proposed change

### `Tooltip` in `@trybun/ui`

`packages/ui/src/components/tooltip.tsx`, from the shadcn/ui Base UI flavour, adapted per §18.6 and the `ui-component` skill:

- Compound parts `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`, thin wrappers of `Tooltip.Provider` / `Root` / `Trigger` / `Portal` + `Positioner` + `Popup` + `Arrow`, each with `data-slot`; the arrow is part of `TooltipContent`, as in shadcn/ui. Props follow Base UI (`open` / `onOpenChange`, `disabled`, `delay`); `TooltipContent` takes `side` (default `top`), `sideOffset`, `align`, `className`.
- `TooltipTrigger` renders other elements – links included – through the `render` prop (§18.6: no routing in the package).
- Look: theme tokens only – `bg-foreground text-background`, `rounded-md`, `text-xs`, `px-3 py-1.5`, a matching arrow, `z-50`, the fade/zoom animations of `Popover`, no animation under `prefers-reduced-motion` (Tailwind `motion-reduce:`).
- The tooltip is **not interactive**: it holds text only and is never a touch target, so the 44 px rule does not apply to it; its trigger keeps its own target size.
- Base UI does not link the popup to the trigger with `aria-describedby`, so the tooltip is visual only. The component's doc comment states the rule: a tooltip only repeats the trigger's accessible name or a short hint, never the only source of information and never an action (§2.9: no hover-only actions).
- The component owns no texts, so no catalogue keys.

### Wiring in `SideNavigation`

- The `<ul>` of links is wrapped in one `TooltipProvider`, so after the first tooltip opens, moving between icons shows the next name at once (Base UI's provider delay group).
- Each `Link` becomes `<TooltipTrigger render={<Link … />} />` inside `<Tooltip disabled={!isCollapsed}>`, with `<TooltipContent side="right">{t(labelKey)}</TooltipContent>`. The `sr-only` span stays: it remains the accessible name.
- `isCollapsed` is the state of the breakpoint that applies: `useMediaQuery(DESKTOP_MEDIA_QUERY) ? isDesktopCollapsed : !isTabletExpanded`. `DESKTOP_MEDIA_QUERY = '(min-width: 80rem)'` (Tailwind `xl`) is added next to `TABLET_MEDIA_QUERY` in `@trybun/ui/hooks/use-media-query`, with a comment tying it to the `xl:` classes. On the server and during hydration the hook is `false`; a tooltip renders nothing until it opens, so this causes no flash and no hydration mismatch, and the value is correct before any hover or focus can happen.
- A click navigates and Base UI closes the tooltip on press (`closeOnClick`, default); focus stays on the link after a client-side navigation, but the tooltip does not reopen without a new hover or keyboard focus (`:focus-visible`). Accepted as is.
- Below the tablet breakpoint the side navigation is `display: none`, so no tooltip can open there.

### Product tour

The first-login tour targets `data-tour="app-shell-navigation"` on the `<nav>`, unchanged. While the tour tip is open, focus is in the tour tip, so keyboard focus opens no navigation tooltip; a pointer hovering a collapsed icon may still show one beside the highlighted navigation, which is accepted – it repeats the name the tour points at.

## Changes to the system specification

| Section | Change |
|---|---|
| §2.9 below "Patterns per element" | Extend the desktop/tablet sentence: collapsed to icons, the side navigation shows each item's name in a tooltip on hover and keyboard focus. |
| §18.6 UI components | New bullet **Tooltips**: `Tooltip` only repeats the accessible name of an icon-only control or a short hint, opens on hover and focus (not on touch), is dismissible with Escape and hoverable (WCAG 1.4.13), and never carries an action or the only copy of information. |

No glossary changes; no new pattern in the §18.2 quick reference (a UI element is already "`@trybun/ui` component from shadcn/ui").

## Resolved assumptions (autonomous defaults)

The ticket left no open questions; the following implementation choices were made autonomously and can be overridden on the specification pull request.

| # | Question | Default | Rationale |
|---|---|---|---|
| A1 | How does the navigation know which breakpoint's state applies? | `useMediaQuery` with a new `DESKTOP_MEDIA_QUERY` in `@trybun/ui/hooks/use-media-query` | Reuses the existing hook; a tooltip renders only when opened, so the client-only value causes no flash, unlike the widths that must be CSS. |
| A2 | Hide the tooltip when expanded by CSS or by `disabled`? | `disabled` on the `Tooltip` root | A CSS-hidden tooltip would still open and steal hover/focus events; `disabled` keeps it closed. |
| A3 | Side and delay | `side="right"`, Base UI default delay (600 ms), one `TooltipProvider` for the list | Next to the icon, never over the content; the provider makes neighbouring icons open at once – the shadcn/ui sidebar behaviour. |
| A4 | Also a tooltip on the collapse/expand toggle? | No | Out of the ticket's scope; the toggle can adopt `Tooltip` later. |
| A5 | User documentation | One clause in the getting-started tutorials (team and end-user, EN + PL): "collapsed, point at an icon to see its name" | Rule 3; the help viewer is regenerated. |

## Acceptance criteria

- [x] Hovering an icon of the collapsed navigation (tablet and desktop) shows its translated name to the right; focusing it with the keyboard does too.
- [x] Escape, leaving with the pointer and moving focus away hide the tooltip; the tooltip can be hovered.
- [x] No tooltip opens while the navigation is expanded at the current width.
- [x] Each link's accessible name is exactly its item name; no `aria-describedby` to the tooltip.
- [x] `Tooltip` in `@trybun/ui` with stories (all states, Phone/Tablet/Desktop viewports, `play` functions for hover, focus and Escape).
- [x] Component test of `SideNavigation` and an E2E check in `apps/web/e2e/app-shell.spec.ts` (tablet width and desktop, axe green).
- [x] §2.9 and §18.6 updated; user docs EN + PL; `pnpm help:generate` run.
- [x] Works on phone, tablet and desktop (Rule 9).

## 📋 Implementation Plan

### Phase 1 – Tooltips on the collapsed side navigation (one PR)

1. **`Tooltip` component** – `packages/ui/src/components/tooltip.tsx` and `tooltip.stories.tsx` with the `ui-component` skill: default, `side` variants, disabled; Phone/Tablet/Desktop viewports; `play` functions: hover shows it, focus shows it, Escape hides it, disabled never shows it, the trigger keeps its name without `aria-describedby`.
2. **`DESKTOP_MEDIA_QUERY`** in `packages/ui/src/hooks/use-media-query.ts`.
3. **`SideNavigation`** – provider, tooltip per link, `disabled` from the applying breakpoint; update its doc comment. Component test (jsdom, `renderInApp()`): with the tablet state collapsed, focusing a link shows a tooltip with its name and the link's accessible name is unchanged; after expanding, focusing shows none. `matchMedia` is stubbed for the desktop case. Focus is moved with `userEvent.tab()` (focus-visible), and the hover case passes `delay={0}` through `Tooltip` or uses fake timers – never a real 600 ms wait.
4. **E2E** – `apps/web/e2e/app-shell.spec.ts`: at the tablet width (1024 px in the Chromium desktop project – the Playwright `tablet` project is 656 px wide, below the tablet breakpoint), hover and focus a collapsed icon → a tooltip with the name is visible, Escape hides it, expanded → none; on the desktop project, collapse → hover shows the name; axe green in both states.
5. **Specification and docs** – §2.9, §18.6; user docs EN + PL (`docs/user/*/team/tutorials/getting-started.md`, `docs/user/*/end-user/tutorials/getting-started.md`); `pnpm help:generate`; a `.ai/memory/shadcn.md` note if Base UI Tooltip shows a pitfall; move this file to `implemented/` with status `implemented`.

## Changelog

- 2026-11-03 – Created from #217 (`om-auto-write-spec`, autonomous).
- 2026-11-03 – Implemented in #221.
