# Teal brand palette and a recoloured mark

| | |
|---|---|
| Status | `approved` |
| Created | 2026-11-27 |
| Plan task | – |
| System specification sections | §13.4; [`docs/brand/README.md`](../../docs/brand/README.md) (The mark, Colours, UI design tokens, Rules) |
| Related issues / PRs | #573, #572 (research), [`2026-11-01-brand-interactive-colour.md`](implemented/2026-11-01-brand-interactive-colour.md) (superseded in part) |

## Context

The maintainer wants Trybun to look modern and attractive, because buyers who compare two similar tools choose the one that looks better. On 2026-11-27 they chose the UI direction of Plane: clear, intuitive and full of conventions from other tools. They also rejected the current brand colours, because the black primary does not fit that direction.

Today the brand has three colours ([`docs/brand/README.md`](../../docs/brand/README.md)):

| Colour | Use today | Problem |
|---|---|---|
| Ink `#141A2E` | `--primary`, so every primary button is near-black; the team branch and the wordmark | reads as black; the same as the default shadcn look, Polaris, GitLab since 2026 and Frappe Helpdesk, so it does not set Trybun apart |
| Vermilion `#E0482C` | `--brand-accent`, the customer branch of the mark | 4.1° of hue from `--destructive` and only 4.09:1 with white text, so it cannot be an action colour; in the mark it is almost the red of GitLab (`#E24329`) and close to Zammad (`#E54011`) |
| Blue `#2563EB` | focus ring, links and information ([2026-11-01](implemented/2026-11-01-brand-interactive-colour.md)) | added only because Ink reads as black and Vermilion as an error; blue is the most crowded hue in the category |

Under deuteranopia, Vermilion beside green cannot be told apart (about 8 % of men of European descent).

The research of 2026-11-27 is in three notes:

- [`research/2026-11-27-category-colour-landscape.md`](research/2026-11-27-category-colour-landscape.md): 30 trackers and help desks;
- [`research/2026-11-27-brand-colour-landscape-wide.md`](research/2026-11-27-brand-colour-landscape-wide.md): 156 more vendors;
- [`research/2026-11-27-brand-colour-practice.md`](research/2026-11-27-brand-colour-practice.md): practice and accessibility.

The main findings:

- **Category:** blue and indigo/violet are crowded. Teal is rare: 7 of 169 logos and 5 of 51 action colours, and no help-desk or ITSM logo uses it (one ITSM product, Halo, has a teal button on its marketing site).
- **Practice:** Plane, Atlassian, Carbon, Stripe and Material 3 use one brand hue as a rare action colour and keep everything else neutral.

The maintainer chose the teal hue from four candidates on mock-ups. The wide survey then showed close neighbours of the first values: `#017272` is near WeKan and Odoo, and `#023237` is near Zendesk Kale. The values below are moved away from them. After comparing four ambers and three golds on large graphics, the maintainer chose light gold for the customer branch. On 2026-11-01 teal (`#0F766E`) was variant B for the focus colour and was not chosen; this time teal becomes the brand colour as a whole.

## Goals

- **One brand colour for action and interaction:** primary button, focus ring, links and selection. It must be distinct from danger, success, warning and information, and reach at least 4.5:1 for text and 3:1 for non-text in both themes.
- **A mark that keeps its shape and meaning** (team branch, customer branch) in new colours, visible on light and dark backgrounds and at 16 px.
- **Gold is a brand accent only:** the mark, the sign-in brand panel, empty-state illustrations, e-mails and other materials. Never text, buttons or statuses: it is 4° of hue and 1.26:1 from the dark-theme warning `#FFB900`.

## Non-goals

