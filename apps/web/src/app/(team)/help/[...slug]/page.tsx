import { notFound } from 'next/navigation.js';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { HelpArticle } from '../../../../features/help/components/help-article.js';
import { getHelpPage } from '../../../../features/help/help-content.js';
import { getHelpReaderKind } from '../../../../features/help/reader.js';
import { requireSession } from '../../../../lib/auth/session.js';

// `<audience>/<category>/<name>` of a page of `docs/user` (§2.3).
const paramsSchema = z.object({
  slug: z.array(z.string().regex(/^[a-z0-9-]+$/)).length(3),
});

/**
 * A help page (§2.3). A page that does not exist or is not written for the reader's account kind
 * is not found, so an end user never receives a page for the team.
 */
export default async function HelpTopicPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    notFound();
  }
  const slug = parsed.data.slug.join('/');
  await requireSession(`/help/${slug}`);
  const [locale, kind] = await Promise.all([getLocale(), getHelpReaderKind()]);
  const page = getHelpPage(locale, kind, slug);
  if (page === undefined) {
    notFound();
  }
  return <HelpArticle page={page} />;
}
