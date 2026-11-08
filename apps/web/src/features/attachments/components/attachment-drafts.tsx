'use client';

import { AttachmentItem, AttachmentList } from '@trybun/ui/components/attachment-list';
import { attachmentContentPath } from '@trybun/ui/lib/attachment-path';
import { useTranslations } from 'next-intl';
import type { AttachmentDraft } from '../use-attachment-drafts.js';

/**
 * The files of a form below its editor (§13.3): uploading, being checked, available or removed.
 * An uploaded draft is removed at once, without a confirmation (Q18) – it is the person's own
 * draft, and nobody else has seen it.
 */
export function AttachmentDrafts({
  drafts,
  onRemove,
}: {
  drafts: readonly AttachmentDraft[];
  onRemove: (draft: AttachmentDraft) => void;
}) {
  const t = useTranslations('attachments');
  if (drafts.length === 0) {
    return null;
  }
  return (
    <AttachmentList aria-label={t('drafts')}>
      {drafts.map((draft) => {
        const href = draft.id === undefined ? '' : attachmentContentPath(draft.id);
        return (
          <AttachmentItem
            key={draft.key}
            fileName={draft.fileName}
            size={draft.size}
            contentType={draft.contentType}
            href={href}
            state={draft.state}
            {...(draft.isImage ? { thumbnailUrl: href } : {})}
            {...(draft.id === undefined ? {} : { onDelete: () => onRemove(draft) })}
          />
        );
      })}
    </AttachmentList>
  );
}
