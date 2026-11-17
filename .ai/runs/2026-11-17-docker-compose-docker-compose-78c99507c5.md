# Execution plan — Bump Mailpit, SeaweedFS and Caddy with green CI (adopted from PR #361)

**Origin:** adopted — reconstructed by `om-auto-continue-pr` on 2026-11-17 because PR #361 carried no execution plan.
**PR:** #361 · **Branch:** `dependabot/docker_compose/docker-compose-78c99507c5` · **Base:** `main`
**Author:** @dependabot — this plan interprets its intent; correct it by editing this file or commenting on the PR.

## 🎯 Goal

Update `axllent/mailpit` (v1.33.0 → v1.33.1), `chrislusf/seaweedfs` (4.52 → 4.53) and `caddy` (2.11.7-alpine → 2.11.8-alpine) everywhere the repository pins them, so the PR passes every CI gate.

## Scope

- `compose.yaml`, `compose.dev.yaml` (already bumped by Dependabot).
- `apps/server/test/storage/seaweedfs.ts` – the Testcontainers image constant, which must equal the Compose reference (§2.10, `scripts/check-supply-chain.js`).

## Non-goals

- Any other image or dependency update.
- Changes to the SeaweedFS, Mailpit or Caddy configuration.

## Evidence

| Conclusion | Drawn from | Confidence |
|---|---|---|
| The goal is the three image bumps | PR title and body | high |
| "Format and lint" fails only because the test constant still pins 4.52 | CI log of run 43880721673: `apps/server/test/storage/seaweedfs.ts: chrislusf/seaweedfs:4.52@… is not the image of the Compose files (§2.10)`; every other check is green | high |
| Dependabot never updates image strings in TypeScript | `.ai/memory/docker.md`; precedents #263 and #281 | high |
| The new digests belong to the new tags | `docker buildx imagetools inspect` of `chrislusf/seaweedfs:4.53`, `axllent/mailpit:v1.33.1`, `caddy:2.11.8-alpine` | high |

## Assumptions

- No other file pins the old Mailpit, SeaweedFS or Caddy versions (checked with `grep -rn` outside `node_modules`, `.git` and `.ai`).

## Risks

- A SeaweedFS behaviour change in 4.53 could break the object-storage integration tests; covered by running `pnpm test:coverage` (Testcontainers).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Already landed on this PR (reconstructed)

- [x] 1.1 Bump the Mailpit, SeaweedFS and Caddy images of the Compose files — 75b4229

### Phase 2: Make the supply-chain check green

- [x] 2.1 Pin the SeaweedFS Testcontainers image to the 4.53 digest of compose.yaml — 6516437
