# Trybun brand assets

## The mark

The Trybun mark is a letter **T** whose stem splits like branches in git: the Deep Teal branch stands for the development team, the Gold branch for the customers. Both meet in one stem – customer requests and developer work on one path.

## Files

| File | Use |
|---|---|
| `trybun-icon.svg` | Primary icon, on light backgrounds |
| `trybun-icon-on-dark.svg` | Icon on dark backgrounds (White and Gold) |
| `trybun-icon-mono.svg` | One-colour icon (Deep Teal), e.g. badges, print |
| `trybun-icon-mono-white.svg` | One-colour icon (white) on dark backgrounds |
| `trybun-logo-light.svg` | Icon + wordmark, light background |
| `trybun-logo-dark.svg` | Icon + wordmark on a Deep Teal background |
| `trybun-icon-512.png` | Icon, transparent background, 512 px |
| `trybun-avatar-512.png` | Square avatar with white background (GitHub organization, social profiles) |
| `favicon.ico` | Favicon, 16/32/48 px |
| `trybun-social-preview.png` | Social preview of the GitHub repository, 1280 × 640 px, on Deep Teal |

The wordmark in `trybun-logo-*.svg` uses the **Manrope ExtraBold** font. Before using these files outside the web (print, design tools), convert the text to outlines.

The web application keeps copies: `apps/web/src/app/favicon.ico` and `apple-icon.png` (the avatar), `apps/web/public/icons/` (the primary icon as SVG and as PNG of 192 and 512 px), and `apps/web/src/app/icon.svg`, the primary icon with a `prefers-color-scheme: dark` rule that switches it to the dark-background version on a dark browser tab. The favicon follows the browser theme, not the theme of the page; Safari 26 ignores the rule and shows the light version. The header of the application loads `public/icons/trybun-icon.svg`, which has no such rule: in some browsers (Safari) an SVG image follows the theme of the system rather than the page, and the header is light.

The SVG files are plain SVG written from the geometry of the mark, without embedded metadata. The PNG files are screenshots in Chromium (Playwright) with Manrope from `@fontsource-variable/manrope`, with grayscale antialiasing (`--disable-lcd-text`):

- `trybun-icon-512.png` and the 192 px copy: `trybun-icon.svg` at the full size of the image, transparent background;
- `trybun-avatar-512.png`: `trybun-icon.svg` in a 352 px square at (80, 80), on White;
- `favicon.ico`: `trybun-icon.svg` rendered at 16, 32 and 48 px, stored as PNG images;
- `trybun-social-preview.png` (1280 × 640, Deep Teal background):
  - the mark of `trybun-logo-dark.svg` (White and Gold) with the transform `translate(285,134.6) scale(2.1875) translate(10,10) scale(0.8)`;
  - the wordmark `trybun` at x 519.3, baseline 301.5, Manrope 800, 148.2 px, letter spacing −5.97 px, White;
  - the tagline "Customer requests and developer work on one path", centred at x 640, baseline 406, Manrope 500, 36 px, White at 85 % opacity;
  - "OPEN SOURCE · SELF-HOSTED · MIT", centred at x 640, baseline 478, Manrope 500, 22 px, letter spacing 1.8 px, White at 65 % opacity.

To change a colour, change it in every SVG file and render the PNG and ICO files again as described above.

## Colours

| Name | Hex | Use |
|---|---|---|
| Teal | `#035F5C` | The action and interaction colour of the UI: primary button, selection, focus, links (not in the mark) |
| Deep Teal | `#071F20` | Team branch, crossbar and wordmark of the mark; brand surfaces (sign-in panel, e-mail header, social preview) |
| Gold | `#DCA81C` | Customer branch of the mark; a brand accent only, never text, buttons or statuses |
| White | `#FFFFFF` | Backgrounds; team branch and crossbar of the mark on dark backgrounds |

These colours were chosen on 2026-11-27 ([change specification](../../.ai/specs/implemented/2026-11-27-brand-teal-palette.md)).

## Typography

- Wordmark: **Manrope ExtraBold (800)**, always lowercase: `trybun`.
- In running text the name is written **Trybun**.

