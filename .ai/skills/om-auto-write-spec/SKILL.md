---
name: om-auto-write-spec
description: Autonomously turn a brief or FR issue into a spec landed on a ready PR — runs om-spec-writing --autonomous (defaults posted for override), attaches UI mockups and current-app screenshots as PR evidence when a browser provider exists, applies full SDLC labels, and emits PR/spec markers for chaining into om-auto-implement-spec. Use for "write a spec for X and open a PR", "spec this issue". With the rules of Trybun.
---

Read and follow the installed skill: `.agents/skills/om-auto-write-spec/SKILL.md` in the main
checkout (in a Cezar task worktree its root is the parent of `git rev-parse --path-format=absolute --git-common-dir`).

Rules of this repository, on top of it:

- **Commit scope `spec`, never `specs`.** The closed scope list of [§2.14](../../../docs/spec/02-agent-rules.md#214-agent-workflow), enforced by commitlint on the PR title and on every commit, has `spec` and no `specs`. Wherever the installed skill writes `docs(specs): …`, write `docs(spec): …` instead:
  - the commit of the specification (step 4): `docs(spec): add spec for ${SLUG}${issueId:+ (FR #${issueId})}`;
  - the commit of the UI mockups (step 5): `docs(spec): add UI mockups for ${SLUG}`;
  - the PR title (step 6 and `references/pr-finalize.md`, through `om-open-pr --title` and the inline create-pr fallback alike): `docs(spec): ${TITLE}`.
- Before pushing, check every commit of the branch: `npx commitlint --from origin/main --to HEAD`.

Remove this extension once the installed skill writes `docs(spec)` itself ([open-mercato/skills#203](https://github.com/open-mercato/skills/issues/203)).
