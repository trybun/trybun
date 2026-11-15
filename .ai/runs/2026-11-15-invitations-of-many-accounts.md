# Execution plan — The pending invitations of a page of accounts in one read

**Source doc:** `.ai/specs/2026-11-15-invitations-of-many-accounts.md` (spec PR #358, issue #357)
**Branch:** `feat/invitations-of-many-accounts` · **Base:** `main`

## 🎯 Goal

`GET /api/v1/invitations` accepts a repeated `userId` (≤ 50), and the Accounts page reads the pending invitations of each page of accounts with one query per page: 2 requests for a page of 50 invited accounts, and one read per page after an invalidation or a focus refetch.

## Scope

- `packages/contracts/src/invitations/index.ts`: `userId: oneOrMore(z.uuid()).optional()`; the `User.pendingInvitationCount` comment.
- `apps/server/src/modules/invitations/invitations.service.ts`: `{ in: … }`; integration tests; a `permission-layer.integration.spec.ts` row; `pnpm api:generate`.
- `apps/web/src/features/invitations/queries.ts` (`accountsInvitationsQueryOptions` replaces `userInvitationsQueryOptions`), `features/users/queries.ts`, `features/invitations/components/account-invitations.tsx`, `features/users/components/account-list.tsx`; unit and component tests.
- §7.4, §12.1, §18.5.

## Non-goals

- Rate-limit values, the `429` page (#356), embedding in `GET /users`, other invitation lists.
- Moving the spec to `implemented/`: the spec reaches `main` with its own PR #358. It moves once both PRs have merged, as with #272/#276.

## Risks

- An HTTP contract change (additive). Only the same-release web app calls it (`BACKWARD_COMPATIBILITY.md`).
- `select` on a shared query: covered by component tests.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The repeated userId of the invitations list

- [x] 1.1 Characterize listing by one userId — 46f7daa
- [x] 1.2 Repeated userId in the contract and the service with integration tests — 5d3a142
- [x] 1.3 Permission-layer row and regenerated OpenAPI client — dfdd9d3

### Phase 2: One invitations query per page of accounts

- [x] 2.1 accountsInvitationsQueryOptions prefetched by usersQueryOptions with unit tests — 0b8e837
- [x] 2.2 AccountInvitations on the page query, per-account query removed, component tests — 0b8e837
- [x] 2.3 Specification updates and the validation gate — eca5024, d7fa890
