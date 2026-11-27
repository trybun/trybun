# Category colour landscape – issue trackers and help desks

- **Date:** 2026-11-27
- **Kind:** benchmark (desk research by an AI agent; no interviews, no usage data)
- **Method:** see "Method" below: token packages, repositories, official logos and brand pages first; marketing CSS marked **mkt**; colour-aggregator sites not used.
- **Reliability:** items marked **(u)**, **mkt** or **[summary only]** were not confirmed at an official source or were seen only in a search summary. Values are a reading of public sources on this date.
- **Purpose:** input for the brand colour change of 2026-11-27 (stage 1b of the visual direction). This is not a requirement; the decision is recorded in its change specification (Rule 8, [§2.8](../../../docs/spec/02-agent-rules.md)).
- **Outcome (2026-11-27):** a decision of the maintainer, not a requirement; it is recorded in the change specification of #573 (Rule 8). The maintainer chose the UI direction of Plane and the teal hue (candidate A). After the wide survey ([`2026-11-27-brand-colour-landscape-wide.md`](2026-11-27-brand-colour-landscape-wide.md)) showed close neighbours of the first values, the teal was moved to action `#035F5C` and team branch `#071F20`, and after comparing the options on large graphics the maintainer chose light gold `#DCA81C` for the customer branch, as a brand accent only.

Scope: 30 trackers and help desks chosen as Trybun's closest category.
Trybun today: Ink `#141A2E` (OKLCH L 0.22 C 0.040 H 270, near-black; UI primary),
Vermilion `#E0482C` (L 0.61 C 0.193 H 32.6, red), Blue `#2563EB` (L 0.55 C 0.215 H 263, blue).

## Method

- Order of preference for sources: (1) the vendor's own design-token or component package
  (npm tarball unpacked and grepped); (2) the vendor's own repository (open-source products,
  read with `gh api`); (3) official logo SVG/PNG served by the vendor (SVG fills grepped;
  PNG pixels decoded with a small pure-Python decoder, dominant opaque colour taken);
  (4) the vendor's brand/press page; (5) CSS custom properties of the vendor's marketing
  site (`curl -s`, default curl user agent, no spoofing).
- Values from a marketing site are marked **mkt**: they show the marketing CTA, which is
  not always the product's in-app button.
- **(u)** = not confirmed at an official source in this run (memory, inference, or a
  source that blocked the request).
- OKLCH values were computed from sRGB hex with the standard Björn Ottosson OKLab matrices
  (own converter, not part of the repository; checked against Plane's own `oklch()` tokens, which convert
  back to the hex in the table).
