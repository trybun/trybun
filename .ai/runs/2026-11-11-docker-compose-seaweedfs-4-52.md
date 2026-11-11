# Execution plan — Bump SeaweedFS to 4.52 with green CI (adopted from PR #281)

**Origin:** adopted — reconstructed by `om-auto-continue-pr` on 2026-11-11 because PR #281 carried no execution plan.
**PR:** #281 · **Branch:** `dependabot/docker_compose/docker-compose-cc4171eeca` · **Base:** `main`
**Author:** @dependabot — this plan interprets its intent; correct it by editing this file or commenting on the PR.

## 🎯 Goal

Update `chrislusf/seaweedfs` from 4.51 to 4.52 everywhere the repository pins it, so the PR passes every CI gate.

## Scope

- `compose.yaml` (already bumped by Dependabot).
- `apps/server/test/storage/seaweedfs.ts` – the Testcontainers image constant, which must equal the Compose reference (§2.10, `scripts/check-supply-chain.js`).

## Non-goals

- Any other image or dependency update.
- Changes to the SeaweedFS configuration or the storage adapter.

## Evidence

| Conclusion | Drawn from | Confidence |
|---|---|---|
| The goal is the 4.51 → 4.52 bump | PR title and body | high |
| "Format and lint" fails only because the test constant still pins 4.51 | CI log of run 42804803539: `apps/server/test/storage/seaweedfs.ts: chrislusf/seaweedfs:4.51@… is not the image of the Compose files (§2.10)` | high |
| Dependabot never updates image strings in TypeScript | `.ai/memory/docker.md` (Dependabot and image pinning); precedent #263 | high |
| The new digest belongs to tag 4.52 | `docker buildx imagetools inspect chrislusf/seaweedfs:4.52` | high |

## Assumptions

- No other file pins SeaweedFS 4.51 (checked with `grep -rn "seaweedfs:4\.5"`).

## Risks

- A SeaweedFS behaviour change in 4.52 could break the object-storage integration tests; covered by running `pnpm test:coverage` (Testcontainers).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Already landed on this PR (reconstructed)

- [x] 1.1 Bump the SeaweedFS image of compose.yaml to 4.52 — 5657fbc

### Phase 2: Make the supply-chain check green

- [ ] 2.1 Pin the SeaweedFS Testcontainers image to the 4.52 digest of compose.yaml
