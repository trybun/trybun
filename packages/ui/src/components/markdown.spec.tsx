import {
  ALLOWED_ATTACHMENT_ID,
  IMAGE_CASES,
  MENTION_CASES,
  MENTIONED_PEOPLE,
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

  it.each(MENTION_CASES)('renders mentions: $name', async ({ source, mentions, text }) => {
    const html = await render(source, { mentions: MENTIONED_PEOPLE });
    expect([...html.matchAll(/<span class="mention">@([^<]*)<\/span>/g)].map(([, n]) => n)).toEqual(
      mentions,
    );
    if (text !== undefined) {
      expect(html).toContain(text);
    }
  });

  it('gives two texts with footnotes on one page unique IDs', async () => {
    const source = 'Note[^1]\n\n[^1]: Footnote.';
    const { prelude } = await prerender(
      <>
        <Markdown>{source}</Markdown>
        <Markdown>{source}</Markdown>
      </>,
    );
    const html = await new Response(prelude).text();
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id!);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    // Every reference points to an ID of the page.
    const targets = [
      ...[...html.matchAll(/href="#([^"]+)"/g)].map(([, id]) => id!),
      ...[...html.matchAll(/aria-describedby="([^"]+)"/g)].map(([, id]) => id!),
    ];
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.filter((id) => !ids.includes(id))).toEqual([]);
  });

  it('applies the transform of the application after the rules', async () => {
    const html = await render('[page](../a.md)', { urlTransform: (url) => `/help/${url}` });
    expect(html).toContain('href="/help/../a.md"');
  });
});
