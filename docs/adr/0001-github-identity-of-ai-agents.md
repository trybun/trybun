# 0001 – GitHub identity of AI agents

- Status: superseded by [0005](0005-github-app-as-agent-identity.md)
- Date: 2026-10-21
- Deciders: the maintainer (`@dtk7c2`)
- Specification: [§2.14](../spec/02-agent-rules.md), [§16.3](../spec/16-open-source.md), [§16.4](../spec/16-open-source.md), [§16.5](../spec/16-open-source.md)

## Context and problem statement

Trybun is built by AI agents, and a human reviews and approves every change (item 15 of the Definition of Done, [§2.13](../spec/02-agent-rules.md)). The agents run through Cezar on a VPS: they push branches, open pull requests and can press the cockpit's merge button. `main` must accept only changes a human has approved.

GitHub never lets the author of a pull request approve it. If the agents act as the maintainer, nobody is left who can give the required approval; if the agents can approve, the approval proves nothing. Which GitHub identity do the agents use, and what makes a human approval necessary?

## Decision drivers

- A merge into `main` is impossible without the maintainer's approval, enforced by GitHub, not by agent instructions or by Cezar.
- Cezar uses one GitHub identity for the cockpit and for all agents: it forwards `HOME`, `GH_CONFIG_DIR` and `GH_TOKEN` to them and needs a `gh` user login.
- Least privilege: the agents' identity has no administrative rights, so it cannot change the protection of `main`.
- The same machine account serves the maintainer's other projects on the same machine, so its credential cannot be limited to one repository without one token per project.
- Free GitHub plan for the `trybun` organization.

## Considered options

1. **A machine account** – a separate GitHub user account for the agents, member of the organization with the Write role.
2. **A GitHub App** – the agents act as an app installation.
3. **Agents on the maintainer's account** – the agents use the maintainer's own credentials.

## Decision outcome

Chosen option: **1, a machine account** (`dtk7c2-2`), because it is the only option that makes the maintainer's approval both possible and required, and it works with Cezar's `gh` login.

GitHub's terms allow one free machine account per person. The account:

- is a member of the `trybun` organization with 2FA and has the **Write** role on `trybun/trybun` – never Maintain or Admin, here or in any other repository it reaches;
- authenticates with the **OAuth token of `gh`** (`gh auth login`, scopes `repo`, `workflow`, `read:org`, `gist`), stored in `gh` of the OS user that runs the agents. The token can do whatever the account can do, so the **Write role is the security boundary**, not the token. The `gist` scope belongs to the minimum scopes of `gh` and cannot be removed from its OAuth token; the risk that the token publishes content as gists is accepted;
- pushes branches and opens pull requests; it never approves them.

This decision covers only the project's own agents, run by the maintainer through Cezar. External contributors and their AI agents work from their own GitHub accounts and forks and sign off with their own identity ([§16.3](../spec/16-open-source.md), [§16.4](../spec/16-open-source.md)); for them nothing changes except that a code owner approves their pull requests.

The maintainer (`@dtk7c2`) is the only code owner (`.github/CODEOWNERS`: `* @dtk7c2`) and approves on GitHub (web or mobile app). The ruleset "Protect main" (default branch, active, no bypass actors) enforces this:

- a pull request is required, with 1 approval and Code Owners review;
- stale approvals are dismissed on push, and the most recent push must be approved by someone other than its pusher;
- squash is the only merge method; the squash commit takes the PR title, so the PR title must be a Conventional Commit;
- force pushes and branch deletion are blocked.

Maintainer credentials are never stored on machines or OS users where agents run.

**DCO sign-off (decided 2026-10-21):** the project's agents commit with the maintainer's identity and add the maintainer's `Signed-off-by` line ([§16.3](../spec/16-open-source.md)), as in the history so far; the maintainer's approval of the pull request confirms the sign-off. The rejected alternative – agents never sign off and the maintainer adds `Signed-off-by` to their commits – does not work with the ruleset: the maintainer would have to rewrite and push the commits of the pull request, become the pusher of its most recent push and could then no longer approve it, while no other code owner exists. The sign-off is the certificate of a person, not of a tool: the agents work on the maintainer's behalf, and the review before the approval is where the maintainer certifies the change ([§16.4](../spec/16-open-source.md)). External contributors sign off with their own identity.

