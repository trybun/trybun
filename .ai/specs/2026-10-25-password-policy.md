# Password policy of the sign-in

| | |
|---|---|
| Status | `draft` |
| Created | 2026-10-25 |
| Plan task | `S0-20` |
| System specification sections | §7.4, §13.5, §15.5, §15.6, §15.12, §18.5 |
| Related issues / PRs | [#80](https://github.com/trybun/trybun/pull/80) (S0-12, which found the gap) |

## Context

[§7.4](../../docs/spec/07-users-organizations-permissions.md) delegates passwords to Keycloak: "Password hashing is configured in Keycloak according to OWASP recommendations". [§13.5](../../docs/spec/13-non-functional.md) names OWASP ASVS as the reference for security requirements. Neither says which passwords Keycloak accepts.

The realm configuration (`docker/keycloak/realm/trybun.yaml`) sets no `passwordPolicy`, so Keycloak accepts any password, even one character long. Passwords are set by:

- the break-glass Administrator in the first-run wizard ([§15.6](../../docs/spec/15-deployment.md), S0-12);
- end users when they register from an invitation ([§7.4](../../docs/spec/07-users-organizations-permissions.md), S1-03);
- anyone who resets a forgotten password.

The hashing algorithm is Keycloak's default (Argon2 since Keycloak 24). It is not stated in the configuration, so a change of the default would go unnoticed.

## Goals

- Every password set through Keycloak meets one policy that follows OWASP ASVS 5.0 (chapter V6, Authentication) and NIST SP 800-63B: length matters, composition rules do not.
- The hashing algorithm is explicit, managed configuration.
- The person setting a password sees the rule before typing, and a translated message when a password is refused – in the wizard and on the Keycloak screens.
- Seeded demo accounts and the local environment keep working without changes.

## Non-goals

- Checking passwords against an online breach service (e.g. Have I Been Pwned): it sends data about the password to a third party and needs outbound access; an offline blocklist is proposed instead (open question 2).
- Forced periodic password changes, password history or composition rules: ASVS 5.0 and NIST SP 800-63B advise against them.
- Mandatory 2FA for end users: unchanged, optional ([§7.4](../../docs/spec/07-users-organizations-permissions.md)).
- Re-checking existing passwords: Keycloak checks the policy only when a password is set, so existing passwords keep working until they are changed.

## Proposed change

### The policy

A managed setting of the realm, applied by keycloak-config-cli on installation and on every update ([§15.5](../../docs/spec/15-deployment.md)):

```
length(15) and maxLength(64) and notEmail and notUsername and passwordBlacklist(<file>) and hashAlgorithm(argon2)
```

- **At least 15 characters.** NIST SP 800-63B requires 15 for passwords used as the only factor, and ASVS 5.0 recommends 15. End users sign in with a password alone unless they turn on 2FA, so the policy follows the single-factor rule for everyone.
- **At most 64 characters.** NIST SP 800-63B requires accepting at least 64, which also leaves room for passphrases from password managers. Every character is allowed, including spaces and Unicode.
- **Not the e-mail address and not the user name.**
- **Not on a blocklist** of common and breached passwords (open question 2).
- **No composition rules** (upper case, digits, special characters) and **no expiry**.
- **Hashing: Argon2**, Keycloak's default outside FIPS mode and the first choice of the OWASP Password Storage Cheat Sheet, now explicit, with Keycloak's default parameters.

### Where the rule is shown

- **First-run wizard** ([§15.6](../../docs/spec/15-deployment.md)): the description under the password field states the rule ("At least 15 characters. A phrase of several words is easy to remember."). The contract schema checks the length in the browser, so a short password is reported before the request. Keycloak stays the authority: a refusal by the policy (e.g. a blocked password) still returns `setup.password_rejected` at the field, with a message naming the rule.
- **Keycloak screens** (registration from an invitation, password reset, change of password): Keycloak shows its policy messages. Their texts come from the message catalogues of `@trybun/i18n` in EN and PL, like every other text of the login theme.

### One source for the number

The minimum and maximum length are constants of `@trybun/contracts/users` (`PASSWORD_MIN_LENGTH = 15`, `PASSWORD_MAX_LENGTH = 64`), used by the wizard schema. A unit test reads `docker/keycloak/realm/trybun.yaml` and fails when its `passwordPolicy` names other values, so the two cannot drift apart.

### Local environment and tests

- **Demo accounts** keep the password `trybun`. Keycloak imports the development realm overlay on the first start of an empty database ([§15.12](../../docs/spec/15-deployment.md)), before keycloak-config-cli applies the policy, and the policy is checked only when a password is set. This is verified while implementing; if the import does check it, the overlay sets its own weaker policy for the local environment only (open question 3).
- Integration tests that create Keycloak users through the Admin API use passwords that meet the policy.
- **New tests:**
  - the realm integration test checks the applied policy and that a password of 14 characters is refused on registration and on reset;
  - the adapter test checks the field error of a blocked password;
  - the wizard E2E test checks the message for a short password;
  - the unit test above checks that the constants and the realm agree.

### User documentation

- The administrator tutorial "Set up Trybun after installation" names the rule.
- A how-to for end users, "Choose a password" (EN, PL), explains why length matters and suggests a passphrase or a password manager. It is linked from the help of the portal once the portal exists; until then it is a page of the help like the others.

## Changes to the system specification

| Section | Change |
|---|---|
| §7.4 | The password policy: at least 15 and at most 64 characters, not the e-mail address or user name, not on the blocklist, no composition rules and no expiry; hashing with Argon2; the policy is checked when a password is set, so existing passwords stay valid |
| §13.5 | The policy follows OWASP ASVS 5.0 V6 and NIST SP 800-63B; an offline blocklist of common and breached passwords is part of the deployment package |
| §15.5 | The managed Keycloak settings include the password policy and the hashing algorithm |
| §15.6 | The wizard states the rule under the password field and checks the length before submitting |
| §15.12 | The demo accounts keep their short password, imported before the policy applies |
| Implementation plan | New task S0-20 (group 6): the policy, its texts, the blocklist file, the constants and the tests |

New or changed glossary terms: none.

## Open questions

Implementation must not start until every question has an answer.

1. Minimum length 15 for everyone, including team members who also use 2FA? — **Answer:** 15 (decided by the maintainer, 2026-10-25). One rule is simpler to explain than a rule per account kind, and the break-glass Administrator must stay strong if 2FA is ever disabled or bypassed.
2. An offline blocklist of common and breached passwords (`passwordBlacklist`)? — **Proposed answer:** yes. Use a list from SecLists (MIT License) filtered to the passwords the length rule would let through (15–64 characters), shipped in the deployment package and mounted into the Keycloak container like the realm configuration. ASVS 5.0 asks for a check against at least the 3,000 most common passwords that meet the policy. The file name and the list version are recorded in `docker/keycloak/` and updated with the dependencies (Rule 10). Approved by merging this specification.
3. If the import of the development realm overlay checks the policy, may the overlay set a weaker policy for the local environment only? — **Proposed answer:** yes, only in `docker/keycloak/dev/`. The local environment already differs in the password sign-in of seeded accounts ([§7.4](../../docs/spec/07-users-organizations-permissions.md)), and changing the demo password would touch the README, the E2E set-up and every contributor's habit. Approved by merging this specification.
4. Should the wizard also show a strength meter? — **Proposed answer:** no. A meter needs a dictionary-based estimator (e.g. zxcvbn, several hundred KB with its dictionaries) in the client bundle, which conflicts with the performance budget of [§2.9](../../docs/spec/02-agent-rules.md), and the length rule and the blocklist already cover what the meter would warn about. Approved by merging this specification.

## Acceptance criteria

- [ ] A password of 14 characters is refused in the first-run wizard, on registration and on reset; one of 15 characters that is not on the blocklist is accepted.
- [ ] A password equal to the e-mail address or on the blocklist is refused with a translated message (EN, PL), in the wizard at the password field.
- [ ] The applied realm has `hashAlgorithm(argon2)` and the policy above; a unit test fails when the realm and the constants of `@trybun/contracts` disagree.
- [ ] The demo accounts still sign in with `trybun` in the local environment.
- [ ] Works on phone, tablet and desktop (Rule 9).
- [ ] User documentation (EN, PL) updated (Rule 3).

## Changelog

- 2026-10-25 – Created; open question 1 answered by the maintainer.
