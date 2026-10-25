import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { AdministrationNavigation } from '../../../features/administration/components/administration-navigation.js';

/** The Administrator panel (§15.6); each page asks the API, which answers others with `404`. */
export default async function AdministrationLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('administration');
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <AdministrationNavigation />
      {children}
    </div>
  );
}
