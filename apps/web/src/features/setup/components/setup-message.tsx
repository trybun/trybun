import { Button } from '@trybun/ui/components/button';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

/** The sign-in after the wizard returns to the getting-started checklist (§15.6). */
export const SIGN_IN_HREF = `/sign-in?${new URLSearchParams({ callbackUrl: '/admin' }).toString()}`;

/** A state of the wizard without the form: invalid link, set up, account created. */
export function SetupMessage({
  title,
  children,
  signIn = false,
}: {
  title: string;
  children?: ReactNode;
  signIn?: boolean;
}) {
  const t = useTranslations('setup');
  return (
    <section aria-labelledby="setup-message-title" className="flex flex-col gap-4">
      <h2 id="setup-message-title" className="text-xl font-semibold">
        {title}
      </h2>
      {children !== undefined && <p className="text-muted-foreground">{children}</p>}
      {signIn && (
        <Button className="w-fit" render={<Link href={SIGN_IN_HREF} />} nativeButton={false}>
          {t('signIn')}
        </Button>
      )}
    </section>
  );
}
