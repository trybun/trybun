import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { LazyToaster } from '../../../features/app-shell/components/lazy-toaster.js';
import { pickClientMessages } from '../../../lib/i18n/messages.js';

/** The Account settings page, its texts in the browser (§18.5) and its toasts. */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider messages={pickClientMessages(await getMessages(), 'settings')}>
      {children}
      <LazyToaster />
    </NextIntlClientProvider>
  );
}
