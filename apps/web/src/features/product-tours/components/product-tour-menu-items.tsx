'use client';

import { DropdownMenuItem } from '@trybun/ui/components/dropdown-menu';
import { MapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProductTours } from './product-tour-provider.js';

/** The items of the help menu that start the tours of the current view again (§2.4). */
export function ProductTourMenuItems() {
  const t = useTranslations('productTours');
  const { tours, start } = useProductTours();
  return tours.map((tour) => (
    <DropdownMenuItem key={tour.id} onClick={() => start(tour)}>
      <MapIcon aria-hidden />
      {t('take', { name: t(tour.nameKey) })}
    </DropdownMenuItem>
  ));
}
