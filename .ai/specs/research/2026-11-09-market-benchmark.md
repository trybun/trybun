# Market benchmark – ticket systems, helpdesks and adjacent tools

- **Date:** 2026-11-09
- **Kind:** benchmark (desk research; no interviews, no usage data)
- **Method:** web research by two AI agents across vendor sites, pricing pages and documentation, plus reviews on G2, Capterra, Reddit and Hacker News. Every row is a reading of public pages on this date, not a test of the product.
- **Reliability:** items marked **(u)** are unverified: they come from third-party pages or from prior knowledge and were not confirmed at the vendor. Polish UI support was mostly not checked live. A feature missing from a checked page does not prove the product lacks it. Re-check every figure before using it publicly (README, comparisons, marketing).
- **Purpose:** positioning of Trybun and input for scope decisions. This is not a requirement and does not change the specification; scope changes go through a change specification (Rule 8, [§2.8](../../../docs/spec/02-agent-rules.md)).

## 1. Open-source and self-hostable tools

Legend: Y = built in and free · P = paid add-on or edition · ~ = partial or weak · N = not available · ? = unknown

| Tool | Focus | License / open core | Portal | Public roadmap | Gantt | GitHub | SLA | Duplicate detection | PL |
|---|---|---|---|---|---|---|---|---|---|
| Zammad 7.x | Helpdesk | AGPL-3.0, full feature set; AI paid per call | Y | N | N | ~ issues only, no PRs | Y | ~ exact match, warning only | Y (u) |
| osTicket | Helpdesk | GPL-2.0 | Y | N | N | N | Y | N | Y (language pack) |
| FreeScout | Shared inbox | AGPL-3.0 + paid one-time modules | P | N | N | P (u) | P | N | Y |
| UVdesk | Helpdesk | OSL-3.0 (u) | Y | N | N | N | ~ | N | ? |
| Peppermint | Helpdesk | **Repository archived on 2026-07-17** | – | – | – | – | – | – | – |
| Frappe Helpdesk | Helpdesk | AGPL-3.0 | Y | N | N | N | Y (calendars) | N | ~ |
| GLPI 11 | ITSM and assets | GPL-3.0; paid support and plugins | Y | N | ~ plugin | N | Y | N | Y |
| Znuny / OTOBO | ITSM (OTRS forks) | GPL-3.0 | Y | N | N | ~ | Y (calendars) | N | Y |
| Request Tracker 6 | Ticketing | GPL-2.0 | Y | N | N | N | Y | N | Y (u) |
| Libredesk | Helpdesk (new, 2025–26) | AGPL-3.0 (u) | ~ help center | N | N | N | Y (u) | N | ? |
| Chatwoot | Omnichannel chat | MIT core + proprietary `enterprise/` | Y | N | N | N | P (Enterprise) | N | Y |
| Plane CE | Project management | AGPL-3.0; CE = Cloud Free | P (Business: Customers, Intake) | N | Y (dependencies P) | P (Pro) | P | N | ? |
| OpenProject | Project management | GPL-3.0 + Enterprise add-ons | N | ~ version roadmap | Y | Y (u) | N | N | Y |
| Redmine 6.x | Issue tracking | GPL-2.0; helpdesk via paid plugin | P | ~ version roadmap | Y | ~ plugin | P | N | Y |
| Taiga / Tenzu | Agile project management | MPL-2.0 (u); Taiga in maintenance | N | N | N | Y | N | N | Y |
| Huly | All-in-one workspace | EPL-2.0; heavy stack | N | N | ~ | Y | N | N | ? |
| Leantime | Project management | AGPL core + paid plugins | N | N | Y | ~ | N | N | Y (u) |
| Fider | Feedback voting | AGPL-3.0 | Y (board) | ~ status list | N | N | N | ~ similar posts while typing (u) | Y (u) |

Notes:

