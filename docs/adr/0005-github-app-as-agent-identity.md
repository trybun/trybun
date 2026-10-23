# 0005 – GitHub App as the identity of AI agents

- Status: accepted
- Date: 2026-10-23
- Deciders: the maintainer (`@dtk7c2`)
- Supersedes: [ADR 0001](0001-github-identity-of-ai-agents.md)
- Specification: [§2.14](../spec/02-agent-rules.md), [§16.3](../spec/16-open-source.md), [§16.4](../spec/16-open-source.md), [§16.5](../spec/16-open-source.md)

## Context and problem statement

[ADR 0001](0001-github-identity-of-ai-agents.md) gave the project's agents the machine account `dtk7c2-2`, so that the maintainer is never the author of their pull requests and GitHub requires the maintainer's approval. On 2026-10-21 GitHub silently flagged the account: its profile, issues and pull requests return 404 to everyone else, and its pull requests start no workflows. Whether and when the account is restored is unknown, and GitHub's terms allow only one free machine account per person.

The agents must keep a GitHub identity that is not the maintainer's, so that `main` still accepts only changes the maintainer has approved – enforced by GitHub, not by agent instructions. Which identity replaces the machine account?

## Decision drivers

- The decision drivers of [ADR 0001](0001-github-identity-of-ai-agents.md) still apply: GitHub enforces the maintainer's approval; least privilege – the agents cannot change the protection of `main`; Cezar runs every agent with the same `gh`; free plan.
- Not dependent on GitHub restoring `dtk7c2-2`.
- One identity for the maintainer's projects on the same machine, limited to the repositories it is installed on.

## Considered options

1. **A GitHub App** owned by the maintainer, installed on the repository.
2. **Agents on the maintainer's account** with a fine-grained personal access token and a ruleset bypass for organization owners.
3. **Waiting** for GitHub to restore `dtk7c2-2`.
4. **GitHub Enterprise Managed Users** – accounts provisioned by the enterprise through an identity provider.

## Decision outcome

Chosen option: **1, a GitHub App** (`dtk7c2-claude`, acting as `dtk7c2-claude[bot]`), because it is a separate identity – the maintainer can and must approve its pull requests – without a user account that can be flagged, and the ruleset "Protect main" needs no change.

The app:

- is owned by the maintainer's personal account and installable on **any account**, because a private app of a personal account can only be installed on that account. Anyone may install it on their own repositories, which gives them nothing; the token helper serves only the owners of its allowlist;
- is installed on the `trybun` organization for **`trybun/trybun` only**;
- has the repository permissions Contents, Issues, Pull requests and Workflows (read and write), Actions, Checks and Commit statuses (read) and Metadata (read) – **never Administration**, Secrets, Environments or Variables – no organization or account permissions and no webhook;
- authenticates with **installation access tokens**, which GitHub issues for exactly 1 hour against a JWT signed with the app's private key. The private key is the only long-lived credential; it stays on the machine where the agents run (`chmod 600`) and is revoked by deleting it in the app's settings;
- pushes branches, opens and comments on pull requests and issues; it never approves them.

On the machine, outside the repository (set up 2026-10-23):

- a token helper mints and caches the installation token per repository owner and renews it 5 minutes before it expires;
- a `gh` wrapper earlier on `PATH` gives `gh` the app's token in repositories of the allowlisted owners and leaves `gh` unchanged elsewhere, so the maintainer's other projects keep their own login;
- a git credential helper in the repository's own git config gives `git` over https the app's token.

No process may hold the token in a fixed `GH_TOKEN`: it would stop working after an hour, and Cezar forwards `GH_TOKEN` to every agent. `GH_TOKEN` therefore stays unset in Cezar's environment.

What [ADR 0001](0001-github-identity-of-ai-agents.md) decided beyond the identity stays in force:

