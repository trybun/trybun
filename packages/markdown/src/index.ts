// The one Markdown rule set of the web views, the editor's preview and the e-mails (§6.2, §14.2).
import rehypeSanitize from 'rehype-sanitize';
import type { PluggableList } from 'unified';
import {
  rehypeAttachmentImages,
  type AttachmentImagesOptions,
} from './rehype-attachment-images.js';
import { rehypeExternalLinks } from './rehype-external-links.js';
import { rehypeFootnoteIds, type FootnoteIdOptions } from './footnote-ids.js';
import { rehypeMentions, type MentionsOptions } from './mentions.js';
import { markdownSanitizeSchema } from './sanitize-schema.js';
import { rehypeTaskListLabels } from './rehype-task-list-labels.js';

export { attachmentContentPath, parseAttachmentContentPath } from './attachment-path.js';
export {
  markdownRemarkRehypeOptions,
  rehypeFootnoteIds,
  type FootnoteIdOptions,
} from './footnote-ids.js';
export {
  CUSTOMER_MENTION_ID,
  MENTION_TOKEN_PATTERN,
  mentionIdsOf,
  rehypeMentions,
  type MentionedPerson,
  type MentionsOptions,
} from './mentions.js';
export {
  rehypeAttachmentImages,
  type AttachmentImagesOptions,
} from './rehype-attachment-images.js';
export { EXTERNAL_LINK_REL, isExternalUrl, rehypeExternalLinks } from './rehype-external-links.js';
export { markdownSanitizeSchema } from './sanitize-schema.js';
export { rehypeTaskListLabels } from './rehype-task-list-labels.js';

export type MarkdownRuleOptions = AttachmentImagesOptions & MentionsOptions & FootnoteIdOptions;

/**
 * The rehype plugins every renderer applies, in order: the footnote IDs of the text, sanitize, the
 * attachment-image rule, the link rule, the names of task-list checkboxes, mentions. A renderer
 * passes `markdownRemarkRehypeOptions` with the same `idPrefix` to `remark-rehype` and adds its own
 * plugins after these (highlighting, inline styles).
 */
export function markdownRehypePlugins({
  allowedIds,
  mentions,
  idPrefix,
}: MarkdownRuleOptions = {}): PluggableList {
  return [
    [rehypeFootnoteIds, { idPrefix }],
    [rehypeSanitize, markdownSanitizeSchema],
    [rehypeAttachmentImages, { allowedIds }],
    rehypeExternalLinks,
    rehypeTaskListLabels,
    [rehypeMentions, { mentions }],
  ];
}
