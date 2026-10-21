# 16 – Open source and project funding

The project is published as open source. This file defines the license, the rules for contributors and how voluntary financial support for the author is offered.

## 16.1 License

- The project is licensed under the **MIT License**.
- The repository root contains a `LICENSE` file with the **unmodified standard MIT text** and the line `Copyright (c) <year> <author>`. No additional conditions are ever added to the license text (it would no longer be MIT).
- Every package declares the license with its SPDX identifier (e.g. `"license": "MIT"` in `package.json`).
- The README ends with a short "License" section linking to `LICENSE`.
- Third-party dependencies must have licenses compatible with MIT distribution. The CI dependency audit ([§2.14](02-agent-rules.md)) includes a license check.

## 16.2 Community files

Following GitHub community standards, the repository contains:

| File | Content |
|---|---|
| `README.md` | Rule 5 ([§2.5](02-agent-rules.md)); links to the files below |
| `CONTRIBUTING.md` | How to set up the project, how to propose changes, commit and branch conventions, Definition of Done ([§2.13](02-agent-rules.md)), DCO sign-off, AI contribution policy ([§16.4](#164-ai-assisted-contributions)). Refers to `AGENTS.md` and `docs/spec/` instead of duplicating them |
| `CODE_OF_CONDUCT.md` | Contributor Covenant (current version, unmodified) with a contact address |
| `SECURITY.md` | How to report vulnerabilities **privately** (GitHub private vulnerability reporting), supported versions, expected response time. Vulnerabilities are never reported in public issues |
| `.github/ISSUE_TEMPLATE/` | Issue forms: bug report, feature request; a config pointing questions to GitHub Discussions and vulnerabilities to `SECURITY.md` |
| `.github/pull_request_template.md` | Checklist based on the Definition of Done, the linked specification sections and a "Specification changes" section listing changes marked for approval ([§2.8](02-agent-rules.md)) |
| `.github/CODEOWNERS` | Who reviews which parts of the repository; code owners are the humans whose approval is required ([§16.3](#163-contribution-rules)) |

Values that identify people – the copyright holder in `LICENSE`, the contact address in `CODE_OF_CONDUCT.md` and `SECURITY.md`, and the GitHub handles in `CODEOWNERS` – are supplied by the maintainer. Agents never invent them; until they are supplied, the files contain a clearly marked placeholder and the pull request lists them as open items.

Additionally:

- Labels `good first issue` and `help wanted` are used for tasks suitable for new contributors. Tasks from the implementation plan ([`docs/plan/`](../plan/implementation-plan.md)) can be published as GitHub issues.
- GitHub Discussions is enabled for questions and ideas.

## 16.3 Contribution rules

- Anyone can contribute through a fork and a pull request. Write access is granted only to trusted contributors after a history of good contributions (contributor → reviewer → maintainer).
- Larger contributions (new functionality, changes of behavior) start with a change specification in `.ai/specs/` proposed as a pull request, so the idea can be discussed before any code is written ([§2.8](02-agent-rules.md)).
- Every pull request must pass all CI quality gates and be approved by a maintainer ([§2.14](02-agent-rules.md)). An approval means an approval by a **code owner** (`.github/CODEOWNERS`, a human maintainer); approvals by the machine account ([§16.5](#165-repository-security)) never count.
- **Developer Certificate of Origin (DCO):** every commit contains a `Signed-off-by` line confirming that the author has the right to submit the code. CI checks it. No Contributor License Agreement (CLA) is required. The project's own agents ([§16.5](#165-repository-security)) commit with the maintainer's identity and add the maintainer's sign-off; the maintainer's approval of the pull request confirms it ([ADR 0001](../adr/0001-github-identity-of-ai-agents.md)).
- First responses to issues and pull requests should be fast and friendly; this is one of the strongest factors in whether contributors return.

## 16.4 AI-assisted contributions

The project itself is built with AI agents ([§1.2](01-overview.md)), and contributors may use them too. `CONTRIBUTING.md` states:

- The author of a pull request is responsible for every line of it and must understand it. The author may be the project's machine account ([§16.5](#165-repository-security)); then its human operator is responsible for the pull request.
- AI agents must follow `AGENTS.md`, the rules ([02-agent-rules.md](02-agent-rules.md)) and the Definition of Done, like any other contributor.
- Pull requests that ignore the specification or the Definition of Done are closed without detailed review.

## 16.5 Repository security

- Two-factor authentication is mandatory for all members of the GitHub organization.
- CI workflows triggered by pull requests from forks never have access to secrets.
- Dependabot alerts, security updates and version updates ([§2.10](02-agent-rules.md)) and GitHub private vulnerability reporting are enabled.
- The main branch is protected ([§2.14](02-agent-rules.md)).
- The project's AI agents act on GitHub as a **machine account** ([ADR 0001](../adr/0001-github-identity-of-ai-agents.md)): a member of the organization with 2FA and only the **Write** role on the repository. Its role is the limit of what agents can do: it never gets the Maintain or Admin role on any repository, so its token (the `gh` login of the machine) cannot change the protection of the main branch.
- Maintainer credentials are never stored on machines or OS users where agents run.

## 16.6 Voluntary financial support

Financial support is **voluntary and fully independent of the license**: it is never a condition for using, modifying or distributing the software. This is implemented in the **final stage** of the implementation plan.

### Channels

- **GitHub Sponsors** for the author's account (no fees for sponsorships from personal accounts).
- `.github/FUNDING.yml` declares the sponsorship destinations, which shows the "Sponsor" button on the repository page. Further platforms (e.g. Open Collective) can be added later in the same file.
- `package.json` files contain the `funding` field pointing to the same destination.

### Where support is mentioned

- **README**: a short "Support the project" section before "License" – two or three sentences: the project is free and will stay free; if it helps you, you can support its development; a link/badge. A sponsors list may follow.
- **Documentation**: a "Support the project" page.
- **Application**: a "Support the project" link on the "About" page of the Administrator panel, next to the installed version ([§15.4](15-deployment.md)).

### What is never done (Rule 2)

- No pop-ups, banners, console messages or reminders asking for support – in the application, the installer or the update scripts.
- No support messages to end users of the system; only the Administrator panel and the documentation mention support.
- No "sponsorware": features are never restricted to sponsors.
