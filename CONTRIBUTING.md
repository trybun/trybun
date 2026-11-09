# Contributing to Trybun

Thank you for helping. This file is a short guide; the rules themselves live in [`AGENTS.md`](AGENTS.md) and the [specification](docs/spec/README.md), and are not repeated here. By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately, as described in [`SECURITY.md`](SECURITY.md) – never in a public issue.

## Questions and ideas

Ask questions and share ideas in [GitHub Discussions](https://github.com/trybun/trybun/discussions). Open an issue (bug report or feature request form) for something concrete. Issues labelled `good first issue` and `help wanted` are suited for new contributors; tasks of the [implementation plan](docs/plan/implementation-plan.md) may be published as issues.

## Setting up

Prerequisites, the one-command start (`pnpm install`, `pnpm dev`) and the other commands (`pnpm test`, `pnpm lint`, `pnpm typecheck` …) are described in [§15.12](docs/spec/15-deployment.md) and in the commands table of [`AGENTS.md`](AGENTS.md). Every pull request runs the CI quality gates listed in the [README](README.md#continuous-integration).

## Proposing changes

1. Fork the repository and create a branch from `main`: `<type>/<short-description>` (e.g. `fix/issue-123-short-description`, `feat/short-description`), `S0-01-short-description` for plan tasks.
2. **Larger contributions** (new functionality, changes of behaviour or requirements) start with a **change specification** in `.ai/specs/`, proposed as its own pull request so the idea can be discussed before any code is written ([§2.8](docs/spec/02-agent-rules.md), [§16.3](docs/spec/16-open-source.md)). Bug fixes, dependency updates and documentation-only changes do not need one.
3. Keep one pull request to one focused task, update the specification, documentation and README in the same pull request, and rebase on `main` before opening it.
4. A gap or contradiction in the specification is not decided in code: propose the change in the pull request and list it under "Specification changes" of the template.
5. Every pull request must pass all CI quality gates. It is reviewed by a **code owner** ([`.github/CODEOWNERS`](.github/CODEOWNERS)) and merged with a squash by a maintainer or collaborator; contributors do not merge their own pull requests.

## Commits and branches

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/); the scope comes from the closed list in [§2.14](docs/spec/02-agent-rules.md). The pull request title must be a valid Conventional Commit as well – it becomes the squash commit.
- Breaking changes are marked as described in Rule 11 ([§2.11](docs/spec/02-agent-rules.md)). Never edit versions or `CHANGELOG.md` by hand; release-please does it.
- Branches, trunk-based flow and merging: [§2.14](docs/spec/02-agent-rules.md).

## Definition of Done

A pull request is done when it meets the [Definition of Done](docs/spec/02-agent-rules.md) (§2.13); the pull request template contains the checklist. Pull requests that ignore the specification or the Definition of Done are closed without detailed review.

## Developer Certificate of Origin (DCO)

Every commit needs a `Signed-off-by` line confirming that you have the right to submit the code under the project's licence ([Developer Certificate of Origin 1.1](https://developercertificate.org/)). Add it with `git commit -s`:

```
Signed-off-by: Your Name <your.email@example.com>
```

- **Contributors** sign off with their own identity. CI checks every commit of the pull request (job `DCO sign-off`); the sign-off must match the commit's author name and e-mail address. To add a missing sign-off, run `git rebase --signoff origin/main` and push with `--force-with-lease`. No Contributor License Agreement is required.
- **The project's own agents** (run by the maintainer through Cezar) act with the maintainer's account: they commit with the maintainer's identity and add the maintainer's sign-off, and the maintainer is responsible for them ([ADR 0011](docs/adr/0011-maintainer-account-and-workflow-approval.md), [§16.3](docs/spec/16-open-source.md)). Agents of external contributors act from the contributor's own account and fork and sign off with the contributor's identity.

## AI-assisted contributions

You may use AI agents ([§16.4](docs/spec/16-open-source.md)). The project is built that way itself.

- The author of a pull request is responsible for every line of it and must understand it. Pull requests of the project's own agents are the maintainer's responsibility.
- AI agents must follow [`AGENTS.md`](AGENTS.md), the [rules](docs/spec/02-agent-rules.md) and the Definition of Done, like any other contributor.
- Pull requests that ignore the specification or the Definition of Done are closed without detailed review.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
