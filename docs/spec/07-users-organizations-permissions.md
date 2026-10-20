# 07 – Users, organizations and permissions

## 7.1 Role principles

Following the convention of GitHub, GitLab and Jira, team roles are granted **per project**. The same person can hold different roles in different projects, e.g. Developer in one project and Project manager in another.

The **Administrator** role is the exception: it is global and applies to the whole system.

- A team member has access only to the projects they were added to.
- An end user has access to the projects of their organization plus the projects they were invited to personally ([§7.3](#73-organizations)). In all of these projects they have the End user role.

## 7.2 Roles

| Role | Code | Scope | Description |
|---|---|---|---|
| End user | `end_user` | project | Creates tickets, comments on tickets they can see ([§5.4](05-visibility-and-search.md)) |
| Developer | `developer` | project | Handles tickets, changes statuses, creates tasks |
| Project manager | `project_manager` | project | Performs triage, manages the roadmap and schedule, assigns work, manages project members and labels |
| Administrator | `admin` | global | Manages projects, organizations, accounts, roles, SLA policies, templates and integrations |

Roles are hierarchical: Project manager has all Developer permissions, and Administrator has all permissions of the other roles.

"Team" in this specification means Developer, Project manager and Administrator.

## 7.3 Organizations

An organization represents a **customer company** (pattern: Zendesk, Jira Service Management). Organizations are **optional**: the system is fully functional without them.

| Field | Description |
|---|---|
| Name | Company name |
| E-mail domains | E.g. `company.com`; users invited with an e-mail address in this domain are assigned to the organization automatically |
| Projects | Projects the organization has access to (set by the Administrator) |
| Members | End users belonging to the organization |
| SLA policy | Optional SLA policy ([§9.3](09-sla.md)) |

Rules:

- An end user belongs to **at most one** organization. They may belong to none (e.g. an individual customer).
- Team members do not belong to customer organizations and see tickets of all organizations in their projects.
- A project can serve **many organizations**, and an organization can access **many projects**.
- Members of an organization automatically get access to all projects of the organization; no per-person access grants are needed.
- End users can `@mention` members of their own organization (if any) and team members.

### Users without an organization

- Get access to projects only through a personal invitation.
- See their own tickets and shared tickets ([§5.2](05-visibility-and-search.md)).
- Can choose visibility `only_me` or `all_customers` ([§5.1](05-visibility-and-search.md)).

### System without organizations

If no organization exists in the system (e.g. an internal deployment in one company), the UI hides all organization-related elements: the organization field and filter, the visibility option `my_organization` and the organization count on shared tickets. These elements appear automatically once the first organization is created, with no separate setting (Rule 2).

## 7.4 Accounts and authentication

- Authentication is handled by the identity provider **Keycloak** ([§14.2](14-architecture.md)). The system implements no password handling, 2FA or external login of its own. Password hashing is configured in Keycloak according to OWASP recommendations.
- **No open registration.** Accounts are created only by an e-mail invitation sent by a Project manager or the Administrator. The invited person sets a password on first login. The only exception is the first Administrator account, created in the first-run wizard ([§15.6](15-deployment.md)).
- **Team members** log in with GitHub (OAuth via Keycloak). This links the account to the GitHub login needed for issue assignment ([§11.4](11-github-integration.md)). Two-factor authentication (2FA) is mandatory for team members.
  - An invitation for a team member contains a one-time link. On first sign-in through that link, the GitHub account is bound to the invited account in Keycloak. The GitHub e-mail address does not need to match the invitation address.
  - The **first Administrator** created by the first-run wizard ([§15.6](15-deployment.md)) has a password and 2FA as a **break-glass account**, so the system can be administered even if GitHub sign-in is unavailable. The Administrator can additionally link a GitHub account.
- **End users** log in with e-mail and password, optionally with a Microsoft or Google account. 2FA is available but optional.
- Password reset uses a one-time link with limited validity.
- Deactivating an account (e.g. a customer's employee leaves) blocks login but keeps their tickets and comments in the history.
- Each user sets their language and time zone in account settings ([§13.1](13-non-functional.md)).

## 7.5 Permission matrix

All permission decisions are made by the API; the UI only adapts to them ([§14.4](14-architecture.md)).

| Action | End user | Developer | Project manager | Admin |
|---|---|---|---|---|
| Create a ticket (simplified form) | ✅ | ✅ | ✅ | ✅ |
| Create a ticket (full form) | – | ✅ | ✅ | ✅ |
| Choose visibility of own ticket | ✅ | ✅ | ✅ | ✅ |
| View own tickets | ✅ | ✅ | ✅ | ✅ |
| View other people's tickets according to visibility ([§5.1](05-visibility-and-search.md)) | ✅ | ✅ | ✅ | ✅ |
| View all tickets of the project | – | ✅ | ✅ | ✅ |
| Add public comments to visible tickets | ✅ | ✅ | ✅ | ✅ |
| Edit or delete own comments and notes | ✅ | ✅ | ✅ | ✅ |
| Delete any comment (e.g. to remove personal data) | – | ✅ | ✅ | ✅ |
| Edit own ticket description | ✅ | ✅ | ✅ | ✅ |
| Edit any ticket description | – | ✅ | ✅ | ✅ |
| "I have the same problem" on visible tickets | ✅ | – | – | – |
| Watch / unwatch visible tickets | ✅ | ✅ | ✅ | ✅ |
| View the public roadmap | ✅ | ✅ | ✅ | ✅ |
| Own saved views, own notification settings | – | ✅ | ✅ | ✅ |
| Add internal notes, view internal statuses | – | ✅ | ✅ | ✅ |
| Change status | – | ✅ | ✅ | ✅ |
| Edit ticket fields (type, priority) | – | ✅ | ✅ | ✅ |
| Assign tickets | – | to self only | ✅ | ✅ |
| Create sub-tickets and relations, assign labels | – | ✅ | ✅ | ✅ |
| Edit, merge and delete project labels | – | – | ✅ | ✅ |
| Approve sharing with all customers, mark ticket as shared | – | ✅ | ✅ | ✅ |
| Triage queue | – | – | ✅ | ✅ |
| Roadmap, milestones, ticket dates and Gantt chart | – | view only | ✅ | ✅ |
| Create GitHub issues from tickets | – | ✅ | ✅ | ✅ |
| View SLA deadlines | – | ✅ | ✅ | ✅ |
| SLA reports ([§9.6](09-sla.md)) | – | – | ✅ | ✅ |
| Manage project members (team roles) | – | – | ✅ | ✅ |
| Invite individual end users to the project | – | – | ✅ | ✅ |
| Create own personal API tokens | – | ✅ | ✅ | ✅ |
| Export own data, request account deletion ([§13.2](13-non-functional.md)) | ✅ | ✅ | ✅ | ✅ |
| Execute anonymization, set retention period | – | – | – | ✅ |
| Grant organizations access to projects | – | – | – | ✅ |
| Create projects and organizations | – | – | – | ✅ |
| SLA policies and business calendars | – | – | – | ✅ |
| Ticket templates | – | – | – | ✅ |
| GitHub integration configuration | – | – | – | ✅ |
| Integration tokens, outgoing webhooks, data import | – | – | – | ✅ |
| Administrative audit log ([§13.5](13-non-functional.md)) | – | – | – | ✅ |