- **The rest of the design system in the direction of Plane:** neutrals and surface layers, type, radii, density, motion and statuses. It follows in its own change specification. Until then Ink stays the base of the neutral scale, the dark background and the text colour.
- **Branding the Keycloak sign-in pages.** How to theme them (CSS over `keycloak.v2`, FreeMarker templates or Keycloakify) needs its own research and specification. The colours here are what it will use.
- **The semantic colours.** Danger, success and warning stay as they are. `--info` keeps its own blue.
- **The shape of the mark and the wordmark typeface** (Manrope ExtraBold).
- **Deliberate uses of old colours**, which stay:
  - the `bg-[#E0482C]` examples in [§2.6](../../docs/spec/02-agent-rules.md), in the lint tests and the test fixture `globals.css` of `@trybun/eslint-config` and in the comment of its `tailwind.js`, which show a forbidden arbitrary value;
  - the `text-brand-accent` strings in the unit tests of `@trybun/eslint-config` (`configs.spec.js`) and `@trybun/ui` (`utils.spec.ts`), which test class merging, not product use;
  - test data with fixed colours: the button in `apps/web/e2e/accessibility.spec.ts` and the sample image in `attachment-list.stories.tsx`;
  - the implemented specifications, research notes, run logs and mock-ups (for example `.ai/specs/assets/rate-limited-sign-out/`), which record history.

## Proposed change

### Brand colours

| Name | Hex | OKLCH | Use |
|---|---|---|---|
| Teal | `#035F5C` | L 0.44 C 0.075 H 191 | action and interaction colour in the UI; 7.51:1 with white text |
| Deep Teal | `#071F20` | L 0.22 C 0.03 H 199 | team branch, crossbar and wordmark of the mark; brand surfaces: sign-in panel, e-mail header, social preview |
| Gold | `#DCA81C` | L 0.76 C 0.15 H 85 | customer branch of the mark; brand accent only |
| White | `#FFFFFF` | | backgrounds; the team branch and crossbar of the mark on dark backgrounds |

Nearest colours among 324 product colours of the wide survey (ΔE OK; 0.02 is the just-noticeable difference of CSS Color 4; full table in section 3 of [`research/2026-11-27-brand-colour-landscape-wide.md`](research/2026-11-27-brand-colour-landscape-wide.md)):

| Colour | Nearest overall | Nearest in the direct category (help desks, trackers) |
|---|---|---|
| Teal | ZnanyLekarz `#006A59` 0.038 (marketing site, another field) | Redmine 0.077, Freshdesk 0.079, WeKan `#007289` 0.083; Odoo `#017E84` 0.103 |
| Deep Teal | near-blacks from 0.022 (Zammad marketing CTA `#0E1E29`); C 0.030, so a near-neutral | the same near-blacks; Zendesk Kale `#03363D` 0.087 |
| Gold | amber and orange secondary logo colours 0.050–0.066 (Zammad `#F39804`, GitLab `#FCA326`, Hiver, Zoho, Libredesk) | the same; the nearest button is Zammad's yellow marketing CTA `#F6BA08` (0.064) |

Recognition comes from Teal and Gold; Deep Teal is a dark surface colour, close to other near-blacks by nature.

### The mark

| Version | Team branch and crossbar | Customer branch | Contrast of the branches | Branch against the background |
|---|---|---|---|---|
| on light backgrounds | Deep Teal | Gold | 7.88:1 (deuteranopia 8.43, protanopia 7.04) | Deep Teal 17.13:1, Gold 2.17:1 on white |
| on dark backgrounds (Ink, Deep Teal) | White | Gold | 2.17:1 | Gold 7.94:1 on Ink, 7.88:1 on Deep Teal |
| one colour | Deep Teal, or White on dark | same | – | – |

Gold has 2.17:1 on white (2.06:1 under deuteranopia), and differs from a white team branch by 2.17:1. WCAG 1.4.11 does not apply to logos. The maintainer accepted these values after examples at 16, 24 and 56 px, under simulated deuteranopia and in greyscale. The research proposed at least 3:1 here, and this specification records the exception on purpose. The meaning "team – customers" is also carried by the shape: the left and right branches.

Every file in [`docs/brand/`](../../docs/brand/README.md) is regenerated in the new colours with the same geometry:

- the icons: primary, on dark, one-colour dark and one-colour white;
- the logos with the wordmark, light and dark;
- the PNG icon and avatar (512 px), the social preview (1280 × 640) and the favicon (16/32/48 px);
- the copies in the web application: `apps/web/src/app/icon.svg`, `favicon.ico`, `apple-icon.png` and `apps/web/public/icons/` (SVG, 192 and 512 px).

