import { markdownRehypePlugins } from '@trybun/markdown';
import type { Element, ElementContent, Root } from 'hast';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import type { ReactElement } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

// E-mail clients ignore style sheets and CSS variables, so the elements carry inline styles with the
// light-theme values of the design tokens (packages/ui/src/styles/globals.css).
const MUTED = '#f3f4f5';
const MUTED_FOREGROUND = '#5a5f6d';
const BORDER = '#e3e4e6';
const LINK = '#2563eb';
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const ELEMENT_STYLES: Readonly<Record<string, string>> = {
  p: 'margin: 0 0 12px',
  h1: 'margin: 16px 0 8px; font-size: 20px; font-weight: 700',
  h2: 'margin: 16px 0 8px; font-size: 18px; font-weight: 700',
  h3: 'margin: 12px 0 8px; font-size: 16px; font-weight: 600',
  h4: 'margin: 12px 0 8px; font-size: 14px; font-weight: 600',
  h5: 'margin: 12px 0 8px; font-size: 14px; font-weight: 600',
  h6: 'margin: 12px 0 8px; font-size: 14px; font-weight: 600',
  a: `color: ${LINK}; text-decoration: underline`,
  ul: 'margin: 0 0 12px; padding-left: 24px',
  ol: 'margin: 0 0 12px; padding-left: 24px',
  li: 'margin: 0 0 4px',
  blockquote: `margin: 0 0 12px; padding-left: 12px; border-left: 4px solid ${BORDER}; color: ${MUTED_FOREGROUND}`,
  code: `font-family: ${MONOSPACE}; font-size: 13px; background-color: ${MUTED}; border-radius: 4px; padding: 1px 4px`,
  pre: `margin: 0 0 12px; padding: 12px; background-color: ${MUTED}; border-radius: 8px; overflow-x: auto; white-space: pre-wrap`,
  table: 'margin: 0 0 12px; border-collapse: collapse',
  th: `border: 1px solid ${BORDER}; padding: 6px 10px; text-align: left; font-weight: 600`,
  td: `border: 1px solid ${BORDER}; padding: 6px 10px`,
  hr: `border: 0; border-top: 1px solid ${BORDER}; margin: 16px 0`,
  del: `color: ${MUTED_FOREGROUND}`,
};

export interface EmailMarkdownOptions {
  /** The address of the installation, e.g. `https://${TRYBUN_DOMAIN}` from the configuration. */
  baseUrl: string;
}

type Parent = Root | Element;

/** A site-relative link becomes absolute; links within the content (`#…`) stay. */
function absoluteUrl(url: string, baseUrl: string): string {
  if (url.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return url;
  }
  return new URL(url, baseUrl).href;
}

function styleForEmail(parent: Parent, baseUrl: string): void {
  const children: ElementContent[] = [];
  for (const child of parent.children) {
    if (child.type !== 'element') {
      if (child.type !== 'doctype') {
        children.push(child);
      }
      continue;
    }
    // E-mail clients drop form controls: a task item shows its state as a character.
    if (child.tagName === 'input') {
      children.push({ type: 'text', value: child.properties.checked === true ? '☑' : '☐' });
      continue;
    }
    if (child.tagName === 'a' && typeof child.properties.href === 'string') {
      child.properties.href = absoluteUrl(child.properties.href, baseUrl);
    }
    // In a code block, the block's style applies; the inline code style would draw a second box.
    const isCodeInBlock =
      child.tagName === 'code' && parent.type === 'element' && parent.tagName === 'pre';
    const style = isCodeInBlock
      ? `font-family: ${MONOSPACE}; font-size: 13px`
      : ELEMENT_STYLES[child.tagName];
    child.properties.className = undefined;
    child.properties.ariaLabel = undefined;
    if (style !== undefined) {
      child.properties.style = style;
    }
    styleForEmail(child, baseUrl);
    children.push(child);
  }
  parent.children = children;
}

/**
 * Markdown of a ticket, comment or note as React elements for an e-mail (§6.2, §13.3): the rule set
 * of @trybun/markdown with no allowed images, so every image is a link; absolute links; inline
 * styles; task items as ☐/☑; no syntax highlighting. Whether a recipient may see the content is
 * decided when the e-mail is built, never here.
 */
export function renderEmailMarkdown(
  source: string,
  { baseUrl }: EmailMarkdownOptions,
): ReactElement {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(markdownRehypePlugins({ allowedIds: [] }));
  const tree = processor.runSync(processor.parse(source));
  styleForEmail(tree, baseUrl);
  return toJsxRuntime(tree, { Fragment, jsx, jsxs });
}
