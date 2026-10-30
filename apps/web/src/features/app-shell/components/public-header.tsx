import Image from 'next/image';
import { useTranslations } from 'next-intl';

/**
 * The header of the public pages outside the application shell, e.g. the acceptance of an
 * invitation: the brand only, like the login screen of Keycloak that follows it – these pages
 * need no session, so there is no user menu.
 */
export function PublicHeader() {
  const t = useTranslations('app');
  return (
    <header className="flex h-14 items-center gap-2 border-b border-border bg-background px-3 md:px-5">
      <Image src="/icons/trybun-icon.svg" alt="" width={32} height={32} unoptimized priority />
      <span className="text-lg font-extrabold lowercase">{t('title')}</span>
    </header>
  );
}
