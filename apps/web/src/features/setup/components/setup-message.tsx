import { buttonVariants } from '@trybun/ui/components/button';
import { cn } from '@trybun/ui/lib/utils';
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
        // A link styled as a button: it navigates, so it keeps the role of a link.
        <Link href={SIGN_IN_HREF} className={cn(buttonVariants(), 'w-fit')}>
          {t('signIn')}
        </Link>
      )}
    </section>
  );
}
