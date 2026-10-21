---
name: verify-change
description: Run the repository checks (format, lint, type check, unit and integration tests with coverage, specification references, build) before committing or opening a pull request in Trybun, and fix the causes of failures.
---

# Verify a change

Run from the repository root, in this order:

1. `pnpm install` – only if `package.json` files or `pnpm-lock.yaml` changed. A refused version means the 7-day cooldown (`.ai/memory/toolchain.md`).
2. `pnpm format` – then review the formatting changes with `git diff`.
3. `pnpm lint` – lint of every package and the Prettier check.
4. `pnpm lint:spec` – `§N.M` references of the specification, after a change of Markdown files or of section numbers.
5. `pnpm typecheck`
6. `pnpm test`
7. `pnpm test:coverage` – unit and integration tests with the coverage thresholds of CI; needs Docker. Without Docker, run `pnpm test` only and say so in the pull request.
8. `pnpm build`

CI runs the same checks plus the link check (lychee, `lychee.toml`), the vulnerability audit, the dependency review and CodeQL ([§2.14](../../../docs/spec/02-agent-rules.md)).

When a check fails, read the output and fix the cause. Never disable, skip or weaken a check or add a suppression (`@ts-ignore`, lint-disable or coverage-ignore comments, exclusions in the coverage configuration) – [§2.14](../../../docs/spec/02-agent-rules.md), "Fix the cause, never the gate". If a rule itself looks wrong, propose changing it in the pull request.

A change of the server entry points or `apps/server/rspack.config.js` is also checked by starting the build: `node apps/server/dist/main.js` must stop with a configuration error that names the missing variables, and start with the variables of `.env.example`.
