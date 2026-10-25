# Install script, first-run wizard and the Administrator panel

| | |
|---|---|
| Status | `draft` |
| Created | 2026-10-25 |
| Plan task | `S0-12` |
| System specification sections | §2.11, §7.4, §13.5, §14.4, §15.2, §15.4, §15.5, §15.6, §18.3, §18.5, §18.9, glossary |
| Related issues / PRs | [#37](https://github.com/trybun/trybun/issues/37) |

## Context

[§15.5](../../docs/spec/15-deployment.md) and [§15.6](../../docs/spec/15-deployment.md) describe how an Administrator installs Trybun: an install script checks the server, generates every secret and `.env`, starts the system and prints a link with a one-time setup token; a first-run wizard in the browser creates the first Administrator (the break-glass account of [§7.4](../../docs/spec/07-users-organizations-permissions.md)); afterwards the Administrator panel shows a getting-started checklist. The "About" page of the Administrator panel shows the installed version ([§2.11](../../docs/spec/02-agent-rules.md), [§15.4](../../docs/spec/15-deployment.md)).

What exists today:

- The deployment package of S0-11 contains `compose.yaml`, `.env.example`, the Caddy and Keycloak configuration and `INSTALL.md`, which tells the Administrator to copy `.env.example` and replace every password by hand. There is no install script.
- Nobody can become an Administrator on a new installation: the system has no way to create the first account. Accounts exist only in the demo dataset of the local environment.
- The server has no Keycloak Admin API adapter, although the `trybun-server` client and its service account (`manage-users`) exist since S0-05.
- There is no Administrator panel, no CASL ability yet (S1-04), no outgoing e-mail (S1-15), no audit log and no rate limiting (S0-14).
- `/health` of the API reports the version (S0-11); the web application shows it nowhere.

S0-12 delivers the install script, the setup token, the wizard, the Administrator panel with the getting-started checklist, and the "About" page. Parts of [§15.6](../../docs/spec/15-deployment.md) depend on tasks that come later. This specification proposes the behaviour, the scope that waits for those tasks, and the decisions the specification leaves open.

## Goals

- An Administrator installs Trybun on a fresh server with one command and a few answers, without inventing any secret or editing `.env`.
- The script refuses a server that cannot run Trybun (less than 8 GB RAM, ports 80 or 443 taken, Docker or Compose too old), before it changes anything.
- Re-running the script is always safe: it never changes an existing `.env`.
- Only the person holding the setup link can create the first Administrator. The token is valid for 24 hours and works once.
- The first Administrator signs in with a password and 2FA that Keycloak enforces. Trybun stores no password and implements no 2FA of its own.
- After the first sign-in, the Administrator sees what remains to set up. The items tick themselves once the matching setting exists.
- The "About" page shows the version that `/health` reports and the license.

## Non-goals

- **Update, restore and backup** commands, the `backup` service and the "Configure backup storage" item of the checklist: S0-13 adds them to the same `trybun` script and checklist (below).
- **Sending a test e-mail** from the wizard: the system sends no e-mail before S1-15. The checklist item "Configure e-mail" ticks itself from the configuration, and S1-15 adds a "Send a test e-mail" action to it (open question 6).
- **Rate limiting** of the setup endpoints and the **audit log entry** for the use of the setup token: S0-14 adds rate limiting for all unauthenticated endpoints by client IP ([§14.4](../../docs/spec/14-architecture.md)) and the audit log with its first entries, including this one (open question 7).
- The checklist items for features that do not exist in Stage 0 – create a project, invite the team, create an organization, connect the GitHub App. Each comes with the task that builds its feature (implementation plan, "How to use this plan").
- Linking a GitHub account to the break-glass Administrator: it comes with the GitHub sign-in of team members.
- Changing the system default language or time zone from the browser: they stay in `.env` (Twelve-Factor, [§15.3](../../docs/spec/15-deployment.md)). The wizard shows them and explains how to change them (open question 4).
- The "Support the project" link of the "About" page: the final stage ([§16.6](../../docs/spec/16-open-source.md)).
- A product tour of the Administrator panel. [§2.4](../../docs/spec/02-agent-rules.md) lists no tour for it.

## Proposed change

### The `trybun` command of the deployment package

The deployment package gets one POSIX shell script, `trybun`, at its root (`deploy/trybun` in the repository, copied by `scripts/build-deployment-package.js`). It needs only what a server with Docker already has (`sh`, `awk`, `od`, `docker`) and no Node.js. Its subcommands:

- `./trybun install` – the install script ([§15.5](../../docs/spec/15-deployment.md)).
- `./trybun setup-token` – a new setup link ([§15.6](../../docs/spec/15-deployment.md)).
- S0-13 adds `update`, `restore` and `backup` to the same script, so administrators learn one command (open question 1).

`./trybun` without arguments, or with `--help`, lists the subcommands. Messages are in English, like the rest of the deployment package (`INSTALL.md`). Every failed check prints what is wrong and how to fix it, and exits with a non-zero code before anything is changed.

### `./trybun install`

1. **Prerequisite checks.** The script stops before it writes anything if a check fails:
   - Docker Engine and the Docker Compose plugin are installed, and their versions are at least the oldest ones that support every feature `compose.yaml` uses (open question 2).
   - **RAM**: the total memory of the server (`MemTotal` of `/proc/meminfo`) is at least 8 GB (8 × 10⁹ bytes). A server sold as "8 GB" passes, because its kernel reports a little less than 8 GiB but more than 8 × 10⁹ bytes. Below 16 GB the script warns and continues ([§15.2](../../docs/spec/15-deployment.md)).
   - **Ports 80 and 443** (TCP, and 443 UDP for HTTP/3) are free. Ports held by this installation's own `caddy` container count as free, so a re-run on a running system passes.
2. **Questions.** Each has a default, shown in brackets:
   - the domain (no default);
   - the default language (`en` or `pl`, default `en`);
   - the default time zone (default: the server's time zone, else `UTC`).

   Each answer is validated like the server validates it at start-up (domain name, `en`/`pl`, IANA time zone). The Administrator's e-mail address is asked in the wizard, where it is needed, instead of here (open question 3).
3. **Domain check.** The script resolves the domain and compares its addresses with the addresses of the server. When they differ, it warns and asks for confirmation instead of refusing: servers behind NAT or with a floating IP do not see their public address. Caddy cannot obtain a certificate until the domain points to the server.
4. **Secrets.** All passwords and secrets of `.env.example` are generated as 32 random bytes from `/dev/urandom`, written in hex: the PostgreSQL, Keycloak database, Keycloak administrator, Valkey and SeaweedFS credentials, `AUTH_SECRET`, the secrets of the Keycloak clients `trybun-web` and `trybun-server`, and the new **backup passphrase** `TRYBUN_BACKUP_PASSPHRASE`. S0-13 reads this variable.
5. **Backup passphrase.** The script prints the passphrase once and requires the Administrator to type `stored` to confirm that it is kept outside the server. Without the passphrase, off-site backups cannot be restored after the server is lost ([§15.10](../../docs/spec/15-deployment.md)).
6. **`.env`.** The script writes `.env` from `.env.example`, keeping its comments, with the answers and the generated values. Only the owner can read the file (`umask 077`, mode `600`). It writes a temporary file first and moves it into place only if no `.env` exists, so `.env` is never half-written or overwritten.
7. **Start.** `docker compose up -d --wait`.
8. **Setup link.** The same as `./trybun setup-token` (below).

**Re-running.** When `.env` exists, the script says so, skips steps 2 and 4–6, and never changes the file. It still runs the checks, starts the system and prints a new setup link if no Administrator exists yet. So re-running the script is the way to resume an interrupted installation.

### Setup token

- `./trybun setup-token` runs the `setup-token` command of the `server` image in the running `api` container (`docker compose exec api …`). The command uses the system database, like the API.
- If an Administrator already exists, it prints that the system is already set up and exits with an error code. No token is created.
- Otherwise it generates a token of 32 random bytes (base64url) and stores only its SHA-256 hash with an expiry of 24 hours in the new table `setup_tokens`. The table replaces any earlier token, so only the latest link works. The command prints the link and its expiry time.
- The link is `https://<domain>/setup#token=<token>`. The token is in the URL fragment, which the browser never sends to a server, so it cannot appear in an access log or a `Referer` header. The wizard page reads the fragment and sends the token in the request body.
- **Single use.** Creating the Administrator marks the token as used in the same transaction that creates the account, with a conditional update (`used_at IS NULL AND expires_at > now`). Of two simultaneous submissions, only one succeeds.
- An unknown, expired or used token gets the same error `setup.token_invalid` ([§15.6](../../docs/spec/15-deployment.md)). Once an Administrator exists, every setup endpoint answers `setup.completed`, so the wizard is disabled permanently.

### The first-run wizard (`/setup`)

The wizard is a page of the web application outside the team views. It needs no session and is shown in the system default language, with the language switch of the sign-in page. It has a single step (Rule 2):

- **On opening**, the page checks the token from the link through the API:
  - Token invalid (unknown, expired or used): "This setup link is invalid or has expired. Run `./trybun setup-token` on the server for a new link."
  - System already set up: "Trybun is already set up" with a **Sign in** button.
  - Token valid: the form below.
- **The form** creates the first Administrator:
  - Display name, e-mail address and password.
  - The password field has a show/hide toggle instead of a second field for repeating the password.
  - The Administrator's own language and time zone, prefilled with the system defaults from `.env`.
  - Below the fields, a note shows the system default language and time zone and explains that they are changed in `.env`, followed by `docker compose up -d --wait`.
  - Field errors (an e-mail address that is not valid, a password that Keycloak's password policy rejects) appear next to the fields. The policy itself stays in Keycloak.
- **What the API does** (`POST /api/v1/setup/administrator`, public):
  1. It creates the Keycloak user through the Admin API: a verified e-mail address, the password as a non-temporary credential, member of the group `team`, and the required action "configure OTP".
  2. It creates the account (`user`: `kind` `team`, `is_admin` true, `state` `active`, linked by the Keycloak user ID), with the token claim in the same transaction.
  3. If the transaction fails, for example because the token was used meanwhile, the API deletes the Keycloak user it created, so a retry with a new token starts clean.

  The password goes straight from the request to Keycloak. It is never stored, logged or returned (open question 5).
- **After success**, the page says the account is ready and shows **Sign in**. The sign-in returns to the getting-started checklist (`/admin`). Keycloak asks for the password and requires the Administrator to set up the one-time password (TOTP) before the sign-in completes ([§15.5](../../docs/spec/15-deployment.md) "Team 2FA").
- **The sign-in page** shows a short note while the system has no Administrator: "Trybun is not set up yet. Open the setup link printed by `./trybun install`, or run `./trybun setup-token` on the server." Without the note, a person who opens a new installation sees only a Keycloak login that no account can pass.
- **Phones, tablets and desktop:** one column from 360 px, touch targets ≥ 44 px, form fields with 16 px text below the desktop breakpoint (Rule 9). The form uses the `Form`, `Input`, `Select` and `Button` components of `@trybun/ui`. A password input with a show/hide toggle is added to `@trybun/ui` with its stories, if no existing component covers it (Rule 6).

### Administrator panel (`/admin`)

The Administrator panel starts here with two pages. Later tasks add their pages (users, projects, settings) to it.

- **Navigation.** Administrators get an **Administration** item in the side navigation of the application shell (tablet, desktop) and in the account menu (phones, where the bottom navigation keeps its slots for daily work). Other people do not see it, and the routes of the panel answer them with "not found".
- **Getting started** (`/admin`, the landing page of the panel): one card per checklist item with its title, a sentence on why it matters, its state (**Done** with a check mark, or **To do**) and a link to the help page that explains it. Settings that live in `.env` are explained there, because the browser cannot change them. The page shows "*n* of *m* done". When every item is done, it says so and keeps the list.
- **Stage 0 items**, each ticked automatically from the configuration of the API:
  - **Configure GitHub sign-in** – done when `TRYBUN_GITHUB_CLIENT_ID` and `TRYBUN_GITHUB_CLIENT_SECRET` are set. Required before team members can be invited ([§15.5](../../docs/spec/15-deployment.md)).
  - **Configure e-mail** – done when `TRYBUN_SMTP_HOST` is set (with `TRYBUN_MAIL_FROM`, which start-up already requires together with it).

  S0-13 adds "Configure backup storage". Each later task adds its own item: create a project (S1-01), invite the team (S1-03), create an organization (S1-02, marked optional), connect the GitHub App (optional) – in the order of [§15.6](../../docs/spec/15-deployment.md).
- **About** (`/admin/about`): the installed version, the same value that `/health` reports, and the license (MIT, with a link to its text in the repository of the release). The "Support the project" link joins it in the final stage.
- **What the system does.**
  - A new server module `administration` serves `GET /api/v1/administration/getting-started` and `GET /api/v1/administration/about`. The checklist returns `{ items: [{ id, isDone, isOptional }] }`, a list bounded by a closed set ([§18.4](../../docs/spec/18-code-patterns.md)). The about endpoint returns `{ version, license }`.
  - The item identifiers are a closed enum in `@trybun/contracts/administration` (`gettingStartedItemIdSchema`). The state of an item is a pure function of the configuration and, in later tasks, of the database. Nothing about the checklist is stored, so an item is never ticked while its setting is missing.
  - The API reads the GitHub and SMTP variables in `platform/config`. Compose passes them to the `api` service.

### Permissions

The Administrator panel needs its first permission check before S1-04 builds the permission layer. "Never put permission logic outside CASL" ([§14.4](../../docs/spec/14-architecture.md), `AGENTS.md`) applies from the first check (open question 8):

- S0-12 adds CASL (`@casl/ability`) and the ability factory of `platform/authorization` ([§18.3](../../docs/spec/18-code-patterns.md) "Authorization") with one rule in `modules/administration/administration.abilities.ts`: an Administrator may `read` the subject `Administration`. Both endpoints check the ability, and a principal without it gets `404`.
- `GET /api/v1/users/me` gets `allowedActions` for the global actions of the account ([§18.3](../../docs/spec/18-code-patterns.md): "global actions … with the current account"), here `open_administration`. The navigation item and the routes of the panel follow it.
- S1-04 adds `@casl/prisma`, `accessibleBy` and the rules for projects, organizations and accounts to the same factory, and stays the reference implementation for abilities on records.

### Server structure

- **`modules/setup/`**: the endpoints `GET /api/v1/setup` (`{ status: 'available' | 'completed', defaultLanguage, defaultTimeZone }`), `POST /api/v1/setup/token-verification` and `POST /api/v1/setup/administrator`, all `@Public()`; the service; and the setup-token command.
- **The command** is a third entry point of the `server` image (`cli.ts`, a NestJS application context with only the modules it needs), next to the API and the Worker, built by the same bundle configuration ([§14.6](../../docs/spec/14-architecture.md)).
- **Keycloak Admin API**: an adapter in `platform/keycloak-admin` ([§18.3](../../docs/spec/18-code-patterns.md) "External services") that authenticates as the `trybun-server` service account with its client secret. The API configuration therefore reads `TRYBUN_KEYCLOAK_SERVER_CLIENT_SECRET`. It covers what S0-12 needs (create a user with a credential, group and required action; delete a user), translates Keycloak errors into `AppError` codes (`setup.password_rejected`, `setup.email_taken`), and is tested with MSW against recorded Admin API responses, plus one integration test against the Keycloak container of the test set-up.
- **Error codes** in `@trybun/contracts/setup`: `setup.token_invalid` (`404`), `setup.completed` (`409`), `setup.password_rejected` (`422`, on the password field), `setup.email_taken` (`422`, on the e-mail field). They are translated in EN and PL.

### Web structure

- `app/setup/page.tsx` and `features/setup/` (wizard form, queries, mutation).
- `app/(team)/admin/page.tsx`, `app/(team)/admin/about/page.tsx` and `features/administration/` (checklist, about).
- The wizard form follows [§18.5](../../docs/spec/18-code-patterns.md) "Forms": React Hook Form with the contract schema, submitted through its mutation hook over the BFF. The BFF forwards unauthenticated requests without a token and keeps its `Origin` check.

### Tests that prove the acceptance criteria

- The install script is tested from Vitest (`deploy/trybun.spec.js`, like the tests of `scripts/`): it runs the script with stubbed `docker`, `ss` and `getent` commands on `PATH` and a fake `/proc/meminfo` path, and checks that:
  - 7.9 × 10⁹ bytes of RAM and a taken port 443 are refused;
  - the free ports of the installation's own Caddy pass;
  - a second run leaves an existing `.env` byte for byte unchanged;
  - `.env` has mode `600` and no development value of `.env.example`.

  `shellcheck` runs on the script in `pnpm lint`.
- The setup endpoints are covered by integration tests (Testcontainers, Keycloak through MSW):
  - an unknown, an expired and a used token are rejected with the same error;
  - two simultaneous submissions create one Administrator;
  - everything answers `setup.completed` after success;
  - a failed transaction deletes the Keycloak user.
- The checklist and the ability have unit tests: "Configure e-mail" is done exactly when SMTP is configured; an Administrator may open the panel, a team member without the role gets `404`.
- E2E: the wizard and the Administrator panel at phone, tablet and desktop sizes with axe; the "About" page shows the version of `/health`.
- The demo dataset gets no change: its Administrator exists, so `/setup` shows "already set up" locally. The wizard E2E test uses a fresh database of its own, or the integration tests cover the flow if a fresh Keycloak in E2E proves too slow; this is decided while implementing and recorded in the changelog.

### User documentation and installation guide

- `deploy/INSTALL.md` (deployment package) and the README:
  - installation with `./trybun install`;
  - the setup link;
  - `./trybun setup-token`;
  - re-running is safe;
  - store the backup passphrase.
- `docs/user/<lang>/administrator/` (EN, PL):
  - a tutorial "Set up Trybun after installation" (wizard, first sign-in with 2FA, checklist);
  - how-tos "Configure e-mail" and "Configure GitHub sign-in" (the variables in `.env` and applying them), linked from the checklist items;
  - "Change the default language and time zone".
  - The pages name the routes `/admin` and `/admin/about` in `views`, so **Help for this view** opens them.

## Changes to the system specification

| Section | Change |
|---|---|
| §15.4 | The deployment package contains the `trybun` script with its subcommands instead of separate install, update, restore and backup scripts |
| §15.5 | The install script runs as `./trybun install`; exact checks (RAM ≥ 8 × 10⁹ bytes, warning below 16 GB; ports 80/443 free unless held by the installation's Caddy; minimum Docker and Compose versions; domain mismatch is a warning with confirmation); the questions are domain, default language and time zone (no Administrator e-mail); confirmation of the backup passphrase by typing `stored`; re-running resumes an interrupted installation and prints a new setup link while no Administrator exists |
| §15.6 | The new token comes from `./trybun setup-token` and replaces earlier ones; the link carries the token in the URL fragment; the wizard is one step: the Administrator's name, e-mail, password, language and time zone, with the system defaults shown read-only; the API sets the password as a Keycloak credential and requires OTP setup; sending a test e-mail moves to the "Configure e-mail" item of the checklist (with S1-15); the checklist lives on the Administrator panel's landing page `/admin`, and the first sign-in returns there; the sign-in page points to the setup link while no Administrator exists |
| §7.4 | The break-glass Administrator chooses their password in the wizard; it is passed to Keycloak and never stored by the system |
| §13.5 | The audit log entry for the use of the setup token comes with the audit log (S0-14) |
| §14.4 | Rate limiting of the setup endpoints comes with S0-14; the first CASL rule (Administrator panel) arrives with S0-12, the rest of the permission layer with S1-04 |
| §14.6 | The `server` image has a third entry point, the command line (`cli.ts`) |
| §18.3 | `platform/keycloak-admin` as the adapter of the Keycloak Admin API; global actions in `allowedActions` of `GET /users/me` |
| §18.9 | Reference implementations of S0-12: the Keycloak Admin API adapter, the CLI entry point, the ability factory with its first rule (until S1-04 extends it) |
| Implementation plan | S0-13 adds its commands to `trybun` and the "Configure backup storage" item; S0-14 rate-limits the setup endpoints and audits the setup token; S1-15 adds "Send a test e-mail" to the "Configure e-mail" item; each task adding a checklist item names it |
| Glossary | New terms below |

New or changed glossary terms (code identifier, EN/PL labels):

- `setup_token` – Setup token / Token konfiguracji (code identifier added to the existing term).
- `getting_started_item` – Getting-started item / Krok konfiguracji początkowej; identifiers `configure_github_sign_in` (Configure GitHub sign-in / Skonfiguruj logowanie przez GitHub) and `configure_email` (Configure e-mail / Skonfiguruj e-mail).
- Administrator panel – Administration / Administracja (navigation label).

## Open questions

Implementation must not start until every question has an answer.

1. One `trybun` script with subcommands (`install`, `setup-token`, and from S0-13 `update`, `restore`, `backup`) instead of separate scripts? — **Proposed answer:** yes. `trybun setup-token` is already the name in the plan, and one entry point with `--help` is easier to learn and document. S0-13 adds its subcommands to it. Approved by merging this specification.
2. Minimum versions of Docker Engine and the Compose plugin? — **Proposed answer:** the oldest versions that support every feature `compose.yaml` uses. Today the limit is the health check option `start_interval`: Docker Engine 25.0 and Docker Compose 2.20.2. The versions are constants at the top of the script, raised when `compose.yaml` needs a newer feature. Approved by merging this specification.
3. §15.5 has the script ask for the Administrator's e-mail address. Drop that question and ask for the address only in the wizard? — **Proposed answer:** yes. The script has no use for it (Caddy needs no e-mail address for its certificates), and asking twice is one more step (Rule 2). Approved by merging this specification.
4. §15.6 says the wizard "confirms the default language and time zone". Show them read-only, with how to change them in `.env`, instead of making them editable in the browser? — **Proposed answer:** yes. They are environment configuration ([§15.3](../../docs/spec/15-deployment.md)). Keycloak's default login language is applied from the same variable, so a value stored in the database would diverge from it. The Administrator's own language and time zone are editable in the form. Approved by merging this specification.
5. The wizard asks for the Administrator's password and the API sets it in Keycloak through the Admin API. Is that acceptable under "the system implements no password handling" ([§7.4](../../docs/spec/07-users-organizations-permissions.md))? — **Proposed answer:** yes. Keycloak hashes the password and enforces its policy, and the system only passes it through once. The alternatives are worse:
   - Keycloak's "execute actions" e-mail needs SMTP, which is optional at installation.
   - A temporary password generated and shown by the wizard has to be typed and then changed at the first sign-in: two more steps, and a secret on screen.

   Approved by merging this specification.
6. §15.6 lists "sending a test e-mail" in the wizard, but the system sends no e-mail before S1-15. Move it to the "Configure e-mail" checklist item, added by S1-15? — **Proposed answer:** yes. Without a sender, a test e-mail cannot be built in S0-12. On the checklist it is also available whenever SMTP changes, not only once. Approved by merging this specification.
7. §15.6 requires rate limiting of the setup endpoints, and §13.5 an audit log entry for the use of the setup token. Both mechanisms come with S0-14. Leave them to S0-14? — **Proposed answer:** yes. The token has 256 bits of entropy, so guessing it within its 24 hours is infeasible even without a limit. S0-14 adds both and its plan row names them. Approved by merging this specification.
8. The Administrator panel needs a permission check before S1-04. Introduce CASL now (ability factory, one rule, `allowedActions` on `GET /users/me`), or check `isAdmin` directly until S1-04? — **Proposed answer:** introduce CASL now. A direct check would be permission logic outside the abilities, which `AGENTS.md` forbids, and S1-04 would have to migrate it. S1-04 extends the factory with `@casl/prisma` and the record rules. Approved by merging this specification.
9. Single-step wizard with a show/hide toggle on the password instead of a repeated password field? — **Proposed answer:** yes. It is one step and one field fewer (Rule 2), and the toggle lets the Administrator check what they typed. A mistyped password can still be reset through the Keycloak admin console over an SSH tunnel ([§15.5](../../docs/spec/15-deployment.md)), which the "Set up Trybun" tutorial explains. Approved by merging this specification.

## Acceptance criteria

- [ ] The script refuses a server with less than 8 GB RAM or occupied port 443.
- [ ] A used or expired setup token is rejected.
- [ ] Re-running the script never changes an existing `.env`.
- [ ] The checklist ticks "Configure e-mail" automatically once SMTP is configured.
- [ ] The "About" page shows the version that `/health` reports.
- [ ] A new installation reaches a signed-in Administrator with 2FA set up, with no manual step besides `./trybun install`, the wizard form and the Keycloak 2FA set-up.
- [ ] A person who is not an Administrator gets "not found" for `/admin` and its endpoints.
- [ ] Works on phone, tablet and desktop (Rule 9).
- [ ] `INSTALL.md`, README and the administrator documentation (EN, PL) updated (Rules 3, 5).

## Changelog

- 2026-10-25 – Created.
