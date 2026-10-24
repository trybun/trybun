# User documentation

The user documentation of Trybun ([Rule 3, §2.3](../spec/02-agent-rules.md#23-rule-3--user-documentation-from-day-one)): Markdown files rendered by the web application in its help viewer (`/help`), versioned with the code and updated in the same pull request as the behaviour they describe.

## Structure

```
docs/user/<language>/<audience>/<category>/<name>.md
```

| Part | Values | Meaning |
|---|---|---|
| `<language>` | `en`, `pl` – one folder per language of the message catalogues ([§13.1](../spec/13-non-functional.md#131-internationalization)) | Every page exists in every language with the same path |
| `<audience>` | `end-user`, `team`, `administrator` | Who the page is written for. End users receive only `end-user` pages; team accounts receive the pages of every audience |
| `<category>` | `tutorials`, `how-to`, `reference`, `explanation` | The [Diátaxis](https://diataxis.fr/) type of the page: learning by doing, the shortest path to a goal, facts to look up, and how something works |
| `<name>` | kebab-case English name | Together with the audience and the category it forms the address of the page, e.g. `/help/end-user/how-to/change-language` in both languages |

## Front matter

```yaml
---
title: Change the language
description: Switch the interface between English and Polish.
views: ['/']
---
```

- `title` and `description` are required; the body starts below the front matter, without a level-1 heading (the viewer shows the title).
- `views` (optional) lists the routes of the application for which the page is the contextual help: the help icon of such a view opens it. A route segment in square brackets (`/tickets/[id]`) matches any value. When pages of several audiences name the same view, a reader receives the one of the most specific audience available to them (`administrator`, then `team`, then `end-user`). Every language lists the same views.
- Links to other pages are relative links to their Markdown files (`../how-to/change-language.md`), so they work on GitHub and in the application.

## Writing

- How-to guides describe the shortest path to the goal, step by step ([§2.3](../spec/02-agent-rules.md#23-rule-3--user-documentation-from-day-one)).
- Use the UI labels of the [glossary](../spec/00-glossary.md) in the language of the page.
- Describe only behaviour that exists in the application.

## Generating the help content

The web application reads the pages and their search indexes (MiniSearch, one per language and account kind, [§14.2](../spec/14-architecture.md#142-technology-stack)) from files generated into `apps/web/src/features/help/content/`. After changing a page run:

```sh
pnpm help:generate
```

`pnpm lint` fails when the generated files differ from the pages, and the generator fails on a page without a translation, an unknown audience or category, a missing title or a view claimed twice by one audience.
