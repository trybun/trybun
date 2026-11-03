# Permission layer – roles, hierarchy, account kinds and the permission matrix

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-10-26 |
| Plan task | `S1-04` |
| System specification sections | §7.1, §7.2, §7.3, §7.4, §7.5, §12.2, §14.4, §17.2, §18.3, §18.7, §18.9 |
| Related issues / PRs | [#111](https://github.com/trybun/trybun/pull/111) (S1-01 projects), [#112](https://github.com/trybun/trybun/pull/112) (S1-02 organizations), [#113](https://github.com/trybun/trybun/pull/113) (S1-03 invitations and accounts) – all three merged and implemented; S1-20 (account administration, uses the `User` rules of S1-04) |

## Context

All permission decisions are made by CASL abilities in the API, and the same definition filters database queries ([§14.4](../../../docs/spec/14-architecture.md), [§18.3](../../../docs/spec/18-code-patterns.md)). S1-01, S1-02 and S1-03 are implemented and built the first rules of their subjects, as their change specifications proposed ([`projects`](2026-10-26-projects.md) Q1, [`organizations`](2026-10-26-organizations.md) Q11, [`invitations-and-accounts`](2026-10-26-invitations-and-accounts.md)). On `main` today:

- `@casl/prisma` is installed; `AbilityFactory.forPrincipal()` builds a `createPrismaAbility` from the rules of the feature modules followed by the global restrictions, passed to `AuthorizationModule.forRoot({ rules, restrictions })`.
- Conditions are relation conditions limited to the principal, e.g. `{ members: { some: { userId } } }`; a record checked in memory carries only the principal's own membership ([§18.3](../../../docs/spec/18-code-patterns.md), "Authorization").
- `PrismaRecordAccess` looks a target record up through `accessibleBy(ability, 'read')` and answers `404`, the code of the denying rule (`409 project.archived`) or `403`. It knows each subject (`Project`, `Organization`, `Invitation`, `User`) in its own `switch` branch with a hand-written `select`.
- Rules exist for `Project` (Administrator; team members; Project managers), `Organization` (Administrator only), `Invitation` (Administrator; Project managers of the project) and `User` (Administrator; never deactivate or revoke the Administrator role of the own account; the last active Administrator is checked by the service, `409 user.last_administrator`, [§7.4](../../../docs/spec/07-users-organizations-permissions.md)).
- The archived restrictions of projects and organizations list a module-local copy of the actions minus the exceptions. Invitations check an archived project or organization in the service, not with a restriction.
- Every `to<Resource>Response` computes `allowedActions` as the contract's closed list filtered by `ability.can`; global actions come with `GET /api/v1/users/me`.
- **No end user sees any project**: `projectsAbilities` returns early for `end_user` accounts, although S1-03 stores personal access as a membership with role `end_user` and S1-02 stores the projects and members of organizations. The team rules accept a membership of any role, so an `end_user` membership of a `team` account would grant team access.
- The abilities tests are per module, each with its own principal fixtures; there is no hierarchy test, no check that lists and details agree, and no single table of the §7.5 rows.

The plan's row of S1-04 asks for roles, hierarchy, account kinds, policy checks for every endpoint, visibility filtering in queries, the permission matrix as executable tests, the rules for projects, organizations and accounts, and `allowedActions` in the responses of these resources. "Done when": every row of [§7.5](../../../docs/spec/07-users-organizations-permissions.md) about projects, organizations and accounts has an allowed and a denied test; a Developer of project A gets `404` for project B; a project response lists exactly the actions the principal may perform on it. S1-04 therefore **takes over** what exists unchanged in behaviour, **adds** what is missing and **generalizes** the per-subject parts.

The specification leaves a few gaps for this task. Agents may not decide them (Rule 8); each is under [Open questions](#open-questions) with a proposed answer, and the design below assumes the proposed answers.

## Goals

- End users see the projects they have personal access to and the projects of their active organization ([§7.1](../../../docs/spec/07-users-organizations-permissions.md), [§7.3](../../../docs/spec/07-users-organizations-permissions.md)). The plan row names "account kinds" and "the rules for projects", and S1-02 handed the derived access to S1-04 ([`organizations`](2026-10-26-organizations.md), "Out of scope"); the portal that shows these projects is S1-09.
- The role hierarchy of [§7.2](../../../docs/spec/07-users-organizations-permissions.md) and the exclusive account kinds of [§7.1](../../../docs/spec/07-users-organizations-permissions.md) defined once and used by every rule.
- One generic record lookup: each subject registers a record descriptor next to its rules instead of a `switch` branch in the platform.
- Global restrictions that fail closed: derived from the contract's closed action lists, and used for every subject that depends on the state of a project or an organization.
- The account rules S1-20 needs (`change_kind`, `change_email`).
- The permission matrix as executable tests: every §7.5 row about projects, organizations, invitations and accounts with an allowed and a denied case, one principal factory, a hierarchy test, a check that lists equal details, and the Done-when tests.

## Non-goals

- New endpoints or UI. The web application already follows `allowedActions` ([§18.5](../../../docs/spec/18-code-patterns.md)); the end users' portal arrives with its tasks.
- The rules of tickets, comments, attachments and visibility ([§5.1](../../../docs/spec/05-visibility-and-search.md)): each task adds them for what it introduces (plan, "How to use this plan").
- The endpoints and contract codes of the account kind and e-mail change (S1-20, [Q11](#open-questions)).
- "Export own data, request account deletion" and "Execute anonymization, set retention period" (S1-16); "Create own personal API tokens" and the token scope (S6-02, [Q6](#open-questions)); the audit log view.
- A helper for `allowedActions`: the closed list filtered by `ability.can` in each `to<Resource>Response` is already one pattern ([§18.3](../../../docs/spec/18-code-patterns.md)); S1-04 keeps it.
- 2FA and account state: the authentication guard enforces them before any ability is built ([§14.4](../../../docs/spec/14-architecture.md)).
- A product tour, user documentation or getting-started item: nothing visible changes for team members.

## Proposed change

### Roles, hierarchy and account kinds

`platform/authorization` gets one pure module (no I/O) with the project roles and the hierarchy of [§7.2](../../../docs/spec/07-users-organizations-permissions.md):

| Function | Returns |
|---|---|
| `teamRolesFrom('developer')` | `developer`, `project_manager` |
| `teamRolesFrom('project_manager')` | `project_manager` |

A team rule names the lowest role that holds it and conditions the membership on the roles from it: `{ members: { some: { userId, role: { in: teamRolesFrom('developer') } } } }`. The Administrator holds every rule through `isAdmin`, which counts only for `team` accounts (as today). Rows that §7.5 gives only to end users are tied to the account kind and are not inherited by the team roles ([Q3](#open-questions)); the first such rows arrive with tickets.

The kinds are exclusive ([§7.1](../../../docs/spec/07-users-organizations-permissions.md)): team rules are defined only for `team` accounts and match only team roles, end-user rules only for `end_user` accounts and match only the role `end_user`. A membership that contradicts the account kind therefore grants nothing ([Q4](#open-questions)).

### End users' access to projects

`projectsAbilities` gets the rules of `end_user` accounts, `read` only (§7.5 gives end users no project action and no member list):

- personal access: `{ members: { some: { userId, role: 'end_user' } } }`,
- access through the organization: `{ organizations: { some: { organization: { is: { state: 'active', members: { some: { userId } } } } } } }` – only while the organization is active ([§7.3](../../../docs/spec/07-users-organizations-permissions.md)); `is`, because the in-memory check supports a to-one relation only in this form (as in `invitations.abilities.ts`).

CASL joins the two rules with OR, both as an `accessibleBy` filter and in memory. The project record of the rules gains the principal's organization access, limited like its membership: `organizations: { where: { organization: { members: { some: { userId } } } }, select: { organization: { select: { state: true, members: { where: { userId }, select: { userId: true } } } } } }` – at most one row, because an end user belongs to at most one organization. The archived restriction keeps `read`, so end users keep seeing an archived project like its members ([§7.3](../../../docs/spec/07-users-organizations-permissions.md)). Organizations stay invisible to everyone but the Administrator ([`organizations`](2026-10-26-organizations.md)): an end user sees the projects of their organization, not the organization record.

The `role` of the project response ("the principal's own role in the project") is `end_user` for both paths, because an end user has the End user role in all of their projects ([§7.1](../../../docs/spec/07-users-organizations-permissions.md)); today it is set only from a membership, so the response derives it from the loaded organization access as well.

### Record descriptors

The `switch` of `PrismaRecordAccess` is replaced by one **record descriptor** per subject with records, exported by `<feature>.abilities.ts` next to its rules and passed by the root module: `AuthorizationModule.forRoot({ rules, restrictions, records })` (`platform` never imports `modules`). A descriptor names the subject and loads a record for a `where` – the typed Prisma delegate of the model with the `select` of the fields its rules read, limited to the principal. It takes a transaction client, so the services can use it inside their transactions (after `lockForShare`) as well:

```ts
export const projectRecords: RecordDescriptor<'Project'> = {
  subject: PROJECT,
  find: (db: Prisma.TransactionClient, where, principal) =>
    db.project.findFirst({ where, select: projectRuleSelect(principal) }),
};
```

`PrismaRecordAccess` becomes subject-independent: `where = { AND: [accessibleBy(ability, 'read').ofType(subject), { id }] }`, no row → `404`, else the action check as today. An unregistered subject is a start-up error, not a silent `404`. The services that compute `allowedActions` of a record load it with the same `<feature>RuleSelect(principal)`, so the fields of the rules are selected in one place. The rule record types (`ProjectRuleRecord`, …) are derived from these selects (`Prisma.ProjectGetPayload`) and move into the modules; `AppSubject` in `platform` stays the union of the subject names and their records.

A unit test checks, for every principal fixture, that each field a rule or restriction condition of a subject reads is selected by its descriptor, so an in-memory check never sees a missing field.

### Restrictions fail closed

- The archived restrictions of projects and organizations list the contract's closed list (`projectActionSchema.options`, `organizationActionSchema.options`) minus their exceptions, instead of a module-local copy, so an action added to a contract is forbidden on an archived record by default. A test checks, for the Administrator, that every action of the closed list is either refused on an archived record with its code or an explicit exception.
- **Subjects that depend on a project or an organization** are restricted by a relation condition on that record ([Q10](#open-questions)), with the relation's `state` selected by their descriptor. `Invitation` is the first such subject. `invitationRestrictions` forbid `create`, `resend` and `revoke` (`read` stays allowed):
  - `{ project: { is: { state: 'archived' } } }` because `project.archived`,
  - `{ target: 'organization', organization: { is: { state: 'archived' } } }` because `organization.archived` – limited to the target `organization`, because a project invitation of an end user also stores the organization matched by domain ([§7.4](../../../docs/spec/07-users-organizations-permissions.md)), and its archiving must not block it.

  The record of a new invitation, checked before it exists, carries `project: { state, members }` or `organization: { state }` of its target. The service checks of an archived target and `isTargetArchived` in `toInvitationResponse` are removed; `allowedActions` of an invitation then come from the ability alone. The responses stay `409 project.archived` and `409 organization.archived`, now – as for projects ([§17.2](../../../docs/spec/17-conventions.md)) – also before a `403`: a Developer who tries to invite to an archived project gets `409`, not `403`. Tickets and later project-owned subjects follow this pattern.
- **Exception**: granting or removing an organization's access to an archived project stays a service check (`409 project.archived`), because the projects come from the request body, not from a record the restriction could test.
- The token scope joins the restriction list with S6-02 ([Q6](#open-questions)).

### Policy checks for every endpoint

Every endpoint is covered by exactly one of these mechanisms – no new decorator ([Q7](#open-questions)):

| Endpoint | Check |
|---|---|
| Addresses a record in its path | `@TargetRecord({ subject, param, action })`; when the service loads the record anyway (the state changes of accounts, resending and revoking invitations), `@TargetRecord` with `read` and `ability.can(action, record)` on the record loaded in the transaction – the same decision, without a second lookup |
| Lists records | `accessibleBy(ability, 'read')` in the service's `where` |
| Creates a record or performs a global action (`create_project`, `create_organization`, `open_administration`, issuing an invitation) | `ability.can(action, subject)` in the service, `403` otherwise; a parent record named in the body (the project or organization of an invitation) is looked up through `accessibleBy` first, `404` when invisible |
| Acts on the principal's own account (`GET` and `PATCH /api/v1/users/me`) or is `@Public()` (setup, health, invitation redemption) | none – the principal is the record |

Every endpoint existing when S1-04 is merged has an integration test of its denied case (`404` for an invisible record, `403` or the state code for a forbidden action). S1-04 adds the ones S1-01, S1-02 and S1-03 do not have yet; later endpoints bring their own.

### Rules for projects, organizations, invitations and accounts

S1-04 owns these rows of [§7.5](../../../docs/spec/07-users-organizations-permissions.md) and their tests. Existing rules are taken over without a change of behaviour, except the role filter of the hierarchy:

| §7.5 row | Subject and action codes | Allowed | Built by |
|---|---|---|---|
| (implicit) See a project | `Project`: `read` | Developer and above; end users with personal or organization access | S1-01; end users: S1-04 |
| View project members of own project | `Project`: `read_members` | Developer and above | S1-01 |
| Manage project members | `Project`: `manage_members` | Project manager, Admin | S1-01 |
| Invite individual end users to the project; view, resend and revoke invitations of own project | `Invitation` with target `project`: `create`, `read`, `resend`, `revoke` | Project manager, Admin | S1-03 |
| Project settings: resolution confirmation, WIP limits | `Project`: `update_settings` | Project manager, Admin | S1-01 |
| Project settings: name, key, … | `Project`: `update` | Admin | S1-01 |
| Create, archive, unarchive and delete (if empty) projects and organizations | `create` (global `create_project`, `create_organization`); `archive`, `unarchive`, `delete` on `Project` and `Organization` | Admin | S1-01, S1-02 |
| Grant organizations access to projects | `Organization`: `manage_projects` | Admin | S1-02 |
| Manage organization members and e-mail domains, invite end users to an organization | `Organization`: `update`, `manage_members`; `Invitation` with target `organization` | Admin | S1-02, S1-03 |
| View the list of accounts | `User`: `read` | Admin | S1-03 |
| Deactivate and reactivate accounts | `User`: `deactivate` (never the own account), `reactivate` | Admin | S1-03 |
| Change account kind or e-mail address | `User`: `change_kind` (never the own account, [Q5](#open-questions)), `change_email` | Admin | S1-04 rules; codes and endpoints S1-20 ([Q11](#open-questions)) |
| Grant or revoke the Administrator role | `User`: `grant_admin`, `revoke_admin` (never the own account) | Admin | S1-03 |
| Set own language and time zone | own account (`PATCH /users/me`), no rule | everyone | S1-03 |

The Administrator panel (`Administration`: `read`, global `open_administration`) keeps its S0-12 rule and joins the matrix.

### Permission tests

- **Principal factory** (`apps/server/test/factories/principal.factory.ts`): Administrator, Project manager, Developer, team member without membership, end user with personal access, end user through an active organization, end user of an archived organization, end user without access; plus records shaped by the descriptors' selects for these principals.
- **Matrix tests** (unit, no database): each `<feature>.abilities.spec.ts` lists the module's §7.5 rows as one `it.each` table – the row title as in §7.5, the principal, the action, the record and the expected result – with at least one allowed and one denied case per row, and the archived cases of every action ([§18.3](../../../docs/spec/18-code-patterns.md), "Permission tests"). The existing cases are moved into these tables.
- **Hierarchy test**: for every project and invitation action and both project states, a Project manager may do everything a Developer may, and an Administrator everything a Project manager may.
- **Kind test**: a `team` account with an `end_user` membership and an `end_user` account with a team membership or `isAdmin` see nothing ([Q4](#open-questions)).
- **Filter equals check** (integration, Testcontainers): for each principal fixture and each subject with a record descriptor, `findMany({ where: accessibleBy(ability, 'read').ofType(subject) })` returns exactly the records whose descriptor-loaded form `ability.can('read', …)` accepts – a list can never disagree with a detail ([§14.4](../../../docs/spec/14-architecture.md)).
- **Done-when tests** (integration): a Developer of project A gets `404` for `GET`, `PATCH` and the member endpoints of project B, with the same body as for a non-existent ID; for every principal fixture and both project states, `allowedActions` of the project response equals the expected list of a table; an end user lists exactly their personal and organization projects with `GET /api/v1/projects`.

### Prior art

GitLab's `DeclarativePolicy` and Discourse's guardian also derive permissions from a role per project with a global administrator, and GitLab answers `404` for projects the user cannot see. Both keep conditions and query scopes as separate code that can drift; CASL with `@casl/prisma` derives the query from the rule, which is why the specification chose it ([§18.8](../../../docs/spec/18-code-patterns.md)). Jira Service Management grants customers access through the organization or individually, as §7.3 does; S1-04 maps both to one `read` rule per path.

## Changes to the system specification

| Section | Change |
|---|---|
| §7.1 | A membership that contradicts the account kind grants nothing ([Q4](#open-questions)) |
| §7.2 | The hierarchy applies to the team roles; rows given only to end users are tied to the account kind ([Q3](#open-questions)) |
| §7.4 | The guard of the own account also covers changing its kind (requirement change, [Q5](#open-questions)) |
| §18.3 "Authorization" | The hierarchy helper and the kind rule; record descriptors and `AuthorizationModule.forRoot({ rules, restrictions, records })`; restrictions fail closed (closed list minus exceptions) and restrict dependent subjects by a relation condition ([Q10](#open-questions)); the check mechanism of every endpoint ([Q7](#open-questions)) |
| §18.7 | The principal factory, matrix tables, the hierarchy and kind tests and the filter equals check |
| §18.9 | Row S1-04 adds the record descriptor of `projects.abilities.ts` and the principal factory; the S0-12 row loses "(until S1-04 extends them)" |

No new glossary terms and no new error codes.

## Open questions

Implementation must not start until every question has an answer. Every answer below is a **proposal awaiting human approval**, accepted when the pull request is approved, unless marked **Settled**.

1. **Sequencing with S1-01, S1-02 and S1-03.** — **Settled** by the merge order: S1-01, S1-02 and S1-03 were merged first (#111, #112, #113) and built their rules, as #111 Q1 and #112 Q11 decided. Neither added the end users' project access, so S1-04 – merged second of S1-03 and S1-04 – adds it, as proposed here on 2026-10-26.
2. **Where the ability's membership data comes from.** — **Settled** by the pattern S1-01 established ([§18.3](../../../docs/spec/18-code-patterns.md)): relation conditions limited to the principal, the record carrying the principal's own membership; S1-04 follows it (Rule 12). The 2026-10-26 proposal of preloaded project IDs on the principal is withdrawn.
3. **Hierarchy and end-user-only rows.** §7.2 says the Administrator has "all permissions of the other roles", but §7.5 gives some rows only to end users (confirm resolution as requester, "I have the same problem"). — **Answer (proposed, awaiting approval):** the hierarchy applies to the team roles; rows given only to end users depend on the account kind and are not inherited. §7.2 gets one sentence saying so.
4. **Data that contradicts the account kind.** §7.4 allows `isAdmin` only for team accounts and §7.1 makes the kinds exclusive, but nothing enforces either for memberships: a `team` account could carry an `end_user` membership, an `end_user` account a team membership. — **Answer (proposed, awaiting approval):** the rules ignore it – team rules match only team roles of `team` accounts, end-user rules only `end_user` memberships of `end_user` accounts; no schema change. Check constraints can be added later without changing behaviour.
5. **Changing the kind of the own account** (a change of a requirement: §7.4 guards deactivating the own account and revoking the own Administrator role, not changing its kind). Converting the own account to `end_user` would also remove its Administrator role. — **Answer (proposed, awaiting approval):** `change_kind` is never allowed on the own account (`403 request.forbidden`), like `deactivate`; `change_email` on the own account stays allowed. The last-Administrator check of a kind change is S1-20's service check (`409 user.last_administrator`).
6. **Token scope restriction.** §18.3 lists the token scope among the global restrictions, but tokens arrive with S6-02, and the plan forbids placeholders. — **Answer (proposed, awaiting approval):** S1-04 builds the restriction list without it; S6-02 adds the token principals and the scope restriction to the same list, with its own tests.
7. **How "policy checks for every endpoint" is verified.** — **Answer (proposed, awaiting approval):** by the four rows of [Policy checks](#policy-checks-for-every-endpoint) and an integration test of the denied case per endpoint, checked in review; no new decorator and no test that enumerates the routes. Alternative: a test that fails for a handler without `@Public()`, `@TargetRecord()` or an explicit marker – a new decorator and pattern (Rule 12).
8. **Machine check of matrix coverage.** — **Answer (proposed, awaiting approval):** no parser of §7.5; each `abilities.spec.ts` names its rows by their §7.5 title and the review checks them. Reversible: a check can be added when the matrix grows.
9. **One specification or several.** — **Answer (proposed, awaiting approval):** one specification and one implementation PR, as the plan defines one task.
10. **Archived state of dependent subjects.** The archived state lives on `Project` and `Organization`; `Invitation` checks it in its service today, and tickets will need it. — **Answer (proposed, awaiting approval):** a relation condition in the restriction of each dependent subject, with the relation's state selected by its descriptor; `Invitation` moves to it with the same codes, which then also come before a `403` (as for projects). A check that depends on records named in the request body (an organization's project access) stays in the service. Alternative: keep the service checks of `Invitation` and use the restriction from tickets on – two patterns for one problem.
11. **Rules of the account kind and e-mail change before their endpoints.** The plan gives S1-04 "the rules for … accounts" and S1-20 uses "the `User` rules and tests of S1-04", but the endpoints arrive with S1-20. — **Answer (proposed, awaiting approval):** S1-04 writes the `change_kind` and `change_email` rules and their matrix tests; S1-20 adds the two codes to `userActionSchema` with its endpoints, so `allowedActions` never offers an action that has no endpoint. Conditions: both on accounts in state `invited`, `active` or `deactivated`, never `anonymized` (an anonymized account has no person behind it, [§13.2](../../../docs/spec/13-non-functional.md)); `change_kind` never on the own account (Q5). The effects of a kind change – removing the Administrator role and memberships, the last-Administrator check – are S1-20's service. Alternative: S1-20 writes the rules as well.

## Phasing and implementation plan

One phase, one PR (Q9). Each step leaves the application working.

1. The hierarchy helper and the kind rule; the team conditions of `projects.abilities.ts` and `invitations.abilities.ts` on `teamRolesFrom()`; the principal factory; the existing abilities tests moved into matrix tables. Test: the matrix tables, the hierarchy test, the kind test.
2. The end users' project rules and the organization access in the project select. Test: matrix rows of end users (personal, active organization, archived organization, none); integration test of `GET /api/v1/projects` and `GET /api/v1/projects/{id}` for end users, with `role` `end_user` for both access paths.
3. Record descriptors, `forRoot({ rules, restrictions, records })` and the subject-independent `PrismaRecordAccess`; services load records with the shared selects. Test: `request-pipeline.spec.ts` cases for `404`, the state code and `403`; the selected-fields test; the Done-when `404` for project B.
4. Restrictions from the contract lists; `invitationRestrictions` replacing the service checks (Q10). Test: the archived cases of every action of `Project`, `Organization` and `Invitation`; the existing invitation tests of archived targets pass, except a Developer's invitation to an archived project, now `409` instead of `403`; a project invitation whose matched organization is archived can still be resent and revoked.
5. The `change_kind` and `change_email` rules (Q5, Q11). Test: their matrix rows, including the own account.
6. The filter equals check; the `allowedActions` table of the project response; the denied-case integration test of every existing endpoint that has none.
7. Specification changes of the table above, §18.9, the plan row of S1-04 marked done, this file moved to `implemented/`. Test: `pnpm lint:spec`.

## Acceptance criteria

- [ ] Every §7.5 row about projects, organizations, invitations and accounts has an allowed and a denied case in an `abilities.spec.ts`
- [ ] A Developer of project A gets `404` for project B, with the same response as for a non-existent ID
- [ ] For every principal fixture and project state, the project response lists exactly the permitted actions
- [ ] An end user sees exactly the projects of their personal access and of their active organization
- [ ] Lists and details use the same rule: the filter equals check passes for every principal fixture and subject
- [ ] A membership that contradicts the account kind grants nothing (if Q4 is adopted)
- [ ] An Administrator cannot change the kind of their own account (if Q5 is adopted)
- [ ] Every endpoint existing at merge time has an integration test of its denied case
- [ ] Works on phone, tablet and desktop (Rule 9) – n/a, no UI change
- [ ] User documentation and product tour updated where relevant (Rules 3, 4) – n/a, nothing visible changes

## Changelog

- 2026-10-26 – Created.
- 2026-11-03 – Refreshed after S1-01, S1-02 and S1-03 were implemented: Context describes the code on `main`; Q1 and Q2 settled by the merge order and the established pattern; Q5 narrowed to the kind change (§7.4 now guards the rest); Q11 added with the conditions of the kind and e-mail change; the `Invitation` restriction limited to its target and its actions listed, the organization's project access named as a service-check exception, the check of records loaded by the service and of parent records added to the policy checks, the project `role` of organization access, record descriptors on a transaction client; the scope reduced to the end users' access, the hierarchy and kinds, record descriptors, fail-closed restrictions (now also of `Invitation`) and the matrix tests; the `allowedActionsOf()` helper dropped in favour of the existing pattern.
- 2026-11-03 – Implemented (#225). Deviations, recorded in §18.3: the rule record types stay in `ability-factory.ts`, because `platform` never imports `modules` and `AppSubject` needs them; a `@TargetRecord()` of a subject without a descriptor fails at the request, not at start-up; the rules, restrictions and descriptors are one list, `ABILITY_DEFINITIONS`, which the integration tests use as well; organizations, accounts and the Administrator panel answer their list and creation with `404` for non-Administrators, as S1-02 and S1-03 built them, which the policy checks now name.
