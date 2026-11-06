import type { Element, Root, RootContent } from 'hast';

/** `rel` of a link to another site (§6.2): no ranking credit, no access to the opener. */
export const EXTERNAL_LINK_REL = ['nofollow', 'ugc', 'noopener', 'noreferrer'];

type Parent = Root | Element;

/**
 * A link to another site: an absolute URL with a protocol other than `mailto`, or a
 * protocol-relative one. Browsers read `/\host` and `\\host` like `//host`.
 */
export function isExternalUrl(url: string): boolean {
  if (/^[/\\]{2}/.test(url) || /^\/\\/.test(url)) {
    return true;
  }
  const protocol = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase();
  return protocol !== undefined && protocol !== 'mailto';
}

function rewrite(parent: Parent): void {
  const children: RootContent[] = [];
  for (const child of parent.children) {
    if (child.type !== 'element') {
      children.push(child);
      continue;
    }
    rewrite(child);
    if (child.tagName !== 'a') {
      children.push(child);
      continue;
    }
    const { href } = child.properties;
    // The sanitizer removed an unsafe target: the link renders as its plain text.
    if (typeof href !== 'string' || href === '') {
      children.push(...child.children);
      continue;
    }
    if (isExternalUrl(href)) {
      child.properties.rel = EXTERNAL_LINK_REL;
    }
    children.push(child);
  }
  parent.children = children;
}

/**
 * Links without a safe target render as plain text; links to other sites get
 * `rel="nofollow ugc noopener noreferrer"` (§6.2). Runs after sanitizing and the image rule.
 */
export function rehypeExternalLinks() {
  return (tree: Root): void => {
    rewrite(tree);
  };
}
