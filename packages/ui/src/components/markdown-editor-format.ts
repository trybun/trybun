// The text changes of the GFM editor's toolbar and shortcuts (§6.2): pure functions from the text
// and its selection to the new text and selection, so every action is tested without a browser.

export interface TextSelection {
  start: number;
  end: number;
}

export interface FormattedText {
  text: string;
  selection: TextSelection;
}

export type FormatAction =
  | 'heading'
  | 'bold'
  | 'italic'
  | 'quote'
  | 'code'
  | 'link'
  | 'bulletedList'
  | 'numberedList'
  | 'taskList';

/** The URL placeholder of a new link, selected so that typing replaces it. */
export const LINK_URL_PLACEHOLDER = 'url';

const URL_PATTERN = /^(?:https?:\/\/|mailto:)\S+$/;

function replace(text: string, start: number, end: number, insert: string): string {
  return text.slice(0, start) + insert + text.slice(end);
}

/** Wraps the selection in a marker, or removes the marker when the selection already has it. */
function toggleWrap(text: string, { start, end }: TextSelection, marker: string): FormattedText {
  const size = marker.length;
  const selected = text.slice(start, end);
  // The marker is around the selection: `**|bold|**`.
  if (text.slice(start - size, start) === marker && text.slice(end, end + size) === marker) {
    return {
      text: replace(text, start - size, end + size, selected),
      selection: { start: start - size, end: end - size },
    };
  }
  // The marker is part of the selection: `|**bold**|`.
  if (selected.length >= 2 * size && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(size, -size);
    return {
      text: replace(text, start, end, inner),
      selection: { start, end: start + inner.length },
    };
  }
  return {
    text: replace(text, start, end, `${marker}${selected}${marker}`),
    selection: { start: start + size, end: end + size },
  };
}

/** A fenced code block around selected lines, or the block removed when it is already fenced. */
function toggleCodeBlock(text: string, { start, end }: TextSelection): FormattedText {
  const selected = text.slice(start, end);
  const fenced = /^```[^\n]*\n([\s\S]*)\n```$/.exec(selected);
  if (fenced) {
    const inner = fenced[1] ?? '';
    return {
      text: replace(text, start, end, inner),
      selection: { start, end: start + inner.length },
    };
  }
  const before = start === 0 || text[start - 1] === '\n' ? '' : '\n';
  const after = end === text.length || text[end] === '\n' ? '' : '\n';
  const opening = `${before}\`\`\`\n`;
  return {
    text: replace(text, start, end, `${opening}${selected}\n\`\`\`${after}`),
    selection: { start: start + opening.length, end: end + opening.length },
  };
}

function link(text: string, { start, end }: TextSelection): FormattedText {
  const selected = text.slice(start, end);
  // A selected URL becomes the target; the cursor goes to the label.
  if (URL_PATTERN.test(selected)) {
    return {
      text: replace(text, start, end, `[](${selected})`),
      selection: { start: start + 1, end: start + 1 },
    };
  }
  const urlStart = start + selected.length + 3;
  return {
    text: replace(text, start, end, `[${selected}](${LINK_URL_PLACEHOLDER})`),
    selection: { start: urlStart, end: urlStart + LINK_URL_PLACEHOLDER.length },
  };
}

interface LinePrefix {
  /** The prefix of the line with the given index among the selected lines. */
  add: (index: number) => string;
  /** The prefix the action removes on a second press. */
  pattern: RegExp;
}

const LINE_PREFIXES: Record<
  'heading' | 'quote' | 'bulletedList' | 'numberedList' | 'taskList',
  LinePrefix
> = {
  heading: { add: () => '### ', pattern: /^### / },
  quote: { add: () => '> ', pattern: /^> ?/ },
  bulletedList: { add: () => '- ', pattern: /^[-*+] (?!\[[ xX]\] )/ },
  numberedList: { add: (index) => `${index + 1}. `, pattern: /^\d+\. / },
  taskList: { add: () => '- [ ] ', pattern: /^[-*+] \[[ xX]\] / },
};

/** Adds the prefix to every selected line, or removes it when every line already has it. */
function toggleLinePrefix(
  text: string,
  { start, end }: TextSelection,
  { add, pattern }: LinePrefix,
): FormattedText {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  // A selection that ends at the start of a line does not include that line.
  const lastChar = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const newline = text.indexOf('\n', lastChar);
  const lineEnd = newline === -1 ? text.length : newline;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const isRemoving = lines.every((line) => pattern.test(line));
  const changed = lines.map((line, index) =>
    isRemoving ? line.replace(pattern, '') : `${add(index)}${line}`,
  );
  const block = changed.join('\n');
  if (start === end) {
    const delta = changed[0]!.length - lines[0]!.length;
    const cursor = Math.max(lineStart, start + delta);
    return {
      text: replace(text, lineStart, lineEnd, block),
      selection: { start: cursor, end: cursor },
    };
  }
  return {
    text: replace(text, lineStart, lineEnd, block),
    selection: { start: lineStart, end: lineStart + block.length },
  };
}

/** The text and selection after a toolbar action or its shortcut. */
export function formatMarkdown(
  action: FormatAction,
  text: string,
  selection: TextSelection,
): FormattedText {
  switch (action) {
    case 'bold':
      return toggleWrap(text, selection, '**');
    case 'italic':
      return toggleWrap(text, selection, '_');
    case 'code':
      return text.slice(selection.start, selection.end).includes('\n')
        ? toggleCodeBlock(text, selection)
        : toggleWrap(text, selection, '`');
    case 'link':
      return link(text, selection);
    default:
      return toggleLinePrefix(text, selection, LINE_PREFIXES[action]);
  }
}

export interface TextEdit {
  start: number;
  end: number;
  insert: string;
}

/**
 * The smallest replacement that turns one text into another, so the editor inserts only the
 * changed part and the browser's undo history stays readable.
 */
export function textEdit(before: string, after: string): TextEdit {
  let start = 0;
  const shorter = Math.min(before.length, after.length);
  while (start < shorter && before[start] === after[start]) {
    start++;
  }
  let suffix = 0;
  while (
    suffix < shorter - start &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix++;
  }
  return {
    start,
    end: before.length - suffix,
    insert: after.slice(start, after.length - suffix),
  };
}
