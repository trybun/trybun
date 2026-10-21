# 0004 – Auth.js version and session strategy

- Status: proposed
- Date: 2026-10-21
- Deciders: the maintainer (`@dtk7c2`)
- Specification: [§14.2](../spec/14-architecture.md), [§14.4](../spec/14-architecture.md), [§13.5](../spec/13-non-functional.md)

## Context and problem statement

The web application signs users in with Auth.js and the Keycloak provider and keeps **server-side sessions** (Auth.js `database` strategy with the Prisma adapter); the cookie holds only an opaque session ID, and tokens never reach the browser ([§14.2](../spec/14-architecture.md), [§14.4](../spec/14-architecture.md)). The specification requires Auth.js from its **stable release line**; if the App Router integration existed only as a pre-release, the chosen version would need an ADR approved by a human (Rule 10).

The state of the Auth.js package `next-auth` on npm on 2026-10-21:

- `latest`: **4.24.15** (2026-07-20) – the stable line. It supports the App Router (Route Handler for `/api/auth/*`, `getServerSession()` in Server Components and Route Handlers) and Next.js 12.2–16 (peer dependency `next: ^12.2.5 || ^13 || ^14 || ^15 || ^16`).
- `beta`: **5.0.0-beta.32** (2026-07-20) – version 5, in beta since October 2023, with the App Router-first API (`auth()`).

Which version does Trybun use, and how are the sessions stored?

## Decision drivers

- Rule 10: stable versions only; a pre-release needs a human decision.
- The BFF of [§14.4](../spec/14-architecture.md): server-side sessions, the encrypted refresh token on the server, serialized token refresh, back-channel logout.
- Prisma ORM 7 as the only database client ([§14.2](../spec/14-architecture.md)).

## Decision outcome

**`next-auth` 4.24 (stable line)**, because its App Router integration is stable, so no pre-release is needed. Session strategy as specified:

- `session.strategy: 'database'` with a Prisma adapter; the session cookie (`httpOnly`, `Secure`, `SameSite=Lax`) holds only the opaque session token;
- the Keycloak access and refresh tokens are kept on the server only; the refresh token is stored encrypted; the refresh with rotation is implemented in the session handling of `lib/auth` and serialized per session;
- the session lifetimes follow the table of [§14.4](../spec/14-architecture.md) per account kind.

To be confirmed in task S0-05, which implements sign-in (the ADR is updated there if a point does not hold):

- the Prisma adapter: `@next-auth/prisma-adapter` 1.0.7 (the adapter of version 4, peer `next-auth: ^4`) or `@auth/prisma-adapter`, each with Prisma ORM 7 and its driver adapter;
- where the encrypted refresh token is stored (the `Account` row of the adapter or a field of the session) and how its rotation is serialized;
- the Keycloak back-channel logout endpoint deleting the session row.

### Consequences

- Good: a stable release line, as Rule 10 requires; no human exception needed.
- Good: version 4 is widely deployed with the App Router and receives releases (4.24.15 in July 2026).
- Bad: version 4 has the older API (`getServerSession(authOptions)` instead of `auth()`); a later move to version 5 changes `lib/auth`, which is the only place the session is read ([§18.5](../spec/18-code-patterns.md)).
- Bad: the adapter for version 4 has had no feature release since 2023; S0-05 verifies it with Prisma ORM 7.

## Considered options

1. **`next-auth` 4.24 (stable)** – chosen.
2. **`next-auth` 5 beta** – the newer API, but a pre-release for three years; it would need a human exception to Rule 10 and could change before its stable release.
3. **JWT session strategy** – rejected by the specification ([§14.5](../spec/14-architecture.md)): a JWT cookie cannot be revoked and exceeds the cookie size limit with Keycloak tokens.
