import { problemDetailsSchema } from '@trybun/contracts/problem-details';
import { ApiError } from './api-error-class.js';

// Import `ApiError` from here; only a module of the first load imports `api-error-class.ts` itself.
export { ApiError };

/** Statuses of a gateway or proxy in front of an API that is down (Caddy, §15.9). */
const UNAVAILABLE_STATUSES = new Set([502, 503, 504]);

/** A `Retry-After` of delay-seconds: one or more digits (RFC 9110, section 10.2.3). */
const DELAY_SECONDS = /^\d+$/;

/**
 * The longest wait read from delay-seconds: half of the 100 000 000 days a `Date` reaches after
 * 1970, so that the time to try again is always a date that can be shown.
 */
const MAX_SECONDS = (100_000_000 / 2) * 24 * 60 * 60;

/** Whether an error is the API's answer to more requests than the rate limit allows (§14.4). */
export function isRateLimited(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 429;
}

/** The `ApiError` of a failed response; a body that is not Problem Details keeps only its status. */
export async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => undefined);
  return apiErrorOf(response.status, body, response.headers);
}

/** The `ApiError` of a failed response whose body has already been parsed (`openapi-fetch`). */
export function apiErrorOf(status: number, body: unknown, headers?: Headers): ApiError {
  const retryAfterSeconds = retryAfterSecondsOf(headers?.get('Retry-After') ?? null);
  const problem = problemDetailsSchema.safeParse(body);
  if (problem.success) {
    return new ApiError(status, problem.data.code, problem.data.errors, retryAfterSeconds);
  }
  return new ApiError(
    status,
    UNAVAILABLE_STATUSES.has(status) ? 'server.unavailable' : 'server.internal_error',
    [],
    retryAfterSeconds,
  );
}

/**
 * The seconds a `Retry-After` header asks to wait: delay-seconds or an HTTP-date, a date in the
 * past being no wait (RFC 9110, section 10.2.3); `undefined` without the header or with a value
 * it does not allow.
 */
export function retryAfterSecondsOf(value: string | null, now = Date.now()): number | undefined {
  if (value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  if (DELAY_SECONDS.test(trimmed)) {
    const seconds = Number(trimmed);
    return seconds <= MAX_SECONDS ? seconds : undefined;
  }
  const date = httpDateOf(trimmed, now);
  return date === undefined ? undefined : Math.max(0, Math.ceil((date - now) / 1000));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The three formats of an HTTP-date, all in UTC; recipients accept each (RFC 9110, 5.6.7). */
const HTTP_DATE_FORMATS = [
  // IMF-fixdate, the one senders generate: `Sun, 06 Nov 1994 08:49:37 GMT`.
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (?<day>\d{2}) (?<month>[A-Z][a-z]{2}) (?<year>\d{4}) (?<time>\d{2}:\d{2}:\d{2}) GMT$/,
  // The obsolete RFC 850 format: `Sunday, 06-Nov-94 08:49:37 GMT`.
  /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (?<day>\d{2})-(?<month>[A-Z][a-z]{2})-(?<year>\d{2}) (?<time>\d{2}:\d{2}:\d{2}) GMT$/,
  // The obsolete asctime format: `Sun Nov  6 08:49:37 1994`.
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?<month>[A-Z][a-z]{2}) (?<day>[ \d]\d) (?<time>\d{2}:\d{2}:\d{2}) (?<year>\d{4})$/,
];

/**
 * The time of an HTTP-date (RFC 9110, section 5.6.7), or `undefined` for any other text –
 * `Date.parse` is not used, as it reads many other texts as dates. A two-digit year that would be
 * more than 50 years ahead of `now` is in the century before.
 */
function httpDateOf(value: string, now: number): number | undefined {
  const groups = HTTP_DATE_FORMATS.map((format) => format.exec(value)?.groups).find(Boolean);
  if (groups === undefined) {
    return undefined;
  }
  const { day = '', month = '', year = '', time = '' } = groups;
  const monthIndex = MONTHS.indexOf(month);
  const dayOfMonth = Number(day.trim());
  const [hours = 0, minutes = 0, seconds = 0] = time.split(':').map(Number);
  let fullYear = Number(year);
  if (year.length === 2) {
    const currentYear = new Date(now).getUTCFullYear();
    fullYear += Math.floor(currentYear / 100) * 100;
    if (fullYear > currentYear + 50) {
      fullYear -= 100;
    }
  }
  const date = Date.UTC(fullYear, monthIndex, dayOfMonth, hours, minutes, seconds);
  // No such month, day (`31 Feb`) or time (`25:00:00`); a leap second (`:60`) is allowed.
  const isValid =
    monthIndex >= 0 &&
    new Date(Date.UTC(fullYear, monthIndex, dayOfMonth)).getUTCDate() === dayOfMonth &&
    hours < 24 &&
    minutes < 60 &&
    seconds <= 60;
  return isValid ? date : undefined;
}
