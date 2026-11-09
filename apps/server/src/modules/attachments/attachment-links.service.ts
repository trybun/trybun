import { accessibleBy } from '@casl/prisma/runtime';
import { Injectable } from '@nestjs/common';
import type { Attachment } from '@trybun/contracts/attachments';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AbilityFactory, type AppAbility } from '../../platform/authorization/ability-factory.js';
import type { Transaction } from '../../platform/database/prisma.service.js';
import { OutboxService } from '../../platform/outbox/outbox.service.js';
import { attachmentSelect, toAttachmentResponse } from './attachment-responses.js';
import { ATTACHMENT, DRAFT } from './attachments.abilities.js';
import { ATTACHMENT_DELETED, type AttachmentDeletedPayload } from './attachments.events.js';
import { linkFailure } from './domain/linking.js';

/** The parent a draft is linked to: a ticket or a comment (S1-12 Q16). */
export type AttachmentParent = { ticketId: string } | { commentId: string };

/** A draft linked to a ticket, as the activity events of the link name it. */
export interface LinkedDraft {
  id: string;
  fileName: string;
}

/**
 * Links drafts to tickets and comments in the transaction of another use case (§3.2, Q4): adding
 * attachments to a ticket, creating a ticket, and writing or editing a comment (S1-12). A module of its own, so the tickets module – also in the
 * Worker – uses it without the endpoints and the storage of the attachments module (§18.3).
 */
@Injectable()
export class AttachmentLinksService {
  constructor(
    private readonly abilities: AbilityFactory,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Deletes the attachments of a comment with it, in the caller's transaction (§13.3, S1-12): the
   * rows go now, their objects through `attachment.deleted` after the commit, as for any deleted
   * attachment (ADR 0008). No activity event: `comment_deleted` covers the comment.
   */
  async deleteOfComment(tx: Transaction, commentId: string): Promise<void> {
    const rows = await tx.attachment.findMany({ where: { commentId }, select: { id: true } });
    if (rows.length === 0) {
      return;
    }
    await tx.attachment.deleteMany({ where: { commentId } });
    for (const { id } of rows) {
      const payload = { attachmentId: id } satisfies AttachmentDeletedPayload;
      await this.outbox.add(tx, { type: ATTACHMENT_DELETED, payload });
    }
  }

  /**
   * Links the principal's own drafts to a ticket or a comment in the caller's transaction (§3.2, Q4, Q11), in
   * the order of the request; a repeated ID is linked once. Any status can be linked. One update
   * on the principal's unlinked drafts links them, so a concurrent link or purge never succeeds
   * together with it (ADR 0008); when it misses an ID, the caller's transaction is rolled back and
   * the IDs are classified – `404` for an ID the principal cannot read, else
   * `422 attachment.already_linked` at its pointer. The caller has checked that the principal may
   * add attachments to the parent; no activity event is written.
   */
  async linkDrafts(
    tx: Transaction,
    principal: UserPrincipal,
    parent: AttachmentParent,
    attachmentIds: readonly string[],
  ): Promise<LinkedDraft[]> {
    const ids = [...new Set(attachmentIds)];
    if (ids.length === 0) {
      return [];
    }
    const linked = await tx.attachment.updateManyAndReturn({
      where: { id: { in: ids }, uploadedById: principal.userId, ...DRAFT },
      data: parent,
      select: { id: true, fileName: true },
    });
    if (linked.length === ids.length) {
      const byId = new Map(linked.map((row) => [row.id, row]));
      return ids.flatMap((id) => byId.get(id) ?? []);
    }
    const linkedIds = new Set(linked.map(({ id }) => id));
    // The rows this update linked are left out: the others are as other transactions left them.
    const readable = await tx.attachment.findMany({
      where: {
        AND: [
          accessibleBy(this.abilities.forPrincipal(principal), 'read').ofType(ATTACHMENT),
          { id: { in: ids.filter((id) => !linkedIds.has(id)) } },
        ],
      },
      select: { id: true },
    });
    throw linkFailure(attachmentIds, linkedIds, new Set(readable.map(({ id }) => id)));
  }

  /**
   * The attachments of comments a principal reads (§13.3, S1-12 Q16), by comment and oldest first:
   * returned with their comments, never in the ticket's attachment list. The read filter of the
   * ability applies, so an attachment follows the kind and the audience of its comment.
   */
  async ofComments(
    db: Transaction,
    principal: UserPrincipal,
    ability: AppAbility,
    commentIds: readonly string[],
  ): Promise<Map<string, Attachment[]>> {
    const byComment = new Map<string, Attachment[]>();
    if (commentIds.length === 0) {
      return byComment;
    }
    const rows = await db.attachment.findMany({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType(ATTACHMENT),
          { commentId: { in: [...commentIds] } },
        ],
      },
      select: attachmentSelect(principal),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    for (const row of rows) {
      if (row.commentId !== null) {
        const list = byComment.get(row.commentId) ?? [];
        list.push(toAttachmentResponse(row, ability, principal));
        byComment.set(row.commentId, list);
      }
    }
    return byComment;
  }
}
