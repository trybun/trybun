# Execution plan — implement ticket visibility and sharing requests (S1-11)

Source doc: .ai/specs/2026-10-26-ticket-visibility.md
Spec PR: #121 (merged)

## 🎯 Goal

Implement the approved S1-11 specification: ticket visibility (`only_me`, `my_organization`, `all_customers`), sharing requests with one team approval or a refusal with a reason, the read rules R1–R4 evaluated against the current organization and project access, and the controls in the portal and the team ticket view.

## Scope

- Server: `tickets` module (migration, abilities, service, controller, domain functions), `activity-events`, `audit-log-entries`, `attachments` abilities, demo dataset.
- Contracts: tickets, projects, activity events, errors; i18n catalogues.
- Web: the portal form and ticket view (S1-09), the team field panel (S1-10, merged in #256).
- Docs: `docs/spec/` changes of the spec's change table, the S1-02, S1-09 and S1-10 sentences, the plan row, user documentation (EN, PL).

## Non-goals

Everything the spec lists under Non-goals: comment audience and publishing the refusal reason (S1-12), the "Pending sharing approvals" view (S1-13), notifications, watchers and a membership-change event (S1-15), redaction (S1-12, S1-16, S1-21), search (S2-02, S2-03), the reference page and the tour (S1-18), a visibility control in the team's full form (Q6).

## Risks

- The read rules decide data scoping for every end user. The lists-equal-details check, the property test over the demo dataset and denied cases for every rule guard it.
- Moving `requester` out of `commonTicketFields` changes the end-user response type (nullable); the leak-test schemas and the web follow.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data model

- [x] 1.1 Add the visibility migration, Prisma fields and contract enums — 7f8a99f

### Phase 2: Read rules

- [x] 2.1 Implement the read rules R1–R4 and keep changes to own tickets — 08dde2e
- [x] 2.2 Extend the demo dataset — 0c22bed
- [x] 2.3 Test the read rules, organization changes and lists against details — ccd2d85

### Phase 3: Visibility actions

- [x] 3.1 Add the visibility actions, state rules and error codes — d38bfca
- [x] 3.2 Add the visibility endpoint with activity events and audit entries — dd4ec74

### Phase 4: Sharing decisions and creation

- [x] 4.1 Add the sharing approval and refusal endpoints — dd4ec74
- [x] 4.2 Create tickets with a visibility through the project actions — 2ac1bee

### Phase 5: Identities

- [x] 5.1 Show other customers as Customer — b453d13

### Phase 6: Web

- [x] 6.1 Add the visibility control to the portal form — 2b8cda8
- [ ] 6.2 Show and change the visibility in the portal ticket view
- [ ] 6.3 Add the visibility field and the sharing decisions to the team field panel
- [ ] 6.4 Write the user documentation
- [ ] 6.5 Add the E2E test of sharing

### Phase 7: Specification

- [ ] 7.1 Apply the specification changes and move the spec to implemented
