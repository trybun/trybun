# 0007 – Rate-limit storage on NestJS 12

- Status: proposed
- Date: 2026-10-25
- Deciders: the maintainer (`@dtk7c2`)
- Specification: [§2.10](../spec/02-agent-rules.md), [§14.2](../spec/14-architecture.md), [§14.4](../spec/14-architecture.md)

## Context and problem statement

The API limits its requests with `@nestjs/throttler`, with the counters in Valkey so that every instance of the API shares them ([§14.4](../spec/14-architecture.md)). The specification names `@nest-lab/throttler-storage-redis` as the storage ([§14.2](../spec/14-architecture.md)).

The state on 2026-10-25:

- `@nestjs/throttler` 6.7.1 (2026-09-24) declares NestJS 12 in its peer dependencies.
- `@nest-lab/throttler-storage-redis` 1.2.0 (2026-02-03), the latest version, declares `@nestjs/common` and `@nestjs/core` only up to 11 (jmcdo29/nest-lab#75) and `ioredis >=5.0.0`; the project uses NestJS 12 and `ioredis` 6. pnpm reports the unmet peers, and the package itself does not depend on any NestJS 12 change: one `@Injectable()` class that runs a Lua script with `ioredis`.

How does the API store the counters until the storage declares NestJS 12?

## Decision drivers

- Rule 1 and [§14.2](../spec/14-architecture.md): the established storage of the throttler, no own rate-limit algorithm.
- Rule 10: dependencies are current, and an unmet peer is a known, checked exception rather than an accident.
- The rate limit fails open when Valkey is unavailable ([§14.4](../spec/14-architecture.md)).

## Considered options

1. **`@nest-lab/throttler-storage-redis` 1.2 with its peers allowed for NestJS 12**, covered by an integration test on Valkey.
2. **An own storage** implementing `ThrottlerStorage` with the same Lua script.
3. **The in-memory storage of `@nestjs/throttler`** – counters per instance of the API.

## Decision outcome

**Option 1.** `pnpm-workspace.yaml` allows NestJS 12 for the package (`peerDependencyRules.allowedVersions`: `@nest-lab/throttler-storage-redis>@nestjs/common` and `>@nestjs/core` `12`). `ValkeyThrottlerStorage` (`apps/server/src/platform/rate-limiting/`) wraps it with its own `ioredis` connection that fails fast (`enableOfflineQueue: false`) and turns a Valkey error into a passing request with a warning. `rate-limiting.integration.spec.ts` runs the throttler with the storage on a Valkey container: the 101st request of a user in a minute returns `429` with the `RateLimit` headers, the public endpoints are counted per client IP, and requests pass while Valkey is unavailable.

### Consequences

- Good: the storage the specification names; counters shared by every instance of the API, atomic in one Lua script.
- Good: an incompatibility shows up in the integration test of every pull request, including Dependabot updates of NestJS, the throttler, the storage or `ioredis`.
- Bad: the peer exception must be removed when the storage declares NestJS 12 (watch jmcdo29/nest-lab#75); until then pnpm does not warn about a real incompatibility of the package with NestJS 12.

## Pros and cons of the other options

- **Own storage**: no unmet peer, but a copy of a maintained library in the project (Rule 1, Rule 12) that the project would have to keep correct itself.
- **In-memory storage**: no dependency, but every instance of the API would count on its own, so the limits would grow with the number of instances, and a restart would reset them.