- Hue buckets (OKLCH hue angle, set by converting pure reference colours: #FF0000 = 29°,
  #FF8000 = 53°, #FFFF00 = 110°, #00FF00 = 142°, #008080 = 195°, #0080FF = 256°,
  #0000FF = 264°, #8000FF = 294°, #FF00FF = 328°):
  red 15–40, orange 40–70, yellow 70–115, green 115–165, teal 165–195, cyan 195–240,
  blue 240–268, indigo 268–285, violet 285–315, magenta/pink 315–15;
  **neutral** when chroma C < 0.045 (near-black when L < 0.4).

## Table

Abbreviations: L = light theme, D = dark theme, mkt = marketing-site CTA, ADS = Atlassian Design System.

| Product | Category | Brand hex (logo) | UI action hex L / D | Separated? | Source URLs | Notes |
|---|---|---|---|---|---|---|
| **Plane** | Dev tracker (OSS) | `#121212` monochrome wordmark+mark (neutral) | `#006399` / `#2893CC` (`--brand-default` → `--bg-accent-primary`; L H 243, D H 238: blue/cyan border, "azure") | **Yes**: mono logo, azure UI | npm `@makeplane/propel@0.9.11` `dist/styles/variables.css` (lines 183, 280, 498, 592) and `dist/internal/control-chrome.js` (`primary: "bg-accent-primary text-inverse"`); github.com/makeplane/plane `packages/tailwind-config/index.css` (imports propel); https://plane.so/brand-logos/logo-with-wordmark.svg | Propel also supports a user brand colour (`--custom-brand-base` + `color-mix`). The older Plane blue logo (u) is no longer what plane.so serves. |
| **Linear** | Dev tracker | Monochrome: Mercury White `#F7F8F8` / Nordic Gray `#232326` | `--color-brand-bg #5E6AD2` (indigo); `--color-accent #7170FF`, `--color-brand-bg #7070FF` in dark contexts | **Yes** | https://linear.app/brand (text: "Monochrome usage is preferred in Mercury White (#F7F8F8) or Nordic Gray (#232326)"); CSS of https://linear.app/ (static.linear.app/web/_next/static/css/*.css) | In-app button not directly inspected; brand-bg token is the site's brand button background (u for in-app). |
| **Jira** (Atlassian) | Dev tracker | Tile `#1868DB` | `color.background.brand.bold` `#1868DB` / `#669DF1` | **No** (same blue) | npm `@atlaskit/tokens@20.15.0` `dist/esm/artifacts/themes/atlassian-light.js`, `atlassian-dark.js`; token description: "Use for … elements that reinforce our brand, such as logos or primary buttons"; npm `@atlaskit/logo@23.3.3` `artifacts/logo-components/jira` | Legacy theme was `#0052CC`. |
| **Jira Service Management** | Service desk | Tile `#FFC716` (yellow) with `#101214` glyph | ADS `#1868DB` / `#669DF1` | **Yes** (yellow tile, blue UI) | `@atlaskit/logo@23.3.3` `jira-service-management`, `customer-service-management`; `@atlaskit/tokens` as above | 2024+ Atlassian app-tile system: product hue lives only in the tile. |
| **YouTrack** (JetBrains) | Dev tracker + helpdesk | Gradient `#FB43FF` → `#FB406D` (magenta–pink) | Ring UI `--ring-main-color` rgb(51,105,214) `#3369D6` / rgb(54,106,207) `#366ACF`; `--ring-button-primary-background-color: var(--ring-main-color)` | **Yes** | https://resources.jetbrains.com/storage/products/company/brand/logos/YouTrack_icon.svg ; npm `@jetbrains/ring-ui@7.0.136` `components/global/variables.css`, `variables_dark.css`; jetbrains.com mkt `#6B57FF` | Ring UI is JetBrains' web UI library used by YouTrack (u that YouTrack uses default unmodified). |
| **GitHub** (Primer) | Dev platform/issues | Invertocat black/white; brand palette "GitHub Green" `#0FBF3E` | `--button-primary-bgColor-rest` → `--bgColor-success-emphasis` `#1F883D` / `#238636`; accent (links/focus) `#0969DA` / `#4493F8` | **Yes** (mono logo; green button; blue accent) | npm `@primer/primitives@11.10.0` `dist/css/functional/themes/light.css`, `dark.css`; https://brand.github.com/foundations/color | Green = "do it" button, blue = links/selection: three-way split. |
| **GitLab** (Pajamas) | Dev platform/issues | Tanuki `#FC6D26`, `#E24329`, `#FCA326`; purple `#7759C2`; charcoal `#171321` | Confirm primary button `#3A383D` (neutral-800) / `#ECEBEA` (neutral-50); before 2026-05: `#1F75CB`-family blue (`action-strong-confirm` still `#1F73CA`) | **Yes** | npm `@gitlab/ui@143.1.0` `src/tokens/build/css/tokens.css`, `tokens.dark.css`, `src/tokens/contextual/button.tokens.json`; commits https://gitlab.com/gitlab-org/gitlab-services/design.gitlab.com/-/commit/991b436729544505f3883256421fc8b9ab11fc0b ("Remove blue from buttons", 2026-05-11) and …/640c94a4677598c63b5e7553494444c1a8f80f5f ("Neutralise components", 2026-06-24) | `#E24329` is practically identical to Trybun Vermilion `#E0482C` (H 32.0 vs 32.6, same L and C). |
| **Zendesk** (Garden) | Help desk | Kale `#03363D` (Garden v8 `kale.700`); logo (u) | `primaryHue` = blue: `#1F73B7` (blue.700) / `#2694D6` (blue.600) | **Yes** | npm `@zendeskgarden/react-theming@9.16.1` `dist/esm/elements/theme/index.js` (`primaryEmphasis`), `palette/index.js`, `palette/v8.js`; zendesk.com brand page and homepage returned HTTP 403 to curl | Kale = dark cyan-teal (H 209, L 0.31). |
| **Freshdesk** (Freshworks) | Help desk | Product icon `#00AC4C` (green) | Crayons `.fw-btn--primary` bg `--color-elephant-800` `#264966` → gradient to `#12344D` (dark navy, C 0.064); D: (u) | **Yes** | https://www.freshworks.com/beta/icons/template-2026/freshdesk-logo-icon.svg ; npm `@freshworks/crayons@2.13.4` `dist` CSS; freshworks.com mkt purple `#8512E0` (u as brand) | Crayons is Freshworks' official DS; that the Freshdesk agent UI uses exactly this button is (u). |
| **Help Scout** | Help desk | Cobalt `#0064F0` (logo `--color--blue-600`) + clay `#262423` | mkt `--color--action-default #0064F0`; app (u) | **No** (mkt) | https://www.helpscout.com/brand/ ("signature brand color, Cobalt"); CSS of https://www.helpscout.com/ | |
| **Front** | Shared inbox / help desk | Logo accent `#A857F1` (violet) + currentColor | mkt `rgb(128 52 191)` `#8034BF`; app (u) | **No** (same violet family) | Inline logo SVG and Tailwind CSS of https://front.com/ | |
| **Intercom** | Help desk / messenger | Logo currentColor (black) | mkt primary button black (`--button-primary-hover-background #000c`); orange `#FF5600` is the most-used accent hex on the site (u as brand); app (u) | **Yes** (mkt) | https://www.intercom.com/ HTML+CSS; /press redirected to homepage | |
| **Asana** | Work management | Coral `#F06A6A` symbol + `#0D0E10` wordmark | mkt `--darkmode-button-primary #F5F4F3` (inverted), hover `#F06A6A`; light mkt black (u); app (u) | **Yes** | https://asana.com/brand ("the symbol should always appear in coral"); inline logo SVG and CSS of https://asana.com/ | |
| **ClickUp** | Work management | Gradient `#FF02F0`, `#FC6D2D`, `#6647F0`, `#0091FF` (+ `#F76808` in logo SVG) | mkt CTA `#202020` (near-black); app (u, purple) | **Yes** | https://clickup.com/brand ("Gradients … HEX #FF02F0 … #FC6D2D … #6647F0 … #0091FF"); inline logo SVG on https://clickup.com/ | |
| **monday.com** (Vibe) | Work management | `#FB275D`, `#FFCC00`, `#00CA72` (three dots) | `--primary-color #0073EA` (light, dark, black themes); behind `rebrand-theme` flag: `#242424` / `#FFFFFF` (inverted CTA), `--brand-color #792CDC` / `#C48FFF`; mkt `#6161FF` | **Yes** | https://cdn.prod.website-files.com/656da6fea306219773d04208/69f1f07236c38c800a45a687_monday-logo.svg ; npm `@vibe/style@4.2.0` `dist/index.css`, `src/themes/rebrand-theme.scss` ("Rebrand overrides (inverted CTA, purple brand, warm surfaces), behind the monolith's design_facelift flag") | Second vendor moving from blue CTA to near-black CTA in 2026. |
| **Notion** | Docs/work management | Black/white mark (inline SVG `#fff` + currentColor) | mkt "tatami" `--tatami-color-button-primary-background`: black, gray-900 or blue-600 depending on section theme; app (u, blue `#2383E2`) | **Yes** | CSS of https://www.notion.com/ (`/_next/static/chunks/*.css`) | notion.com/brand returned 401. |
| **Height** | Dev tracker | (u) | (u) | (u) | https://height.app/ unreachable (curl HTTP 000) | Product shut down (u; consistent with the domain not resolving). Excluded from clusters. |
| **Shortcut** | Dev tracker | `#494BCB` (indigo) | mkt CTA `#494BCB`; app (u) | **No** (mkt) | https://www.shortcut.com/assets/brand/shortcut-logo.svg ; https://www.shortcut.com/favicons/production/favicon.svg ; CSS of https://www.shortcut.com/ | |
| **Huly** | Dev tracker + suite (OSS) | Monochrome `#36373D` / white | `--primary-button-default #205DC2` (all themes) | **Yes** | github.com/hcengineering/platform `packages/theme/styles/_colors.scss` (line 24), `dev/prod/public/huly/favicon.svg`; huly.io mkt accent `#FF5F0B` (u as brand) | |
| **OpenProject** | Project management (OSS) | Icon `#0F41B5`; site `--bs-primary #1A67A3` | `primary-button-color #1F883D` (Primer green); accent/header `#0F41B5`; D (u) | **Yes** | github.com/opf/openproject `lib/open_project/custom_styles/color_themes.rb` (`PRIMER_PRIMARY_BUTTON_COLOR = "#1F883D"`, `ACCENT_COLOR = "#0F41B5"`), `app/assets/images/icon_logo.svg`; CSS of https://www.openproject.org/ | Inherits GitHub Primer's green button. |
| **Redmine** | Issue tracker (OSS) | Red `#B50808`, `#C61818`, `#CE3129`, `#9C0000` + grey `#4D4D4D` | No coloured primary: submit `--oc-white` with grey border; header `#3A78A3`, top menu `#234761` | **Yes** | github.com/edavis10/redmine_logo `redmine_logo.svg` (linked from https://www.redmine.org/projects/redmine/wiki/Logo); github.com/redmine/redmine `app/assets/stylesheets/application.css` (lines 46–47, 871–874) | |
| **Trello** (Atlassian) | Kanban | Tile `#1558BC` | ADS brand.bold `#1868DB` / `#669DF1` (u that Trello's board UI is fully on ADS) | **No** (blue/blue) | `@atlaskit/logo@23.3.3` `trello`; `@atlaskit/tokens` | |
| **Basecamp** | Project management | Yellow mark (webp image, not decoded; site `--oklch-yellow 0.9034 0.1292 91.09` = `#FFDC74`) (u) | mkt `.button { background: var(--color-blue) }` = oklch(0.5957 0.2005 256.64) `#117AF3`; app (u) | **Yes** (mkt) | https://basecamp.com/assets/css/root.css and other CSS of https://basecamp.com/ | |
| **Pylon** | B2B support | `#5B0EFF` (webclip PNG, decoded) | mkt `--surface--surface-brand #5B0EFF`; app (u) | **No** (mkt) | https://cdn.prod.website-files.com/6a2c6d7ab6674379553c0824/6a2c722c1b6ec8316309587e_webclip.png ; CSS of https://usepylon.com/ | |
| **Plain** | B2B support | Green `#2CE68C` + dark green `#092616` (favicon PNG, decoded) | mkt token `#1AD379` (green), dark `#0A2414`; app (u) | **No** (mkt) | https://framerusercontent.com/images/oPE9BwSE8LUYzrxvpHa5FCmXc.png ; HTML of https://www.plain.com/ (Framer tokens) | The only support tool in the set with a green brand. |
| **Featurebase** | Feedback + help desk | `#3B5BFF` (apple-touch-icon PNG, decoded) | mkt `--ui-accent #3B5BFF`, `--mk-brand #6366F1`; app (u) | **No** (mkt) | https://www.featurebase.app/apple-touch-icon.png ; CSS of https://www.featurebase.app/ | |
| **Canny** | Feedback | `#525DF9` (logo-icon PNG, decoded) | mkt CTA `--color-indigo-90 #525DF9`; app (u) | **No** (mkt) | https://assets.canny.io/ca54323fdfc87e9cc290d288a3f3e59cf1fd873c/logo-icon.png ; CSS of https://canny.io/ | |
| **Chatwoot** | Help desk (OSS) | "Chatwoot Blue `#2781F6`" | `n.brand #2781F6` (L and D; `--blue-9: 39 129 246` in both) | **No** | https://www.chatwoot.com/brand ; github.com/chatwoot/chatwoot `theme/colors.js` (line 229), `app/javascript/dashboard/components-next/button/Button.vue` (default solid blue → `bg-n-brand`), `app/javascript/dashboard/assets/scss/_next-colors.scss` | |
| **Frappe Helpdesk** | Help desk (OSS) | `#7D42FB` (violet; site `#7D3DFF`) | frappe-ui solid default theme gray: `bg-surface-gray-10` = gray-900 oklch(0.205 0 0) `#171717`; D near-white (darkMode gray/50) | **Yes** | github.com/frappe/helpdesk `.github/hd-logo.svg`; npm `frappe-ui@1.2.0` `src/components/Button/Button.vue`, `Button/types.ts` (`theme default: 'gray'`), `tailwind/tokens/colors.js`; https://frappe.io/helpdesk | Near-black primary, violet logo: the same split Trybun has now. |
| **Zammad** | Help desk (OSS) | Multicolour bird: `#E54011`, `#CA2317` (red-orange), `#FFCE33`, `#F39804`, `#FFDE85` (yellow/orange), `#009EC6` (cyan) | Desktop view: `primary` `bg-blue-800` = `#23A2CD` (cyan); `submit` `bg-yellow-300` = `#FFCE33`; mkt CTA `hsl(204,48%,11%)` `#0E1E29` and yellow `#F6BA08` | **Partly** (UI uses two logo hues) | github.com/zammad/zammad `logo.svg`, `app/frontend/apps/desktop/components/CommonButton/CommonButton.vue`, `app/frontend/apps/desktop/styles/tokens.css` (lines 51, 71); CSS of https://zammad.com/en | Zammad's `#E54011` is close to Trybun Vermilion (H 34.8 vs 32.6). The only product with a cyan UI primary. |

## Hue clusters

OKLCH hue per colour (brand = logo; action = main button). Height excluded.

| Bucket | Brand/logo colours | UI action colours (main button) |
|---|---|---|
| **neutral / near-black** | Plane `#121212`, Linear `#232326`, GitHub (black), Intercom (black), Notion (black), Huly `#36373D` | **GitLab `#3A383D` (2026)**, **monday rebrand flag `#242424`**, **Frappe UI `#171717`**; mkt only: Intercom, ClickUp `#202020`, Notion, Asana (inverted). Freshworks Crayons `#264966` is near-neutral navy (C 0.064). **Trybun Ink `#141A2E` sits here.** |
| **red (15–40)** | GitLab `#E24329`, Redmine `#B50808`/`#CE3129`, Asana coral `#F06A6A`, Zammad `#E54011`/`#CA2317` | none (red is reserved for "danger" everywhere). **Trybun Vermilion `#E0482C` sits here, almost on top of GitLab and Zammad.** |
| **orange (40–70)** | GitLab `#FC6D26`, ClickUp `#FC6D2D` (gradient stop), Zammad `#F39804` | none |
| **yellow (70–115)** | JSM tile `#FFC716`, monday `#FFCC00` (dot), Zammad `#FFCE33`, Basecamp (u) | Zammad "submit" `#FFCE33` only |
| **green (115–165)** | GitHub brand `#0FBF3E`, Freshdesk `#00AC4C`, Plain `#2CE68C`, monday `#00CA72` (dot) | GitHub `#1F883D`/`#238636`, OpenProject `#1F883D` (Primer), Plain mkt `#1AD379` |
| **teal (165–195)** | none in this set (see the wide survey) | none in this set |
| **cyan (195–240)** | Zendesk kale `#03363D` (dark, low chroma), Zammad `#009EC6` | Zammad `#23A2CD`; Plane dark `#2893CC` at the 238° edge |
| **blue (240–268)** | Jira `#1868DB`, Trello `#1558BC`, Help Scout `#0064F0`, OpenProject `#0F41B5`/`#1A67A3`, Chatwoot `#2781F6`, ClickUp `#0091FF` (stop) | **Most crowded**: Atlassian (Jira, JSM, Trello) `#1868DB`, YouTrack `#3369D6`, Zendesk `#1F73B7`, monday `#0073EA`, Huly `#205DC2`, Chatwoot `#2781F6`, Help Scout `#0064F0`, Plane `#006399` (243°), Basecamp mkt `#117AF3`, GitLab pre-2026; links/focus of almost everyone (Primer `#0969DA`). **Trybun Blue `#2563EB` sits here.** |
| **indigo (268–285)** | Shortcut `#494BCB`, Canny `#525DF9`, Featurebase `#3B5BFF`, Pylon `#5B0EFF`, ClickUp `#6647F0` | Linear `#5E6AD2`/`#7170FF`, Shortcut, Canny, Featurebase, Pylon (mkt), monday mkt `#6161FF` |
| **violet (285–315)** | Front `#A857F1`, Frappe Helpdesk `#7D42FB`, GitLab `#7759C2`, monday rebrand `#792CDC` | Front mkt `#8034BF` |
| **magenta / pink (315–15)** | YouTrack `#FB43FF`→`#FB406D`, ClickUp `#FF02F0`, monday `#FB275D` | none |

### What is crowded

1. **Blue 240–268° is saturated** for UI action: about 10 of the ~24 products with a known action colour, including the two biggest (Atlassian, Zendesk) and monday. Trybun's current focus blue `#2563EB` (263°) sits in the middle of it. Blue as a *focus/link* colour is convention, not identity, so that is acceptable for focus. As a brand or primary it would not set Trybun apart.
2. **Indigo/violet 268–315°** is the "modern SaaS" cluster: Linear, Shortcut, Canny, Featurebase, Pylon, Front, Frappe Helpdesk, ClickUp, monday's coming rebrand. A purple Trybun would read as "another Linear-alike".
3. **Near-black primary buttons are a 2026 trend, not an outlier**: GitLab removed blue from buttons (May–June 2026), monday's flagged rebrand uses an "inverted CTA" `#242424`, frappe-ui (Frappe Helpdesk) defaults to `#171717`, and Intercom, ClickUp, Notion and Asana do it on their marketing sites. Trybun's Ink primary already matches this. Monochrome *logos* are also common (Plane, Linear, GitHub, Intercom, Notion, Huly). Black as a primary is therefore current, but it is not a differentiator.

### Who uses orange / red / vermilion

- Logos only, never a primary button: GitLab (tanuki `#E24329`/`#FC6D26`), Zammad (`#E54011`/`#CA2317`), Redmine (`#B50808`…), Asana coral (`#F06A6A`), ClickUp gradient stop (`#FC6D2D`), Huly marketing accent `#FF5F0B` (u), Intercom marketing `#FF5600` (u).
- **Direct collision:** Trybun Vermilion `#E0482C` (L 0.61, C 0.193, H 32.6) is a near-match for GitLab `#E24329` (L 0.61, C 0.200, H 32.0) and close to Zammad `#E54011` (H 34.8). GitLab is a developer tool and Zammad is an open-source self-hosted help desk: these are Trybun's two nearest neighbours.
- No product uses red/orange as the action colour, because red means "danger/destructive" in every design system checked (Primer, ADS, Garden, Pajamas, Ring UI, Huly, frappe-ui all have a red danger variant).

### Who uses teal / green

- **Teal (165–195°): nobody in these 30 products**, neither as logo nor as action colour. The wider survey of 2026-11-27 ([`2026-11-27-brand-colour-landscape-wide.md`](2026-11-27-brand-colour-landscape-wide.md)) finds teal in 7 of 169 logos and 5 of 51 action colours, none of them a help desk, and close neighbours of the exact values first chosen (WeKan, Odoo, Zendesk Kale).
- **Cyan (195–240°): sparse**. Only Zammad (UI primary `#23A2CD`, logo accent `#009EC6`), Zendesk's dark kale `#03363D` (H 209, L 0.31: reads as near-black green-teal, not as a bright teal), and Plane's dark-mode azure at the edge.
- **Green: moderate**. GitHub/Primer's green "create" button (also inherited by OpenProject), Freshdesk's product icon, Plain's whole brand, and one monday dot. Green also carries the "success" meaning in every system.

### Free hues in this category

| Hue | Status | Note |
|---|---|---|
| Teal 165–195° | **Free in this set**; rare in the wide survey | No product in the set. Nearest: Zammad cyan (≈225°), Zendesk kale (209°, dark), Plain/GitHub green (146–156°). |
| Orange 40–70° as a *primary* | **Free as UI action**; used in logos (GitLab, ClickUp, Zammad) | Contrast caution: mid-orange fails 4.5:1 with white text unless darkened. |
| Yellow / amber 70–115° | **Nearly free**: logos (JSM tile, monday dot, Basecamp, Zammad) and Zammad "submit" only | Needs dark text on the button (as Zammad does with black on `#FFCE33`). |
| Magenta/pink 315–15° | **Free as UI action**; logos only (YouTrack, ClickUp, monday dot) | |
| Red 15–40° | Used in logos of the nearest neighbours; **not free for Trybun's current vermilion**; unusable as a primary (danger) | |
| Blue, indigo, violet | **Crowded** | |
| Neutral black | **Crowded and trending** (GitLab, monday, Frappe) | Fine as a primary for a Plane-style UI, but does not differentiate. |

## Confidence

- **High** (token packages or repositories, read directly): Plane, Atlassian/Jira/JSM/Trello logos and tokens, YouTrack (Ring UI + official logo), GitHub, GitLab, Zendesk UI, Freshworks Crayons, monday Vibe, Huly, OpenProject, Redmine, Chatwoot, Frappe Helpdesk, Zammad.
- **Medium** (official logo file or brand page, plus marketing CSS; in-app button not seen): Linear, Help Scout, Front, Asana, ClickUp, Shortcut, Pylon, Plain, Featurebase, Canny, Notion, Intercom, Freshdesk logo.
- **Low / (u)**: Zendesk logo itself (site 403), Basecamp logo hex (webp, not decoded), in-app buttons of all closed SaaS products, Height (unreachable).

## Gaps and why

- Closed SaaS apps (Linear, Asana, ClickUp, Notion, Intercom, Front, Help Scout, Pylon, Plain, Canny, Featurebase, Shortcut, Basecamp) need a login to show the in-app button. Their marketing CTA was used instead and is labelled **mkt**. That is the closest official signal available without an account.
- zendesk.com returned HTTP 403 to plain curl. No user-agent spoofing was tried.
- WebP logos (Basecamp, Freshworks corporate) could not be decoded without image libraries, which are not installed.
- Colour-aggregator sites were not used at all.
