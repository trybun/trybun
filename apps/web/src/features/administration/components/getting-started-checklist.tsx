import type { GettingStartedItem } from '@trybun/contracts/administration';
import { Badge } from '@trybun/ui/components/badge';
import { CheckCircle2Icon, CircleIcon } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { helpHref } from '../../help/help-routes.js';
import { GETTING_STARTED_HELP } from '../help-pages.js';

/**
 * The getting-started checklist of the Administrator panel (§15.6): one card per item with its
 * state and the help page that explains it. The API ticks the items from the configuration.
 */
export async function GettingStartedChecklist({ items }: { items: GettingStartedItem[] }) {
  const t = await getTranslations('administration');
  const done = items.filter((item) => item.isDone).length;
  return (
    <section aria-labelledby="getting-started-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="getting-started-title" className="text-lg font-semibold">
          {t('gettingStarted')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {done === items.length ? t('allDone') : t('progress', { done, total: items.length })}
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
          >
            {item.isDone ? (
              <CheckCircle2Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
            ) : (
              <CircleIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">{t(`items.${item.id}.title`)}</h3>
                <Badge variant={item.isDone ? 'success' : 'outline'}>
                  {item.isDone ? t('done') : t('toDo')}
                </Badge>
                {item.isOptional && <Badge variant="secondary">{t('optional')}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{t(`items.${item.id}.description`)}</p>
              <Link
                href={helpHref(GETTING_STARTED_HELP[item.id])}
                className="flex min-h-11 w-fit items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none xl:pointer-fine:min-h-0"
              >
                {t('howTo')}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
