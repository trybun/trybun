'use client';

import { type ComponentProps, lazy, Suspense } from 'react';
import type { TicketFilterPanel as TicketFilterPanelType } from './ticket-filter-panel.js';

// The panel opens only when the person filters, so its code loads then (§18.5).
const TicketFilterPanel = lazy(() =>
  import('./ticket-filter-panel.js').then((module) => ({ default: module.TicketFilterPanel })),
);

/** The filter panel of the ticket list, loaded when it is first rendered. */
export function LazyTicketFilterPanel(props: ComponentProps<typeof TicketFilterPanelType>) {
  return (
    <Suspense>
      <TicketFilterPanel {...props} />
    </Suspense>
  );
}
