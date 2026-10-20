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
