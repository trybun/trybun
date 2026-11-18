import { getFormatter, getNow, getTranslations } from 'next-intl/server';
import type { ApiError } from '../../../lib/errors/api-error.js';

/**
 * Shown by a page instead of its content when the API answers its read with `429` (§14.4): the
 * person learns that they sent too many requests and, from `Retry-After`, when to try again –
 * never the not-found page, which would say that the page or the permission is gone (#356). A
 * Server Component renders it itself, because an expected error that reaches `error.tsx` arrives
 * there without its code in production. The heading continues the page's outline: `2` inside a
 * layout that has the `h1` (the Administrator panel).
 */
export async function RateLimitedNotice({
  error,
  headingLevel = 1,
}: {
  error: ApiError;
  headingLevel?: 1 | 2;
}) {
  const [t, format, now] = await Promise.all([
    getTranslations('rateLimited'),
    getFormatter(),
    getNow(),
  ]);
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const { retryAfterSeconds } = error;
  return (
    <div className="flex max-w-lg flex-col items-start gap-3">
      <Heading className={headingLevel === 1 ? 'text-2xl font-bold' : 'text-xl font-bold'}>
        {t('title')}
      </Heading>
      <p className="text-muted-foreground">
        {retryAfterSeconds === undefined || retryAfterSeconds === 0
          ? t('text')
          : t('textWithWait', {
              wait: format.relativeTime(new Date(now.getTime() + retryAfterSeconds * 1000), now),
            })}
      </p>
    </div>
  );
}
