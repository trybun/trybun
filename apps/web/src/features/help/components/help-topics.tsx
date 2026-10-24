import { useTranslations } from 'next-intl';
import { HELP_AUDIENCES, HELP_CATEGORIES } from '../audiences.js';
import type { HelpPage } from '../help-content.js';
import { HelpTopicLink } from './help-topic-link.js';

/**
 * Every help page of the reader, grouped by audience and by Diátaxis category (§2.3); the
 * audiences are named only when the reader receives more than one.
 */
export function HelpTopics({ pages }: { pages: readonly HelpPage[] }) {
  const t = useTranslations('help');
  const audiences = HELP_AUDIENCES.filter((audience) =>
    pages.some((page) => page.audience === audience),
  );
  return (
    <div className="flex flex-col gap-8">
      {audiences.map((audience) => (
        <section
          key={audience}
          className="flex flex-col gap-4"
          aria-labelledby={`help-${audience}`}
        >
          <h2
            id={`help-${audience}`}
            className={audiences.length > 1 ? 'text-xl font-bold' : 'sr-only'}
          >
            {t(`audiences.${audience}`)}
          </h2>
          {HELP_CATEGORIES.map((category) => {
            const topics = pages.filter(
              (page) => page.audience === audience && page.category === category,
            );
            return (
              topics.length > 0 && (
                <div key={category} className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {t(`categories.${category}`)}
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {topics.map((page) => (
                      <li key={page.slug}>
                        <HelpTopicLink
                          slug={page.slug}
                          title={page.title}
                          description={page.description}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            );
          })}
        </section>
      ))}
    </div>
  );
}
