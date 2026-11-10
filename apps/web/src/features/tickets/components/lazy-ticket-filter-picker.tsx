'use client';

import { type ComponentProps, lazy, Suspense } from 'react';
import type { TicketFilterPicker as TicketFilterPickerType } from './ticket-filter-picker.js';

// A picker opens only when the person filters, so its code loads then (§18.5).
const TicketFilterPicker = lazy(() =>
  import('./ticket-filter-picker.js').then((module) => ({ default: module.TicketFilterPicker })),
);

/** The picker of one filter of the ticket list, loaded when it is first rendered. */
export function LazyTicketFilterPicker(props: ComponentProps<typeof TicketFilterPickerType>) {
  return (
    <Suspense>
      <TicketFilterPicker {...props} />
    </Suspense>
  );
}
