# Design-system foundations – practice and inventory

- **Date:** 2026-11-28
- **Kind:** practice review and code inventory (desk research by AI agents, with small own tests).
- **Method:**
  - **Primary sources:** standards (WCAG 2.2, WCAG 3.0 draft, Media Queries 4 and 5, W3C DTCG 2025.10, BSR/HFES 100-2026 draft), official design-system docs, product docs and issue trackers, peer-reviewed studies.
  - **Token packages with versions:** downloaded with `npm pack --ignore-scripts`, never installed or run. Versions are in the source table below.
  - **Code at commits:** Plane's `makeplane/plane` at `723bb178` (branch `preview`) and Propel's published source maps; Trybun at `da23a6bb`.
  - **Criticism searched on purpose:** issue trackers, forums, practitioner write-ups, studies.
  - **Own scripts, not in the repository:** OKLCH to hex and WCAG 2 contrast, font metrics from TTF tables, x-height visual angle, a `className` tokenizer and a JSX-shape fingerprint over Trybun's source.
- **Reliability:** items marked **(u)** were seen only in search summaries or were not confirmed at an official source. Contrast ratios and hex values of Plane's OKLCH tokens are own calculations, not quoted from Plane.
- **Purpose:** input for the design-system change specifications in the Plane direction (foundations first, then layout and UX patterns). This is not a requirement; scope changes go through a change specification (Rule 8, [§2.8](../../../docs/spec/02-agent-rules.md)).
- **Licence note:** Plane's `@makeplane/propel` is AGPL-3.0-only (checked in its `package.json`). Trybun is MIT. This note quotes values only for comparison; it proposes that Trybun takes principles and derives its own values, and leaves verbatim reuse as a licensing question for the change specifications.

## Sources

| Code | Source | Version / commit |
|---|---|---|
| Propel tokens | npm `@makeplane/propel`, `dist/styles/variables.css` (1,900 lines) | 0.9.11; 0.9.7, pinned by Plane's catalog, has a byte-identical `variables.css` |
| Propel source | original TypeScript from `sourcesContent` of the published `*.js.map` (e.g. `src/internal/control-chrome.ts`, `src/elements/table/variants.ts`); the GitHub repo `makeplane/propel` returns 404 | 0.9.11 |
| Propel docs | propel.plane.so `/foundations/{color,typography,elevation,borders,sizing,iconography}` | fetched 2026-11-28 |
| Plane app | `makeplane/plane`: `packages/tailwind-config/{index.css,AGENTS.md}`, `packages/constants/src/*`, `apps/web/components/{sidebar,navigation,issues}/*` | `723bb178`, branch `preview` |
| Plane history | PR #8220 "new design system" (merged 2025-12-12); PR #9682 "Adopt @makeplane/propel as the design token source" (merged 2026-08-25); blog "Propel" (2026-10-19); changelog 2026-09-30 | – |
| Other systems | `@radix-ui/colors` 3.0.0, `@radix-ui/themes` 3.3.0, `tailwindcss` 4.3.5, `@primer/primitives` 11.10.0, `@atlaskit/tokens` 20.15.0, `@atlaskit/button` 25.8.3, `@atlaskit/navigation-system` 12.1.3, `@fluentui/tokens` 1.0.0-alpha.25, `@carbon/themes` 11.86.0, `@carbon/type` 11.71.0, `@carbon/layout` 11.63.0, `@shopify/polaris-tokens` 9.4.2, `lucide` 1.83.0 | npm |
| Other code | material-color-utilities `0f07b68`; material-web tokens "Version 34.0.21"; shadcn-ui/ui `0e5b2e6`; primer/react `usePaneWidth.ts` (main, 2026-11); google/fonts `5026800` | GitHub |
| Trybun | [`packages/ui/src/styles/globals.css`](../../../packages/ui/src/styles/globals.css), `packages/ui/src/components/*`, `apps/web/src/**` (excluding stories, specs and tests) | `da23a6bb` |

## 1. Foundations – neutrals

| System | Approach and key values | Steps | Source |
|---|---|---|---|
| Plane | Light: 100 `#fcfcfc`, 300 `#f2f2f3`, 400 `#eaebec`, 500 `#e1e2e3`, 600 `#d5d7d9`, 700 `#cacdcf`, then a jump to 800 `#767c7f` (4.24:1 on white), 900 `#5d6265` (6.17), 1000 `#494d50` (8.54), 1100 `#313435` (12.55), 1200 `#0f0f10` (19.16). Dark re-values the same names: black canvas `#0f0f10`, 100 `#141415`, 800 `#7a8185` (4.66 on 100), 1200 `#e4e6e7` (14.69). Hue about 219–286, chroma 0.002–0.0096; lightest light steps C = 0 | 14 (`white`, 100–1200, `black`) | `@makeplane/propel@0.9.11` `dist/styles/variables.css` l. 153–168, 467–486 |
| Radix Colors | Pure `gray` plus tinted mauve, slate, sage, olive, sand. sage-12 `#1a211e` = oklch(0.240 0.012 168) | 12 with a role each | `@radix-ui/colors@3.0.0` `sage.css` |
| Radix Themes | Automatic gray per accent: teal, jade, mint, green map to `sage` | 12 | `@radix-ui/themes@3.3.0` `get-matching-gray-color.js` |
| Tailwind v4 | Pure `neutral`; tinted slate, gray, zinc, stone, and since v4.2.0 mauve, olive, mist (H about 197–229, C up to 0.021), taupe | 11 | `tailwindcss@4.3.5` `theme.css` |
| shadcn/ui | Base colours neutral, stone, zinc, mauve, olive, mist, taupe; default `neutral` | Tailwind steps | shadcn `apps/v4/registry/base-colors.ts`, `config.ts` |
| Material 3 | Neutral palettes take the seed hue at low chroma (2021 TonalSpot: neutral C 6, neutral-variant C 8) | tones 0–100 | material-color-utilities `dynamic_scheme.ts` |
| Primer | Cool blue-grey: light fg `#1f2328` (C 0.011), dark canvas `#0d1117` (C 0.014) | functional | `@primer/primitives@11.10.0` |
| Atlassian | 2024–25 refresh: "fewer blue tints"; text `#292A2E` (C 0.007) | ramps | `@atlaskit/tokens@20.15.0` |
| Fluent 2, Carbon, Polaris | Pure grey (C 0) | Fluent grey 2–98 in steps of 2; Carbon 10–100 | `@fluentui/tokens`, `@carbon/themes@11.86.0`, `@shopify/polaris-tokens@9.4.2` |
| Linear | 2026 moved from "a cool, blue-ish hue" to "a warmer gray"; no numbers | generated | linear.app/now/behind-the-latest-design-refresh |
| Trybun today | No neutral scale. Nine single hex values (four light, five dark), each an sRGB mix of Ink `#141a2e` and White. Ink = oklch(0.223 0.040 270.2); Teal `#035F5C` = oklch(0.439 0.075 191.0). 12-step scale only for Teal; steps 1–2, 4–8 and 12 unused | – | [`globals.css`](../../../packages/ui/src/styles/globals.css) l. 15–36, 85–96 |

Roles of the 12 Radix steps: 1 app background, 2 subtle background, 3 UI element, 4 hovered, 5 active or selected, 6 subtle borders, 7 interactive borders and focus rings, 8 stronger borders, 9 solid, 10 hovered solid, 11 low-contrast text, 12 high-contrast text.

