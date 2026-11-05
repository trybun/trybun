---
title: Formatting text
description: The Markdown you can use in descriptions, comments and internal notes, the toolbar and its keyboard shortcuts.
---

Descriptions, comments and internal notes are written in Markdown, as on GitHub. Write in the **Write** tab and select **Preview** to see the text exactly as it will appear after saving.

## Toolbar and shortcuts

The toolbar above the text adds the formatting for you: select text and choose a button, or choose a button and type. Choosing the same button again removes the formatting. On a Mac, use Cmd instead of Ctrl.

| Button | What it does | Shortcut |
|---|---|---|
| Heading | Makes the line a heading | – |
| Bold | `**bold**` | Ctrl+B |
| Italic | `_italic_` | Ctrl+I |
| Quote | `> ` before each line | Ctrl+Shift+. |
| Code | `` `code` ``, or a code block when the selection spans several lines | Ctrl+E |
| Link | `[text](url)` – type the address over `url` | Ctrl+K |
| Bulleted list | `- ` before each line | Ctrl+Shift+8 |
| Numbered list | `1. `, `2. `, … before the lines | Ctrl+Shift+7 |
| Task list | `- [ ] ` before each line | Ctrl+Shift+L |
| Attach files | Chooses files to attach, where the form allows it | – |

Ctrl+Z undoes a change of the toolbar like typing. On a phone, the less used buttons are under **More formatting**.

## Markdown syntax

| You write | You get |
|---|---|
| `## Heading` | A heading (`#` to `######`) |
| `**bold**`, `_italic_`, `~~strikethrough~~` | **bold**, _italic_, ~~strikethrough~~ |
| `- item` or `1. item` | A bulleted or numbered list |
| `- [ ] task`, `- [x] done` | A task list with checkboxes |
| `> quote` | A quote |
| `` `code` `` | Inline code |
| ` ```ts ` … ` ``` ` on lines of their own | A code block; with a language such as `ts`, `sql` or `json` it is highlighted |
| `[text](https://example.com)` | A link; a web address on its own becomes a link too |
| `\| a \| b \|` with a `\|---\|---\|` line below | A table |
| `text[^1]` and `[^1]: note` | A footnote |

## What Trybun does not show

- **HTML tags** such as `<details>` or `<kbd>` are not shown; the text between them is.
- **Links** work only with `http`, `https` and `mailto` addresses and addresses within Trybun; any other link is shown as plain text.
- **Images** are shown only for files attached to the same ticket. Any other image, for example from another website, is shown as a link with its description.
- **Checkboxes** of task lists show the state; to tick one, edit the text.
- In **e-mails**, images are always links, code is not highlighted and task items appear as ☐ and ☑.
