# GitHub – agent identity, tokens and the ruleset

Non-obvious behaviour of GitHub and Cezar found when the agents' GitHub identity was set up (October 2026). Decision: [ADR 0001](../../docs/adr/0001-github-identity-of-ai-agents.md); rules: [§2.14](../../docs/spec/02-agent-rules.md), [§16.3](../../docs/spec/16-open-source.md)–[§16.5](../../docs/spec/16-open-source.md).

- The project's own agents (run by the maintainer through Cezar) act as the machine account `dtk7c2-2` (Write role); the maintainer `@dtk7c2` is the only code owner. External contributors' agents use their contributor's own account and fork instead. For the project's agents: before pushing, `gh auth status` must show `dtk7c2-2` as the active account – never push or open a PR as anyone else.
- Fine-grained personal access tokens do not work for outside collaborators: the machine account must be a member of the `trybun` organization.
- `gh auth login` on a shared OS user switches `gh` for every project of that user. Cezar forwards `HOME`, `GH_CONFIG_DIR` and `GH_TOKEN` to all agents, so the cockpit and every agent use the same identity.
- An SSH remote pushes as the owner of the SSH key, whatever `gh` says. Keep `origin` on https (`https://github.com/trybun/trybun.git`) and run `gh auth setup-git` so git uses the `gh` token.
- The squash commit takes the PR title: the PR title must be a valid Conventional Commit; its scope, if any, comes from the closed list ([§2.14](../../docs/spec/02-agent-rules.md)).
- Never approve a PR with the agent identity, and never merge one the maintainer has not approved, even when a skill offers it (`om-approve-merge-pr`, `om-auto-review-pr`). Approvals by the machine account do not count; for PRs the bot did not author (Dependabot, contributors) only Code Owners review stops them.
- Cezar's cockpit merge button runs as the machine account and works only when GitHub allows the merge; Cezar has no approve action. Its review gate, `gate.human` and QA labels are conveniences, not security boundaries.
- GitHub added `require_extra_approval_for_unattributed_changes: true` to the "Protect main" ruleset by default. It is undocumented – if a PR stays blocked after the maintainer's approval, check this option first and record the finding here.
- A Write account can push a branch whose workflow receives repository secrets, or push a tag that triggers a release. Release secrets belong in a GitHub Environment with required approval and `v*` tags in a tag ruleset (S0-11); never push `v*` tags.