- the maintainer (`@dtk7c2`) is the only code owner and approves on GitHub; the ruleset "Protect main" (pull request, 1 approval, Code Owners review, stale approvals dismissed, approval of the most recent push by someone other than its pusher, squash only, no force pushes or deletion, no bypass actors) is unchanged;
- the agents commit with the maintainer's identity and add the maintainer's `Signed-off-by`; the maintainer's approval of the pull request confirms the sign-off ([§16.3](../spec/16-open-source.md));
- maintainer credentials are never stored on machines or OS users where agents run.

The squash commit of a pull request opened by the app is authored by `dtk7c2-claude[bot]`; the `Signed-off-by: Dawid Fac <dtk7c2@gmail.com>` lines in its body show who is responsible ([§16.4](../spec/16-open-source.md)).

Verified on 2026-10-23 with test pull request #24: the app pushed a branch and opened the pull request; the pull request was `REVIEW_REQUIRED` and blocked until the maintainer approved it, then mergeable.

### Migration

- The 15 issues of `dtk7c2-2` (#8–#22) were recreated by the app as #25–#39 and closed as not planned with a link to their successors; the hidden pull request #23 (S0-02) was closed and reopened by the app from the same branch as #40.
- The machine account `dtk7c2-2` is removed from the organization and its `gh` token revoked once nothing depends on it any more.

### Consequences

Good:

- No change reaches `main` without the maintainer's approval, enforced by GitHub, as before.
- An app cannot be flagged as a new user account, has no password or 2FA to secure, and is free.
- The token is limited to the selected repositories and permissions and expires after an hour; a leaked token is useless sooner than the non-expiring OAuth token of the machine account.
- One app serves the maintainer's other projects: each installation selects its own repositories, and the token helper picks the installation by repository owner.

Bad, and the rules that follow from them:

- **The private key does not expire.** Whoever reads it can mint tokens for every installation of the app. It never leaves the agents' machine and is never committed; a leak is answered by deleting the key in the app's settings and generating a new one.
- **Permissions are shared by all installations.** Extending them needs the approval of every installation, which also means they never grow silently.
- **Write access still reaches workflows.** Contents and Workflows write let the app push a branch whose workflow runs with the repository's secrets, or push a tag. Release secrets therefore go in a GitHub Environment with required approval and `v*` tags get a tag ruleset (task S0-11), as in [ADR 0001](0001-github-identity-of-ai-agents.md).
- **Cezar.** Cezar's cockpit merge button runs as the app; reading classic branch protection returns 403 to it, so the button stays disabled until "Merge without waiting for requirements" is checked – GitHub still enforces the ruleset. Cezar has no approve action; its gates are conveniences, not security boundaries.
- **Agent skills can approve.** Approvals by the app never count, because it is not a code owner; for pull requests the app did not author, only the Code Owners review stops them – never approve with the agent identity.
- **One maintainer.** While the maintainer is the only code owner, nothing can be merged when they are unavailable.

## Pros and cons of the options

### 1. A GitHub App

- Good: separate identity; the maintainer's approval is possible and required without any ruleset bypass.
- Good: fine-grained permissions per app, repositories per installation, tokens expire after an hour.
- Bad: needs a token helper, a `gh` wrapper and a git credential helper on the machine, because tokens expire hourly.
- Bad: the private key is a long-lived secret on the agents' machine.

### 2. Agents on the maintainer's account

- Good: nothing new to set up on GitHub except the token.
- Bad: GitHub cannot tell the maintainer from an agent using the maintainer's token: the bypass that lets the maintainer merge their own pull requests lets the agents do it too, so the approval becomes a rule in the agents' instructions, not a GitHub requirement.
- Bad: maintainer credentials would be stored where agents run.

### 3. Waiting for `dtk7c2-2`

- Good: no change of the decision.
- Bad: blocks all work for an unknown time; the account may stay hidden.

### 4. Enterprise Managed Users

- Good: legitimate extra accounts provisioned by the enterprise.
- Bad: paid, needs an identity provider and a migration of the organization, and managed users are cut off from the rest of GitHub, which conflicts with an open source project accepting contributions from public accounts ([§16.3](../spec/16-open-source.md)).
