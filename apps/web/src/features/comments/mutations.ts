'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CommentResponse,
  CreateCommentDto,
  RedactCommentDto,
  UpdateCommentDto,
} from '@trybun/contracts/comments';
import type { RedactDescriptionDto } from '@trybun/contracts/content-revisions';
import type { TicketResponse } from '@trybun/contracts/tickets';
import { dataOf } from '../../lib/api-client/api-client.js';
import { browserApiClient } from '../../lib/api-client/browser-api-client.js';

/** The weak ETag of the version the person has seen (§17.2). */
function ifMatch(record: { version: number }) {
  return { 'If-Match': `W/"${record.version}"` };
}

/**
 * What a change of a comment does to the cache (§18.5): the ticket's timeline and the histories
 * are read again, and so is the ticket – a reply of the requester may change its status (§4.3),
 * and a refused change reads what the server holds. A change is never retried.
 */
function useRefreshComments() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['comments'] }),
      queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      queryClient.invalidateQueries({ queryKey: ['attachments'] }),
    ]);
}

/** Adds a comment or an internal note to a ticket (§6.1). */
export function useAddComment() {
  const refresh = useRefreshComments();
  return useMutation({
    mutationFn: ({ ticketId, input }: { ticketId: string; input: CreateCommentDto }) =>
      dataOf(
        browserApiClient.POST('/api/v1/tickets/{ticketId}/comments', {
          params: { path: { ticketId } },
          body: input,
        }),
      ),
    onSettled: refresh,
  });
}

/** Edits the person's own comment (§6.1). */
export function useUpdateComment() {
  const refresh = useRefreshComments();
  return useMutation({
    mutationFn: ({ comment, input }: { comment: CommentResponse; input: UpdateCommentDto }) =>
      dataOf(
        browserApiClient.PATCH('/api/v1/comments/{commentId}', {
          params: { path: { commentId: comment.id } },
          headers: ifMatch(comment),
          body: input,
        }),
      ),
    onSettled: refresh,
  });
}

/** Deletes a comment with its revisions and attachments (§6.1). */
export function useDeleteComment() {
  const refresh = useRefreshComments();
  return useMutation({
    mutationFn: ({ comment }: { comment: CommentResponse }) =>
      dataOf(
        browserApiClient.DELETE('/api/v1/comments/{commentId}', {
          params: { path: { commentId: comment.id } },
          headers: ifMatch(comment),
        }),
      ),
    onSettled: refresh,
  });
}

/** Redacts a comment: the current text is never kept (§6.1, S1-12 Q9). */
export function useRedactComment() {
  const refresh = useRefreshComments();
  return useMutation({
    mutationFn: ({ comment, input }: { comment: CommentResponse; input: RedactCommentDto }) =>
      dataOf(
        browserApiClient.POST('/api/v1/comments/{commentId}/redaction', {
          params: { path: { commentId: comment.id } },
          headers: ifMatch(comment),
          body: input,
        }),
      ),
    onSettled: refresh,
  });
}

/** Redacts a ticket's description (§6.1, S1-12 Q9). */
export function useRedactDescription() {
  const refresh = useRefreshComments();
  return useMutation({
    mutationFn: ({ ticket, input }: { ticket: TicketResponse; input: RedactDescriptionDto }) =>
      dataOf(
        browserApiClient.POST('/api/v1/tickets/{ticketId}/description-redaction', {
          params: { path: { ticketId: ticket.id } },
          headers: ifMatch(ticket),
          body: input,
        }),
      ),
    onSettled: refresh,
  });
}
