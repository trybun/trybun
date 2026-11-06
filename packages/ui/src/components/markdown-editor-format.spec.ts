import { describe, expect, it } from 'vitest';
import {
  escapeLinkText,
  type FormatAction,
  formatMarkdown,
  textEdit,
} from './markdown-editor-format.js';

// A text with its selection: `[[` and `]]` mark the selected range, `|` a cursor; each marker
// appears once.
function parse(marked: string) {
  const cursor = marked.indexOf('|');
  if (cursor !== -1) {
    return {
      text: marked.slice(0, cursor) + marked.slice(cursor + 1),
      selection: { start: cursor, end: cursor },
    };
  }
  const start = marked.indexOf('[[');
  const close = marked.indexOf(']]');
  return {
    text: marked.slice(0, start) + marked.slice(start + 2, close) + marked.slice(close + 2),
    selection: { start, end: close - 2 },
  };
}

function mark(text: string, { start, end }: { start: number; end: number }) {
  return start === end
    ? `${text.slice(0, start)}|${text.slice(start)}`
    : `${text.slice(0, start)}[[${text.slice(start, end)}]]${text.slice(end)}`;
}

function apply(action: FormatAction, marked: string) {
  const { text, selection } = parse(marked);
  const result = formatMarkdown(action, text, selection);
  return mark(result.text, result.selection);
}

describe('formatMarkdown', () => {
  it.each<[FormatAction, string, string]>([
    // Bold, italic and inline code wrap the selection, or place the cursor between the markers.
    ['bold', 'a [[word]] b', 'a **[[word]]** b'],
    ['bold', 'a | b', 'a **|** b'],
    ['bold', 'a **[[word]]** b', 'a [[word]] b'],
    ['bold', 'a [[**word**]] b', 'a [[word]] b'],
    ['bold', 'a **|** b', 'a | b'],
    ['italic', '[[word]]', '_[[word]]_'],
    ['italic', '_[[word]]_', '[[word]]'],
    ['code', '[[npm i]]', '`[[npm i]]`'],
    ['code', '`[[npm i]]`', '[[npm i]]'],
    ['code', '|', '`|`'],
    // Code over several lines is a fenced block on lines of its own.
    ['code', '[[a\nb]]', '```\n[[a\nb]]\n```'],
    ['code', 'x [[a\nb]] y', 'x \n```\n[[a\nb]]\n```\n y'],
    ['code', '[[```\na\nb\n```]]', '[[a\nb]]'],
    ['code', '[[```ts\na\nb\n```]]', '[[a\nb]]'],
    // A second press removes the block it added.
    ['code', 'x\n```\n[[a\nb]]\n```\ny', 'x\n[[a\nb]]\ny'],
    ['code', '```ts\n[[a\nb]]\n```', '[[a\nb]]'],
    // Link: the URL placeholder is selected; a selected URL becomes the target.
    ['link', 'see [[docs]]', 'see [docs]([[url]])'],
    ['link', '|', '[]([[url]])'],
    ['link', 'at [[https://example.com/a]]', 'at [|](https://example.com/a)'],
    // Line prefixes apply to every selected line and toggle off on a second press.
    ['heading', 'Ti|tle', '### Ti|tle'],
    ['heading', '### Ti|tle', 'Ti|tle'],
    ['quote', '[[a\nb]]', '[[> a\n> b]]'],
    ['quote', '[[> a\n> b]]', '[[a\nb]]'],
    ['quote', '[[> a\nb]]', '[[> > a\n> b]]'],
    ['bulletedList', 'x\n[[a\nb]]\ny', 'x\n[[- a\n- b]]\ny'],
    ['bulletedList', '[[- a\n- b]]', '[[a\nb]]'],
    ['bulletedList', '|', '- |'],
    ['numberedList', '[[a\nb\nc]]', '[[1. a\n2. b\n3. c]]'],
    ['numberedList', '[[1. a\n2. b]]', '[[a\nb]]'],
    ['taskList', '[[a\nb]]', '[[- [ ] a\n- [ ] b]]'],
    ['taskList', '[[- [ ] a\n- [x] b]]', '[[a\nb]]'],
    ['taskList', 'it|em', '- [ ] it|em'],
    // A task item is not a bulleted item: the bullet is added, not removed.
    ['bulletedList', '- [ ] |a', '- - [ ] |a'],
    // A selection that ends at the start of a line does not include that line.
    ['quote', '[[a\n]]b', '[[> a]]\nb'],
    // A partly selected line is changed as a whole.
    ['bulletedList', 'ab[[c]]d', '[[- abcd]]'],
  ])('%s: %j → %j', (action, before, after) => {
    expect(apply(action, before)).toBe(after);
  });
});

describe('textEdit', () => {
  it.each([
    ['abc', 'abc', { start: 3, end: 3, insert: '' }],
    ['a b', 'a **b**', { start: 2, end: 3, insert: '**b**' }],
    ['a **b**', 'a b', { start: 2, end: 7, insert: 'b' }],
    ['aa', 'aaa', { start: 2, end: 2, insert: 'a' }],
    ['', 'x', { start: 0, end: 0, insert: 'x' }],
  ])('%j → %j', (before, after, expected) => {
    const edit = textEdit(before, after);
    expect(edit).toEqual(expected);
    expect(before.slice(0, edit.start) + edit.insert + before.slice(edit.end)).toBe(after);
  });
});

describe('escapeLinkText', () => {
  it.each([
    ['screenshot.png', 'screenshot\\.png'],
    ['<https://evil.example>', '\\<https\\:\\/\\/evil\\.example\\>'],
    ['a`', 'a\\`'],
    ['line\nbreak', 'line break'],
    ['[x](y)', '\\[x\\]\\(y\\)'],
  ])('%j → %j', (name, expected) => {
    expect(escapeLinkText(name)).toBe(expected);
  });
});
