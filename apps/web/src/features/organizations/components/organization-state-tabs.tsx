'use client';

import { type OrganizationState, organizationStateSchema } from '@trybun/contracts/organizations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@trybun/ui/components/tabs';
import { usePathname, useRouter } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { OrganizationList } from './organization-list.js';

/**
 * The Active and Archived tabs of the Organizations page; the tab is URL state (§18.5), so it can
 * be shared and survives a reload.
 */
export function OrganizationStateTabs({ state }: { state: OrganizationState }) {
  const t = useTranslations('organizations.tabs');
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Tabs
      value={state}
      onValueChange={(value) => {
        const next = organizationStateSchema.parse(value);
        router.replace(next === 'active' ? pathname : `${pathname}?state=${next}`);
      }}
    >
      <TabsList aria-label={t('label')}>
        {organizationStateSchema.options.map((value) => (
          <TabsTrigger key={value} value={value}>
            {t(value)}
          </TabsTrigger>
        ))}
      </TabsList>
      {organizationStateSchema.options.map((value) => (
        <TabsContent key={value} value={value} className="pt-4">
          {value === state && <OrganizationList state={value} />}
        </TabsContent>
      ))}
    </Tabs>
  );
}
