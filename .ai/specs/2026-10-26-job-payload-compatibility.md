# Job and event payload compatibility across updates

| | |
|---|---|
| Status | `draft` |
| Created | 2026-10-26 |
| Plan task | – (found while writing `BACKWARD_COMPATIBILITY.md` of the agent pipeline) |
| System specification sections | §17.2, §18.3, §15.7, §2.11 |
| Related issues / PRs | [#107](https://github.com/trybun/trybun/pull/107) |

## Context

`./trybun update` ([§15.7](../../docs/spec/15-deployment.md)) replaces the images and runs the migrations, but the queues in Valkey and the unpublished rows of `outbox_events` survive it. After an update the new Worker therefore processes jobs written by the previous version:

- delayed jobs – SLA timers, automatic closing, notification batches ([§17.2](../../docs/spec/17-conventions.md)) – that can wait for days or weeks;
- failed jobs, kept for 30 days and retried manually with `job.retry()` ([§17.2](../../docs/spec/17-conventions.md));
- outbox events not yet published, and jobs enqueued but not yet run.

The specification does not say whether such jobs must still work. Processors validate their job data with their schema ([§18.3](../../docs/spec/18-code-patterns.md)), so a changed job schema makes a leftover job fail – an SLA timer that was due silently does nothing. Any version of a MAJOR series updates directly to its latest release ([§2.11](../../docs/spec/02-agent-rules.md)), so "the previous release" can be any release of the series. Agents do not decide this gap themselves (Rule 8); it is proposed here.

## Goals

- A job or outbox event written by any earlier release of the same MAJOR series is processed correctly after an update.
- Reviewers can check it from the diff, without knowing the queue state of installations.

## Non-goals

- Payloads of outgoing webhooks – already versioned in `@trybun/contracts` ([§12.4](../../docs/spec/12-api-webhooks-import.md)).
- Draining queues during `./trybun update` (the alternative below).
- Protecting queue or job data as a public contract: they stay internal (`BACKWARD_COMPATIBILITY.md`, added in #107).

## Proposed change

Job data and internal event payloads change **additively within a MAJOR series**:

1. A new field of job data or of an event payload is optional in the schema, and the handler has a defined behaviour when it is missing (a default, or reading the current state – handlers already load the current state, [§18.3](../../docs/spec/18-code-patterns.md)).
2. A field is never removed, renamed or given a new meaning within a series; it may be ignored by the handler.
3. A queue name, job name or event type is never removed within a series while jobs of it can still exist: its processor stays registered (delegating to the new handler) until the next MAJOR release. Job scheduler templates are excepted – `upsertJobScheduler` replaces them when the new Worker starts.
4. A change that cannot be additive is a breaking change of the next MAJOR release, marked as such ([§2.11](../../docs/spec/02-agent-rules.md)); its migration path is described in the change specification that introduces it (see open question 2).
5. Every changed job schema gets a unit test that parses job data of the previous shape.

**Alternative considered: draining the queues on update.** `./trybun update` would stop new work and wait until the queues are empty before migrating. Rejected for the proposal: delayed jobs (SLA timers, auto-close) cannot be drained without running them early or losing them, and failed jobs kept for retry would be lost.

## Changes to the system specification

| Section | Change |
|---|---|
| §17.2 Background jobs and scheduling | New rule "Payload compatibility": items 1–4 above |
| §18.3 Events and background jobs | Handlers accept job data of every earlier release of the MAJOR series; link to §17.2 |
| §18.7 Tests | A changed job schema has a test with job data of the previous shape (item 5) |

No new glossary terms.

## Open questions

Implementation must not start until every question has an answer.

1. Is the window "the whole MAJOR series" (proposed, required by direct updates within a series) or only the previous MINOR release? — **Answer:** …
2. At a MAJOR boundary, what happens to leftover jobs of the old shape: the last release of the previous series (which every update to a new MAJOR goes through) converts them, or the new MAJOR's migration step moves them, or they are documented as dropped? — **Answer:** …
3. Do the rules also bind the `0.x` releases, or only from `1.0.0`? Proposed: from now on, because installations already update between `0.x` releases. — **Answer:** …

## Acceptance criteria

- [ ] §17.2, §18.3 and §18.7 contain the rules above
- [ ] `BACKWARD_COMPATIBILITY.md` refers to the §17.2 rule instead of its TODO
- [ ] `CODE_REVIEW.md` lists the check for changed job schemas
- [ ] Works on phone, tablet and desktop (Rule 9) – n/a, no UI
- [ ] User documentation and product tour updated where relevant (Rules 3, 4) – n/a

## Changelog

- 2026-10-26 – Created.