The favicon is checked at 16 px on a light and a dark browser tab. If the Gold branch is too faint on a light tab, a small version uses a darker gold for the branch. On a dark tab the Deep Teal crossbar and branch are faint (1.06–1.42:1 against `#202124` and `#35363A`, the dark tab colours assumed for Chrome (u); Ink today is no better). A single `favicon.ico` cannot change with the browser theme, so the existing SVG favicon of the web application (`apps/web/src/app/icon.svg`) gets a `prefers-color-scheme: dark` rule that switches to the dark-background version, with the ICO as fallback, as described by Sitnik (Evil Martians, "How to Favicon", cited in the practice research). Browser support was checked in the implementation: Chromium switches the SVG favicon; Safari 26 shows SVG favicons but ignores the rule and shows the light version ([WebKit bug 309949](https://bugs.webkit.org/show_bug.cgi?id=309949)). The small version gets no light outline: Safari takes the SVG, not the ICO, so an outline in the ICO would not reach it, and an outline in the SVG shows as a white halo on every light tab and breaks the rule against outlines (maintainer, 2026-11-28). A custom tiny version is what Sitnik recommends for a blurry 16 px icon; GitLab and Firefox keep several variants of their icon (practice research). The rule "Do not recolour the branches" stays and refers to the new colours.

The GitHub organization avatar and the repository social preview are uploaded by the maintainer, because agents never change settings.

### UI tokens

The brand scale has 12 steps in OKLCH (H about 190; step 1 of the light scale is H 197 because its chroma is near zero) with the roles of Radix Colors: 1–2 backgrounds, 3–5 component backgrounds, 6–8 borders, 9 the solid fill, 10 hover, 11 text, 12 strong text. In the light theme step 11 equals step 9 on purpose: the fill already reaches 7.51:1 as text.

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Light | `#F7FDFD` | `#EFF9F8` | `#DEF4F2` | `#D1EDEB` | `#C1E5E2` | `#B0D9D6` | `#98C9C5` | `#74B2AD` | `#035F5C` | `#01504D` | `#035F5C` | `#022D2B` |
| Dark | `#091413` | `#0D1B1A` | `#0D2725` | `#0C2F2D` | `#103735` | `#174340` | `#1F5451` | `#316F6B` | `#6EBFB9` | `#82CEC8` | `#8CD4CE` | `#D4F3F0` |

| Token | Light | Dark | Contrast |
|---|---|---|---|
| `--brand-1` … `--brand-12` | the scale | the scale | |
| `--primary` / `--primary-foreground` | step 9 / White | step 9 / Ink (question 7) | 7.51:1 / 8.07:1 |
| `--primary-hover` (new; replaces `hover:bg-primary/80` in Button and Badge) | step 10 | step 10 | 9.31:1 with White / 9.54:1 with Ink |
| `--ring` | step 9 | step 9 | light: 7.51:1 on `--background`, `--card`, `--popover`; 6.82:1 on `--muted`. Dark: 8.07:1 on `--background`, 6.84:1 on `--card` and `--popover`, 5.69:1 on `--muted` |
| `--link` | step 11 | step 11 | 7.51:1 / 10.21:1 on `--background`, still underlined |
| `--selected` (new) | step 3 | step 3 | with `--foreground`: 15.06:1 / 15.74:1; against `--background` only 1.15:1, so a selected row also has a second indicator (a check, a bar or bold text), as `bg-muted` needs today |
| `--info` | `#2563EB` (unchanged value) | `#60A5FA` (unchanged value) | ΔE OK from Teal: 0.23 light, 0.14 dark |
| `--brand-accent` | Gold | Gold | never text, buttons or statuses |
| `--blue`, `--vermilion` | removed; `--info` takes the blue value, `--brand-accent` the Gold | | |

The focus ring stays 2 px. A focused invalid field keeps its danger border. `--ring` and `--destructive` are ΔE OK 0.29 apart in the light theme and 0.27 in the dark theme.

**Distance to the semantic colours**, also under simulated colour-vision deficiency (Machado, Oliveira and Fernandes 2009, full severity):

| Pair | Normal | Deuteranopia | Protanopia |
|---|---|---|---|
| Teal vs `--success`, light | 0.14 | 0.13 | 0.14 |
| Teal vs `--success`, dark | 0.16 | 0.12 | 0.14 |
| Teal vs `--info`, light | 0.23 | 0.22 | 0.23 |
| Teal vs `--info`, dark | 0.14 | 0.14 | 0.13 |

All values are ΔE OK. Statuses always have an icon or text as well (§13.4).

**The customer side in the UI** is shown by an icon and a label ("Customer · organization name"), never by Gold (WCAG 1.4.1, §13.4).

**E-mails** carry inline colours (`apps/server/src/platform/markdown/render-email-markdown.ts`): the link colour changes from `#2563eb` to Teal `#035F5C`.

### Supersedes

[`2026-11-01-brand-interactive-colour.md`](implemented/2026-11-01-brand-interactive-colour.md):

| Answer of 2026-11-01 | Now |
|---|---|
| 1 – Blue for `--ring`, 2 px | Teal for `--ring`; 2 px stays |
| 2 – links in Blue | links in Teal (`--link` = step 11) |
| 3 – `--info` reuses the Blue | `--info` keeps the blue value as its own colour; `--blue` is removed |
| 4 – selected states stay Ink | selected states in Teal (question 6) |

That specification gets a changelog line pointing here.

## Changes to the system specification

| Section | Change |
|---|---|
| [`docs/brand/README.md`](../../docs/brand/README.md) – The mark | branch colours: Deep Teal (team), Gold (customers); White and Gold on dark backgrounds |
| [`docs/brand/README.md`](../../docs/brand/README.md) – Colours | Teal, Deep Teal, Gold and White replace Ink, Vermilion and Blue as brand colours; Ink stays a UI neutral until the design system specification |
| [`docs/brand/README.md`](../../docs/brand/README.md) – UI design tokens | the rows above, the bullets on Teal, Gold and `--info`, the 12-step scale |
| [`docs/brand/README.md`](../../docs/brand/README.md) – Rules | the versions of the mark; Gold never for text, buttons or statuses; the 16 px favicon check |
| §13.4 | the focus indicator uses Teal (`--ring`), still 2 px; the customer side is never shown by colour alone |

Agent memory: [`.ai/memory/shadcn.md`](../memory/shadcn.md) says the focus ring is Blue; it is updated with the implementation.

New or changed glossary terms: none.

## Open questions

Implementation must not start until every question has an answer.

1. Which brand hue? — **Answer:** **teal** (candidate A), with the values moved after the wide survey: Teal `#035F5C`, Deep Teal `#071F20` (maintainer, 2026-11-27).
2. Which colour for the customer branch? — **Answer:** **light gold `#DCA81C`**, accepted with 2.17:1 on white (maintainer, 2026-11-27, after large graphics and small-size examples).
3. What is Gold for? — **Answer:** **a brand accent only**: the mark, the sign-in panel, illustrations and materials; never text, buttons or statuses (maintainer, 2026-11-27).
4. Do focus and links also use Teal, or stay Blue? — **Answer:** **Teal**: one action colour for everything clickable, as in Plane, Atlassian and Primer (maintainer, 2026-11-27).
5. The English names of the colours? — **Answer:** **Teal, Deep Teal, Gold** (maintainer, 2026-11-27).
6. Selected states in Teal instead of Ink, as in Plane? They are the active tab underline (`tabs.tsx`), checked Switch, Radio and Checkbox, the check of combobox items (`combobox.tsx`), checked field labels (`field.tsx`) and the selected list row. All but the row use `--primary` today, so they follow it. "No" would have needed a separate token that keeps them Ink. — **Answer:** **yes, Teal** (maintainer, 2026-11-27).
7. In the dark theme, is the primary button light Teal (step 9, `#6EBFB9`) with Ink text (8.07:1; like tone 80 in Material 3), or Teal `#035F5C` with white text? The latter stands out poorly from the Ink background (2.30:1) and the dark `--card` (1.95:1); WCAG 1.4.11 does not require a boundary for a button with a text label, so this is about legibility, not conformance. — **Answer:** **light Teal with Ink text** (maintainer, 2026-11-27).
8. The wordmark in Deep Teal (one colour with the stem), or in a neutral near-black like Plane and Linear? — **Answer:** **Deep Teal** (maintainer, 2026-11-27).

## Acceptance criteria

- [ ] `docs/brand/README.md` lists Teal, Deep Teal, Gold and White with their uses, the versions of the mark and the rules above.
- [ ] All brand files and the web application's icons (`icon.svg`, `favicon.ico`, `apple-icon.png`, `public/icons/`) use the new colours with unchanged geometry. The favicon is checked at 16 px on a light and a dark tab, including the dark-theme switch of the SVG favicon. The maintainer has been asked to upload the avatar and the social preview.
- [ ] The tokens have the values above in both themes: `--brand-1` … `--brand-12`, `--primary`, `--primary-hover`, `--ring`, `--link`, `--selected` and `--brand-accent`. `--info` keeps its blue; `--blue` and `--vermilion` are gone.
- [ ] Story tests check:
  - `--primary-foreground` on `--primary` ≥ 4.5:1 in both themes;
  - `--ring` ≥ 3:1 on `--background`, `--card`, `--popover` and `--muted` in both themes;
  - `--ring` is not `--destructive`; in `input.stories.tsx` the assertion `--ring` ≠ `--primary` is removed, because both are Teal now, and `--ring` = `--link` becomes "both from the brand scale": they are equal in the light theme, while in the dark theme `--ring` is step 9 and `--link` step 11;
  - a focused invalid field keeps its danger border (`Input/FocusedInvalid`).
- [ ] A selected table row (`table.tsx`) shows a second indicator besides `--selected`, because the selected background differs from `--background` by only 1.15:1 (light) and 1.10:1 (dark). The indicator is chosen in the implementation (a check, a bar or bold text) and checked by a story test in both themes.
- [ ] No text, button or status in the product code uses `--brand-accent` (lint or story test); the unit-test strings listed under non-goals are exempt.
- [ ] E-mail links use Teal, and the test of `render-email-markdown.ts` asserts it.
- [ ] §13.4 and [`.ai/memory/shadcn.md`](../memory/shadcn.md) are updated. [`2026-11-01-brand-interactive-colour.md`](implemented/2026-11-01-brand-interactive-colour.md) has a changelog line pointing here.
- [ ] Works on phone, tablet and desktop (Rule 9). The light theme is checked in manual QA. The dark theme is checked in Storybook, because the web application has no dark theme (#531).
- [ ] User documentation and product tour updated where they show the colours or the logo (Rules 3, 4).

## Changelog

- 2026-11-27 – Created after the maintainer chose the Plane direction, the teal palette, light gold as a brand accent and Teal for focus and links. Revised the same day after review: values moved away from WeKan, Odoo and Zendesk, gold for the customer branch, the dark scale, and the e-mail and icon files.
- 2026-11-27 – Questions 5–8 answered by the maintainer: the names Teal, Deep Teal and Gold, selected states in Teal, a light Teal button with Ink text in the dark theme, the wordmark in Deep Teal. Second review: figures corrected, the dark `--info` row, the ring and link test, the favicon on dark tabs and the full list of deliberate leftovers. Third review: the neighbour table from the whole survey, the SVG favicon for dark tabs, a criterion for the selected row, CVD distances to two decimals.
- 2026-11-27 – Approved by the maintainer (merged in #574).
- 2026-11-28 – Step 2: the mark files and the icons of the web application regenerated in the new colours. The favicon check at 16 px found no need for a darker gold; the light outline for browsers without the dark switch was dropped, because Safari 26 ignores the rule in the SVG favicon and an outline would harm light tabs (maintainer).
