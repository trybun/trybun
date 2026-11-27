# Teal brand palette and a recoloured mark

| | |
|---|---|
| Status | `draft` |
| Created | 2026-11-27 |
| Plan task | – |
| System specification sections | §13.4; [`docs/brand/README.md`](../../docs/brand/README.md) (Colours, UI design tokens, Rules) |
| Related issues / PRs | #573, #572 (research), [`2026-11-01-brand-interactive-colour.md`](implemented/2026-11-01-brand-interactive-colour.md) (superseded in part) |

## Context

The maintainer wants Trybun to look modern and attractive, because buyers who compare two similar tools choose the one that looks better. On 2026-11-27 they chose the UI direction of Plane: clear, intuitive and full of conventions from other tools. They also rejected the current brand colours, because the black primary does not fit that direction.

Today the brand has three colours ([`docs/brand/README.md`](../../docs/brand/README.md)):

| Colour | Use today | Problem |
|---|---|---|
| Ink `#141A2E` | `--primary`, so every primary button is near-black; the team branch and the wordmark | reads as black; the same as the default shadcn look, Polaris, GitLab since 2026 and Frappe Helpdesk, so it does not set Trybun apart |
| Vermilion `#E0482C` | `--brand-accent`, the customer branch of the mark | 3.7° of hue from the danger red and only 4.09:1 with white text, so it cannot be an action colour; in the mark it is almost the red of GitLab (`#E24329`) and close to Zammad (`#E54011`) |
| Blue `#2563EB` | focus ring, links and information ([2026-11-01](implemented/2026-11-01-brand-interactive-colour.md)) | added only because Ink reads as black and Vermilion as an error; blue is the most crowded hue in the category |

Under deuteranopia, Vermilion beside green cannot be told apart (about 8 % of men of European descent).

The research of 2026-11-27 is in [`research/2026-11-27-category-colour-landscape.md`](research/2026-11-27-category-colour-landscape.md) and [`research/2026-11-27-brand-colour-practice.md`](research/2026-11-27-brand-colour-practice.md):

- **Category:** of 30 trackers and help desks, blue and indigo/violet are crowded, and none uses teal.
- **Practice:** Plane, Atlassian, Carbon, Stripe and Material 3 use one brand hue as a rare action colour and keep everything else neutral.

The maintainer compared four candidates on mock-ups. On 2026-11-27 they chose **A – Teal**, and confirmed **amber as a brand accent only**. On 2026-11-01 teal (`#0F766E`) was variant B for the focus colour and was not chosen; this time teal becomes the brand colour as a whole.

## Goals

- **One brand colour for action and interaction:** primary button, selection, active tab, focus ring and links. It must be distinct from danger, success, warning and information, and reach at least 4.5:1 for text and 3:1 for non-text in both themes.
- **A mark that keeps its shape and meaning** (team branch, customer branch) in new colours. The two branches differ in lightness by at least 3:1, also under simulated deuteranopia and protanopia, on light and dark backgrounds.
- **Amber is a brand accent only:** the mark, the sign-in brand panel, empty-state illustrations, e-mails and other materials. Never text, buttons or statuses; it is 3° of hue from the warning colour (contrast 1.75:1).

## Non-goals

- **The rest of the design system in the direction of Plane:** neutrals and surface layers, type, radii, density, motion and statuses. It follows in its own change specification; until then Ink stays the base of the neutral scale, the dark background and the text colour.
- **Branding the Keycloak sign-in pages.** How to theme them (CSS over `keycloak.v2`, FreeMarker templates or Keycloakify) needs its own research and specification. The sign-in brand panel above describes only the colours it will use.
- **The semantic colours.** Danger, success and warning stay as they are, and `--info` keeps its own blue (see "UI tokens").
- **The shape of the mark and the wordmark typeface** (Manrope ExtraBold).

## Proposed change

### Brand colours

| Name (proposed) | Hex | OKLCH | Use |
|---|---|---|---|
| Teal | `#017272` | L 0.50 C 0.105 H 195 | action and interaction colour in the UI; 5.75:1 with white text |
| Deep Teal | `#023237` | L 0.29 C 0.05 H 205 | team branch, crossbar and wordmark of the mark; brand surfaces (sign-in panel, e-mail header) |
| Amber | `#DA8A11` | L 0.70 C 0.15 H 68 | customer branch of the mark; brand accent only |
| White | `#FFFFFF` | | backgrounds; the mark on dark backgrounds |

On dark backgrounds the mark uses a dark-background pair: team branch `#017F7F` and customer branch `#FFE8C5`.

| Pair | Normal | Deuteranopia | Protanopia |
|---|---|---|---|
| `#023237` / `#DA8A11` on light | 5.04:1 | 5.63:1 | 4.17:1 |
| `#017F7F` / `#FFE8C5` on `#16181D` | 4.05:1 | 4.40:1 | 3.59:1 |

On a Deep Teal surface (the sign-in brand panel) the pair is not settled yet: white and Amber are both clearly visible on it (13.87:1 and 5.04:1), but differ from each other by only 2.75:1 (question 8).

### The mark

Every file in [`docs/brand/`](../../docs/brand/README.md) is regenerated in the new colours with the same geometry:

- the icons: primary, on dark, one-colour dark and one-colour white;
- the logos with the wordmark, light and dark;
- the PNG icon and avatar (512 px), the social preview (1280 × 640) and the favicon (16/32/48 px);
- the copies in the web application: `apps/web/src/app/icon.svg` and `apps/web/public/icons/`.

The favicon is checked at 16 px. If the branches blur, a simplified small version is drawn, as GitLab and Firefox do. The rule "Do not recolour the branches" stays and refers to the new colours.

The GitHub organization avatar and the repository social preview are uploaded by the maintainer, because agents never change settings.

