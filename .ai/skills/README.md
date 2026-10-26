# Project skills

Skills for recurring work in Trybun ([§2.14](../../docs/spec/02-agent-rules.md), [§18.9](../../docs/spec/18-code-patterns.md)). Each skill is a folder with a `SKILL.md` (front matter `name` and `description`, then the steps). A skill lists steps and links to the reference implementation instead of copying its code.

Claude Code finds them through the symbolic link `.claude/skills` → `.ai/skills`; other agents read this folder directly.

| Skill | Use when |
|---|---|
| [`ui-component`](ui-component/SKILL.md) | Adding or adapting a component of `@trybun/ui` |
| [`verify-change`](verify-change/SKILL.md) | Before committing or opening a pull request: runs the checks CI runs |

## Agent pipeline skills

The `om-*` skills of the agent pipeline ([`SDLC.md`](../../SDLC.md), configuration in [`.ai/agentic.config.json`](../agentic.config.json)) come from `open-mercato/skills` and are pinned in [`skills-lock.json`](../../skills-lock.json). They are not committed: restore them with `npx skills experimental_install` and update them with `npx skills update`, which also updates the lock file. Cezar installs them for every task.

A repository-specific extension of one of them lives in `.ai/skills/<skill-name>/SKILL.md`, a path `.gitignore` excludes for `om-*` – add a `!/.ai/skills/<skill-name>/` exception to `.gitignore` when one is committed.

