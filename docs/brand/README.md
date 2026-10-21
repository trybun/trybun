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

**Status: proposed – requires human approval.** The tokens below are the starting point for `@trybun/ui` (Rule 6, [§2.6](../spec/02-agent-rules.md)); a human approves the final values in the S0-07 pull request.

The brand colours above are not a complete UI palette. The UI uses the token set of shadcn/ui, derived from the brand as follows:

- **Ink** is the primary colour (`--primary`), and the base of the neutral scale (backgrounds, borders, muted text are tints and shades of Ink).
- **Vermilion** is an **accent only** (highlights, the customer side of the mark, focus accents). It is not used for body text: white on `#E0482C` is about 4.1:1, below WCAG AA. For text and small UI elements a darker variant is used (proposed `#B8341C`; its contrast must be verified at ≥ 4.5:1 against its background).
- **Semantic colours** (success, warning, danger, info) use the 700 shades of the Tailwind palette (green, amber, red, blue), each verified at ≥ 4.5:1 for text. They are always combined with an icon or text ([§13.4](../spec/13-non-functional.md)).

| Token | Light | Dark |
|---|---|---|
| `--background` | White | Ink |
| `--foreground` | Ink | White |
| `--card`, `--popover` | White | Ink, lightened |
| `--primary` / `--primary-foreground` | Ink / White | White / Ink |
| `--secondary`, `--muted`, `--accent` | Ink tints | Ink shades |
| `--muted-foreground` | Ink, ≥ 4.5:1 on `--background` | White, ≥ 4.5:1 on `--background` |
| `--destructive` | red-700 | red-400 |
| `--success` / `--warning` / `--info` | green-700 / amber-700 / blue-700 | green-400 / amber-400 / blue-400 |
| `--border`, `--input` | Ink tint | Ink shade |
| `--ring` | Vermilion (text variant) | Vermilion |
| `--brand-accent` | Vermilion `#E0482C` | Vermilion `#E0482C` |

**UI typeface:** Manrope (variable font, self-hosted with `next/font`), fallback `system-ui, sans-serif`. Code blocks use the system monospace stack.

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
