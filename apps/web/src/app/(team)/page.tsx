import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageTitle } from '../../features/app-shell/page-title.js';
import { requireSession } from '../../lib/auth/session.js';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('home');
  return pageTitle(t('title'));
}

/** The empty home page of Stage 0 inside the application shell. */
export default async function HomePage() {
  await requireSession();
  const t = await getTranslations('home');
  return <h1 className="text-2xl font-bold">{t('title')}</h1>;
}
