# Project skills

Skills for recurring work in Trybun ([§2.14](../../docs/spec/02-agent-rules.md), [§18.9](../../docs/spec/18-code-patterns.md)). Each skill is a folder with a `SKILL.md` (front matter `name` and `description`, then the steps). A skill lists steps and links to the reference implementation instead of copying its code.

Claude Code finds them through the symbolic link `.claude/skills` → `.ai/skills`; other agents read this folder directly.

| Skill | Use when |
|---|---|
| [`verify-change`](verify-change/SKILL.md) | Before committing or opening a pull request: runs the checks CI runs |
