import { cn } from 'cn';
import type { ComponentProps } from 'react';
import ReactMarkdown, { defaultUrlTransform, type UrlTransform } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

// GitHub Flavored Markdown with the elements styled by the design tokens (§14.2). The HTML is
// sanitized with GitHub's schema, so raw HTML in the source never runs (§13.5).
const ELEMENT_STYLES = [
  '[&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold',
  '[&_h3]:mt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:font-semibold',
  '[&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1 [&_ol]:pl-6',
  '[&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-6',
  '[&_a]:rounded-sm [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:focus-visible:ring-3 [&_a]:focus-visible:ring-ring [&_a]:focus-visible:outline-none',
  '[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
  '[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm',
  '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-sm [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm',
  '[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold',
  '[&_hr]:border-border',
];

interface MarkdownProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** The Markdown source (GFM). */
  children: string;
  /** Changes the target of every link and image, e.g. to resolve relative links. */
  urlTransform?: UrlTransform;
}

/** Rendered GitHub Flavored Markdown, e.g. a help page or a comment (§14.2). */
function Markdown({ children, className, urlTransform, ...props }: MarkdownProps) {
  return (
    <div
      data-slot="markdown"
      className={cn('flex flex-col gap-3 leading-relaxed break-words', ELEMENT_STYLES, className)}
      {...props}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        // The project's transform runs after the default one, which removes unsafe protocols.
        urlTransform={(url, key, node) => {
          const safe = defaultUrlTransform(url);
          return urlTransform === undefined ? safe : urlTransform(safe, key, node);
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export { Markdown };
export type { MarkdownProps };
