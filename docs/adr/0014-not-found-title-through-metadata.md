# 0014 – The tab title of the not-found page through the metadata of the page

- Status: accepted
- Date: 2026-11-20
- Deciders: the maintainer (`@dtk7c2`), accepted on 2026-11-20 in the review of [#406](https://github.com/trybun/trybun/pull/406)
- Specification: [§13.1](../spec/13-non-functional.md#131-internationalization), [§18.5](../spec/18-code-patterns.md)
- Pull request: [#406](https://github.com/trybun/trybun/pull/406) (#404); replaces the `<title>` element of #401 ([#403](https://github.com/trybun/trybun/pull/403))

## Context and problem statement

`notFound()` of a page shows the translated not-found page of its route group (#401), whose tab title `NotFoundNotice` set as a `<title>` element, as the 404 page of Next.js does. Next.js 16.4 reads the metadata of a `not-found.tsx` only when the metadata resolution itself hits a not-found (`next/dist/esm/lib/metadata/metadata.js`, `getSelectedMetadata` → `getNotFoundMetadata`); a page that calls `notFound()` only while rendering keeps the metadata of its layouts. On a page load the element wins, but after a client-side navigation or a language switch (`router.refresh()`) the metadata title of the layouts mounts after it and the tab shows "Trybun" (QA of #403). Two Client Components (`OrganizationDetail`, `ProjectSettings`) also call `notFound()` in the browser, where no metadata is resolved at all.

How does a not-found page get its translated tab title on every way it is reached?

## Decision drivers

- §13.1: every text the person sees is translated, the tab title too.
- Rule 1: the documented mechanism of Next.js – `notFound()` inside `generateMetadata` and React `cache()` to share a read between `generateMetadata` and the page (`dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`).
- One API read per request ([§18.5](../spec/18-code-patterns.md), the per-request query client).
- A `429` stays `RateLimitedNotice`, never the not-found page (#356).
- Rule 12: one way to set the title of a not-found page.

## Considered options

1. **The metadata of the page**: every page that can show the not-found page exports a `generateMetadata` that performs the page's read, memoized with `cache()`; every `not-found.tsx` exports the translated title; no `<title>` element. A `404` of a query in the browser refreshes the route, and the server answers it.
2. **Keep the element and add the metadata**: as option 1, but `NotFoundNotice` keeps the `<title>` element for the two Client Components.
3. **A client component that sets `document.title`** on the not-found page.

## Decision outcome

**Option 1.** `metadataAfterRead()` of `lib/api-client/server-api-client.ts` awaits the read of the page, keeps the metadata of the layouts for a `429` and throws the not-found and every other error on. The read is a function of the page wrapped in `cache()` with the parameters as arguments, or a shared one (`getAdministrator()`, `loadPortalProject()`). `useNotFoundOnServer()` of `features/app-shell` replaces `notFound()` in Client Components: it refreshes the route, so the Server Component calls `notFound()` in its metadata and page.

### Consequences

- Good: the title is translated on a page load, a client-side navigation and a language switch alike, with one `<title>` in the document.
- Good: the read is not repeated – the API log shows one read per request.
- Bad: every page that can be not found needs its `generateMetadata`; `app/not-found-metadata.spec.ts` fails for a page that calls a not-found read without one.
- Bad: when a record disappears in the browser, the content area is empty for the round trip of the refresh before the not-found page shows.

## Pros and cons of the other options

- **Option 2**: two `<title>` elements whenever the metadata also carries the title, which HTML allows only once in a document; the client case would keep two ways to set the title.
- **Option 3**: a title set after hydration, which a refresh of the metadata overwrites again, and a Client Component in every `not-found.tsx`, which Next.js sends with every page of its segment.
