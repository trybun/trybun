'use client';

import type { InvitationPreview } from '@trybun/contracts/invitations';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '../../../lib/errors/error-message.js';

/**
 * The line under an invitation form that says what sending will do, as the API decides it (§7.4):
 * an invitation link, perhaps joining the organization of the address's domain (§7.3), the
 * access granted directly, or the reason of a refusal.
 */
export function InvitationPreviewLine({
  preview,
  error,
  isChecking,
}: {
  preview: InvitationPreview | undefined;
  error: unknown;
  isChecking: boolean;
}) {
  const t = useTranslations('invitations.preview');
  const errorMessage = useErrorMessage();
  if (error !== null && error !== undefined) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(error)}
      </p>
    );
  }
  if (isChecking) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t('checking')}
      </p>
    );
  }
  if (preview === undefined) {
    return null;
  }
  return (
    <p role="status" className="text-sm font-medium">
      {preview.outcome === 'grant'
        ? t('grant')
        : preview.organization === null
          ? t('invite')
          : t('join', { name: preview.organization.name })}
    </p>
  );
}
