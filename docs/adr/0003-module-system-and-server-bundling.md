# 0003 – Module system and server bundling

- Status: proposed
- Date: 2026-10-21
- Deciders: the maintainer (`@dtk7c2`)
- Specification: [§14.6](../spec/14-architecture.md), [§15.4](../spec/15-deployment.md), [§15.12](../spec/15-deployment.md)

## Context and problem statement

The shared packages are **internal packages** consumed as TypeScript source, without a build step ([§14.6](../spec/14-architecture.md)). Next.js compiles them through `transpilePackages`, and Vitest compiles them on the fly. Node.js cannot run TypeScript from `node_modules`, so the built `apps/server` must contain the code of the packages it imports. The specification requires ES modules everywhere and a bundled server, and leaves the bundler to this ADR.

How are `apps/server` and the packages compiled, built and run, in production, in development and in tests?

## Decision drivers

- One module system for every application and package: ES modules with TypeScript `module` and `moduleResolution` set to `nodenext` ([§14.6](../spec/14-architecture.md)).
- The NestJS conventions: the NestJS CLI, its builders, decorator metadata for dependency injection.
- The built API and Worker start with `node` and import the internal packages ([§14.6](../spec/14-architecture.md)).
- One container image for the API and the Worker ([§15.4](../spec/15-deployment.md)).

## Decision outcome

**ES modules everywhere.** Every `package.json` has `"type": "module"`; `@trybun/tsconfig/base.json` sets `module` and `moduleResolution` to `nodenext` with `verbatimModuleSyntax`, so relative imports carry the `.js` extension. The web application uses the same setting; Next.js 16 (Turbopack) resolves `.js` imports of `.ts` files.

**The server is bundled with the rspack builder of the NestJS CLI** (`nest build`, `compilerOptions.builder` in `nest-cli.json`; webpack is deprecated in the NestJS 12 CLI). `apps/server/rspack.config.js` extends the CLI defaults:

- two entries, `src/main.ts` (API) and `src/worker.ts` (Worker), built into `dist/main.js` and `dist/worker.js` – one build, one image, two commands;
- npm dependencies stay **external** (`webpack-node-externals` with ES module imports), so the image needs the production `node_modules` of `apps/server`;
- the `@trybun/*` workspace packages are on the allowlist of the externals and **inlined from their TypeScript source**; the SWC loader of rspack compiles them with decorator metadata.

**Development.** `nest start --watch` rebuilds with the same configuration and restarts the API; the environment comes from the root `.env` (`node --env-file-if-exists`). The Worker gets its development command when it has work to do (task S0-04). The web application loads the root `.env` with `@next/env` in `next.config.ts`.

**Tests.** Vitest compiles with SWC (`unplugin-swc`), which emits the decorator metadata NestJS needs; esbuild, the default transformer of Vitest, does not.

### Consequences

- Good: no build step and no `dist` folders for the packages; a change in `@trybun/contracts` is picked up by the web application, the server bundle and the tests directly.
- Good: the API and the Worker share one build; `node dist/main.js` and `node dist/worker.js` run without a TypeScript loader.
- Bad: the server bundle depends on the CLI defaults of `@nestjs/cli`; `rspack.config.js` replaces only the entries, the output name and the externals, so an update of the CLI is checked by building and starting both processes.
- Bad: two watchers of the same build would race on `dist/`, so the Worker cannot simply get a second `nest start --watch`; S0-04 decides its development command.

## Considered options

1. **rspack builder of the NestJS CLI with a custom configuration** (chosen) – the successor of the deprecated webpack builder in the NestJS 12 CLI.
2. **`tsc` builder with compiled packages** – every package would need its own build and `dist`, contradicting the internal packages of [§14.6](../spec/14-architecture.md).
3. **A standalone bundler (tsup, esbuild)** – esbuild does not emit decorator metadata; a second build tool next to the NestJS CLI.
4. **Running TypeScript directly (Node.js type stripping, `tsx`)** – type stripping does not support decorators, and `tsx` uses esbuild without decorator metadata.
