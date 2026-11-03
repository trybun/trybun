# Interactive brand colour and a lighter focus ring

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-11-01 |
| Plan task | – |
| System specification sections | §2.6, §13.4; [`docs/brand/README.md`](../../../docs/brand/README.md) (UI design tokens) |
| Related issues / PRs | #177, #183 (specification), #182 (implementation) |

## Context

The focus ring (`--ring`) is vermilion, almost the red of the error state (`--destructive`), so a focused valid field looks invalid (#177). The first fix (#182) switched the ring to Ink. In manual QA the maintainer rejected it on 2026-11-01:

- the Ink ring reads as **black**;
- the indicator is **too heavy**: on focus the 1 px field border takes the ring colour **and** a 3 px ring is added, about 4 px of near-black;
- **Ink, Vermilion and White are too few brand colours** for a UI. The only candidates for focus, links and selection are black and red, and both are wrong.

## Goals

- A third brand colour for **interactive states** (focus first), clearly distinct from the danger red and from the neutral Ink, in both themes.
- A focus indicator that is visible but light. It must keep WCAG 1.4.11: at least 3:1 against the adjacent colours. It must also keep WCAG 2.4.13: an area at least as large as a 2 px perimeter, with a 3:1 change of contrast.
- A field that is both focused and invalid is still recognisable as invalid (unchanged from #177).

## Non-goals

- Changing the logo, the wordmark, Ink or Vermilion and their uses outside the UI tokens.
- Redesigning the semantic colours (success, warning, danger, info) beyond what the chosen variant requires (see open question 3).
- A dark-theme switch in the web application.

## Proposed change

### 1. A new brand colour for interactive states

A brand colour added to [`docs/brand/README.md`](../../../docs/brand/README.md) ("Colours"), with a light and a dark shade like the other UI tokens. `--ring` uses it. The maintainer chooses one variant.

| Variant | Light theme (on White) | Dark theme (on Ink `#141A2E`) | Character | Risk |
|---|---|---|---|---|
| **A – Blue** | `#2563EB` – 5.2:1 | `#60A5FA` – 6.8:1 | the platform and browser convention for focus and links, instantly read as "interactive" | close to `--info` (`#1447E6` / `#51A2FF`): info would reuse it or be dropped as a separate hue (question 3) |
| **B – Sea (teal)** | `#0F766E` – 5.5:1 | `#2DD4BF` – 9.3:1 | the complement of Vermilion on the colour wheel, so the brand pair becomes "warm customer side – cool team side"; distinctive | close to `--success` green (`#008236` / `#05DF72`) for some colour-vision deficiencies; success always has an icon and text (§13.4) |
| **C – Indigo** | `#4F46E5` – 6.3:1 | `#A5B4FC` – 8.7:1 | close to Ink's navy, so it reads as "the brand, but active"; no semantic colour uses violet | further from the convention than A; on Ink-filled controls it needs the offset (item 2) |

All variants keep at least 4.5:1 for text on `--background` in both themes. They can therefore also colour links (question 2), and they stay clearly apart from the danger red in hue.

### 2. A lighter focus indicator

| Option | Field (Input, Select, Combobox) | Filled control (primary Button, Switch, checked Radio, avatar) | Total thickness |
|---|---|---|---|
| **3 px (today)** | border takes the colour + 3 px ring | 2 px gap + 3 px ring | ~4 px |
| **2 px – border + 1 px ring** (recommended) | border takes the colour + 1 px ring | 2 px gap + 2 px ring | 2 px |
| **2 px with a gap** | border unchanged, 2 px gap + 2 px ring | 2 px gap + 2 px ring | 2 px + 2 px gap |

The recommended option is the lightest one that still meets WCAG 2.4.13. Material and Primer use a similar thin outline.

### 3. Live preview

[`research/2026-11-01-focus-colour-preview.md`](../research/2026-11-01-focus-colour-preview.md) contains a snippet for the DevTools console of the local environment (`sh .ai/scripts/test-env-up.sh` or `pnpm dev`). It adds a panel in which the variants (plus today's Ink and the old Vermilion), the three thicknesses and the dark theme can be switched on any page. The snippet only overrides CSS in the browser and changes no code.

## Changes to the system specification

| Section | Change |
|---|---|
| [`docs/brand/README.md`](../../../docs/brand/README.md) – Colours | new brand colour of the chosen variant (name, hex, use: "interactive states – focus, …") |
| [`docs/brand/README.md`](../../../docs/brand/README.md) – UI design tokens | `--ring` row; the bullets on Vermilion and the new colour; `--info` per question 3 |
| §13.4 | the focus indicator: colour token and thickness (2 px, WCAG 2.4.13) |

New or changed glossary terms: none.

## Open questions

Implementation (#182) must not start until every question has an answer.

1. Which variant – **A Blue**, **B Sea** or **C Indigo** (or other values)? And which thickness – **2 px (border + 1 px ring)**, **2 px with a gap**, or **3 px**? — **Answer:** **A – Blue** (`#2563EB` / `#60A5FA`) with **2 px – border + 1 px ring** (maintainer, 2026-11-01, after the live preview).
2. Should the new colour also be used for **links** in running text (help, Markdown), which today use `--primary` (Ink) with an underline? — **Answer:** **Yes** – links in running text use the blue (`--link`), still underlined.
3. With variant A, should `--info` **reuse** the new blue, or **keep** its own shade? (B and C: `--info` stays.) — **Answer:** **`--info` reuses the blue** – one blue in the UI.
4. Should **selected states** (checked Switch and Radio, the active tab underline) also use the new colour instead of Ink? This affects more than focus and changes the look of every form. — **Answer:** **No** – selected states stay Ink; the blue marks focus, links and information.

## Acceptance criteria

- [ ] `--ring` is the chosen colour in both themes. The ring has at least 3:1 contrast on `--background`, `--card` and `--popover`, and at least 3:1 against the danger colour's hue (story test).
- [ ] The chosen thickness applies to every component of `@trybun/ui` and to the focus rings of `apps/web`. Filled controls keep a gap in the background colour.
- [ ] A focused invalid field keeps its danger border and is not shown with the interactive colour (story test `Input/FocusedInvalid`).
- [ ] [`docs/brand/README.md`](../../../docs/brand/README.md) and §13.4 updated; the change is noted in the user documentation only if the user-visible behaviour is described there.
- [ ] Works on phone, tablet and desktop (Rule 9); keyboard and touch focus checked in manual QA.

## Changelog

- 2026-11-01 – Created after the maintainer's manual QA of #182.
- 2026-11-01 – Open questions answered by the maintainer: A – Blue, 2 px, blue links, `--info` reuses the blue, selections stay Ink. Implemented in #182.
- 2026-11-01 – Approved by the maintainer (merged in #183) and implemented in #182: `--blue`, `--ring`, `--link` and `--info`, the 2 px focus indicator, blue links; `docs/brand/README.md` and §13.4 updated.
