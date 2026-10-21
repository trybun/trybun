# Security policy

## Reporting a vulnerability

**Do not report vulnerabilities in public issues, discussions or pull requests.**

Use GitHub's private vulnerability reporting instead: open the [Security tab](https://github.com/trybun/trybun/security) of the repository and choose **Report a vulnerability**. If that is not possible, write to **dtk7c2@gmail.com**.

Please include the affected version, a description of the problem, steps to reproduce it and, if you can, its impact. Do not include real personal data or other people's tickets.

## What to expect

| Step | Target |
|---|---|
| Acknowledgement of your report | 1 day |
| Assessment and severity | 1 day |
| Fix released | By severity, as in [§2.10](docs/spec/02-agent-rules.md): critical 7 days, high 14 days, medium 30 days, low in the next planned update |

We credit reporters in the advisory unless they prefer to stay anonymous.

## Supported versions

Trybun has no stable release yet. Until the first release, only the `main` branch is supported. After `1.0.0`, the latest minor release receives security fixes; urgent fixes may also be released from a maintenance branch `release/X.Y.x` ([§2.11](docs/spec/02-agent-rules.md)). This table is updated with each release.

| Version | Supported |
|---|---|
| `main` (pre-release) | Yes |
