import { getLocale, getTranslations } from 'next-intl/server';
import { HelpSearch } from '../../../features/help/components/help-search.js';
import { HelpTopics } from '../../../features/help/components/help-topics.js';
import { getHelpPages, getHelpSearchIndex } from '../../../features/help/help-content.js';
import { getHelpReaderKind } from '../../../features/help/reader.js';
import { requireSession } from '../../../lib/auth/session.js';

/** The help index (§2.3): the search and every help page the reader receives. */
export default async function HelpPage() {
  await requireSession('/help');
  const [locale, kind, t] = await Promise.all([
    getLocale(),
    getHelpReaderKind(),
    getTranslations('help'),
  ]);
  return (
    <div className="flex max-w-prose flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <HelpSearch index={getHelpSearchIndex(locale, kind)}>
        <HelpTopics pages={getHelpPages(locale, kind)} />
      </HelpSearch>
    </div>
  );
}
