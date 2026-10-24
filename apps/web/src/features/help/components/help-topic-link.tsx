import Link from 'next/link';
import { helpHref } from '../help-routes.js';

/** A link to a help page with its title and description. */
export function HelpTopicLink({
  slug,
  title,
  description,
}: {
  slug: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={helpHref(slug)}
      className="flex min-h-11 flex-col justify-center gap-0.5 rounded-lg px-3 py-2 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="font-medium">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </Link>
  );
}
