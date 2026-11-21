# Sign out on the "Too many requests" notice of the application shell

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-11-21 |
| Plan task | – (follow-up of the QA of #381) |
| System specification sections | §14.4, §18.5, §7.4 |
| Related issues / PRs | #384, #421, #424, #356, #381, #382, #400, #423 |

## 📝 TLDR

While the per-user rate limit blocks a person (§14.4, about a minute), `AccountShell` shows only the "Too many requests" notice with **Reload page** instead of the whole shell. The header and its account menu are gone, so nobody can sign out until the block ends. That matters on a shared computer. Proposed: the notice that the shell shows also offers **Sign out**, as a secondary button below **Reload page**. It ends the session the same way as the account menu does. The deactivated-account notice, which takes the same place, already does this. The notices that pages show inside the shell stay as they are, because their shell still has the account menu.

## 📝 Problem Statement

- In the manual QA of #381 (#356) on `6c60605`, an Administrator, a team member and an end user went over a limit lowered to 15 requests per minute. Every signed-in page showed only the notice with **Reload page** (#384).
- `AccountShell` (`apps/web/src/features/app-shell/components/account-shell.tsx`) renders `RateLimitedNotice` in a bare `<main>` when the read of the current account is refused with `429`. Nothing else is rendered: no header, no navigation and no account menu. Of the expected states of the shell, this is the only one in which **Sign out** cannot be reached. (An unexpected error of the shell itself reaches `app/error.tsx`, a page of its own with `PublicHeader` and no account menu, §18.5; see Non-goals.)
- `AccountDeactivatedNotice` (`apps/web/src/features/sessions/components/account-deactivated-notice.tsx`) takes the same place for a `401` and already offers `SignOutButton` (§7.4).
- **Reload page** does not help while the block lasts: it renders the same notice again. So on the shell's notice **Sign out** is the only way out of the session until the block ends.
- Established practice: the OWASP Session Management Cheat Sheet ("Manual Session Expiration") asks for a visible logout button that can be reached from every page of the application. The GOV.UK Design System (Button) uses one main button for the main call to action and secondary buttons for the rest ("Avoid using multiple default buttons on a single page").

## 📝 Proposed Solution

1. In its `429` branch, `AccountShell` renders `SignOutButton` right after an unchanged `RateLimitedNotice`, inside its own `<main>`, which becomes a `flex-col items-start gap-3` column like the `<main>` of `AccountDeactivatedNotice`. So the button sits below **Reload page** with the gap the notice uses between its own elements. The pages that render the notice themselves (the ticket pages, the project settings, the portal pages, the Administrator panel, #382) do not change at all.
2. The button is labelled with `signIn.signOut` ("Sign out" / "Wyloguj się"), the same key as `AccountDeactivatedNotice`. No new message keys are needed.
3. `SignOutButton` gets an optional `variant` prop of `Button`, `default` by default. The shell passes `outline`, the variant the web application uses for secondary actions. **Reload page** stays the main call to action, because waiting and reloading is how the person goes on. The deactivated-account notice keeps its default button: there, signing out is the only action.
4. Pressing **Sign out** calls `signOut({ callbackUrl: '/' })` of Auth.js, the same call as the account menu (`user-menu.tsx`). It ends the web session and the Keycloak session and returns to the start page. Signing out is a request to the BFF's Auth.js route, not to the API, so the rate limit of the API does not block it (§14.4).

**Alternatives considered:**

- **An optional `action` slot of `RateLimitedNotice`, filled only by the shell** (the approach the issue suggests "for example"). Rejected in the specification review: it gives a shared component a prop that only one caller uses, and it needs a slot test and a characterization test, while rendering the button beside the notice gives the same layout with no change to the notice. The deactivated-account notice already places `SignOutButton` that way.
- **A boolean prop (`canSignOut`) that makes `RateLimitedNotice` render `SignOutButton` itself.** Rejected. Every page that imports the notice would then import a Client Component that it never renders, and the notice would decide an action that only the shell needs.
- **Rendering the whole shell (header and account menu) around the notice.** Rejected. The shell needs the account (its kind, name and permissions) and the projects of the portal, and the `429` refused exactly those reads. A shell guessed without them would show navigation that may be wrong for the person. #356 settled this on purpose.
- **Two primary buttons, or Sign out first.** Rejected. GOV.UK asks for a single main button. Most people only need to wait, so **Reload page** stays the main button.
- **A link to an Auth.js sign-out page.** Rejected. The web application already signs out through `signOut()` of `next-auth/react` in three places (`user-menu.tsx`, `SignOutButton`, `signOutInPlace()` of `keycloak-sign-in.ts`). Another way would break Rule 12.

## 📝 Delta

The system specification (`docs/spec/`) is the living truth of this repository, so the implementation PR applies the Delta there (§18.5), not to a separate capability file.

### Capability: rate-limit-notice

**MODIFIED** – the application shell over the rate limit

- WHEN the API refuses the read of the signed-in account with `429` on any page except help THEN the shell shows only the "Too many requests" notice, with the wait from `Retry-After`, **Reload page**, and below it **Sign out** (as today, plus **Sign out**).
- WHEN the person selects **Sign out** on that notice THEN the web session and the Keycloak session end and the start page opens, as with **Sign out** in the account menu.
- WHEN the notice is shown in Polish THEN the button reads "Wyloguj się".

Frozen by: `apps/web/src/features/app-shell/components/account-shell.spec.tsx` (`shows only the notice of the rate limit, with the sign-out, when the API refuses the account with 429 (#356, #384)`, renamed by the implementation)

The notice that a page shows inside the shell (e.g. a page of the Administrator panel or a ticket page) does not change: `RateLimitedNotice` itself is untouched, and the account menu of the shell is still there.

## 📝 Architecture

Web application only (`apps/web`), and no new modules:

- `features/sessions/components/sign-out-button.tsx`: new optional prop `variant` (the `variant` of `Button`), passed through.
- `features/app-shell/components/account-shell.tsx`: the `isRateLimited(userError)` branch renders `<SignOutButton label={t('signOut')} variant="outline" />` after `<RateLimitedNotice error={userError} />`, and its `<main>` gets `items-start gap-3`; `t` comes from `getTranslations('signIn')`. The buttons stack, each at its own width, and both are 44 px high on touch screens (`Button` sizes of `@trybun/ui`). `account-shell.tsx` already imports `SignOutButton` through `AccountDeactivatedNotice`, so the shell is expected to bring no new client JavaScript (own reasoning, to be confirmed by the first-load check of `pnpm build`, `scripts/check-first-load.ts`, §2.9, and its printed sizes before and after).

No change to `RateLimitedNotice`, the API, the contracts, the rate limits, the message catalogues or `@trybun/ui`. Rule 6 and Storybook do not apply: no component of `@trybun/ui` changes, and the components of `apps/web` have no stories.

## 📝 UI/UX

- Layout, top to bottom: heading "Too many requests", the text with the wait, **Reload page** (main button), **Sign out** (outline button). It works the same from 360 px up (Rule 9): the container is `max-w-lg` and the buttons stay at their own width, as in the deactivated-account notice. Both buttons are 44 px high on touch screens and compact on a desktop with a fine pointer, as every `Button` of `@trybun/ui`.
- Keyboard and screen reader: tab order follows the visual order (**Reload page** link, then the **Sign out** button). The button is a native `<button>` with a visible text label. No ARIA is needed.
- Proposal mockup (illustrative, not an accepted design): [`assets/rate-limited-sign-out/mockup-01-shell-notice.png`](../assets/rate-limited-sign-out/mockup-01-shell-notice.png), from [`mockup-01-shell-notice.html`](../assets/rate-limited-sign-out/mockup-01-shell-notice.html).
- No product tour and no tour target (Rule 4): a notice someone sees for a minute is not a view to tour.

## 📝 Edge Cases & Failure Scenarios

- **The help pages over the limit**: `shell="reader"` keeps the full shell, with its account menu, because help needs no API. Nothing changes there.
- **Sign out while still over the limit**: the sign-out goes to Auth.js in the BFF, which deletes the session row and calls the logout endpoint of Keycloak with the refresh token (§14.4). Neither is a request to the rate-limited API, so the sign-out is not refused.
- **After Sign out**: the start page `/` requires a session, so the person reaches the sign-in page, as after **Sign out** in the account menu.
- **The same person signs in again during the block**: the `signIn` callback of Auth.js reads the account with the new token (`signedInAccountOf()`, `lib/auth/auth-options.ts`), and that read is refused too. The sign-in still succeeds, but the language and time zone of the account are not applied to it, and the notice shows again until the block ends. Another person who signs in on the same computer has a counter of their own and is not affected (§14.4).
- **Sign out fails (network)**: the same behavior as the account menu and the deactivated-account notice. The person stays on the notice and can try again.
- **The session ends during the block** (another tab, back-channel logout): the next render of the page goes to sign-in through `requireSession()` before the notice, as today.

## 📝 Risks & Impact Review

Low and reversible. One optional prop of `SignOutButton` and one changed branch of the shell. No protected contract surface of `BACKWARD_COMPATIBILITY.md` is touched, and no data or permission is involved.

## Changes to the system specification

| Section | Change |
|---|---|
| §18.5 (Errors) | "`AccountShell` shows it instead of the shell when its read of the account is refused with `429`" also says that this notice, and only this one, offers **Sign out** (`SignOutButton` below `RateLimitedNotice`), because the shell's account menu is not there. |

No new glossary terms. User documentation (Rule 3), in EN and PL: the **Sign out** section of `docs/user/*/end-user/tutorials/getting-started.md` and the header paragraph of `docs/user/*/team/tutorials/getting-started.md` (the account menu with **Sign out**) each get one sentence that explains the notice and where **Sign out** is then: when someone sends more requests than Trybun allows in a short time, Trybun shows "Too many requests" with **Reload page** and **Sign out** until the block ends. No other page of the user documentation changes. Then `pnpm help:generate`.

## Non-goals

- The limits and the block duration (§14.4).
- The notice that pages show inside the shell, including the Administrator panel: it keeps the shell and its account menu, so it gets no extra button.
- Rendering the header or navigation over the rate limit.
- **Sign out** on the page of an unexpected error of the shell itself (`app/error.tsx` with `PublicHeader`). That page renders above the providers of the shell and is not about the rate limit (#382). Follow-up: #423.

## Resolved assumptions (autonomous defaults)

| # | Question | Applied default | Why |
|---|---|---|---|
| Q1 | Main or secondary button for **Sign out**? | Secondary: `outline`, below **Reload page**. | GOV.UK Design System: one main button per page, secondary buttons for the other actions. `outline` is the variant the web application uses for secondary actions (63 uses against 6 of `secondary`). Reversible by one prop. |
| Q2 | New message key `rateLimited.signOut`, or reuse `signIn.signOut`? | Reuse `signIn.signOut`. | It is the same action with the same text as on the deactivated-account notice, so no new strings. Both EN and PL exist. |
| Q3 | How does the shell add the button: a slot, a flag, or beside the notice? | Beside an unchanged `RateLimitedNotice`, in the `<main>` of `AccountShell` (changed in the specification review from the slot the issue suggests). | The same layout with no new prop on a shared component, as `AccountDeactivatedNotice` does it. The pages that render the notice never import `SignOutButton`. |

Open questions: none blocking. The maintainer confirmed Q1–Q3 in the session on 2026-11-21, and with them manual QA in place of an E2E test (Acceptance criteria).

## Acceptance criteria

- [ ] Over the rate limit, every signed-in page except help shows **Sign out** below **Reload page**. Selecting it ends the session and opens the start page, as from the account menu (manual QA with a lowered `TRYBUN_RATE_LIMIT_PER_USER`, as in #381; no E2E test, because the E2E tests raise the limits for their parallel tests that share the seeded accounts, §14.4, and the sign-out call is covered by `sign-out-button.spec.tsx`).
- [ ] The notices that pages show inside the shell, including the Administrator panel, have no **Sign out**.
- [ ] A test of `AccountShell` with a `429` checks for `SignOutButton` with the label "Sign out" and the `outline` variant, and it fails without the change. `rate-limited-notice.spec.tsx` stays unchanged and green, and `sign-out-button.spec.tsx` covers the variant and the sign-out call.
- [ ] The button is 44 px high on touch screens, and it works on phone, tablet and desktop (Rule 9).
- [ ] §18.5 and the user documentation (EN, PL) are updated, and the help content is regenerated (Rule 3, Rule 8).

## 📋 Implementation Plan

**Phase 1 – Sign out on the shell's notice (one PR)**

1. Add the optional `variant` prop to `SignOutButton` with a new component test `sign-out-button.spec.tsx` (jsdom, ADR 0012): the default and the `outline` variant, and a click that calls `signOut({ callbackUrl: '/' })` of a mocked `next-auth/react`.
2. Render `SignOutButton` after the notice in the `429` branch of `AccountShell`. In `account-shell.spec.tsx`, extend the mock of `next-intl/server` with `getTranslations` (it provides only `getMessages` today, so the `429` branch would fail on the missing export), and extend the `429` test (the characterization test named in the Delta) to assert the children of `main`: the notice, then an element of type `SignOutButton` with the label "Sign out" from `signIn.signOut` and `variant="outline"`. Check that it fails without the change.
3. Update §18.5, the getting-started tutorials of `docs/user/` (EN, PL), run `pnpm help:generate`, and run the validation gate (including `pnpm build` with the first-load check). In the implementation PR, set this specification to `implemented`, add its changelog entry and move it to `implemented/`.

## Changelog

- 2026-11-21 – Created (autonomous defaults, #384).
- 2026-11-21 – Specification review of #421: `SignOutButton` beside an unchanged `RateLimitedNotice` instead of a slot (Q3); the claim about where **Sign out** cannot be reached narrowed, with `app/error.tsx` as a non-goal; three callers of `signOut()`; the edge case of signing in again during the block; the mock of `getTranslations` in the plan; the documentation sentence explains the notice.
- 2026-11-21 – Specification review: a component test of `SignOutButton`, the reason for no E2E test, the paths of the notice and the tutorials, the compact buttons on desktop, and the edge cases of Reload and of the page after the sign-out.
- 2026-11-21 – Approved by the maintainer in the session: Q1–Q3 and manual QA in place of an E2E test confirmed; the error page of the shell filed as #423.
- 2026-11-21 – Implemented (#424): the optional `variant` of `SignOutButton` with its component test; `SignOutButton` below `RateLimitedNotice` in the `429` branch of `AccountShell`; §18.5 and the getting-started tutorials (EN, PL) updated, the help content regenerated.
