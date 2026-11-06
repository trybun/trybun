import type { Element, ElementContent, Root, RootContent } from 'hast';
import { parseAttachmentContentPath } from './attachment-path.js';

export interface AttachmentImagesOptions {
  /** IDs of the attachments the view may show as images; any other image becomes a link. */
  allowedIds?: Iterable<string>;
}

type Parent = Root | Element;

function text(value: string): ElementContent {
  return { type: 'text', value };
}

/** What a disallowed image renders as (§6.2, Q4): a link labelled by its alt text or its URL. */
function replacement(image: Element, isInsideLink: boolean): ElementContent | undefined {
  const { src, alt } = image.properties;
  const label = typeof alt === 'string' ? alt : '';
  // The sanitizer removed an unsafe source: only the alt text remains.
  if (typeof src !== 'string' || src === '') {
    return label === '' ? undefined : text(label);
  }
  // A link inside a link is invalid HTML; the outer link stays and the image becomes its text.
  if (isInsideLink) {
    return text(label === '' ? src : label);
  }
  return {
    type: 'element',
    tagName: 'a',
    properties: { href: src },
    children: [text(label === '' ? src : label)],
  };
}

function rewrite(parent: Parent, allowed: ReadonlySet<string>, isInsideLink: boolean): void {
  const children: RootContent[] = [];
  for (const child of parent.children) {
    if (child.type !== 'element') {
      children.push(child);
      continue;
    }
    if (child.tagName === 'img') {
      const { src } = child.properties;
      const id = typeof src === 'string' ? parseAttachmentContentPath(src) : undefined;
      if (id !== undefined && allowed.has(id)) {
        children.push(child);
      } else {
        const content = replacement(child, isInsideLink);
        if (content !== undefined) {
          children.push(content);
        }
      }
      continue;
    }
    rewrite(child, allowed, isInsideLink || child.tagName === 'a');
    children.push(child);
  }
  parent.children = children;
}

/**
 * Shows an `<img>` only for the stable content path of an allowed attachment (§13.3); every other
 * image – external, of another ticket, unknown – renders as a link (§6.2). Runs after sanitizing.
 */
export function rehypeAttachmentImages({ allowedIds = [] }: AttachmentImagesOptions = {}) {
  const allowed = new Set(allowedIds);
  return (tree: Root): void => {
    rewrite(tree, allowed, false);
  };
}