## UI design tokens

**Status: proposed – requires human approval.** The tokens below are defined in [`packages/ui/src/styles/globals.css`](../../packages/ui/src/styles/globals.css) (Rule 6, [§2.6](../spec/02-agent-rules.md)); a human approves the final values in the S0-07 pull request.

The brand colours above are not a complete UI palette. The UI uses the token set of shadcn/ui, derived from the brand as follows; Tailwind's default colour palette is not available:

- **Teal** is the one colour of **action and interaction**, used rarely, as in Plane: the primary button (`--primary`, hover `--primary-hover`), selected states (checked switch, radio and checkbox, active tab, selected row `--selected`), the focus ring (`--ring`) and links in running text (`--link`). It comes as a 12-step scale in OKLCH (`--brand-1` … `--brand-12`, hue about 190) with the roles of Radix Colors: 1–2 backgrounds, 3–5 component backgrounds, 6–8 borders, 9 the solid fill, 10 hover, 11 text, 12 strong text. In the dark theme the fill is light Teal with dark step 1 text (`#0D1010`).
- **Neutrals** come from a 12-step scale at hue 196, between Teal and Deep Teal, with very low chroma (`--neutral-1` … `--neutral-12`, [design-system foundations](../../.ai/specs/2026-11-28-design-system-foundations.md)): step 12 is the text, step 11 secondary text, the low steps surfaces, states and decorative lines (steps 2–6 in light, 1–7 in dark), step 9 the boundary of fields. Ink `#141A2E` was the neutral of the earlier palette and is no longer used in the UI.
- **Gold** is a **brand accent only** (`--brand-accent`): the fill or stroke of the mark and of illustrations, never text, buttons or statuses. It is 4° of hue from the dark-theme warning and has 2.17:1 on White. The lint rules of `@trybun/eslint-config` allow it only as `fill-brand-accent` and `stroke-brand-accent`.
- **Semantic colours** (success, warning, danger) use the 700 shades of the Tailwind palette in the light theme and the 400 shades in the dark theme; info keeps its own blue. They are used as solid backgrounds with White text (light) or step 1 text (dark), or as subtle fills with their own text and border tokens, and always combined with an icon or text ([§13.4](../spec/13-non-functional.md)).

