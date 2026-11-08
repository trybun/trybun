import 'server-only';
import { isLocale } from '@trybun/i18n/catalogues';
import { getRequestConfig } from 'next-intl/server';
import { getRequestLocale } from './locale.js';
import { getWebMessages } from './messages.js';
import { getRequestTimeZone } from './time-zone-cookie.js';

/**
 * The texts, language and time zone of a request for next-intl (§13.1, §18.5), without a
 * language segment in the URL. Dates and times are shown in the time zone of the account, else in
 * the system default time zone. A language passed explicitly – `getTranslations({ locale })`, e.g.
 * the account language of the ticket templates (S1-10 Q4) – takes the place of the request's.
 */
export default getRequestConfig(async ({ locale: requested }) => {
  const [locale, timeZone] = await Promise.all([
    isLocale(requested) ? requested : getRequestLocale(),
    getRequestTimeZone(),
  ]);
  return { locale, messages: getWebMessages(locale), timeZone };
});
