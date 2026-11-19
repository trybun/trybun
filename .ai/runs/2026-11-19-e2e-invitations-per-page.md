# Execution plan: an E2E test that the Accounts page reads invitations once per page of accounts

Source doc: .ai/specs/implemented/2026-11-15-invitations-of-many-accounts.md (spec PR #358, implementation PR #359)
Issue: #369

## Goal

A browser-level test proves that the Accounts page reads the pending invitations with one `GET /api/v1/invitations` per page of accounts – for **Load more** and for the refresh after a revocation – and that each row lists its own invitation, so a regression that reintroduces per-row reads fails CI.

## Scope

- `apps/web/e2e/accounts.spec.ts`: a test in the *accounts of the Administrator* describe, desktop only, seeding `DEFAULT_PAGE_LIMIT + 1` invited accounts through the BFF under unique `@example.org` addresses.
- `apps/web/e2e/bff-reads.ts`: records the reads of one API path a page makes through the BFF and waits for the network to settle.
- `.ai/memory/e2e.md`: the counting pattern and its limits.

Non-goals (issue): the server-side first page (invisible to the browser), rate-limit values, the 409 dialog behaviour (#368). No product code, specification or user documentation changes: the behaviour is unchanged.

## Risks

- A count taken before the network settled would hide a late per-row read: `settle()` waits for no request in flight and a 500 ms quiet window.
- The local E2E environment of this machine is used by another session; the CI E2E job is the run evidence.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The E2E test

- [x] 1.1 Add the request recorder and the test of the reads per page — 3b9a3c5
- [x] 1.2 Record the counting pattern in the project memory — e899dce
