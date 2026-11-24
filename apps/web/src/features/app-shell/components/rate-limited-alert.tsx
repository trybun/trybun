'use client';

import { usePathname, useSearchParams } from 'next/navigation.js';
import { useLocationHash } from '../../../lib/browser/use-location-hash.js';
import type { ApiError } from '../../../lib/errors/api-error.js';
import { type RateLimitedHeadingLevel, RateLimitedMessage } from './rate-limited-message.js';

/**
 * Shown by a client component in place of what its query would show when the browser's read is
 * refused with `429` (`isRateLimited()`, §18.5): the presentation of `RateLimitedNotice` with the
 * wait of `Retry-After` and **Reload page**, which opens the address of the page again. It
 * replaces only that area, so the rest of the page – the filters of a list – stays usable. It
 * appears after the page has loaded, so it is announced (`role="alert"`, WAI-ARIA). For a refused
 * later page of a list, shown above **Load more**, `offersReload={false}` leaves out **Reload
 * page**, which would drop the pages already loaded: **Load more** tries the page again (#434).
 * An address with a fragment – the token of an invitation link (ADR 0009) – is reloaded with
 * `location.reload()`, as a link to it would only scroll to the fragment, and a link without it
 * would lose the token (#433).
 */
export function RateLimitedAlert({
  error,
  headingLevel,
  offersReload = true,
}: {
  error: ApiError;
  headingLevel: RateLimitedHeadingLevel;
  offersReload?: boolean;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const hash = useLocationHash() ?? '';
  return (
    <div role="alert">
      <RateLimitedMessage
        retryAfterSeconds={error.retryAfterSeconds}
        headingLevel={headingLevel}
        {...(!offersReload
          ? {}
          : hash !== ''
            ? { onReload: () => window.location.reload() }
            : { reloadHref: search === '' ? pathname : `${pathname}?${search}` })}
      />
    </div>
  );
}
