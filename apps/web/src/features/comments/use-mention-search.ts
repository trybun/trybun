'use client';

import type { CommentKind } from '@trybun/contracts/comments';
import type { MentionSearch } from '@trybun/ui/components/markdown-editor';
import { useTranslations } from 'next-intl';
import { dataOf } from '../../lib/api-client/api-client.js';
import { browserApiClient } from '../../lib/api-client/browser-api-client.js';

/**
 * The search of the people a comment of a ticket may mention (§7.3, S1-12 Q4) for the GFM
 * editor's suggestions: the API decides the scope, team members first; the text after `@` goes in
 * the body, never in the URL (§17.2).
 */
export function useMentionSearch(ticketId: string, kind: CommentKind): MentionSearch {
  const t = useTranslations('comments');
  return async (query) => {
    const page = await dataOf(
      browserApiClient.POST('/api/v1/tickets/{ticketId}/mention-candidates', {
        params: { path: { ticketId } },
        body: { kind, query },
      }),
    );
    return page.items.map((person) => ({
      id: person.id,
      displayName: person.displayName ?? t('unknownPerson'),
      userKind: person.userKind,
    }));
  };
}
