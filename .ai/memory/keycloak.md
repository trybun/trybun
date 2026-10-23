# Keycloak, keycloak-config-cli and Auth.js 4

Non-obvious behaviour found when the sign-in was built (S0-05, October 2026, Keycloak 26.8, keycloak-config-cli 6.5.1, `next-auth` 4.24.15). Decisions: [ADR 0004](../../docs/adr/0004-authjs-version-and-session-strategy.md), [§14.4](../../docs/spec/14-architecture.md), [§15.5](../../docs/spec/15-deployment.md).

## keycloak-config-cli

- **Checksum cache**: by default an unchanged file is skipped (`import.cache.enabled`), so a managed setting changed in the console is *not* restored. `docker/keycloak/apply-config.sh` sets `IMPORT_CACHE_ENABLED=false`. The checksum is taken after variable substitution, so a changed variable re-applies even with the cache.
- **Variable substitution** (`$(env:NAME:-default)`) also runs inside YAML comments – a comment containing `$(env:…)` fails the import with `Cannot resolve variable`.
- An empty YAML value becomes `null`: an `smtpServer` with an empty `from` fails the realm creation (`Invalid sender address 'null'`). Optional parts live in their own files, imported by `apply-config.sh` only when their variables are set.
- **Several files for one realm** are imported one after another. A file without a key (e.g. no `clients`) leaves that part untouched; but with the default `full` managed mode, a file listing `identityProviders` deletes the providers created from another file – hence `IMPORT_MANAGED_IDENTITYPROVIDER=no-delete`.
- Resources that keycloak-config-cli did not create (e.g. a client an Administrator added) are never deleted (remote state in realm attributes).
- **User IDs are ignored**: users created by keycloak-config-cli get random IDs. The seeded development users with fixed IDs are imported by Keycloak itself (`start --import-realm`, `docker/keycloak/dev/trybun-realm.json`; the file name must be `<realm>-realm.json`), which happens only when the realm does not exist yet.
- Service-account roles: `users: [{ username: service-account-<client>, serviceAccountClientId, clientRoles }]`.
- `IMPORT_*` and `KEYCLOAK_*` settings are kept in `apply-config.sh`, so Compose and the Testcontainers test (`apps/server/test/keycloak/`) run identically.

## Keycloak

- **`amr` claim**: the `oidc-amr-mapper` stays empty until each execution has an authenticator config with `default.reference.value` (`pwd` for the password form, `otp` for the OTP form). A method stays in the claim only for `default.reference.maxAge` seconds after the sign-in – unset means 0, so a token issued a second later (a slow CI runner, every refresh) has `amr: []`; the realm sets the maximum session lifetime. `realm.integration.spec.ts` checks a refresh after 2 seconds.
- **2FA for a group**: `conditional-user-role` with the realm role `team` granted by the group `team`. A REQUIRED OTP form for a user without OTP adds the required action `CONFIGURE_TOTP`, so the sign-in stops at `/login-actions/required-action`. Sign-ins through an identity provider skip the browser flow's forms – the `postBrokerLoginFlowAlias` flow repeats the condition.
- **Admin REST user creation** accepts OTP credentials (`type: otp`, `secretData: {"value": …}`, `credentialData` with `subType: totp`); the secret is the raw string, an authenticator app needs its base32 form (pick a length that is a multiple of 5 bytes to avoid `=` padding).
- **TOTP replay protection**: the same code is refused twice in one 30-second window; scripted sign-ins wait for the next window.
- **Back-channel logout is synchronous**: an unreachable URL blocks the logout request until the connect timeout (minutes by default). On a Linux host with a firewall (ufw `INPUT DROP`) Keycloak in Docker cannot reach the web application on the host (`host.docker.internal:3000`); `compose.dev.yaml` sets `KC_SPI_CONNECTIONS_HTTP_CLIENT__DEFAULT__ESTABLISH_CONNECTION_TIMEOUT_MILLIS=2000`.
- `fullScopeAllowed` on a client is deprecated (warning on every token request); `trybun-web` sets it to `false`. The audience mapper with `included.client.audience` works without scope.
- With `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true`, the discovery document fetched over the internal URL has the public issuer and authorization endpoint and internal token and JWKS endpoints, so Auth.js uses `wellKnown` on the internal URL and needs no outbound network.

## Auth.js 4 (`next-auth`)

- The OAuth tokens reach the `signIn` callback, but `createSession` of the adapter receives only `{ sessionToken, userId, expires }`; the Route Handler creates the options per request with a slot for the tokens.
- If the request already has a valid session of the same user, the callback reuses it and creates no new session (the new tokens are dropped).
- Adapter methods are asserted only for the e-mail provider; the OAuth flow with database sessions calls `getUserByAccount`, `createSession`, `getSessionAndUser`, `updateSession`, `deleteSession`. Errors in sign-out are caught and logged by Auth.js, and the cookies are cleared anyway.
- Version 4 reads `NEXTAUTH_URL` (no `AUTH_URL`) and accepts `AUTH_SECRET` after `NEXTAUTH_SECRET`; cookies are `Secure` only when `NEXTAUTH_URL` is `https`.
- The sign-in must start with a POST carrying the CSRF token; `signIn()` of `next-auth/react` does it from the browser (`/sign-in` calls it at once).
