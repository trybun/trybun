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
| Ink | `#141A2E` | Wordmark, stem, dark backgrounds |
| Vermilion | `#E0482C` | Customer branch, accents |
| White | `#FFFFFF` | Backgrounds, mark on dark backgrounds |

## Typography

- Wordmark: **Manrope ExtraBold (800)**, always lowercase: `trybun`.
- In running text the name is written **Trybun**.

## UI design tokens

**Status: proposed – requires human approval.** The tokens below are defined in [`packages/ui/src/styles/globals.css`](../../packages/ui/src/styles/globals.css) (Rule 6, [§2.6](../spec/02-agent-rules.md)); a human approves the final values in the S0-07 pull request.

The brand colours above are not a complete UI palette. The UI uses the token set of shadcn/ui, derived from the brand as follows; Tailwind's default colour palette is not available:

- **Ink** is the primary colour (`--primary`), and the base of the neutral scale: backgrounds, borders and muted text are mixes of Ink and White (in sRGB).
- **Vermilion** is an **accent only** (highlights, the customer side of the mark, the focus ring). It is not used for body text: white on `#E0482C` is about 4.1:1, below WCAG AA. For text and small elements on White the darker `#B8341C` (5.9:1) is used.
- **Semantic colours** (success, warning, danger, info) use the 700 shades of the Tailwind palette in the light theme and the 400 shades in the dark theme, as solid backgrounds with White or Ink text. They are always combined with an icon or text ([§13.4](../spec/13-non-functional.md)).

| Token | Light | Dark | Contrast |
|---|---|---|---|
| `--background` | White `#FFFFFF` | Ink `#141A2E` | |
| `--foreground` | Ink | White | 17.3:1 |
| `--card`, `--popover` | White | `#22283B` (White 6 % on Ink) | |
| `--primary` / `--primary-foreground` | Ink / White | White / Ink | 17.3:1 |
| `--secondary`, `--muted`, `--accent` | `#F3F4F5` (Ink 5 %) | `#303547` (White 12 %) | text: 15.6:1 / 12.1:1 |
| `--muted-foreground` | `#5A5F6D` (Ink 70 %) | `#ADAFB6` (White 65 %) | on `--background` 6.4:1 / 7.9:1, on `--muted` 5.8:1 / 5.5:1 |
| `--destructive` / `-foreground` | red-700 `#C10007` / White | red-400 `#FF6467` / Ink | 6.6:1 / 6.0:1 |
| `--success` / `-foreground` | green-700 `#008236` / White | green-400 `#05DF72` / Ink | 5.0:1 / 9.7:1 |
| `--warning` / `-foreground` | amber-700 `#BB4D00` / White | amber-400 `#FFB900` / Ink | 5.1:1 / 10.0:1 |
| `--info` / `-foreground` | blue-700 `#1447E6` / White | blue-400 `#51A2FF` / Ink | 6.8:1 / 6.6:1 |
| `--border` | `#E3E4E6` (Ink 12 %) | `#373C4D` (White 15 %) | decorative |
| `--input` | `#8A8C96` (Ink 50 %) | `#727682` (White 40 %) | boundary of form fields, 3.3:1 / 3.8:1 (WCAG 1.4.11) |
| `--ring` | Vermilion text `#B8341C` | Vermilion `#E0482C` | focus ring on `--background` 5.9:1 / 4.2:1 |
| `--overlay` | Ink 40 % | Black 60 % | backdrop of dialogs and sheets |
| `--brand-accent` | Vermilion `#E0482C` | Vermilion `#E0482C` | not for text |
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
