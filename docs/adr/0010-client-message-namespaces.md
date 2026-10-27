# 0010 – Texts in the browser by route

- Status: proposed
- Date: 2026-10-27
- Deciders: the maintainer (`@dtk7c2`)
- Specification: [§2.9](../spec/02-agent-rules.md), [§13.1](../spec/13-non-functional.md), [§18.5](../spec/18-code-patterns.md)
- Issue: [#139](https://github.com/trybun/trybun/issues/139)

## Context and problem statement

The root layout rendered `NextIntlClientProvider` without props, so it passed every namespace of the request configuration – the whole catalogue except `emails` and `keycloak` – to the browser. Every page embedded the texts of every feature in its HTML and RSC payload, also `/sign-in`, which uses one namespace. The English catalogue held 9.9 KB of JSON, the `projects` namespace of S1-01 alone about 2.6 KB, and every Stage 1 feature adds its namespace to every page. Since S1-01 the mobile Lighthouse budget of `/` and `/sign-in` ([§2.9](../spec/02-agent-rules.md)) failed on CI now and then by a few milliseconds.

Which texts does a page pass to its client components?

## Decision drivers

- The Lighthouse budget of the key pages ([§2.9](../spec/02-agent-rules.md)); a page should not grow with features it does not show.
- Rule 1: next-intl's guidance on providing messages to Client Components.
- Rule 12: one pattern, checked by a test rather than by memory.

## Considered options

1. **Namespaces by route**: the root layout provides the shared namespaces, the layout of a route group or feature adds its own with a nested `NextIntlClientProvider`.
2. **Messages per client component**: each client component gets its texts as props from a Server Component parent.
3. **Keep the whole catalogue** and accept the growing pages.

## Decision outcome

**Option 1.** `CLIENT_NAMESPACES` of `apps/web/src/lib/i18n/messages.ts` lists the namespaces of each providing layout, every set containing those of its parents (a nested provider replaces the messages of its parent, it does not merge them); the layouts pass `pickClientMessages(await getMessages(), '<route>')`. `messages.spec.ts` maps every feature to the routes that render it and fails when a feature uses a namespace (`useTranslations('<namespace>')`, `useErrorMessage()` for `errors`) its routes do not provide, and when a component of `@trybun/ui` uses one the root does not provide.

### Consequences

- Good: `/sign-in` embeds `ui` and `signIn`; the empty shell `/` adds only the namespaces of the shell; a feature's texts travel only with its views.
- Good: a client component keeps `useTranslations`; the pattern of the components does not change.
- Bad: a new feature or route adds its set and its line in the test's map; a component used on a route outside its feature's map is not detected by the static check (its texts would be missing at run time, which the E2E tests show).
- Bad: a component that moves between Server and Client Components can change which namespaces a route needs; the check treats every `useTranslations` of a feature as a client use.

## Pros and cons of the other options

- **Messages per client component**: the smallest payload, but every component gets a second way to read texts and loses typed `useTranslations` keys – two patterns for one problem.
- **Keep the whole catalogue**: no work, but every feature adds to every page and the budget of [§2.9](../spec/02-agent-rules.md) is missed more often.
