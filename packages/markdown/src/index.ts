// The one Markdown rule set of the web views, the editor's preview and the e-mails (§6.2, §14.2).
import rehypeSanitize from 'rehype-sanitize';
import type { PluggableList } from 'unified';
import {
  rehypeAttachmentImages,
  type AttachmentImagesOptions,
} from './rehype-attachment-images.js';
import { rehypeExternalLinks } from './rehype-external-links.js';
import { markdownSanitizeSchema } from './sanitize-schema.js';
import { rehypeTaskListLabels } from './rehype-task-list-labels.js';

export { attachmentContentPath, parseAttachmentContentPath } from './attachment-path.js';
export {
  rehypeAttachmentImages,
  type AttachmentImagesOptions,
} from './rehype-attachment-images.js';
export { EXTERNAL_LINK_REL, isExternalUrl, rehypeExternalLinks } from './rehype-external-links.js';
export { markdownSanitizeSchema } from './sanitize-schema.js';
export { rehypeTaskListLabels } from './rehype-task-list-labels.js';

export type MarkdownRuleOptions = AttachmentImagesOptions;

/**
 * The rehype plugins every renderer applies, in order: sanitize, the attachment-image rule, the
 * link rule, the names of task-list checkboxes. A renderer adds its own plugins after them (highlighting, inline styles).
 */
export function markdownRehypePlugins(options: MarkdownRuleOptions = {}): PluggableList {
  return [
    [rehypeSanitize, markdownSanitizeSchema],
    [rehypeAttachmentImages, options],
    rehypeExternalLinks,
    rehypeTaskListLabels,
  ];
}
