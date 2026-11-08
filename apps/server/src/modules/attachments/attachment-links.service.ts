import { accessibleBy } from '@casl/prisma/runtime';
import { Injectable } from '@nestjs/common';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import type { Transaction } from '../../platform/database/prisma.service.js';
import { ATTACHMENT } from './attachments.abilities.js';
import { linkFailure } from './domain/linking.js';

/** A draft linked to a ticket, as the activity events of the link name it. */
export interface LinkedDraft {
  id: string;
  fileName: string;
}

/**
 * Links drafts to tickets in the transaction of another use case (§3.2, Q4): adding attachments
 * to a ticket and creating a ticket. A module of its own, so the tickets module – also in the
 * Worker – uses it without the endpoints and the storage of the attachments module (§18.3).
 */
@Injectable()
export class AttachmentLinksService {
  constructor(private readonly abilities: AbilityFactory) {}

  /**
   * Links the principal's own drafts to a ticket in the caller's transaction (§3.2, Q4, Q11), in
   * the order of the request; a repeated ID is linked once. Any status can be linked. One update
   * on the principal's unlinked drafts links them, so a concurrent link or purge never succeeds
   * together with it (ADR 0008); when it misses an ID, the caller's transaction is rolled back and
   * the IDs are classified – `404` for an ID the principal cannot read, else
   * `422 attachment.already_linked` at its pointer. The caller has checked that the principal may
   * add attachments to the ticket; no activity event is written.
   */
  async linkDrafts(
    tx: Transaction,
    principal: UserPrincipal,
    ticketId: string,
    attachmentIds: readonly string[],
  ): Promise<LinkedDraft[]> {
    const ids = [...new Set(attachmentIds)];
    if (ids.length === 0) {
      return [];
    }
    const linked = await tx.attachment.updateManyAndReturn({
      where: { id: { in: ids }, uploadedById: principal.userId, ticketId: null },
      data: { ticketId },
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
}
