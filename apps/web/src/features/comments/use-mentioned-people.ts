'use client';

import { type CommentMention, HIDDEN_MENTION_ID } from '@trybun/contracts/comments';
import type { MarkdownProps } from '@trybun/ui/components/markdown';
import { useTranslations } from 'next-intl';

/**
 * The mentioned people of a text as the Markdown renders them (S1-12 Q2): a person the identity
 * rule hides reaches the reader as `@{customer}` and shows as "Customer" (§5.4).
 */
export function useMentionedPeople(
  mentions: readonly CommentMention[],
): NonNullable<MarkdownProps['mentions']>[number][] {
  const t = useTranslations('comments');
  return mentions.map(({ id, displayName }) => ({
    id,
    displayName: id === HIDDEN_MENTION_ID ? t('customer') : (displayName ?? t('unknownPerson')),
  }));
}
