'use client';

import { type ProjectState, projectStateSchema } from '@trybun/contracts/projects';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@trybun/ui/components/tabs';
import { usePathname, useRouter } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { ProjectList } from './project-list.js';

/**
 * The Active and Archived tabs of the Projects page; the tab is URL state (§18.5), so it can be
 * shared and survives a reload.
 */
export function ProjectStateTabs({ state }: { state: ProjectState }) {
  const t = useTranslations('projects');
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Tabs
      value={state}
      onValueChange={(value) => {
        const next = projectStateSchema.parse(value);
        router.replace(next === 'active' ? pathname : `${pathname}?state=${next}`);
      }}
    >
      <TabsList aria-label={t('tabs.label')}>
        {projectStateSchema.options.map((value) => (
          <TabsTrigger key={value} value={value}>
            {t(`tabs.${value}`)}
          </TabsTrigger>
        ))}
      </TabsList>
      {projectStateSchema.options.map((value) => (
        <TabsContent key={value} value={value} className="pt-4">
          {value === state && <ProjectList state={value} />}
        </TabsContent>
      ))}
    </Tabs>
  );
}
