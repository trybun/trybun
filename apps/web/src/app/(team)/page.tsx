import { getTranslations } from 'next-intl/server';
import { requireSession } from '../../lib/auth/session.js';

/** The empty home page of Stage 0 inside the application shell. */
export default async function HomePage() {
  await requireSession();
  const t = await getTranslations('home');
  return <h1 className="text-2xl font-bold">{t('title')}</h1>;
}
