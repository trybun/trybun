import type { About } from '@trybun/contracts/administration';
import { getTranslations } from 'next-intl/server';

/** The license text in the repository of the release that is installed. */
function licenseHref(version: string): string {
  return `https://github.com/trybun/trybun/blob/v${version}/LICENSE`;
}

/** The "About" page of the Administrator panel (§15.4): the installed version and the license. */
export async function AboutDetails({ about }: { about: About }) {
  const t = await getTranslations('administration');
  return (
    <section aria-labelledby="about-title" className="flex flex-col gap-4">
      <h2 id="about-title" className="text-lg font-semibold">
        {t('about')}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-muted-foreground">{t('version')}</dt>
        <dd className="font-medium" data-testid="installed-version">
          {about.version}
        </dd>
        <dt className="text-muted-foreground">{t('license')}</dt>
        <dd>
          <a
            href={licenseHref(about.version)}
            className="font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t('licenseName')}
          </a>
        </dd>
      </dl>
    </section>
  );
}
