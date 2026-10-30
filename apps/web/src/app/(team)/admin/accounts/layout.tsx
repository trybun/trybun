import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { LazyToaster } from '../../../../features/app-shell/components/lazy-toaster.js';
import { pickClientMessages } from '../../../../lib/i18n/messages.js';

/**
 * The Accounts page of the Administrator panel, its texts in the browser (§18.5) and its toasts
 * (e.g. "… is deactivated", "Link copied").
 */
export default async function AccountsLayout({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider messages={pickClientMessages(await getMessages(), 'accounts')}>
      {children}
      <LazyToaster />
    </NextIntlClientProvider>
  );
}
