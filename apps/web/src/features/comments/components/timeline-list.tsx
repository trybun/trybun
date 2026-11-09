'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { ActivityEventResponse } from '@trybun/contracts/activity-events';
import type { CommentResponse } from '@trybun/contracts/comments';
import type { TicketResponse } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import type { ReactNode } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useTicketImageIds } from '../../attachments/use-ticket-image-ids.js';
import { timelineQueryOptions } from '../queries.js';
import { CommentForm } from './comment-form.js';
import { CommentItem } from './comment-item.js';

/**
 * The timeline of a ticket (S1-12 Q11): its comments and its activity events in one list, oldest
 * first, 50 per page with **Show more**, and the comment field at its end. The shells render the
 * opening item and the events their way; the comments look the same in both. An image shows
 * inline when its attachment belongs to the ticket or to one of the comments the reader sees
 * (§13.3).
 */
export function TimelineList({
  ticket,
  isTeam,
  attachmentMaxSizeMb,
  opening,
  renderEvent,
  showMoreLabel,
}: {
  ticket: TicketResponse;
  isTeam: boolean;
  attachmentMaxSizeMb: number;
  /** The first item: who opened the ticket and when. */
  opening: ReactNode;
  renderEvent: (event: ActivityEventResponse) => ReactNode;
  showMoreLabel: string;
}) {
  const errorMessage = useErrorMessage();
  const timeline = useInfiniteQuery(timelineQueryOptions(browserApiClient, ticket.id));
  const items = timeline.data?.pages.flatMap((page) => page.items) ?? [];
  const comments = items.flatMap((item) => (item.type === 'comment' ? [item.comment] : []));
  const imageIds = useTimelineImageIds(ticket, comments);
  return (
    <>
      <ol className="flex flex-col gap-3 border-l border-border pl-4">
        {opening}
        {items.map((item) =>
          item.type === 'comment' ? (
            <CommentItem
              key={item.comment.id}
              comment={item.comment}
              imageIds={imageIds}
              attachmentMaxSizeMb={attachmentMaxSizeMb}
            />
          ) : (
            renderEvent(item.event)
          ),
        )}
      </ol>
      {timeline.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(timeline.error)}
        </p>
      )}
      {timeline.hasNextPage && (
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={timeline.isFetchingNextPage}
          onClick={() => void timeline.fetchNextPage()}
        >
          {showMoreLabel}
        </Button>
      )}
      <CommentForm
        ticket={ticket}
        isTeam={isTeam}
        imageIds={imageIds}
        attachmentMaxSizeMb={attachmentMaxSizeMb}
      />
    </>
  );
}

/**
 * The images the comments of a ticket show inline (§13.3): the available images of the loaded
 * comments, and the ticket's own images the comments reference.
 */
function useTimelineImageIds(ticket: TicketResponse, comments: readonly CommentResponse[]) {
  const ticketImages = useTicketImageIds(
    ticket.id,
    comments.map((comment) => comment.body).join('\n'),
  );
  const commentImages = comments.flatMap((comment) =>
    comment.attachments
      .filter((attachment) => attachment.isImage && attachment.status === 'available')
      .map((attachment) => attachment.id),
  );
  return [...new Set([...ticketImages, ...commentImages])];
}
