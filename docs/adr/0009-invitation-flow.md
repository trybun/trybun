# 0009 – Invitation flow

- Status: accepted
- Date: 2026-10-25, updated with the answers of its open questions and the results of S1-03 on 2026-10-29, accepted by the maintainer on 2026-10-30 after S1-03 (#160) was merged
- Deciders: the maintainer (`@dtk7c2`)
- Specification: [§7.4](../spec/07-users-organizations-permissions.md), [§13.5](../spec/13-non-functional.md), [§14.4](../spec/14-architecture.md), [§15.6](../spec/15-deployment.md), [§17.2](../spec/17-conventions.md)
- Change specification: [`2026-10-25-invitation-acceptance.md`](../../.ai/specs/implemented/2026-10-25-invitation-acceptance.md) (implemented) – the gaps this ADR found, answered on 2026-10-29; issuing, resending and revoking: [`2026-10-26-invitations-and-accounts.md`](../../.ai/specs/implemented/2026-10-26-invitations-and-accounts.md)
- Implementation: plan task S1-03

## Context and problem statement

Accounts are created only by invitations and by the first-run wizard ([§7.4](../spec/07-users-organizations-permissions.md)). Invitations are owned by the application, not by Keycloak e-mails, so the link can always be copied and passed on manually, also before e-mail is configured. The token is random and single-use, only its hash is stored, and it expires after 7 days. Accepting an invitation:

- **team** – sign-in with GitHub; on return the GitHub account is bound to the invited account (its e-mail address may differ from the invitation address), then Keycloak requires the 2FA set-up;
- **end user** – "Keycloak registration with the invited e-mail address pre-filled and locked"; the user sets a password or uses Microsoft or Google, which are linked to an account only through the invitation flow or after signing in to the existing account;
- then the application links the returned Keycloak user ID to the account, marks the invitation as used and opens the invited project ([§5.7](../spec/05-visibility-and-search.md)).

At the same time the realm keeps `registrationAllowed: false` (`docker/keycloak/realm/trybun.yaml`), "Keycloak self-registration is reachable only through an invitation link", the system implements no authentication mechanism of its own ([§14.4](../spec/14-architecture.md)), and secrets never appear in URL query strings ([§13.5](../spec/13-non-functional.md), [§17.2](../spec/17-conventions.md)).

What exists already: the first-run wizard (S0-12, [§15.6](../spec/15-deployment.md)) creates the break-glass Administrator through the Keycloak Admin API with the service account of `trybun-server` – `POST /admin/realms/trybun/users` with the password as a credential, the group `team` and the required action `CONFIGURE_TOTP`, then the account in one transaction that claims the setup token, deleting the Keycloak user again when the transaction fails (`apps/server/src/modules/setup/setup.service.ts`, `apps/server/src/platform/keycloak-admin/`). The setup link carries its token in the URL fragment. The GitHub, Microsoft and Google identity providers use the built-in `first broker login` flow and the flow `trybun post broker login`, which requires the one-time password of members of the role `team`.

**How is a Keycloak sign-in – and for end users, the setting of a password – reachable only from an application-owned invitation link, on Keycloak 26.8.1 (the version `compose.yaml` pins) with registration switched off, without an own authentication mechanism and without Keycloak e-mails?** And how are the GitHub binding with the 2FA set-up, the locked e-mail address, the token and the return to the invited project built?

### Behaviour of Keycloak 26.8.1

From the Server Administration Guide 26.8.1, the Server Developer Guide and the Admin REST API documentation of the same version:

- **Registration needs the realm switch.** A client can send the user straight to the registration screen with `prompt=create` (or the deprecated `/registrations` endpoint), and "the resulting action will match the action of when the user clicks Register" – which exists only when user registration is enabled for the realm. The switch is realm-wide; a client can override only the browser and direct-grant flows, not the registration flow. The registration form pre-fills nothing from `login_hint` and does not lock the e-mail field.
- **Identity providers create users independently of the switch.** "Enabling or disabling user creation by identity provider is completely independent on the realm User Registration switch." With the default first broker login flow, the first sign-in through GitHub, Microsoft or Google creates a Keycloak user (Create User If Unique) for anyone who clicks the provider on the sign-in page; an existing user with the same e-mail address must confirm the link and re-authenticate. Creation can be disabled in the flow; "Detect Existing Broker User" admits only users that exist already.
- **Conditions available to flows**: user role, user configured, user attribute, sub-flow executed, **client scope** ("true if the optional client scope is sent by the client in the login request") and credential; plus Deny Access / Allow Access. A condition on the authorization request is a front-channel signal: anyone can build such a request.
- **Application-initiated actions** (`kc_action`): a client asks a *signed-in* user to perform a required action (e.g. `UPDATE_PASSWORD`, `CONFIGURE_TOTP`); a user who is not signed in must authenticate first. Account linking is the AIA `kc_action=idp_link:<alias>` (the legacy `/broker/{alias}/link` protocol is disabled by default). Keycloak warns that the client must not assume an AIA was performed.
- **`login_hint`** pre-fills the username / e-mail field of the sign-in form (editable); **`kc_idp_hint`** skips the sign-in page and redirects to the named identity provider.
- **No link without e-mail.** The Admin API sends required actions only by e-mail (`PUT /users/{id}/execute-actions-email`); it has no endpoint that returns an action-token link.
- **Organizations** (`POST /organizations/{id}/members/invite-user`) send the invitation by Keycloak e-mail; for a new address the link leads to registration "forced to provide the same email address used to send the invitation". Invitations can be listed, resent and deleted; the representation has an `inviteLink`, whose exposure in the REST API was published as a vulnerability (CVE-2026-16072, July 2026: the bearer registration link bypasses the authorization boundary), so it is not a contract to build on.
- **Admin API**: `GET /users/{id}/federated-identity` returns the links of a user (`identityProvider`, `userId`, `userName` – the GitHub login for GitHub); `PUT /users/{id}/groups/{groupId}` adds a group.

Auth.js 4 (`next-auth` 4.24.15, [ADR 0004](0004-authjs-version-and-session-strategy.md)) passes extra authorization parameters with `signIn(provider, options, authorizationParams)`; `/sign-in` already passes `ui_locales`. If the request already has a valid session of the same Keycloak user, Auth.js reuses it and drops the new tokens (`.ai/memory/keycloak.md`).

## Decision drivers

- [§14.4](../spec/14-architecture.md), Rule 1: Keycloak stores, checks and hashes every credential and enforces 2FA; no own authentication, password or 2FA mechanism, no Keycloak extension (SPI) written by the project.
- [§7.4](../spec/07-users-organizations-permissions.md): application-owned invitations whose link works without e-mail; `registrationAllowed: false`; a Keycloak user without an accepted invitation gives no access; accounts are never linked by a matching e-mail address alone.
- [§13.5](../spec/13-non-functional.md): tokens stored only as hashes, never in query strings or logs; the acceptance endpoints are rate-limited per client IP ([§14.4](../spec/14-architecture.md)).
- Rule 12: the patterns that exist – the setup token and the Administrator creation of the first-run wizard, the BFF, the authentication guard.
- Rule 2: few steps from the link to the invited project.

## Considered options

1. **Application acceptance page; the API creates the Keycloak user with the Admin API** – for a password, from a form of the acceptance page (the pattern of the first-run wizard); for GitHub, Microsoft and Google, by the first broker login, after which the API binds the Keycloak user.
2. **Keycloak registration gated by the invitation** – `registrationAllowed: true`, the registration link hidden by the theme and the registration flow (or the first broker login flow) allowed only when the authorization request carries a marker of the invitation (Condition – client scope).
3. **Keycloak Organizations invitations** – `invite-user` per Trybun organization or one realm-wide organization.
4. **Admin API user without credentials plus an action-token link** – the user is created on acceptance with the required action `UPDATE_PASSWORD`, reached through a link.
5. **A Keycloak extension** – an own authenticator or action token in the registration flow, or a third-party "magic link" provider.

## Decision outcome

**Option 1.** Keycloak creates or receives every credential, the application only decides *who may become which account*. Four building blocks:

### 1. The invitation link and its token

- The token is 32 random bytes (`randomBytes(32)`, 256 bits) in base64url; the invitation stores its SHA-256 hash (unique) – a fast hash is enough for a high-entropy random value, as for the setup token, the session token and API tokens.
- The link is `https://<domain>/invitations#token=<token>`: the token is in the fragment, which the browser never sends to a server ([§15.6](../spec/15-deployment.md), [§17.2](../spec/17-conventions.md)). The acceptance page sends it in request bodies only.
- **Single use**: the acceptance claims the invitation in the transaction that binds the account, with a conditional update (`token_hash = ?, used_at IS NULL, revoked_at IS NULL, expires_at > now()`), so of two simultaneous acceptances only one succeeds. An unknown, expired, used, revoked or replaced token gets one error (`invitation.token_invalid`), like `setup.token_invalid`; the page tells the person to ask the inviter for a new link.
- **Resending** writes a new hash (and the old link stops working); **revoking** sets `revoked_at`. Issued, accepted and revoked invitations are recorded in the administrative audit log, the acceptance with the client IP ([§13.5](../spec/13-non-functional.md)).
- The endpoints that take the token require no session and are limited per client IP ([§14.4](../spec/14-architecture.md)). The token never appears in logs.

### 2. The acceptance page

`/invitations` reads the fragment and checks the token (`POST /api/v1/invitations/token-verification`, the name of the setup endpoint), which returns what the page shows: the invited e-mail address (read-only), the target (project name or organization) and the inviting person, and the ways to accept – for a team invitation GitHub only, for an end-user invitation a password form and the configured Microsoft and Google providers. Inviting team members needs GitHub sign-in configured, as the getting-started checklist says ([§15.6](../spec/15-deployment.md)).

### 3. Accepting

**End user with a password** (the first-run wizard's pattern, [§15.6](../spec/15-deployment.md)):

1. The page asks for first name, last name (the user profile of Keycloak requires both) and a password (show/hide toggle, the rule of the password policy under the field, the length checked by the contract schema), next to the invited address shown read-only.
2. `POST /api/v1/invitations/acceptance` with the token, names and password: the API creates the Keycloak user through the Admin API – username and e-mail address *taken from the invitation* (so the address is locked by construction, whatever the browser sends), `emailVerified: true` (the link reached the person through that address or through the inviter), the language, the password as a credential – then, in one transaction, claims the invitation, sets the Keycloak user ID on the account (`invited` → `active`) and grants the target; when the transaction fails, the Keycloak user is deleted again. Keycloak's password policy applies; the API passes the password once and never stores or logs it ([§7.4](../spec/07-users-organizations-permissions.md)).
3. The web application starts the sign-in with `login_hint=<address>` and `ui_locales`; Keycloak asks for the password just set and returns to the invited project.

**End user with Microsoft or Google, team member with GitHub** (binding after the provider sign-in):

1. The page keeps the token in the tab's `sessionStorage` and starts the sign-in with `kc_idp_hint=<provider>` and the optional client scope `invitation` (see 4), with the acceptance page as `callbackUrl`.
2. Keycloak's first broker login creates the Keycloak user from the provider's profile (asking for missing names with Review Profile) – or, if a Keycloak user with the provider's e-mail address exists, asks the person to confirm the link and sign in to it (never linked by the address alone, [§7.4](../spec/07-users-organizations-permissions.md)). Auth.js creates a web session for that Keycloak user; the API knows no account for it yet, so the session gets the team lifetimes ([§14.4](../spec/14-architecture.md)).
3. Back on the acceptance page, the page sends the token to `POST /api/v1/invitations/acceptance` with the session. The endpoint verifies the access token like the authentication guard (signature, issuer, audience) but does not require an account for its `sub`. In one transaction the API claims the invitation, checks that no other account has this Keycloak user ID, sets it on the account and grants the target; then removes the token from `sessionStorage`.
   - The Keycloak user's e-mail address is set to the account's address through the Admin API (`emailVerified: true`), so Keycloak and the account agree: the address decides organization membership, notifications and e-mail replies, and users cannot change it ([§7.4](../spec/07-users-organizations-permissions.md)). The provider's address may differ, for team members and end users alike ([§7.4](../spec/07-users-organizations-permissions.md), open question 3). An address that another Keycloak user already holds is refused with an explanation for the Administrator.
4. **Team only**: the API reads the GitHub login from `GET /users/{id}/federated-identity` (`userName` of `github`) and stores it on the account ([§11.4](../spec/11-github-integration.md)), and adds the Keycloak user to the group `team` ([§7.4](../spec/07-users-organizations-permissions.md)). The current session has no second factor – `trybun post broker login` ran before the user was in the group – so the API would refuse team actions (`authentication.second_factor_required`). The web application therefore signs out (deleting the web session and the Keycloak session; otherwise Auth.js would keep the old session and drop the new tokens) and signs in again with `kc_idp_hint=github`: GitHub usually returns without a prompt, `trybun post broker login` now requires the one-time password, and Keycloak adds `CONFIGURE_TOTP` for a user without one – the 2FA set-up is enforced by Keycloak's flow, not by an AIA the user could skip. The sign-in that completes `CONFIGURE_TOTP` still yields an access token without `otp` in `amr` (see "Results of S1-03"), so the web application signs the person in once more while `GET /api/v1/users/me` answers `authentication.second_factor_required` (at most three times); that sign-in asks for the one-time password and passes.

**Return to the invited project**: the acceptance response names where to go – the invited project's home ([§5.7](../spec/05-visibility-and-search.md); team members see its team views there); for an organization or the Administrator role, which have no single project, the root – the portal root for end users, the team home for team members (open question 4). The web application passes that path as Auth.js `callbackUrl`, which accepts only paths of its own origin.

Imported people ([§12.5](../spec/12-api-webhooks-import.md)) already have an account in state `invited` without a Keycloak user, so their acceptance is the same. Invitations of addresses that already have an account grant the access directly and never reach this flow ([§7.4](../spec/07-users-organizations-permissions.md)).

### 4. Identity-provider sign-ins without an invitation

Today any GitHub, Microsoft or Google user who clicks the provider on the Keycloak sign-in page gets a Keycloak user, without access to the system but with personal data in Keycloak. The first broker login flow of the three providers is replaced by a managed flow `trybun first broker login`:

- if the authorization request carries the optional client scope `invitation` of `trybun-web` (Condition – client scope), the steps of the default flow, including Create User If Unique;
- otherwise only an existing Keycloak user can be linked (Detect Existing Broker User, then Confirm Link Existing Account and Verify Existing Account By Re-authentication), which keeps linking Microsoft or Google to an existing end-user account and GitHub to the break-glass Administrator ([§7.4](../spec/07-users-organizations-permissions.md)).

The scope is a front-channel marker, not a security boundary – a crafted request still creates a Keycloak user, which gives no access. The boundary stays the binding in the API: only a valid invitation links a Keycloak user to an account. Keycloak users without a linked account are deleted by a recurring Worker job 24 hours after their creation (open question 2, [§13.2](../spec/13-non-functional.md)).

### Consequences

- Good: registration stays off, Keycloak keeps every credential, the 2FA enforcement and the account linking; the project adds no Keycloak extension and no e-mail through Keycloak, and the link works without SMTP.
- Good: one pattern with the first-run wizard – a random token stored as a SHA-256 hash in the URL fragment, a conditional claim in the transaction that creates the account, Admin API user creation undone when the transaction fails.
- Good: the invited address is locked by construction – the API takes it from the invitation, never from the browser or the provider.
- Bad: the password of end users passes through the BFF and the API once (in memory, never stored or logged), as the Administrator's password does in the wizard – not through Keycloak's registration form ([§7.4](../spec/07-users-organizations-permissions.md) changed accordingly, open question 1).
- Bad: an end user types the new password twice – on the acceptance page and on Keycloak's sign-in form right after (a password manager fills the second); a team member passes the GitHub redirect twice and then signs in once more with the one-time password just set up.
- Bad: the acceptance with a provider needs an endpoint that accepts a valid Keycloak token without an account, a flow `trybun first broker login` and a client scope `invitation` in the managed realm configuration, and the token is kept in `sessionStorage` during the provider round trip (readable by scripts of the origin, mitigated by the nonce-based CSP of [§13.5](../spec/13-non-functional.md), single use and the 7-day expiry).

### To confirm in S1-03

Integration tests on the Keycloak container (as `realm.integration.spec.ts`) confirm before the feature relies on it: Condition – client scope in a first broker login flow with a scope sent by Auth.js through `signIn(…, { scope })`; the re-sign-in of a newly bound team member reaching `CONFIGURE_TOTP` and an `amr` with `otp`; `userName` of the GitHub federated identity being the login; the `409` of an e-mail address held by another Keycloak user. A result that contradicts this ADR updates it before the implementation continues.

### Results of S1-03 (2026-10-29)

Confirmed on the Keycloak 26.8.1 container (`apps/server/test/keycloak/invitation-sign-in.integration.spec.ts`, with a second realm as the OIDC provider):

- **Condition – client scope** works in the first broker login: a provider sign-in with `scope=openid invitation` creates the Keycloak user; without the scope, none is created (flow `trybun first broker login`, optional client scope `invitation` of `trybun-web`).
- **The re-sign-in of a newly bound team member contradicts step 4 in one point**: Keycloak does require `CONFIGURE_TOTP`, but the access token of the sign-in that completes it has `amr: []`, not `otp`, so the API refuses team actions with `authentication.second_factor_required`. Only the **next** sign-in, which asks for the one-time password, yields `amr: ['otp']`. Step 4 is updated: the web application signs in again while `GET /users/me` answers `second_factor_required` (at most three times).
- **`trybun post broker login` refused every non-team user** signing in through a provider: its only step was the team condition, which is skipped for them, and a flow without a successful step fails (`IDENTITY_PROVIDER_POST_LOGIN_ERROR`). The flow gained a required Allow Access step, so end users with Microsoft or Google can sign in.
- **`userName` of the GitHub federated identity**: not testable without GitHub; the adapter reads `userName` of the `github` link, tested with a link created through the Admin API.
- **An e-mail address held by another Keycloak user**: `PUT /users/{id}` answers `409`, returned as `invitation.email_taken`. A password refused by the policy is `invitation.password_rejected` at the password field.

## Pros and cons of the other options

- **Keycloak registration gated by the invitation**: keeps the password on Keycloak's form, but needs `registrationAllowed: true`, which the realm and [§7.4](../spec/07-users-organizations-permissions.md) exclude. The gate would be a parameter of the authorization request, so registration would be open to anyone who builds the URL; the form neither pre-fills nor locks the e-mail address (a read-only field in the theme is only cosmetic, the API would have to compare the token's address), and the theme would have to hide the link on the sign-in page.
- **Keycloak Organizations**: e-mail-only invitations sent by Keycloak, so they need SMTP in Keycloak and cannot be copied manually – contrary to [§7.4](../spec/07-users-organizations-permissions.md); reading `inviteLink` instead is the behaviour published as CVE-2026-16072. They would duplicate the organizations of the application database ([§7.3](../spec/07-users-organizations-permissions.md)) in Keycloak, and they cover registration only, not the GitHub binding of team members.
- **Admin API user plus an action-token link**: Keycloak creates such links only in its e-mails (`execute-actions-email`), which [§7.4](../spec/07-users-organizations-permissions.md) excludes; a user without credentials cannot sign in to reach the required action, and an AIA needs a signed-in user.
- **A Keycloak extension**: would keep everything on Keycloak's screens, but adds Java code (or a third-party provider) to the Keycloak image that must follow every Keycloak release, and a token-based sign-in path is an authentication mechanism of the project's own – contrary to [§14.4](../spec/14-architecture.md).

## Open questions

Proposed for approval in the change specification [`2026-10-25-invitation-acceptance.md`](../../.ai/specs/implemented/2026-10-25-invitation-acceptance.md); this ADR does not decide them. Option 1 depends on question 1: if the password must stay on a Keycloak screen, no option of Keycloak 26.8.1 meets all of [§7.4](../spec/07-users-organizations-permissions.md), and the choice is between allowing Keycloak e-mails for the password set-up (option 4) and a Keycloak extension (option 5).

**Answered** by the maintainer on 2026-10-29, as proposed: (1) the password is set on the acceptance page and the API creates the Keycloak user once; (2) a recurring Worker job deletes Keycloak users without a linked account 24 hours after their creation; (3) the Microsoft or Google address may differ, the account and the Keycloak user keep the invited address; (4) end users land on the portal root, team members on the team home; (5) a resent invitation is valid 7 days from the resending. [§7.4](../spec/07-users-organizations-permissions.md), [§5.7](../spec/05-visibility-and-search.md) and [§13.2](../spec/13-non-functional.md) carry the answers.

1. **Password on the acceptance page instead of Keycloak registration.** [§7.4](../spec/07-users-organizations-permissions.md) describes "Keycloak registration with the invited e-mail address pre-filled and locked" and "Keycloak self-registration is reachable only through an invitation link"; on Keycloak 26.8.1 that is not possible with `registrationAllowed: false` and no Keycloak e-mails.
2. **Keycloak users without an account** created by identity-provider sign-ins (crafted requests, abandoned acceptances): kept, or deleted by a recurring job after a period – [§13.2](../spec/13-non-functional.md) has no retention for them.
3. **Provider address of end users**: must the Microsoft or Google address equal the invitation address, or may it differ, as for team members?
4. **Landing after accepting an organization or Administrator invitation**, which has no single invited project ([§5.7](../spec/05-visibility-and-search.md) covers project invitations).
5. **Expiry of a resent invitation**: [§7.4](../spec/07-users-organizations-permissions.md) sets "7 days after creation" – from the first sending, or from the resending, which issues a new token?
