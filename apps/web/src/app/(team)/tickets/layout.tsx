import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { LazyToaster } from '../../../features/app-shell/components/lazy-toaster.js';
import { pickClientMessages } from '../../../lib/i18n/messages.js';

/** The team ticket views, their texts in the browser (§18.5) and their toasts. */
export default async function TicketsLayout({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider messages={pickClientMessages(await getMessages(), 'tickets')}>
      {children}
      <LazyToaster />
    </NextIntlClientProvider>
  );
}
