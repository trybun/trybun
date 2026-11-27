# Open-source competitors and visual references

- **Date:** 2026-11-27
- **Kind:** benchmark (desk research; no interviews, no usage data); an update of [`2026-11-09-market-benchmark.md`](2026-11-09-market-benchmark.md), which stays as it was.
- **Method:** web research by three AI agents:
  - **Licences:** each project's `LICENSE` file, read through the GitHub API (Codeberg for Forgejo).
  - **Activity:** stars, last push and latest release, from the same APIs.
  - **YouTrack:** JetBrains' pricing and help pages.
  - **Visual design:** the published design tokens in the packages of Ring UI, `@primer/primitives` 11.10.0, `@makeplane/propel` 0.9.11 and `@zendeskgarden/react-theming` 9.16.1, plus the vendors' redesign posts.
- **Reliability:** items marked **(u)** come from search summaries or third-party pages and were not confirmed at the source. A feature missing from a checked page does not prove it is absent.
- **Purpose:** positioning of Trybun, input for the product brief (#501) and the design system work (stage 1 of the visual direction, 2026-11-27). This is not a requirement; scope changes go through a change specification (Rule 8, [§2.8](../../../docs/spec/02-agent-rules.md)).

## 1. Is there a free, MIT-licensed competitor?

No active, MIT-licensed project combines a team tracker (Kanban, statuses) with a customer ticket portal, as Trybun does. Being free is not unique (see the benchmark of 2026-11-09); the combination under MIT is.

**YouTrack is not free software.** It is proprietary ("Copyright © JetBrains s.r.o."). Cloud and Server are free for up to 10 users and 3 helpdesk agents, with unlimited reporters. Above that:

| Item | Cloud | Server |
|---|---|---|
| User | from 5.40 USD per month (monthly) or 4.50 (annual) | packs: 900 USD for 15 users, 1,500 for 25, 6,000 for 100 |
| Helpdesk agent from the 4th | 6 USD per month or 5.50 (annual) | 72 USD per year |

Source: JetBrains sales articles on the prices from October 2025, and the YouTrack Cloud help page.

| Project | Licence (from `LICENSE`) | Kanban | Customer portal | GitHub | Last activity (2026-11-27) | Stars |
|---|---|---|---|---|---|---|
| Zammad | AGPL-3.0 | N | Y | ~ links to issues, no PRs | push 2026-11-27 | 6.2k |
| Frappe Helpdesk | AGPL-3.0 | N (u) | Y | N (u) | v15.2.1, 2026-11-25 | 3.5k |
| FreeScout | AGPL-3.0 | paid module | paid module | none listed | 1.8.252, 2026-11-21 | 4.7k |
| UVdesk | **OSL-3.0** (an awesome-list says MIT) | N (u) | Y | (u) | v1.1.8, 2025-09 | 19.7k |
| Libredesk | AGPL-3.0 | N | help centre only | N | v2.9.2, 2026-10 | 3.2k |
| Chatwoot | MIT core + commercial `enterprise/` | N | help centre (u) | (u) | v4.20.1, 2026-11 | 40.7k |
| Plane | AGPL-3.0 + paid plans | Y | **paid** (Business: Customers, Intake) | Pro and up | v1.5.1, 2026-11-25 | 63.3k |
| Huly | EPL-2.0 | Y | N (u) | Y, two-way | v0.7.426, 2026-07 | 28.2k |
| itsaplan (new in 2026) | AGPL-3.0 | Y | none mentioned | PRs from 5 forges | push 2026-11-26 | 2.7k |
| OpenProject | GPL-3.0 | Y | N | Y | v17.8.3, 2026-11 | 17.8k |
| Redmine | **GPL-2.0** (an aggregator says MIT) | plugins | N | plugins | push 2026-11-27 | 6.1k |
| Leantime | AGPL-3.0 | Y | N (u) | (u) | v3.17.0, 2026-11 | 12.2k |
| Kanboard | MIT | Y | N | plugins (u) | v1.2.58, 2026-11, maintenance mode | 10.0k |
| Gitea | MIT | project boards | N | it is a forge | v28.4.0, 2026-11 | 59.3k |
| Forgejo | **GPL-3.0** (awesome-selfhosted still says MIT) | project boards | N | it is a forge | push 2026-11-27 | 5.9k |
| GitLab CE Service Desk | MIT for the CE code; `ee/` proprietary | Y | e-mail only | – | push 2026-10 | 24.6k |
| Peppermint | AGPL-3.0 + commercial | – | – | – | **archived**, last push 2025-09-21 | 3.2k |
| Tegon | AGPL-3.0 | – | – | – | **archived** 2025-03 | 1.9k |
| Helpy | MIT | N | Y | N | last release 2020 | 2.5k |
| Trudesk | Apache-2.0 | N | Y (u) | N | v1.2.11, 2024-07, stalled | 1.5k |

The archive date of Peppermint is not in the GitHub API. The benchmark of 2026-11-09 gives 2026-07-17, and an agent on 2026-11-27 gave 2025-09; only the last push of 2025-09-21 is confirmed.

**Positioning.** No active project offers this combination: a modern tracker with Kanban and a free customer portal, under MIT, self-hosted.

- **Closest in features:** Zammad, which has the portal, organizations, internal notes, GitHub issue links, SSO and Docker deployment, but no Kanban or project work.
- **Closest in modern team UX:** Plane, whose customer features are paid.

## 2. Visual design of comparable tools

Values from the published tokens and redesign posts.

| Product | Type | Colour | Shape and depth | Notes |
|---|---|---|---|---|
| YouTrack (Ring UI, 2025.1 redesign) | `system-ui`, body 14/20, H4 12 px all caps | accent #3369D6 | radii 2/4/8, popup shadow | collapsible icon sidebar, global Create, light/dark/OS themes, no density setting |
| Linear (2024, 2026 refresh) | Inter Display for headings, Inter for text | warm, low-chroma greys (2026); themes from base, accent, contrast in LCH | few, soft dividers; dimmed sidebar | smaller icons, no coloured icon tiles |
| Plane (`@makeplane/propel`) | Inter Variable, regular 450, medium 500 | near-achromatic neutrals, brand `oklch(.48 .116 243)` | canvas, surface, layer; 0.5–1 px borders | Lucide icons, dark mode |
| GitHub Primer | Mona Sans VF / system stack, body 14 | border #d1d9e0, accent #0969da | radii 3/6/12, default 6; borders first, faint resting shadow; controls 28/32/40 | 14 themes |
| Atlassian (Jira, JSM) | Atlassian Sans (from Inter, GA 2025-09), body 14/20, no all-caps | less blue tint in neutrals and dark surfaces | radius by role: 2 badges, 4 tags, 6 buttons and inputs, 8 cards and menus, 12 modals and Kanban columns | line icons 1.5 px on 16 px |
| Zendesk Garden | system fonts, base 14 | – | radii 2/4/8, focus as ring shadow | 4 px grid, dark base |
| Help Scout (Inbox 2, 2024-09) | – | higher contrast | – | ⌘K action menu, `/` in the composer, words instead of icons |
| Front (2025-08) | – | "calmer colours" | – | users on the forum: "one big blur", a low-contrast list |

**What reviewers say about YouTrack (u):**

- **Criticism:**
  - "cluttered & dated compared to other modern competitors" (G2);
  - "dense and overwhelming at first" (Capterra);
  - "should update the UI to make it more modern" (Software Advice).
- **Praise:** "clean and easy enough to understand" (TrustRadius).

The review sites block automated reading.

## 3. Evidence on visual appeal

- **Aesthetic-usability effect** (Kurosu & Kashimura 1995; NN/g, 2024-02-03): an attractive interface is perceived as easier and forgives minor problems, not major ones.
- **First impressions** form within a fraction of a second, driven mainly by low visual complexity and a familiar layout (Lindgaard et al. 2006 (u); Tuch et al. 2012 (u)).
- **Meta-analysis** (Schlamann, Nestler, Thielsch, 2026-02-25; 31 studies, 18,794 participants): a small to medium effect of aesthetics on actual task performance (g = 0.29), with typography a significant moderator.
- **For daily users** the perceived effect fades (u), so the look has to come with refined UX.

## 4. Use

- **Before new market or competitor research:** read this file and the benchmark of 2026-11-09 first, and write only the update.
- **The reference cards and the three visual directions** of 2026-11-27 build on section 2; they live in the stage 1 review of the design system and in its change specification once written.
