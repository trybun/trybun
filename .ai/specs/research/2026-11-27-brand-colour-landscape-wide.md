# Brand colour landscape – wide survey (software vendors)

- **Date:** 2026-11-27
- **Kind:** benchmark (desk research by an AI agent; no interviews, no usage data).
- **Method:** official logo files, brand/press pages, design-token packages and official repositories first; home-page inline logo, `theme-color` and CSS second (mkt); simple-icons v16.38.1 last (si); OKLCH and ΔE OK computed with an own, verified script. Details in "Method" below.
- **Reliability:** items marked **(u)** were not confirmed at an official source in this run; **(mkt)** values come from a marketing site; **(si)** values come from simple-icons only, which was shown to be outdated for seven vendors.
- **Relation to earlier work:** extends [`2026-11-27-category-colour-landscape.md`](2026-11-27-category-colour-landscape.md) (30 products), which was not redone; its 29 usable rows are reused as published.
- **Purpose:** input for the brand colour change (#573); not a requirement (Rule 8, [§2.8](../../../docs/spec/02-agent-rules.md)).
- **Outcome (2026-11-27):** a decision of the maintainer, not a requirement; it is recorded in the change specification of #573 (Rule 8). The maintainer chose the UI direction of Plane and the teal hue (candidate A). After the wide survey (this note) showed close neighbours of the first values, the teal was moved to action `#035F5C` and team branch `#071F20`, and after comparing the options on large graphics the maintainer chose light gold `#DCA81C` for the customer branch, as a brand accent only.
- **Question:** does Trybun's teal set it apart across a much broader set of vendors that a software team and its B2B customers see, or is teal common? The survey was run for the provisional values `#017272` (OKLCH L 0.50 C 0.085 H 194.8) and `#023237` (L 0.29 C 0.048 H 205.8); the values chosen afterwards (`#035F5C`, `#071F20`, `#DCA81C`) are covered in the section "Nearest neighbours of the chosen values".
- **Scope:** 156 products in four groups (A help desk / ITSM / support 43, B work management / issue tracking 35, C developer platforms 52, D Polish / CEE 26; 13 of them were added to the products surveyed first, marked "ADDED"), **140 with a logo colour obtained** (108 official source, 18 simple-icons, 14 marketing site) and 16 not obtained (listed, not counted). Combined with the earlier 29: **169 logo colours, 51 known action colours**.

## Method

- Source order: (1) official logo files served by the vendor (SVG fills grepped; PNG decoded with a small pure-Python decoder, dominant opaque colour taken), official brand / press pages, official repositories (`gh api`, raw.githubusercontent.com) and design-token packages (npm tarballs: `@elastic/eui-theme-borealis@8.3.0`, `@fluentui/tokens@1.0.0-alpha.25`); (2) inline logo SVG and `theme-color` of the vendor home page; (3) the most-used chromatic colour of the home page or its CSS, marked **(mkt)**; (4) simple-icons **v16.38.1** (npm, published 2026-11-22 per `npm view simple-icons time`), marked **(si)**, only where (1)–(3) gave nothing. Plain `curl -s`, default user agent; sites that blocked (HTTP 403) were skipped.
- **(u)** = not confirmed at an official source in this run. Rows with no value are listed but not counted.
- simple-icons was checked against official sources where both were available. It is **stale** for Docker (`#2496ED` → `#6172FF`), DigitalOcean (`#0080FF` → monochrome logo + foam `#6FE0ED`), Elastic (`#005571` → six-colour logo, UI `#0B64DD`), Travis CI (`#3EAAAF` → monochrome), GitKraken (`#179287` → monochrome), MariaDB (`#003545` → near-black) and HubSpot (`#FF7A59` → `#FF4800`). Several of these stale values are teal or dark teal, so using simple-icons unchecked would have **overstated** teal.
- "Brand hex" = the dominant chromatic logo colour; multi-colour logos are counted by the dominant (or first) colour, and their other colours are listed and included in the ±20° and distance analysis. "Action" = main button colour where seen (mostly the marketing site, so mostly (mkt)); in-app buttons were not inspected except where tokens exist.
- OKLCH from sRGB hex with Björn Ottosson's OKLab matrices (own script). Verified: `#FF0000` → L 0.628 C 0.258 H 29.2, `#00FF00` → 0.866 / 0.295 / 142.5, `#0000FF` → 0.452 / 0.313 / 264.1 (the CSS Color 4 reference values), and `#017272` → 0.500 / 0.085 / 194.8, `#E0482C` → 0.613 / 0.193 / 32.6, `#2563EB` → 0.546 / 0.215 / 262.9 (the values in the earlier note). ΔE OK = Euclidean distance in OKLab. CSS Color 4 uses ΔE OK 0.02 as the just-noticeable difference (JND) in its gamut-mapping algorithm; that is the yardstick for "near".
- Buckets: red 15–40, orange 40–70, yellow 70–115, green 115–165, teal 165–195, cyan 195–240, blue 240–268, indigo 268–285, violet 285–315, magenta/pink 315–15; neutral when C < 0.045.

## Table

Group: A help desk/ITSM/support, B work management/issue tracking, C developer platforms/tools, D Polish/CEE. "ADDED" = added to the products surveyed first.

| Product | Group | Brand hex (logo) | OKLCH | Bucket | Other logo colours | UI action hex (if known) | Source | Notes |
|---|---|---|---|---|---|---|---|---|
| Zoho Desk / Zoho Projects | A | `#F40014` | L 0.61 C 0.248 H 28 | red | `#FFAF00` (yellow, H 76), `#009C3E` (green, H 148), `#006EB9` (blue, H 249) |  | https://www.zohowebstatic.com/sites/zweb/images/zoho_general_pages/zoho-logo-512.png (PNG decoded); (si v16.38.1) zoho #E42527 | Zoho corporate four-colour logo (red, yellow, green, blue in equal share); counted as red. Product icons not checked (u). One row for both products. |
| Freshservice | A | `#0387FF` | L 0.63 C 0.203 H 254 | blue |  | `#8512E0` (L 0.51 C 0.263 H 301; violet) | https://www.freshworks.com/beta/icons/template-2026/freshservice-logo-icon.svg; CSS/HTML of https://www.freshworks.com/freshservice/ | Action = Freshworks marketing violet (mkt). |
| ServiceNow | A | (u) not obtained |  |  |  |  | https://www.servicenow.com/ (HTTP 403 to curl); not in simple-icons | Not obtained. From memory only (u): dark wordmark around #293E40 / #032D42 and a green 'o' (#62D84E 'Wasabi', older #81B5A1). Not counted. |
| HappyFox | A | `#FF5A00` | L 0.68 C 0.214 H 40 | orange |  |  | https://astro.www.happyfox.com/.../brand/happyfox-orange-white.svg |  |
| Kayako | A | `#7F4EC4` | L 0.54 C 0.177 H 300 | violet | `#1E4142` (neutral, H 198) |  | https://kayako.com/wp-content/uploads/2025/07/kayako-one-logo-dark.svg; icon https://kayako.com/wp-content/uploads/2024/07/cropped-kayako-icon-180x180.png | Wordmark #1E4142 is a very dark desaturated teal (C 0.041, neutral). |
| Gorgias | A | `#000000` | L 0.00 C 0.000 H 0 | neutral |  |  | https://cdn.prod.website-files.com/5e4ff204e7b6f80e402d407a/669a5ab4a69be50c3a94800a_Gorgias%20Logo%20-%20Black.svg | SVG without fill = black; site near-black #1A1E23. |
| Kustomer | A | `#FBEC2A` | L 0.93 C 0.188 H 105 | yellow |  |  | https://www.kustomer.com/icon.png (PNG decoded) |  |
| HubSpot Service Hub | A | `#FF4800` | L 0.66 C 0.227 H 36 | red | `#FF7A59` (red, H 35) |  | https://www.hubspot.com/hubfs/WBZ%202025%20Rebrand/Hub%20Logos/SVGs/ProductIcons_ServiceHub_Icon_Orange.svg; theme-color #FF7A59 | 2025 rebrand orange; (si v16.38.1) still #FF7A59. |
| Salesforce Service Cloud | A | `#00B3FF` | L 0.73 C 0.161 H 238 | cyan |  |  | https://wp.sfdcdigital.com/en-us/wp-content/uploads/sites/4/2024/11/logo-salesforce.svg | Site also navy #032D60 and pink #FF538A (mkt). |
| osTicket | A | `#F68E2B` | L 0.74 C 0.163 H 58 | orange |  |  | https://osticket.com/wp-content/uploads/2021/03/cropped-ost-icon-512-180x180.png (PNG decoded) | Site green #3CB878 (mkt). |
| Request Tracker | A | `#244E8A` (mkt) | L 0.43 C 0.110 H 258 | blue |  |  | HTML of https://bestpractical.com/request-tracker | Most-used chromatic site colour; logo not checked (u). |
| GLPI | A | `#00A5F3` | L 0.69 C 0.159 H 241 | blue |  |  | https://www.glpi-project.org/wp-content/uploads/2025/10/cropped-glpi-logo-ig-180x180.png; glpi-teclib-color-logo.svg |  |
| Znuny | A | (u) not obtained |  |  |  |  | https://www.znuny.com/assets/img/znuny-logo.svg (white #F2F2F2 version only) | Colour logo not found; site near-black #212327. Not counted. |
| OTOBO | A | `#0000FF` | L 0.45 C 0.313 H 264 | blue | `#000033` (blue, H 264) |  | https://otobo.io/wp-content/uploads/2024/07/favicon-96x96-1.png (PNG decoded) | Site #15779B (cyan, mkt). |
| UVdesk | A | `#8473F3` (mkt) | L 0.63 C 0.185 H 286 | violet |  |  | HTML of https://www.uvdesk.com/ | Logo file not found (u). |
| Libredesk | A | `#1A1A1A` | L 0.22 C 0.000 H 90 | neutral | `#FFAE2C` (yellow, H 73) |  | https://libredesk.io/apple-touch-icon-v2.png (PNG decoded) | Near-black tile with amber mark. |
| Deskpro | A | `#090C2F` | L 0.18 C 0.069 H 273 | indigo |  |  | https://2401116.fs1.hubspotusercontent-na1.net/hubfs/2401116/Website/Static/deskpro-logo.svg |  |
| Groove (now Helply) | A | (u) not obtained |  |  |  |  | https://www.groovehq.com/ redirects to Helply; logo PNG 404 | #0D9488 on the page is only an avatar background, not brand. Not counted. |
| LiveAgent | A | `#F6921E` | L 0.75 C 0.165 H 62 | orange | `#212121` (neutral, H 90) |  | https://images.liveagent.com/images/logo.svg |  |
| Hiver | A | `#030407` | L 0.11 C 0.011 H 267 | neutral | `#FDB022` (yellow, H 76) |  | https://hiverhq.com/wp-content/themes/hello-elementor-child/assets/images/hiver-logo-main.svg |  |
| Missive | A | (u) not obtained |  |  |  |  | https://missiveapp.com/ (no logo colour found) | Not counted. |
| Trengo | A | `#021631` | L 0.20 C 0.061 H 255 | blue |  | `#8557FF` (L 0.60 C 0.235 H 290; violet) | https://cdn.prod.website-files.com/65b287adb93277a8f53ea884/65b6c06dd9243a672e778a2f_trengo-logo.svg; site CSS | Action = site violet (mkt). |
| Crisp | A | `#1972F5` (mkt) | L 0.58 C 0.212 H 259 | blue | `#29CAFB` (cyan, H 225) |  | HTML of https://crisp.chat/en/; https://crisp.chat/favicons/apple-touch-icon.png (blue-cyan gradient) |  |
| tawk.to | A | `#21B14B` | L 0.67 C 0.184 H 148 | green | `#F071A8` (magenta, H 355) |  | https://www.tawk.to/tawk-logo.png (PNG decoded); site #03A84E |  |
| LiveChat / Text (PL) | A | `#FF5100` (si) | L 0.67 C 0.221 H 38 | red |  |  | https://www.text.com/ (top colour #FF5100); (si v16.38.1) livechat #FF5100 | livechat.com now shows the 'Text by LiveChat' wordmark #1B1B20. |
| Tidio (PL) | A | `#000000` | L 0.00 C 0.000 H 0 | neutral |  | `#0566FF` (L 0.56 C 0.240 H 261; blue) | https://www.tidio.com/images/brand-logos/tidio-logo.svg (no fill = currentColor); site CSS | Action = site blue (mkt). |
| SysAid | A | `#DEFF00` | L 0.94 C 0.221 H 119 | green | `#6BD9B9` (teal, H 172) |  | https://cdn.sysaid.com/wp-content/uploads/logo-v2.svg (via nitrocdn) | Logo = lime + light mint-teal #6BD9B9 (H 172, L 0.81); site dark green #122C20. |
| ManageEngine ServiceDesk Plus | A | (u) not obtained |  |  |  |  | https://www.manageengine.com/products/service-desk/ (no logo colour in HTML) | Not counted. |
| TOPdesk | A | (u) not obtained |  |  |  |  | https://www.topdesk.com/en/ (HTTP 403) | Not counted. |
| Halo ITSM | A | (u) not obtained |  |  |  | `#00D2C4` (L 0.78 C 0.136 H 186; teal) | HTML of https://haloitsm.com/ (--wp--preset--color--theme-primary: #00d2c4; button background) | Logo is WebP (not decoded) (u). ACTION colour is teal. |
| Jitbit | A | `#FF4E50` | L 0.67 C 0.213 H 24 | red |  |  | https://www.jitbit.com/favicon.png (PNG decoded) |  |
| Spiceworks | A | (u) not obtained |  |  |  |  | https://www.spiceworks.com/ (logo WebP, not decoded) | Not counted. |
| Faveo | A | `#3DA9D4` (mkt) | L 0.69 C 0.115 H 229 | cyan |  |  | HTML of https://www.faveohelpdesk.com/ | Logo WebP (u). |
| Freshchat | A | `#8512E0` (mkt) | L 0.51 C 0.263 H 301 | violet |  |  | HTML of https://www.freshworks.com/live-chat-software/ (Freshworks violet); product icon 404 | Freshworks umbrella colour. |
| Gladly | A | `#009B00` | L 0.60 C 0.203 H 142 | green |  |  | https://www.gladly.com/icon.svg (embedded PNG palette) |  |
| Re:amaze | A | `#00BADC` | L 0.73 C 0.130 H 217 | cyan |  |  | https://cdn.reamaze.com/assets/site/logo-white-...png (PNG decoded) |  |
| Dixa | A | `#171512` | L 0.20 C 0.007 H 78 | neutral |  | `#5644D8` (L 0.50 C 0.215 H 281; indigo) | https://cdn.prod.website-files.com/694a79a0b33f026ed61a478b/694abd355cfa82233ac80228_logo.svg; site CSS | Action = site indigo (mkt). |
| Odoo (Helpdesk app) | A | `#714B67` | L 0.46 C 0.066 H 337 | magenta |  | `#017E84` (L 0.54 C 0.092 H 201; cyan) | github.com/odoo/odoo addons/web/static/src/scss/primary_variables.scss (master: $o-enterprise-color #714B67, $o-enterprise-action-color #017e84, $o-community-color #71639e); https://odoocdn.com/web/assets/1/00d8416/web.assets_frontend.min.css (#017E84 x118) | ADDED. Enterprise action colour is cyan (H 201, next to the teal border); community action is #71639E. That Enterprise buttons use it is inferred from the variable name (web_enterprise is closed) (u). |
| FreeScout | A | `#5CB85C` | L 0.70 C 0.156 H 144 | green | `#337AB7` (blue, H 248) |  | https://freescout.net/wp-content/uploads/2018/10/freescout-logo.png (PNG decoded) | ADDED (OSS help desk). |
| HESK | A | `#09A033` | L 0.61 C 0.186 H 146 | green | `#353535` (neutral, H 90) |  | https://cdn.hesk.com/images/logo.png (PNG decoded) | ADDED (self-hosted help desk). |
| HelpDesk.com (PL) | A | `#2FC774` | L 0.73 C 0.172 H 154 | green | `#000000` (neutral, H 0) |  | https://www.helpdesk.com/helpdesk-logo.svg | ADDED (Text/LiveChat Inc., Wrocław). |
| Sugester (PL) | A | `#32A9DE` | L 0.69 C 0.127 H 233 | cyan |  |  | inline logo in https://sugester.pl/ ; theme-color #32A9DE | ADDED (Polish help desk/CRM). |
| Bitrix24 | A | `#00629A` | L 0.48 C 0.118 H 244 | blue | `#3FC0F0` (cyan, H 228) | `#409EEF` (L 0.68 C 0.149 H 248; blue) | inline logo in https://www.bitrix24.pl/ ; site CSS | ADDED (Polish site bitrix24.pl). Action = site blue (mkt). |
| Wrike | B | `#00E05C` | L 0.79 C 0.228 H 148 | green | `#162136` (neutral, H 263) |  | https://www.wrike.com/tp/storage/uploads/ea10c069-.../wrike-website-logo-light.svg |  |
| Smartsheet | B | `#0E2947` | L 0.28 C 0.065 H 253 | blue |  | `#0244D1` (L 0.46 C 0.223 H 263; blue) | https://www.smartsheet.com/sites/default/files/smartsheet-logo-blue-new.svg; site CSS | Action = site blue (mkt). |
| Teamwork.com | B | `#FF22B1` | L 0.67 C 0.268 H 348 | magenta | `#1D1C39` (indigo, H 283) |  | https://cdn-website.teamwork.com/images/logo/teamwork-logo.svg |  |
| Taiga | B | `#837093` | L 0.58 C 0.057 H 309 | violet | `#A2F3AC` (green, H 147), `#665D74` (neutral, H 303), `#8CD492` (green, H 146) |  | https://taiga.io/media/images/favicon.2e16d0ba.fill-152x152.png (PNG decoded) | Multi-colour pastel hexagon; counted by first colour. |
| Leantime | B | `#1A76B7` (mkt) | L 0.55 C 0.130 H 246 | blue |  |  | HTML of https://leantime.io/ | Logo WebP gradient (u). |
| Kanboard | B | `#D40000` | L 0.55 C 0.224 H 29 | red | `#2B0000` (red, H 29) |  | https://kanboard.org/assets/img/touch-icon-iphone-retina.png (PNG decoded) |  |
| Tuleap | B | `#FF6E30` | L 0.71 C 0.191 H 41 | orange |  |  | https://www.tuleap.com/wp-content/uploads/2025/07/favicon-1.svg |  |
| Targetprocess (IBM) | B | `#008F89` (mkt) | L 0.59 C 0.101 H 190 | teal | `#64E892` (green, H 152) |  | inline SVG on https://www.apptio.com/products/targetprocess/ (fill #008f89) | Teal fill in an inline product SVG on the IBM page; that it is the product logo is (u). |
| Azure DevOps | B | (u) not obtained |  |  |  |  | https://azure.microsoft.com/... (no colour in HTML); not in simple-icons | Microsoft blue (u). Not counted. |
| Pivotal Tracker | B | `#517A9E` (si) | L 0.56 C 0.072 H 246 | blue |  |  | (si v16.38.1) | Product retired 2025 (u). |
| Productboard | B | `#0071E1` | L 0.56 C 0.191 H 256 | blue | `#F84136` (red, H 28), `#FFC600` (yellow, H 88) |  | https://www.productboard.com/apple-touch-icon.png (PNG decoded) |  |
| Aha! | B | `#0073CF` | L 0.55 C 0.166 H 252 | blue |  |  | https://www.aha.io/favicon.png (PNG decoded) |  |
| Fider | B | `#0D77B3` | L 0.55 C 0.126 H 242 | blue | `#12827F` (teal, H 192), `#FFC951` (yellow, H 84), `#FDBC3D` (yellow, H 80) |  | inline logo SVG on https://fider.io/ | Multi-colour; one of three main colours is teal #12827F. |
| Nifty | B | `#019B8E` | L 0.62 C 0.109 H 184 | teal | `#0EE3D1` (teal, H 185), `#01BFAF` (teal, H 184) | `#00857A` (L 0.55 C 0.098 H 185; teal) | https://niftypm.com/images/v7/nifty-logo.svg; site CSS --color-brand-fill #00857a | TEAL logo and teal brand fill. |
| Hive | B | `#FF7A00` (si) | L 0.72 C 0.190 H 51 | orange |  |  | (si v16.38.1) | Site navy #0D1B3E (mkt). |
| Airtable | B | `#18BFFF` (si) | L 0.76 C 0.151 H 232 | cyan | `#FCB42A` (yellow, H 78), `#FC4777` (magenta, H 10) |  | (si v16.38.1); site #254FAD | Multi-colour logo. |
| Coda | B | `#F46A54` (si) | L 0.69 C 0.174 H 31 | red |  |  | (si v16.38.1); site #212121 | Coda is being rebranded as Superhuman Docs (2026) (u). |
| Miro | B | `#FFDD33` | L 0.90 C 0.174 H 97 | yellow | `#050038` (indigo, H 272) |  | inline logo on https://miro.com/ |  |
| Confluence | B | `#1868DB` | L 0.54 C 0.191 H 259 | blue |  | `#1868DB` (L 0.54 C 0.191 H 259; blue) | inline ADS tile on https://www.atlassian.com/software/confluence |  |
| Bitbucket | B | `#1868DB` | L 0.54 C 0.191 H 259 | blue |  | `#1868DB` (L 0.54 C 0.191 H 259; blue) | inline ADS tile on https://bitbucket.org/product/ |  |
| Gitea | B | `#609926` | L 0.62 C 0.156 H 133 | green |  |  | https://raw.githubusercontent.com/go-gitea/gitea/main/assets/logo.svg |  |
| Forgejo | B | `#FF6600` | L 0.70 C 0.204 H 43 | orange | `#D40000` (red, H 29) |  | https://forgejo.org/favicon.svg |  |
| Codeberg | B | `#2185D0` | L 0.60 C 0.144 H 247 | blue |  |  | https://codeberg.org/assets/img/svg/cb-logo.svg |  |
| Sourcehut | B | `#888888` | L 0.63 C 0.000 H 90 | neutral |  |  | https://sourcehut.org/logo.svg | Grey. |
| Phorge | B | (u) not obtained |  |  |  |  | https://we.phorge.it/ (mask icon only) | Not counted. |
| Bugzilla | B | `#F6BD6D` | L 0.83 C 0.118 H 74 | yellow | `#5A222F` (magenta, H 8), `#C7584D` (red, H 28) | `#9248C8` (L 0.55 C 0.195 H 308; violet) | https://www.bugzilla.org/assets/img/logo-header.svg; theme-color #9248c8 | Multi-colour bug; theme-color violet. |
| MantisBT | B | (u) not obtained |  |  |  |  | https://mantisbt.org/images/mantis_logo_262x90.png (interlaced PNG, not decoded) | Not counted. |
| Backlog (Nulab) | B | `#42CE9F` (mkt) | L 0.76 C 0.138 H 166 | teal |  |  | HTML of https://nulab.com/backlog/ | Logo not isolated (u). |
| Redbooth | B | `#F23A4B` | L 0.63 C 0.218 H 22 | red |  |  | https://redbooth.com/v_assets/logos/redbooth-logo.svg |  |
| Podio | B | (u) not obtained |  |  |  |  | https://podio.com/ (Progress page; only Progress logo) | Not counted. |
| Kantree | B | `#000000` | L 0.00 C 0.000 H 0 | neutral |  | `#2CBE85` (L 0.71 C 0.146 H 161; green) | https://kantree.io/static/promo/img/logo.png (PNG decoded); site CSS | Action = site green (mkt). |
| Vikunja | B | `#196AFF` (si) | L 0.57 C 0.234 H 262 | blue |  |  | (si v16.38.1); site #196AFF |  |
| Focalboard | B | `#0058CC` | L 0.49 C 0.194 H 259 | blue |  |  | https://raw.githubusercontent.com/mattermost-community/focalboard/main/webapp/static/favicon.svg |  |
| WeKan | B | `#007289` | L 0.51 C 0.092 H 218 | cyan | `#00778C` (cyan, H 216), `#007A8E` (cyan, H 214) |  | https://wekan.fi/wekan-logo.png (PNG decoded) | OSS Kanban; deep cyan (H 218), very close to #017272. |
| Planka | B | (u) not obtained |  |  |  |  | https://planka.app/ (favicon.ico only) | Not counted. |
| Netlify | C | `#131619` | L 0.20 C 0.008 H 248 | neutral |  | `#32E6E2` (L 0.84 C 0.136 H 193; teal) | https://www.netlify.com/assets/logos/netlify-logo-full.zip (logo-netlify-full-lightmode.svg); https://www.netlify.com/_astro/RebrandLayout.Dlm8VuNA.css (--ntl-button-primary-bg-color: var(--ntl-teal-200) = #32e6e2; a rebrand layer maps teal-200 to turquoise-400 #63e6d0) | Logo now monochrome; TEAL primary button on the marketing site; brand-primary token is blue #2E51ED. |
| Vercel | C | `#000000` | L 0.00 C 0.000 H 0 | neutral |  |  | theme-color of https://vercel.com/; (si v16.38.1) |  |
| Elastic | C | `#0B64DD` | L 0.53 C 0.200 H 259 | blue | `#02BCB7` (teal, H 191), `#FEC514` (yellow, H 87), `#F04E98` (magenta, H 356), `#9ADC30` (green, H 129), `#1BA9F5` (blue, H 240) | `#0B64DD` (L 0.53 C 0.200 H 259; blue) | https://www.elastic.co/favicon.svg; npm @elastic/eui-theme-borealis@8.3.0 lib/eui_theme_borealis_light.json (euiColorPrimary #0B64DD) | Six-colour cluster logo, one tile teal #02BCB7. (si v16.38.1) #005571 is outdated. |
| Grafana | C | `#FF671D` | L 0.70 C 0.201 H 42 | orange |  |  | https://a-us.storyblok.com/f/567658451994139/143x24/8360e7918b/grafana-header-logo.svg |  |
| Sentry | C | `#362D59` | L 0.33 C 0.076 H 291 | violet | `#6A5FC1` (violet, H 285) |  | https://sentry.io/branding/ |  |
| PagerDuty | C | `#06AC38` (si) | L 0.65 C 0.197 H 146 | green |  |  | (si v16.38.1); site logo is monochrome currentColor | Site shows monochrome logo; green is (si). |
| Opsgenie | C | `#1868DB` | L 0.54 C 0.191 H 259 | blue |  | `#1868DB` (L 0.54 C 0.191 H 259; blue) | inline ADS tile on https://www.atlassian.com/software/opsgenie |  |
| Postman | C | `#FF6C37` | L 0.71 C 0.191 H 39 | red |  |  | https://voyager.postman.com/logo/postman-logo-icon-orange.svg |  |
| Docker | C | `#6172FF` | L 0.62 C 0.208 H 273 | indigo | `#101010` (neutral, H 90) |  | https://www.docker.com/company/newsroom/media-resources/ ('Primary Base HEX #6172FF') | (si v16.38.1) #2496ED is outdated (2025/26 rebrand). |
| Kubernetes | C | `#326CE5` | L 0.56 C 0.194 H 263 | blue |  |  | inline logo + theme-color of https://kubernetes.io/ |  |
| Supabase | C | `#3ECF8E` | L 0.76 C 0.154 H 159 | green | `#249361` (green, H 159) |  | inline logo on https://supabase.com/ | Green (H 159), not teal. |
| DigitalOcean | C | `#000000` | L 0.00 C 0.000 H 0 | neutral |  | `#6FE0ED` (L 0.85 C 0.104 H 205; cyan) | https://www.digitalocean.com/press/brand ('Approved colors for Logo: White/Black'; 'brand accent is foam (teal/cyan)'; foam/200 #6FE0ED 'Brand button') | (si v16.38.1) #0080FF is outdated. |
| Heroku | C | `#5A1BA9` | L 0.41 C 0.202 H 296 | violet | `#9777BA` (violet, H 306) |  | theme-color of https://www.heroku.com/; apple-touch-icon PNG | #5EEAD4 on the page is editor-plugin CSS, not brand. |
| Render | C | `#000000` | L 0.00 C 0.000 H 0 | neutral |  |  | https://render.com/icon.svg |  |
| Fly.io | C | `#281950` | L 0.27 C 0.096 H 291 | violet | `#BA7BF0` (violet, H 307), `#5046E4` (indigo, H 277) |  | https://fly.io/phx/images/icons/fly_logo-...svg |  |
| Cloudflare | C | `#F38020` (si) | L 0.72 C 0.171 H 53 | orange | `#FF4801` (red, H 36) |  | (si v16.38.1); theme-color #ff4801 and inline logo #FF9910/#FF5F08 on https://www.cloudflare.com/ |  |
| Datadog | C | `#632CA6` (si) | L 0.44 C 0.183 H 299 | violet |  |  | (si v16.38.1); present in https://www.datadoghq.com/ HTML |  |
| New Relic | C | `#1CE783` | L 0.82 C 0.202 H 154 | green |  | `#008C99` (L 0.58 C 0.100 H 206; cyan) | https://newrelic.com/themes/custom/erno/assets/images/metadata/apple-touch-icon.png; theme-color #008c99 | theme-color is cyan (H 206), not a button (mkt). |
| Mattermost | C | `#1E325C` | L 0.32 C 0.079 H 263 | blue |  |  | https://mattermost.com/apple-touch-icon.png (PNG decoded) | (si v16.38.1) #0058CC. |
| Rocket.Chat | C | `#F5455C` | L 0.65 C 0.211 H 18 | red |  |  | HTML of https://www.rocket.chat/; (si v16.38.1) |  |
| Element | C | `#0DBD8B` | L 0.71 C 0.146 H 166 | teal |  |  | inline logo on https://element.io/ | H 165.6: on the green/teal border (C 0.146). |
| Matrix | C | `#000000` (si) | L 0.00 C 0.000 H 0 | neutral |  |  | (si v16.38.1); site logo white |  |
| Nextcloud | C | `#0082C9` | L 0.58 C 0.143 H 244 | blue |  |  | https://nextcloud.com/c/uploads/2026/04/Nextcloud_Hub-blue-logo-nav.svg |  |
| Keycloak | C | `#00B8E3` | L 0.73 C 0.135 H 222 | cyan | `#008AAA` (cyan, H 222), `#33C6E9` (cyan, H 218) |  | https://www.keycloak.org/resources/images/icon.svg | Cyan. |
| Zulip | C | `#6492FE` | L 0.68 C 0.167 H 265 | blue | `#7877FC` (indigo, H 280), `#50ADFF` (blue, H 248) |  | https://static.zulipchat.com/static/images/favicon.svg (gradient); (si v16.38.1) #6492FE |  |
| Slack | C | `#481A54` (mkt) | L 0.32 C 0.109 H 319 | magenta |  |  | https://slack.com/media-kit (aubergine #481A54 on page) | Logo is four-colour (#36C5F0/#2EB67D/#ECB22E/#E01E5A from memory, u); not in simple-icons. |
| Discord | C | `#5865F2` (si) | L 0.58 C 0.209 H 274 | indigo |  |  | (si v16.38.1); theme-color #161cbb |  |
| Microsoft Teams | C | `#5B5FC7` | L 0.54 C 0.159 H 278 | indigo |  | `#5B5FC7` (L 0.54 C 0.159 H 278; indigo) | npm @fluentui/tokens@1.0.0-alpha.25 brandTeams[80] #5b5fc7 |  |
| JetBrains | C | `#000000` | L 0.00 C 0.000 H 0 | neutral |  |  | theme-color of https://www.jetbrains.com/ | Company logo black; product logos multi-colour. |
| SonarQube | C | `#126ED3` | L 0.55 C 0.175 H 256 | blue |  |  | HTML of https://www.sonarsource.com/; (si v16.38.1) |  |
| Snyk | C | `#4C4A73` (si) | L 0.43 C 0.067 H 285 | violet |  |  | (si v16.38.1); wordmark SVG is currentColor |  |
| CircleCI | C | `#161616` | L 0.20 C 0.000 H 90 | neutral |  |  | theme-color of https://circleci.com/; (si v16.38.1) #343434 |  |
| Travis CI | C | `#EBEBEB` | L 0.94 C 0.000 H 90 | neutral |  |  | https://www.travis-ci.com/wp-content/uploads/2025/01/travis-ci-logo-svg-for-dark-bg.svg | 2025 logo is monochrome; (si v16.38.1) #3EAAAF (old teal) is outdated. |
| Jenkins | C | `#D24939` (si) | L 0.59 C 0.176 H 30 | red |  |  | (si v16.38.1); site #AA321E |  |
| Atlassian Statuspage | C | `#FFC716` | L 0.86 C 0.172 H 88 | yellow |  | `#1868DB` (L 0.54 C 0.191 H 259; blue) | inline ADS tile on https://www.atlassian.com/software/statuspage |  |
| Better Stack | C | `#000000` (si) | L 0.00 C 0.000 H 0 | neutral |  | `#7C87F7` (L 0.67 C 0.165 H 277; indigo) | (si v16.38.1); site CSS | Action = site indigo (mkt). |
| Uptime Kuma | C | `#5CDD8B` | L 0.81 C 0.163 H 153 | green |  |  | https://raw.githubusercontent.com/louislam/uptime-kuma/master/public/icon.svg |  |
| Plausible | C | `#4B38D8` | L 0.48 C 0.229 H 278 | indigo | `#909CF7` (indigo, H 277) |  | https://plausible.io/assets/images/icon/plausible_logo.svg |  |
| PostHog | C | `#FFB700` | L 0.83 C 0.171 H 80 | yellow | `#F54E00` (red, H 38), `#FFD849` (yellow, H 93) |  | https://posthog.com/brand/posthog-logomark.svg |  |
| Hotjar | C | `#FF3C00` (si) | L 0.65 C 0.235 H 34 | red |  |  | (si v16.38.1); site #FF5C5C |  |
| Mixpanel | C | `#7856FF` | L 0.59 C 0.237 H 286 | violet |  |  | HTML of https://mixpanel.com/ (217 uses); (si v16.38.1) |  |
| Segment (Twilio) | C | `#F22F46` (mkt) | L 0.63 C 0.226 H 21 | red |  |  | https://segment.com/ theme-color #f22f46 (Twilio) | Old Segment green #52BD95 (u) replaced by Twilio branding. |
| Twilio | C | `#F22F46` | L 0.63 C 0.226 H 21 | red |  |  | inline logo + theme-color on https://www.twilio.com/ |  |
| Stripe | C | `#635BFF` | L 0.58 C 0.235 H 278 | indigo | `#533AFD` (indigo, H 277) |  | https://stripe.com/newsroom/brand-assets; (si v16.38.1) |  |
| Zapier | C | `#FF4F00` | L 0.67 C 0.222 H 37 | red | `#201515` (neutral, H 19) |  | inline logo on https://zapier.com/ |  |
| n8n | C | `#FB6E96` | L 0.72 C 0.175 H 5 | magenta | `#FF85A3` (magenta, H 6) |  | https://n8n.io/brandguidelines/ | (si v16.38.1) #FF91AC. |
| Make | C | `#6D00CC` (si) | L 0.46 C 0.248 H 297 | violet |  |  | (si v16.38.1) (site HTTP 403) |  |
| GitKraken | C | `#1C1C1C` | L 0.23 C 0.000 H 90 | neutral |  |  | https://www.gitkraken.com/wp-content/uploads/2025/03/gitkraken-logo-stencil-monochrome-light.svg; theme-color #1C1C1C | ADDED. (si v16.38.1) #179287 (teal) is outdated. |
| MariaDB | C | `#0C0C0D` | L 0.15 C 0.002 H 286 | neutral |  |  | https://mariadb.com/images/mariadb-logo.svg | ADDED. (si v16.38.1) #003545 (dark teal) is outdated. |
| SUSE | C | `#0C322C` (si) | L 0.29 C 0.044 H 181 | neutral | `#30BA78` (green, H 157) |  | (si v16.38.1) (site HTTP 403) | ADDED. Very dark 'jungle' green-teal (C 0.044, neutral). |
| Tailwind CSS | C | `#38BDF8` | L 0.75 C 0.139 H 233 | cyan |  |  | theme-color of https://tailwindcss.com/ | ADDED. |
| Brevo | C | `#0B996E` | L 0.61 C 0.126 H 165 | green |  |  | https://corp-backend.brevo.com/wp-content/uploads/2025/07/Brevo_logo.svg | ADDED. Green (H 164.5), just below the teal bucket; site action violet #6358DE. |
| Comarch | D | `#00092E` | L 0.16 C 0.077 H 262 | blue |  | `#02A78E` (L 0.65 C 0.121 H 177; teal) | https://www.comarch.pl/files-pl/file_1265/Comarch_LogoRGB_DarkBlue.png; site CSS (.c-btn--emerald #02a78e) | Emerald is one button variant (mkt); main site blue #152A94. |
| Asseco | D | (u) not obtained |  |  |  |  | https://pl.asseco.com/ (HTTP 403) | Not counted. |
| enova365 (Soneta) | D | `#03D353` | L 0.76 C 0.221 H 148 | green | `#231F20` (neutral, H 1) |  | https://enova.pl/content/uploads/2026/04/stopka_logo_enova365.svg | Site dark background #002F2E (H 192, C 0.047) (mkt). |
| Symfonia | D | `#00DC00` (mkt) | L 0.78 C 0.264 H 142 | green |  |  | HTML of https://symfonia.pl/ | Logo WebP (u). |
| inFakt | D | `#068EDA` (mkt) | L 0.62 C 0.151 H 244 | blue |  |  | HTML of https://www.infakt.pl/ (403 page body) |  |
| Fakturownia | D | `#0872B9` | L 0.54 C 0.139 H 247 | blue | `#EE1D25` (red, H 27) |  | https://assets2.intum.net/1/cms/assets/fakturownia-logo.svg | Site yellow #FFD52E. |
| wFirma | D | `#1A0FA0` | L 0.34 C 0.209 H 270 | indigo | `#6F63FF` (indigo, H 281), `#F2418E` (magenta, H 359), `#F8BC48` (yellow, H 80) |  | https://wfirma.pl/_public/wf/img/website/icons/i-logo-wfirma-20-blue.svg |  |
| Brand24 | D | `#00EF88` | L 0.84 C 0.209 H 154 | green | `#171717` (neutral, H 90) |  | theme-color #00EF88 and inline logo on https://brand24.com/ |  |
| Booksy | D | `#218CAC` | L 0.60 C 0.103 H 223 | cyan |  |  | https://booksy.com/mp-2026-public/apple-touch-icon.png (PNG decoded) | Site accent lime #DFF304 (mkt). |
| Docplanner | D | `#00A085` | L 0.63 C 0.119 H 175 | teal | `#242727` (neutral, H 197) |  | https://www.docplanner.com/logos/logo-docplanner.svg | Teal at the green border (H 175.0). |
| ZnanyLekarz | D | `#007C68` (mkt) | L 0.52 C 0.098 H 176 | teal | `#006A59` (teal, H 177) |  | https://platform.docplanner.com/css/jade-homepage-rs-f2a247c0.css (znanylekarz.pl) | Logo PNG 404 (u). |
| Manago AI (ex-SALESmanago) | D | `#1ED760` | L 0.77 C 0.212 H 149 | green |  |  | https://www.salesmanago.com/assets/images/layout/footer/managoai_logo.png (PNG decoded) |  |
| Livespace | D | `#4FD465` | L 0.77 C 0.191 H 146 | green | `#041005` (neutral, H 146) |  | inline logo on https://www.livespace.io/; theme-color #7CE175 |  |
| Brainly | D | (u) not obtained |  |  |  |  | https://brainly.com/ (HTTP 403) | Not counted. |
| Allegro | D | `#FF5A00` (si) | L 0.68 C 0.214 H 40 | orange |  |  | (si v16.38.1) (site HTTP 403) |  |
| Synerise | D | `#0B68FF` (mkt) | L 0.57 C 0.238 H 261 | blue |  |  | HTML of https://synerise.com/ |  |
| Netguru | D | `#00D563` | L 0.76 C 0.210 H 150 | green | `#0B0C0D` (neutral, H 248) |  | https://www.netguru.com/hubfs/_N23/assets/logos/netguru.svg |  |
| 10Clouds | D | `#081735` | L 0.21 C 0.063 H 262 | blue |  |  | https://10clouds.com/favicon-brandbook-v1.svg | Site also #29555E (mkt). |
| STX Next | D | `#24C2C0` | L 0.74 C 0.121 H 193 | teal |  | `#00B2A9` (L 0.69 C 0.119 H 188; teal) | https://cdn.prod.website-files.com/607da316d521344f6c170ad5/60827aa8d8bbfe0a3f79f3dd_favicon.png (PNG decoded); site CSS | TEAL. |
| Divante | D | `#843DFF` | L 0.57 C 0.263 H 293 | violet |  |  | https://www.divante.com/logo-cbui.svg | theme-color #2151F6. |
| Packhelp | D | `#2757FF` | L 0.54 C 0.253 H 265 | blue |  |  | https://packhelp.com/_astro/logo-packhelp.1iheyVke.svg |  |
| Kontomatik | D | `#2E3F5B` | L 0.37 C 0.053 H 260 | blue |  |  | https://cdn.prod.website-files.com/61cb283c53d9477adcf66f2e/61d098cf4fca5b25da1931fa_Kontomatik%20Logo.svg |  |
| PayU | D | (u) not obtained |  |  |  |  | https://poland.payu.com/ (HTTP 403) | Not counted. |
| Przelewy24 | D | `#D13239` | L 0.57 C 0.195 H 24 | red |  |  | https://www.przelewy24.pl/themes/przelewy24/assets/img/base/przelewy24_logo_2022.svg |  |
| Tpay | D | `#072653` | L 0.28 C 0.090 H 258 | blue |  | `#08854B` (L 0.54 C 0.133 H 155; green) | inline logo on https://tpay.com/; site CSS | Action = site green (mkt). |
| GetResponse | D | `#00BAFF` | L 0.74 C 0.156 H 234 | cyan |  |  | inline logo on https://www.getresponse.pl/ | ADDED (Polish). |

## 1. Counts per hue bucket

Logo = primary brand colour (one per product). "Earlier 29" = the earlier note's rows as published there. Action = known main-button colours (mostly marketing-site CTAs).

| Bucket | Logo A | Logo B | Logo C | Logo D | **Logo new total** | Logo earlier 29 | **Logo all** | Action new (known) | Action earlier | **Action all** |
|---|---|---|---|---|---|---|---|---|---|---|
| neutral | 5 | 2 | 12 | 0 | **19** | 6 | **25** | 0 | 5 | **5** |
| red | 4 | 3 | 7 | 1 | **15** | 3 | **18** | 0 | 0 | **0** |
| orange | 3 | 3 | 2 | 1 | **9** | 1 | **10** | 0 | 0 | **0** |
| yellow | 1 | 2 | 2 | 0 | **5** | 2 | **7** | 0 | 0 | **0** |
| green | 6 | 2 | 5 | 6 | **19** | 2 | **21** | 2 | 3 | **5** |
| teal | 0 | 3 | 1 | 3 | **7** | 0 | **7** | 5 | 0 | **5** |
| cyan | 4 | 2 | 2 | 2 | **10** | 1 | **11** | 3 | 1 | **4** |
| blue | 7 | 11 | 7 | 8 | **33** | 5 | **38** | 8 | 12 | **20** |
| indigo | 1 | 0 | 5 | 1 | **7** | 4 | **11** | 3 | 5 | **8** |
| violet | 3 | 1 | 7 | 1 | **12** | 2 | **14** | 3 | 1 | **4** |
| magenta | 1 | 1 | 2 | 0 | **4** | 3 | **7** | 0 | 0 | **0** |
| **total** | 35 | 30 | 52 | 23 | **140** | 29 | **169** | 24 | 27 | **51** |

Shares of all 169 logo values: blue 38 (22 %), neutral/black 25 (15 %), green 21 (12 %), red 18 (11 %), violet 14, cyan 11, indigo 11, orange 10, **teal 7 (4 %)**, yellow 7, magenta 7. Actions (51): blue 20 (39 %), indigo 8, neutral 5, green 5, **teal 5 (10 %)**, cyan 4, violet 4; red, orange, yellow and magenta 0.

Teal-bucket members: logos – Targetprocess `#008F89` (mkt; that it is the logo is (u)), Nifty `#019B8E`, Backlog `#42CE9F` (H 166, mkt), Element `#0DBD8B` (H 166), Docplanner `#00A085` (H 175.0), ZnanyLekarz `#007C68` (mkt), STX Next `#24C2C0`. **No help-desk/ITSM logo (group A) is teal.** Actions – Halo ITSM `#00D2C4` (mkt), Nifty `#00857A`, Netlify `#32E6E2` (mkt), Comarch `#02A78E` (one button variant), STX Next `#00B2A9` (mkt).

Fine histogram (15° bands, chromatic colours only, new + earlier):

| Hue band | Primary logo + action colours | incl. secondary logo colours |
|---|---|---|
| 0–15° | 2 | 5 |
| 15–30° | 11 | 16 |
| 30–45° | 13 | 16 |
| 45–60° | 3 | 3 |
| 60–75° | 2 | 3 |
| 75–90° | 3 | 11 |
| 90–105° | 3 | 4 |
| 105–120° | 1 | 1 |
| 120–135° | 1 | 2 |
| 135–150° | 14 | 17 |
| 150–165° | 10 | 13 |
| 165–180° | 5 | 7 |
| 180–195° | 7 | 11 |
| 195–210° | 4 | 4 |
| 210–225° | 4 | 9 |
| 225–240° | 7 | 8 |
| 240–255° | 16 | 20 |
| 255–270° | 45 | 46 |
| 270–285° | 16 | 23 |
| 285–300° | 12 | 13 |
| 300–315° | 6 | 8 |
| 315–330° | 2 | 2 |
| 330–345° | 2 | 2 |
| 345–360° | 1 | 4 |


## 2. Everyone within ±20° of H 195 (175–215°) with C ≥ 0.045

All roles (primary logo, secondary logo colour, action), new and earlier rows, sorted by distance to `#017272`.

| Product | Group | Role | Hex | L | C | H | ΔE OK to #017272 | ΔE OK to #023237 | Source kind |
|---|---|---|---|---|---|---|---|---|---|
| ZnanyLekarz | D | logo (primary) | `#007C68` | 0.52 | 0.098 | 176.2 | 0.040 | 0.242 | mkt |
| Odoo (Helpdesk app) | A | action | `#017E84` | 0.54 | 0.092 | 200.7 | 0.041 | 0.253 | o |
| ZnanyLekarz | D | logo (secondary) | `#006A59` | 0.47 | 0.087 | 176.5 | 0.042 | 0.186 | mkt |
| WeKan | B | logo (secondary) | `#007A8E` | 0.53 | 0.094 | 214.4 | 0.046 | 0.247 | o |
| Fider | B | logo (secondary) | `#12827F` | 0.55 | 0.091 | 191.9 | 0.050 | 0.264 | o |
| Nifty | B | action | `#00857A` | 0.55 | 0.098 | 184.7 | 0.058 | 0.270 | o |
| New Relic | C | action | `#008C99` | 0.58 | 0.100 | 206.3 | 0.088 | 0.299 | o |
| Targetprocess (IBM) | B | logo (primary) | `#008F89` | 0.59 | 0.101 | 189.6 | 0.088 | 0.302 | mkt |
| Nifty | B | logo (primary) | `#019B8E` | 0.62 | 0.109 | 184.5 | 0.123 | 0.336 | o |
| Comarch | D | action | `#02A78E` | 0.65 | 0.121 | 176.9 | 0.159 | 0.370 | o |
| STX Next | D | action | `#00B2A9` | 0.69 | 0.119 | 188.4 | 0.192 | 0.405 | o |
| Zendesk | earlier | logo (primary) | `#03363D` | 0.31 | 0.051 | 209.3 | 0.198 | 0.016 | earlier |
| Elastic | C | logo (secondary) | `#02BCB7` | 0.72 | 0.123 | 191.4 | 0.222 | 0.435 | o |
| Nifty | B | logo (secondary) | `#01BFAF` | 0.72 | 0.128 | 184.3 | 0.228 | 0.441 | o |
| STX Next | D | logo (primary) | `#24C2C0` | 0.74 | 0.121 | 193.5 | 0.242 | 0.455 | o |
| Halo ITSM | A | action | `#00D2C4` | 0.78 | 0.136 | 186.3 | 0.283 | 0.496 | mkt |
| Nifty | B | logo (secondary) | `#0EE3D1` | 0.82 | 0.144 | 184.7 | 0.330 | 0.543 | o |
| Netlify | C | action | `#32E6E2` | 0.84 | 0.136 | 192.5 | 0.344 | 0.557 | o |
| DigitalOcean | C | action | `#6FE0ED` | 0.85 | 0.104 | 205.4 | 0.346 | 0.558 | o |

Just outside the window but relevant: **WeKan** primary `#007289` (H 218, cyan, ΔE 0.038 – the single nearest colour of all to `#017272`), Docplanner `#00A085` (H 174.99, ΔE 0.139), SysAid `#6BD9B9` (H 172, light), Element `#0DBD8B` (H 166), Brevo `#0B996E` (H 165), Booksy `#218CAC` (H 223), Keycloak `#008AAA` (H 222).

### Closest neighbours of the provisional values in OKLab distance

Nearest 12 to `#017272` (all colours, any chroma):

| Rank | Product | Group | Role | Hex | OKLCH | ΔE OK |
|---|---|---|---|---|---|---|
| 1 | WeKan | B | logo (primary) | `#007289` | L 0.51 C 0.092 H 218 | 0.038 |
| 2 | ZnanyLekarz | D | logo (primary) | `#007C68` | L 0.52 C 0.098 H 176 | 0.040 |
| 3 | Odoo (Helpdesk app) | A | action | `#017E84` | L 0.54 C 0.092 H 201 | 0.041 |
| 4 | WeKan | B | logo (secondary) | `#00778C` | L 0.52 C 0.093 H 216 | 0.041 |
| 5 | ZnanyLekarz | D | logo (secondary) | `#006A59` | L 0.47 C 0.087 H 177 | 0.042 |
| 6 | WeKan | B | logo (secondary) | `#007A8E` | L 0.53 C 0.094 H 214 | 0.046 |
| 7 | Fider | B | logo (secondary) | `#12827F` | L 0.55 C 0.091 H 192 | 0.050 |
| 8 | Nifty | B | action | `#00857A` | L 0.55 C 0.098 H 185 | 0.058 |
| 9 | New Relic | C | action | `#008C99` | L 0.58 C 0.100 H 206 | 0.088 |
| 10 | Targetprocess (IBM) | B | logo (primary) | `#008F89` | L 0.59 C 0.101 H 190 | 0.088 |
| 11 | Plane | earlier | action | `#006399` | L 0.48 C 0.116 H 243 | 0.089 |
| 12 | Bitrix24 | A | logo (primary) | `#00629A` | L 0.48 C 0.118 H 244 | 0.092 |

Nearest 12 to `#023237` (all colours, any chroma):

| Rank | Product | Group | Role | Hex | OKLCH | ΔE OK |
|---|---|---|---|---|---|---|
| 1 | Zendesk | earlier | logo (primary) | `#03363D` | L 0.31 C 0.051 H 209 | 0.016 |
| 2 | SUSE | C | logo (primary) | `#0C322C` | L 0.29 C 0.044 H 181 | 0.021 |
| 3 | Docplanner | D | logo (secondary) | `#242727` | L 0.27 C 0.004 H 197 | 0.048 |
| 4 | Smartsheet | B | logo (primary) | `#0E2947` | L 0.28 C 0.065 H 253 | 0.049 |
| 5 | Linear | earlier | logo (primary) | `#232326` | L 0.26 C 0.006 H 286 | 0.058 |
| 6 | Wrike | B | logo (secondary) | `#162136` | L 0.25 C 0.043 H 263 | 0.060 |
| 7 | Kayako | A | logo (secondary) | `#1E4142` | L 0.35 C 0.041 H 198 | 0.060 |
| 8 | HESK | A | logo (secondary) | `#353535` | L 0.33 C 0.000 H 90 | 0.062 |
| 9 | LiveAgent | A | logo (secondary) | `#212121` | L 0.25 C 0.000 H 90 | 0.064 |
| 10 | Huly | earlier | logo (primary) | `#36373D` | L 0.34 C 0.011 H 278 | 0.067 |
| 11 | ClickUp | earlier | action | `#202020` | L 0.24 C 0.000 H 90 | 0.067 |
| 12 | enova365 (Soneta) | D | logo (secondary) | `#231F20` | L 0.24 C 0.006 H 1 | 0.071 |

### Who is in Trybun's direct category, and could be confused (provisional values)

- **`#017272` (provisional action colour).** Within ΔE ≤ 0.05 (about 2.5 JND) there are three products from the direct or adjacent category:
  - **WeKan** (open-source self-hosted Kanban – direct category) logo `#007289`, ΔE 0.038; cyan by this note's buckets (H 218 vs 195), same lightness and chroma.
  - **Odoo** Enterprise action colour `#017E84` (ΔE 0.041, H 201, cyan by this note's buckets). Odoo ships a Helpdesk app; how widely it is used in Poland or Europe was not checked (u). On odoo.com it is the secondary colour (118 uses in the frontend CSS); its logo is plum `#714B67`. That Enterprise in-app buttons use it is inferred from the variable name (u).
  - **Fider** (open-source feedback portal – direct category) logo tile `#12827F`, ΔE 0.050 (one of three logo colours).
  - Also close: Nifty (project management) brand fill `#00857A` ΔE 0.058 and logo `#019B8E`; ZnanyLekarz/Docplanner (a medical booking marketplace, not software for teams; its reach among Polish buyers was not measured (u)) `#007C68` ΔE 0.040; Targetprocess `#008F89` ΔE 0.088.
  - A buyer is most likely to confuse it with **WeKan** (same niche: self-hosted, open-source board) and, for Odoo users, with **Odoo Helpdesk** buttons. No help desk in the set uses this colour as its *logo*.
- **`#023237` (provisional team branch).** It is practically **identical to Zendesk "Kale" `#03363D`** (ΔE 0.016, below 1 JND). Zendesk is a leading help-desk brand (market position not measured in this run (u)); the earlier note already listed Kale. SUSE `#0C322C` (ΔE 0.021) is the only other near match. Beyond that, the neighbours are near-black neutrals (Smartsheet navy, Wrike navy, Kayako `#1E4142`), which is expected for a very dark colour: at L 0.29 C 0.048 the hue carries little identity.

## 3. Nearest neighbours of the chosen values

After this survey the maintainer moved the palette to action **Teal `#035F5C`**, team branch **Deep Teal `#071F20`** and customer branch **light gold `#DCA81C`**. For each value: the 8 closest colours across the whole set (primary logo, secondary logo and action colours of the 156 new products and of the earlier 30-product note; 324 distinct product–colour pairs). Source: official, mkt, si or u as in the tables; earlier-note values carry that note's tag. "Direct category" = help desk, ITSM, tracker, Kanban or feedback portal.

### `#035F5C` – action Teal (L 0.439 C 0.075 H 191.0; bucket teal)

| Rank | ΔE OK | Product | Group | Role | Hex | OKLCH | Source | Trybun's direct category? |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.038 | ZnanyLekarz | D | secondary logo | `#006A59` | L 0.47 C 0.087 H 177 (teal) | mkt | no (Polish/CEE brand) |
| 2 | 0.077 | Redmine | earlier | secondary logo | `#4D4D4D` | L 0.42 C 0.000 H 90 (neutral) | official | direct |
| 3 | 0.079 | Freshdesk | earlier | action | `#264966` | L 0.39 C 0.064 H 245 (blue) | official | direct |
| 4 | 0.081 | Redmine | earlier | action | `#234761` | L 0.38 C 0.061 H 242 (blue) | official | direct |
| 5 | 0.083 | WeKan | B | logo | `#007289` | L 0.51 C 0.092 H 218 (cyan) | official | direct (tracker / Kanban / feedback) |
| 6 | 0.091 | ZnanyLekarz | D | logo | `#007C68` | L 0.52 C 0.098 H 176 (teal) | mkt | no (Polish/CEE brand) |
| 7 | 0.094 | WeKan | B | secondary logo | `#00778C` | L 0.52 C 0.093 H 216 (cyan) | official | direct (tracker / Kanban / feedback) |
| 8 | 0.096 | Kayako | A | secondary logo | `#1E4142` | L 0.35 C 0.041 H 198 (neutral) | official | direct (help desk / ITSM) |

### `#071F20` – team branch Deep Teal (L 0.221 C 0.030 H 199.0; bucket neutral)

| Rank | ΔE OK | Product | Group | Role | Hex | OKLCH | Source | Trybun's direct category? |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.022 | Zammad | earlier | action | `#0E1E29` | L 0.23 C 0.031 H 240 (neutral) | mkt | direct |
| 2 | 0.030 | Libredesk | A | logo | `#1A1A1A` | L 0.22 C 0.000 H 90 (neutral) | official | direct (help desk / ITSM) |
| 3 | 0.030 | GitKraken | C | logo | `#1C1C1C` | L 0.23 C 0.000 H 90 (neutral) | official | no (developer platform) |
| 4 | 0.034 | Brand24 | D | secondary logo | `#171717` | L 0.20 C 0.000 H 90 (neutral) | official | no (Polish/CEE brand) |
| 5 | 0.034 | Frappe Helpdesk | earlier | action | `#171717` | L 0.20 C 0.000 H 90 (neutral) | official | direct |
| 6 | 0.034 | Netlify | C | logo | `#131619` | L 0.20 C 0.008 H 248 (neutral) | official | no (developer platform) |
| 7 | 0.034 | Plain | earlier | action | `#0A2414` | L 0.23 C 0.045 H 154 (neutral) | mkt | direct |
| 8 | 0.036 | CircleCI | C | logo | `#161616` | L 0.20 C 0.000 H 90 (neutral) | official | no (developer platform) |

### `#DCA81C` – customer branch light gold (L 0.759 C 0.150 H 85.1; bucket yellow)

| Rank | ΔE OK | Product | Group | Role | Hex | OKLCH | Source | Trybun's direct category? |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.050 | Zammad | earlier | secondary logo | `#F39804` | L 0.76 C 0.165 H 68 (orange) | official | direct |
| 2 | 0.054 | GitLab | earlier | secondary logo | `#FCA326` | L 0.79 C 0.162 H 68 (orange) | official | direct |
| 3 | 0.059 | Hiver | A | secondary logo | `#FDB022` | L 0.81 C 0.163 H 76 (yellow) | official | direct (help desk / ITSM) |
| 4 | 0.061 | Zoho Desk / Zoho Projects | A | secondary logo | `#FFAF00` | L 0.81 C 0.170 H 76 (yellow) | official | direct (help desk / ITSM) |
| 5 | 0.062 | Libredesk | A | secondary logo | `#FFAE2C` | L 0.81 C 0.161 H 73 (yellow) | official | direct (help desk / ITSM) |
| 6 | 0.062 | Airtable | B | secondary logo | `#FCB42A` | L 0.82 C 0.161 H 78 (yellow) | si | adjacent (work management) |
| 7 | 0.064 | Zammad | earlier | action | `#F6BA08` | L 0.82 C 0.167 H 85 (yellow) | mkt | direct |
| 8 | 0.066 | LiveAgent | A | logo | `#F6921E` | L 0.75 C 0.165 H 62 (orange) | official | direct (help desk / ITSM) |


Reading:

- **`#035F5C` (action Teal, L 0.44 C 0.075 H 191, teal).** Only one colour is within 2 JND: ZnanyLekarz's secondary site colour `#006A59` (ΔE 0.038, mkt, not the direct category). Every other neighbour is ΔE ≥ 0.077, about 4 JND or more. The nearest colours from the direct category are Redmine's grey and navy, Freshdesk's navy button, WeKan's cyan logo `#007289` (ΔE 0.083) and Kayako's dark wordmark. Compared with `#017272` (WeKan 0.038, Odoo 0.041, Fider 0.050), the darker teal is **clearly further from every help desk and tracker**: Odoo `#017E84` is now ΔE 0.10 and Fider `#12827F` ΔE 0.11 (computed with the same script; not in the top 8).
- **`#071F20` (team branch Deep Teal, L 0.22 C 0.030 H 199).** C 0.030 is below 0.045, so by this note's own rule it is **neutral**, not teal: it reads as a near-black with a slight green-blue cast. Its neighbours are near-black colours (Zammad's marketing CTA `#0E1E29` ΔE 0.022, Libredesk, Frappe Helpdesk, Plain's dark green, Netlify, CircleCI, GitKraken, Brand24, all ΔE 0.030–0.036). These are close in distance but carry no hue identity; near-black is a common choice (25 neutral logos, 5 neutral actions), so the team branch does not set Trybun apart, and it no longer matches Zendesk Kale (`#03363D` is ΔE 0.09 from `#071F20`).
- **`#DCA81C` (customer branch light gold, L 0.76 C 0.150 H 85, yellow).** The neighbours are amber/orange logo colours at ΔE 0.050–0.066 (2.5–3.3 JND): Zammad `#F39804` and its marketing `#F6BA08`, GitLab `#FCA326`, Hiver `#FDB022`, Zoho `#FFAF00`, Libredesk `#FFAE2C`, LiveAgent `#F6921E`, Airtable `#FCB42A` (si). Most are from the direct category, but all are **secondary** logo colours or a marketing CTA, except LiveAgent's logo. None is a primary *action* colour (yellow: 0 actions in the set). As a brand accent only, gold sits in a hue that is common in logo details and absent from buttons.


## 4. Crowded and free hues; does "teal is rare in the category" hold?

**Crowded (logos):** blue 240–268° (38; the 255–270° band alone has 45 colours including actions), neutral/black (25 – 2025/26 rebrands moved Netlify, DigitalOcean, Travis CI, GitKraken and MariaDB to monochrome logos), green 135–165° (21; especially Polish SaaS: enova365, Symfonia, Brand24, Manago AI, Livespace, Netguru), red-orange 15–45° (27 colour values including secondaries).
**Crowded (actions):** blue (39 %), then indigo (16 %).

**Sparse:** teal 165–195° (7 logos = 4 %, 5 actions), cyan 195–240° (11 logos, mostly bright sky-cyan around H 220–238, not deep teal), yellow (7 logos, 0 actions), magenta/pink 315–15° (7 logos, 0 actions), the yellow-green gap 105–135° (2 colours).

**Verdict: the conclusion weakens, it does not fail.**

- It **holds** at the level of hue counts: teal is tied with yellow and magenta as the least-used logo bucket (7 of 169, 4 %), and among help desks / ITSM (group A, 35 logos) not a single logo is teal; across 169 logos only 7 are teal, and none of the 7 is a help desk or issue tracker (user numbers were not measured (u)).
- It **weakens** at the level of the exact provisional colour: deep, mid-chroma blue-green at L ≈ 0.5 is used by WeKan (OSS Kanban, cyan logo), Odoo (Helpdesk, cyan action), Fider (feedback, teal logo part) and Nifty (PM, teal brand fill) – all within ΔE 0.06 of `#017272` – and the provisional team branch `#023237` is a near-copy of Zendesk Kale. The earlier note's statement "teal 165–195°: nobody" was true for its 30 products; in the wider set it is "rare, with a few close neighbours in the niche". For the chosen `#035F5C` the nearest direct-category colour is ΔE 0.077 away (section 3), so the weakening applies mainly to the provisional value.
- **Teal and green-teal developer brands:** Netlify (logo now monochrome; *marketing CTA* bright turquoise `#32E6E2`, L 0.84 – far from `#017272`, ΔE 0.34), Elastic (one of six logo tiles `#02BCB7`; UI blue), DigitalOcean (accent "foam" `#6FE0ED`, cyan, ΔE 0.35), Supabase (green `#3ECF8E`, H 159 – green, not teal), Element (`#0DBD8B`, H 166 – green/teal border), New Relic (logo green `#1CE783`; theme-color `#008C99`, ΔE 0.088), ServiceNow (not obtained, (u)). These developer brands use **light, bright** teal/turquoise or green (L 0.72–0.85); none uses a **deep** teal like `#017272` (L 0.50) or `#035F5C` (L 0.44) as its main colour. Several historical teal developer brands (Travis CI `#3EAAAF`, GitKraken `#179287`, MariaDB dark teal `#003545`, Elastic `#005571`) have moved away from teal.

## 5. Hues that stay free (data, not a recommendation)

Across the 169 logos and 51 actions:

- **Magenta/pink 315–15°**: 7 logos (Odoo plum `#714B67`, Slack aubergine `#481A54`, Teamwork pink `#FF22B1`, n8n `#FB6E96`, YouTrack, ClickUp, monday dots), **0 actions**. In group A only Odoo's plum is a primary logo colour.
- **Yellow 70–115°**: 7 logos, 0 actions; yellow cannot carry white text and reads as "warning".
- **Yellow-green / chartreuse 105–135°**: 2–3 colours (SysAid lime `#DEFF00`, Gitea `#609926`); the neighbouring green 135–165° is crowded in Polish SaaS.
- **Deep cyan 195–225° at L ≈ 0.4–0.55**: only WeKan, the Odoo action, New Relic's theme-color and Booksy's icon – sparse, but adjacent to `#017272` itself.
- **Red/orange** are crowded as logos (27 values) but unused as action colours (danger semantics), as the earlier note found.
- Teal itself (165–195°) remains tied for the least-used logo bucket.

## Gaps and reliability

- 16 logos not obtained (ServiceNow, Znuny colour logo, Groove/Helply, Missive, ManageEngine, TOPdesk, Halo ITSM (WebP; its action colour is counted), Spiceworks, Azure DevOps, Phorge, MantisBT, Podio, Planka, Asseco, Brainly, PayU). Faveo, Leantime and Symfonia logos are WebP and were counted by site colour (mkt). ServiceNow, TOPdesk and ManageEngine are relevant ITSM brands; ServiceNow's green/dark-teal palette is known only from memory (u).
- Action colours are mostly marketing-site CTAs, not in-app buttons (exceptions: Elastic EUI, Microsoft Teams Fluent, Odoo SCSS, Atlassian ADS).
- 18 logo values are simple-icons only (si v16.38.1) and 14 are (mkt) site colours; for 7 vendors simple-icons was shown to be outdated, so the remaining (si) values may be too.
- Multi-colour logos are counted by one colour; secondary colours enter only the ±20° and distance analysis.
- "Direct category" in section 3 is this note's classification (help desk, ITSM, tracker, Kanban, feedback portal); market size and buyer recognition were not measured (u).
