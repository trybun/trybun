# Error codes of validation responses

| | |
|---|---|
| Status | `implemented` |
| Created | 2026-10-21 |
| Plan task | `S0-01` (validation pipe), `S0-17` (Problem Details and error codes) |
| System specification sections | §17.1, §17.2 |
| Related issues / PRs | – |

## Context

[§17.2](../../docs/spec/17-conventions.md) ("Errors") requires Problem Details with a stable error `code` for every error and, for validation errors, an `errors` member listing the invalid fields as `[{ "pointer": "/title", "code": "string.too_long" }]`. The web application translates codes with `errors.<code>` ([§17.1](../../docs/spec/17-conventions.md)).

Two things are not specified:

1. **The error code of a validation response** (the `code` member of the `422` response).
2. **The field error codes** (the `code` of each entry of `errors`). The specification gives one example, `string.too_long`, but no list. Without a closed list, each schema could produce its own codes and the web application could not translate them.

Task S0-01 needs both: the global validation pipe returns `422` with `errors[]` ([§18.3](../../docs/spec/18-code-patterns.md)). It uses the codes proposed below, defined in `@trybun/contracts` (`errors/`, `problem-details/`); this specification asks for their approval. The error-code registry as a whole is built in S0-17.

## Goals

- One code for every validation response, following the pattern of the existing code `request.precondition_required`.
- A closed, translatable list of field error codes, derived from the schema rule that failed.

## Non-goals

- Error codes of other errors (S0-17 and the feature tasks).
- Business-rule errors of fields (e.g. a visibility not allowed): they use their own error codes ([§17.2](../../docs/spec/17-conventions.md)).
- Translations of the codes (S0-06).

## Proposed change

- A validation response is `422` with the code `request.validation_failed`.
- Field error codes are `<kind>.<reason>` from this closed list, chosen by the failing schema rule:

| Code | Schema rule |
|---|---|
| `string.too_long` / `string.too_short` | maximum / minimum length of a string |
| `string.invalid_format` | format of a string (e-mail, URL, UUID, pattern, …) |
| `array.too_long` / `array.too_short` | maximum / minimum number of items |
| `number.too_large` / `number.too_small` | maximum / minimum of a number |
| `date.too_late` / `date.too_early` | latest / earliest date |
| `field.invalid_type` | a value of the wrong type, including a missing required field |
| `field.invalid_value` | a value outside the allowed values (e.g. an enum) |
| `field.unrecognized` | a field the schema does not know |
| `field.invalid` | any other rule (e.g. a custom refinement) |

- A new code is added by changing this list in §17.2 and in `@trybun/contracts`.

## Changes to the system specification

| Section | Change |
|---|---|
| §17.2 "Errors" | The validation bullet names the code `request.validation_failed` and the closed list of field error codes above |

New or changed glossary terms: none.

## Open questions

Implementation must not start until every question has an answer.

1. Is `request.validation_failed` the code of a validation response? — **Proposed answer:** yes. Approved by merging this specification.
2. Is the list of field error codes complete, or should a missing required field have its own code (e.g. `field.required`)? — **Proposed answer:** the list above; `field.invalid_type` covers a missing field, because Zod does not report missing fields separately without extra configuration. Approved by merging this specification.

## Acceptance criteria

- [x] A request with an invalid body returns `422` with the code `request.validation_failed` and one entry per invalid field with a code from the list.
- [x] `@trybun/contracts` defines the codes as closed enums; §17.2 lists them.
- Works on phone, tablet and desktop (Rule 9): not applicable – no user interface.
- User documentation and product tour: not applicable – no user-facing change.

## Changelog

- 2026-10-21 – Created with task S0-01, which uses the proposed codes.
- 2026-10-24 – Implemented: §17.2 lists the code `request.validation_failed` and the field error codes; S0-17 adds their translations (`errors.<code>`).
