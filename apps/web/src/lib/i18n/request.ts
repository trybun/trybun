import 'server-only';
import { getRequestConfig } from 'next-intl/server';
import { getEnv } from '../env/env.js';
import { getRequestLocale } from './locale.js';
import { getWebMessages } from './messages.js';

/**
 * The texts, language and time zone of a request for next-intl (§13.1, §18.5), without a
 * language segment in the URL. Dates and times are shown in the system default time zone until
 * the account settings provide the user's own.
 */
export default getRequestConfig(async () => {
  const locale = await getRequestLocale();
  return { locale, messages: getWebMessages(locale), timeZone: getEnv().defaultTimeZone };
});
