import type { AttachmentStatus } from '@trybun/contracts/attachments';
import type { AttachmentState } from '@trybun/ui/components/attachment-list';

const STATES: Record<AttachmentStatus, AttachmentState> = {
  quarantine: 'checking',
  available: 'available',
  infected: 'infected',
  rejected: 'rejected',
};

/** The state a list shows for the status of an attachment (§13.3): `quarantine` is "Checking…". */
export function attachmentStateOf(status: AttachmentStatus): AttachmentState {
  return STATES[status];
}
