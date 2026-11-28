# Design-system foundations in the Plane direction

| | |
|---|---|
| Status | `draft` |
| Created | 2026-11-28 |
| Plan task | – |
| System specification sections | §2.6, §2.9, §13.4; [`docs/brand/README.md`](../../docs/brand/README.md) (UI design tokens) |
| Related issues / PRs | #581, #580 (research), [`2026-11-27-brand-teal-palette.md`](implemented/2026-11-27-brand-teal-palette.md) (its non-goal), #530, #531, #533 |

## Context

On 2026-11-27 the maintainer chose Plane as the direction of Trybun's UI: clear, intuitive and full of conventions users know from other tools. The teal palette ([`2026-11-27-brand-teal-palette.md`](implemented/2026-11-27-brand-teal-palette.md)) changed the brand and action colours. Its non-goals left "neutrals and surface layers, type, radii, density, motion and statuses" to this specification.

The research note [`research/2026-11-28-design-system-foundations.md`](research/2026-11-28-design-system-foundations.md) compares Plane's code with ten other design systems and the accessibility evidence. It also takes stock of `@trybun/ui` at `da23a6bb`. What it found about Trybun today:

- **No neutral scale.** Nine single values, each an sRGB mix of Ink `#141A2E` and White. Ink has chroma 0.040 at hue 270, 3–10 times the darkest neutrals of the other systems, and about 80° from Teal's hue 191.
- **No surface layers.** In light, `--background`, `--card` and `--popover` are the same white, and `--secondary`, `--muted` and `--accent` the same grey. Header, side navigation and page sit on one background. There is no sidebar token.
- **No named text styles.** The page heading is copied 23 times, and h3 has five styles (#533). Ticket identifiers use the system monospace stack. Numbers are not tabular.
- **One radius for everything.** Controls and cards share 10 px, so there is no step between a container and the controls inside it.
- **Tailwind defaults** for shadows (black), type scale, motion, and all spacing outside the tokens. There are 47 `/NN` opacity mixes and 22 `dark:` classes that the token tests do not see.
- **Statuses look different in two places.** Team statuses are one grey badge; the portal's are coloured with icons.

Plane's design system (`@makeplane/propel`) is AGPL-3.0-only and Trybun is MIT. This specification therefore takes Plane's principles and derives its own values. It copies no Propel tokens or code.

## Goals

- **One neutral scale** with a role for every step, in light and dark. Every text role meets 4.5:1, and every identifying border meets 3:1, on every surface it is used on.
- **Surface layers** that separate the sidebar, the page, raised items and overlays, as in Plane and Atlassian, in both themes.
- **Named text styles** for every role, used through one component. Raw size classes are replaced.
- **A radius, border, shadow, density and motion scale by role**, so that equal things look equal everywhere (Rule 2, Rule 6).
- **Tokens only.** Every value lives in [`globals.css`](../../packages/ui/src/styles/globals.css), the lint and the story tests guard it, and dark mode works through tokens alone.

## Non-goals

- **Layout and UX patterns:** app shell, view header, list, board, detail view, command palette and empty states. They get their own specification after this one, which also lists the shared components of section 11 of the research note.
- **Keycloak sign-in theming.** It needs its own research and specification.
- **The brand colours and the mark** ([`2026-11-27-brand-teal-palette.md`](implemented/2026-11-27-brand-teal-palette.md)).
- **A user setting for density or high-contrast themes.** Nothing needs them yet; they can come when a user group asks.
- **The reduced-motion behaviour of #530.** This specification adds duration tokens only; #530 decides what stops moving.

## Proposed change

The values below are the recommendation. The open questions show the options, and the maintainer's answers decide the final values.

### Neutral scale

Twelve steps in OKLCH at Trybun's own hue 196, between Teal (191) and Deep Teal (199), with very low chroma: 0.002 at step 1 rising to 0.016 at step 12. It sits in the same family as Radix sage (the gray Radix Themes pairs with teal) and Tailwind mist, but the values are Trybun's own. Hex values are rounded from OKLCH.

| Step | Role (Radix convention) | Light | Dark |
|---|---|---|---|
| 1 | app background, subtle | `#FBFDFD` | `#0D1010` |
| 2 | sidebar, sunken areas | `#F7FAFA` | `#131616` |
| 3 | control background (muted) | `#EFF3F3` | `#1B1F1F` |
| 4 | hover | `#E7ECEC` | `#212626` |
| 5 | active, pressed | `#E0E6E6` | `#262C2C` |
| 6 | decorative border, divider | `#D8DFDF` | `#2D3434` |
| 7 | stronger decorative border | `#CDD5D4` | `#383F3F` |
| 8 | border on hover | `#BBC4C3` | `#495252` |
| 9 | identifying border (inputs, unchecked controls) | `#7D8787` | `#737D7D` |
| 10 | hover of identifying border | `#717B7B` | `#7E8988` |
| 11 | secondary text, icons, placeholder | `#566060` | `#AFB8B8` |
| 12 | primary text | `#152120` | `#E8EEEE` |

Contrast, measured with the WCAG 2 formula:

| Pair | Light | Dark |
|---|---|---|
| Step 12 text on the page | 16.53 on white | 15.51 on step 2 |
| Step 11 text on the page / sidebar / control / hover | 6.49 / 6.18 / 5.80 / 5.44 | 8.99 on step 2, 7.57 on step 4 |
| Step 9 border on the page / control | 3.69 / 3.30 | 4.30 on step 2, 3.62 on step 4 |
| Teal action colour on the page / sidebar / control | 7.51 / 7.16 / 6.72 | `#6EBFB9`: 8.51 on step 2, 7.17 on step 4 |

**Ink leaves the UI.** It stays a brand value for the dark Teal button label (dark-theme `--primary-foreground`), unless question 4 decides otherwise. The text colour becomes step 12, a near-black on Teal's side of the hue circle. The research note records that Atlassian and Linear also removed a blue tint from their neutrals.

### Surfaces

| Token | Light | Dark | Used by |
|---|---|---|---|
| `--background` | White | step 2 | the page |
| `--sidebar` (new) | step 2 | step 1 | the side navigation; one step away from the page, never brand-coloured |
| `--sunken` (new) | step 2 | step 1 | Kanban columns, table header, code blocks |
| `--card` | White + `--border` | step 3 | cards, panels |
| `--popover` | White + `--border` + overlay shadow | step 4 + `--border` | menus, popovers, dialogs |
| `--muted`, `--secondary` | step 3 | step 3 | control backgrounds, neutral badges |
| `--accent` (hover) | step 4 | step 4 | hovered rows and menu items |
| `--border` | step 6 | step 6 | dividers, card and popover edges (decorative, not the only cue) |
| `--input` | step 9 | step 9 | identifying borders of fields and unchecked controls (≥ 3:1, WCAG 1.4.11) |

In dark mode, higher surfaces are lighter, as in Material, Atlassian and Carbon. No surface is pure black.

### Borders and shadows

- **Borders are 1 px.** No 0.5 px hairlines (WCAG 1.4.11, anti-aliasing). An identifying border uses `--input`. A decorative border uses `--border` and is never the only cue.
- **Shadows are only for things that float or move:** popovers, menus, dialogs, toasts and dragged Kanban cards. Cards on the page get a border, not a shadow (NN/g, Atlassian).
- **Three shadow tokens** in place of Tailwind's black shadows: `--shadow-raised` (a dragged card), `--shadow-overlay` (menus, popovers) and `--shadow-modal` (dialogs). Each is two layers in the hue of step 12 at low alpha. In dark mode they are nearly invisible, and depth comes from the surface steps and the border.

### Typography

- **Typeface:** Manrope stays for the UI (question 2). Ticket identifiers and project keys use the UI font with tabular figures. Monospace is kept for code only, which ends the spaced-out "CP - 3" of the system monospace on phones. Code uses a defined monospace stack.
- **Sizes:**
  - **14 px** for UI text in the team view;
  - **16 px** for reading text: ticket descriptions, comments, help pages and the customer portal's content;
  - **12 px** as the floor, for short metadata only;
  - form fields keep 16 px on touch (§2.9).
- **Named styles**, as utilities from `globals.css`, used through a `Text` and a `Heading` component in `@trybun/ui` (#533):

| Style | Size / line height | Weight | Use |
|---|---|---|---|
| `title-page` | 24 / 32 | 700 | the page heading (h1) |
| `title-section` | 18 / 28 | 600 | section headings (h2) |
| `title-group` | 16 / 24 | 600 | sub-section and dialog titles (h3) |
| `body-reading` | 16 / 24 | 400 | descriptions, comments, help, portal content |
| `body` | 14 / 20 | 400 | UI text |
| `body-strong` | 14 / 20 | 500 | labels, emphasised UI text |
| `caption` | 12 / 16 | 500 | metadata, badges, table headers |

- **Reading text** is capped at about 70 characters per line (`max-w-prose` or the 768 px width of §2.9), with a line height of 1.5 and no justified text.
- **Letter spacing** stays at 0, except −0.01em on `title-page`.
- **Weights:** the regular weight is 400, unless question 3 decides 450.

### Radii

By role, as in Plane and Atlassian:

| Token | Value | Used by |
|---|---|---|
| `--radius-sm` | 4 px | checkboxes, tags, the inner items of menus |
| `--radius-md` | 6 px | buttons, inputs, selects, side-navigation items |
| `--radius-lg` | 8 px | cards, menus, popovers, tables, toasts, Kanban cards |
| `--radius-xl` | 12 px | dialogs, drawers, Kanban columns |
| `--radius-full` | 9999 px | avatars, status pills |

The rule is that a container is one step rounder than the controls inside it. A nested radius is the outer radius minus the padding, with a floor of 0.

### Density and sizing

The binary model of §2.9 and §18.6 stays: 44 px on touch below `xl` or with a coarse pointer, and compact on `xl` with a fine pointer. The compact sizes get named tokens:

| Element | Touch | Compact (`xl:pointer-fine:`) |
|---|---|---|
| Button, input, select | 44 | 32 (small 28) |
| Menu and side-navigation item | 44 | 32 |
| Table and list row | 44 | 40 |
| Icon button | 44 | 32 |

- **Spacing** stays on Tailwind's 4 px grid.
- **The side navigation** is 240 px wide expanded and 64 px collapsed, as today.

### Icons

Lucide stays. The default stroke of 2 on a 24 px grid draws about 1.33 px at 16 px, between Plane's 1.25 and Atlassian's 1.5. Sizes become tokens: 16 px inline and in controls, 20 px in navigation.

### Brand colour use

No change from the approved teal specification (question 6 of [`2026-11-27-brand-teal-palette.md`](implemented/2026-11-27-brand-teal-palette.md)):

- **Teal** marks checked controls, the active tab underline, the focus ring, links and the selected table row, which also shows its checked checkbox.
- **The current side-navigation item** stays neutral, as in Plane's code: `--accent` background, `body-strong` and step 12 text.

### Status colours

- **Every status colour gets four tokens:** fill, subtle fill, text and border (`--success`, `--success-subtle`, `--success-text`, `--success-border`, and the same for warning, danger and info). They replace the ad-hoc `/NN` mixes.
- **Text** on its subtle fill reaches at least 4.5:1, and the border at least 3:1, in both themes.
- **Team and portal share one look.** The team view's status badge gets the colour and icon of the portal's `PublicStatusBadge`, through one shared component, so a status looks the same everywhere (Rule 2).

### Motion

- **Three duration tokens:** `--duration-fast` 100 ms (hover, toggles), `--duration-base` 200 ms (popovers, menus) and `--duration-slow` 300 ms (dialogs, drawers, toasts).
- **Two easings:** `--ease-out` for entering and `--ease-in` for leaving.
- **The arbitrary durations and cubic-béziers** of the drawer and toast are replaced.
- **What stops under reduced motion** is decided by #530.

### Token structure

- **Primitives:** `--neutral-1` … `--neutral-12` and the existing `--brand-1` … `--brand-12`, in light and dark.
- **Semantic roles:** the shadcn names, plus `--sidebar`, `--sunken`, the status quartets, shadows, radii, sizes, durations and text styles.
- **No component tier.** shadcn and Atlassian have none either, and every additional tier must be maintained.
- **CSS only, no DTCG JSON**, because no tool needs JSON yet.
- **The lint gets new rules** that reject:
  - raw Tailwind size, shadow and duration classes where a token exists;
  - `/NN` colour mixes;
  - `dark:` classes outside the exceptions written in `.ai/memory/shadcn.md`.

## Changes to the system specification

| Section | Change |
|---|---|
| [§2.6](../../docs/spec/02-agent-rules.md) | the token families above, the lint rules, and "dark mode through tokens" without `dark:` classes |
| [§2.9](../../docs/spec/02-agent-rules.md) | reading text at 16 px and about 70 characters; the compact sizes as named tokens |
| [§13.4](../../docs/spec/13-non-functional.md) | every text role ≥ 4.5:1 and every identifying border ≥ 3:1 on every surface, checked by the story tests |
| [`docs/brand/README.md`](../../docs/brand/README.md) – UI design tokens | the neutral scale, surfaces, text styles, radii, shadows, sizes and durations replace "Tailwind defaults"; Ink leaves the UI table |

## Open questions

Implementation must not start until every question has an answer. Each question names the options from the research note and the recommendation, with its reason.

1. **Neutral scale:**
   - (a) tinted toward Teal's hue (above);
   - (b) near-achromatic cool grey like Plane;
   - (c) pure grey like Fluent, Carbon and Polaris;
   - (d) keep Ink mixes.

   **Recommendation: (a).** It continues the brand without a colour cast. Radix pairs teal with sage. Ink's blue hue is 80° away from Teal, and its chroma is 3–10 times that of other systems.
2. **Typeface:**
   - (a) keep Manrope: one family with the wordmark, no change to the font load of #509, a geometric character that is less common than Inter;
   - (b) move to Inter, as in Plane: optical sizes, and alternates that tell I, l and 1 apart.

   **Recommendation: (a)**, with identifiers in tabular figures. The x-heights are almost equal (0.540 and 0.546), so legibility at 14 px is the same. Inter's alternates matter mostly for identifiers, which tabular Manrope covers. The preview shows both.
3. **Regular weight:** 400, or 450 as Plane uses for Inter ("reads slightly light at 400"). **Recommendation:** decide on the preview. Manrope's 400 is heavier than Inter's, so 400 is the expected answer.
4. **Text colour and Ink:**
   - (a) step 12 for text, and Ink stays only as the dark-theme button label;
   - (b) step 12 everywhere, including that label (8.93:1 on the dark Teal fill).

   **Recommendation: (b).** One neutral family. Ink then remains only in the brand files' history.
5. **UI text size:**
   - (a) 14 px, with 12 px for metadata;
   - (b) 13 px for dense rows, as in Plane's code, Polaris desktop and macOS.

   **Recommendation: (a).** 14 px is the base of Primer, Atlassian, Material, Fluent and Carbon. By the visual-angle calculation, 13 px sits below the critical print size on most desktop setups. No study shows that 13 px helps.
6. **Surfaces:**
   - (a) a white page with a step-2 sidebar and sunken areas, as above (Linear, shadcn, Atlassian);
   - (b) Plane's grey canvas with white surfaces on it.

   **Recommendation: (a).** It changes the page least, and keeps the white reading surface for descriptions and comments.
7. **Selection:**
   - (a) as approved in the teal specification: Teal for checked controls, the tab underline and the selected row, and the side navigation neutral;
   - (b) neutral for tabs and rows too, as in Plane's code.

   **Recommendation: (a).** It is the maintainer's answer of 2026-11-27, and it already works with a second cue on rows.
8. **Radii:**
   - (a) by role, 4 / 6 / 8 / 12;
   - (b) keep 10 px for controls and containers (the shadcn default).

   **Recommendation: (a).** Plane, Atlassian and Primer all put controls at 6 and containers at 8–12. It also removes one of the visible shadcn defaults that the stage 1 audit named.
9. **Compact row height:** 40 px (above), 36 px (today's cell padding), or 44 px as in Plane's list. **Recommendation:** 40 px. It is the default row in Carbon, and it is closest to Plane while keeping more rows on screen than 44.
10. **Dark theme:**
    - (a) keep it as a first-class option that follows the system setting, and close #531;
    - (b) remove it (#531).

    **Recommendation: (a).** NN/g: light reads better for most people, and dark is expected as an option in developer tools. The dark values above are ready and tested by the story tests. Showing it in the app is a separate step; until then it stays in Storybook.
11. **Status colours:**
    - (a) the four tokens per status, with one badge for team and portal;
    - (b) solid fills only, as today.

    **Recommendation: (a).** One look for one status (Rule 2), and no `/NN` mixes.
12. **Motion tokens:**
    - (a) three durations and two easings;
    - (b) none, as in Plane and #530's non-goal.

    **Recommendation: (a).** Durations are repeated in many components today, and the drawer and toast use arbitrary values.

## Acceptance criteria

- [ ] `globals.css` defines the neutral scale, surfaces, status quartets, shadows, radii, sizes, durations and text styles of the answers, in both themes.
- [ ] The story test `Foundations/Colour tokens` checks, in both themes:
  - every text role on every surface it is used on (≥ 4.5:1);
  - `--input` on every surface (≥ 3:1);
  - every status text on its subtle fill;
  - the Teal pairs of the teal specification.
- [ ] No `/NN` colour mix, `dark:` class (outside the written exceptions), raw size, shadow or duration class where a token exists; the lint rejects them.
- [ ] Every heading and text in `@trybun/ui` and `apps/web` uses `Heading` or `Text` (#533).
- [ ] Ticket identifiers and project keys use the UI font with tabular figures.
- [ ] The team status badge and the portal status badge are one component.
- [ ] `docs/brand/README.md` lists the new tokens and no longer says that type, radii and shadows are Tailwind defaults.
- [ ] Works on phone, tablet and desktop (Rule 9); light theme in manual QA, dark theme in Storybook (unless question 10 shows it in the app).
- [ ] User documentation and product tour updated where they show the changed screens (Rules 3, 4).

## Changelog

- 2026-11-28 – Created from the research note of #580, with recommendations for the maintainer's answers.
