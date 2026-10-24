import { Markdown } from '@trybun/ui/components/markdown';
import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { HelpPage } from '../help-content.js';
import { HELP_PATH, resolveHelpLink } from '../help-routes.js';

/** A help page (§2.3): its title, description and Markdown body, with a link to all topics. */
export function HelpArticle({ page }: { page: HelpPage }) {
  const t = useTranslations('help');
  return (
    <article className="flex max-w-prose flex-col gap-4">
      <Link
        href={HELP_PATH}
        className="-ml-2 flex min-h-11 w-fit items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        {t('allTopics')}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{page.title}</h1>
        <p className="text-muted-foreground">{page.description}</p>
      </header>
      <Markdown urlTransform={(url) => resolveHelpLink(url, page.slug)}>{page.body}</Markdown>
    </article>
  );
}
