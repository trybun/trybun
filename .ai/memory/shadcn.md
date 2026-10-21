# shadcn/ui – primitives, CLI and class merging

Non-obvious behaviour of shadcn/ui found when the primitives were chosen (October 2026). Decision: [§14.2](../../docs/spec/14-architecture.md), [§14.5](../../docs/spec/14-architecture.md); patterns: [§18.6](../../docs/spec/18-code-patterns.md).

- Since July 2026 `shadcn init` uses Base UI by default; `-b radix` selects Radix and `--base aria` React Aria. Registry items without a `registry:base` configuration initialize as Base UI. Documentation pages exist per base (`/docs/components/base/…`, `/docs/components/radix/…`) – use the `base` ones.
- The Radix flavour of `Drawer` is built on `vaul`, which is unmaintained; the Base UI flavour uses the Drawer of Base UI (`swipeDirection`). Vaul-only props such as `repositionInputs` have no one-to-one replacement.
- `Command` uses `cmdk` in every flavour. `Toast` (July 2026) exists only for Base UI.
- Radix → Base UI: `asChild` becomes `render`; examples and agents' habits from older shadcn/ui code use `asChild`.
- Since September 2026 `shadcn init` installs the `cn` package (shadcn-ui/cn, no dependencies) instead of `clsx` + `tailwind-merge`; `lib/utils.ts` only re-exports it, and registry components import `cn` directly. Custom class groups are configured with `cn/config` (`extend`, `override`, `prefix`, like `extendTailwindMerge`). `shadcn migrate cn` converts existing code.
- In a monorepo every workspace has its own `components.json`; `style`, `iconLibrary` and `baseColor` must match, and `tailwind.config` is `""` for Tailwind 4. The ui package exports `./globals.css`, `./components/*`, `./lib/*` and `./hooks/*`; components are flat in `src/components/` (no `ui/` subfolder).
