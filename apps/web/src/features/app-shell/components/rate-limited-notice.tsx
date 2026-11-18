import { buttonVariants } from '@trybun/ui/components/button';
import { headers } from 'next/headers.js';
import { getFormatter, getNow, getTranslations } from 'next-intl/server';
import { callbackPathOf, REQUEST_PATH_HEADER } from '../../../lib/auth/callback-path.js';
import type { ApiError } from '../../../lib/errors/api-error.js';

/**
 * Shown instead of a page's content when the API answers with `429` (§14.4): the person learns
 * that they sent too many requests and, from `Retry-After`, when to try again – never the
 * not-found page, which would say that the page or the permission is gone (#356). Server
 * Components render it themselves, because an error that reaches `error.tsx` arrives there without
 * its code in production (§18.5). **Reload page** opens the same address again, as an installed
 * app has no reload button of the browser (Rule 9). The heading continues the outline of the
 * page: `2` inside a layout that has the `h1` (the Administrator panel).
 */
export async function RateLimitedNotice({
  error,
  headingLevel = 1,
}: {
  error: ApiError;
  headingLevel?: 1 | 2;
}) {
  const [t, format, now, requestHeaders] = await Promise.all([
    getTranslations('rateLimited'),
    getFormatter(),
    getNow(),
    headers(),
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
      {/* A document request, not a client navigation, so that every read of the page is repeated. */}
      <a
        href={callbackPathOf(requestHeaders.get(REQUEST_PATH_HEADER))}
        className={buttonVariants()}
      >
        {t('reload')}
      </a>
    </div>
  );
}
