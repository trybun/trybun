'use client';

import { Button } from '@trybun/ui/components/button';
import { Field, FieldDescription, FieldLabel } from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import { toast } from '@trybun/ui/components/toast';
import { CopyIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

/**
 * The link of a new or resent invitation with **Copy link** (§7.4). Only the hash of its token is
 * stored, so the link is shown only now; the note says that this link alone works and when it
 * expires.
 */
export function InvitationLink({ link, expiresAt }: { link: string; expiresAt: string }) {
  const t = useTranslations('invitations.link');
  const format = useFormatter();

  const copy = () =>
    navigator.clipboard.writeText(link).then(
      () => toast.add({ title: t('copied'), type: 'success' }),
      () => toast.add({ title: t('copyFailed'), type: 'error' }),
    );

  return (
    <Field>
      <FieldLabel>{t('label')}</FieldLabel>
      <div className="flex flex-col gap-2 md:flex-row">
        <Input
          readOnly
          value={link}
          className="font-mono"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button type="button" className="md:w-fit" onClick={() => void copy()}>
          <CopyIcon aria-hidden />
          {t('copy')}
        </Button>
      </div>
      <FieldDescription>
        {t('note', {
          date: format.dateTime(new Date(expiresAt), { dateStyle: 'medium', timeStyle: 'short' }),
        })}
      </FieldDescription>
    </Field>
  );
}
