# Execution plan – Sign out on the "Too many requests" notice of the application shell

Source doc: .ai/specs/implemented/2026-11-21-rate-limited-sign-out.md
Issue: #384 · Specification PR: #421 (merged)

## Goal

Over the per-user rate limit, the notice that the application shell shows instead of the shell offers **Sign out** (an `outline` `SignOutButton`) below **Reload page**, so a person on a shared computer can end the session during the block.

## Scope

- `apps/web`: an optional `variant` prop of `SignOutButton` (`features/sessions`), with a new component test. In the `429` branch of `AccountShell` (`features/app-shell`), `SignOutButton` is rendered after an unchanged `RateLimitedNotice` in a `flex-col items-start gap-3` `<main>`. The `429` test of `account-shell.spec.tsx` is extended, together with its `next-intl/server` mock.
- Specification §18.5. The user documentation: the getting-started tutorials of the team and of end users (EN, PL), and the help content regenerated with `pnpm help:generate`.
- The change specification is set to `implemented`, gets a changelog entry and moves to `implemented/`.

## Non-goals

- `RateLimitedNotice` and the notices that pages show inside the shell. The limits and the block duration. Rendering the header or navigation over the limit. **Sign out** on `app/error.tsx` (#423).

## Implementation Plan

### Phase 1: the button in the shell

1. Add the optional `variant` prop of `SignOutButton`, with `sign-out-button.spec.tsx` (jsdom): the default variant, the `outline` variant, and that a click calls `signOut({ callbackUrl: '/' })`.
2. Render `SignOutButton` (`outline`, `signIn.signOut`) after the notice in the `429` branch of `AccountShell`. Extend the `getTranslations` mock and the `429` test (the characterization test of the Delta), and check that the test fails without the change.

### Phase 2: specification and documentation

1. Update §18.5 and the getting-started tutorials (EN, PL), then run `pnpm help:generate`.
2. Set the change specification to `implemented`, add its changelog entry and move it to `implemented/`.

## Risks

- `AccountShell` now calls `getTranslations` only in its `429` branch. The other branches are unchanged, and the full test file guards them.
- The first load of the shell: `SignOutButton` is already imported through `AccountDeactivatedNotice`. `pnpm build` runs the first-load check. Result: 17 chunks, 234.9 KB gzip for `(team)`, `(portal)` and `help` on both `main` (`b5df6ad`) and this branch, so no new client JavaScript.

## Progress

PR: #424

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: the button in the shell

- [x] 1.1 `variant` of `SignOutButton` — effef56
- [x] 1.2 Sign out in the `429` branch of `AccountShell` — cd8bb3b

### Phase 2: specification and documentation

- [x] 2.1 §18.5 and the user documentation — a8364c8
- [x] 2.2 Specification implemented — a0b430d
