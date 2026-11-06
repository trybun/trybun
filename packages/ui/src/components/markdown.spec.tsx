import {
  ALLOWED_ATTACHMENT_ID,
  IMAGE_CASES,
  unsafeHtmlFindings,
  XSS_CASES,
} from '@trybun/markdown/testing';
import { prerender } from 'react-dom/static';
import { describe, expect, it } from 'vitest';
import { Markdown, type MarkdownProps } from './markdown.js';

// The web renderer runs the shared tables of @trybun/markdown (§6.2, §13.5), rendered as in a
// Server Component.
async function render(source: string, props: Partial<MarkdownProps> = {}): Promise<string> {
  const { prelude } = await prerender(<Markdown {...props}>{source}</Markdown>);
  return new Response(prelude).text();
}

describe('Markdown', () => {
  it.each(XSS_CASES)('removes the attack: $name', async ({ source }) => {
    expect(unsafeHtmlFindings(await render(source))).toEqual([]);
  });

  it.each(IMAGE_CASES)(
    'applies the image rule: $name',
    async ({ source, isImage, linkHref, text }) => {
      const html = await render(source, { attachmentImageIds: [ALLOWED_ATTACHMENT_ID] });
      expect(html.includes('<img')).toBe(isImage);
      if (linkHref !== undefined) {
        expect(html).toContain(`href="${linkHref}"`);
      }
      if (text !== undefined) {
        expect(html).toContain(text);
      }
    },
  );

  it('shows no image without allowed attachments', async () => {
    expect(await render(IMAGE_CASES[0]!.source)).not.toContain('<img');
  });

  it('highlights a code block with a language', async () => {
    const html = await render('```ts\nconst answer = 42;\n```');
    expect(html).toContain('class="hljs language-ts"');
    expect(html).toContain('<span class="hljs-keyword">const</span>');
  });

  it('leaves a code block without a language plain', async () => {
    expect(await render('```\nconst answer = 42;\n```')).not.toContain('hljs-keyword');
  });

  it('adds rel to links to other sites only', async () => {
    const html = await render('[a](https://example.com) [b](/projects)');
    expect(html).toContain(
      '<a href="https://example.com" rel="nofollow ugc noopener noreferrer">a</a>',
    );
    expect(html).toContain('<a href="/projects">b</a>');
  });

  it('applies the transform of the application after the rules', async () => {
    const html = await render('[page](../a.md)', { urlTransform: (url) => `/help/${url}` });
    expect(html).toContain('href="/help/../a.md"');
  });
});