### UI tokens

| Token | Light | Dark | Contrast |
|---|---|---|---|
| `--primary` / `--primary-foreground` | Teal `#017272` / White | `#5FBDBC` / Ink | 5.75:1 / 7.8:1 |
| primary hover | `#076262` | (from the dark scale) | 7.16:1 with white |
| `--ring` | Teal `#017272` | `#5FBDBC` | 5.75:1 on `--background`, 5.22:1 on `--muted` / 7.8:1 on `--background`, 5.5:1 on `--muted` |
| `--link` | `#066B6C` (scale step 11) | `#5FBDBC` | 6.31:1 / 7.8:1, still underlined |
| selected background (selected row, active item) | `#DEF7F6` (scale step 3) | from the dark scale | Ink text 15.4:1 |
| `--info` | stays a blue of its own | | 60° of hue from Teal |
| `--brand-accent` | Amber `#DA8A11` | Amber `#DA8A11` | not for text, buttons or statuses |
| `--blue` | removed; `--info` keeps the blue value | | |

The brand scale has 12 steps in OKLCH with the roles of Radix Colors: 1–2 backgrounds, 3–5 component backgrounds, 6–8 borders, 9 the solid fill, 10 hover, 11 text, 12 strong text. It is computed for the light and the dark theme. Its light values are in the brand colour research.

**Selected states** (the active tab underline, checked Switch and Radio, the selected list row) use Teal instead of Ink, as in Plane. This reverses answer 4 of [2026-11-01](implemented/2026-11-01-brand-interactive-colour.md).

**The customer side in the UI** is shown by an icon and a label ("Customer · organization name"), never by Amber (WCAG 1.4.1, §13.4).

### Supersedes

[`2026-11-01-brand-interactive-colour.md`](implemented/2026-11-01-brand-interactive-colour.md):

- the colour of `--ring` and `--link` changes from Blue to Teal;
- selected states change from Ink to Teal;
- the 2 px focus thickness stays.

That specification gets a changelog line pointing here.

## Changes to the system specification

| Section | Change |
|---|---|
| [`docs/brand/README.md`](../../docs/brand/README.md) – The mark | branch colours: Deep Teal (team), Amber (customers) |
| [`docs/brand/README.md`](../../docs/brand/README.md) – Colours | Teal, Deep Teal, Amber, White replace Ink, Vermilion and Blue as brand colours; Ink stays a UI neutral until the design system specification |
| [`docs/brand/README.md`](../../docs/brand/README.md) – UI design tokens | the rows above, the bullets on Teal, Amber and `--info`, the 12-step scale |
| [`docs/brand/README.md`](../../docs/brand/README.md) – Rules | the dark-background pair; Amber never for text, buttons or statuses; the 16 px favicon check |
| §13.4 | the focus indicator uses Teal (`--ring`), still 2 px; the customer side is never shown by colour alone |

New or changed glossary terms: none.

## Open questions

Implementation must not start until every question has an answer.

1. Which brand palette? — **Answer:** **A – Teal**: Teal `#017272`, Deep Teal `#023237`, Amber `#DA8A11` (maintainer, 2026-11-27, after comparing four candidates on mock-ups).
2. What is Amber for? — **Answer:** **a brand accent only**: the mark, the sign-in panel, illustrations and materials; never text, buttons or statuses (maintainer, 2026-11-27).
3. Do focus and links also use Teal, or stay Blue? — **Answer:** **Teal**: one action colour for everything clickable, as in Plane, Atlassian and Primer (maintainer, 2026-11-27).
4. The English names of the colours: **Teal, Deep Teal, Amber** (proposed)? — **Answer:** open.
5. Selected states in Teal instead of Ink, as in Plane (proposed)? — **Answer:** open.
6. In the dark theme, is the primary button light Teal `#5FBDBC` with Ink text (proposed, 7.8:1; like tone 80 in Material 3), or Teal `#017272` with white text (only 3.0:1 against the Ink background, at the limit of WCAG 1.4.11)? — **Answer:** open.
7. The wordmark in Deep Teal (proposed, one colour with the stem), or in a neutral near-black like Plane and Linear? — **Answer:** open.
8. Which branch pair does the mark use on a Deep Teal surface? Proposed: decide it in the Keycloak branding specification, with the same rule (each branch at least 3:1 against the surface and against the other branch); a darker amber, about OKLCH L 0.63, meets it but is a fourth colour. — **Answer:** open.

## Acceptance criteria

- [ ] `docs/brand/README.md` lists Teal, Deep Teal, Amber and White with their uses, the dark-background pair and the rules above.
- [ ] All brand files and the web application's icons use the new colours with unchanged geometry. The favicon is checked at 16 px. The maintainer has been asked to upload the avatar and the social preview.
- [ ] `--primary`, `--ring`, `--link`, the selected background and `--brand-accent` have the values above in both themes. `--info` keeps its blue and `--blue` is gone.
- [ ] Story tests check:
  - white on `--primary` ≥ 4.5:1 and `--ring` ≥ 3:1 on `--background`, `--card`, `--popover` and `--muted` in both themes;
  - a focused invalid field keeps its danger border (`Input/FocusedInvalid`).
- [ ] No text, button or status uses `--brand-accent` (lint or story test).
- [ ] §13.4 updated. [`2026-11-01-brand-interactive-colour.md`](implemented/2026-11-01-brand-interactive-colour.md) has a changelog line pointing here.
- [ ] Works on phone, tablet and desktop (Rule 9). Light and dark theme are checked in manual QA.
- [ ] User documentation and product tour updated where they show the colours or the logo (Rules 3, 4).

## Changelog

- 2026-11-27 – Created after the maintainer chose the Plane direction, the Teal palette, Amber as a brand accent and Teal for focus and links.
