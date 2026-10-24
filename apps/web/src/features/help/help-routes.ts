/** The address of the help index, where every page of the reader is listed and searched. */
export const HELP_PATH = '/help';

/** The address of a help page, or of the help index without one. */
export function helpHref(slug?: string): string {
  return slug === undefined ? HELP_PATH : `${HELP_PATH}/${slug}`;
}

/** Whether a route of a view matches a path; a segment in square brackets matches any value. */
function matchesView(view: string, pathname: string): boolean {
  const viewSegments = view.split('/');
  const pathSegments = pathname.split('/');
  return (
    viewSegments.length === pathSegments.length &&
    viewSegments.every(
      (segment, index) =>
        segment === pathSegments[index] || (segment.startsWith('[') && segment.endsWith(']')),
    )
  );
}

/**
 * The help page of the view of a path (§2.3): the page of the exact route, else of a route with
 * parameters; `undefined` for a view without contextual help.
 * @param views route of a view → address of its help page
 */
export function helpPageOfPath(
  views: Readonly<Record<string, string>>,
  pathname: string,
): string | undefined {
  return (
    views[pathname] ?? Object.entries(views).find(([view]) => matchesView(view, pathname))?.[1]
  );
}

/**
 * The target of a link in a help page: a relative link to another Markdown page becomes the
 * address of that page, so links work both on GitHub and in the application.
 * @param slug the address of the page that contains the link
 */
export function resolveHelpLink(url: string, slug: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('/') || url.startsWith('#')) {
    return url;
  }
  const base = new URL(`${helpHref(slug)}.md`, 'https://help.invalid');
  const target = new URL(url, base);
  if (!target.pathname.endsWith('.md')) {
    return url;
  }
  return `${target.pathname.slice(0, -'.md'.length)}${target.hash}`;
}
