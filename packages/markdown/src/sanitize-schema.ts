import { defaultSchema, type Options as Schema } from 'rehype-sanitize';

/**
 * GitHub's sanitize schema (§6.2, §13.5) with the link protocols of Trybun: `http`, `https` and
 * `mailto` for links, `http` and `https` for images; a URL without a protocol (a path) stays. Every
 * other protocol, including `javascript:`, `data:` and `vbscript:`, removes the attribute.
 *
 * The only IDs in the tree are those `remark-rehype` generates for footnotes: the footnotes and
 * their references with its `user-content-` prefix (`clobberPrefix`), so the content cannot
 * clobber the page's own IDs, and the fixed `footnote-label` of the footnotes' heading, which no
 * text can change. The sanitizer adds no second prefix, which would break the footnote links; raw
 * HTML, the only source of IDs a writer controls, is never rendered (§6.2).
 */
export const markdownSanitizeSchema: Schema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
  clobberPrefix: '',
};
