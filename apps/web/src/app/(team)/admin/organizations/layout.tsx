import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { LazyToaster } from '../../../../features/app-shell/components/lazy-toaster.js';
import { pickClientMessages } from '../../../../lib/i18n/messages.js';

/**
 * The organization views of the Administrator panel, their texts in the browser (§18.5) and their
 * toasts (e.g. "Organization archived" with Undo), mounted here as in the project views.
 */
export default async function OrganizationsLayout({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider messages={pickClientMessages(await getMessages(), 'organizations')}>
      {children}
      <LazyToaster />
    </NextIntlClientProvider>
  );
}
