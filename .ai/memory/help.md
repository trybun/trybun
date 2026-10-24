# User documentation and the help viewer

Non-obvious behaviour found when the documentation infrastructure was built (S0-09, October 2026, `react-markdown` 10, `minisearch` 7.2, Node.js 24). Decisions: [§2.3](../../docs/spec/02-agent-rules.md), [§14.2](../../docs/spec/14-architecture.md); writer rules: [`docs/user/README.md`](../../docs/user/README.md).

## Generator

- `apps/web/scripts/generate-help-content.ts` is TypeScript run by Node's **type stripping** (`node scripts/….ts`, no build step), so it can import the shared modules of `src/features/help/` (`audiences.ts`, `search-options.ts`) and the MiniSearch options cannot drift. Node needs the real `.ts` extension in relative imports, hence `allowImportingTsExtensions` in `apps/web/tsconfig.json`. Modules it imports may only use erasable syntax (no `enum`, no parameter properties) and only `import type` from workspace packages – their `.js` specifiers do not resolve under Node.
- The output is committed (`apps/web/src/features/help/content/`), like the OpenAPI types: the Docker build context excludes `docs/`, so `next build` cannot read the pages. `pnpm lint` (`--check`) and a unit test fail when it is stale; `apps/web/turbo.json` lists `docs/user/**` as an input of `lint`.
- The content folder is in `.prettierignore` (one-line index JSON). Running `prettier --write <path>` from `apps/web` does **not** read the root `.prettierignore` and reformats it – regenerate afterwards or run Prettier from the root.
- `mdast-util-to-string` joins blocks without spaces (`Sign in.Next`); the generator walks the tree and joins with spaces instead.

## Search

- `minisearch` `processTerm` is used for indexing and searching; it lowercases and strips diacritics with NFD. **`ł` has no decomposition** and is replaced separately.
- `toJSON()` of an index is a plain object; the server passes it to the client component as a prop and `MiniSearch.loadJS()` restores it (no `JSON.parse` of a string). The React Compiler memoizes `loadJS` on the index prop, so switching the language loads the new index.
- `search()` results carry the stored fields as `any`; map them to typed values before rendering (lint `no-unsafe-*`).

## Markdown

- `react-markdown` passes the hast `node` to every custom component; destructuring it only to drop it fails `no-unused-vars`. `@trybun/ui`'s `Markdown` styles the elements with descendant variants (`[&_h2]:…`) instead of a `components` map.
- Without `rehype-raw`, raw HTML in the source is not rendered at all; `rehype-sanitize` still guards the generated HTML. `urlTransform` replaces the default protocol filter, so `Markdown` runs `defaultUrlTransform` first and the caller's transform after it.
