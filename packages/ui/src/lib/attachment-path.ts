// The stable content path of an attachment (§13.3, ADR 0008) for the applications: the rule set of
// `@trybun/markdown` is imported only by `@trybun/ui` and the server (§14.6), so the path still
// exists in one place.
export { attachmentContentPath, parseAttachmentContentPath } from '@trybun/markdown';
