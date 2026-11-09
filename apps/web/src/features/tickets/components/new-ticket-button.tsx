import { buttonVariants } from '@trybun/ui/components/button';
import { cn } from '@trybun/ui/lib/utils';
import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { newTicketHref } from '../hrefs.js';

/**
 * **New ticket** in the header of the team (S1-10 Q7), for every team account – the form says
 * when no project allows a ticket, so the header asks the API nothing. A link rendered on the
 * server: on phones an icon with the name "New ticket" and a 44 px target, the text from the
 * tablet width on. No keyboard shortcut until the command palette (§8.4).
 */
export function NewTicketButton() {
  const t = useTranslations('appShell');
  return (
    <Link
      href={newTicketHref()}
      className={cn(buttonVariants(), 'mr-1 w-11 px-0 md:w-auto md:px-3')}
    >
      <PlusIcon aria-hidden />
      <span className="sr-only md:not-sr-only">{t('newTicket')}</span>
    </Link>
  );
}