Plane's text roles map to the same step names in both themes: primary 1200, secondary 1100 ("the default for most interface text"), tertiary 1000, placeholder 900, disabled 800. In the December 2025 tokens these were lighter: tertiary `#676c6f` (5.3:1), placeholder `#80868a` (3.7:1, below AA), disabled `#909598` (3.0:1). Propel darkened them; Plane published no reason, and the reading as a contrast fix is an inference (u).

- **Agreement:**
  - Every system has a neutral scale separate from the accent, and keeps the accent off large surfaces (Fluent, Apple HIG Color).
  - Where neutrals are tinted, chroma is about 0.002–0.015 OKLCH (Radix, Tailwind's newer grays, Atlassian, Primer, Plane).
  - Radix (docs and code), Material and the GitLab proposals tint toward the accent hue. For teal, Radix picks sage (H about 165–175) and the nearest Tailwind gray is mist.
- **Disagreement:**
  - Pure grey (Fluent, Carbon, Polaris, shadcn default) against light tint (Radix, Material, Primer, Linear, Atlassian, Plane). Radix itself says pure `gray` "will work well with any hue".
  - Tint toward the brand (Material, Radix, GitLab) against tint removed to reduce colour cast (Linear, Atlassian).
  - Fixed steps (Radix, Tailwind, Plane) against continuous tones (Material) or generation from inputs (Linear).
- **Criticism:**
  - Ink's chroma 0.040 is far above the darkest neutrals of every system checked (Radix sage-12 0.012, Primer 0.011–0.014, Atlassian 0.004–0.007, Tailwind mist-900 0.008); only Tailwind slate-900 (0.042) and gray-900 (0.034) come close. Its hue 270 is about 80° from Teal's 191.
  - Atlassian and Linear both removed blue tint; Linear warns that too warm looks "muddy".
  - Pro-tint sources are opinion; no controlled study of tinted against pure grey was found.

## 2. Surfaces, borders, shadows (incl. dark)

| Plane token | Light | Dark | Rule |
|---|---|---|---|
| `bg-canvas` | n-300 `#f2f2f3` | n-black `#0f0f10` | once, on `<body>`; top bar and app rail sit on it |
| `bg-surface-1` | white | n-100 `#141415` | pages, sidebar, main panel, modals, tables |
| `bg-surface-2` | n-100 `#fcfcfc` | n-200 `#181a1b` | sibling surface, never nested in surface-1 |
| `bg-layer-1` / hover / active / selected | n-200 / 300 / 400 / 400 | n-200 / 300 / 400 / 400 | cards, group headers, table header, menu popup |
| `bg-layer-2` / states | white / 100 / 200 / 200 | n-300 / 400 / 500 / 500 | inputs, secondary buttons, tooltips, Kanban cards |
| `bg-layer-3` / states | n-300 / 400 / 500 / 500 | n-400 / 500 / 600 / 600 | tertiary button, neutral badge, tab track |
| `bg-layer-transparent` hover / active / selected | black 4 % / 6 % / 8 % | white 5 % / 7 % / 10 % | ghost buttons, sidebar items, menu and table rows |
| `bg-backdrop` | black 30 % | black 80 % | modal scrim |

Source: `@makeplane/propel@0.9.11` `variables.css` l. 260–283, 572–590; rules from `packages/tailwind-config/AGENTS.md` at `723bb178` ("Hover must always match the base background layer"). Light mode is not monotonic: layer-1 `#f9f9f9` is darker than surface-1 and layer-2 is white again. Dark rises monotonically (L 0.169 → 0.192 → 0.216 → 0.238 → 0.259).

| Border / shadow | Plane value and use | Source |
|---|---|---|
| `border-xs` 0.5px | no Propel component uses it; the app still uses 0.5px hairlines (`border-[0.5px]`, `border-{t,b,l,r}-[0.5px]`, `divide-*-[0.5px]`, `outline-[0.5px]`, `border-xs`) in about 50 files: spreadsheet, calendar and Gantt grids, form footers, some menus and buttons, the Kanban card outline | Propel docs borders; `variables.css` l. 926–933; `grep` of `makeplane/plane` at `723bb178` (47 files in a sparse checkout of `apps/` and `packages/`, 54 in a full one) |
| `border-sm` = `border` 1px | "Every divider, container edge, and control outline in Propel" (Propel's components) | Propel docs borders |
| `border-md` 1.5, `-lg` 2, `-xl` 2.5px | unused; 2px only for avatar rims | same |
| Border roles | subtle n-400 (1.19:1 on white), subtle-1 n-500 (1.30), strong n-600 (1.44), strong-1 n-700 (1.60); high-contrast themes re-point them to text steps 1200/1100/1000/900 | `variables.css` l. 316–319, 625–628 (light, dark), 837–914 (high contrast) |
| `shadow-raised-100/200/300` | two-layer slate `rgb(41 47 61)` at 3–6 % alpha (2–10 % across all shadows); secondary button, tab pill, dialog | `variables.css` l. 938–950 |
| `shadow-overlay-100/200` | menus and popups; popover and tooltip | same |
| Tailwind `shadow-sm…2xl` | removed (`--shadow-*: initial`) | same |

| System | Layering and dark mode | Source |
|---|---|---|
| Atlassian | sunken ("Kanban columns") < default < raised ("movable cards", with shadow) < overlay. Light surface `#FFFFFF`, sunken `#F8F8F8`; dark sunken `#18191A` < surface `#1F1F21` < raised `#242528` < overlay `#2B2C2F` | `@atlaskit/tokens@20.15.0` |
| Material 3 | tone-based containers; dark surface 6, containers 4 → 22; tinted overlay model replaced in Mar 2023 | `color_spec_2021.ts` |
| Primer | dark canvas `#0d1117`, inset and overlay `#010409` (darker, with a 1px ring); cards lighter (`muted`) | `@primer/primitives@11.10.0` |
| Carbon | light themes alternate white and grey per layer; dark g100 `#161616` → `#262626` → `#393939` → `#525252` | `@carbon/themes@11.86.0` |
| shadcn v4 | light background, card, popover `oklch(1 0 0)`, sidebar 0.985; dark background 0.145, card and popover 0.205, border white 10 % | shadcn `registry/themes.ts` |
| Trybun today | light `--background` = `--card` = `--popover` = `#ffffff`; dark `#141a2e`, card and popover `#22283b`; header, side nav and page on the same `--background`; no sidebar token. Popups use `ring-foreground/10` + `shadow-md`; shadows are Tailwind black `rgb(0 0 0 / 0.05–0.1)`; dialogs and drawers have none | [`globals.css`](../../../packages/ui/src/styles/globals.css) l. 39–134 |

- **Agreement:**
  - Dark mode: higher is lighter (Material, Atlassian, Carbon, Fluent, Radix Themes, shadcn; Apple in prose). No system uses pure black as the main dark canvas.
  - Light mode: raised surfaces stay white with a shadow; recessed areas get a slightly darker neutral (Atlassian, Primer, Polaris, Fluent).
  - A 1px border is the main separator; shadows are for real overlays. Plane: "A shadow alone does not separate a floating layer from the page"; Atlassian: flat cards and sunken areas use borders or whitespace. Primer, Atlassian and shadcn add a 1px ring to floating shadows.
  - The sidebar is a neutral step away from content and never brand-coloured (Atlassian and Material (u)).
- **Disagreement:**
  - Primer's dark overlays are darker than the canvas.
  - Carbon alternates light layers.
  - Material dropped shadows for tone; Atlassian, Primer, Fluent and Plane keep them. Plane's docs say its shadows stop contributing in dark.
  - Linear and Polaris mobile reduce borders and shadows.
- **Criticism:**
  - makeplane/plane#9095 (2026-05-16, open): popup menus blend into the page behind them, citing WCAG 1.4.11; `border-subtle` on white is 1.19:1.
  - makeplane/plane#9182 (close button contrast) and #6827 (2025, card text contrast, "a `background-color` instead of a `border`").
  - Plane's docs say `shadow-direction-right` in black ink "reads as an inconsistency".
  - MDC Android: "Shadows are less effective in an app using a dark theme".

## 3. Typography and fonts

| System | Base UI text | Scale and notes | Source |
|---|---|---|---|
| Plane | docs: body-sm 14/1.54 "Reach here first"; code: dense UI at body-xs 13 (md buttons, menu rows, table cells, md inputs, list rows, Kanban cards) | h1 32, h2 28, h3 24, h4 20, h5 18 (dialog title `h5-medium`), h6 16; body 16/14/13/12 at 1.54; captions 12/11/10/9/8. Weights 350/450/500/600/700/800, regular 450 because "Inter Variable reads slightly light at 400". 57 composite `text-<step>-<weight>` styles; Tailwind sizes removed; lint `propel/no-raw-font-size` | `variables.css` l. 1379–1717; Propel docs typography |
| Primer | 14 | 12/14/16/20/32/40; body-medium 14/1.5, body-large 16 for user content | `@primer/primitives@11.10.0` |
| Atlassian | 14/20 | headings weight 653; smallest size raised from 11 to 12 | `@atlaskit/tokens@20.15.0` |
| Material 3 | body-medium 14/20 | tracking +0.25px | material-web `_md-sys-typescale.scss` |
| Fluent 2 | 14/20 | 10 … 68 | `@fluentui/tokens` |
| Carbon | productive 14, expressive 16 | body-compact-01 14/18 | `@carbon/type@11.71.0` |
| Polaris | 13/20 desktop, 16/24 mobile theme | Inter | `@shopify/polaris-tokens@9.4.2` |
| Apple | macOS 13 pt (min 10); iOS 17 pt (min 11) | – | HIG Typography JSON |
| Linear | 13 (u); Inter Display for headings | – | linear.app blog |
| Trybun today | body inherits 16/24 (Preflight); UI text `text-sm` 14/20 (157 base uses); form fields 16 below `xl` or with a coarse pointer, 14 on `xl:pointer-fine:` | Tailwind default scale; h1 `text-2xl font-bold` 23×; h2 `text-lg font-semibold` 18× or `text-xl font-bold`; h3 in five styles; one tracking class; no named styles; no `tabular-nums` | [`globals.css`](../../../packages/ui/src/styles/globals.css) l. 173–174, 229–231; inventory counts |

Fonts: Plane uses `"Inter Variable"` for body and heading (Fontsource 5.2.8) and `"IBM Plex Mono"` for code (5.2.7), with `font-variant-ligatures: none` and antialiasing. Trybun uses Manrope through `next/font/google` (variable, `latin` preloaded) with `--font-heading` = sans and Tailwind's system mono. Weights in use 400/500/600/700/800 on an axis of 200–800; no italic face, so hljs comments are synthesized italic.

| Font (own test on google/fonts@5026800) | x-height / em | px at 13 / 14 / 16 | Axes | Features |
|---|---|---|---|---|
| Inter | 0.546 | 7.10 / 7.64 / 8.73 | opsz 14–32, wght 100–900 | tnum, zero, cv01, ss01, ss02, case, calt |
| Manrope | 0.540 | 7.02 / 7.56 / 8.64 | wght 200–800 | tnum, case, calt, pnum, frac; no ss/cv sets for I/l/1 |
| Geist | 0.530 | 6.89 / 7.42 / 8.48 | wght 100–900 | tnum, ss01, ss02, case |
| Noto Sans | 0.536 | 6.97 / 7.50 / 8.58 | wdth, wght | tnum, zero, case |
| IBM Plex Sans | 0.516 | 6.71 / 7.22 / 8.26 | wdth, wght 100–700 | zero, ss01/02; figures tabular by default not verified (u) |

Inter's dynamic-metrics formula gives tracking +0.0005em at 12px, −0.006 at 14, −0.011 at 16, −0.022 at 32; Inter 4's `opsz` axis covers most of it. Plane keeps tracking at 0 except +0.01em at 10 and 9px.

Own x-height visual-angle calculation (assumed x-height 0.546 em; critical print size 0.2° = 12 arcmin, Legge & Bigelow 2011):

| Setup | 13 px | 14 px | 16 px | 19 px |
|---|---|---|---|---|
| 24" FHD 100 %, 65 cm | 10.4' | 11.2' | 12.8' | 15.2' |
| 27" QHD 100 %, 70 cm | 8.1' | 8.8' | 10.0' | 11.9' |
| MacBook Pro 14 default, 50 cm | 9.8' | 10.5' | 12.0' | 14.3' |
| Phone 390 CSS px, 30 cm | 13.2' | 14.3' | 16.3' | 19.4' |

- **Agreement:**
  - 14px is the dominant base UI size (Primer, Atlassian, Material, Fluent, Carbon productive, Tailwind and shadcn `text-sm`); 16px for reading content; 12px the floor (Atlassian raised 11 to 12).
  - Named role-based text styles instead of raw sizes (Primer, Atlassian, Material, Carbon, Polaris, Plane).
  - Two sizes for two kinds of text, compact UI and long-form (Carbon, Primer, Plane body-md for prose at 65–75ch).
- **Disagreement:**
  - 13 against 14: Polaris desktop, macOS, Linear (u) and Plane's code use 13; Plane's docs and most token systems use 14. No controlled study of 13 against 14 was found.
  - Responsive type: Polaris and shadcn inputs switch to 16 on small screens; Primer and Atlassian keep one size.
  - Tracking sign at small sizes depends on the typeface.
- **Criticism:**
  - Inter "visual sameness" comes mostly from font vendors with commercial interest; no usage data.
  - Plane PR #9682 flags clipping risk in fixed-height rows from body line-height 1.4 → 1.54 and regular weight 400 → 450, across 206 `text-body-*`/`text-caption-*` call sites.
  - Evidence (03): 13px sits below the critical print size on most desktop setups; GOV.UK removed its 14 step (Owen Jones, GDS, 2022-12-12) without user-test data; Rello et al. 2016 found gains up to 18 pt (u).
  - Trybun's `cn` treats an unknown `text-*` as a colour, so custom size tokens need `createCn` ([`.ai/memory/shadcn.md`](../../memory/shadcn.md) l. 18).

## 4. Radii

| System | Scale (px) | Role mapping | Source |
|---|---|---|---|
| Plane | xs 2, sm 4, md 6, lg 8, xl 12, 2xl 16, 3xl 20 (4xl removed) | 6 "the control radius… most-used"; 8 "the container radius" (popups, tables, Kanban cards, toasts); 12 dialog and popover; control radius 4 at 20px, 6 at 24–32, 8 at 36–40 | `variables.css` l. 923–925; Propel docs borders |
| Atlassian | 2, 4, 6, 8, 12, 16, full | 6 buttons, inputs, nav items; 8 cards, menus; 12 modals, Kanban columns, tables | `@atlaskit/tokens@20.15.0` `atlassian-shape.js` |
| Primer | 3, 6 (default), 12, full | default = medium | `@primer/primitives@11.10.0` |
| Radix Themes | 3/4/6/8/12/16 × `--radius-factor` | menu content r3, items r1 | `@radix-ui/themes@3.3.0` |
| Material 3 | 0, 4, 8, 12, 16, 20, 28, 32, 48, full | filled button pill, dialog 28 | material-web `_md-sys-shape.scss` |
| shadcn v4 | `--radius` 10 × 0.6/0.8/1/1.4/1.8/2.2/2.6 | Nova: buttons and inputs 10, card 14 | shadcn `theming.mdx`, `style-nova.css` |
| Trybun today | `--radius` 10: sm 6, md 8, lg 10, xl 14, 2xl 18, 3xl 22, 4xl 26; `--radius-xs` 2 (Tailwind, not derived) | Button, Input, popups, every web card `rounded-lg` 10; items `rounded-md` 8; Dialog and Drawer 14; Toast 18; Badge 26 (pill) | [`globals.css`](../../../packages/ui/src/styles/globals.css) l. 80, 176–182 |

- **Agreement:** radius grows with the size of the thing; product systems put controls at 4–6px and containers at 8–12px; "a container sits one step rounder than the controls inside it" (Plane). Nested radius = outer − (padding + border), clamped at 0 (Cloud Four, CSS-Tricks, Frontend Masters; Radix in code).
- **Disagreement:** Material's large radii and shadcn's 10px controls against Atlassian, Primer and Plane at 6px; shadcn derives by multiplication.
- **Criticism:** strict subtraction can look optically off; with small outer radii and normal padding the inner radius becomes 0. In Trybun cards and controls share 10px, so there is no step between container and control.

## 5. Density, sizing, icons

| Plane rung | Height | Button side padding | Gap | Glyph | Radius | Text |
|---|---|---|---|---|---|---|
| xs | 20 | 6 | 4 | 14 | 4 | 12 |
| sm | 24 | 8 | 4 | 14 | 6 | 13 |
| md (anchor) | 28 | 10 | 6 | 16 | 6 | 13 |
| lg | 32 | 12 | 6 | 16 | 6 | 14 |
| xl | 36 | 14 | 6 | 16 | 8 | 14 |
| 2xl | 40 | 16 | 8 | 20 | 8 | 16 |

Source: `variables.css` l. 958–998; Propel docs sizing ("one label means one height on every component"). `xs` controls get an invisible `::before` to reach 24px (WCAG 2.5.8).

| Element | Plane | Other systems | Trybun today |
|---|---|---|---|
| Default control | md 28 | Primer 32, Atlassian 32, Radix 32, shadcn Nova 32, Mira 28, Material 40, Carbon fields 40 (u) | Button `h-11` 44 on touch, `h-8` 32 on `xl:pointer-fine:` |
| Menu row | 32 | – | `min-h-11` touch, `min-h-7` 28 desktop |
| Table / list row | 44 ("design confirmed 44px", 2026-09-11) | Carbon 24–64 (default 40); Radix 36/44/48; MDC 52 | head `h-10` 40, cell `p-2` (about 36) |
| Sidebar item | 32 | shadcn 32 | `min-h-11` touch, `min-h-9` 36 desktop |
| Sidebar width | 250, resizable 236–350, collapse to `w-0` with hover peek | shadcn 256; Primer 256/296/320; Atlassian 320 (min 240) | 64 collapsed / 240 expanded |
| Header | top bar `min-h-10` 40; `--height-header` 52 | – | 56 |
| Page padding | `--padding-page` 1.35rem (21.6px) | – | `px-4` → `md:px-6` |
| Spacing | Tailwind 4px | 4px everywhere | Tailwind 4px |
| Icons | own 940-icon set on 16×16, outline and filled pairs; 47 stroked glyphs at 1.25; Lucide left only in 2 places (521 files on Propel icons per GitHub code search on `preview`, not counted at `723bb178`) | Lucide 24px stroke 2 (≈1.33 at 16); Atlassian one 16px size, line 1.5 ([atlassian.design iconography](https://atlassian.design/foundations/iconography)) | Lucide default stroke 2, mostly 16px through container rules; nav 20/24 |
| Density setting | none for users; component props only (`ListItem`, `Dialog`, `Toolbar`) | Gmail, SAP Fiori Cozy/Compact (u); Primer condensed/normal/spacious tokens | binary: 44px touch below `xl` or coarse pointer, 24–36px on `xl` + fine pointer |

Trybun's E2E target check ([`apps/web/e2e/touch-targets.ts`](../../../apps/web/e2e/touch-targets.ts)) requires 44px on phone and tablet projects and 32px on desktop.

- **Agreement:** 32px is the default pointer control in most product systems (24 compact, 40 large); density is a small set of named modes; on touch the hit area grows to 44px rather than every control being redrawn (Primer `pointer: coarse` tokens, Polaris mobile theme, shadcn 16px inputs below `md`).
- **Disagreement:** Plane's 28 and Linear, Polaris and shadcn Mira are tighter; Material and Carbon roomier. Sidebar 240–320px, resizable only in Atlassian and Plane. Icon stroke 1.33 (Lucide at 16), 1.25 (Plane), 1.5 (Atlassian, per its iconography page; some products (u)).
- **Criticism:** Material's density called too low for admin apps (opinion sources). `pointer: coarse` reports only the primary pointer (Mozilla bugs 1747942, 1638556, 1949734 (u)). Material's library disables touch targets in dense mode. No direct experimental evidence that dense layouts make experts faster was found.

## 6. Colour use of the brand (selection, focus)

| Use | Plane | Trybun today |
|---|---|---|
| Brand value | light `#006399` (6.47:1 with white text); dark `#2893cc`, button label flips to near-black `text-inverse` (5.60:1; Plane's `neutral-white` `#fafafa` would be 3.28:1, pure white 3.42:1) | light Teal `#035f5c` (7.51:1); dark `#6ebfb9` with Ink text (8.07:1) |
| Policy | "the only color that means 'act here'"; "a second filled accent button on the same view is one too many" | "used rarely, as in Plane" ([`docs/brand/README.md`](../../../docs/brand/README.md), status "proposed") |
| Filled | primary button, checked checkbox/radio, switch on, slider, progress, selected calendar day, page-load bar | primary button, checked controls (`--primary`) |
| Border / text | focused field `border-accent-strong` + 20 % ring; peeked row or card border; links | focus border `border-ring`; links `--link` = brand-11 |
| Navigation selection | neutral: current sidebar item `bg-layer-transparent-active` (black 6 %) + darker text in the app; Propel's `ListItem` uses `-selected` (8 %) | current side-nav item `bg-muted text-foreground` |
| Table selection | neutral `layer-transparent-selected` (8 %) | `--selected` = brand-3 `#def4f2` (1.15:1 vs background, so a second cue is required) |
| Tabs | underline: 3px `bg-inverse` bar (black in light); contained: `bg-layer-2` pill | active tab `border-b-2` in `--primary` |
| Menu highlight | `layer-transparent-hover` (4 %) | `bg-accent` = muted |
| Bulk-selected rows | `bg-accent-primary/5`, hover `/10` | `bg-selected` |
| Status | success, warning, danger, info each with fill, subtle fill, text, border; "Reserve them for state" | solid fills only (Tailwind 700 light / 400 dark); no subtle status backgrounds except ad-hoc `bg-warning/10` notes |
| Priority, states, labels | own priority tokens per theme; fixed state colours; 8 label hues, user-picked label hex; orange 3.00:1 and pink 4.04:1 below AA on their tint (Plane docs) | team `StatusBadge` one grey for all statuses; portal `PublicStatusBadge` colour + icon |

Sources: Propel docs color; Propel source (`control-chrome`, `list/variants.ts`, `tabs`, `table`); `apps/web/components/issues/issue-layouts/list/block.tsx` l. 197 at `723bb178`; Trybun [`globals.css`](../../../packages/ui/src/styles/globals.css) l. 46–79.

**Tension.** The approved teal specification ([`../implemented/2026-11-27-brand-teal-palette.md`](../implemented/2026-11-27-brand-teal-palette.md), question 6) answered "**yes, Teal**" for selected states: the active tab underline, checked Switch, Radio and Checkbox, the combobox check, checked field labels and the selected list row. Plane's docs say the accent marks "the current selection", but Plane's code keeps navigation, table and tab selection neutral and uses the accent for checked controls, form focus, the peeked item and a 5 % tint on bulk-selected rows. So the two agree on checked controls and disagree on tab underline and row selection.

- **Agreement:** the accent is rare and marks action and focus (Plane, Fluent, Apple); accents get lighter in dark mode and a dark label may be needed (Plane, Material 40 → 80, Atlassian `#1868DB` → `#669DF1`); Trybun already does this for Teal.
- **Disagreement:** whether selection is accent (Plane docs, the Trybun spec answer) or neutral (Plane code for navigation, tables and tabs).
- **Criticism:** a subtle tint alone does not meet WCAG 1.4.11 for a selected state; both Plane's 8 % wash and Trybun's `--selected` (1.15:1) need a second cue.

## 7. Motion and focus

| Item | Plane | Trybun today | Evidence |
|---|---|---|---|
| Tokens | none; durations in utilities | none (#530 non-goal: motion tokens) | – |
| Controls | `transition-all duration-200 ease-out`; rows `transition-colors` | `transition-colors` 10, `transition-all` 2 (Button, Badge) | NN/g: about 100 ms toggles, 200–300 ms modals, ≤ 400 ms large moves; exits shorter |
| Popups | 150 ms from `scale-95 opacity-0` | `tw-animate-css` `zoom-in-95`, `slide-in-from-*-2`, `duration-100` | – |
| Dialog / drawer / toast | dialog and drawer 200 ms, toast 0.5 s (`elements/toast/variants.ts`); sidebar 300 ms | drawer 450 ms, toast 500 ms, three arbitrary cubic-béziers | – |
| Reduced motion | global: every transition and animation to 0.01 ms, except `.animate-spin` and `[data-motion="essential"]` | honoured in four places; #530 plans one rule that keeps fades and explicitly rejects the blanket 0.01 ms reset | WCAG 2.3.3 (AAA), Media Queries 5 |
| Focus ring | `focus-visible:ring-2 ring-accent-strong ring-offset-1` (shared `controlChromeVariants`, reused across Propel's control families); fields `border-accent-strong` + `ring-2 /20`; invalid danger border + 20 % ring | §13.4: Teal `--ring` 2px; bordered = border + 1px ring, borderless = 2px ring, filled = 2px ring after a 2px gap | WCAG 2.4.13 |
| Forced colours | global `:focus-visible { outline: 2px solid CanvasText; outline-offset: -2px }` because box-shadow rings are stripped | no `forced-colors` rule in `packages/ui` or `apps/web` (checked at the PR head) | Media Queries 5 `forced-colors` |

Sources: Propel `dist/styles/{animations,reduced-motion,forced-colors}.css` 0.9.11; Trybun inventory of `packages/ui/src/components/*`; [§13.4](../../../docs/spec/13-non-functional.md).

- **Agreement:** short motion (about 100–300 ms); reduced motion removes movement; focus is a 2px ring in the action colour.
- **Disagreement:** Plane's blanket near-zero reset against #530's targeted rule that keeps fades. Plane uses a 1px ring offset; Trybun's filled controls use a 2px gap.
- **Criticism:** issue #555 lists "animations under axe" as a flaky-test class (#502 → #514), so any motion change touches it.

## 8. Token architecture

| System | Tiers | Naming | Source |
|---|---|---|---|
| Plane | primitives (neutral, brand, label hues) → semantic (`bg-*`, `txt-*`, `border-*`) → control ladder tokens (`--control-radius-*`); Tailwind v4 `@theme`, `@custom-variant`; `cva` without `tailwind-merge`, one `bg-*` per state; themes via `data-theme` (light, dark, light-contrast, dark-contrast, custom via `color-mix(in oklch, …)`) | named by job, "never for the color they happen to be" | Propel 0.9.11 |
| Primer | base → functional → component (~30 components) | `--bgColor-default`, `--control-[size]-[property]-[density]` | `@primer/primitives@11.10.0` |
| Atlassian | palette → semantic; no component tier seen | `color.background.neutral.subtle`, `elevation.surface.raised` | `@atlaskit/tokens@20.15.0` |
| Material 3 | ref → sys → comp | `md.sys.color.surface-container-high` | material-web |
| Fluent 2, Carbon | global → alias → component | `colorNeutralBackground1`, `layer-01` | packages above |
| shadcn v4 | `:root`/`.dark` semantic pairs exposed with `@theme inline` | `background` / `foreground`, `card`, `sidebar-*` | shadcn `theming.mdx` |
| W3C DTCG | Format 2025.10 (Final CG Report, 2025-10-28): `$value`, `$type`, `$description`, `$deprecated`, `$extends`; aliases `{group.token}`; colour module supports `oklch`; no tiers or naming prescribed | – | designtokens.org/tr/2025.10 |
| Trybun today | brand sources (`--deep-teal`, `--gold`, `--ink`, `--brand-1…12`) → shadcn semantic set + project additions (30 `--color-*` in `@theme inline`); Tailwind palette removed; everything else Tailwind defaults | shadcn names | [`globals.css`](../../../packages/ui/src/styles/globals.css) l. 137–183 |

- **Agreement:** two tiers are universal (primitives and semantic roles); semantic names describe role and state; light and dark are modes of one token; fg/bg pairs are explicit.
- **Disagreement:** component tokens (Primer, Material, Carbon yes; Atlassian, shadcn no); naming style (dot paths, camelCase segments, numbered layers).
- **Criticism:** component tokens add maintenance cost and are advised only where a component truly differs (practitioner blogs); an Atlassian community reply calls the Figma token setup "a nightmare". In Trybun, 47 `/NN` opacity mixes (ui 42, web 5) sit outside the contrast story test and the lint; 22 `dark:` classes in 10 components contradict §2.6 ("dark mode is implemented through the tokens"); the lint accepts every Tailwind default step and does not cover `duration-*`, `ease-*`, `opacity-*`, `z-*` or arbitrary properties other than literal colours, which it rejects anywhere in an arbitrary value, property or variable ([`packages/eslint-config/src/tailwind.js`](../../../packages/eslint-config/src/tailwind.js)).

## 9. Accessibility and UX constraints

Evidence labels: [std] standard, [data] measured data, [guide] design-system or expert guidance, [opinion].

| Constraint | Source |
|---|---|
| Reading text (descriptions, comments, portal): ≥ 16px, line-height about 1.5, measure 65–75ch (cap 80ch), not justified | Legge & Bigelow 2011 [data]; GOV.UK type scale [guide]; WCAG 1.4.8 [std]; Baymard 2022 [guide]; Rello 2016 [data] (u) |
| Dense UI text: 14px has the established precedent; 13px only for short non-essential metadata; never below 12px | Carbon productive, Material body-medium [guide]; Apple minimums [guide]; own visual-angle calculation |
| Survive 200 % text zoom and 1.4.12 overrides (line-height 1.5, letter 0.12em, word 0.16em, paragraph 2×); no clipping fixed rows; ellipsis only with a full-text reveal | WCAG 1.4.4, 1.4.12, 1.4.10 [std] |
| All informative text ≥ 4.5:1, including muted, placeholder, hover text and timestamps, on every surface and dark elevation; no rounding (4.499 fails) | WCAG 1.4.3 [std]; WebAIM Million 2026: low-contrast text on 83.9 % of home pages [data] |
| Identifying borders, focus and selected or checked indicators ≥ 3:1; a subtle tint alone is not enough; no 0.5px hairline as the only cue | WCAG 1.4.11 [std] (anti-aliasing note) |
| Low-contrast characters (below 3:1) must be larger (≥ 30 arcmin), never smaller | BSR/HFES 100-2026 draft, section 4.9.1 [std draft] |
| Disabled: WCAG exempts it; keeping it legible and preferring `aria-disabled` with an explanation is a project choice above WCAG | WCAG 1.4.3 [std]; Axess Lab 2017, Smashing 2021 [opinion] |
| WCAG 2.2 ratios are the compliance gate; APCA at most an extra design-time check (WCAG 3 draft of 2026-09-10 names no algorithm) | WCAG 3.0 WD [std draft]; w3c/wcag3#29, w3c/silver#651 |
| Density per component type, not global; not on menus, pickers, dialogs, toasts, the comment composer or the portal; dense components need stronger grouping; type scale does not shrink with density | Material 2 "Applying density" (archived 2019) [guide]; Tullis 1983 [data] (u); SAP Fiori (u) |
| Tables: sticky header; single-colour single-row striping or a row rule plus hover | Enders 2008 ×2 [data]; NN/g data tables 2022 [qualitative] |
| Hierarchy order: whitespace → alignment and type → tint → border → shadow; lists, not cards, for tickets (Kanban cards excepted) | NN/g common region 2020 [guide], cards 2016 [qualitative] |
| Interactive elements show signifiers at rest ("Flat 2.0"); weak signifiers took 22 % longer with 25 % more fixations | NN/g Moran 2017, 71 users [data] |
| Coarse pointer: every hit area ≥ 44×44 (project rule, WCAG 2.5.5); `any-pointer: coarse` preferred (own reasoning); fine pointer ≥ 24×24 | WCAG 2.5.8, 2.5.5 [std]; Apple HIG [guide]; Media Queries 4 [std] |
| Light theme default, dark a first-class option; dark grey surfaces, lighter with elevation; desaturated accents; check every token at every dark level | NN/g dark mode 2020 (review incl. Piepenbrock 2013) [guide]; Material 2 dark theme [guide] |
| Motion about 100–300 ms; reduced motion replaces movement; no autoplay; reduce translucency under `prefers-reduced-transparency` | WCAG 2.3.3, 2.2.2 [std]; Media Queries 5 [std]; NN/g 2020 [guide] |
| Aesthetics is a real but modest quality attribute (g = 0.29, high heterogeneity) and never justifies trading contrast, size or signifiers; prototypical, low-complexity look | Schlamann et al. 2026 meta-analysis [data]; Tuch et al. 2012 ×2 [data] (u); NN/g 2024 [guide] |
| Single-character shortcuts can be turned off or remapped, or are active only on focus | WCAG 2.1.4 [std] |
| Every drag has a non-drag alternative | WCAG 2.5.7 [std]; [§13.4](../../../docs/spec/13-non-functional.md) |

- **Disagreement:** desktop native defaults (macOS 13pt) and dense tools at 13–14px against reading guidance of 16–19px; HFES minimums are stricter than almost all real UI; Beymer 2008 (u) found 12pt the best trade-off; zebra striping helped in one Enders study and not the other; long lines can be read faster while readers prefer about 55 cpl (Dyson (u)).
- **Criticism:** no peer-reviewed study of halation or astigmatism with light-on-dark text was found (u); the expert-density benefit rests on guidance, not controlled studies.

## 10. UX and layout patterns

| Pattern | Plane | Broader convention | Trybun today | Gap |
|---|---|---|---|---|
| a. App shell | top bar (workspace menu, Power K search, Inbox with unread dot, help, user menu); app rail 48 or 60px; resizable sidebar with "New work item", Home, Your work, Favorites, Projects; project tabs; breadcrumbs; on phones a drawer, criticised (#8371, #3282) | Linear, Jira, GitHub: one header with search, create, notifications and account (GitHub header icons (u)); left navigation; favourites; native apps use bottom tab bars | sticky 56px header with New ticket, help, user menu; `search` and `notifications` slots empty; side nav from 768px (64/240); bottom navigation on phones; Home empty | no header search, no notifications, no breadcrumbs, no favourites or project tree, no project tabs; bottom nav on phones is ahead |
| b. View header | layout switcher; filter row with field → operator → value chips, Clear all, Save view; Display menu (group, sub-group, order, properties, empty groups) | Linear same with personal defaults; GitHub views as tabs with an unsaved dot; Jira columns and JQL | predefined views as tabs from 768px (select on phones); Add filter + chips "is" only; filters in the URL; column sort | no layout switcher (needs Kanban), no Display menu or grouping, no operators, no count; personal saved views specified, not built |
| c. List | 44px rows: ID, title, inline-editable property chips with "+N" overflow; groups; quick add; checkbox only on hover; bulk ops paid; no keyboard row navigation (#9036); row is an `<a>` with dropdowns inside | Linear J/K, X, Shift ranges, bottom bulk bar; Jira checkboxes and J/K; GitHub arrows and Shift+Space; list with chips and table with headers are both established | table from 768px with headers (wraps at 1280px), cards on phones; visible checkboxes; free bulk bar with per-ticket results; "Show more" | no chip list layout, no inline edit, no grouping, no quick add, no keyboard navigation; ahead on visible checkboxes, free bulk and no nested interactive content |
| d. Board | columns by any group, swimlanes, collapsible columns, quick add; pragmatic-drag-and-drop without keyboard or live region; mobile opens the full page (#9990) | GitHub keyboard move and soft column limits; Linear Alt+Shift moves; Atlassian: "Always provide alternatives to dragging", a "Move to…" menu, and advises against arrow-key dragging | not built (S1-14); §8.2 specifies status columns, soft WIP, card menu alternative, one column on phones | all; no swimlanes, collapsible columns, manual order or quick add in the spec, each to be decided |
| e. Detail | peek by default (side 50 %, modal, full screen); no `role="dialog"`, no focus trap; full page with meta row and 320px sidebar of labelled rows; searchable combobox per property; S/P/A/I/L keys only in full screen (#8877) | right labelled property sidebar is universal (Jira and GitHub panels (u)); peek optional (Linear `Space`); full page default (GitHub) | full page only; Details panel from `lg` with form-style selects; bottom sheets on phones; Undo toast on field changes | no peek; form-style selects against compact rows; no sub-items or links widgets; no single-key shortcuts; ahead on undo |
| f. Comments | `INTERNAL` default, toggle hidden in the composer, switch after posting, relevant only for public boards; true internal comments requested since 2024 (#4087) | JSM "Reply to customer" and "Add internal note"; Zendesk, Freshdesk, Zammad the same; Linear synced thread | composer switch Internal note (preselected) / Public comment, audience hint, changing submit label, tinted internal notes with lock and label | at or above convention; no replies, reactions, activity filter or sort toggle |
| g. Palette and keys | Power K (`Cmd/Ctrl+K`), G/N/O sequences, single keys, `Cmd+/` sheet; no switch to turn single keys off | `Cmd/Ctrl+K` (GitHub, Linear), `?` sheet; GitHub and Jira let users disable character keys | not built (S2-05); §8.4 prescribes the palette, shortcut shown per action, ARIA combobox | G/O navigation, `?` sheet, create key, list keys and a disable setting are not specified |
| h. Feedback | empty states with illustration and CTA (filter-empty CTA still "Add work item"); per-layout skeletons; toasts without undo (#10100) | NN/g: empty states give status, cues and a direct path; skeletons for full-page loads up to about 10 s, nothing under 1 s; Linear undo; toasts with actions risk WCAG 2.2.1 and 4.1.3 (Roselli) | plain muted empty text, "Clear filters" only on the custom filter; text "Loading…" status; Undo toasts; product tours | no direct path in empty states, no skeletons, empty Home; Undo timing against 2.2.1 not verified (u) |
| i. Portal | none; Intake for guests, Intake Forms (Business), public boards, Customers (Business) | JSM, Zendesk, Freshdesk, Zammad: one create action with deflection, "My requests" with status filter and search, detail with reply and solve, email channel | project home with Create ticket and My tickets ("Awaiting your reply" first), similar tickets while typing, public statuses, resolution confirmation | no search yet (planned), no open/closed filter or search in My tickets, no organisation view; keep team density out of the portal |

Sources: Plane code at `723bb178` (paths in the cells), docs.plane.so, plane.so blog "Navigation 2.0" (2025-12-02); linear.app/docs; support.atlassian.com (navigation, list view, bulk edit, shortcuts, JSM); atlassian.design pragmatic-drag-and-drop accessibility; github/docs (keyboard shortcuts, command palette, Projects views); Zendesk, Freshdesk, Zammad help pages; NN/g (icons 2014, empty states 2021, skeletons 2023); Roselli 2020 (updated 2026-08-21); WHATWG HTML `a` content model; Trybun at `da23a6bb`.

- **Agreement:** header with search, create, notifications and account; grouped lists with a bulk bar and keyboard row navigation (Plane is the outlier); a right property sidebar with searchable pickers; an explicit internal or public choice at writing time; `Cmd/Ctrl+K`.
- **Disagreement:** peek as default (Plane) against full page with optional preview (Linear, GitHub); saved views as tabs (GitHub, Trybun) against a Views page (Plane, Linear, Jira); drag alternative by arrow keys (GitHub) against a move menu (Atlassian); whether character shortcuts can be disabled (GitHub, Jira yes; Plane no).
- **Criticism:** Plane accessibility (#1154, 2023, open: missing accessible names, heading structure); hover-only checkbox without focus reveal; icon-only chips need visible labels (NN/g 2014); JSM's own tracker JSDCLOUD-17210 (72 votes) on unclear internal/public distinction; command-palette discoverability for novices (u); Plane paywalls make the Community Edition differ from the docs. Trybun constraints that rule out copying: no hover-only interactions and 44px targets ([§2.9](../../../docs/spec/02-agent-rules.md)), never colour alone ([§13.4](../../../docs/spec/13-non-functional.md)), an app rail has no consumer in a single-product app.

## 11. Trybun today and duplication

Facts at `da23a6bb`:

- One theme file, [`globals.css`](../../../packages/ui/src/styles/globals.css) (319 lines), on shadcn `base-nova` with `baseColor: neutral` and `iconLibrary: lucide` ([`packages/ui/components.json`](../../../packages/ui/components.json)). Dark is class-based only (`@custom-variant dark (&:is(.dark *))`), maintained and tested in two story projects but never shown by the app; #531 plans its removal.
- Text levels: two (`--foreground`, `--muted-foreground` 6.4:1 on background). Disabled is `opacity-50`. Borders: `--border` `#e3e4e6` (decorative) and `--input` `#8a8c96` (3.3:1).
- No project tokens for shadows, spacing, motion, z-index, elevation, density, surfaces, sidebar, status-subtle or text tiers. [`docs/brand/README.md`](../../../docs/brand/README.md) l. 88 says type scale, spacing, radii, shadows and breakpoints are Tailwind's, and its token table is "proposed – requires human approval".
- The colour story test ([`tokens.stories.tsx`](../../../packages/ui/src/styles/tokens.stories.tsx)) checks `--primary-foreground` on `--primary` and `--primary-hover`, `--link` on `--background`, `--foreground` on `--selected` (≥ 4.5) and `--ring` on four surfaces (≥ 3). It does not check `--muted-foreground`, semantic foregrounds, `--input`, `--border` or any `/NN` mix.
- Binding rules: §2.6 (tokens once, no arbitrary values, dark through tokens, Rule 2 identical elements), §2.9 (breakpoints, 44px, 16px field text, content widths), §13.4 (focus recipe), §18.6 (shadcn first, `shadcn diff`, compact only `xl:pointer-fine:`), the ui-component skill ("A new token is a change of `docs/brand/README.md` for human approval"), and the teal specification's non-goal: neutrals, surfaces, type, radii, density, motion and statuses "follow in its own change specification".
- Open issues touching a design-system change: #530 reduced motion, #531 dark theme removal, #533 heading styles (non-goal: changing sizes), #555 animation flakiness, #553 docs-only CI path, #509 Lighthouse budget (LCP sat near budget when font preload grew, #72), #558 knowledge audit.

Duplication counts (own tokenizer, 325 files, excluding stories, specs, tests and generated code): 964 class strings (475 distinct); 62 identical groups occurring only in `apps/web` and in more than one of its files (355 occurrences; 74 groups with 516 occurrences when `@trybun/ui` is included), 24 of them with ≥ 4 utilities (65 occurrences); 73 class strings with ≥ 6 utilities written in `apps/web`; 15 repeated JSX shapes. Most frequent (exact identical strings): `text-sm text-muted-foreground` 55 / 38 files, `w-full md:w-fit` 51 / 39, `text-sm text-destructive` 22 / 21, `text-lg font-semibold` 17 / 17, `text-2xl font-bold` 17 / 16. Section 3's "h1 23×" counts h1 elements whose classes contain `text-2xl font-bold`, including longer strings.

Prioritised component candidates (order by copies × visible drift × Rule 2 impact; package per Rule 6 and §18.6):

| # | Candidate | Package | Replaces |
|---|---|---|---|
| 1 | `Item` (shadcn, adapted to tokens, 44px, link via `render`) + domain rows | `@trybun/ui` | 21 card containers, 12 class strings, danger item |
| 2 | `LoadMoreButton` + `InfiniteListState` | button `@trybun/ui`; scaffold `features/app-shell` | 15 lists, 16 buttons, 15 later-page error conditions; 5 lists without a loading state |
| 3 | `Section` (title with level, description, actions) | `@trybun/ui` | 17 sections, `OrganizationSection`, two identical `DangerAction` copies |
| 4 | `PageHeader` + `PageContainer` widths + `StandalonePage` | `@trybun/ui`; `StandalonePage` in `features/app-shell` | 13 headers, 3 identical back links, about 30 page wrappers in 5 widths, 8 standalone `<main>` |
| 5 | `Heading` (level + size) | `@trybun/ui` | 52 headings in 12 class strings, 3 local level switches |
| 6 | `Empty` (shadcn) for empty states and message pages | `@trybun/ui` | 13 empty states in 4 shapes, 7 message components |
| 7 | `FormError` + `FormActions` | `@trybun/ui` | 21 root errors, about 20 footers, 51 `w-full md:w-fit`, the `md:mt-6` alignment |
| 8 | `TicketStatusBadge`, `TicketPriorityBadge`, `UserStateBadge`, `TicketIdentifier`, `ProjectKeyBadge` | `features/tickets`, `users`, `projects` | colourless team status badge against the portal's; user state colour differs in two lists |
| 9 | `personName()` / `PersonName` / `PersonSummary` | `features/users` | 25 fallbacks in 4 wordings ("deleted user" in the team view, "unknown person" in the portal), 5 person rows |
| 10 | `DateTime` / `RelativeTime` | `features/app-shell` (or `@trybun/ui`) | 16 date renderings in 3 formats, 7 without `<time>` |
| 11 | `ConfirmDialog` moved (consider `AlertDialog`) | `@trybun/ui` | generic UI in `features/projects`, used in 12 files across 6 features |
| 12 | `UrlStateTabs` | `features/app-shell` or `lib/` | two state-tab files differing in 12 changed lines (9 hunks), all names |
| 13 | `LanguageSelect`, `TimeZonePicker` | `features/users` | Combobox in one form, Select in the other |
| 14 | `ChoiceCard` / `RadioCard` | `@trybun/ui` | 6 radio choice cards, 44px class missing in 2 |
| 15 | `TextLink` | `@trybun/ui` | 9 hand-written link styles in 5 variants, one without focus style |
| 16 | `DescriptionList` | `@trybun/ui` | 3 `<dl>` grids |
| 17 | `SearchField` (`InputGroup`) | `@trybun/ui` | 4 search fields, one with a raw `<label>` |
| 18 | `ActionsMenu` trigger | `@trybun/ui` | 2 row-action menus with different icons and labels |
| 19 | `undoToast` | `@trybun/ui` | 5 Undo toasts |
| 20 | account list on `Table` + `Item`; account filters on the faceted filter | `features/users` | raw `<table>` ignoring `Table`; a second filter pattern against §18.6 |

Optional design decisions, not code duplication: a `pending` state on `Button` (24 hand-written label ternaries), a `FormField` binding around `Controller` (16 identical `errors` expressions), shared class constants for menu items and selection controls inside `@trybun/ui` (they must keep `shadcn diff` working). A `Stack` component was not proposed for the repeated `flex flex-col gap-*` stacks.

## 12. Open questions for the specifications

Stated neutrally; the options come from the sections above. They are not recommendations.

1. **Base UI text size:** 14px (Plane docs, most token systems; section 9 puts the evidence floor here, while no controlled study compares 13 with 14) or 13px for dense rows (Plane code, Polaris desktop, macOS, Linear (u); more rows per screen); 16px for reading text in both cases.
2. **Selection colour:** Teal for selected states (the approved answer to question 6 of the teal specification) or neutral washes for navigation, tabs and rows (Plane code), with Teal kept for checked controls and focus; either way a second cue for selected rows.
3. **Typeface:** keep Manrope (x-height 0.540, `tnum`, `frac`; one family with the wordmark in Manrope ExtraBold; no change to the LCP budget of #509; no optical sizes or I/l/1 disambiguation sets) or move to Inter (0.546, `opsz` 14–32, `cv01`/`ss01`/`ss02`, `zero`; Plane's choice; a second family next to the wordmark and a font change measured against #509; criticised as ubiquitous, by font vendors).
4. **Neutral scale:** a tinted scale toward Teal's hue (Radix sage, Tailwind mist), a near-achromatic cool scale (Plane), pure grey (Fluent, Carbon, Polaris), or the current Ink mixes (C 0.040, hue 270).
5. **Regular weight:** 400 or a half-step up (Plane's 450 for Inter); depends on the typeface.
6. **Surface model:** Plane's canvas, surface and layer ladder (light not monotonic), Atlassian's sunken, default, raised, overlay, or shadcn's background, card, popover, sidebar; whether the sidebar gets its own tone.
7. **Border strength:** decorative 1px borders below 3:1 with other cues (Plane 1.19–1.30:1; a calmer look, criticised in #9095) or identifying borders at ≥ 3:1 (meet WCAG 1.4.11 on their own; heavier lines that can add visual noise); whether high-contrast themes are in scope.
8. **Radii:** keep 10px for both controls and containers, or one step apart (6 / 8 / 12 as in Plane and Atlassian).
9. **Density:** binary touch/compact by breakpoint and pointer (today), named per-component densities (Plane props, Primer), or a user density setting (Gmail, Fiori (u)); and which control height is the desktop anchor (28 or 32).
10. **Detail view:** peek panel from the list (Plane default, Linear preview) or full page only (today, GitHub); if a peek, dialog or labelled nonmodal region, and full-screen sheet on phones.
11. **Kanban keyboard alternative:** a "Move to…" menu (Atlassian, §8.2) and whether to add arrow-key moving (GitHub), which Atlassian advises against.
12. **List layout:** a chip list without headers next to the current table (Plane has both) or the table only.
13. **Motion:** tokens or none (Plane none, #530 non-goal); blanket reduced-motion reset (Plane) or targeted rule keeping fades (#530).
14. **Dark theme:** removed (#531: the app never shows it, and it costs a second set of values and story runs) or kept as a first-class option (NN/g: light reads better for most, dark expected as an option); this decides whether dark values in sections 1–2 are needed at all.
15. **Icons:** Lucide at its default stroke (1.33 at 16px), a set stroke (1.25 or 1.5), or another set; icon-size tokens.
16. **Status colours:** solid only (today) or fill, subtle fill, text and border per status (Plane); whether the team status badge gets colour and icon like the portal's.
17. **Token tiers and naming:** stay on shadcn names with additions, or adopt role-and-layer names (Plane, Primer); DTCG JSON as source or CSS only.
18. **Single-key shortcuts:** whether a user setting to disable them is specified (WCAG 2.1.4).

## 13. Side findings

- The Playwright `tablet` project uses `devices['iPad (gen 11)']` ([`apps/web/playwright.config.ts`](../../../apps/web/playwright.config.ts) l. 36–37), whose viewport is 656 × 944 CSS px (checked in `playwright-core@1.65.1`), below the 768px tablet breakpoint of [§2.9](../../../docs/spec/02-agent-rules.md). This is already known and handled: [`.ai/memory/e2e.md`](../../memory/e2e.md) (#188) records it, and the specs skip by viewport width. Screenshots named `tablet-*` therefore show the phone layout.
- The team ticket form showed a Polish description template ("## Zakres prac / ## Kryteria ukończenia") inside an English UI in the QA screenshots for PR #577. Per [§3.4](../../../docs/spec/03-ticket-model.md), until S1-17 the templates are catalogue texts (`tickets.templates.<type>` in `en.json` and `pl.json`) inserted in the language of the person creating the ticket, and a language switch while the form is open does not insert the template again. The likely cause is the account or request language of the QA session, or such a switch; it is not seed data. Not investigated further.
- Plane's docs and code disagree on tooltip colour: docs name `bg-inverse`, the shipped tooltip uses `layer-2`.

## 14. Use

- **Before new design-system research:** read this file and [`2026-11-27-open-source-competitors-and-visual-references.md`](2026-11-27-open-source-competitors-and-visual-references.md) first, and write only a dated update.
- The change specifications for foundations, then layout and UX patterns, cite the rows they rely on and record the maintainer's answers to section 12; this note stays as it is.
