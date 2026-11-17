# Accounts page: the pending invitations of a page of accounts in one read

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-11-15 |
| Plan task | – (follow-up of #310) |
| System specification sections | §7.4, §12.1, §18.5 |
| Related issues / PRs | #357, #358, #359, #355, #310, #356 |

## 📝 TLDR

The Administrator's **Accounts** page (`/admin/accounts`, §7.4) reads the pending invitations of each invited account with its own request, so one page of 50 accounts can cost 51 API requests out of the user's 100 per minute (§14.4). Proposed: `GET /api/v1/invitations` accepts a repeated `userId` (up to 50 values), the lookup pattern §12.1 already defines. The page then reads the invitations of all its invited accounts with one paged read per page of accounts, and the web application keeps them in one query per page. A page of accounts then costs 2 requests, whatever the number of invited accounts.

## 📝 Problem Statement

After #355, `usersQueryOptions` (`apps/web/src/features/users/queries.ts`) loads each page of accounts and then, before it returns the page, prefetches `userInvitationsQueryOptions(client, user.id)` for every account that `hasPendingInvitations`. That is one `GET /api/v1/invitations?userId=…` per account, because `listInvitationsQuerySchema` (`packages/contracts/src/invitations/index.ts`) accepts one `userId`.

QA of PR #355 measured the cost ([evidence, step 14](https://github.com/trybun/trybun/pull/355#issuecomment-6900773595)). With 31 accounts with pending invitations, one render of the **Invited** filter cost 35 API requests. Switching the filters Invited → All → Invited once left 2 of the 100 requests of the minute. The next request was refused, which shows the not-found page (#356).

The per-account queries also multiply every later read, not only the first one:

- every invitation mutation invalidates `['invitations']` (`features/invitations/mutations.ts`), which refetches each mounted per-account query: one request per invited account after every **Revoke** or **Copy new link**;
- after the 60 s `staleTime` (`QUERY_CLIENT_CONFIG`), focusing the window refetches each mounted per-account query again.

The fix therefore has to reduce the number of **cached queries**, not only the number of requests of the first read.

## 📝 Proposed Solution

1. **API – a repeated `userId`.** `GET /api/v1/invitations` accepts `userId` once or repeated (`userId=a&userId=b`, OpenAPI `style: form, explode: true`), at most 50 values (`MAX_TICKET_FILTER_VALUES`), combined with OR. This uses the existing contract helper `oneOrMore`, as `userId` of `GET /project-members` and `id` of `GET /projects` already do (§12.1). The lookup only narrows the CASL `accessibleBy` filter: an invisible invitation is simply absent. A single `userId` keeps working, so the change is additive.
2. **Web – one invitations query per page of accounts.** The query `accountsInvitationsQueryOptions(client, accounts)` (the accounts of the page) (`features/invitations/queries.ts`) reads every pending invitation of the given accounts with `allPageItems` (`limit` = `MAX_PAGE_LIMIT`). Its key is `['invitations', 'list', { userId: <the IDs of all accounts of the page, in page order> }]`, and it sends exactly those IDs. A page of accounts has at most 50 (`DEFAULT_PAGE_LIMIT`), which is the parameter's bound (`MAX_TICKET_FILTER_VALUES`), and a unit test pins that relation. The key is built from all accounts of the page, not only those with invitations. Revoking an account's last invitation therefore does not change the key, and the refetch of the page of accounts reuses the read the invalidation started instead of starting a second one. The server returns nothing for accounts without pending invitations. As today, `usersQueryOptions` prefetches the query into the cache (`context.client`) before it returns the page (§18.5), only when one of the page's accounts `hasPendingInvitations`, and with `retry: false`: an explicit `retry` of the query options would otherwise override the prefetch's default. Each `AccountInvitations` row whose account `hasPendingInvitations` observes its page's query with `select`, keeping its own account's invitations. One query per page means the first read, a refetch, an invalidation and a window-focus refetch each cost one paged read per page of accounts. Like the project detail query (`features/projects/queries.ts`), the query does not retry a `4xx` such as a `429`.
3. The per-account query `userInvitationsQueryOptions` is removed: the Accounts page was its only consumer. Because the page query reads all of the account's pending invitations, the per-account **Load more** inside a row goes too. The project invitations list (`projectInvitationsQueryOptions`) keeps its own paging.

**Alternatives considered:**

- **Embed the invitations in `GET /api/v1/users`** (option 1 of #357). This would be one request per page. It is rejected by the maintainer's decision on #357: every caller of `GET /users` would pay for it, and it would add a second way of reading related records of a list next to the §12.1 lookup (Rule 12).
- **Keep the per-account queries and seed them from one batched read** (`setQueryData` per account, the "push" seeding of the [TanStack Query guide](https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data)). This fixes the first read only. Invalidation and window-focus refetches still run one request per account (see Problem Statement), so it does not meet #357.
- **A grouped response** (`{ userId, invitations, nextCursor }[]`). This would be a new response shape beside the §12.1 list envelope, for the per-account paging that a page of accounts does not need.

## 📝 Delta

### Capability: account-invitations

**MODIFIED** – the invitations list narrows by one or more accounts

- WHEN a principal who may read invitations sends `GET /api/v1/invitations` with `userId` repeated for up to 50 accounts THEN the response lists, newest first and page by page, the invitations of any of those accounts that the principal may see, in the requested state (pending by default).
- WHEN `userId` is sent once THEN the response is the same as today.
- WHEN more than 50 `userId` values or a value that is not a UUID are sent THEN the response is `422` with the field error of the parameter, as for the other lookups of §12.1.
- WHEN a given account has invitations the principal may not see (e.g. a Project manager and another project's invitation) THEN those are absent, never a `403`.

Frozen by: `apps/server/src/modules/invitations/invitations.integration.spec.ts` (a new characterization test of today's single `userId`, Phase 1 Step 1)

**MODIFIED** – the Accounts page reads the pending invitations with each page of accounts

- WHEN the Accounts page shows a page of accounts, the first one (server prefetch) or one added by **Load more** or a search THEN the invitations of the accounts that `hasPendingInvitations` are read with one paged read of `GET /api/v1/invitations` (a page of 50 accounts with up to 100 pending invitations in total: one request), and the page appears with them (#310).
- WHEN an invitation is revoked or a new link is copied, or the window regains focus after the data went stale THEN the invitations are read again with one paged read per loaded page of accounts, never one request per account.
- WHEN the invitations of a page cannot be read THEN the page of accounts is still shown, and its rows read their page's invitations again with one paged read.

Frozen by: `apps/web/src/features/users/queries.spec.ts` (`brings the pending invitations of every page, Load more too (#310)`)

## 📝 Architecture

- **`@trybun/contracts`** – `listInvitationsQuerySchema.userId` becomes `oneOrMore(z.uuid()).optional()`. The output type of `ListInvitationsQuery.userId` becomes `string[] | undefined`, as in `ListProjectMemberAccountsQuery`. The comment of `User.pendingInvitationCount` names the repeated parameter.
- **Server** – `InvitationsService.list` filters `userId: query.userId === undefined ? undefined : { in: query.userId }` inside the existing `AND` with `accessibleBy(ability, 'read').ofType(INVITATION)`. No new ability, endpoint, migration or index: `invitations` already has `@@index([userId])` and `@@index([createdAt, id])`. `pnpm api:generate` regenerates `apps/server/openapi.json` and `apps/web/src/lib/api-client/schema.d.ts`.
- **Web** – `features/invitations/queries.ts`: `accountsInvitationsQueryOptions` replaces `userInvitationsQueryOptions`. `usersQueryOptions` and the list build the page's query from the same `page.items`. `features/users/components/account-list.tsx` passes each row the accounts of its page (`pageAccounts`) for `AccountInvitations`. `AccountInvitations` uses `useQuery` with `select` instead of `useInfiniteQuery`, and renders `PendingInvitationList` without a next page.
- The BFF, the CASL definitions and the rate limit are untouched.

## 📝 UI/UX

No visible change for the usual one or two invitations per account. The rows look and behave as today, in the first paint too (#310, `apps/web/e2e/hydration-layout.spec.ts`). A row no longer offers **Load more** for an account's invitations: it shows all of them, as the project's invitation list does when it is short. No new texts, so no translation, help or product-tour change.

## 📝 Edge Cases & Failure Scenarios

- **More than 100 pending invitations on one page of accounts.** `allPageItems` follows `nextCursor`, so each further 100 invitations cost one more request. This is still independent of the number of accounts.
- **More than 2,000 pending invitations on one page of accounts** (the `ALL_PAGES_MAX_PAGES` bound of `allPageItems`, 20 pages of 100). The page shows the 2,000 newest, and older ones of the accounts concerned are not listed. `allPageItems` stops at its bound without telling the caller, so the row does not show that some are missing. This is a known limit, the same as for the ticket filter options (spec of 2026-11-10). It is out of reach in practice: 50 accounts with 40 pending invitations each.
- **The page size and the parameter's bound drift apart.** A unit test asserts `DEFAULT_PAGE_LIMIT <= MAX_TICKET_FILTER_VALUES`, so a larger page of accounts cannot ship without adapting the read.
- **The length of the URL.** 50 UUIDs make a query string of about 2.2 kB, well within what Caddy, Next.js and Node.js accept.
- **The invitations change between the two reads.** An account's `pendingInvitationCount` and its listed invitations can differ for one render. The next read of the page corrects it, as today.
- **The invitation read fails (e.g. `429`, #356).** The prefetch does not fail the page of accounts: `prefetchQuery` neither throws nor retries (TanStack Query's `fetchQuery` defaults to `retry: false`). The server does not dehydrate the failed query. The page's invitations query is in its error state, and the rows read it again once they mount: one paged read, not one per account. A `4xx` is not retried after that, a `5xx` up to 3 times. While it has no data, a row renders nothing, as today.
- **An account appears on two loaded pages** (a cursor of a changed list). Each page's query lists its invitations, and each row selects its own.
- **Visibility.** Only the Administrator reaches the Accounts page. The API still returns only what the principal may see, so a Project manager calling the lookup gets only their projects' invitations.

## 📝 Risks & Impact Review

The contract change is additive and backward-compatible (a single `userId` keeps working). Per `BACKWARD_COMPATIBILITY.md` ("HTTP API `/api/v1`"), only the web app of the same release calls the API today, so the regenerated OpenAPI document and client plus the specification update are enough. Once API tokens exist, the parameter cannot be narrowed back without a new API version. No schema, permission or data change. Rollback reverts the web query and the parameter together.

## Changes to the system specification

| Section | Change |
|---|---|
| §7.4 | The Accounts page reads the pending invitations of the accounts that have some with one `GET /api/v1/invitations?userId=…&userId=…` per page of accounts. |
| §12.1 | The lookup by repeated ID also covers `userId` of `GET /invitations`. |
| §18.5 | Data that comes with the rows of a page is read and cached once per page, not once per row. The Accounts page reads one invitations query per page of accounts, selected by each row. |

## Non-goals

- The rate-limit values (§14.4) and the error shown on a `429` (#356).
- Embedding invitations in `GET /api/v1/users`.
- Paging of the invitations within one account's row.
- Any change to the project or organization invitation lists.

## Resolved assumptions (autonomous defaults)

Q1 was decided by the maintainer before the spec was written; Q2–Q4 were applied as autonomous defaults and **confirmed by the maintainer on 2026-11-17**, after the manual QA of the implementation (#359).

| # | Question | Applied answer | Why |
|---|---|---|---|
| Q1 | Embedded invitations in `GET /users`, or several `userId` in `GET /invitations`? | Several `userId`, at most 50 (**decided by the maintainer** on #357, [comment](https://github.com/trybun/trybun/issues/357#issuecomment-6902271849)). | The existing §12.1 lookup pattern (Rule 12); `GET /users` stays lean. |
| Q2 | How many invitations per account? | All pending invitations of the page's accounts, up to the `allPageItems` bound (2,000 per page of accounts); no per-account cap and no per-account **Load more**. | One read per page keeps the request count independent of the accounts. An account usually has one or two invitations, so a cap would only add a second, rarely used read path. |
| Q3 | One cached query per account (seeded) or per page of accounts? | Per page of accounts, observed by each row with `select`. | Only this keeps invalidations and window-focus refetches constant per page. Seeding per account fixes the first read only. |
| Q4 | What does a failed read do? | It does not fail the page of accounts. The rows read their page's query again once (one paged read), and a `4xx` is not retried. | Keeps today's behaviour (#355) without its per-account requests. Retrying a `429` would only use up more of the limit. |

## Acceptance criteria

- [x] `GET /api/v1/invitations` accepts `userId` once or repeated (≤ 50 values) and lists the visible invitations of any of the given accounts; more than 50 or a non-UUID value answers `422` (integration tests).
- [x] `permission-layer.integration.spec.ts` has a row per principal fixture: listing by account returns exactly the invitations its detail check allows.
- [x] One page of 50 invited accounts with at most 100 pending invitations among them costs exactly 2 API requests: the accounts and one invitations read. Load more and a search cost the same per page (unit test of `usersQueryOptions`).
- [x] Revoking an invitation, including an account's last one, or copying a new link reads the invitations again with one read per loaded page of accounts, not one per account (component or unit test).
- [x] The invitations stay part of the first paint and of every later page; `apps/web/e2e/hydration-layout.spec.ts` stays green (#310).
- [x] §7.4, §12.1 and §18.5 updated; OpenAPI document and client regenerated.
- [x] Works on phone, tablet and desktop (Rule 9); no visible change, no new texts.

## 📋 Implementation Plan

**Phase 1 – the repeated `userId` of the invitations list (API)**

1. Characterize: add an integration test in `invitations.integration.spec.ts` that lists by one `userId` (two accounts, the invitations of one listed) and run it green on the unchanged code.
2. Change `listInvitationsQuerySchema.userId` to `oneOrMore(z.uuid()).optional()` and `InvitationsService.list` to `{ in: … }`. Extend the test: two accounts given, a third left out, the 50-value bound and a non-UUID (`422`), and a Project manager who gets only the invitations of their projects for the given accounts. Contract unit test of the schema.
3. Add the `permission-layer.integration.spec.ts` row "lists for %s by account only the invitations its detail check allows" (as the attachments row by ID), and run `pnpm api:generate`.

**Phase 2 – one invitations query per page of accounts (web)**

4. Characterized by the existing `queries.spec.ts` test. Add `accountsInvitationsQueryOptions` to `features/invitations/queries.ts`, and prefetch the page's query from `usersQueryOptions`. Update `queries.spec.ts`: 50 invited accounts → exactly 2 requests, `nextCursor` followed, Load more with its own page query, no invitations read for a page without invited accounts, a failed read that does not fail the page, and `DEFAULT_PAGE_LIMIT <= MAX_TICKET_FILTER_VALUES`.
5. Move `AccountInvitations` onto the page query with `select`, pass the page IDs from `account-list.tsx`, and remove `userInvitationsQueryOptions` and the per-row **Load more**. Update the component tests (`inviting-components.spec.tsx`), including the revocation of an account's last invitation, which reads once per page.
6. Update §7.4, §12.1 and §18.5. Run the validation gate and `apps/web/e2e/hydration-layout.spec.ts`. In the implementation PR, set this specification to `implemented`, add its changelog entry and move it to `implemented/`. The repository's living truth is `docs/spec/`, so the Delta is applied there, not to a separate capability file.

## Changelog

- 2026-11-15 – Created (#357; Q1 decided by the maintainer, Q2–Q4 autonomous defaults).
- 2026-11-15 – Specification review: the page query's key covers all accounts of the page, so the last revocation does not start a second read; no retry on a `4xx`; the request count is stated with its conditions.
- 2026-11-15 – Aligned with the implementation PR #359: the query takes the accounts of the page, and the prefetch sets `retry: false` (an explicit `retry` of the options overrides the default of `prefetchQuery`).
- 2026-11-17 – Q2–Q4 confirmed by the maintainer (#358).
- 2026-11-17 – Implemented (#359): the repeated `userId` of `GET /api/v1/invitations` (`oneOrMore`, ≤ 50) and `accountsInvitationsQueryOptions`, one invitations query per page of accounts; §7.4, §12.1 and §18.5 updated. #359 merged before this specification, so the specification PR #358 sets the status and moves the file. Review of #358: the rows get the accounts of their page (`pageAccounts`), not their IDs.
