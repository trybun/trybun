# Execution plan — bump rclone to 1.76.0 and Node.js to 24.22.2 in the images, CI and local development (adopted from PR #362)

**Origin:** adopted — reconstructed by `om-auto-continue-pr` on 2026-11-17 because PR #362 carried no execution plan.
**PR:** #362 · **Branch:** `dependabot/docker/docker/backup/docker-6224c34b4d` · **Base:** `main`
**Author:** @dependabot — this plan interprets its intent; correct it by editing this file or commenting on the PR.

## 🎯 Goal

Merging PR #362 moves the backup image to `rclone/rclone:1.76.0` and the server and web images to the newest Node.js 24 release, `node:24.22.3-trixie-slim` (pinned by digest; Dependabot proposed 24.22.2, see Evidence), with `.node-version` following so CI and local development run the same Node.js release as production.

## Scope

- `docker/backup/Dockerfile`, `docker/server/Dockerfile`, `docker/web/Dockerfile` (Dependabot's commit).
- `.node-version` (the runtime of CI through `node-version-file` and of local development, §14.2, §15.12).

## Non-goals

- No other dependency updates, no change of the Node.js LTS line (§2.10).
- The file name of this plan keeps 24.22.2 (the version Dependabot proposed); it is referenced from the PR body.
- No change of `backup.sh`: the rclone 1.76.0 changelog has no change to the commands and options it uses.

## Evidence

| Conclusion | Drawn from | Confidence |
|---|---|---|
| The goal is the two image updates | PR body and diff (Dependabot) | high |
| `.node-version` follows a Node.js image bump in the same PR | #261 (`chore(deps): align .node-version with the Node.js 24.22.1 images`), §14.2 (Node.js version pinned in `.node-version`) | high |
| Node.js 24.22.2 is an LTS (Krypton) release of 2026-10-27, past the 7-day cooldown | `https://nodejs.org/dist/index.json` | high |
| The images go to 24.22.3 instead: a security release of 2026-11-10 (high: HTTP request smuggling and HTTP/2, TLS server crashes and client certificate bypass, undici and llhttp updates), which Rule 10 takes immediately, without the cooldown that kept Dependabot on 24.22.2 | `https://nodejs.org/dist/index.json` (`security: true`), Node.js blog "November 2026 security releases", §2.10 | high |
| rclone 1.76.0 (2026-11-06) needs no change of `backup.sh` | rclone changelog v1.76.0: security fixes; S3 changes are regions, uploads and `--s3-directory-markers`; `rcat`, `cat`, `lsf`, `sync`, `mkdir` and environment remotes unchanged in behaviour for our use | medium |

## Assumptions

- The backup image is verified by the restore test (`scripts/restore-test.sh`, §13.6) against locally built images and a locally built deployment package: PR CI does not run it (only the release workflow does), and it is the only test that runs the image's rclone against real S3 storage.

## Risks

- Low: patch releases of Node.js 24 and a minor release of rclone.
- Dependabot no longer rebases the PR after the added commits; it is merged as it is or recreated.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Already landed on this PR (reconstructed)

- [x] 1.1 Bump rclone and the Node.js images in the Dockerfiles — 3d0b506

### Phase 2: Align the runtime

- [x] 2.1 Merge main into the PR branch — 3db8aff
- [x] 2.2 Align .node-version with the Node.js 24.22.2 images — ca807e9
- [ ] 2.3 Build the images and run the validation gate

> 2.3 runs after Phase 3, on the final tree (Phase 3 was added after the plan was adopted).

### Phase 3: Node.js 24.22.3 security release

- [x] 3.1 Move the images and .node-version to Node.js 24.22.3 — d88b18d
