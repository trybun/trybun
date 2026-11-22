import { buttonVariants } from '@trybun/ui/components/button';
import { useFormatter, useNow, useTranslations } from 'next-intl';

/** The heading level of the message, continuing the outline of the page around it. */
export type RateLimitedHeadingLevel = 1 | 2 | 3;

const HEADINGS = {
  1: { Heading: 'h1', className: 'text-2xl font-bold' },
  2: { Heading: 'h2', className: 'text-xl font-bold' },
  3: { Heading: 'h3', className: 'text-lg font-bold' },
} as const;

/**
 * The one presentation of a refusal with `429` (§14.4, §18.5): that the person sent too many
 * requests, when to try again from `Retry-After`, and **Reload page**, which opens `reloadHref`
 * again as a document request – an installed app has no reload button of the browser (Rule 9).
 * Without `reloadHref` it offers no action: the area it is shown in has its own, e.g. **Load more**
 * below a failed later page, which keeps the pages loaded (#434).
 * It has no `'use client'` and reads its texts with the hooks of `next-intl`, so the page's notice
 * of the server (`RateLimitedNotice`) and the notice of a refused query in the browser
 * (`RateLimitedAlert`) render the same wording and layout and cannot drift apart (Rule 12).
 */
export function RateLimitedMessage({
  retryAfterSeconds,
  headingLevel,
  reloadHref,
}: {
  retryAfterSeconds: number | undefined;
  headingLevel: RateLimitedHeadingLevel;
  reloadHref?: string;
}) {
  const t = useTranslations('rateLimited');
  const format = useFormatter();
  const now = useNow();
  const { Heading, className } = HEADINGS[headingLevel];
  return (
    <div className="flex max-w-lg flex-col items-start gap-3">
      <Heading className={className}>{t('title')}</Heading>
      <p className="text-muted-foreground">
        {retryAfterSeconds === undefined || retryAfterSeconds === 0
          ? t('text')
          : t('textWithWait', {
              wait: format.relativeTime(new Date(now.getTime() + retryAfterSeconds * 1000), now),
            })}
      </p>
      {/* A document request, not a client navigation, so that every read of the page is repeated. */}
      {reloadHref !== undefined && (
        <a href={reloadHref} className={buttonVariants()}>
          {t('reload')}
        </a>
      )}
    </div>
  );
}
