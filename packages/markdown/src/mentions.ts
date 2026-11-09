// Mentions in comments and notes (S1-12): the token `@{<user ID>}` the editor inserts, the IDs the
// server stores and the names the renderers show.
import type { Element, ElementContent, Root, RootContent } from 'hast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const UUID = '[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';

/** The ID of the person the API shows instead of a hidden one, e.g. the customer's contact. */
export const CUSTOMER_MENTION_ID = 'customer';

/**
 * A mention token: `@{` + a lower-case UUID or `customer` + `}`; the first group is the ID. Not
 * global, so `test` keeps no state; scan with `matchAll(new RegExp(MENTION_TOKEN_PATTERN, 'g'))`.
 */
export const MENTION_TOKEN_PATTERN = new RegExp(`@\\{(${UUID}|${CUSTOMER_MENTION_ID})\\}`);

const USER_ID = new RegExp(`^${UUID}$`);

/** A person a text may mention, with the name the renderers show. */
export interface MentionedPerson {
  id: string;
  displayName: string;
}

export interface MentionsOptions {
  /** The people whose tokens render as mentions; any other token stays text. */
  mentions?: ReadonlyArray<MentionedPerson>;
}

function tokenIds(value: string): string[] {
  return [...value.matchAll(new RegExp(MENTION_TOKEN_PATTERN, 'g'))].map(([, id]) => id!);
}

interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
}

const parser = unified().use(remarkParse).use(remarkGfm);

/**
 * The distinct user IDs mentioned in a GFM source, in the order of their first token. Tokens in
 * code, link destinations and links (also autolinks) do not count, as they do not render as
 * mentions; nor does `customer`, which is no user.
 */
export function mentionIdsOf(source: string): string[] {
  const ids = new Set<string>();
  const visit = (node: MdastNode): void => {
    if (node.type === 'text' && node.value !== undefined) {
      for (const id of tokenIds(node.value)) {
        if (USER_ID.test(id)) {
          ids.add(id);
        }
      }
      return;
    }
    if (node.type === 'link' || node.type === 'linkReference') {
      return;
    }
    node.children?.forEach(visit);
  };
  visit(parser.parse(source));
  return [...ids];
}

type Parent = Root | Element;

// Code shows the token as written; inside a link a mention would be a second interactive name.
const TEXT_ONLY_ELEMENTS: ReadonlySet<string> = new Set(['code', 'pre', 'a']);

function mentionSpan(displayName: string): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: ['mention'] },
    children: [{ type: 'text', value: `@${displayName}` }],
  };
}

function split(value: string, names: ReadonlyMap<string, string>): ElementContent[] {
  const parts: ElementContent[] = [];
  let index = 0;
  for (const match of value.matchAll(new RegExp(MENTION_TOKEN_PATTERN, 'g'))) {
    const name = names.get(match[1]!);
    if (name === undefined) {
      continue;
    }
    if (match.index > index) {
      parts.push({ type: 'text', value: value.slice(index, match.index) });
    }
    parts.push(mentionSpan(name));
    index = match.index + match[0].length;
  }
  if (index < value.length) {
    parts.push({ type: 'text', value: value.slice(index) });
  }
  return parts;
}

function rewrite(parent: Parent, names: ReadonlyMap<string, string>): void {
  const children: RootContent[] = [];
  for (const child of parent.children) {
    if (child.type === 'text') {
      children.push(...split(child.value, names));
      continue;
    }
    if (child.type === 'element' && !TEXT_ONLY_ELEMENTS.has(child.tagName)) {
      rewrite(child, names);
    }
    children.push(child);
  }
  parent.children = children;
}

/**
 * Renders the token `@{<id>}` of a person in `mentions` as `<span class="mention">@Name</span>`,
 * not a link; tokens of other people, in code and in links stay text. Runs after sanitizing, so
 * the span needs no rule of the schema; the name is a text node, never HTML.
 */
export function rehypeMentions({ mentions = [] }: MentionsOptions = {}) {
  const names = new Map(mentions.map(({ id, displayName }) => [id, displayName]));
  return (tree: Root): void => {
    if (names.size > 0) {
      rewrite(tree, names);
    }
  };
}
