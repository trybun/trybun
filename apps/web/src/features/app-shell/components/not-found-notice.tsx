import { buttonVariants } from '@trybun/ui/components/button';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/** The home a not-found page leads back to: the side's root, or the index of the help. */
export type NotFoundHome = '/' | '/portal' | '/help';

/**
 * The page of an address that does not exist, shown by the `not-found.tsx` of a route group
 * instead of the untranslated 404 page of Next.js (§18.5, #401) – for `notFound()` and, through
 * `app/not-found.tsx`, for every unmatched address. One text covers a missing record and one the
 * person may not see, as the API answers both with `404` and they must stay indistinguishable
 * (§14.4). The link leads to the home of the side the page belongs to. A Server Component, as
 * Next.js sends every `not-found.tsx` with every page of its segment.
 *
 * Inside a route group it also sets the tab title as a `<title>` element, which React moves into
 * the `<head>` – as the 404 page of Next.js sets its own: a page that calls `notFound()` keeps the
 * metadata of its layouts, because Next.js reads the metadata of a `not-found.tsx` only for an
 * unmatched address. `app/not-found.tsx` handles those, so it exports `notFoundMetadata()` instead
 * (`withTabTitle={false}`), which keeps one `<title>` in the document.
 */
export async function NotFoundNotice({
  home,
  withTabTitle = true,
}: {
  home: NotFoundHome;
  withTabTitle?: boolean;
}) {
  const t = await getTranslations('notFoundPage');
  return (
    <div className="flex max-w-lg flex-col items-start gap-3">
      {withTabTitle && <title>{t('tabTitle')}</title>}
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('text')}</p>
      <Link href={home} className={buttonVariants()}>
        {home === '/help' ? t('helpHome') : t('home')}
      </Link>
    </div>
  );
}

/** The tab title of an unmatched address, the `generateMetadata` of `app/not-found.tsx`. */
export async function notFoundMetadata(): Promise<Metadata> {
  const t = await getTranslations('notFoundPage');
  return { title: t('tabTitle') };
}
