'use client';

import { lazy } from 'react';

// The items render inside the help menu, which loads after the first paint; a client component
// imported by a server component would join the initial chunks with Base UI's Menu (§2.9, #72).
const ProductTourMenuItems = lazy(() =>
  import('./product-tour-menu-items.js').then((module) => ({
    default: module.ProductTourMenuItems,
  })),
);

/** The tour items of the help menu, loaded with it after the first paint. */
export function LazyProductTourMenuItems() {
  return <ProductTourMenuItems />;
}
