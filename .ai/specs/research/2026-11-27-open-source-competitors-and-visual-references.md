# Open-source competitors and visual references

- **Date:** 2026-11-27
- **Kind:** benchmark (desk research; no interviews, no usage data); an update of [`2026-11-09-market-benchmark.md`](2026-11-09-market-benchmark.md), which stays as it was.
- **Method:** web research by three AI agents:
  - **Licences:** each project's `LICENSE` file, read through the GitHub API (`https://api.github.com/repos/<owner>/<repo>`; Codeberg's API for Forgejo).
  - **Activity:** stars, last push and latest release, from the same APIs.
  - **YouTrack:** JetBrains' pricing and help pages (links in section 1).
  - **Visual design:** the published design tokens in the npm packages `@jetbrains/ring-ui` 7.0.136, `@primer/primitives` 11.10.0, `@makeplane/propel` 0.9.11 and `@zendeskgarden/react-theming` 9.16.1, plus the vendors' redesign posts (links in section 2).
- **Reliability:** items marked **(u)** come from search summaries or third-party pages and were not confirmed at the source. A feature missing from a checked page does not prove it is absent. Recheck any number before using it publicly, as for the benchmark of 2026-11-09.
- **Purpose:** positioning of Trybun, input for the product brief (#501) and the design system work (stage 1 of the visual direction, 2026-11-27). This is not a requirement; scope changes go through a change specification (Rule 8, [§2.8](../../../docs/spec/02-agent-rules.md)).

## 1. Is there a free, MIT-licensed competitor?

No active, MIT-licensed project combines a team tracker (Kanban, statuses) with a customer ticket portal, as Trybun does. Being free is not unique (see the benchmark of 2026-11-09).

**YouTrack is not free software.** It is proprietary ("Copyright © JetBrains s.r.o."). Cloud and Server are free for up to 10 users and 3 helpdesk agents, with unlimited reporters. Above that:

| Item | Cloud | Server |
|---|---|---|
| User | from 5.40 USD per month (monthly) or 4.50 (annual) | packs: 900 USD for 15 users, 1,500 for 25, 6,000 for 100 |
| Helpdesk agent from the 4th | 6 USD per month or 5.50 (annual) | 72 USD per year |

Sources:

- <https://sales.jetbrains.com/hc/en-gb/articles/28384631938450-YouTrack-Pricing-Changes-Effective-October-1-2025>
- <https://sales.jetbrains.com/hc/en-gb/articles/28382668077970-%D0%A1hanges-to-YouTrack-Cloud-per-user-subscription-prices>
- <https://sales.jetbrains.com/hc/en-gb/articles/28382529526162-Changes-to-YouTrack-Server-subscriptions-prices>
- <https://www.jetbrains.com/help/youtrack/cloud/switching-subscription-plans.html>
- <https://blog.jetbrains.com/youtrack/2025/06/new-youtrack-prices-starting-from-october-2025/>

Each project row links to its repository; licence, stars and activity are from its API (GitHub, Codeberg or GitLab) on 2026-11-27.

| Project | Licence (from `LICENSE`) | Kanban | Customer portal | GitHub | Last activity | Stars |
|---|---|---|---|---|---|---|
| [Zammad](https://github.com/zammad/zammad) | AGPL-3.0 | N | Y | ~ links to issues, no PRs | push 2026-11-27 | 6.2k |
| [Frappe Helpdesk](https://github.com/frappe/helpdesk) | AGPL-3.0 | N (u) | Y | N (u) | v15.2.1, 2026-11-25 | 3.5k |
| [FreeScout](https://github.com/freescout-help-desk/freescout) | AGPL-3.0 | paid module | paid module | none listed (u) | 1.8.252, 2026-11-21 | 4.7k |
| [UVdesk](https://github.com/uvdesk/community-skeleton) | OSL-3.0 (an awesome-list says MIT) | N (u) | Y | (u) | v1.1.8, 2025-09 | 19.7k |
| [Libredesk](https://github.com/abhinavxd/libredesk) | AGPL-3.0 | N | help centre only | N | v2.9.2, 2026-10 | 3.2k |
| [Chatwoot](https://github.com/chatwoot/chatwoot) | MIT core + commercial `enterprise/` | N | help centre (u) | (u) | v4.20.1, 2026-11 | 40.7k |
| [Plane](https://github.com/makeplane/plane) | AGPL-3.0 + paid plans | Y | paid (Business: Customers, Intake; <https://plane.so/pricing>) | Pro and up | v1.5.1, 2026-11-25 | 63.3k |
| [Huly](https://github.com/hcengineering/platform) | EPL-2.0 | Y | N (u) | Y, two-way | push 2026-11-09; release v0.7.426, 2026-07 | 28.2k |
| [itsaplan](https://github.com/croffasia/itsaplan) (new in 2026) | AGPL-3.0 | Y | none mentioned | PRs from 5 forges | push 2026-11-26 | 2.7k |
| [OpenProject](https://github.com/opf/openproject) | GPL-3.0 | Y | N | Y | v17.8.3, 2026-11 | 17.8k |
| [Redmine](https://github.com/redmine/redmine) | GPL-2.0-or-later (an aggregator says MIT) | plugins | N | plugins | push 2026-11-27 | 6.1k |
| [Leantime](https://github.com/Leantime/leantime) | AGPL-3.0 | Y | N (u) | (u) | v3.17.0, 2026-11 | 12.2k |
| [Kanboard](https://github.com/kanboard/kanboard) | MIT | Y | N | plugins (u) | v1.2.58, 2026-11, maintenance mode (README) | 10.0k |
| [Gitea](https://github.com/go-gitea/gitea) | MIT | project boards | N | it is a forge | v28.4.0, 2026-11 | 59.3k |
| [Forgejo](https://codeberg.org/forgejo/forgejo) | GPL-3.0 (awesome-selfhosted still says MIT) | project boards | N | it is a forge | push 2026-11-27 | 5.9k |
| [GitLab CE Service Desk](https://gitlab.com/gitlab-org/gitlab) | MIT for the CE code; `ee/` proprietary | Y | e-mail only | – | activity 2026-11-27 (GitLab API) | 6.2k |
| [Peppermint](https://github.com/Peppermint-Lab/peppermint) | AGPL-3.0 + commercial | – | – | – | archived; last push 2025-09-21 | 3.2k |
| [Tegon](https://github.com/RedPlanetHQ/tegon) (moved to `RedPlanetHQ`) | AGPL-3.0 | – | – | – | archived; last push 2025-03-30 | 1.9k |
| [Helpy](https://github.com/helpyio/helpy) | MIT | N | Y | N | last release 2020 | 2.5k |
| [Trudesk](https://github.com/polonel/trudesk) | Apache-2.0 | N | Y (u) | N | v1.2.11, 2024-07, stalled | 1.5k |

The GitHub API gives only the `archived` flag, not the date of archiving. For Peppermint the benchmark of 2026-11-09 gives 2026-07-17 and an agent on 2026-11-27 gave 2025-09; neither is confirmed.

**Differences from the benchmark of 2026-11-09**, kept open until checked at the vendor:

| Item | 2026-11-09 | 2026-11-27 |
|---|---|---|
| Chatwoot portal | Y | help centre (u) |
| FreeScout GitHub | P (u) | none listed (u) |
| Peppermint archive date | 2026-07-17 | 2025-09 (u) |

**Positioning.** No active project offers a modern tracker with Kanban and a free customer portal, self-hosted.

- The benchmark of 2026-11-09 (section 5) notes that MIT versus AGPL matters mainly to those who embed or resell. The differentiator is the combination of tracker and free portal with a modern UX; the MIT licence is a plus, not the main argument.
- **Closest in features:** Zammad, which has the portal, organizations, internal notes, GitHub issue links, SSO and Docker deployment, but no Kanban or project work.
- **Closest in modern team UX:** Plane, whose customer features are paid.

## 2. Visual design of comparable tools

Values from the published tokens in the packages named under Method, and from the redesign posts linked in the table.

| Product | Type | Colour | Shape and depth | Notes |
|---|---|---|---|---|
| YouTrack (Ring UI; [2025.1 redesign](https://blog.jetbrains.com/youtrack/2025/02/youtrack-introduces-a-new-design/)) | `system-ui`, body 14/20, H4 12 px all caps ([typography](https://jetbrains.com/help/ring-ui/typography.html)) | accent #3369D6 | radii 2/4/8, popup shadow | collapsible icon sidebar, global Create, light/dark/OS themes; no density setting found (u) |
| Linear ([2024](https://linear.app/now/how-we-redesigned-the-linear-ui), [2026 refresh](https://linear.app/now/behind-the-latest-design-refresh)) | Inter Display for headings, Inter for text | warm, low-chroma greys (2026); themes from base, accent, contrast in LCH | few, soft dividers; dimmed sidebar | smaller icons, no coloured icon tiles |
| Plane (`@makeplane/propel`) | Inter Variable, regular 450, medium 500 | near-achromatic neutrals, brand `oklch(.48 .116 243)` | canvas, surface, layer; 0.5–1 px borders | Lucide icons, dark mode |
| GitHub [Primer](https://primer.style) (`@primer/primitives`) | Mona Sans VF / system stack, body 14 | border #d1d9e0, accent #0969da | radii 3/6/12, default 6; borders first, faint resting shadow; controls 28/32/40 | 14 themes |
| Atlassian (Jira, JSM) | Atlassian Sans (from Inter; GA 2025-09 (u)), body 14/20, no all-caps ([typography](https://atlassian.design/foundations/typography)) | less blue tint in neutrals and dark surfaces ([refresh](https://atlassian.design/whats-new/atlassian-ui-refresh-updates)) | radius by role: 2 badges, 4 tags, 6 buttons and inputs, 8 cards and menus, 12 modals and Kanban columns ([radius](https://atlassian.design/foundations/radius), [elevation](https://atlassian.design/foundations/elevation)) | line icons 1.5 px on 16 px ([iconography](https://atlassian.design/foundations/iconography)) |
| Zendesk Garden (`@zendeskgarden/react-theming`) | system fonts, base 14 | – | radii 2/4/8, focus as ring shadow | 4 px grid, dark base |
| Help Scout ([Inbox 2](https://articles.helpscout.com/blog/redesigned-inbox/), 2024-09 (u)) | – | higher contrast | – | ⌘K action menu, `/` in the composer, words instead of icons |
| Front ([2025-08](https://front.com/blog/the-new-front-inbox)) (u) | – | "calmer colours" | – | users on the [forum](https://community.front.com/product-q-a-45/new-front-update-opinions-2839/index2.html): "one big blur", a low-contrast list |

**What reviewers say about YouTrack (u):**

- **Criticism:**
  - "cluttered & dated compared to other modern competitors" ([G2](https://www.g2.com/products/youtrack/reviews));
  - "dense and overwhelming at first" ([Capterra](https://www.capterra.com/p/123548/YouTrack/reviews/));
  - "should update the UI to make it more modern" ([Software Advice](https://www.softwareadvice.com/workflow/youtrack-profile/reviews/)).
- **Praise:** "clean and easy enough to understand" ([TrustRadius](https://www.trustradius.com/products/youtrack/reviews/all)).

The review sites block automated reading; the quotes come from search summaries.

## 3. Evidence on visual appeal

- **Aesthetic-usability effect** (Kurosu & Kashimura 1995; [NN/g, 2024-02-03](https://www.nngroup.com/articles/aesthetic-usability-effect/)): an attractive interface is perceived as easier and forgives minor problems, not major ones.
- **First impressions** form within a fraction of a second, driven mainly by low visual complexity and a familiar layout (Lindgaard et al. 2006 (u); Tuch et al. 2012 (u)).
- **Meta-analysis** (Schlamann, Nestler, Thielsch, 2026): 31 studies and 18,794 participants, confirmed by the [University of Wuppertal press release](https://www.uni-wuppertal.de/en/news/detail/aesthetik-als-leistungsbooster-neue-metaanalyse-zeigt-schoenes-design-kann-mehr-als-nur-gut-aussehen/). A small to medium effect of aesthetics on actual task performance (g = 0.29) and typography as a significant moderator (u), from the supplement on [Zenodo](https://zenodo.org/records/18777943) as seen in search summaries.
- **For daily users** the perceived effect fades (u), so the look has to come with refined UX.
- **Dark mode** ([NN/g](https://www.nngroup.com/articles/dark-mode/)): light mode reads better for most people; offer dark as an option.

## 4. Use

- **Before new market or competitor research:** read this file and the benchmark of 2026-11-09 first, and write only a dated update ([`AGENTS.md`](../../../AGENTS.md), "Where things are").
- **The reference cards and the three visual directions** of 2026-11-27 build on section 2; they live in the stage 1 review of the design system and in its change specification once written.
- **Outcome (2026-11-27):** after comparing 71 official screenshots of Plane with 65 of Linear, screen by screen (from the vendors' documentation, changelogs, blogs, product pages and Plane's repository, mostly 2025–2026), the maintainer chose Plane as the UI direction: "clear and intuitive, with many conventions from other tools, so users know where to look for a function". Trybun takes its principles (layered surfaces, conventions, clarity), not its blue identity; the brand colours are in [`2026-11-27-brand-colour-practice.md`](2026-11-27-brand-colour-practice.md).
- **Update (2026-11-28):** the Plane row of section 2 says "0.5–1 px borders". Plane's components use 1 px borders. A 0.5 px token (`border-xs`) exists, but no Propel component uses it; in the app only the spreadsheet grid and pinned table columns use 0.5 px borders, plus a 0.5 px outline on Kanban cards (`@makeplane/propel` 0.9.11 and its foundations docs; `makeplane/plane` at `723bb178`). Details in [`2026-11-28-design-system-foundations.md`](2026-11-28-design-system-foundations.md), section 2.
