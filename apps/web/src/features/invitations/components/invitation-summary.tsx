'use client';

import type { InvitationToAccept } from '@trybun/contracts/invitations';
import { Field, FieldDescription, FieldLabel } from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import { useFormatter, useTranslations } from 'next-intl';

/**
 * What the acceptance page shows of a valid link (ADR 0009): the invited address read-only – the
 * account keeps it, whatever the sign-in returns – the target, the inviting person and the expiry.
 */
export function InvitationSummary({ invitation }: { invitation: InvitationToAccept }) {
  const t = useTranslations('invitations.acceptance');
  const roles = useTranslations('invitations.roles');
  const format = useFormatter();
  const { target } = invitation;
  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel>{t('email')}</FieldLabel>
        <Input readOnly value={invitation.email} autoComplete="email" />
        <FieldDescription>{t('emailDescription')}</FieldDescription>
      </Field>
      <dl className="grid gap-x-4 gap-y-1 text-sm md:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">{t('target')}</dt>
        <dd className="font-medium break-words">
          {target.type === 'project'
            ? t('targetProject', { name: target.project.name, role: roles(target.role) })
            : target.type === 'organization'
              ? t('targetOrganization', { name: target.organization.name })
              : t('targetAdministrator')}
        </dd>
        <dt className="text-muted-foreground">{t('invitedBy')}</dt>
        <dd className="font-medium break-words">
          {invitation.invitedBy?.displayName ?? t('invitedByUnknown')}
        </dd>
        <dt className="text-muted-foreground">{t('expires')}</dt>
        <dd className="font-medium">
          {format.dateTime(new Date(invitation.expiresAt), {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </dd>
      </dl>
    </div>
  );
}
