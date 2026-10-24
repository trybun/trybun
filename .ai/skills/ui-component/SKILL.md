---
name: ui-component
description: Add a UI component to @trybun/ui in Trybun – from shadcn/ui on Base UI, adapted to the design tokens, 44 px touch targets, translations and accessibility, with stories for all states and the phone, tablet and desktop viewports.
---

# Add a UI component

Rules: [§2.6](../../../docs/spec/02-agent-rules.md) (Rule 6), [§2.9](../../../docs/spec/02-agent-rules.md) (Rule 9), [§13.4](../../../docs/spec/13-non-functional.md), [§18.6](../../../docs/spec/18-code-patterns.md). Reference implementation: [`button.tsx`](../../../packages/ui/src/components/button.tsx) and [`button.stories.tsx`](../../../packages/ui/src/components/button.stories.tsx). Pitfalls: `.ai/memory/shadcn.md`.

1. **Check what exists** in `packages/ui/src/components/`; extend or compose an existing component instead of adding a similar one.
2. **Add it from shadcn/ui** (Base UI flavour, never `-b radix`): `pnpm --filter @trybun/ui exec shadcn add <component>`. Use the documentation pages under `/docs/components/base/`. Add the dependencies the CLI did not install (it may skip `class-variance-authority`, `lucide-react`) with `pnpm --filter @trybun/ui add`.
3. **Adapt before first use**:
   - Tokens only: replace arbitrary values (`text-[0.8rem]`, `min-w-[96px]`, `rounded-[min(…)]`) and Tailwind palette colours (`bg-black/10`) with theme tokens (`globals.css`). Focus rings are `ring-ring` at full opacity. A new token is a change of `docs/brand/README.md` for human approval.
   - Touch targets: interactive elements 44 px (`h-11`, `size-11`, `min-h-11`), compact only with `xl:pointer-fine:`; form fields 16 px text below that.
   - Texts owned by the component (screen-reader labels, close buttons) come from the `ui` namespace of `packages/i18n/messages/*.json` through `useTranslations('ui')`; content comes through props and children.
   - Phones: overlays are bottom sheets; elements at the bottom edge use `pb-safe-offset-*`.
   - Patterns of [§18.5](../../../docs/spec/18-code-patterns.md): no `useMemo`, `useCallback`, `memo` or `forwardRef`; `render` instead of `asChild`; colour never the only cue of a state.
4. **Stories** `<component>.stories.tsx` next to it, following `button.stories.tsx`: one story per state (default, variants, disabled, invalid, open, loading, empty, error – whichever apply), a `play` function for the main interaction, and `Phone`, `Tablet` and `Desktop` stories with `globals: viewport(…)` that check the Rule 9 behaviour (target sizes, bottom sheet). Query by role or label, never by class.
5. **Run** `pnpm --filter @trybun/ui test` (every story in light and dark with axe; Chromium installed once with `pnpm --filter @trybun/ui exec playwright install chromium`) and `pnpm --filter @trybun/ui lint`, look at the component in `pnpm storybook` in both themes and languages, then the [`verify-change`](../verify-change/SKILL.md) skill.
