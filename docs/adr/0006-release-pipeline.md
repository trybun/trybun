# 0006 – Release pipeline

- Status: proposed
- Date: 2026-10-24
- Deciders: the maintainer (`@dtk7c2`)
- Specification: [§2.10](../spec/02-agent-rules.md), [§2.11](../spec/02-agent-rules.md), [§15.4](../spec/15-deployment.md), [§16.3](../spec/16-open-source.md), [§16.5](../spec/16-open-source.md)

## Context and problem statement

Rule 11 ([§2.11](../spec/02-agent-rules.md)) and [§15.4](../spec/15-deployment.md) define the releases: release-please keeps a release pull request, merging it is the human decision, and CI then publishes the images `ghcr.io/trybun/web`, `server` and `postgres`, the SBOM and the deployment package, never with a known critical vulnerability. Release candidates and maintenance branches `release/X.Y.x` must be supported.

Three facts of GitHub shape how:

- A pull request opened with the workflow's `GITHUB_TOKEN` starts no workflows, so the release pull request would never get the required status checks of "Protect main".
- The agents' GitHub App has Contents and Workflows write ([ADR 0005](0005-github-app-as-agent-identity.md)): it can push a branch whose workflow receives the repository's secrets, or push a tag. Release credentials therefore belong in a GitHub Environment, and `v*` tags in a tag ruleset.
- GitHub Container Registry accepts only `GITHUB_TOKEN` or a classic personal access token, not the token of a GitHub App.

How are release pull requests, tags, images and GitHub Releases created without giving the agents a path to publish a release?

## Decision drivers

- Only the maintainer decides that a release is published; GitHub enforces it, not agent instructions.
- Nothing is published before the images are scanned; what is published is exactly what was scanned.
- The release pull request passes the same checks as every other pull request.
- Minimum maintainer steps (Rule 2): updating the release pull request after every merge needs no action.
- Least privilege: the jobs that build untrusted input have no write permission and no secrets.

## Considered options

1. **A release app and two environments**: a GitHub App of the maintainer for release-please; its credentials in an environment limited to the release branches; publishing in a second environment that requires the maintainer's approval.
2. **`GITHUB_TOKEN` only**, starting CI on the release pull request with `workflow_dispatch`.
3. **One environment with approval** for every job, release-please included.
4. **The maintainer's personal access token** for release-please and the registry.

For release candidates:

- **A. A manual run of the release workflow** that tags the version of the open release pull request as `X.Y.Z-rc.N`.
- **B. release-please's `prerelease` versioning**, switched on for a candidate.

## Decision outcome

Chosen option: **1 with A**, because it is the only combination in which the release pull request passes the required checks, publishing waits for the maintainer, and the agents' app cannot reach any release credential.

`.github/workflows/release.yml` runs on every push to `main` and `release/*`:

- **Release pull request** – release-please with the token of the release app `trybun-release`, whose client ID and private key are stored only in the environment `release-please` (deployment branches `main` and `release/*`). Its pull requests start CI like any other; merging one creates the tag `vX.Y.Z` (the app is the bypass actor of the tag ruleset) and a **draft** GitHub Release. On `release/X.Y.x` it uses `release-please-config.maintenance.json`, which only increases PATCH.
- **Release candidate** – "Run workflow" on `main` or `release/X.Y.x` reads the version of the branch's open release pull request, tags the branch head `vX.Y.Z-rc.N` (`N` continues after the last candidate) and creates a draft pre-release. `CHANGELOG.md` records releases only.
- **Images, SBOM, deployment package** – without secrets and with read-only permissions: each image is built once, scanned by Trivy (a `CRITICAL` vulnerability fails the job and blocks the release), described by a CycloneDX SBOM of Syft and exported; the deployment package is built from the tag (`scripts/build-deployment-package.js`).
- **Publish** – waits for the maintainer's approval in the environment `release` (deployment branches `main` and `release/*`), runs no code of the repository, pushes exactly the exported images with `GITHUB_TOKEN` (`X.Y.Z`, plus `X.Y` and `X` while the release is the highest of their series; a candidate only its own tag), attaches the SBOMs, the deployment package and `SHA256SUMS`, and publishes the release – as a pre-release for a candidate, as the latest release only for the highest version (`scripts/release.js`).

### Set-up by the maintainer

The agents' app cannot make these settings (no Administration permission):

1. Create the GitHub App `trybun-release` (no webhook) with the repository permissions Contents, Pull requests and Issues (read and write) and install it on `trybun/trybun` only.
2. Create the environment `release-please` with the deployment branches `main` and `release/*`, the variable `RELEASE_APP_CLIENT_ID` and the secret `RELEASE_APP_PRIVATE_KEY`.
3. Create the environment `release` with the maintainer as required reviewer and the deployment branches `main` and `release/*`.
4. Add a tag ruleset for `refs/tags/v*` that restricts creations, updates and deletions, with `trybun-release` as the only bypass actor.
5. Add `refs/heads/release/*` to the targets of the ruleset "Protect main", so nobody pushes to a maintenance branch without an approved pull request.
6. After the first release, make the packages `web`, `server` and `postgres` of the organization public.

### Consequences

- Good: the release pull request gets the required checks; a release needs the merge of the maintainer and the approval of the maintainer, after the scan result is visible.
- Good: the agents' app can neither create `v*` tags nor run a job of either environment – a branch it pushes is not a deployment branch.
- Good: the published image is byte for byte the scanned image; a failed scan leaves an unpublished draft.
- Bad: six set-up steps for the maintainer, and a second click (the approval) per release.
- Bad: a release blocked by a vulnerability keeps its tag and draft. The fix is released as the next PATCH version, and the maintainer deletes the draft and its tag.
- Bad: any workflow with `packages: write` in this repository could push to `ghcr.io/trybun/*`, including one on a branch pushed by the agents' app, because the registry has no credential bound to an environment. Changes of workflows are reviewed by the code owner; the deployment package and the Administrator use only the released tags.
- Neutral: the images are built for `linux/amd64` only.

## Pros and cons of the options

### 1. A release app and two environments

- Good: see the consequences.
- Bad: a second GitHub App to own; its private key is stored in an environment.

### 2. `GITHUB_TOKEN` only

- Good: no app, no stored secret.
- Bad: the checks of the pull request title and of the DCO read the `pull_request` event, which a `workflow_dispatch` run does not have; `v*` tags created with `GITHUB_TOKEN` would need the whole of GitHub Actions as a bypass actor of the tag ruleset – including workflows on the agents' branches.

### 3. One environment with approval for every job

- Good: one environment.
- Bad: every merge into `main` waits for an approval only to update the release pull request (Rule 2).

### 4. The maintainer's personal access token

- Good: works for the registry too.
- Bad: a long-lived credential of the maintainer in the repository's settings, against [§16.5](../spec/16-open-source.md); the agents' work would appear as the maintainer's.

### A. A manual run tags the release candidate

- Good: one click; the candidate is built from the branch head with the version the release pull request will release.
- Bad: release-please does not know the candidates; they appear only as GitHub pre-releases.

### B. release-please's `prerelease` versioning

- Good: candidates in `CHANGELOG.md`.
- Bad: with `prerelease: true` release-please marks every `0.x` release as a pre-release, and switching the configuration for a candidate rewrites the one release pull request back and forth.
