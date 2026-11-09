// The mention of the GFM editor (S1-12): finding the `@query` being typed and the token that
// replaces it. Pure, so the rules are unit-tested without a browser.

/** The `@query` the writer is typing: `start` is the index of the `@`. */
export interface MentionQuery {
  start: number;
  query: string;
}

/** Longer text after an `@` is no search for a name. */
const MAX_QUERY_LENGTH = 50;

/**
 * The `@query` that ends at the caret, or `undefined`: an `@` at the start of the text or after
 * whitespace, followed by characters other than whitespace, `@`, `{` and `}` (a typed token or an
 * e-mail address is no search).
 */
export function mentionQueryAt(text: string, caret: number): MentionQuery | undefined {
  const before = text.slice(Math.max(0, caret - MAX_QUERY_LENGTH - 1), caret);
  const match = /(?:^|\s)@([^\s@{}]*)$/.exec(before);
  if (match === null) {
    return undefined;
  }
  const query = match[1]!;
  const start = caret - query.length - 1;
  // The window cut the text: the `@` must start the text or follow whitespace in it.
  if (start > 0 && !/\s/.test(text[start - 1]!)) {
    return undefined;
  }
  return { start, query };
}

/** The token that replaces `@query`, with a space so the writer goes on typing (§6.2, S1-12). */
export function mentionToken(id: string): string {
  return `@{${id}} `;
}
