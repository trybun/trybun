# Accepting invitations on Keycloak without registration

| | |
|---|---|
| Status | `approved` |
| Created | 2026-10-25 |
| Plan task | `S1-03` (found by `S0-23`) |
| System specification sections | §5.7, §7.4, §13.2 |
| Related issues / PRs | [ADR 0009](../../docs/adr/0009-invitation-flow.md) |

## Context

[§7.4](../../docs/spec/07-users-organizations-permissions.md) describes the acceptance of an end-user invitation as "Keycloak registration with the invited e-mail address pre-filled and locked; the user sets a password", and says "Keycloak self-registration is reachable only through an invitation link". The realm keeps `registrationAllowed: false`, invitations are owned by the application and Keycloak sends no e-mails.

[ADR 0009](../../docs/adr/0009-invitation-flow.md) compared the options on Keycloak 26.8.1 and found that the described flow is not possible as written:

- Keycloak's registration screen exists only while registration is enabled for the whole realm; `prompt=create` behaves like clicking "Register". A gate in the registration flow would be a parameter of the authorization request, which anyone can add, so registration would effectively be open. The form neither pre-fills nor locks the e-mail address.
- Keycloak creates links that let a person without credentials set a password only in its own e-mails (`execute-actions-email`, organization invitations).
- Sign-ins through GitHub, Microsoft or Google create Keycloak users regardless of the registration switch – today for anyone who clicks a provider on the sign-in page. Such a user has no access to the system, but Keycloak holds their name and e-mail address.

The ADR also met four smaller gaps, listed as questions 2–5.

## Goals

- Accepting an invitation works with registration switched off, without Keycloak e-mails and without an authentication mechanism or Keycloak extension of the project's own.
- The invited e-mail address cannot be changed during the acceptance.
- No Keycloak user is created from the sign-in page without an invitation in the normal flow.

## Non-goals

- Changing who can invite whom, the 7-day validity, the manual copy of the link or the existing-account rules of [§7.4](../../docs/spec/07-users-organizations-permissions.md).
- Changing the sign-in of accounts that exist.

## Proposed change

1. **End users set their password on the invitation page of the web application** – with their first and last name, next to the invited address shown read-only – and the API creates the Keycloak user with that password as its credential, as the first-run wizard does for the Administrator ([§15.6](../../docs/spec/15-deployment.md)): Keycloak's password policy applies, the API passes the password once and never stores or logs it. The user then signs in on Keycloak's form with the address pre-filled. Microsoft and Google stay available on the same page.
2. **Sign-ins through an identity provider create a Keycloak user only when started from an invitation** (a managed first broker login flow conditioned on a client scope that the invitation page requests); otherwise they can only link an existing Keycloak user, as today. The condition is a front-channel marker; the boundary stays the binding of the API.
3. The answers to questions 2–5 are written into [§7.4](../../docs/spec/07-users-organizations-permissions.md), [§5.7](../../docs/spec/05-visibility-and-search.md) and [§13.2](../../docs/spec/13-non-functional.md).

## Changes to the system specification

| Section | Change |
|---|---|
| §7.4 Accounts and authentication | "Keycloak checks it whenever a password is set – the first-run wizard, registration from an invitation, …" → "… the first-run wizard, the acceptance of an invitation, …" |
| §7.4 Invitations | End-user acceptance: "Keycloak registration with the invited e-mail address pre-filled and locked; the user sets a password" → the user sets a password on the invitation page, next to the invited address shown read-only; the API creates the Keycloak user with it once (as in [§15.6](../../docs/spec/15-deployment.md)); Keycloak's sign-in follows with the address pre-filled |
| §7.4 Invitations | "Keycloak self-registration is reachable only through an invitation link" → Keycloak registration is switched off; Keycloak users are created only by the API (first-run wizard, invitations) and by identity-provider sign-ins started from an invitation; a Keycloak user without an accepted invitation gives no access |
| §7.4 Invitations | Answers of questions 3 and 5 |
| §5.7 | Answer of question 4 |
| §13.2 | Answer of question 2, if Keycloak users without an account are deleted |

New or changed glossary terms: none.

## Open questions

Every question has an answer: the maintainer accepted the proposals on 2026-10-29, in the session that implements S1-03.

1. Is the password of end users set on the invitation page of the web application (proposed change 1)? If it must stay on a Keycloak screen, the remaining options are Keycloak e-mails for the password set-up or a Keycloak extension, both excluded by [§7.4](../../docs/spec/07-users-organizations-permissions.md) and [§14.4](../../docs/spec/14-architecture.md) today. — **Answer:** yes – the password form of the invitation page, as proposed change 1; the API creates the Keycloak user with it once, as the first-run wizard does.
2. Keycloak users without an account (a crafted sign-in request, an acceptance abandoned after the provider sign-in): are they kept, or deleted by a recurring job of the Worker after a period (proposal: 24 hours, with a Keycloak Admin API search for users without a linked account)? — **Answer:** deleted – a recurring job of the Worker deletes Keycloak users without a linked account 24 hours after their creation, found through the Keycloak Admin API.
3. When an end user accepts with Microsoft or Google, must the provider's e-mail address equal the invitation address, or may it differ, as for team members with GitHub? In both cases the account and the Keycloak user keep the invited address. — **Answer:** it may differ, as for team members with GitHub; the account and the Keycloak user keep the invited address.
4. Where does the user land after accepting an invitation to an organization or to the Administrator role, which have no single invited project (proposal: the portal root for end users, the team home for the team)? — **Answer:** the portal root for end users, the team home for team members (and the Administrator role).
5. Does a resent invitation (new token) expire 7 days after the resending or 7 days after the first sending? — **Answer:** 7 days after the resending: the new token gets the full validity of a new invitation.

## Acceptance criteria

- [ ] An end user accepts an invitation with a password while the realm keeps `registrationAllowed: false`, and Keycloak sends no e-mail
- [ ] The Keycloak user and the account have the invited address, whatever the browser sends
- [ ] A sign-in through GitHub, Microsoft or Google from the sign-in page without an invitation creates no Keycloak user
- [ ] A team member who accepts with GitHub must set up 2FA before team actions succeed
- [ ] Works on phone, tablet and desktop (Rule 9)
- [ ] User documentation and product tour updated where relevant (Rules 3, 4)

## Changelog

- 2026-10-29 – Answers of questions 1–5 accepted by the maintainer; status `approved`.
- 2026-10-25 – Created from the open questions of ADR 0009 (S0-23).