The squash commit of a pull request opened by the machine account is authored by the machine account (`dtk7c2-2 <dtk7c2.2@gmail.com>`): GitHub makes the PR author the author of the squash commit, and the merge cannot choose another author. This is the intended attribution – the machine account prepared the change, and the `Signed-off-by: Dawid Fac <dtk7c2@gmail.com>` lines carried into the squash commit body show who is responsible for it ([§16.4](../spec/16-open-source.md)). The DCO check runs on the commits of the pull request, which are authored and signed off by the maintainer.

### Consequences

Good:

- No change reaches `main` without the maintainer's approval, whoever opens the pull request and whatever an agent's instructions say.
- Commits, pushes and pull requests of the agents are clearly attributable to the machine account; the human operator stays responsible for them ([§16.4](../spec/16-open-source.md)).
- Cezar's cockpit merge button runs as the machine account and works only when GitHub allows the merge. Cezar 0.16 reads merge requirements only from classic branch protection, which a Write account cannot read and which rulesets do not use; its button therefore stays disabled until "Merge without waiting for requirements" is checked. That option only skips Cezar's own pre-check – GitHub still enforces the ruleset.

Bad, and the rules that follow from it:

- **Cezar has no approve action.** The maintainer approves on GitHub; Cezar's own gates (review gate, `gate.human`, QA labels) are conveniences, not security boundaries.
- **Agent skills can approve.** The Open Mercato skills `om-approve-merge-pr` and `om-auto-review-pr` can approve and merge with the agent identity. For pull requests the machine account did not author (Dependabot, contributors), only the Code Owners review requirement stops that: approvals by the machine account never count.
- **Write can reach secrets and releases.** A Write account can push a branch whose workflow receives the repository secrets, or push a tag that triggers a release. Therefore release secrets go in a GitHub Environment that requires the maintainer's approval, and `v*` tags are protected by a ruleset (task S0-11).
- **Undocumented ruleset option.** GitHub added `require_extra_approval_for_unattributed_changes: true` to the ruleset by default. It is undocumented; its effect on the first pull requests is watched and recorded in project memory.
- **Shared `gh` login.** `gh auth login` on a shared OS user switches `gh` for every project of that user. An SSH remote pushes as the key's owner, so the remote is https and git uses `gh auth setup-git`.
- **Long-lived token.** The OAuth token of `gh` does not expire; it is revoked under *Settings → Applications → Authorized OAuth Apps → GitHub CLI* of the machine account when a machine is retired or the token may have leaked. Giving the machine account an Admin role anywhere would turn this token into an administrative credential.
- **Fine-grained token as an option.** A fine-grained personal access token (one per resource owner, with selected repositories, editable later, used with `gh auth login --with-token`) would limit the token itself and drop the `gist` scope, but needs a token per organization and regular renewal. It works only for organization members, not for outside collaborators.
- **One maintainer.** While the maintainer is the only code owner, nothing can be merged when they are unavailable; more code owners are added as the project grows ([§16.3](../spec/16-open-source.md)).

## Pros and cons of the options

### 1. A machine account

- Good: the maintainer is not the PR author, so their approval is possible and required.
- Good: works with Cezar's `gh` user login and with `git` over https.
- Good: free; permissions limited by the Write role.
- Bad: a second account to secure (2FA, revoking its token); a Write account can still push branches and tags (see the consequences).

### 2. A GitHub App

- Good: no extra user account; fine-grained installation permissions; actions attributed to `app[bot]`.
- Bad: installation tokens expire every hour and must be minted from the app's private key, which then lives on the machine.
- Bad: Cezar needs a `gh` user login; an app is not a user.

### 3. Agents on the maintainer's account

- Good: nothing to set up.
- Bad: the maintainer would be the author of every pull request and could not approve it, so no human approval is possible – the requirement of [§2.13](../spec/02-agent-rules.md) could only be met by bypassing protection.
- Bad: the maintainer's (Owner) credentials would be stored where agents run.
