# 0015 – The tab title of every page through `title.absolute` of one helper

- Status: proposed
- Date: 2026-11-20
- Deciders: the maintainer (`@dtk7c2`), proposed in the change specification of [#407](https://github.com/trybun/trybun/issues/407)
- Specification: [§13.1](../spec/13-non-functional.md#131-internationalization), [§13.4](../spec/13-non-functional.md), [§18.5](../spec/18-code-patterns.md); change specification [`2026-11-20-page-tab-titles.md`](../../.ai/specs/2026-11-20-page-tab-titles.md)
- Extends: [ADR 0014](0014-not-found-title-through-metadata.md). The not-found title keeps coming from the metadata, and the read of a page keeps running in its `generateMetadata`.

## Context and problem statement

Every page has the tab title "Trybun". WCAG 2.2 SC 2.4.2 asks for titles that describe the topic or purpose of a page. The maintainer chose the scheme `{page} – {record or section} – Trybun` for #407. Record pages show user text in it: ticket titles and project and organization names.

How does every page get that title, translated, through one mechanism?

## Decision drivers

- Rule 1: the documented metadata API of Next.js 16.4 (`generate-metadata.md`, `title`).
- Rule 12: one way to set a title, with no per-page exceptions to remember.
- User text appears in the title exactly as typed.
- §13.1: the separator and the brand are translated texts.
- ADR 0014: one API read per request, and the not-found check runs before any part of a record reaches the metadata.

## Considered options

1. **`title.template: '%s – Trybun'` in the root layout**, with each page returning its specific part.
2. **`title.absolute` from one helper**: `pageTitle(...parts)` of `features/app-shell` builds the whole title from the catalogue entry `app.titlePart` (`"{part} – {rest}"`), ending with `app.title`.
3. **A client component that sets `document.title`**. ADR 0014 already rejected this.

## Decision outcome

**Option 2.** Every `page.tsx` exports a `generateMetadata` that returns `pageTitle()`. A record page passes a function from its read's data to the title parts through `metadataAfterRead()`, so the not-found check of ADR 0014 runs first. The root layout keeps `title: t('title')` as the title of what has none of its own.

### Consequences

- Good: one rule for every page and `not-found.tsx`. Record values are message arguments, inserted literally.
- Good: the translators own the separator and the order.
- Bad: every page needs a `generateMetadata`, even a static one. `app/page-titles.spec.ts` fails for a page without one.
- Bad: the suffix is repeated in every resolved title rather than declared once. It lives in one helper, so changing it is still one edit.

## Pros and cons of the other options

- **Option 1**, checked in Next.js 16.4.5:
  - `resolveTitleTemplate()` (`dist/esm/lib/metadata/resolvers/resolve-title.js`) runs `template.replace(/%s/g, title)`, so `$&`, `` $` `` and `$'` in user text act as replacement patterns. "Price $& and $' x" becomes "Price %s and  – Trybun x – Trybun".
  - `accumulateMetadata()` (`dist/esm/lib/metadata/resolve-metadata.js`) does not apply the template of the leaf layout, which is the case for `app/not-found.tsx`.
  - A plain string title in a nested layout resets the template for every segment below it.
  - Making it safe would need escaping of every record value plus two exceptions.
- **Option 3**: see ADR 0014. A refresh of the metadata overwrites it, and it adds a client module to every page.
