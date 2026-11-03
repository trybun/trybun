# Execution plan: collapsible side navigation on desktop

Source doc: .ai/specs/2026-11-03-desktop-navigation-collapse.md
Issue: #215 · Spec PR: #218

## Goal

On desktop the side navigation can be collapsed to icons and expanded back. The browser remembers the choice in a cookie that the team layout reads, so the server renders the right width without a flash. Phones and tablets stay unchanged.

## Scope

- `features/app-shell/`: the cookie helper, the Server Action, `SideNavigation`, `AppShell`.
- `app/(team)/layout.tsx`.
- Component, unit and E2E tests.
- §2.9, §18.2 and §18.5 of the spec, the user docs in EN and PL, and the help content.

## Non-goals

Phone and tablet behavior, tooltips (#217), a keyboard shortcut, and storing the choice server-side in the account.

## Implementation Plan

### Phase 1: Collapsible, remembered desktop navigation

1. Cookie helper and Server Action, with unit tests.
2. `SideNavigation` with per-breakpoint state and two toggle buttons, with component tests.
3. Wire the layout and `AppShell`.
4. E2E for the desktop toggle, the reload persistence, the no-flash server HTML and the tour target.
5. Spec §2.9, §18.2 and §18.5, the user docs EN and PL, `pnpm help:generate`; mark the spec `implemented`.

## Risks

- A hydration mismatch if the state is derived on the client. Mitigation: the CSS picks the breakpoint, and the server gives the initial state.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Collapsible, remembered desktop navigation

- [ ] 1.1 Cookie helper and Server Action
- [ ] 1.2 SideNavigation per-breakpoint state
- [ ] 1.3 Layout wiring
- [ ] 1.4 E2E desktop toggle
- [ ] 1.5 Specification and user docs
