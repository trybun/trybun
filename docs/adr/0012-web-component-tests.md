# 0012 – Component tests of the web application in jsdom

- Status: accepted
- Date: 2026-10-29
- Deciders: the maintainer (`@dtk7c2`)
- Specification: [§2.14](../spec/02-agent-rules.md), [§18.7](../spec/18-code-patterns.md)
- Pull request: [#160](https://github.com/trybun/trybun/pull/160) (S1-03)

## Context and problem statement

The unit tests of `apps/web` render the server HTML of components (`renderToStaticMarkup`, `prerender`) and call pure functions; what a person does with a client component – opening a dialog, submitting a form, confirming an action – is tested only by the Playwright E2E tests ([§18.7](../spec/18-code-patterns.md)), which do not count toward the coverage thresholds of [§2.14](../spec/02-agent-rules.md). Interactive features add click and submit handlers that no counted test reaches: `main` held the web threshold of 70 % lines only just, and S1-03 (#160, invitations and the Accounts page) fell to 63 %, with about 50 lines of handlers left after every render state and pure decision was covered.

How are the handlers of client components tested?

## Decision drivers

- Rule 1: the established way to test React components – rendering them in a DOM and acting as a user through roles and labels.
- The coverage thresholds of [§2.14](../spec/02-agent-rules.md) stay as they are, and count what the tests exercise.
- Fast feedback in `pnpm test`, without the stack of the E2E tests.
- Rule 12: one way, used by every feature.

## Considered options

1. **jsdom with Testing Library** (`@testing-library/react`, `@testing-library/user-event`) in the Vitest project of `apps/web`, opted into per file.
2. **Vitest browser mode** with Playwright's Chromium, as the story tests of `@trybun/ui` run.
3. **Only pure functions**: move every decision of a handler into a function with a unit test, and leave the wiring to E2E.
4. **Lower the web threshold** of [§2.14](../spec/02-agent-rules.md).

## Decision outcome

**Option 1.** A component test of the web application is a `*.spec.tsx` file next to the component that starts with `// @vitest-environment jsdom`, renders the component with `renderInApp()` of `apps/web/test/dom/render.tsx` (the messages and a query client) and acts through `@testing-library/user-event`, locating elements by role, label or text as the E2E tests do. The browser API client is replaced by `createFakeApiClient()` of `apps/web/test/dom/fake-api-client.ts`, which answers `METHOD /path` from a route table and records the calls – the API is the external boundary of the web application, as the server API client is replaced in the tests of layouts and pages. Server-HTML tests stay for Server Components and render states; E2E tests stay for whole flows, layouts on the three devices and accessibility (axe).

### Consequences

- Good: handlers, form validation and the error mapping of client components are tested in `pnpm test` and count toward the thresholds.
- Good: one Vitest run; files that do not opt in keep the Node environment.
- Bad: jsdom has no layout – sizes, touch targets, focus traps of Base UI that measure elements and the viewports remain E2E checks.
- Bad: four development dependencies of `apps/web` (`jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`).

## Pros and cons of the other options

- **Vitest browser mode**: a real browser, so layout is testable too, but every web test file would start Chromium, and server-only modules of the same project would need a second Vitest project; slower for the many small component tests.
- **Only pure functions**: no dependency, but the wiring of handlers to the decisions stays untested, and it did not reach the threshold for S1-03.
- **Lower the threshold**: no work, but it hides untested code instead of testing it.
