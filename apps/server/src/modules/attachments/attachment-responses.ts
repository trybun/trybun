import { subject } from '@casl/ability';
import { type Attachment, attachmentActionSchema } from '@trybun/contracts/attachments';
import type { Prisma } from '../../generated/prisma/client.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import type { AppAbility } from '../../platform/authorization/ability-factory.js';
import { identitySelect, visiblePerson } from '../users/visible-person.js';
import { ATTACHMENT, attachmentRuleSelect } from './attachments.abilities.js';
import { isRasterImage } from './domain/allowlist.js';

/** The fields of an attachment response and of its rules (§18.3). */
export function attachmentSelect(principal: UserPrincipal) {
  return {
    ...attachmentRuleSelect(principal),
    fileName: true,
    contentType: true,
    size: true,
    status: true,
    createdAt: true,
    uploadedBy: { select: identitySelect(principal) },
  } satisfies Prisma.AttachmentSelect;
}

export type AttachmentRow = Prisma.AttachmentGetPayload<{
  select: ReturnType<typeof attachmentSelect>;
}>;

/**
 * The response shape of an attachment (§18.3) with the actions the principal may perform; its
 * uploader under the identity rule (§5.4, S1-11 Q9), so a customer of another organization who
 * reads a shared ticket sees "Customer" for its files too.
 */
export function toAttachmentResponse(
  row: AttachmentRow,
  ability: AppAbility,
  principal: UserPrincipal,
): Attachment {
  const record = subject(ATTACHMENT, row);
  return {
    id: row.id,
    fileName: row.fileName,
    contentType: row.contentType,
    size: row.size,
    isImage: isRasterImage(row.contentType),
    status: row.status,
    ticketId: row.ticketId,
    commentId: row.commentId,
    uploadedBy: visiblePerson(principal, row.uploadedBy),
    createdAt: row.createdAt.toISOString(),
    allowedActions: attachmentActionSchema.options.filter((action) => ability.can(action, record)),
  };
}
