# Trybun brand assets

## The mark

The Trybun mark is a letter **T** whose stem splits like branches in git: the dark branch stands for the development team, the vermilion branch for the customers. Both meet in one stem – customer requests and developer work on one path.

## Files

| File | Use |
|---|---|
| `trybun-icon.svg` | Primary icon, on light backgrounds |
| `trybun-icon-on-dark.svg` | Icon on dark backgrounds |
| `trybun-icon-mono.svg` | One-colour icon (dark), e.g. badges, print |
| `trybun-icon-mono-white.svg` | One-colour icon (white) on dark backgrounds |
| `trybun-logo-light.svg` | Icon + wordmark, light background |
| `trybun-logo-dark.svg` | Icon + wordmark, dark background |
| `trybun-icon-512.png` | Icon, transparent background, 512 px |
| `trybun-avatar-512.png` | Square avatar with white background (GitHub organization, social profiles) |
| `favicon.ico` | Favicon, 16/32/48 px |

The wordmark in `trybun-logo-*.svg` uses the **Manrope ExtraBold** font. Before using these files outside the web (print, design tools), convert the text to outlines.

## Colours

| Name | Hex | Use |
|---|---|---|
| Teal | `#035F5C` | The action and interaction colour of the UI: primary button, selection, focus, links (not in the mark) |
| Deep Teal | `#071F20` | Team branch, crossbar and wordmark of the mark; brand surfaces (sign-in panel, e-mail header, social preview) |
| Gold | `#DCA81C` | Customer branch of the mark; a brand accent only, never text, buttons or statuses |
| White | `#FFFFFF` | Backgrounds; team branch and crossbar of the mark on dark backgrounds |

These colours were chosen on 2026-11-27 ([change specification](../../.ai/specs/2026-11-27-brand-teal-palette.md)). Until the files of the mark are regenerated in its next step, the files in this folder still show the previous colours (Ink `#141A2E` and Vermilion `#E0482C`).

## Typography

- Wordmark: **Manrope ExtraBold (800)**, always lowercase: `trybun`.
- In running text the name is written **Trybun**.

## UI design tokens

**Status: proposed – requires human approval.** The tokens below are defined in [`packages/ui/src/styles/globals.css`](../../packages/ui/src/styles/globals.css) (Rule 6, [§2.6](../spec/02-agent-rules.md)); a human approves the final values in the S0-07 pull request.

The brand colours above are not a complete UI palette. The UI uses the token set of shadcn/ui, derived from the brand as follows; Tailwind's default colour palette is not available:

- **Teal** is the one colour of **action and interaction**, used rarely, as in Plane: the primary button (`--primary`, hover `--primary-hover`), selected states (checked switch, radio and checkbox, active tab, selected row `--selected`), the focus ring (`--ring`) and links in running text (`--link`). It comes as a 12-step scale in OKLCH (`--brand-1` … `--brand-12`, hue about 190) with the roles of Radix Colors: 1–2 backgrounds, 3–5 component backgrounds, 6–8 borders, 9 the solid fill, 10 hover, 11 text, 12 strong text. In the dark theme the fill is light Teal with Ink text.
- **Ink** stays the base of the neutral scale until the design system specification: backgrounds, borders and muted text are mixes of Ink and White (in sRGB), and Ink is the text colour and the dark background.
- **Gold** is a **brand accent only** (`--brand-accent`): the fill or stroke of the mark and of illustrations, never text, buttons or statuses. It is 4° of hue from the dark-theme warning and has 2.17:1 on White. The lint rules of `@trybun/eslint-config` allow it only as `fill-brand-accent` and `stroke-brand-accent`.
- **Semantic colours** (success, warning, danger) use the 700 shades of the Tailwind palette in the light theme and the 400 shades in the dark theme; info keeps its own blue. They are used as solid backgrounds with White or Ink text, and always combined with an icon or text ([§13.4](../spec/13-non-functional.md)).

| Token | Light | Dark | Contrast |
|---|---|---|---|
| `--background` | White `#FFFFFF` | Ink `#141A2E` | |
| `--foreground` | Ink | White | 17.3:1 |
| `--card`, `--popover` | White | `#22283B` (White 6 % on Ink) | |
| `--primary` / `--primary-foreground` | Teal `#035F5C` (step 9) / White | `#6EBFB9` (step 9) / Ink | 7.51:1 / 8.07:1 |
| `--primary-hover` | `#01504D` (step 10) | `#82CEC8` (step 10) | with the foreground 9.31:1 / 9.54:1 |
| `--selected` | `#DEF4F2` (step 3) | `#0D2725` (step 3) | text 15.06:1 / 15.74:1; 1.15:1 / 1.10:1 against `--background`, so a selected row also shows a check |
| `--secondary`, `--muted`, `--accent` | `#F3F4F5` (Ink 5 %) | `#303547` (White 12 %) | text: 15.6:1 / 12.1:1 |
| `--muted-foreground` | `#5A5F6D` (Ink 70 %) | `#ADAFB6` (White 65 %) | on `--background` 6.4:1 / 7.9:1, on `--muted` 5.8:1 / 5.5:1 |
| `--destructive` / `-foreground` | red-700 `#C10007` / White | red-400 `#FF6467` / Ink | 6.6:1 / 6.0:1 |
| `--success` / `-foreground` | green-700 `#008236` / White | green-400 `#05DF72` / Ink | 5.0:1 / 9.7:1 |
| `--warning` / `-foreground` | amber-700 `#BB4D00` / White | amber-400 `#FFB900` / Ink | 5.1:1 / 10.0:1 |
| `--info` / `-foreground` | `#2563EB` / White | `#60A5FA` / Ink | 5.2:1 / 6.8:1 |
| `--border` | `#E3E4E6` (Ink 12 %) | `#373C4D` (White 15 %) | decorative |
| `--input` | `#8A8C96` (Ink 50 %) | `#727682` (White 40 %) | boundary of form fields, 3.3:1 / 3.8:1 (WCAG 1.4.11) |
| `--ring` | Teal `#035F5C` (step 9) | `#6EBFB9` (step 9) | focus indicator, 2 px ([§13.4](../spec/13-non-functional.md)); on `--background` 7.51:1 / 8.07:1, on `--muted` 6.82:1 / 5.69:1 |
| `--link` | `#035F5C` (step 11) | `#8CD4CE` (step 11) | links in running text, underlined; on `--background` 7.51:1 / 10.21:1 |
| `--overlay` | Ink 40 % | Black 60 % | backdrop of dialogs and sheets |
| `--brand-accent` | Gold `#DCA81C` | Gold `#DCA81C` | fill and stroke of shapes only |
| `--radius` | `0.625rem` | | |

The type scale, spacing, radii (derived from `--radius`), shadows and breakpoints are those of Tailwind CSS; the breakpoints `md` (768 px) and `xl` (1280 px) are the tablet and desktop widths of [§2.9](../spec/02-agent-rules.md).

**UI typeface:** Manrope (variable font, self-hosted with `next/font` in the web application, Fontsource in Storybook) through the CSS variable `--font-manrope`, fallback `system-ui, sans-serif`. Code blocks use the system monospace stack.

## Rules

- Keep clear space around the mark of at least the height of its crossbar.
- Minimum size: 16 px for the icon, 80 px width for the logo with wordmark.
- Do not recolour the branches, rotate, stretch, outline or add effects to the mark.
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
