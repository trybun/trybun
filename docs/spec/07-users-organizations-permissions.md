# 07 – Users, organizations and permissions

## 7.1 Role principles

Following the convention of GitHub, GitLab and Jira, team roles are granted **per project**. The same person can hold different roles in different projects, e.g. Developer in one project and Project manager in another.

The **Administrator** role is the exception: it is global and applies to the whole system.

- Every account has exactly one **account kind** (`user.kind`): `team` or `end_user`. The kinds are mutually exclusive: a person is never an end user in one project and a team member in another. The kind decides the sign-in method and 2FA ([§7.4](#74-accounts-and-authentication)).
- A team member has access only to the projects they were added to, with a per-project role (`developer` or `project_manager`). The Administrator role is a flag of a team account.
- An end user has access to the projects of their organization plus the projects they were invited to personally ([§7.3](#73-organizations)). In all of these projects they have the End user role.
- Changing the account kind (e.g. a customer's employee joins the team) is an Administrator action. Converting to `team` removes the organization membership and personal project access and requires a team invitation flow (GitHub binding and 2FA, [§7.4](#74-accounts-and-authentication)); converting to `end_user` removes all team roles. The change is recorded in the audit log ([§13.5](13-non-functional.md)).

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
| E-mail domains | E.g. `company.com`; users invited with an e-mail address in this domain are assigned to the organization automatically (rules below) |
| Projects | Projects the organization has access to (set by the Administrator) |
| Members | End users belonging to the organization |
| SLA policy | Optional SLA policy ([§9.3](09-sla.md)) |

Rules:

- An end user belongs to **at most one** organization. They may belong to none (e.g. an individual customer). Only the Administrator adds users to an organization, removes them or moves them to another one; every change is recorded in the audit log ([§13.5](13-non-functional.md)).
- **E-mail domains**:
  - each domain belongs to at most one organization,
  - public mail domains (e.g. `gmail.com`, `outlook.com`; a maintained blocklist) cannot be added,
  - domain matching is applied only when an account is created from an invitation, and only if the inviting project is among the organization's projects; otherwise the user is created without an organization and gets personal access to the inviting project. The inviting person is shown "This person will join the organization X" (PL: „Ta osoba dołączy do organizacji X”) before sending the invitation,
  - adding or removing a domain later never moves existing users.
- **Changing a user's organization**: tickets stay with the organization in which they were created, because they are the company's data (the ticket's organization is a snapshot taken at creation, [§3.2](03-ticket-model.md)). After the change:
  - the user keeps read and comment access to the tickets they created with visibility `only_me`, even if they no longer have access to the project; creating new tickets requires current access to the project,
  - the user keeps access to shared tickets of projects they still have access to,
  - tickets of the old organization with visibility `my_organization` – including those the user created – are no longer visible to them, and the user is removed from their watchers ([§6.7](06-comments-notifications.md)).
- **Archiving instead of deleting**: organizations and projects are not deleted but **archived**. Only organizations and projects without tickets can be deleted; an archived project is deleted only after it is unarchived, because deleting is a change (`project.archived`). Archiving and unarchiving are done by the Administrator and recorded in the audit log.
  - **Archived project**: read-only for every role, including the Administrator – all user-facing changes are rejected with the error code `project.archived`. It is hidden from navigation; members keep read access to the tickets they could see. SLA clocks stop and keep their state; integration tokens of the project are rejected; incoming GitHub events for it are ignored and logged; outgoing webhooks for it stop; pending invitations to it are revoked. Jobs required by law (GDPR anonymization and retention, [§13.2](13-non-functional.md)) still run.
  - **Archived organization**: its members keep their accounts and read access to the tickets they created, lose access granted through the organization and cannot create tickets through it; domain matching is off.
  - The Administrator can **unarchive** a project or organization; it then works as before.
- Team members do not belong to customer organizations and see tickets of all organizations in their projects.
- A project can serve **many organizations**, and an organization can access **many projects**.
- Members of an organization automatically get access to all projects of the organization; no per-person access grants are needed.
- End users can `@mention` members of their own organization (if any) and team members. The mention suggestions contain only people who can currently see the ticket: the project's team members and, if the ticket's visibility includes them, members of the author's organization. A mention never grants access to a ticket.

### Users without an organization

- Get access to projects only through a personal invitation.
- See their own tickets and shared tickets ([§5.2](05-visibility-and-search.md)).
- Can choose visibility `only_me` or `all_customers` ([§5.1](05-visibility-and-search.md)).

### System without organizations

If no organization exists in the system (e.g. an internal deployment in one company), the UI hides all organization-related elements: the organization field and filter, the visibility option `my_organization` and the organization count on shared tickets. These elements appear automatically once the first organization is created, with no separate setting (Rule 2).

## 7.4 Accounts and authentication

- Authentication is handled by the identity provider **Keycloak** ([§14.2](14-architecture.md)). The system implements no password handling, 2FA or external login of its own. Password hashing is configured in Keycloak according to OWASP recommendations (Argon2, `hashAlgorithm(argon2)`).
- **Password policy** (Keycloak `passwordPolicy`, managed configuration, [§15.5](15-deployment.md)): at least 15 and at most 64 characters (spaces and any characters allowed), not the e-mail address or the user name, not in the blocklist of common passwords of the deployment package; no composition rules and no expiry (OWASP ASVS 5.0, NIST SP 800-63B). Keycloak checks it whenever a password is set – the first-run wizard, registration from an invitation, password reset and change – so existing passwords stay valid until they are changed. The length rule is defined once more as `PASSWORD_MIN_LENGTH` and `PASSWORD_MAX_LENGTH` of `@trybun/contracts/users` for the forms of the web application; a test keeps both equal to the realm.
- **No open registration.** Accounts are created only by an invitation ([Invitations](#invitations)). The only exception is the first Administrator account, created in the first-run wizard ([§15.6](15-deployment.md)).
- **Team members** log in with GitHub (OAuth via Keycloak). This links the account to the GitHub login needed for issue assignment ([§11.4](11-github-integration.md)).
  - **Two-factor authentication (2FA) is mandatory for team members** and is enforced by Keycloak, not by GitHub: team accounts are members of the Keycloak group `team`, and the sign-in flow requires a one-time password (TOTP; WebAuthn allowed as an alternative) for that group. The API rejects team actions for sessions without completed 2FA (the authentication methods `amr` of the access token, [§14.4](14-architecture.md)).
  - Team members never sign in with a password, with two exceptions: the break-glass account below and seeded accounts in the local environment.
  - The **first Administrator** created by the first-run wizard ([§15.6](15-deployment.md)) has a password and 2FA as a **break-glass account**, so the system can be administered even if GitHub sign-in is unavailable. The Administrator chooses the password in the wizard; the API passes it to Keycloak as the account's credential once and never stores or logs it, and Keycloak's password policy applies. The Administrator can additionally link a GitHub account.
- **End users** log in with e-mail and password, optionally with a Microsoft or Google account. 2FA is available but optional.
  - A Microsoft or Google account is linked to an existing account only through the invitation flow, or when the provider confirms the e-mail address as verified and the user additionally signs in to the existing account. Accounts are never linked automatically just because the e-mail address matches.
  - Users cannot change their e-mail address themselves (the Keycloak account console does not allow it), because the address decides organization membership, notifications and e-mail replies. The Administrator changes it on request.
- Password reset uses a one-time link with limited validity ([§13.5](13-non-functional.md)).
- **Deactivating an account** (e.g. a customer's employee leaves) is done by the Administrator. It blocks login, **immediately ends all sessions** (in Keycloak and in the web application, [§14.4](14-architecture.md)) and **revokes all API tokens** of the account; it keeps their tickets and comments in the history. Open tickets assigned to a deactivated team member are unassigned with an automatic event and appear in the predefined list view "Unassigned" ([§8.1](08-team-views.md)). The Administrator can reactivate the account.
- **Removing a team member from a project** (or their last role in it) unassigns them from the project's open tickets in the same way; watchers without access are removed at the next notification ([§6.7](06-comments-notifications.md)). Removing a project's last Project manager – or changing their role to Developer – is allowed (the Administrator covers the role), but a warning is shown.
- Each user sets their language and time zone in account settings ([§13.1](13-non-functional.md)).
- **Local environment**: in the local development environment only ([§15.1](15-deployment.md)), seeded team accounts can sign in with a password, so contributors do not need their own GitHub OAuth application. This is disabled in the test and production environments.

### User accounts

Keycloak stores only credentials and sign-in factors. Everything else about a person is stored in the application database, which is the **only source of truth for roles** – roles are never read from token claims, and all permission decisions are made by the CASL abilities in the API ([§14.4](14-architecture.md)).

| Field | Description |
|---|---|
| Identifier | UUIDv7 ([§17.2](17-conventions.md)) |
| Keycloak user ID | The `sub` of the Keycloak user; unique; links the account to Keycloak |
| E-mail | Unique; used for invitations, notifications and organization domains |
| Display name | Shown in the UI |
| Language, time zone | Account settings ([§13.1](13-non-functional.md)) |
| Kind (`user.kind`) | `team` or `end_user` ([§7.1](#71-role-principles)) |
| Administrator (`user.is_admin`) | Global Administrator role; only for `team` accounts |
| State (`user.state`) | `invited` (account created by an invitation or import, not yet signed in), `active`, `deactivated`, `anonymized` ([§13.2](13-non-functional.md)) |
| GitHub login | For team accounts, from the GitHub sign-in ([§11.4](11-github-integration.md)) |

- Per-project team roles are stored as **project memberships** (`project_member`: user, project, role `developer` or `project_manager`). The Administrator and the project's Project managers add existing active team accounts to a project directly, choose their role, change it and remove them; the member picker lists the active team accounts that are not members of the project – display name and GitHub login, never the e-mail address – to whoever may manage the members of that project. Invitations by e-mail add existing accounts through the same membership change. Personal access of end users to a project is stored as a project membership with role `end_user`; access through an organization is derived from the organization's projects.
- The API keeps the Keycloak group `team` in sync through the Keycloak Admin API whenever an account becomes or stops being a `team` account.
- Imported people without an account ([§12.5](12-api-webhooks-import.md)) get accounts in state `invited` without a Keycloak user; the Keycloak user is created when they accept an invitation.
- The signed-in account reads its own identifier, display name, e-mail and kind with `GET /api/v1/users/me`, e.g. for the user menu of the application shell ([§18.5](18-code-patterns.md)); it never carries roles, only the codes of the global actions the account may perform (`allowedActions`, e.g. `open_administration` for the Administrator panel and `create_project` for creating projects, [§18.3](18-code-patterns.md)).

### Invitations

Invitations are managed by the application (not by Keycloak e-mails), so the link can always be copied manually. How they are built on Keycloak, with the options considered: [ADR 0009](../adr/0009-invitation-flow.md).

| Field | Description |
|---|---|
| E-mail | Address of the invited person |
| Target | One of: a project with a role (`end_user`, `developer`, `project_manager`); an organization (end user, Administrator only); the Administrator role (team, Administrator only) |
| Invited by | The inviting person |
| Token | Random, single-use; only its hash is stored |
| Expires at | **7 days** after creation |
| Used at / revoked at | Set on acceptance or revocation |

- The invitation link is sent by e-mail in the system default language ([§13.1](13-non-functional.md)) and can always be **copied and passed on manually**, so inviting works even before e-mail is configured. It can be resent (a new token) or revoked.
- **Accepting**: the link opens the web application, which checks the token and starts the Keycloak sign-in:
  - team invitations: sign-in with GitHub; on return, the GitHub account is bound to the invited account. The GitHub e-mail address does not need to match the invitation address. Keycloak then requires the 2FA setup,
  - end-user invitations: Keycloak registration with the invited e-mail address pre-filled and locked; the user sets a password (or uses Microsoft/Google, see above).
  - The application then links the returned Keycloak user ID to the account, marks the invitation as used and opens the invited project ([§5.7](05-visibility-and-search.md)).
- **Existing accounts**: inviting an e-mail address that already has an account of the right kind does not send an invitation; the access is granted directly and the person is notified. An address with an account of the other kind is rejected with an explanation (a kind change is an Administrator action, [§7.1](#71-role-principles)).
- Organization assignment by e-mail domain follows [§7.3](#73-organizations).
- Keycloak self-registration is reachable only through an invitation link; without an accepted invitation, a Keycloak account gives no access to the system.

## 7.5 Permission matrix

All permission decisions are made by the API; the UI only adapts to them ([§14.4](14-architecture.md)). Two rules apply on top of the matrix:

- In an **archived project** every change is forbidden for every role, including the Administrator, until it is unarchived ([§7.3](#73-organizations)).
- Actions on records the user cannot see return `404`, never `403` ([§17.2](17-conventions.md)).

| Action | End user | Developer | Project manager | Admin |
|---|---|---|---|---|
| Create a ticket (simplified form) | ✅ | ✅ | ✅ | ✅ |
| Create a ticket (full form) | – | ✅ | ✅ | ✅ |
| Choose visibility of own ticket | ✅ | ✅ | ✅ | ✅ |
| View own tickets (subject to organization changes, [§7.3](#73-organizations)) | ✅ | ✅ | ✅ | ✅ |
| View other people's tickets according to visibility ([§5.1](05-visibility-and-search.md)) and comment audience ([§5.2](05-visibility-and-search.md)) | ✅ | ✅ | ✅ | ✅ |
| View all tickets of the project | – | ✅ | ✅ | ✅ |
| Add public comments to visible tickets (terminal tickets: [§4.3](04-ticket-lifecycle.md)) | ✅ | ✅ | ✅ | ✅ |
| Confirm or decline resolution of own ticket ([§4.3](04-ticket-lifecycle.md)) | ✅ (requester only) | – | – | – |
| Edit or delete own comments and notes | ✅ | ✅ | ✅ | ✅ |
| Delete any comment (e.g. to remove personal data) | – | ✅ | ✅ | ✅ |
| Edit own ticket title and description | ✅ | ✅ | ✅ | ✅ |
| Edit any ticket title and description | – | ✅ | ✅ | ✅ |
| View edit history of descriptions and comments | own texts only | ✅ | ✅ | ✅ |
| Redact a description or any comment ([§5.2](05-visibility-and-search.md)) | – | ✅ | ✅ | ✅ |
| Add attachments to visible tickets | ✅ | ✅ | ✅ | ✅ |
| Delete own attachments | ✅ | ✅ | ✅ | ✅ |
| Delete any attachment | – | ✅ | ✅ | ✅ |
| "I have the same problem" on visible tickets | ✅ | – | – | – |
| Watch / unwatch visible tickets | ✅ | ✅ | ✅ | ✅ |
| View the public roadmap | ✅ | ✅ | ✅ | ✅ |
| Own saved views, own notification settings | – | ✅ | ✅ | ✅ |
| Add internal notes, view internal statuses | – | ✅ | ✅ | ✅ |
| Change status | – | ✅ | ✅ | ✅ |
| Edit ticket fields (type, priority) | – | ✅ | ✅ | ✅ |
| Assign tickets (only to active team members of the project) | – | to self only (incl. taking over and unassigning self) | ✅ | ✅ |
| Create sub-tickets and relations, assign labels | – | ✅ | ✅ | ✅ |
| Edit, merge and delete project labels | – | – | ✅ | ✅ |
| Narrow visibility of own ticket that is not shared ([§5.3](05-visibility-and-search.md)) | ✅ | ✅ | ✅ | ✅ |
| Change visibility of any ticket, incl. narrowing a shared ticket | – | ✅ | ✅ | ✅ |
| Approve or reject sharing with all customers, share a ticket | – | ✅ | ✅ | ✅ |
| Triage queue | – | – | ✅ | ✅ |
| Roadmap, milestones, ticket dates and Gantt chart | – | view only | ✅ | ✅ |
| Create GitHub issues from tickets | – | ✅ | ✅ | ✅ |
| View SLA deadlines | – | ✅ | ✅ | ✅ |
| SLA reports ([§9.6](09-sla.md)) | – | – | ✅ | ✅ |
| View project members (display name, GitHub login, role) of own project | – | ✅ | ✅ | ✅ |
| Manage project members: invite team members and grant or remove the roles Developer and Project manager in own project | – | – | ✅ | ✅ |
| Invite individual end users to the project | – | – | ✅ | ✅ |
| Project settings: resolution confirmation, WIP limits ([§8.2](08-team-views.md)) | – | – | ✅ | ✅ |
| Project settings: name, key, default SLA policy, sync direction, linked repositories | – | – | – | ✅ |
| Create own personal API tokens | – | ✅ | ✅ | ✅ |
| Export own data, request account deletion ([§13.2](13-non-functional.md)) | ✅ | ✅ | ✅ | ✅ |
| Execute anonymization, set retention period | – | – | – | ✅ |
| Grant organizations access to projects | – | – | – | ✅ |
| Manage organization members and e-mail domains, invite end users to an organization | – | – | – | ✅ |
| Create, archive, unarchive and delete (if empty) projects and organizations | – | – | – | ✅ |
| Deactivate and reactivate accounts, change account kind or e-mail address | – | – | – | ✅ |
| Grant or revoke the Administrator role | – | – | – | ✅ |
| SLA policies and business calendars | – | – | – | ✅ |
| Ticket templates | – | – | – | ✅ |
| GitHub integration configuration | – | – | – | ✅ |
| Integration tokens, outgoing webhooks, data import | – | – | – | ✅ |
| Administrative audit log ([§13.5](13-non-functional.md)) | – | – | – | ✅ |
