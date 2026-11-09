// IDs of footnotes unique per rendered text, so several comments with footnotes on one page do not
// repeat them (S1-12).
import type { Element, Root } from 'hast';

/** The prefix `remark-rehype` gives the footnote IDs (`fn-1`, `fnref-1`) by default. */
const DEFAULT_CLOBBER_PREFIX = 'user-content-';

/** The fixed ID `remark-rehype` gives the footnotes' heading, which its options cannot change. */
const FOOTNOTE_LABEL_ID = 'footnote-label';

export interface FootnoteIdOptions {
  /**
   * Unique per rendered text on a page, e.g. React's `useId()`. Without it the IDs are those of
   * `remark-rehype`, fine for a page with one text (an e-mail).
   */
  idPrefix?: string;
}

function clobberPrefix(idPrefix: string | undefined): string {
  return idPrefix === undefined ? DEFAULT_CLOBBER_PREFIX : `${DEFAULT_CLOBBER_PREFIX}${idPrefix}-`;
}

/**
 * The options of `remark-rehype` every renderer passes: the footnote IDs with the text's prefix
 * (`user-content-<prefix>-fn-1`). The sanitize schema adds no second prefix.
 */
export function markdownRemarkRehypeOptions({ idPrefix }: FootnoteIdOptions = {}): {
  clobberPrefix: string;
} {
  return { clobberPrefix: clobberPrefix(idPrefix) };
}

function rewrite(parent: Root | Element, labelId: string): void {
  for (const child of parent.children) {
    if (child.type !== 'element') {
      continue;
    }
    const { properties } = child;
    if (properties.id === FOOTNOTE_LABEL_ID) {
      properties.id = labelId;
    }
    // `remark-rehype` writes the references' `aria-describedby` as a list.
    const describedBy = properties.ariaDescribedBy;
    if (Array.isArray(describedBy)) {
      properties.ariaDescribedBy = describedBy.map((id) =>
        id === FOOTNOTE_LABEL_ID ? labelId : id,
      );
    }
    rewrite(child, labelId);
  }
}

/**
 * Gives the footnotes' heading (`footnote-label`) and the references that point to it the text's
 * prefix: `user-content-<prefix>-footnote-label`. Runs right after `remark-rehype`, before
 * sanitizing, while the only IDs in the tree are those `remark-rehype` generated.
 */
export function rehypeFootnoteIds({ idPrefix }: FootnoteIdOptions = {}) {
  const labelId = `${clobberPrefix(idPrefix)}${FOOTNOTE_LABEL_ID}`;
  return (tree: Root): void => {
    if (idPrefix !== undefined) {
      rewrite(tree, labelId);
    }
  };
}
