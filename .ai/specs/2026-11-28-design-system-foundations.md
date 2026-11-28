# Design-system foundations in the Plane direction

| | |
|---|---|
| Status | `approved` |
| Created | 2026-11-28 |
| Plan task | – |
| System specification sections | §2.6, §2.9, §13.4, §18.6; [`docs/brand/README.md`](../../docs/brand/README.md) (UI design tokens) |
| Related issues / PRs | #581, #580 (research), [`2026-11-27-brand-teal-palette.md`](implemented/2026-11-27-brand-teal-palette.md) (its non-goal), #530, #531, #532, #533 |

## Context

On 2026-11-27 the maintainer chose Plane as the direction of Trybun's UI: clear, intuitive and full of conventions users know from other tools. The teal palette ([`2026-11-27-brand-teal-palette.md`](implemented/2026-11-27-brand-teal-palette.md)) changed the brand and action colours. Its non-goals left "neutrals and surface layers, type, radii, density, motion and statuses" to this specification.

The research note [`research/2026-11-28-design-system-foundations.md`](research/2026-11-28-design-system-foundations.md) compares Plane's code with ten other design systems and with the accessibility evidence, and takes stock of `@trybun/ui` at `da23a6bb`. What it found in Trybun today:

- **No neutral scale.** Nine single values, each an sRGB mix of Ink `#141A2E` and White. Ink has chroma 0.040 at hue 270. That is 3–10 times the darkest neutrals of the other systems, and about 80° from Teal's hue 191.
- **No surface layers.** In light, `--background`, `--card` and `--popover` are the same white, and `--secondary`, `--muted` and `--accent` the same grey. Header, side navigation and page sit on one background, and there is no sidebar token.
- **No named text styles.** The page heading is copied 23 times and h3 has five styles (#533). Ticket identifiers use the system monospace stack, whose wide letter spacing showed as "CP - 3" on phones in the stage 1 screenshots of 2026-11-27 (not kept in the repository). Numbers are not tabular.
- **One radius for everything.** Controls and cards share 10 px, so a container and the controls inside it look the same.
- **Tailwind defaults** for shadows (black), the type scale, motion and spacing. There are 47 `/NN` opacity mixes and 22 `dark:` classes that the token tests do not see.

Two open decisions bear on this specification:

- **#531.** The maintainer decided on 2026-11-26 to remove the dark theme, which the application never shows. On 2026-11-28 they reversed it: a dark theme is a convention of the category (Plane, Linear, GitHub, Jira offer one) and stays, as an option beside the default light theme (question 15). #531 is closed. This specification defines the dark values; showing the theme in the application (the system setting and a choice in the account settings) gets its own specification.
- **#532.** It plans to write in `docs/brand/` that the default radius, type scale, shadows and spacing are kept on purpose. That plan predates the Plane direction of 2026-11-27. If the answers replace those defaults (questions 4, 7, 13), #532 drops that paragraph and keeps only its `SDLC.md` part.

Plane's design system (`@makeplane/propel`) is AGPL-3.0-only and Trybun is MIT. The values here are derived for Trybun; none is copied from Propel.

## Goals

- **One neutral scale** whose steps follow the 12-step roles of Radix. Every text role meets 4.5:1 and every identifying border 3:1 on every surface where it is used (WCAG 1.4.3, 1.4.11).
- **Surface layers** that separate the side navigation, the page, raised items and overlays, as in Plane and Atlassian.
- **Named text styles** for every role, used through `Heading` and `Text` components in Trybun's own code.
- **Radius, border, shadow, size and motion tokens by role**, so that equal things look equal everywhere (Rule 2, Rule 6).
- **Tokens only.** Every value lives in [`globals.css`](../../packages/ui/src/styles/globals.css), and the lint and the story tests guard it.

## Non-goals

- **Layout and UX patterns:** app shell, view header, list, board, detail view, command palette, empty states, and the shared components of section 11 of the research note (including one status badge for the team and the portal). They get their own specification after this one.
- **Showing the dark theme in the application:** following the system setting, a System / Light / Dark choice in the account settings, `theme-color` and the mark in the header. It gets its own specification after this one; until then the dark theme is visible in Storybook only.
- **A user setting for density, and high-contrast themes.** Nothing needs them yet; they can come when a user group asks.
- **Keycloak sign-in theming.** It needs its own research and specification.
- **The brand colours and the mark** ([`2026-11-27-brand-teal-palette.md`](implemented/2026-11-27-brand-teal-palette.md)).
- **What stops moving under reduced motion.** That is #530. This specification moves durations and easings into tokens; whether their values change is question 13.

## Proposed change

The values below follow the maintainer's answers to the open questions.

### Neutral scale

Twelve steps in OKLCH at Trybun's own hue 196, between Teal (191) and Deep Teal (199), with chroma rising from 0.002 at step 1 to 0.016 at step 12. Tailwind's `mist` (hue 197–229) is the closest published grey; Radix pairs teal with `sage` (hue 165–175). The values are Trybun's own. Hex values are rounded from OKLCH.

| Step | Role (Radix convention) | Light | Dark | Semantic token (light / dark) |
|---|---|---|---|---|
| 1 | app background, subtle | `#FBFDFD` | `#0D1010` | – (the page is White) / `--sidebar`, `--sunken` |
| 2 | subtle background | `#F7FAFA` | `#131616` | `--sidebar`, `--sunken` / `--background` |
| 3 | UI element background | `#EFF3F3` | `#1B1F1F` | `--muted`, `--secondary` / `--card`, `--popover` |
| 4 | hovered element | `#E7ECEC` | `#212626` | `--accent` / `--muted`, `--secondary` |
| 5 | active or selected element | `#E0E6E6` | `#262C2C` | `--accent-active` (new) / `--accent` |
| 6 | subtle border | `#D8DFDF` | `#2D3434` | `--border` / `--accent-active` |
| 7 | border of interactive elements | `#CDD5D4` | `#383F3F` | – / `--border` |
| 8 | stronger border, hovered border | `#BBC4C3` | `#495252` | `--border-hover` (new) |
| 9 | identifying border | `#778181` | `#788382` | `--input` |
| 10 | hovered identifying border | `#717B7B` | `#848F8E` | `--input-hover` (new) |
| 11 | secondary text, icons, placeholder | `#566060` | `#AFB8B8` | `--muted-foreground` |
| 12 | primary text | `#152120` | `#E8EEEE` | `--foreground` |

The OKLCH values are L 0.993, 0.982, 0.960, 0.940, 0.920, 0.898, 0.866, 0.812, 0.595, 0.575, 0.480, 0.235 with C 0.002, 0.003, 0.004, 0.005, 0.006, 0.007, 0.008, 0.010, 0.012, 0.012, 0.013, 0.016. Dark: L 0.170, 0.198, 0.236, 0.262, 0.288, 0.318, 0.362, 0.432, 0.600, 0.640, 0.775, 0.945 with C 0.004, 0.005, 0.006, 0.007, 0.008, 0.009, 0.010, 0.012, 0.012, 0.012, 0.010, 0.006. Steps without a token stay primitives for components that need them. In dark, every surface is one step lighter than the one below it, and hover and pressed are one and two steps above the control background, so no state shares the step of the surface it sits on.

Contrast (WCAG 2):

| Pair | On White (page, card) | On step 2 (sidebar) | On step 3 (control) | On step 4 (hover) | On step 5 (pressed) |
|---|---|---|---|---|---|
| Step 12 text | 16.53 | 15.75 | 14.79 | 13.86 | – |
| Step 11 text | 6.49 | 6.18 | 5.80 | 5.44 | 5.14 |
| Step 9 border | 4.01 | 3.82 | 3.58 | 3.36 | 3.17 |
| Teal `#035F5C` (action, links) | 7.51 | 7.16 | 6.72 | – | – |

Dark:

| Pair | On step 1 (sidebar) | On step 2 (page) | On step 3 (card, popover) | On step 4 (control) | On step 5 (hover) | On step 6 (pressed) |
|---|---|---|---|---|---|---|
| Step 12 text | 16.29 | 15.51 | 14.18 | 13.06 | 12.10 | 10.83 |
| Step 11 text | 9.44 | 8.99 | 8.22 | 7.57 | 7.01 | 6.28 |
| Step 9 border | 4.89 | 4.65 | 4.25 | 3.92 | 3.63 | 3.25 |
| Teal `#6EBFB9` (ring) / `#8CD4CE` (links) | 8.93 / 11.31 | 8.51 / 10.77 | 7.78 / 9.84 | 7.17 / 9.07 | 6.64 / 8.40 | 5.94 / 7.52 |

**Ink leaves the UI tokens.** Text becomes step 12. The backdrop of dialogs, `--overlay`, becomes step 12 at 40 % in light instead of Ink at 40 %, and stays black at 60 % in dark. In dark, the label on the light Teal button (`--primary-foreground`) and on the four status fills becomes dark step 1 `#0D1010` instead of Ink: 8.93:1 on `#6EBFB9`, 10.57:1 on the hover `#82CEC8`. Ink stays in the brand README only as history of the earlier palette.

### Surfaces

| Token | Light | Dark | Used by |
|---|---|---|---|
| `--background` | White | step 2 | the page |
| `--sidebar` (new) | step 2 | step 1 | the side navigation; one step away from the page, never brand-coloured |
| `--sunken` (new) | step 2 | step 1 | Kanban columns, table header, code blocks |
| `--card` | White + `--border` | step 3 + `--border` | cards and panels |
| `--popover` | White + `--border` + `--shadow-overlay` | step 3 + `--border` + `--shadow-overlay` | menus, popovers, selects, dialogs |
| `--muted`, `--secondary` | step 3 | step 4 | control backgrounds, neutral badges |
| `--accent` / `--accent-active` | step 4 / step 5 | step 5 / step 6 | hovered / pressed rows and menu items |

### Borders and shadows

- **Borders are 1 px.** There are no 0.5 px hairlines; anti-aliasing makes them fainter than their colour (WCAG 1.4.11).
- **Two kinds of border:**
  - an identifying border (fields, unchecked controls) uses `--input` and meets 3:1;
  - a decorative border (dividers, card and popover edges, badge edges) uses `--border` and is never the only cue (question 9).
- **Shadows are only for things that float or move:** popovers, menus, dialogs, toasts and a dragged Kanban card. Cards on the page get a border, not a shadow (NN/g, Atlassian).
- **Three shadow tokens** in place of Tailwind's black shadows: in light in the colour of step 12; in dark black at higher alpha, where depth comes mostly from the surface steps and the border:

| Token | Light | Dark |
|---|---|---|
| `--shadow-raised` | `0 1px 2px rgb(21 33 32 / 0.08), 0 4px 12px -2px rgb(21 33 32 / 0.12)` | `0 1px 2px rgb(0 0 0 / 0.3), 0 4px 12px -2px rgb(0 0 0 / 0.4)` |
| `--shadow-overlay` | `0 1px 2px rgb(21 33 32 / 0.06), 0 8px 24px -4px rgb(21 33 32 / 0.14)` | `0 1px 2px rgb(0 0 0 / 0.3), 0 8px 24px -4px rgb(0 0 0 / 0.5)` |
| `--shadow-modal` | `0 2px 4px rgb(21 33 32 / 0.06), 0 16px 40px -8px rgb(21 33 32 / 0.20)` | `0 2px 4px rgb(0 0 0 / 0.3), 0 16px 40px -8px rgb(0 0 0 / 0.6)` |

### Typography

- **Typeface:** Manrope stays for the UI (question 2).
  - Ticket identifiers and project keys use the UI font with tabular figures.
  - Monospace is kept for code. It uses the stack `ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`, as the e-mails do today.
- **Sizes:**
  - 14 px for UI text in the team view;
  - 16 px for reading text: ticket descriptions, comments, help pages and the content of the customer portal;
  - 12 px as the floor, for short metadata only.
- **Form fields stay outside the named styles.** They keep the rule of §2.9 and §18.6: 16 px on touch, 14 px when compact.
- **Named styles**, as `type-*` utilities in `globals.css` (question 8 explains the prefix):

| Utility | Size / line height | Weight | Use |
|---|---|---|---|
| `type-title-page` | 24 / 32 | 700, letter spacing −0.01em | the page heading (h1) |
| `type-title-section` | 18 / 28 | 600 | section headings (h2) |
| `type-title-group` | 16 / 24 | 600 | sub-sections and dialog titles (h3) |
| `type-body-reading` | 16 / 24 | 400 | descriptions, comments, help, portal content |
| `type-body` | 14 / 20 | 400 | UI text |
| `type-body-strong` | 14 / 20 | 500 | labels, emphasised UI text |
| `type-caption` | 12 / 16 | 500 | metadata, table headers |

- **`Heading` and `Text`** in `@trybun/ui` apply these utilities (`Heading` takes the level and the style separately).
  - Every heading and text element in `apps/web` and in Trybun's own components uses them.
  - The registry components of shadcn keep their Tailwind sizes; `text-sm` and `text-xs` already equal `type-body` and the size of `type-caption`.
  - This takes over the scope of #533, whose heading styles become `type-title-*`. Unifying the five h3 styles changes some sizes, which #533 had left out.
- **Reading text** is at most 65 characters wide (`max-w-prose`), with a line height of 1.5 and no justified text. The 768 px width of §2.9 stays for forms and the detail of a record.
- **Weights:** regular 400 (question 3).

### Radii

| Token (utility) | Value | Used by |
|---|---|---|
| `--radius-inner` (`rounded-inner`) | 4 px | checkboxes, tags, items inside menus and selects |
| `--radius-control` (`rounded-control`) | 6 px | buttons, inputs, selects, side-navigation items |
| `--radius-container` (`rounded-container`) | 8 px | cards, menus, popovers, tables, toasts, Kanban cards |
| `--radius-dialog` (`rounded-dialog`) | 12 px | dialogs, drawers, Kanban columns |
| `rounded-full` | – | avatars, status pills |

- **The rules:**
  - a container is never less rounded than what it holds;
  - an item that sits inside a container at a small padding takes the container's radius minus the padding (menu 8 − padding 4 = item 4).
- **The `--radius` multiplier and the derived `--radius-sm` … `--radius-4xl` are removed.** The components that use them move to the role tokens: Toast to `rounded-container`, Badge to `rounded-full`.

### Density and sizing

The binary model of §2.9 and §18.6 stays: 44 px on touch below `xl` or with a coarse pointer, and compact on `xl` with a fine pointer. The compact sizes become tokens in Tailwind's `--spacing-*` namespace, so that `h-control`, `min-h-control` and `size-control` exist (question 10):

| Token | Touch | Compact | Today (compact) |
|---|---|---|---|
| `--spacing-control` (button, input, select, icon button) | 44 | 32 | 32 |
| `--spacing-control-sm` | 44 | 28 | – |
| `--spacing-menu-item` | 44 | 32 | 28 |
| `--spacing-nav-item` (side navigation) | 44 | 32 | 36 |
| `--spacing-row` (table and list row) | 44 | 40 | about 36 |

- **Spacing** stays on Tailwind's 4 px grid.
- **The side navigation** stays 240 px wide expanded and 64 px collapsed.

### Icons

- **Lucide stays, with its default stroke** (question 11). The stroke of 2 on a 24 px grid draws about 1.33 px at 16 px, between Plane's 1.25 and Atlassian's 1.5.
- **Two size tokens** in the `--spacing-*` namespace: `--spacing-icon` 16 px (inline and in controls) and `--spacing-icon-nav` 20 px (navigation).

### Brand colour use

No change from what the teal specification approved:

- **Teal marks:** checked controls, the active tab underline, the combobox check, checked field labels and the selected table row, which also shows its checked checkbox (its question 6); and the focus ring and links (its question 4).
- **The current side-navigation item stays neutral,** as in today's code and in Plane: the `--accent` background, `type-body-strong` and step 12 text.

### Status colours

Each status gets four tokens: fill, subtle fill, text and border. They replace the ad-hoc `/NN` mixes. The fill keeps today's value.

| Status | Fill (White text) | Subtle | Text | Border (decorative) |
|---|---|---|---|---|
| success | `#008236` (4.95) | `#E6FAE9` | `#03642B` (6.71 on subtle) | `#94CF9F` |
| warning | `#BB4D00` (5.03) | `#FEF0E9` | `#833B01` (7.28) | `#EEAD89` |
| danger | `#C10007` (6.42) | `#FEF0EE` | `#8C2D28` (7.50) | `#F2A89E` |
| info | `#2563EB` (5.17) | `#EEF4FF` | `#284E99` (7.20) | `#9EBEF8` |

Dark (the fill keeps today's dark value; its label is dark step 1):

| Status | Fill (step 1 text) | Subtle | Text | Border (decorative) |
|---|---|---|---|---|
| success | `#05DF72` (10.74) | `#17321E` | `#8FE1A1` (8.90 on subtle, 11.66 on the page) | `#346C42` |
| warning | `#FFB900` (11.10) | `#3A270B` | `#F8BF6C` (8.58, 10.97) | `#7B5518` |
| danger | `#FF6467` (6.62) | `#412120` | `#FEB5B1` (8.51, 10.80) | `#894746` |
| info | `#60A5FA` (7.52) | `#1A2C44` | `#A8CEFF` (8.70, 11.21) | `#395F8F` |

The borders are decorative (1.6–1.9:1 in light): a status always has text or an icon (§13.4). How the nine internal and five public statuses map to these colours, and the shared badge, belong to the layout specification.

### Motion

Today's values, from `packages/ui/src/components/*`: hover and popups 100 ms (7 uses), one 200, one 250 (toast), one 300, the drawer 450 ms (2), and three arbitrary cubic-béziers (`0.22,1,0.36,1` twice, `0.32,0.72,0,1`, `0.45,1.005,0,1.005`). They become tokens in Tailwind's namespaces (`--transition-duration-*`, `--ease-*`), named by role so that Tailwind's own `ease-out` and `ease-in` keep their meaning:

| Token | Value with today's timing (question 13 a) | Value unified (question 13 b) |
|---|---|---|
| `--transition-duration-fast` | 100 ms (hover, toggles, popups) | 100 ms (hover, toggles) |
| `--transition-duration-base` | 200 ms | 200 ms (popups, menus) |
| `--transition-duration-toast` | 250 ms | 300 ms (as slow) |
| `--transition-duration-slow` | 300 ms | 300 ms (dialogs, drawers, toasts) |
| `--transition-duration-drawer` | 450 ms | – (300 ms) |
| `--ease-enter`, `--ease-exit`, `--ease-drawer` | today's three curves, named | `cubic-bezier(0.2, 0, 0, 1)` in, `cubic-bezier(0.4, 0, 1, 1)` out |

Option (b) changes popups from 100 to 200 ms, the drawer from 450 to 300 ms and the toast from 250 to 300 ms. Changed timing touches the animation flakiness of the story tests (#555). #530 can land before or after either option, and neither changes what reduced motion stops.

### Token structure and lint

- **Primitives:** `--neutral-1` … `--neutral-12` and the existing `--brand-1` … `--brand-12`.
- **Semantic roles:** the shadcn names plus the new ones above (`--sidebar`, `--sunken`, `--accent-active`, `--border-hover`, `--input-hover`, the status quartets, shadows, radii, sizes, durations and `type-*` styles). The status quartets keep the existing names: `--destructive` with `--destructive-subtle`, `--destructive-text` and `--destructive-border`, and the same for success, warning and info; "danger" in the table means `--destructive`.
- **No component tier, and CSS only** (question 14).
- **New lint rules** in `@trybun/eslint-config` reject, in Trybun's own code (`apps/web` and Trybun's own components):
  - Tailwind size, radius, shadow and duration classes where a token exists;
  - `/NN` colour mixes;
  - `dark:` classes, with no exceptions: dark mode works through the tokens alone (§2.6).

## Changes to the system specification

| Section | Change |
|---|---|
| [§2.6](../../docs/spec/02-agent-rules.md) | the token families above and the lint rules |
| [§2.9](../../docs/spec/02-agent-rules.md) | reading text at 16 px and at most 65 characters; the compact sizes as tokens |
| [§13.4](../../docs/spec/13-non-functional.md) | every text role ≥ 4.5:1 and every identifying border ≥ 3:1 on every surface, checked by the story tests |
| [§18.6](../../docs/spec/18-code-patterns.md) | compact sizes through the size tokens; text through `Heading` and `Text`; registry components keep their Tailwind sizes; role radii in the adapted components |
| [`docs/brand/README.md`](../../docs/brand/README.md) – UI design tokens and Rules | the neutral scale, surfaces, text styles, radii, shadows, sizes and durations replace "Tailwind defaults"; Ink leaves the UI table, and the rule that names Ink as a dark background of the mark names Deep Teal only |
| [`.ai/memory/shadcn.md`](../memory/shadcn.md) | "The theme keeps Tailwind's type scale" becomes the `type-*` mechanism of question 8 |

New or changed glossary terms: none.

## Open questions

Every question has an answer. Each question names the options and the recommendation, with its reason.

1. **Neutral scale.**
   - **Options:**
     - (a) tinted toward Teal's hue (above);
     - (b) near-achromatic cool grey, like Plane;
     - (c) pure grey, like Fluent, Carbon and Polaris;
     - (d) keep the Ink mixes.
   - **Recommendation: (a).** It continues the brand without a colour cast. Ink's chroma is 3–10 times that of other systems, and its hue is 80° from Teal. Atlassian and Linear removed a blue tint from their neutrals.
   - **Answer:** (a), the neutral scale tinted toward Teal's hue (maintainer, 2026-11-28, on the recommendation).
2. **Typeface.**
   - **Options:**
     - (a) keep Manrope: one family with the wordmark, no change to the font load measured by #509, a geometric character less common than Inter, no alternates for I, l and 1;
     - (b) move to Inter, as in Plane: optical sizes and those alternates, but a second family next to the wordmark and a font change measured against #509.
   - **Recommendation: (a)**, with identifiers in tabular figures. The x-heights are almost equal (0.540 and 0.546). The alternates matter mostly for identifiers, which tabular figures in context cover. The preview shows both; the answer records what the maintainer saw.
   - **Answer:** (a), Manrope, with identifiers in tabular figures (maintainer, 2026-11-28, on the recommendation).
3. **Regular weight.**
   - **Options:** 400, or 450 as Plane uses for Inter, because Inter "reads slightly light at 400".
   - **Recommendation: 400**, to confirm on the preview. Plane's reason concerns Inter; whether Manrope needs it is a visual judgement (own reasoning).
   - **Answer:** 400 (maintainer, 2026-11-28, on the recommendation).
4. **UI text size.**
   - **Options:**
     - (a) 14 px, with 12 px for metadata;
     - (b) 13 px for dense rows, as in Plane's code, Polaris desktop and macOS.
   - **Recommendation: (a).** 14 px is the base of Primer, Atlassian, Material, Fluent and Carbon's productive set, and no study shows 13 px helps. The visual-angle calculation of the research note does not separate them: on desktop both 13 and 14 px sit below the 12′ critical print size of Legge and Bigelow.
   - **Answer:** (a), 14 px with 12 px for metadata and 16 px for reading text (maintainer, 2026-11-28, on the recommendation).
5. **Surfaces.**
   - **Options:**
     - (a) a white page with a step-2 side navigation and sunken areas (Linear, shadcn, Atlassian);
     - (b) Plane's grey canvas with white surfaces on it.
   - **Recommendation: (a).** It changes the page least and keeps a white reading surface for descriptions and comments.
   - **Answer:** (a), a white page with a step-2 side navigation and sunken areas (maintainer, 2026-11-28, on the recommendation).
6. **Selection.**
   - **Options:**
     - (a) as approved in the teal specification, with the side navigation neutral as today;
     - (b) tabs and rows neutral too, as in Plane's code.
   - **Recommendation: (a).** It is the maintainer's answer of 2026-11-27, and rows already have a second cue.
   - **Answer:** (a), as approved in the teal specification, with the side navigation neutral (maintainer, 2026-11-28, on the recommendation).
7. **Radius values.**
   - **Options:**
     - (a) by role, 4 / 6 / 8 / 12;
     - (b) keep 10 px for controls and containers (the shadcn default kept on purpose, as #532 planned).
   - **Recommendation: (a).** Plane and Atlassian put controls at 6 and containers at 8–12; Primer's default is 6, with 12 for large containers. A container then reads as holding its controls.
   - **Answer:** (a), by role, 4 / 6 / 8 / 12 (maintainer, 2026-11-28, on the recommendation).
8. **How text styles and radii reach the components.**
   - **Options:**
     - (a) new role names: `type-*` utilities and `rounded-inner`/`-control`/`-container`/`-dialog`, with a `cn` configured through `cn/config` that knows them as size and radius groups, used only by Trybun's own components. `cn` alone keeps unknown names but no longer merges them: `cn('rounded-control', 'rounded-none')` keeps both, so a caller's `className` would stop winning (§18.6). The registry components keep Tailwind's classes and the plain `cn`, so they need no edits; `shadcn diff` grows only where an adapted registry component moves to a role name, listed in `.ai/memory/shadcn.md`;
     - (b) retune the values of Tailwind's existing names (`text-sm`, `rounded-lg` …), with no component edits but no role names, so the roles stay approximate;
     - (c) custom `text-*` names with a `createCn` instance, which means changing the `cn` import in every registry component.
   - **Recommendation: (a).** It gives role names that lint can enforce, keeps merging correct in Trybun's components, and leaves the registry imports untouched.
   - **Answer:** (a), role names with a `cn` configured through `cn/config` in Trybun's own components (maintainer, 2026-11-28, on the recommendation).
9. **Border strength.**
   - **Options:**
     - (a) two kinds, an identifying border at ≥ 3:1 (`--input`) and a decorative border (`--border`, 1.35:1) that is never the only cue;
     - (b) every border at ≥ 3:1, heavier but self-sufficient;
     - (c) decorative borders everywhere, as in Plane (1.19–1.30:1), criticised in makeplane/plane#9095.
   - **Recommendation: (a).** It is today's model, it meets WCAG 1.4.11, and it keeps cards and dividers calm. High-contrast themes stay out of scope.
   - **Answer:** (a), an identifying border at ≥ 3:1 and a decorative border that is never the only cue (maintainer, 2026-11-28, on the recommendation).
10. **Compact sizes.**
    - **Options:** the anchor for controls at 32 px (above; today, Primer, Atlassian, shadcn) or 28 px (Plane); menu items 32 (from 28); side-navigation items 32 (from 36); rows 40 (from about 36), 36 or 44 (Plane).
    - **Recommendation:** as in the table. 32 px matches most systems and today. Menu and navigation items at 32 match each other and Plane. Rows at 40 are Carbon's default and the closest to Plane that still keeps more rows on screen than 44.
    - **Answer:** as in the table: controls 32 (small 28), menu and side-navigation items 32, rows 40 (maintainer, 2026-11-28, on the recommendation).
11. **Icon stroke.**
    - **Options:**
      - (a) Lucide's default (about 1.33 px at 16 px);
      - (b) a set stroke of 1.5;
      - (c) another icon set.
    - **Recommendation: (a).** It sits between Plane and Atlassian and needs no override on every icon.
    - **Answer:** (a), Lucide's default stroke (maintainer, 2026-11-28, on the recommendation).
12. **Status colours.**
    - **Options:**
      - (a) the four tokens per status above;
      - (b) solid fills only, as today.
    - **Recommendation: (a).** It removes the `/NN` mixes, and the subtle variants are what lists and notes need.
    - **Answer:** (a), four tokens per status (maintainer, 2026-11-28, on the recommendation).
13. **Motion tokens.**
    - **Options:**
      - (a) tokens with today's timing (the table above);
      - (b) tokens with unified timing: 100 / 200 / 300 ms and two curves;
      - (c) no tokens, durations written per component.
    - **Recommendation: (a).** It removes the arbitrary values without changing how anything moves, so the story tests keep their timing (#555). The drawer's 450 ms is above NN/g's 400 ms for large moves; changing it can follow as a measured change. #530 left tokens out of its own scope; it did not reject them.
    - **Answer:** (a), tokens with today's timing (maintainer, 2026-11-28, on the recommendation).
14. **Token tiers and format.**
    - **Options:**
      - (a) primitives and semantic roles in CSS, with no component tier and no DTCG JSON;
      - (b) add a component tier (Primer, Material);
      - (c) keep a DTCG JSON source and generate the CSS.
    - **Recommendation: (a).** shadcn and Atlassian have no component tier, and no tool needs JSON yet.
    - **Answer:** (a), primitives and semantic roles in CSS, no component tier, no DTCG JSON (maintainer, 2026-11-28, on the recommendation).
15. **Dark theme.**
    - **Options:**
      - (a) remove it, as decided on 2026-11-26 (#531);
      - (b) keep it as an option beside the default light theme.
    - **Answer:** (b), keep it (maintainer, 2026-11-28: "a must-have of the industry today"). An earlier reply of the same day accepted (a) by oversight and was corrected. NN/g finds light text easier to read for most people, so light stays the default and dark is an option. #531 is closed; showing the theme in the application gets its own specification.

## Acceptance criteria

- [ ] `globals.css` defines the neutral scale, surfaces, status quartets, shadows, role radii, sizes, durations and `type-*` styles of the answers, in light and dark. The `--radius` multiplier and the Ink-based UI values are gone.
- [ ] The story test `Foundations/Colour tokens` checks, in both themes:
  - every text role on every surface where it is used (≥ 4.5:1);
  - `--input` on every surface where it is used (≥ 3:1);
  - every status text on its subtle fill, and White on every status fill (≥ 4.5:1);
  - the Teal pairs of the teal specification.
- [ ] In Trybun's own code the lint rejects `/NN` colour mixes, `dark:` classes, and Tailwind size, radius, shadow and duration classes where a token exists.
- [ ] Every heading and text element in `apps/web` and in Trybun's own components uses `Heading` or `Text`; the registry components keep their Tailwind sizes. #533 is closed by this work.
- [ ] Ticket identifiers and project keys use the UI font with tabular figures.
- [ ] `docs/brand/README.md` lists the new tokens and no longer says that type, radii and shadows are Tailwind defaults; `.ai/memory/shadcn.md` describes the `type-*` and role-radius mechanism and the classes it adds to `shadcn diff`.
- [ ] Works on phone, tablet and desktop (Rule 9): light theme in manual QA, dark theme in Storybook until the application shows it.
- [ ] User documentation and product tour updated where they show the changed screens (Rules 3, 4).

## Changelog

- 2026-11-28 – Created from the research note of #580, with recommendations for the maintainer's answers.
- 2026-11-28 – The maintainer keeps the dark theme (question 15 answered (b), correcting an earlier oversight); dark values, contrasts, statuses and shadows added; #531 closed.
- 2026-11-28 – Second review: the `cn` merge gap in question 8, today's motion timing as option (a) of question 13, the `--spacing-*` and `--transition-duration-*` namespaces, step 9 darkened to 3.17:1 on the pressed surface, #532 conditional, status names on `--destructive`.
- 2026-11-28 – Revised after review:
  - the Ink inventory is complete;
  - the dark theme was removed (question 15), later reversed;
  - the borders, compact sizes, icons and token tiers became questions;
  - the mechanism for text styles and radii against `cn` and `shadcn diff` is a question;
  - status, shadow and easing values are added;
  - the shared status badge moved to the layout specification;
  - #532 and #533 are related;
  - the arguments of questions 4 and 7 are corrected.
- 2026-11-28 – Questions 1–14 answered by the maintainer on the recommendations; approved.
