import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { pickClientMessages } from '../../../../lib/i18n/messages.js';

/** The Account settings page of end users and its texts in the browser (§18.5); the portal shows its toasts. */
export default async function PortalSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider messages={pickClientMessages(await getMessages(), 'settings')}>
      {children}
    </NextIntlClientProvider>
  );
}
