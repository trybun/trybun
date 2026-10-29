# Project skills

Skills for recurring work in Trybun ([§2.14](../../docs/spec/02-agent-rules.md), [§18.9](../../docs/spec/18-code-patterns.md)). Each skill is a folder with a `SKILL.md` (front matter `name` and `description`, then the steps). A skill lists steps and links to the reference implementation instead of copying its code.

| Skill | Use when |
|---|---|
| [`ui-component`](ui-component/SKILL.md) | Adding or adapting a component of `@trybun/ui` |
| [`verify-change`](verify-change/SKILL.md) | Before committing or opening a pull request: runs the checks CI runs |

## Where skills live

| Folder | Content | In git |
|---|---|---|
| `.ai/skills/` | The project skills above and repository extensions of `om-*` skills | yes |
| `.agents/skills/` | The `om-*` skills of `open-mercato/skills`, installed by `npx skills` from [`skills-lock.json`](../../skills-lock.json) | no |
| `.claude/skills/` | What Claude Code reads: one link per project skill to `.ai/skills/<name>` (committed) and the links of `npx skills` to `.agents/skills/om-*` (ignored) | the project links only |

A new project skill gets its folder here and one link: `ln -s ../../.ai/skills/<name> .claude/skills/<name>`. Other agents (Codex, Cursor) read `.agents/skills/`, and Cezar reads `.ai/skills/` itself.

## Agent pipeline skills

The `om-*` skills of the agent pipeline ([`SDLC.md`](../../SDLC.md), configuration in [`.ai/agentic.config.json`](../agentic.config.json)) come from `open-mercato/skills` and are pinned in `skills-lock.json`. Restore them with `npx skills experimental_install` and update them with `npx skills update`, which also updates the lock file. Cezar provisions them into every task.

## Extending an `om-*` skill

A repository extension of an `om-*` skill is `.ai/skills/<skill-name>/SKILL.md`, committed. It replaces the installed skill under the same name – Cezar prefers `.ai/skills/` – so it first loads the installed skill and then adds the rules of this repository, which win where both speak about the same thing. It can never relax the installed skill's safety rules.

```markdown
---
name: om-approve-merge-pr
description: <the description of the installed skill>, with the rules of Trybun.
---

Read and follow the installed skill: `.agents/skills/om-approve-merge-pr/SKILL.md` in the main
checkout (in a Cezar task worktree its root is the parent of `git rev-parse --path-format=absolute --git-common-dir`).

Rules of this repository, on top of it:

- …
```

## Migrating an existing checkout

Until 2026-10-29 `.claude/skills` was a link to `.ai/skills`, so `npx skills` put its `om-*` links into `.ai/skills/`. After pulling this layout, remove those links once and install again:

```bash
find .ai/skills -maxdepth 1 -type l -name 'om-*' -delete
npx skills experimental_install
```
