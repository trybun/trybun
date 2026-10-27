import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AdministrationNavigation } from '../../../features/administration/components/administration-navigation.js';
import { pickClientMessages } from '../../../lib/i18n/messages.js';

/** The Administrator panel (§15.6); each page asks the API, which answers others with `404`. */
export default async function AdministrationLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('administration');
  return (
    <NextIntlClientProvider messages={pickClientMessages(await getMessages(), 'administration')}>
      <div className="flex max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <AdministrationNavigation />
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