- **Zammad** is the strongest open-source helpdesk: internal notes, e-mail, organizations, SLAs with calendars, portal, knowledge base. It needs about 6–10 GB RAM with Elasticsearch. Duplicate detection is attribute matching that only warns; forum users ask for merging. Sources: <https://zammad.com/en/product/features/duplicate-detection>, <https://admin-docs.zammad.org/en/7.0/system/integrations/github.html>
- **Plane** is the strongest open-source developer-side tool, but the GitHub integration needs Pro, and Intake and Customers need Business. Users call this a bait-and-switch: <https://plane.so/pricing>, <https://github.com/orgs/makeplane/discussions/1266>
- **OpenProject** has a mature Gantt and an EU/GDPR profile. SSO and external sharing are Enterprise add-ons, and it has no customer portal: <https://www.openproject.org/pricing/>
- **Small open-source ticketing projects often stall:** Peppermint is archived (<https://github.com/Peppermint-Lab/peppermint>), UVdesk is dormant (u), and Taiga was handed over to Tenzu. Buyers weigh maintenance continuity as much as features.
- Review themes: osTicket and Redmine are "dated" (<https://www.g2.com/products/osticket/reviews>); FreeScout is good value but self-hosting is "not for everyone"; Znuny, OTOBO and Request Tracker are complex to run.

## 2. Commercial tools

Prices are USD per agent (or seat) per month, billed annually, unless noted.

| Tool | Focus | Cheapest tier with portal + SLA | Free tier | Self-host | Gantt | GitHub | Duplicates |
|---|---|---|---|---|---|---|---|
| Jira Service Management + Jira | Service desk | Standard ~20–25 (u) | 3 agents (u) | Data Center: no new sales since 2026-03-30, read-only 2029-03-28 | Timeline; dependencies in Premium (u) | Y | AI similar requests (u) |
| Zendesk | Omnichannel CX | Suite Professional 115 | N | N | N | marketplace (u) | merge, AI |
| Freshdesk | SMB helpdesk | Pro 55 | not on pricing page | N | N | marketplace (u) | merge |
| Freshservice | ITSM | Growth 49 | N | N | N | (u) | merge (u) |
| Linear | Developer issue tracking | Business 16 (SLAs, Asks) | 250 issues | N | timeline (u) | Y, best in class | Triage Intelligence (Business) |
| YouTrack | Tracker + helpdesk | 4.50 per user + 5.50 per agent | 10 users + 3 agents | **Y (Server)** | **Y** | Y | duplicate links (u) |
| GitHub Issues / Projects | Developer tracking | – (no helpdesk) | Y | GitHub Enterprise Server | roadmap view (u) | native | manual |
| Plain | API-first B2B support | Horizon 99 | N | N | N | listed | (u) |
| Pylon | B2B Slack/Teams support | Advanced 139 | N | N | N | integrations | (u) |
| Help Scout | SMB shared inbox | Plus 45 | 5 users | N | N | (u) | merge (u) |
| Canny | Feedback + roadmap | Pro from 79 per month (tracked users) | 25 tracked users | N | N | Pro | **AI dedupe, merge** |
| Featurebase | Inbox + feedback + roadmap | Professional 59 | 1 seat | N | N | Y (plan unclear) | **AI dedupe** |
| Productboard | Product management | Business ~59 per maker (u) | (u) | N | timeline roadmap | (u) | AI (u) |
| HelpDesk.com (Text S.A., PL) | SMB e-mail ticketing | SLA only on Enterprise | N | N | N | (u) | (u) |
| Debesis (PL) | Helpdesk | 119–169 PLN net per user; portal only in top tier | N | N | N | N | ? |
| Codenica (PL) | ITSM | not public; SLA on Enterprise | – | on-premise | N | N | ? |

Notes:

- **Atlassian** raised cloud list prices on 2025-10-15 and ends Data Center (<https://www.atlassian.com/licensing/data-center-end-of-life>). G2 complaints: complexity and price.
- **YouTrack** raised prices on 2025-10-01 but stays free for 10 users plus 3 agents (<https://blog.jetbrains.com/youtrack/2025/06/new-youtrack-prices-starting-from-october-2025/>). Polish is a partial community translation.
- **Linear** has no external customer portal: Asks web forms require sign-in through the identity provider (<https://linear.app/docs/linear-asks>). Third-party portals fill the gap (Productlane, Lucidlane, Hipporello).
- **AI is a metered add-on everywhere:** Zendesk 1.50–2.00 per automated resolution (u), Help Scout 0.75 (<https://www.helpscout.com/pricing/>), Featurebase 0.49 (<https://www.featurebase.app/pricing>), and Plain and Pylon use credits.
- **Featurebase** is converging inbox, feedback, public roadmap and Linear/GitHub integration in one product. It is the closest commercial concept to Trybun.
- **Polish vendors** (Debesis <https://debesis.pl/cennik/>, Codenica <https://codenica.com/pl/system-ticketowy>, Fakturownia Helpdesk) do not target developer workflows.
- Pricing sources: <https://www.zendesk.com/pricing/>, <https://www.freshworks.com/freshdesk/pricing/>, <https://linear.app/pricing>, <https://github.com/pricing>, <https://www.plain.com/pricing>, <https://www.usepylon.com/pricing>, <https://canny.io/pricing>, <https://www.helpdesk.com/pricing/>

## 3. What a small team stitches together today

Scenario: 5 support agents and 10 developers, annual list prices, AI excluded.

| Stack | Approx. per month |
|---|---|
| JSM Standard + Jira + Canny Pro | ~260–285 USD (u) |
| Freshdesk Pro + GitHub Team + Featurebase Growth | ~345 USD |
| Help Scout Plus + Linear Basic + Canny Pro | ~405 USD |
| Zendesk Suite Professional + Linear Business + Canny Pro | ~815 USD |
| YouTrack alone (helpdesk + tracker + Gantt) | ~28–75 USD (u) |

The recurring pain in reviews is the glue between tools rather than the price: duplicate customer records, one-way status sync between helpdesk and issue tracker, feedback votes disconnected from tickets, several logins and several GDPR processor agreements.

## 4. Where Trybun's specified scope fills a gap

1. **Customer portal and developer workflow in one free product.** Open-source helpdesks stop at linking an issue; open-source project tools have no portal or charge for it.
2. **Per-ticket visibility with team approval and redaction** ([§5.1](../../../docs/spec/05-visibility-and-search.md), [§5.2](../../../docs/spec/05-visibility-and-search.md)). Not found in any tool reviewed; portals show only the customer's own or their organization's tickets.
3. **"I have the same problem" with an affected-user and organization count on support tickets** ([§5.6](../../../docs/spec/05-visibility-and-search.md)). The mechanism exists in feedback tools (Canny, Featurebase, Fider); combining it with tickets, visibility and prioritization is new.
4. **Public roadmap fed by real tickets and milestones** ([§10.3](../../../docs/spec/10-roadmap-gantt.md)). Elsewhere, roadmaps are version lists for project members or are disconnected from the tracker.
5. **GitHub branch and PR linking without a paywall** ([§11.3](../../../docs/spec/11-github-integration.md)).
6. **Semantic search computed locally, no external AI** ([§5.6](../../../docs/spec/05-visibility-and-search.md)): a niche for GDPR-sensitive teams when competitors sell metered AI.
7. **Full Polish UI for a developer-oriented tool, WCAG 2.2 AA and mobile-first** ([§13.1](../../../docs/spec/13-non-functional.md), [§13.4](../../../docs/spec/13-non-functional.md)).

## 5. Where Trybun is not differentiated

- **Being free is not unique:** Zammad, Frappe Helpdesk, GLPI, Znuny and Libredesk are fully free and self-hosted. MIT versus AGPL matters mainly to those who embed or resell. The differentiator is the integration of support and development, not the price.
- **YouTrack** is nearly free for small teams, self-hostable, and has a helpdesk with SLAs, Gantt, GitHub and in-house AI. Trybun's edge over it: public roadmap, "I have the same problem", per-ticket visibility, full Polish UI, MIT.
- **Helpdesk basics** (internal notes, e-mail replies, organizations, SLA calendars, SSO, reports) are mature in Zammad.
- **Developer basics** (Kanban, command palette, milestones, Gantt, API, webhooks, CSV import) exist in Plane CE and OpenProject; Linear sets the bar for speed.
- **Breadth versus one maintainer** is the main risk: the scope covers what two mature products do.
- **Server requirements** (at least 8 GB RAM, [§15.2](../../../docs/spec/15-deployment.md)) are comparable to Zammad and heavier than FreeScout or Libredesk.

## 6. Open points for the maintainer (not decisions)

- **Knowledge base / help articles:** almost every competitor has one as the first deflection layer; the specification has none. Shared tickets and portal search ([§5.2](../../../docs/spec/05-visibility-and-search.md), [§5.5](../../../docs/spec/05-visibility-and-search.md)) partly cover it. To decide: Later scope or an explicit non-goal.
- **Channels beyond e-mail** (chat, Slack, Teams): probably a non-goal, worth stating explicitly.
- **A "Why Trybun" comparison** in the README or the user documentation at the first public release, after the figures above are re-checked.