| Token | Light | Dark | Contrast |
|---|---|---|---|
| `--background` | White `#FFFFFF` | `#131616` (step 2) | |
| `--foreground` | `#152120` (step 12) | `#E8EEEE` (step 12) | 16.53:1 / 15.51:1 |
| `--card`, `--popover` | White, with `--border` | `#1B1F1F` (step 3), with `--border` | |
| `--sidebar`, `--sunken` | `#F7FAFA` (step 2) | `#0D1010` (step 1) | side navigation; Kanban columns, table headers, code blocks |
| `--primary` / `--primary-foreground` | Teal `#035F5C` (brand step 9) / White | `#6EBFB9` (brand step 9) / `#0D1010` | 7.51:1 / 8.93:1 |
| `--primary-hover` | `#01504D` (brand step 10) | `#82CEC8` (brand step 10) | with the foreground 9.31:1 / 10.57:1 |
| `--selected` | `#DEF4F2` (brand step 3) | `#0D2725` (brand step 3) | text 14.43:1 / 13.41:1; 1.15:1 / 1.16:1 against `--background`, so a selected row also shows a check |
| `--secondary`, `--muted` | `#EFF3F3` (step 3) | `#212626` (step 4) | text 14.79:1 / 13.06:1 |
| `--accent` / `--accent-active` | `#E7ECEC` / `#E0E6E6` (steps 4, 5) | `#262C2C` / `#2D3434` (steps 5, 6) | hovered / pressed rows and menu items |
| `--muted-foreground` | `#566060` (step 11) | `#AFB8B8` (step 11) | on `--background` 6.49:1 / 8.99:1, at least 5.14:1 / 6.28:1 on every surface |
| `--destructive` / `-foreground` | red-700 `#C10007` / White | red-400 `#FF6467` / `#0D1010` | 6.42:1 / 6.62:1 |
| `--success` / `-foreground` | green-700 `#008236` / White | green-400 `#05DF72` / `#0D1010` | 4.95:1 / 10.74:1 |
| `--warning` / `-foreground` | amber-700 `#BB4D00` / White | amber-400 `#FFB900` / `#0D1010` | 5.03:1 / 11.10:1 |
| `--info` / `-foreground` | `#2563EB` / White | `#60A5FA` / `#0D1010` | 5.17:1 / 7.52:1 |
| `--{status}-subtle`, `-text`, `-border` | e.g. success `#E6FAE9`, `#03642B`, `#94CF9F` | e.g. success `#17321E`, `#8FE1A1`, `#346C42` | text on its subtle fill 6.71–7.50:1 / 8.51–8.90:1; borders decorative (values in [`globals.css`](../../packages/ui/src/styles/globals.css)) |
| `--border` / `--border-hover` | `#D8DFDF` / `#BBC4C3` (steps 6, 8) | `#383F3F` / `#495252` (steps 7, 8) | decorative, never the only cue |
| `--input` / `--input-hover` | `#778181` / `#717B7B` (steps 9, 10) | `#788382` / `#848F8E` (steps 9, 10) | boundary of form fields (WCAG 1.4.11): 4.01:1 / 4.65:1 on the page, at least 3.17:1 / 3.25:1 on every surface |
| `--ring` | Teal `#035F5C` (brand step 9) | `#6EBFB9` (brand step 9) | focus indicator, 2 px ([§13.4](../spec/13-non-functional.md)); on `--background` 7.51:1 / 8.51:1, on `--muted` 6.72:1 / 7.17:1 |
| `--link` | `#035F5C` (brand step 11) | `#8CD4CE` (brand step 11) | links in running text, underlined; on `--background` 7.51:1 / 10.77:1 |
| `--overlay` | step 12 at 40 % | Black 60 % | backdrop of dialogs and sheets |
| `--shadow-raised`, `-overlay`, `-modal` | two layers in step 12 at low alpha | two layers of black | only what floats or moves (menus, popovers, dialogs, toasts, a dragged card) |
| `--brand-accent` | Gold `#DCA81C` | Gold `#DCA81C` | fill and stroke of shapes only |
| `--radius` | `0.625rem` | | |

The type scale, spacing, radii (derived from `--radius`) and breakpoints are those of Tailwind CSS until the next steps of the design-system foundations; shadows are the three tokens above; the breakpoints `md` (768 px) and `xl` (1280 px) are the tablet and desktop widths of [§2.9](../spec/02-agent-rules.md).

**UI typeface:** Manrope (variable font, self-hosted with `next/font` in the web application, Fontsource in Storybook) through the CSS variable `--font-manrope`, fallback `system-ui, sans-serif`. Code blocks use the system monospace stack.

## Rules

- Keep clear space around the mark of at least the height of its crossbar.
- Minimum size: 16 px for the icon, 80 px width for the logo with wordmark.
- Do not recolour the branches, rotate, stretch, outline or add effects to the mark.
- Versions: on light backgrounds Deep Teal and Gold; on dark backgrounds (Ink, Deep Teal) White and Gold; one colour Deep Teal, or White on dark backgrounds.
- Gold is never used for text, buttons or statuses; the customer side in the UI is never shown by colour alone.
- After a change of the mark, check the favicon at 16 px on a light and a dark browser tab.
- On photos or busy backgrounds, use the one-colour version.

## Project README header

Use the icon (pure shapes, no font dependency) with a regular Markdown heading. The `<picture>` element switches to the dark-background icon in GitHub's dark theme:

```html
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/trybun-icon-on-dark.svg">
    <img src="docs/brand/trybun-icon.svg" alt="" width="96">
  </picture>
</p>
<h1 align="center">Trybun</h1>
<p align="center">Customer requests and developer work on one path</p>
```

## GitHub social preview

`trybun-social-preview.png` (1280 × 640) is uploaded in the repository settings: **Settings → General → Social preview**.
