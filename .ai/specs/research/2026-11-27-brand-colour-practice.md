# Brand colour – established practice

- **Date:** 2026-11-27
- **Kind:** practice review (desk research by an AI agent, with small own tests)
- **Method:** primary sources first (standards, official design systems and token packages, tool code), peer-reviewed studies, practitioners; criticism searched on purpose; own tests with a converter that is not part of the repository.
- **Reliability:** items marked **(u)**, **mkt** or **[summary only]** were not confirmed at an official source or were seen only in a search summary. Values are a reading of public sources on this date.
- **Purpose:** input for the brand colour change of 2026-11-27 (stage 1b of the visual direction). This is not a requirement; the decision is recorded in its change specification (Rule 8, [§2.8](../../../docs/spec/02-agent-rules.md)).
- **Outcome (2026-11-27):** a decision of the maintainer, not a requirement; it is recorded in the change specification of #573 (Rule 8). The maintainer chose the UI direction of Plane and the teal hue (candidate A). After the wide survey ([`2026-11-27-brand-colour-landscape-wide.md`](2026-11-27-brand-colour-landscape-wide.md)) showed close neighbours of the first values, the teal was moved to action `#035F5C` and team branch `#071F20`, and after comparing the options on large graphics the maintainer chose light gold `#DCA81C` for the customer branch, as a brand accent only.

Scope: five questions (brand vs UI action colour, choice of brand hue,
building a UI palette from a hue, accessibility constraints, recolouring a kept logo mark).
Every claim names its source; items marked
**[summary only]** were seen only as a search-engine summary, not read in the original.
Items marked **[own reasoning]** are not established practice.

Tests were run with own scripts (not part of the repository): WCAG 2 contrast, OKLCH, APCA-W3 0.1.9 (self-tested: black on white Lc 106.04, white on black Lc −107.88, both match the published reference values), CVD simulation (Machado et al. 2009 matrices, severity 1.0), and the hue families of 30 issue-tracker, helpdesk and developer-tool brand colours from the simple-icons dataset.

---

## 1. Brand colour vs UI action colour

### What established systems do (primary sources read)

| System | Primary action colour | Relation to brand | Source |
|---|---|---|---|
| Atlassian DS | `color.background.brand.bold` (blue) | Same role: "brand" role is for "primary actions or elements that communicate the Atlassian brand"; neutral for default buttons, danger/warning roles for those actions | https://atlassian.design/foundations/color (Atlassian, current) |
| IBM Carbon | Blue 60 (enabled), Blue 80 (active) | Same: "The core blue family serves as the primary action color across all IBM products"; "additional colors are used sparingly and purposefully" | https://carbondesignsystem.com/elements/color/overview/ (IBM, current) |
| Stripe | UI palette derived from brand colours in CIELAB | Derived: keeps "the character of Stripe's brand" while every hue follows one lightness curve | Koopersmith & Miner, "Designing accessible color systems", 2019-10-15, https://stripe.com/blog/accessible-color-systems |
| Material 3 | `primary` = source colour's hue at tone 40 (light) / 80 (dark) | Derived: hue and chroma from the source/brand, tone fixed by spec for contrast | material-color-utilities `concepts/scheme_generation.md` (Google, current) https://github.com/material-foundation/material-color-utilities |
| Plane Propel | `bg-accent-primary` oklch(0.4799 0.1158 242.91) | Accent is "the only color that signals 'act here'"; "Keep the accent rare"; a second filled accent button is "one too many". Plane's own logo is neutral (#121212 in simple-icons, source plane.so) – i.e. logo neutral, UI accent blue | https://propel.plane.so/foundations/color (Plane, 2026) |
| GitHub Primer | Primary button = **success** (green) role; accent (blue) = links, selection, focus | Not the brand colour; GitHub's brand mark is neutral black | https://primer.style/foundations/color/overview (GitHub, current) |
| Shopify Polaris (2023→) | Black (`rgba(48,48,48,1)`, hover `rgba(26,26,26,1)`), previously green #008060 | Deliberately not brand green; monochrome "reduces noise and ensures color is used for signifiers and affordances" | **[summary only]** polaris.shopify.com/new-design-language (now redirects to shopify.dev); Polaris v12 release notes https://polaris.shopify.com/previous-releases/version-12 |
| shadcn/ui default theme | `--primary: oklch(0.205 0 0)` (near-black), `--ring: oklch(0.708 0 0)` | "High-emphasis actions and brand surfaces" – the slot is meant to be replaced by the brand | https://ui.shadcn.com/docs/theming (current) |
| Linear (2024 redesign) | Theme generated from three inputs: base, accent, contrast (LCH) | Reduced chrome: "limiting how much chrome (blue in our case) was used"; aim "a more neutral and timeless appearance" | Saarinen, Gillet, Eldh et al., "How we redesigned the Linear UI (part II)", 2024-03-28, https://linear.app/blog/how-we-redesigned-the-linear-ui |
| Zendesk Garden | UI palette (grey, kale, blue, green, red, yellow) | Separate: "two core palettes: UI and brand"; brand colours "reserved to denote elements in the UI related to Zendesk products" | https://garden.zendesk.com/design/palette (current) |
| Red Hat DS | – | Brand red is "an accent, not to fill large areas"; danger/error uses a distinct **red-orange** | https://ux.redhat.com/foundations/color/usage (current) |
| GOV.UK Design System | Default button colours "updated to align with the refreshed GOV.UK brand" (Frontend v6.0.0); start buttons green "based on research showing it improved click-through"; warning button: "Don't rely on red alone"; one default button per page | Functional colour `brand` #1d70b8 listed separately; focus colour #ffdd00 "Only use this colour to indicate which element is focused on"; "Only use the variables in the context they're designed for" | https://design-system.service.gov.uk/components/button/ , https://design-system.service.gov.uk/styles/colour/ (GDS, current) |

