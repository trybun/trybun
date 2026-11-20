'use client';

import { Button } from '@trybun/ui/components/button';
import { useTranslations } from 'next-intl';

/**
 * The page of an unexpected error, shown by the `error.tsx` of a route group instead of the
 * untranslated error page of Next.js (§18.5, #382). It cannot name the cause: in production
 * `error.tsx` receives the errors of Server Components without their message or code, only a
 * `digest`. An expected error is shown by the page itself – a `429` as `RateLimitedNotice`, a
 * `404` as the not-found page. **Try again** renders the route again with fresh data from the
 * server (`retry` of `error.tsx`), as the cause can be temporary.
 */
export function ErrorNotice({ retry }: { retry: () => void }) {
  const t = useTranslations('errorPage');
  return (
    <div className="flex max-w-lg flex-col items-start gap-3">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('text')}</p>
      <Button onClick={retry}>{t('tryAgain')}</Button>
    </div>
  );
}
