# Permission layer – roles, hierarchy, account kinds and the permission matrix

| | |
|---|---|
| Status | `draft` |
| Created | 2026-10-26 |
| Plan task | `S1-04` |
| System specification sections | §7.1, §7.2, §7.3, §7.4, §7.5, §12.2, §14.4, §17.2, §18.3, §18.9, glossary |
| Related issues / PRs | [#111](https://github.com/trybun/trybun/pull/111) (S1-01 projects, open question 1 and 3), [#112](https://github.com/trybun/trybun/pull/112) (S1-02 organizations, open question 11), S1-03 (invitations and accounts, change specification in parallel) |

## Context

All permission decisions are made by CASL abilities in the API, and the same definition filters database queries ([§14.4](../../docs/spec/14-architecture.md), [§18.3](../../docs/spec/18-code-patterns.md)). Today only the skeleton exists, built by S0-05, S0-12 and S0-17:

- `AbilityFactory.forPrincipal()` builds a `MongoAbility` from the rules of the feature modules. The only rule is `administration.abilities.ts`: an Administrator may `read` the subject `Administration`.
- `RecordAccess` is `NoSubjectRecordAccess`: the target record guard answers `404` for every record, because no subject has records yet.
- The principal carries only `userId`, `userKind` and `isAdmin`; `@casl/prisma` is not installed, so `accessibleBy` does not exist.
- The authentication guard already refuses accounts that are not `active` and team sessions without a second factor (`401 authentication.second_factor_required`, [§14.4](../../docs/spec/14-architecture.md)).
- `GET /api/v1/users/me` returns the global action `open_administration` from the ability.

The plan's row of S1-04 asks for roles, hierarchy, account kinds, policy checks for every endpoint, visibility filtering in queries, the permission matrix as executable tests, the rules for projects, organizations and accounts, and `allowedActions` in the responses of these resources. "Done when": every row of [§7.5](../../docs/spec/07-users-organizations-permissions.md) about projects, organizations and accounts has an allowed and a denied test; a Developer of project A gets `404` for project B; a project response lists exactly the actions the principal may perform on it.

S1-04 is in group 2, after S1-01 and S1-02 (group 1), which need working rules to meet their own "Done when" (`409 project.archived`). Their change specifications therefore propose that they build the first rules of their subjects – `projects.abilities.ts` with the archived restriction and a `RecordAccess` for `Project` ([#111](https://github.com/trybun/trybun/pull/111), open question 1), Administrator-only `organizations.abilities.ts` with the `organization.archived` restriction ([#112](https://github.com/trybun/trybun/pull/112), open question 11) – and that **S1-04 takes them over and generalizes them**. This specification is written under those proposals; it does not decide them again. S1-03 (invitations and accounts) runs in parallel in group 2.

The specification leaves a few gaps for this task (who may act on their own account, where the membership data of the ability comes from, the token scope before tokens exist). Agents may not decide them (Rule 8); each is under [Open questions](#open-questions) with a proposed answer. The design below assumes the proposed answers.

## Goals

- One ability per principal, built from the account kind, the Administrator flag, the project memberships and the organization membership, with the role hierarchy of [§7.2](../../docs/spec/07-users-organizations-permissions.md) defined once.
- One definition for action checks and query filters: `@casl/prisma` with `accessibleBy` in every query that returns records to a principal.
- One generic `RecordAccess` for every subject, so the target record guard answers `404` for invisible records and `403` – or the code of the denying rule – for forbidden actions, without per-subject guard code.
- Global restrictions (archived projects and organizations) applied after every feature rule, in one place.
- The rules of every §7.5 row about projects, organizations and accounts, each with an allowed and a denied test; a Developer of project A gets `404` for project B.
- `allowedActions` computed by one function from the same ability, so a project response lists exactly the permitted actions.
- The reference implementation of "Abilities, `accessibleBy` queries, `allowedActions`, permission tests" ([§18.9](../../docs/spec/18-code-patterns.md)) that later tasks extend with their subjects.

## Non-goals

- New endpoints or UI. S1-04 changes no screen; the web application already follows `allowedActions` ([§18.5](../../docs/spec/18-code-patterns.md)).
- The rules of tickets, comments, attachments and visibility ([§5.1](../../docs/spec/05-visibility-and-search.md)): each task adds them for what it introduces (plan, "How to use this plan").
- The endpoints of account administration – deactivation (S1-03), the kind and e-mail address change (no plan task yet, raised by the S1-03 specification). S1-04 defines their rules and tests at the ability level; the endpoints use them when they are built.
- "Export own data, request account deletion" and "Execute anonymization, set retention period" (S1-16); "Create own personal API tokens" and the token scope (S6-02, [Q6](#open-questions)); the audit log view.
- 2FA and account state checks: the authentication guard already enforces them before any ability is built ([§14.4](../../docs/spec/14-architecture.md)). S1-04 adds no rule for them.
- A product tour, user documentation or getting-started item: nothing visible changes for users.

## Proposed change

### Principal and its grants

The ability needs the person's memberships. The principal resolved by the authentication guard carries them, loaded in the same query that already reads the account ([Q2](#open-questions)):

| Field | Content |
|---|---|
| `userId`, `userKind`, `isAdmin` | As today; `isAdmin` counts only for `team` accounts ([Q4](#open-questions)) |
| `projectRoles` | Project ID → role (`developer`, `project_manager`, `end_user`) from `project_members` |
| `organizationProjectIds` | IDs of the projects of the person's organization, only while the organization is `active` ([§7.3](../../docs/spec/07-users-organizations-permissions.md)) |

One loader in `platform/authorization` builds this user principal from a `where` (Keycloak `sub` in the guard, user ID in Worker jobs that check the ability of an affected user, [§18.3](../../docs/spec/18-code-patterns.md)). A role change takes effect from the next request; no cache is kept across requests ([§14.4](../../docs/spec/14-architecture.md)).

### Roles and hierarchy

One pure function in `platform/authorization` (`domain`-style, no I/O) gives the **effective project role** of the principal in a project:

| Account | Effective role in project P |
|---|---|
| `team`, Administrator | `admin` in every project |
| `team`, member of P | the membership role (`developer` or `project_manager`) |
| `end_user`, personal membership of P, or P among `organizationProjectIds` | `end_user` |
| otherwise | none – P is invisible (`404`) |

Rules are granted cumulatively along the hierarchy of [§7.2](../../docs/spec/07-users-organizations-permissions.md): Developer rules for `developer` and above, Project manager rules for `project_manager` and above, Administrator rules for `admin`. Rows that §7.5 gives only to end users (e.g. "Confirm or decline resolution of own ticket", "I have the same problem") are tied to the account kind and are not inherited by the team roles ([Q3](#open-questions)). A team membership row of an `end_user` account, or an `end_user` membership of a `team` account, grants nothing – the kinds are exclusive ([§7.1](../../docs/spec/07-users-organizations-permissions.md)).

The conditions are written on identifiers the principal carries (`{ id: { in: projectIds } }` for `Project`, `{ projectId: { in: projectIds } }` for project-owned subjects), so the same rule works in memory (`ability.can`) and as a Prisma filter (`accessibleBy`).

### Ability factory and restrictions

- The factory switches from `createMongoAbility` to `createPrismaAbility` of `@casl/prisma` (MIT, 2.x supports Prisma ORM 7; added with an explicit range after the cooldown, Rule 10). `PrismaService` gets the extension `@casl/prisma` requires, once, as a client extension ([§18.3](../../docs/spec/18-code-patterns.md), "Reading data"). Subjects without records (`Administration`) stay plain strings.
- `AuthorizationModule.forRoot({ rules, restrictions })` takes two lists. **Rules** are the `can` rules of the feature modules; **restrictions** are the global `cannot` rules, applied after every rule, so they override it ([§18.3](../../docs/spec/18-code-patterns.md), "Authorization"). Each restriction is defined in the module of its subject (e.g. `projectRestrictions` in `projects.abilities.ts`), because `platform` never imports `modules`.
- A restriction that stands for a state of a record carries its error code as the reason (`.because('project.archived')`). In S1-04 these are the restrictions taken over from S1-01 and S1-02: an archived project forbids every action except `read`, `read_members` and `unarchive`; an archived organization forbids every action except `read`, `unarchive` and `delete` (the exception for `delete` is proposed by [#112](https://github.com/trybun/trybun/pull/112), open question 7). The token scope joins this list with S6-02 ([Q6](#open-questions)).
- CASL has no "every action except": a `cannot` rule lists its actions. Each restriction therefore lists the subject's **closed action list from the contracts minus its exceptions**, so an action added later is forbidden on an archived record by default (fail closed). A test checks that every action of the closed list is either restricted or an explicit exception.
- **Project-owned subjects** (e.g. tickets, later tasks) are restricted by a relation condition `{ project: { state: 'archived' } }`, which works as a Prisma filter and in memory, because the record descriptor of such a subject selects `project: { select: { state: true } }` ([Q10](#open-questions)). S1-04 has no such subject yet; it defines the pattern and its test with `Project` only.

### Record access and the request pipeline

`NoSubjectRecordAccess` (and the per-subject `RecordAccess` of S1-01, if it landed) is replaced by one `PrismaRecordAccess`:

1. Each subject with records registers its **record descriptor** next to its rules in `<feature>.abilities.ts`: the Prisma model delegate (typed, not a string lookup) and the `select` of the fields its conditions read (e.g. `Project`: `id`, `state`). The root module passes the descriptors with the rules. A unit test checks that every field a rule or restriction condition of the subject reads is in the descriptor's `select`, so the in-memory check never sees a missing field.
2. The guard looks the record up with `findFirst({ where: { AND: [accessibleBy(ability, 'read')[subject], { id }] }, select })`. No row: `404 request.not_found`. A record is never loaded first and checked for visibility afterwards ([§18.3](../../docs/spec/18-code-patterns.md)).
3. `ability.can(action, subject(name, record))` false: the reason of the relevant rule (`ability.relevantRuleFor`) if it is an error code, else `403 request.forbidden`.

The order of [§17.2](../../docs/spec/17-conventions.md) is unchanged: `404` before the state code (`409`) before validation (`422`), preconditions (`412`, `428`) and field-level `403` in the service.

### Policy checks for every endpoint

Every endpoint is covered by exactly one of three mechanisms – no new decorator ([Q7](#open-questions)):

| Endpoint | Check |
|---|---|
| Addresses a record in its path | `@TargetRecord({ subject, param, action })` (guard above) |
| Lists records | `accessibleBy(ability, 'read')` in the service's `where` |
| Creates a record or performs a global action (`create_project`, `create_organization`, `open_administration`) | `ability.can(action, subject)` in the service, `403` otherwise |
| `@Public()` (setup, health, invitation redemption) | none, as today |

Every endpoint existing when S1-04 is merged has an integration test of its denied case (`404` for an invisible record, `403` or the state code for a forbidden action); later endpoints bring their own with their task.

### Rules for projects, organizations and accounts

S1-04 owns these rows of [§7.5](../../docs/spec/07-users-organizations-permissions.md). Rules already built by S1-01, S1-02 or S1-03 are taken over without a change of behaviour; S1-04 adds what is missing and the tests:

| §7.5 row | Subject and action codes | Allowed | Built by |
|---|---|---|---|
| (implicit) See a project | `Project`: `read` | every effective role | S1-01; end users: S1-04 |
| (proposed by #111, Q13) View project members | `Project`: `read_members` | Developer and above | S1-01 |
| Manage project members (team roles) | `Project`: `manage_members` | Project manager, Admin | S1-01 |
| Invite individual end users to the project | `Project`: `invite_end_users` | Project manager, Admin | S1-03 uses it |
| Project settings: resolution confirmation, WIP limits | `Project`: `update_settings` | Project manager, Admin | S1-01 |
| Project settings: name, key, … | `Project`: `update` | Admin | S1-01 |
| Create, archive, unarchive and delete (if empty) projects and organizations | `create_project`, `create_organization` (global); `archive`, `unarchive`, `delete` on `Project` and `Organization` | Admin | S1-01, S1-02 |
| Grant organizations access to projects | `Organization`: `manage_projects` | Admin | S1-02 |
| Manage organization members and e-mail domains, invite end users to an organization | `Organization`: `update`, `manage_members` | Admin | S1-02; invitations: S1-03 |
| Deactivate and reactivate accounts, change account kind or e-mail address | `User`: `deactivate`, `reactivate`, `change_kind`, `change_email` | Admin, never on the own account ([Q5](#open-questions)) | S1-04 |
| Grant or revoke the Administrator role | `User`: `grant_admin`, `revoke_admin` | Admin, never on the own account ([Q5](#open-questions)) | S1-04 |
| (implicit) See accounts | `User`: `read` | own account: everyone; all accounts: Admin; active team accounts: Project managers ([#111](https://github.com/trybun/trybun/pull/111), Q3, if adopted) | S1-04 |

Action codes are closed lists per subject in `@trybun/contracts` ([§18.3](../../docs/spec/18-code-patterns.md)); S1-04 adds `invite_end_users` to the project actions and the `User` actions above (`userActionSchema` in `@trybun/contracts/users`). Organization members, domains and project access stay invisible to everyone except the Administrator, as S1-02 proposes ([#112](https://github.com/trybun/trybun/pull/112), "Permissions"); end users therefore see the projects of their organization, not the organization record.

### Allowed actions

One function of `platform/authorization`, `allowedActionsOf(ability, subjectName, record, actions)`, returns the codes of a subject's closed list that `ability.can` permits on the record, in the order of the list. Every `to<Resource>Response` uses it ([§18.3](../../docs/spec/18-code-patterns.md)); global actions go through the same function on `GET /api/v1/users/me`. The response of an archived project therefore lists only `read`, `read_members` (when held) and `unarchive` (Administrator). It is computed in memory from the loaded record, so a list costs no extra query.

### Permission tests

- **Matrix tests** (unit, no database): `<feature>.abilities.spec.ts` lists the module's §7.5 rows as an `it.each` table – the row title as in §7.5, the principal fixture, the action, the record and the expected result – with at least one allowed and one denied case per row, and the archived cases of every action ([§18.3](../../docs/spec/18-code-patterns.md), "Permission tests"). Principal fixtures come from one factory (`test/factories/principal.factory.ts`): Administrator, Project manager, Developer, end user with personal access, end user through an organization, end user of an archived organization, team member without membership.
- **Hierarchy test**: for every project action, a Project manager may do everything a Developer may, and an Administrator everything a Project manager may.
- **Filter equals check** (integration, Testcontainers): for each principal fixture and each subject with a record descriptor (`Project`, `Organization`, `User`), `findMany({ where: accessibleBy(ability, 'read')[subject] })` returns exactly the records for which `ability.can('read', record)` is true – the list can never disagree with the detail ([§14.4](../../docs/spec/14-architecture.md)).
- **Done-when tests** (integration): a Developer of project A gets `404` for `GET`, `PATCH` and the member endpoints of project B, and the same body as for a non-existent ID; for every principal fixture and both project states, the project response's `allowedActions` equals the expected list of a table.

### Prior art

GitLab's `DeclarativePolicy` and Discourse's guardian also derive permissions from a role per project with a global administrator, and GitLab answers `404` for projects the user cannot see. Both keep conditions and query scopes as separate code that can drift; CASL with `@casl/prisma` avoids this by deriving the query from the rule, which is why the specification chose it ([§18.8](../../docs/spec/18-code-patterns.md)). From GitLab the proposal keeps the rule that an administrator cannot lock themselves out ([Q5](#open-questions)).

## Changes to the system specification

| Section | Change |
|---|---|
| §7.1 | Data that contradicts the account kind grants nothing ([Q4](#open-questions)) |
| §7.2 | The hierarchy applies to the team roles; rows given only to end users are tied to the account kind ([Q3](#open-questions)) |
| §7.5 | Rule under the matrix (requirement change): the account actions of the last two account rows, except the e-mail change, are never allowed on the own account, and at least one active Administrator remains ([Q5](#open-questions)) |
| §18.3 "Authorization" | The principal carries its project roles and the projects of its active organization ([Q2](#open-questions)); `AuthorizationModule.forRoot({ rules, restrictions })`; record descriptors and `PrismaRecordAccess`; restrictions fail closed (closed list minus exceptions) and use relation conditions for project-owned subjects ([Q10](#open-questions)); `allowedActionsOf()`; the three check mechanisms of an endpoint ([Q7](#open-questions)); the token scope restriction arrives with S6-02 ([Q6](#open-questions)) |
| §18.7 | Matrix tests with the principal factory, the hierarchy test and the filter equals check |
| §18.9 | Reference row S1-04: `apps/server/src/platform/authorization/` and `apps/server/src/modules/projects/projects.abilities.ts` with `projects.abilities.spec.ts` (actual paths); the S0-12 row loses "(until S1-04 extends them)" |
| Plan (for the maintainer) | S1-04 starts after S1-01 and S1-02 are merged; the boundary with S1-03 ([Q1](#open-questions)) |

No new glossary terms and no new error codes.

## Open questions

Implementation must not start until every question has an answer. Every answer below is a **proposal awaiting human approval**.

1. ⚠ NEEDS HUMAN CONFIRMATION **Sequencing with S1-01, S1-02 and S1-03.** S1-04 writes rules on the models of projects and organizations, which do not exist before S1-01 and S1-02, and the personal end-user access needs the `end_user` project role that S1-03 adds (S1-01 Q9). — **Answer (proposed, awaiting approval):** follow #111 Q1 and #112 Q11 as proposed there: S1-01 and S1-02 build their first rules, and the implementation PR of S1-04 is opened after both are merged. With S1-03 (same group) whichever merges second adds the personal end-user access rule and its tests in the structure of the other; S1-04 keeps the reference role in §18.9. If the maintainer instead moves S1-04 before S1-01, this specification shrinks to the platform part (principal grants, factory, restrictions, `PrismaRecordAccess`, `allowedActionsOf`, account rules) and S1-01 and S1-02 add their rules to it.
2. **Where the ability's membership data comes from.** — **Answer (proposed, awaiting approval):** the principal carries the project roles and the projects of the active organization, loaded with the account in one query per request; conditions are written on these identifiers. Alternative: relation conditions (`members: { some: { userId } }`) that need no preloaded data, but every in-memory check would need the relation loaded with the record. Reversible: only the factory and the loader change.
3. **Hierarchy and end-user-only rows.** §7.2 says the Administrator has "all permissions of the other roles", but §7.5 gives some rows only to end users (confirm resolution as requester, "I have the same problem"). — **Answer (proposed, awaiting approval):** the hierarchy applies to the team roles; rows given only to end users depend on the account kind and are not inherited. §7.2 gets one sentence saying so.
4. **Data that contradicts the account kind.** §7.4 allows `isAdmin` only for team accounts, and §7.1 makes the kinds exclusive, but nothing enforces either: an `end_user` account could carry `isAdmin` or a team membership row, a `team` account an `end_user` membership. — **Answer (proposed, awaiting approval):** the ability ignores data that contradicts the kind: `isAdmin` counts only for `team`, team roles only for `team`, `end_user` access only for `end_user`; no schema change. Database check constraints can be added later without changing behaviour.
5. **Actions on the own account** (a change of a requirement: §7.5 gives these actions to the Administrator without exception). Nothing stops an Administrator from deactivating their own account, changing its kind or revoking their own Administrator role, which can leave the system without an Administrator. — **Answer (proposed, awaiting approval):** never on the own account – a `cannot` rule with `{ id: principal.userId }`, `403 request.forbidden`; `change_email` on the own account stays allowed. Because two Administrators could revoke each other concurrently, the service of `revoke_admin`, `deactivate` and `change_kind` (built with the endpoints) also checks in its transaction, under a lock, that another active Administrator remains (`409`, code defined with the endpoint).
6. **Token scope restriction.** §18.3 lists the token scope among the global restrictions, but tokens arrive with S6-02, and the plan forbids placeholders. — **Answer (proposed, awaiting approval):** S1-04 builds the restriction list without it; S6-02 adds the token principals and the scope restriction to the same list, with its own tests.
7. **How "policy checks for every endpoint" is verified.** — **Answer (proposed, awaiting approval):** by the three mechanisms of [Policy checks](#policy-checks-for-every-endpoint) and an integration test of the denied case per endpoint, checked in review; no new decorator and no test that enumerates the routes. Alternative: a test that fails for a handler without `@Public()`, `@TargetRecord()` or an explicit marker – a new decorator and pattern (Rule 12).
8. **Machine check of matrix coverage.** — **Answer (proposed, awaiting approval):** no parser of §7.5; each `abilities.spec.ts` names its rows by their §7.5 title and the review checks them. Reversible: a check can be added when the matrix grows.
9. **One specification or several.** — **Answer (proposed, awaiting approval):** one specification and one implementation PR, as the plan defines one task: the platform part has no consumer without the rules, and the rules need the platform part to be tested end to end. The `User` rules are ability-level only and do not wait for S1-03. Alternative: two PRs – steps 1–6 first, step 7 after S1-03 is merged.
10. **Archived restriction of project-owned subjects.** The archived state lives on `Project`; later subjects (tickets, comments) need it too. — **Answer (proposed, awaiting approval):** a relation condition `{ project: { state: 'archived' } }` in the restriction of each project-owned subject, with the relation selected by its record descriptor. Alternative: the principal carries the IDs of archived projects – one more query per request and a second source of the state.

## Phasing and implementation plan

One phase, one PR (Q9), after S1-01 and S1-02 are merged (Q1). Each step leaves the application working.

1. `@casl/prisma` and the client extension on `PrismaService`; the factory on `createPrismaAbility`. Test: the existing ability and request-pipeline tests, including the abilities tests taken over from S1-01 and S1-02, pass unchanged.
2. Principal loader with `projectRoles` and `organizationProjectIds`, used by the authentication guard; the principal factory for tests. Test: integration test of the loader (no memberships, an end user of an active and of an archived organization, a team member of several projects). The loader reads only identifiers; a large organization adds one ID per project, not per member.
3. Effective-role function and the hierarchy. Test: table test of the role per account kind, flag and membership; the hierarchy test.
4. `AuthorizationModule.forRoot({ rules, restrictions })`, the restrictions of projects and organizations moved into the restriction list. Test: the archived cases of every action; every action of the closed lists is restricted or an explicit exception.
5. Record descriptors and `PrismaRecordAccess` replacing the per-subject record access. Test: `request-pipeline.spec.ts` cases for `404`, the state code and `403`; the Done-when `404` for project B.
6. `allowedActionsOf()` used by the responses of projects, organizations and `/users/me`. Test: the `allowedActions` table per principal and project state.
7. Rules of the end users' project access and the `User` rules (Q5), with their matrix tests; the filter equals check.
8. Specification changes of the table above, §18.9, this file moved to `implemented/`. Test: `pnpm lint:spec`.

## Acceptance criteria

- [ ] Every §7.5 row about projects, organizations and accounts has an allowed and a denied case in an `abilities.spec.ts`
- [ ] A Developer of project A gets `404` for project B, with the same response as for a non-existent ID
- [ ] For every principal fixture and project state, the project response lists exactly the permitted actions
- [ ] Lists and details use the same rule: the filter equals check passes for every principal fixture
- [ ] An Administrator cannot deactivate, change the kind of or revoke the Administrator role of their own account (if Q5 is adopted)
- [ ] Every endpoint existing at merge time has an integration test of its denied case
- [ ] Works on phone, tablet and desktop (Rule 9) – n/a, no UI change
- [ ] User documentation and product tour updated where relevant (Rules 3, 4) – n/a, nothing visible changes

## Changelog

- 2026-10-26 – Created.
