# 0013 – The current time in the abilities

- Status: accepted
- Date: 2026-11-09
- Deciders: the maintainer (`@dtk7c2`), S1-12 Q21 approved on 2026-11-09
- Specification: [§4.3](../spec/04-ticket-lifecycle.md), [§18.3](../spec/18-code-patterns.md)
- Pull request: [#260](https://github.com/trybun/trybun/pull/260) (S1-12); decision: [#122](https://github.com/trybun/trybun/pull/122)

## Context and problem statement

An end user may comment on a `done` ticket for 14 days after it was closed, and is refused afterwards with `409 ticket.comments_closed` ([§4.3](../spec/04-ticket-lifecycle.md)). Like every permission, the rule must be a CASL rule ([§18.3](../spec/18-code-patterns.md)), so that the check of an action, the `allowedActions` of the ticket – the portal shows the comment field exactly when `add_comment` is present – and the filters of queries agree. The condition depends on the current time (`closedAt ≤ now − 14 days`), but the ability factory of S1-04 builds the rules from the principal alone (`AbilityRules = (builder, principal)`), and domain code never reads the clock itself ([§18.3](../spec/18-code-patterns.md), "Errors, configuration, logging and time").

Where does a rule get the current time?

## Decision drivers

- Rule 12: one way to express a permission – in the abilities, never next to them in a service.
- [§18.3](../spec/18-code-patterns.md): time comes from the injected clock, so tests use a fixed clock.
- Lists, details and `allowedActions` use the same rule ([§14.4](../spec/14-architecture.md#144-architectural-principles)).
- The smallest change to the existing rules.

## Considered options

1. **The injected clock in the ability factory**: `AbilityFactory` gets the `Clock` of `platform/clock`, reads it once per ability and passes `now` to every rule set as a third parameter.
2. **A flag set by a job**: a delayed job sets a column `comments_closed` 14 days after `closedAt`, and the rule reads the flag.
3. **A check in the service** after the ability, with the reason code thrown by hand.

## Decision outcome

**Option 1.** `AbilityRules` is `(builder, principal, now)`. The factory reads its injected clock once for each ability it builds, so every rule of one ability sees the same time; rules that do not depend on the time ignore the parameter. The guard and the service each build an ability with the current time, and the check on the locked row decides: a request that passes the guard just before the boundary and reaches the service after it gets `409 ticket.comments_closed`.

### Consequences

- Good: the time-dependent restriction is an ordinary CASL condition (`{ status: 'done', closedAt: { lte: <now − 14 days> } }`) with its reason, used in memory and as a query filter.
- Good: tests of the abilities pass a fixed clock (`test/fixed-clock.ts`), so the boundary is tested exactly.
- Bad: every construction of the factory names the clock; the root modules already provide it through the global `ClockModule`.

## Pros and cons of the other options

- **Option 2**: needs a new column, a timer and a migration of the closed tickets, and the comment field stays open for up to one job interval after the boundary.
- **Option 3**: a permission outside the abilities, which `allowedActions` and the filters would not know – against Rule 12 and [§14.4](../spec/14-architecture.md#144-architectural-principles).
