import 'server-only';
import { getRequestConfig } from 'next-intl/server';
import { getRequestLocale } from './locale.js';
import { getWebMessages } from './messages.js';
import { getRequestTimeZone } from './time-zone-cookie.js';

/**
 * The texts, language and time zone of a request for next-intl (§13.1, §18.5), without a
 * language segment in the URL. Dates and times are shown in the time zone of the account, else in
 * the system default time zone.
 */
export default getRequestConfig(async () => {
  const [locale, timeZone] = await Promise.all([getRequestLocale(), getRequestTimeZone()]);
  return { locale, messages: getWebMessages(locale), timeZone };
});
