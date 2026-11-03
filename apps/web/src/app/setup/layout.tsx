import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { pickClientMessages } from '../../lib/i18n/messages.js';

/** The texts of the first-run wizard in the browser (§18.5). */
export default async function SetupLayout({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider messages={pickClientMessages(await getMessages(), 'setup')}>
      {children}
    </NextIntlClientProvider>
  );
}
