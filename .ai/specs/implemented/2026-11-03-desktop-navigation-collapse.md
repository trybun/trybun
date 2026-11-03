# Collapsible side navigation on desktop

|                               |                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Status                        | `implemented`                                                                                             |
| Created                       | 2026-11-03                                                                                                |
| Plan task                     | –                                                                                                         |
| System specification sections | §2.9, §18.2, §18.5                                                                                        |
| Related issues / PRs          | #215 (request), #218 (specification), #219 (implementation), #217 (tooltips on collapsed icons, separate) |

## 📝 TLDR

On desktop (≥ 1280 px) the side navigation of the application shell is always expanded to 240 px with labels; only tablets can collapse it to the 64 px icon strip. Proposed: **desktop gets the same collapse/expand toggle, expanded by default, and the browser remembers the desktop choice in a cookie** that the team layout reads, so the server renders the remembered width with no flash. Phones and tablets keep exactly today's behavior. The product owner confirmed the cookie on 2026-11-03 (#215), which also approves the new `§18.5` State-table row (Rule 12).

## Context

`SideNavigation` (`apps/web/src/features/app-shell/components/side-navigation.tsx`) keeps one `useState(false)` for "expanded" and overrides it on desktop with `xl:w-60`, `xl:not-sr-only` on the labels and `xl:hidden` on the toggle button. Desktop therefore cannot collapse, and the content area of lists, boards and ticket details (which use the full width since #194) cannot win the 176 px the labels take.

`§2.9` "Patterns per element" lists the collapsible side navigation in the Tablet column only. The `§18.5` State table has no row for a UI preference that outlives a page load: view state goes to the URL, everything else is local state.

## Goals

- A toggle on desktop collapses the navigation to icons and expands it back; the content area takes the freed width.
- The desktop choice survives a reload and a new sign-in in the same browser; the first server render already has the remembered width.
- Collapsed, the navigation stays fully accessible: `sr-only` labels give every link its name, `aria-current` marks the current page, the toggle carries `aria-expanded` and a name that says what it does; 44 px targets, keyboard and touch, no hover-only action.

## Non-goals

- No change on phones (bottom navigation) or tablets (768–1279 px): tablet starts collapsed on every page load, and its state is not stored.
- No hiding of the navigation completely; no new navigation items; no keyboard shortcut (Ctrl/Cmd+B conflicts with bold in the GFM editor, §6.2).
- No tooltips with the item names on collapsed icons – #217.
- No server-side storage in the account: the preference is per browser, by decision.

## Proposed change

### Behavior

| Width              | Default                        | Toggle                        | Remembered                          |
| ------------------ | ------------------------------ | ----------------------------- | ----------------------------------- |
| Phone < 768 px     | Bottom navigation (unchanged)  | –                             | –                                   |
| Tablet 768–1279 px | Collapsed to icons (unchanged) | Expand / collapse (unchanged) | No (unchanged)                      |
| Desktop ≥ 1280 px  | **Expanded** with labels       | **Collapse / expand** (new)   | **Yes – cookie, per browser** (new) |

The desktop toggle looks like the tablet toggle at the top of the side navigation (`PanelLeftClose` / `PanelLeftOpen` icon, names "Collapse navigation" / "Expand navigation", already in the catalogues). Resizing the window across 1280 px switches between the two independent states without a reload, because each breakpoint has its own state and its own CSS.

### No layout flash – one state per breakpoint, CSS decides which applies

`SideNavigation` receives `isDesktopCollapsed` (the cookie value) from the layout and keeps two states:

- `isTabletExpanded` – `useState(false)`, as today;
- `isDesktopCollapsed` – `useState(initial prop)`.

Width and label visibility are classes for both breakpoints at once, e.g. `isTabletExpanded ? 'w-60' : 'w-16'` together with `isDesktopCollapsed ? 'xl:w-16' : 'xl:w-60'`, and `sr-only` / `xl:sr-only` / `xl:not-sr-only` on the labels likewise. The toggle is two buttons sharing one look: the tablet button `xl:hidden`, the desktop button `hidden xl:inline-flex`, each with its own `aria-expanded` and name. `display: none` takes the inactive one out of the accessibility tree, so a screen reader always hears the state of the visible navigation. No JavaScript media query is needed, so the server HTML is already right for every width.

### Persisting the desktop choice

- `features/app-shell/navigation-cookie.ts` (`import 'server-only'`), modelled on `lib/i18n/time-zone-cookie.ts`: the cookie `TRYBUN_NAVIGATION_COLLAPSED` with the value `1` when collapsed; absent (deleted) when expanded, the default. `path=/`, `sameSite=lax`, `httpOnly`, `secure` from `getEnv().shouldUseSecureCookies`, max age one year. `isNavigationCollapsed()` reads it; anything other than `1` is "expanded".
- `features/app-shell/change-navigation-collapsed.ts` (`'use server'`): the Server Action `changeNavigationCollapsed(isCollapsed: boolean)` validates the argument with Zod and stores the cookie. It does not call `refresh()`. Setting a cookie in a Server Action already renders the current page again on the server (Next.js); `SideNavigation` keeps its own state, so that render changes nothing visible, and the cookie matters for the next page load.
- The desktop toggle flips its state at once, then calls the action without awaiting it in the UI. A failed call only means the choice is not remembered; the toggle still works (no toast – a preference is not data).
- `app/(team)/layout.tsx` reads `isNavigationCollapsed()` and passes it through `AppShell` to `SideNavigation`.
- The cookie is not tied to the session: signing out does not delete it, so a new sign-in in the same browser keeps the choice. It holds no personal data (one flag), so it needs no consent banner (strictly functional preference).

### Product tour

The first-login tour targets `data-tour="app-shell-navigation"` on the `<nav>`, which stays in place in both states; only its width changes. No tour definition changes; the E2E test checks the tour step in both states.

## Changes to the system specification

| Section                     | Change                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §2.9 "Patterns per element" | The Tablet column already says "Collapsible side navigation". Add a sentence below the table: on desktop the side navigation is expanded by default and can be collapsed to icons; the browser remembers the desktop choice; tablets start collapsed and do not remember it.                                     |
| §18.5 State table           | New row: **Persisted UI preference of the browser** (e.g. the collapsed desktop navigation) → a server-only cookie helper of the feature, written by a Server Action and read by the layout, which passes it as the initial state, so the server renders it without a flash. Never personal data or server data. |
| §18.2 Quick reference       | New row: "A UI preference that survives a reload" → cookie read by the layout, Server Action writes it → §18.5.                                                                                                                                                                                                  |

No glossary changes.

## Resolved assumptions (autonomous defaults)

The ticket left no open questions; the following implementation choices were made autonomously and can be overridden on the specification pull request.

| #   | Question                                                                                  | Default                                                                          | Rationale                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Where do the cookie helper and the Server Action live?                                    | `features/app-shell/` (`navigation-cookie.ts`, `change-navigation-collapsed.ts`) | The preference belongs to the shell feature; `lib/i18n` holds only language and time-zone concerns. Same shape as the time-zone helper.                                                                                          |
| A2  | Cookie value when expanded?                                                               | Deleted (absent = expanded, the default)                                         | Smallest state; an invalid or old value falls back to the default.                                                                                                                                                               |
| A3  | Does the Server Action refresh the page?                                                  | No explicit `refresh()`                                                          | Next.js renders the page again after a cookie change anyway; the toggle's local state already shows the result. A client-written cookie would avoid that render but needs a non-`httpOnly` cookie and a different §18.5 pattern. |
| A4  | How is the toggle's `aria-expanded` correct at both breakpoints without JS media queries? | Two buttons, one per breakpoint, shown/hidden by CSS                             | Correct server HTML at every width, no flash, no hydration mismatch.                                                                                                                                                             |
| A5  | Feedback when storing the cookie fails?                                                   | None; the toggle still works for the page                                        | A lost preference is harmless; a toast would be noise.                                                                                                                                                                           |

## Acceptance criteria

- [x] On desktop the toggle collapses the navigation to the 64 px icon strip and expands it back; the content area takes the freed width.
- [x] The desktop choice survives a reload and signing out and in again in the same browser; the first server response already has the remembered width (no flash).
- [x] Collapsed, every link keeps its accessible name (`sr-only` label) and `aria-current`; the visible toggle has `aria-expanded` and the right name; targets ≥ 44 px; keyboard and touch work; axe reports no serious violation.
- [x] Phone and tablet behavior is unchanged; the existing `apps/web/e2e/app-shell.spec.ts` stays green.
- [x] The first-login product tour highlights `data-tour="app-shell-navigation"` in both states.
- [x] §2.9, §18.2 and §18.5 updated; user documentation (EN, PL) mentions the toggle; `pnpm help:generate` run.
- [x] Works on phone, tablet and desktop (Rule 9).

## 📋 Implementation Plan

### Phase 1 – Collapsible, remembered desktop navigation (one PR)

1. **Cookie helper and Server Action** – `features/app-shell/navigation-cookie.ts` (`isNavigationCollapsed`, `storeNavigationCollapsed`) and `features/app-shell/change-navigation-collapsed.ts`. Unit tests with mocked `next/headers` cookies, as for the time-zone cookie: stores `1`, deletes on expand, reads only `1` as collapsed, rejects a non-boolean argument.
2. **`SideNavigation` with per-breakpoint state** – the `isDesktopCollapsed` prop, the two states, the classes above, the two toggle buttons; the desktop toggle calls the action. Update the doc comments of `SideNavigation` and `AppShell`. Component tests in `app-shell.spec.tsx`: the server HTML with `isDesktopCollapsed` false/true contains the matching `xl:w-60` / `xl:w-16` and label classes and the desktop button's `aria-expanded`; labels stay in the HTML (sr-only) when collapsed.
3. **Layout wiring** – `app/(team)/layout.tsx` reads the cookie and passes it to `AppShell`; `AppShell` passes it on.
4. **E2E** – `apps/web/e2e/app-shell.spec.ts`: on the desktop project, collapse → width 64 px and `aria-expanded="false"`, reload → still collapsed, and the HTML the server returns for the page (`page.request.get`, no JavaScript) already carries the collapsed desktop classes – that is the no-flash check; expand → 240 px; the tour step still targets the navigation when collapsed; phone and tablet tests unchanged; axe and touch targets in both states.
5. **Specification and docs** – §2.9, §18.2, §18.5; user docs EN + PL (`docs/user/*/team/tutorials/getting-started.md`, and the end-user tutorial only if it describes this navigation); `pnpm help:generate`; move this file to `implemented/` with status `implemented`.

## Changelog

- 2026-11-03 – Created from #215 (`om-auto-write-spec`, autonomous).
- 2026-11-03 – Implemented in #219.
