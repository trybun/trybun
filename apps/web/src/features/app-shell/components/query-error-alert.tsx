'use client';

import { isRateLimited } from '../../../lib/errors/api-error.js';
import { RateLimitedAlert } from './rate-limited-alert.js';
import type { RateLimitedHeadingLevel } from './rate-limited-message.js';

/**
 * The error of a failed read in the browser (§18.5), in place of what the query would show or
 * below the rows a list keeps: a refusal with `429` (`isRateLimited()`) as `RateLimitedAlert`, with
 * the wait of `Retry-After` and – unless `offersReload` is `false`, for a later page that **Load
 * more** tries again (#434) – **Reload page**; any other failure as `message`, the message of its
 * error code (from `useErrorMessage`) or the component's own (#433). `headingLevel` continues the
 * outline of the page around it. The component passes `message`, as the texts of `errors` are
 * provided by the layouts of the features, not of the shell (§18.5).
 */
export function QueryErrorAlert({
  error,
  headingLevel,
  offersReload = true,
  message,
}: {
  error: Error;
  headingLevel: RateLimitedHeadingLevel;
  offersReload?: boolean;
  /** The text of a failure other than a refusal. */
  message: string;
}) {
  if (isRateLimited(error)) {
    return (
      <RateLimitedAlert error={error} headingLevel={headingLevel} offersReload={offersReload} />
    );
  }
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
