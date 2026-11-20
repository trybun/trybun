import 'server-only';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/**
 * The translated tab title of a page (§13.4, ADR 0015): its parts from the most specific – what
 * the page shows – to the record or section it belongs to, followed by the brand, e.g.
 * "Project settings – Website – Trybun". `app.titlePart` joins two parts, so the translators own
 * the separator. A record value is a message argument, inserted as typed: `title.absolute` keeps
 * `title.template` of Next.js away from it, which reads `$&` and `$'` as replacement patterns.
 */
export async function pageTitle(...parts: string[]): Promise<Metadata> {
  const t = await getTranslations('app');
  const absolute = parts.reduceRight((rest, part) => t('titlePart', { part, rest }), t('title'));
  return { title: { absolute } };
}
