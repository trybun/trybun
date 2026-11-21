# Sign out on the "Too many requests" notice of the application shell

| | |
|---|---|
| Status | `draft` |
| Created | 2026-11-21 |
| Plan task | – (follow-up of the QA of #381) |
| System specification sections | §14.4, §18.5, §7.4 |
| Related issues / PRs | #384, #356, #381, #382, #400 |

## 📝 TLDR

While the per-user rate limit blocks a person (§14.4, about a minute), `AccountShell` shows only the "Too many requests" notice with **Reload page** instead of the whole shell. The header and its account menu are gone, so nobody can sign out until the block ends. That matters on a shared computer. Proposed: the notice that the shell shows also offers **Sign out**, as a secondary button below **Reload page**. It ends the session the same way as the account menu does. The deactivated-account notice, which takes the same place, already does this. The notices that pages show inside the shell stay as they are, because their shell still has the account menu.

## 📝 Problem Statement

- In the manual QA of #381 (#356) on `6c60605`, an Administrator, a team member and an end user went over a limit lowered to 15 requests per minute. Every signed-in page showed only the notice with **Reload page** (#384).
- `AccountShell` (`apps/web/src/features/app-shell/components/account-shell.tsx`) renders `RateLimitedNotice` in a bare `<main>` when the read of the current account is refused with `429`. Nothing else is rendered: no header, no navigation and no account menu. This is the only place in the signed-in application where **Sign out** cannot be reached.
- `AccountDeactivatedNotice` (`apps/web/src/features/sessions/components/account-deactivated-notice.tsx`) takes the same place for a `401` and already offers `SignOutButton` (§7.4).
- **Reload page** does not help while the block lasts: it renders the same notice again. So on the shell's notice **Sign out** is the only way out of the session until the block ends.
- Established practice: the OWASP Session Management Cheat Sheet ("Manual Session Expiration") asks for a visible logout button that can be reached from every page of the application. The GOV.UK Design System (Button) uses one main button for the main call to action and secondary buttons for the rest ("Avoid using multiple default buttons on a single page").

## 📝 Proposed Solution

1. `RateLimitedNotice` gets an optional `action` slot (`ReactNode`), rendered below **Reload page**. Only the shell fills it. The pages that render the notice themselves (the ticket pages, the project settings, the portal pages, the Administrator panel, #382) pass nothing and look as they do today.
2. `AccountShell` fills the slot with `SignOutButton`, labelled with `signIn.signOut` ("Sign out" / "Wyloguj się"), the same key as `AccountDeactivatedNotice`. No new message keys are needed.
3. `SignOutButton` gets an optional `variant` prop of `Button`, `default` by default. The shell passes `outline`, the variant the web application uses for secondary actions. **Reload page** stays the main call to action, because waiting and reloading is how the person goes on. The deactivated-account notice keeps its default button: there, signing out is the only action.
4. Pressing **Sign out** calls `signOut({ callbackUrl: '/' })` of Auth.js, the same call as the account menu (`user-menu.tsx`). It ends the web session and the Keycloak session and returns to the start page. Signing out is a request to the BFF's Auth.js route, not to the API, so the rate limit of the API does not block it (§14.4).

**Alternatives considered:**

- **A boolean prop (`canSignOut`) that makes `RateLimitedNotice` render `SignOutButton` itself.** Rejected. Every page that imports the notice would then import a Client Component that it never renders. The slot keeps the notice a plain Server Component, and only the shell, which already imports `SignOutButton` through `AccountDeactivatedNotice`, decides which actions it has.
- **Rendering the whole shell (header and account menu) around the notice.** Rejected. The shell needs the account (its kind, name and permissions) and the projects of the portal, and the `429` refused exactly those reads. A shell guessed without them would show navigation that may be wrong for the person. #356 settled this on purpose.
- **Two primary buttons, or Sign out first.** Rejected. GOV.UK asks for a single main button. Most people only need to wait, so **Reload page** stays the main button.
- **A link to an Auth.js sign-out page.** Rejected. The web application already signs out through `signOut()` in two places. A third way would break Rule 12.

## 📝 Delta

The system specification (`docs/spec/`) is the living truth of this repository, so the implementation PR applies the Delta there (§18.5), not to a separate capability file.

### Capability: rate-limit-notice

**MODIFIED** – the application shell over the rate limit

- WHEN the API refuses the read of the signed-in account with `429` on any page except help THEN the shell shows only the "Too many requests" notice, with the wait from `Retry-After`, **Reload page**, and below it **Sign out** (as today, plus **Sign out**).
- WHEN the person selects **Sign out** on that notice THEN the web session and the Keycloak session end and the start page opens, as with **Sign out** in the account menu.
- WHEN the notice is shown in Polish THEN the button reads "Wyloguj się".

Frozen by: `apps/web/src/features/app-shell/components/account-shell.spec.tsx` (`shows only the notice of the rate limit when the API refuses the account with 429 (#356)`)

**MODIFIED** – the notice a page shows over the rate limit

- WHEN a page inside the shell (e.g. a page of the Administrator panel or a ticket page) gets a `429` for its own read THEN it shows the notice with **Reload page** only, with no **Sign out**, because the account menu of the shell is still there.

Frozen by: `apps/web/src/features/app-shell/components/rate-limited-notice.spec.tsx` (a new characterization test: the notice without an `action` renders one link and no button, Phase 1 Step 1)

## 📝 Architecture

Web application only (`apps/web`), and no new modules:

- `features/app-shell/components/rate-limited-notice.tsx`: new optional prop `action?: ReactNode`, rendered after the **Reload page** link inside the existing `flex-col items-start gap-3` container. The buttons stack, each at its own width, and both are 44 px high on touch screens (`Button` sizes of `@trybun/ui`).
- `features/sessions/components/sign-out-button.tsx`: new optional prop `variant` (the `variant` of `Button`), passed through.
- `features/app-shell/components/account-shell.tsx`: the `isRateLimited(userError)` branch passes `action={<SignOutButton label={t('signOut')} variant="outline" />}`, with `t` from `getTranslations('signIn')`. `account-shell.tsx` already imports `SignOutButton` through `AccountDeactivatedNotice`, so the shell is expected to bring no new client JavaScript (own reasoning, to be confirmed by the first-load check of `pnpm build`, `scripts/check-first-load.ts`, §2.9, and its printed sizes before and after).

No change to the API, the contracts, the rate limits, the message catalogues or `@trybun/ui`.

## 📝 UI/UX

- Layout, top to bottom: heading "Too many requests", the text with the wait, **Reload page** (main button), **Sign out** (outline button). It works the same from 360 px up (Rule 9): the container is `max-w-lg` and the buttons stay at their own width, as in the deactivated-account notice. Both buttons are 44 px high on touch screens and compact on a desktop with a fine pointer, as every `Button` of `@trybun/ui`.
- Keyboard and screen reader: tab order follows the visual order (**Reload page** link, then the **Sign out** button). The button is a native `<button>` with a visible text label. No ARIA is needed.
- Proposal mockup (illustrative, not an accepted design): [`assets/rate-limited-sign-out/mockup-01-shell-notice.png`](assets/rate-limited-sign-out/mockup-01-shell-notice.png), from [`mockup-01-shell-notice.html`](assets/rate-limited-sign-out/mockup-01-shell-notice.html).
- No product tour and no tour target (Rule 4): a notice someone sees for a minute is not a view to tour.

## 📝 Edge Cases & Failure Scenarios

- **The help pages over the limit**: `shell="reader"` keeps the full shell, with its account menu, because help needs no API. Nothing changes there.
- **Sign out while still over the limit**: the sign-out goes to Auth.js in the BFF, which deletes the session row and calls the logout endpoint of Keycloak with the refresh token (§14.4). Neither is a request to the rate-limited API, so the sign-out is not refused.
- **After Sign out**: the start page `/` requires a session, so the person reaches the sign-in page, as after **Sign out** in the account menu.
- **Sign out fails (network)**: the same behavior as the account menu and the deactivated-account notice. The person stays on the notice and can try again.
- **The session ends during the block** (another tab, back-channel logout): the next render of the page goes to sign-in through `requireSession()` before the notice, as today.

## 📝 Risks & Impact Review

Low and reversible. One optional prop on two components and one changed branch of the shell. No protected contract surface of `BACKWARD_COMPATIBILITY.md` is touched, and no data or permission is involved.

## Changes to the system specification

| Section | Change |
|---|---|
| §18.5 (Errors) | "`AccountShell` shows it instead of the shell when its read of the account is refused with `429`" also says that this notice, and only this one, offers **Sign out** (`SignOutButton` in the `action` slot of `RateLimitedNotice`), because the shell's account menu is not there. |

No new glossary terms. User documentation (Rule 3), in EN and PL: the **Sign out** section of `docs/user/*/end-user/tutorials/getting-started.md` and the header paragraph of `docs/user/*/team/tutorials/getting-started.md` (the account menu with **Sign out**) each get one sentence: when Trybun shows "Too many requests", **Sign out** is on that page. No other page of the user documentation changes. Then `pnpm help:generate`.

## Non-goals

- The limits and the block duration (§14.4).
- The notice that pages show inside the shell, including the Administrator panel: it keeps the shell and its account menu, so it gets no extra button.
- Rendering the header or navigation over the rate limit.

## Resolved assumptions (autonomous defaults)

| # | Question | Applied default | Why |
|---|---|---|---|
| Q1 | Main or secondary button for **Sign out**? | Secondary: `outline`, below **Reload page**. | GOV.UK Design System: one main button per page, secondary buttons for the other actions. `outline` is the variant the web application uses for secondary actions (63 uses against 6 of `secondary`). Reversible by one prop. |
| Q2 | New message key `rateLimited.signOut`, or reuse `signIn.signOut`? | Reuse `signIn.signOut`. | It is the same action with the same text as on the deactivated-account notice, so no new strings. Both EN and PL exist. |
| Q3 | How does the shell add the button: a slot or a flag? | An optional `action` slot of `RateLimitedNotice`, filled only by `AccountShell`. | The pages that render the notice never import `SignOutButton`, and the notice stays a Server Component without a Client Component of its own. It is the approach the issue proposes. |

## Acceptance criteria

- [ ] Over the rate limit, every signed-in page except help shows **Sign out** below **Reload page**. Selecting it ends the session and opens the start page, as from the account menu (manual QA with a lowered `TRYBUN_RATE_LIMIT_PER_USER`, as in #381; no E2E test, because the E2E tests raise the limits for their parallel tests that share the seeded accounts, §14.4, and the sign-out call is covered by `sign-out-button.spec.tsx`).
- [ ] The notices that pages show inside the shell, including the Administrator panel, have no **Sign out**.
- [ ] A test of `AccountShell` with a `429` checks for `SignOutButton` with the label "Sign out" and the `outline` variant, and it fails without the change. `rate-limited-notice.spec.tsx` covers the notice with and without the slot, and `sign-out-button.spec.tsx` the variant and the sign-out call.
- [ ] The button is 44 px high on touch screens, and it works on phone, tablet and desktop (Rule 9).
- [ ] §18.5 and the user documentation (EN, PL) are updated, and the help content is regenerated (Rule 3, Rule 8).

## 📋 Implementation Plan

**Phase 1 – Sign out on the shell's notice (one PR)**

1. **Characterize**: add a test to `rate-limited-notice.spec.tsx` that the notice renders the **Reload page** link and no button. Run it green on the unchanged code.
2. Add the optional `action` slot to `RateLimitedNotice` and a test that it renders below **Reload page**. Add the optional `variant` prop to `SignOutButton` with a new component test `sign-out-button.spec.tsx` (jsdom, ADR 0012): the default and the `outline` variant, and a click that calls `signOut({ callbackUrl: '/' })` of a mocked `next-auth/react`.
3. Fill the slot in the `429` branch of `AccountShell`. Extend the `429` test of `account-shell.spec.tsx` to assert the `action` prop of the notice: an element of type `SignOutButton` with the label "Sign out" from `signIn.signOut` and `variant="outline"`. Check that it fails without the change.
4. Update §18.5, the getting-started tutorials of `docs/user/` (EN, PL), run `pnpm help:generate`, and run the validation gate (including `pnpm build` with the first-load check). In the implementation PR, set this specification to `implemented`, add its changelog entry and move it to `implemented/`.

## Changelog

- 2026-11-21 – Created (autonomous defaults, #384).
- 2026-11-21 – Specification review: a component test of `SignOutButton`, the reason for no E2E test, the paths of the notice and the tutorials, the compact buttons on desktop, and the edge cases of Reload and of the page after the sign-out.