Practitioner guidance:
- NN/g (Kelley Gordon, "Using Color to Enhance Your Design", 2021-06-06,
  https://www.nngroup.com/articles/color-enhance-design/): "Reserve the accent color for what you
  want to stand out the most"; same colour = same meaning on every screen; ~3 colours; start from
  brand guidelines; grey buttons can look disabled.
- Atlassian 2024 visual refresh (Stephen Mok, 2024-10-04,
  https://community.developer.atlassian.com/t/a-visual-refresh-of-our-ui-foundations-is-coming/84949):
  marketing and product brought "closer together through shared brand colors"; neutrals got
  "fewer blue tints". So the 2024 direction at Atlassian was *towards* brand = product colour, not away.

### Synthesis: three established patterns (they disagree; all are in real use)

- **A. Brand hue is the action hue, re-toned for contrast** (Atlassian, Carbon, Stripe, Material,
  Plane's accent). The brand *hue* is kept; its *lightness* is set by contrast rules, so the UI
  fill is usually darker than the marketing swatch (Material: tone 40).
- **B. Neutral / near-black primary, colour reserved for meaning** (Polaris 2023, shadcn default,
  Linear's reduced chrome, Notion/GitHub's neutral marks). Rationale: maximum contrast, colour freed
  for status and affordance. Criticism found: a single practitioner anecdote that pure-black buttons
  felt "loud"/"aggressive" (**[summary only]** pravinkumar.co, 2026); WordPress Trac ticket #48709 on disabled black primaries being
  hard to distinguish (<https://core.trac.wordpress.org/ticket/48709>).
  No controlled study either way was found.
- **C. Separate brand palette from UI palette** (Zendesk Garden, Red Hat). Brand colour used for
  identity; UI colours chosen for function.

When brand-as-primary is **bad** (sources agree): the brand hue fails 4.5:1 with white text (or
with dark text) at the brand's own lightness; the brand hue collides with a semantic colour
(Red Hat: brand red vs danger → danger moved to red-orange; USWDS/CMS removed a red that was "a
non-semantic duplicate of error", **[summary only]** design.cms.gov migration guide v7); or the
accent would cover more than a small share of the screen (Propel).

Fit for Trybun: the maintainer rejected the near-black primary on 2026-11-27, in the session that chose the Plane direction (pattern B). Pattern A is the closest
match to Plane (the stated UI reference) and to Atlassian/Carbon; it requires a brand hue that can
be re-toned to a fill with ≥4.5:1 against white text and that stays clear of danger/success.

## 2. Choosing a brand hue: evidence vs folklore

### Peer-reviewed evidence
- Labrecque & Milne, "Exciting red and competent blue: the importance of color in marketing",
  *J. Academy of Marketing Science* 40(5), 711–727, 2012 (online 2011), DOI 10.1007/s11747-010-0245-y.
  Four studies: hue maps to brand-personality dimensions; saturation and value intensify traits;
  colour shifts personality and purchase intent. Only abstract/bibliographic records were read
  (full text paywalled) – **[summary only]** for specific hue→trait results.
- Singh, "Impact of color on marketing", *Management Decision* 44(6), 783–789, 2006,
  DOI 10.1108/00251740610673332. A literature review, not a new study. The widely quoted
  "62–90 % of assessment is based on colour alone" is a claim in the abstract; secondary sources
  re-frame it as "of purchasing decisions". **[summary only]** for the paper's body (author PDF host
  has a broken TLS certificate).
- Elliot & Maier, "Color psychology: effects of perceiving color on psychological functioning in
  humans", *Annual Review of Psychology* 65, 95–120, 2014 (https://pubmed.ncbi.nlm.nih.gov/23808916/)
  – colour effects are context-dependent. Counter-evidence: a 2020 meta-analysis in *Psychonomic
  Bulletin & Review* (https://link.springer.com/article/10.3758/s13423-020-01772-1) found "no
  evidential value" for the red-impairs-performance effect after correcting for publication bias
  **[summary only]**; Steele 2014 failed to replicate Mehta & Zhu 2009 **[summary only]**.
- Rizomyliotis, Konstantoulaki & Kostopoulos, "Reassessing the effect of colour on attitude…",
  *Australasian Marketing Journal* 26(3), 204–215, 2018 (full text read from LJMU repository):
  cool background colours gave more positive attitudes than warm ones, but only in positive mood and
  low involvement – i.e. moderated, not universal.
- Jonauskaite et al., "Universal patterns in color-emotion associations are further shaped by
  linguistic and geographic proximity", *Psychological Science* 31(10), 1245–1260, 2020
  (https://eprints.whiterose.ac.uk/id/eprint/169496/): 4,598 people, 30 nations; associations are
  largely universal (mean r = .88) but nation adds predictive information. Whether Poland is among
  the 30 nations was **not verified** (full text behind a bot wall).
- Madden, Hewett & Roth, "Managing images in different cultures…", *J. International Marketing*
  8(4), 90–107, 2000 – eight-country study, similarities and differences in colour meanings
  **[summary only]**.

**Conclusion:** hue→personality links exist in lab studies but are moderated by context, mood,
involvement and culture; the specific popular mappings ("blue = trust") are weakly evidenced and
the most-quoted statistic (Singh's 62–90 %) is a review claim. Colour psychology should not be the
deciding argument for a hue (the Polish popular sources agree that the field is "niedojrzała",
**[summary only]** national-geographic.pl).

### Distinctiveness (Ehrenberg-Bass)
- Romaniuk, *Building Distinctive Brand Assets*, OUP 2018; Q&A "Seven costly sins of brand
  identity", 2018 (full text read, https://assets.marketingscience.info/Brand-Identity-QA.pdf):
  - Assets are measured by **fame** and **uniqueness**; new assets start low on both.
  - On category codes: "If the category codes are already embedded in category buyer memory, you
    would be foolish not to incorporate them (or at least work around them). However trying to own
    such a code is creating hard work for yourself because you have the mental competition from both
    the meaning and other brands using those codes."
  - On refreshes: little empirical evidence on how often to refresh; quantify the short-term
    branding loss; asks "what then is the value of the change?".
  - Customers' stated preferences about assets are a poor guide (they overvalue novelty).
- Romaniuk: "many different colour assets could work" within one category **[summary only]**
  (Marketing Week article, 403).
- Colour assets reportedly score low on fame/uniqueness (12 % / 39 %) **[summary only, untraced
  secondary figure – not used]**.

Fit for Trybun: the brand is new, so the existing colours have no measurable fame; changing them now
costs almost nothing in equity (Romaniuk's caution applies to established assets). The real
constraint is uniqueness versus the category.

### Category colour audit (test)
Brand colours from simple-icons (version not recorded; each entry links to the brand's own guideline or press kit; some values are stale, see the wide survey):
- Blue: Atlassian/Jira/Trello/Bitbucket #0052CC (pre-2024 value in the dataset), OpenProject
  #0770B8, Help Scout #1292EE, Vikunja #196AFF, Mattermost #0058CC, Chatwoot #1F93FF, Airtable,
  Pivotal Tracker.
- Violet/indigo: Linear #5E6AD2, ClickUp #7B68EE, Shortcut #494BCB, Sentry #362D59, Plausible.
- Neutral/black: Plane #121212, GitHub #181717, Notion, Basecamp #1D2D35, Discourse.
- Red/coral: Asana #F06A6A, Redmine #B32024, Todoist #E44332, HubSpot #FF7A59, LiveChat, Rocket.Chat.
- Orange: GitLab #FC6D26, Forgejo #FB923C.
- Teal / cyan: Intercom #6AFDEF (teal, H 187; stale in simple-icons: intercom.com is black and orange today), Zendesk #03363D (dark kale, cyan by the buckets of the landscape notes, H 209). Green: Gitea #609926.
Counts (30 brands, Atlassian family counted per product): blue 12, red 6, violet 5, neutral 5,
orange 2, teal/cyan 2, green 1. Not in dataset: YouTrack, Zammad, osTicket, Freshdesk, Jira Service
Management, Wrike, Height, Taiga, monday.com.
**[own reasoning]** Blue and violet are the crowded codes in this category; teal/cyan, green and
magenta are sparse – but green collides with success and teal sits between success and info.

### Cultural meanings relevant to Poland/Europe
- Polish national colours are white and red (Konstytucja RP art. 28 ust. 2, e.g.
  https://www.senat.gov.pl/gfx/senat/userfiles/_public/k10/kancelaria/wydawnictwa/pdf/konstytucja_rp_a5.pdf).
- Red = danger/error is a near-universal UI convention (all design systems above).
- Red/green colour-vision deficiency: ~8 % of men and ~0.4 % of women of European descent
  (Birch, "Worldwide prevalence of red-green color deficiency", JOSA A 2012,
  https://pubmed.ncbi.nlm.nih.gov/22472762/ **[summary only]**).
- No peer-reviewed Poland-specific colour-meaning study for B2B software was found.

## 3. Building a UI palette from a brand hue

### Tools and methods (primary sources)
- **OKLCH**: perceptually uniform lightness; "every hue has a different maximum chroma"; browsers
  may clip out-of-gamut colours and shift hue (Sitnik & Turner, Evil Martians, updated 2025-09-17,
  https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl). Tailwind v4 moved its whole
  palette to OKLCH (blog 2025-01-22, https://tailwindcss.com/blog/tailwindcss-v4) with 11 steps
  50–950 (https://tailwindcss.com/docs/colors).
- **Radix Colors**: 12 steps with fixed jobs – 1–2 backgrounds, 3–5 component states, 6–8 borders
  (8 = focus rings), 9 solid (purest, highest chroma), 10 solid hover, 11–12 text; steps 11/12
  guarantee APCA Lc 60 / Lc 90 on step 2. Most step-9 colours take white text; sky, mint, lime,
  yellow, amber take dark text (https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale).
  Tinted greys: pick the grey nearest the accent hue (mauve, slate, sage, olive, sand) for a
  "harmonious" look, or pure grey for neutrality; saturated greys can clash with badges in dark
  mode (https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette). Custom tool:
  accent + grey + background → two 12-step scales with alpha and P3 variants
  (https://www.radix-ui.com/colors/custom, Radix Themes 3.0, 2024-03).
- **Adobe Leonardo**: generates colours from *target contrast ratios* against a background, with
  lightness as the main variable; contrast as "the starting point, rather than a post-color-selection
  auditing process" (https://github.com/adobe/leonardo README; Nate Baldwin, Medium 2020).
- **Material HCT**: tonal palettes vary only in tone; "a difference of 40 in tone guarantees a WCAG
  contrast ratio ≥ 3.0; a difference of 50 … ≥ 4.5"; primary = tone 40 light / 80 dark; a mid-tone
  T50 with white only reaches ~4.5:1 (`concepts/contrast_for_accessibility.md`,
  `concepts/scheme_generation.md`). The **error** palette is fixed: `TonalPalette.fromHueAndChroma(25, 84)`
  regardless of source (`typescript/palettes/core_palette.ts`). `Blend.harmonize` rotates a custom
  colour's hue toward the source by min(½·difference, 15°) (`typescript/blend/blend.ts`).
  Material has no special handling when the source is red; the flex_seed_scheme docs note a red
  primary "can conflict with the error color" **[summary only]** (https://pub.dev/packages/flex_seed_scheme).
- **Stripe**: same lightness curve for every hue, so "any two colors … at least five levels apart"
  have small-text contrast; four levels for icons/large text (2019).
- **Vercel Geist**: 10 steps 100–1000 with fixed jobs (https://vercel.com/geist/colors).
- **Carbon**: 10 grades per hue (10–100) plus black/white.

**Number of steps:** 10 (Carbon, Geist), 11 (Tailwind), 12 (Radix), 13+ tones (Material). All
assign each step a job; the step count matters less than fixed roles per step. **[own reasoning]**
Since Trybun follows Plane (semantic tokens such as accent-primary/subtle, layers, surfaces),
a 12-step role-based scale (Radix model) maps most directly to tokens.

**Tinted neutrals:** Radix recommends it as an option; Atlassian's 2024 refresh *reduced* blue tint
in neutrals; Plane's canvas is almost neutral (oklch 0.9614 0.0013 286). Sources disagree; both are
in use.

### Keeping semantic colours distinct from the brand
- Atlassian: accents carry no meaning and must not be used where colour has semantic meaning;
  separate success / warning / danger / information / discovery roles.
- Propel: status colours "Reserve them for state"; "Color is never the only carrier of meaning".
- Red Hat: brand red is an accent; danger uses a distinct red-orange, reserved for danger.
- Uniqlo reportedly uses yellow for errors to leave red for the brand **[summary only]**.
- Material: error fixed at hue 25 independent of the brand.

**What to do when the brand hue is near danger red or success green** (practice found): either
(1) move the brand hue away (most common in systems above), or (2) keep the brand hue for identity
only and shift danger (Red Hat). Option (2) conflicts with the universal red = danger convention.
**Test:** Vermilion #E0482C vs Plane danger: OKLab ΔE 0.086, hue difference 3.7°; vs Tailwind
red-600: ΔE 0.059, 5.3°. This confirms the earlier rejection of Vermilion as an action colour ([`docs/brand/README.md`](../../../docs/brand/README.md), "UI design tokens").

## 4. Accessibility constraints

### WCAG 2.2 (normative, W3C)
- 1.4.3 Contrast (Minimum), AA: text ≥ 4.5:1; large text (≥ 18 pt / 14 pt bold ≈ 24 px / 18.5 px)
  ≥ 3:1; "Text that is part of a logo or brand name has no contrast requirement"; ratios are not
  rounded (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- 1.4.11 Non-text Contrast, AA: UI components and state indicators ≥ 3:1 against adjacent colours;
  a button identified by its text does not need a 3:1 fill boundary; focus indicators need contrast
  against adjacent colours; hover exempt; disabled exempt
  (https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- **Note on the focus criteria:** in final WCAG 2.2, **2.4.11 is Focus Not Obscured (Minimum), AA**,
  and does not concern colour; **2.4.13 Focus Appearance is AAA**: indicator area ≥ a 2 CSS px
  perimeter and ≥ 3:1 between focused and unfocused pixels
  (https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html,
  https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html). 2.4.7 Focus Visible (AA)
  still applies.
- 1.4.1 Use of Color, A: colour is not the only visual means; a hue difference plus ≥ 3:1 lightness
  difference counts as an extra cue only if meaning doesn't depend on perceiving a specific colour
  (https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

### APCA
- Removed from the WCAG 3 draft in July 2023; the April 2026 Editor's Draft says "The contrast
  algorithm used in WCAG 3 is yet to be determined" (Adrian Roselli, 2026-04,
  https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html). Roselli: use APCA only
  with colours that also pass WCAG 2. APCA author (Somers) counters, pointing to BridgePCA
  (comment on the same post); Eggert ("WCAG 3 is not ready yet", yatil.net) vs Myndex rebuttal
  **[summary only]**. Verdict: WCAG 2 ratios are the binding check; APCA is secondary.

### Test results
| Colour | OKLCH | White text on it | APCA Lc (white text) |
|---|---|---|---|
| Ink #141A2E | 0.223 0.040 270 | 17.26:1 | −106.4 |
| Vermilion #E0482C | 0.613 0.193 33 | **4.09:1 (fails 4.5)** | −72.4 |
| Blue #2563EB | 0.546 0.215 263 | 5.17:1 | −80.2 |
| Plane accent #006399 | 0.480 0.116 243 | 6.47:1 | −86.6 |
| Plane danger #BF2C22 | 0.528 0.185 29 | 5.84:1 | −83.0 |
| Plane success #2F934B | 0.588 0.141 149 | 3.89:1 (fails) | −71.5 |

Maximum OKLCH L for a fill that still gives white text ≥ 4.5:1 (sRGB): about **0.555–0.594**
depending on hue and chroma (lowest for green/cyan ≈0.555–0.56, highest for red/magenta ≈0.58–0.59).
Such a fill has ≈4.0:1 against Plane's canvas. This matches Material's T50 ≈ 4.5:1 rule.
**[own reasoning]** Target L ≈ 0.45–0.55 for the default fill (margin for hover/pressed going darker
and for rendering differences).

CVD simulation (ΔE in OKLab; contrast ratio between the pair):
- Vermilion vs Blue: normal 0.376; protan 0.292; deutan 0.340; tritan 0.346 – stays distinct.
- Vermilion vs Plane success green: normal 0.287 → deutan **0.066**, protan 0.103; luminance ratio
  1.05 – practically indistinguishable for deutans. A team/customer pair must never be red vs green.
- Ink vs Blue: contrast 3.34:1 – a lightness difference also distinguishes them.

## 5. Recolouring a kept logo mark

- **Slack 2019** (Slack, "Say hello to our new logo", 2019-01-16, https://slack.com/blog/news/say-hello-new-logo):
  kept the octothorpe as "an evolution"; the old mark "was 11 different colors", looked poor on
  anything but white or at the wrong angle; the new one "uses a simpler color palette".
- **GitLab** (https://design.gitlab.com/brand-logo/core-logo, current): full colour is the default;
  one-colour white or charcoal versions for single-colour uses; "Do not recolor any part of the
  logo"; minimum 20 px digital. 2022 refresh details (three-tone orange, fewer facets)
  **[summary only]** (brandkit / logos-world).
- **Firefox 2018–2019** (Murray & Enros, "Evolving the Firefox Brand", 2018-07-30,
  https://blog.mozilla.org/opendesign/evolving-the-firefox-brand/): public process; recognisability
  ("does it still feel like Firefox?"); colour and graphic treatment unite the product family;
  Developer Edition and Nightly as colour variants of one icon; commenters objected to change itself.
- **Mailchimp 2018** (Collins): Freddie kept but simplified for scalability; wordmark replaced
  **[summary only]** (Design Week, Creative Bloq).
- **Atlassian**: on dark backgrounds program name and logo become white (https://atlassian.design/foundations/logos);
  2017 marks designed as one family, "legible at any size" (Cannon-Brookes, 2017-09-11). The 2024
  visual refresh concerned UI colours; product-logo critique is **[summary only]** (Product Hunt
  comment: consistent but individually less memorable).
- **Favicons** (Andrey Sitnik, "How to favicon…", Evil Martians, updated 2026-01-21,
  https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs):
  ICO 32×32, SVG, 180×180 apple-touch, 192/512 manifest + maskable (safe circle 409/512); SVG can
  switch colours with `prefers-color-scheme`; check at 16×16 and commission "a custom tiny version"
  if blurry. Other favicon advice (simplify, ≤ 2–3 colours, rebuild rather than shrink) comes from
  vendor blogs **[summary only]**.
- Distinctiveness: Romaniuk's advice to quantify loss before refreshing applies to *established*
  assets; Trybun's mark is new.

**[own reasoning]** For a two-colour mark whose colours carry meaning (team vs customer): keep the
meaning carried also by shape/position (left/right branch), so the one-colour version still reads;
make both branch colours distinct in lightness (not only hue) so they survive CVD and greyscale;
logos are exempt from 1.4.3 but the mark must still be visible on both light and dark surfaces.

---

## Disagreements between sources
1. Brand = action colour (Atlassian, Carbon, Material, Stripe, Plane accent, NN/g) vs neutral primary
   (Polaris 2023, shadcn default, Linear's reduced chrome) vs separate palettes (Zendesk, Red Hat).
2. Tinted neutrals (Radix "natural" option) vs de-tinted neutrals (Atlassian 2024, Plane canvas).
3. APCA: Roselli/Eggert (not ready, WCAG 2 binding) vs Myndex/Somers (WCAG 2 flawed).
4. Red brand + red danger: move danger (Red Hat, Uniqlo) vs keep error fixed (Material) – no
   system found keeps both red and similar.
5. Colour psychology: Labrecque & Milne (effects exist) vs replication failures and moderation
   (Elliot & Maier context, 2020 meta-analysis, Rizomyliotis et al.).

## Seen only as search summaries (not read in the original)
Polaris "new design language" page (redirects); UX Movement "why you shouldn't use your brand
color" (paywall); Design Systems Collective "quiet death of the brand-coloured button" (403);
Labrecque & Milne full text; Singh full text; 2020 red-colour meta-analysis; Steele 2014; Madden et
al. 2000; Jonauskaite et al. nation list; Birch 2012; GitLab 2022 details; Mailchimp 2018;
Atlassian 2024 logo critique; flex_seed_scheme note; Uniqlo yellow errors; CMS/USWDS red removal;
Eggert vs Myndex; vendor favicon blogs; Romaniuk Marketing Week article.

## Kinds of sources searched / left out
Search stopped when further, differently worded queries (brand vs action colour; black primary
criticism; red brand vs error; category colours; logo refresh pitfalls) returned the same systems
and arguments without a new option or counter-example.
Searched: standards (WCAG 2.2 Understanding docs), official design-system docs (Atlassian, Carbon, GOV.UK,
Primer, Polaris, Radix, Material/MCU code, Tailwind, Plane Propel, Geist, shadcn, Zendesk Garden,
Red Hat), code of the tools (material-color-utilities, Leonardo, simple-icons dataset), company
blogs (Linear, Stripe, Slack, Mozilla, Atlassian, Plane), peer-reviewed studies (marketing,
psychology, CVD epidemiology), practitioner write-ups (NN/g, Evil Martians, Roselli), issue
trackers (WordPress Trac). Left out / not reachable: Baymard (no colour-of-button research found
relevant to B2B apps), the GOV.UK research behind green start buttons (cited by GDS, not read),
the Ehrenberg-Bass book itself, NN/g articles beyond
two, conversion A/B studies (none credible found), dark-theme guidance for brand fills (not
researched in depth – open point).

## Candidates shown to the maintainer (2026-11-27)

Computed in OKLCH and converted to sRGB; contrast per WCAG 2; colour-vision deficiency simulated with Machado, Oliveira and Fernandes (2009) at full severity. "Branches" is the contrast between the team and customer branches of the mark. Hue distances are to the repository's own tokens: `--destructive` `#C10007` (H 28.5) and `--warning` `#BB4D00` (H 45.4), light theme.

| Candidate | Action (fill) | Team / customer branch | White text on fill | Branches: normal / deuteranopia / protanopia | Hue distance to danger / warning | Result |
|---|---|---|---|---|---|---|
| A Teal (*Morski*) | `#017272` | `#023237` / `#DA8A11` | 5.75:1 | 5.04 / 5.63 / 4.17 | 166° / 149° | chosen as hue; values moved later (below) |
| B Plum (*Śliwka*) | `#97317C` | `#451C3D` / `#E07937` | 6.89:1 | 4.68 / 5.03 / 4.08 | 49° / 65° | not chosen |
| C Blue (conservative) | `#2860DD` | `#151B32` / `#E14C2F` | 5.52:1 | 4.27 / 5.07 / 3.11 | 125° / 142° | not chosen; the most crowded hue |
| Copper | `#A44C03` | – | 5.81:1 | – | 22° / 5° | rejected: reads as danger or warning, under protanopia nearly the danger colour |

**Amber against the warning colour.** The first amber `#DA8A11` (H 68) is 23° from `--warning` `#BB4D00`, with a contrast of 1.83:1 (1.75:1 under deuteranopia, both olive): similar lightness, so it would read as a warning in a badge. (An earlier draft compared it with a sample warning `#A56205` and gave 3°; that was not the repository's token.)

**Values moved after the wide survey.** `#017272` is within ΔE OK 0.038 of WeKan's logo `#007289` and 0.041 of Odoo's action colour `#017E84`, and `#023237` is within 0.016 of Zendesk Kale `#03363D` (below the just-noticeable difference of CSS Color 4). Moved values: action `#035F5C` (white text 7.51:1) and team branch `#071F20`. Their nearest neighbours across the whole survey are in section 3 of [`2026-11-27-brand-colour-landscape-wide.md`](2026-11-27-brand-colour-landscape-wide.md): `#035F5C` is 0.038 from ZnanyLekarz (marketing site, another field) and 0.077–0.096 from the nearest help desks and trackers (WeKan 0.083); `#071F20` has C 0.030 and is a near-neutral, 0.022–0.036 from other near-blacks and 0.087 from Zendesk Kale; `#DCA81C` is 0.050–0.066 from amber and orange secondary logo colours, and no product uses it as an action colour.

**Customer branch.** On large graphics (sign-in panel, portal, empty state, social preview, e-mail) four ambers and three golds were compared. The maintainer chose light gold `#DCA81C`:
- it reaches 7.88:1 on `#071F20`;
- it has 2.17:1 on white (2.06:1 under deuteranopia), and 2.17:1 against a white team branch on dark backgrounds; that is below the 3:1 between branches used to compare the candidates above, which WCAG does not require of logos (Understanding 1.4.11), and was accepted after examples at 16, 24 and 56 px, under simulated deuteranopia and in greyscale;
- it is 4° and 1.26:1 from the dark-theme warning `#FFB900`, so the maintainer decided that it is a brand accent only (never text, a button or a status) and that the customer side is shown in the UI by an icon and a label (WCAG 1.4.1, [§13.4](../../../docs/spec/13-non-functional.md)); the decision is recorded in the change specification of #573.

Screenshots of Plane and Linear used for the direction: 71 and 65 images from the vendors' own documentation, changelogs, blogs, product pages and (Plane) GitHub repository, mostly 2025–2026, collected on 2026-11-27; the comparison page itself is a private artefact and not part of the repository.
