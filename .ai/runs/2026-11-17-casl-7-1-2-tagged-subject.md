# Execution plan — CASL 7.1.2: the built-in `TaggedSubject` instead of the custom subject resolver

**Upstream:** stalniy/casl#1359 (fixed in `@casl/ability` 7.1.2, published 2026-11-10T11:28Z; the maintainer recommends `TaggedSubject<BuiltinSubjectKey>`)
**Branch:** `fix/casl-7-1-2-tagged-subject` · **Base:** `main`

## 🎯 Goal

Replace the custom `AppSubjectResolver` of `ability-factory.ts` (#273, PR #277) with CASL's built-in `TaggedSubject<BuiltinSubjectKey>`, which since 7.1.2 resolves only the `__caslSubjectType__` tag without widening plain string subjects.

## Scope

- `apps/server/package.json`: `@casl/ability` `^7.1.1` → `^7.1.2`; `pnpm-lock.yaml` regenerated with `pnpm install` under the unchanged `minimumReleaseAge` (7.1.2 is past the 7-day cooldown on 2026-11-17; 7.1.3 is not and is not installed).
- `apps/server/src/platform/authorization/ability-factory.ts`: `export type AppSubjectResolver = TaggedSubject<BuiltinSubjectKey>;`, the doc comment on why only `__caslSubjectType__` is read kept, unused imports dropped.
- `.ai/memory/prisma.md`: the CASL subject-resolver note.

## Non-goals

- `@casl/prisma` stays `^2.2.0` (its peer range `@casl/ability ^7.0.0` accepts 7.1.2).
- No change of rules, abilities or `minimumReleaseAge`/`minimumReleaseAgeExclude`.
- `docs/spec/§18.3` does not describe the resolver – no change.

## Risks

- A type-only change; a regression would show as a type error in `accessibleBy(...).ofType()` or `ability.can()` – covered by `pnpm typecheck` and the abilities specs.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: CASL 7.1.2

- [ ] 1.1 Bump @casl/ability to ^7.1.2 and regenerate the lockfile
- [ ] 1.2 Replace AppSubjectResolver with TaggedSubject<BuiltinSubjectKey>
- [ ] 1.3 Update the project memory
