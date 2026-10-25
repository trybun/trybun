# Security baseline – CSP nonce, security headers, rate limits, session lifetimes

Non-obvious behaviour found when the security baseline was built (S0-14, October 2026, Next.js 16, `@nestjs/throttler` 6.7, `@nest-lab/throttler-storage-redis` 1.2, Zod 4.6). Decisions: [§13.5](../../docs/spec/13-non-functional.md), [§14.4](../../docs/spec/14-architecture.md), [ADR 0007](../../docs/adr/0007-throttler-storage-on-nestjs-12.md).

## Content Security Policy (`apps/web/src/proxy.ts`)

- Next.js takes the nonce from the `Content-Security-Policy` **request** header the proxy sets (`NextResponse.next({ request: { headers } })`) and adds it to its scripts; every page must be rendered per request (all pages already are – `next build` lists them as `ƒ`).
- Browsers hide the `nonce` attribute after parsing (`script[nonce="…"]` matches nothing); `script.nonce` keeps the value. E2E collects `securitypolicyviolation` events from an init script.
- **Zod 4 probes `new Function("")`** on the first parse of an object schema; the error is caught, but a strict CSP reports a `script-src eval` violation. `z.config({ jitless: true })` (from `zod/v4/core`) in `src/instrumentation-client.ts` turns off the probe and the JIT in the browser.
- `next/image` renders `style="color:transparent"`, and Base UI positions overlays with style attributes: `style-src-attr 'unsafe-inline'` keeps them working; style elements still need the nonce.
- The proxy matcher excludes `/api/` (the BFF and Auth.js): a proxy buffers request bodies, which would limit uploads through the BFF; it also excludes static files and link prefetches (Next.js CSP guide).
- `upgrade-insecure-requests` only on HTTPS: on `http://localhost` it would upgrade the requests of the page to `https://localhost`.

## Rate limits (`apps/server/src/platform/rate-limiting/`)

- `@SkipThrottle()` without arguments skips only the throttler named `default`; with the named throttlers `user` and `ip` use `@SkipRateLimit()`.
- Global guards (`APP_GUARD`) run in the order their modules are imported: `RateLimitingModule` comes after `AuthenticationModule`, so the principal is known; a request with an invalid token is refused (`401`) before it is counted.
- `ThrottlerGuard` sets `X-RateLimit-*` headers and throws `ThrottlerException`; `RateLimitGuard` overrides `handleRequest` for the IETF `RateLimit`/`RateLimit-Policy` headers and `AppError('request.rate_limited')`, and `generateKey` for one counter per user or IP across endpoints (the default key contains the controller and the handler).
- `@nest-lab/throttler-storage-redis` 1.2 works with `ioredis` 6 when it gets an existing client. Without `enableOfflineQueue: false` an `ioredis` client queues commands while Valkey is down, and every request would hang instead of failing open.
- Express `trust proxy` (`TRUSTED_PROXIES`) is set in `main.ts`; tests that need the client IP set it on their app too. `req.ip` of an IPv4 client of a dual-stack server is `::ffff:a.b.c.d`; PostgreSQL `inet` accepts both forms.
- The E2E tests sign in as one seeded Developer in parallel; in CI they exceeded 100 requests per minute per user within a minute (#86: `request.rate_limited` in the web server log, menus and help pages empty). `playwright.config.ts` starts the API with `TRYBUN_RATE_LIMIT_PER_USER` and `_PER_IP` raised; a dev server reused locally keeps the defaults. The integration test of the rate limits checks the defaults.

## Session lifetimes (`apps/web/src/lib/auth/`)

- Auth.js 4 with the `database` strategy extends `expires` by `maxAge` (sliding) through `updateSession`; the adapter ignores it, so the maximum lifetime of the account kind stays fixed, and the idle timeout lives in its own column (`idle_expires_at`).
- Keycloak has no per-role session lifetimes (only realm and client settings); the team's 30 minutes / 12 hours are enforced by the web session, which ends the Keycloak session too.
