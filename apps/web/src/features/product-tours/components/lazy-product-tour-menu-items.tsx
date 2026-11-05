'use client';

import { lazy, Suspense } from 'react';

// The items render inside the help menu, which loads after the first paint; a client component
// imported by a server component would join the initial chunks with Base UI's Menu (§2.9, #72).
const ProductTourMenuItems = lazy(() =>
  import('./product-tour-menu-items.js').then((module) => ({
    default: module.ProductTourMenuItems,
  })),
);

/**
 * The tour items of the help menu, loaded with it after the first paint. Their own boundary keeps
 * the help button in the header while their code loads on the first opening of the menu (#184).
 */
export function LazyProductTourMenuItems() {
  return (
    <Suspense>
      <ProductTourMenuItems />
    </Suspense>
  );
}
