# Execution plan: content width of pages in the application shell

Source doc: .ai/specs/2026-11-02-content-width-rule.md
Issue: #179 · Spec PR: #193

## Goal

Pages in the application shell follow one width rule. Forms, settings and the detail of one record use `max-w-3xl`. Lists, tables and boards use the full width of the content area.

## Scope

- `docs/spec/02-agent-rules.md` §2.9 and `docs/spec/18-code-patterns.md` §18.2 and §18.5.
- The Projects page; the admin layout; the `GettingStartedChecklist`, `AboutDetails` and `OrganizationDetail` roots.
- Component tests and the E2E desktop width check.

## Non-goals

Pages outside the shell, Help, a new `@trybun/ui` layout component, the inner layout of the lists, and a cap for wide screens. All of these follow the spec.

## Implementation Plan

### Phase 1: Rule and application

1. Record the rule in §2.9, §18.2 and §18.5.
2. Projects page: full width, with a component test.
3. Administration: move `max-w-3xl` from the layout to the detail components, with component tests.
4. E2E: on desktop, assert that the Projects, Accounts and Organizations lists are wider than 768 px.
5. After the spec PR #193 merges, mark the spec `implemented` and move it to `implemented/`.

## Risks

- The spec file lands through #193. If #193 is not merged when this PR is ready, step 1.5 waits for it, and the PR body says so.

## Progress

PR: #194

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Rule and application

- [x] 1.1 Record the rule in the specification — d1f21c6
- [x] 1.2 Projects page full width — bfe43d3
- [x] 1.3 Administration widths per page — 303ed82
- [x] 1.4 E2E desktop width check — dfc0b0b
- [ ] 1.5 Mark the spec implemented
