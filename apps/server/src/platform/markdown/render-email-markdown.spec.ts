import { IMAGE_CASES, unsafeHtmlFindings, XSS_CASES } from '@trybun/markdown/testing';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderEmailMarkdown } from './render-email-markdown.js';

const BASE_URL = 'https://trybun.example.com';

function render(source: string): string {
  return renderToStaticMarkup(renderEmailMarkdown(source, { baseUrl: BASE_URL }));
}

describe('renderEmailMarkdown', () => {
  // The e-mail renderer runs the shared tables of @trybun/markdown (§6.2, §13.5).
  it.each(XSS_CASES)('removes the attack: $name', ({ source }) => {
    expect(unsafeHtmlFindings(render(source))).toEqual([]);
  });

  it.each(IMAGE_CASES)('shows every image as a link: $name', ({ source, text }) => {
    const html = render(source);
    expect(html).not.toContain('<img');
    if (text !== undefined) {
      expect(html).toContain(text);
    }
  });

  it('makes a link to an allowed attachment absolute', () => {
    expect(
      render('![Shot](/api/v1/attachments/0b9c3f6e-2d1a-4e8b-9c7d-5a6f1e2d3c4b/content)'),
    ).toContain(
      `href="${BASE_URL}/api/v1/attachments/0b9c3f6e-2d1a-4e8b-9c7d-5a6f1e2d3c4b/content"`,
    );
  });

  it.each([
    ['/projects/ERP', `${BASE_URL}/projects/ERP`],
    ['tickets/1', `${BASE_URL}/tickets/1`],
    ['https://example.com/a', 'https://example.com/a'],
    ['mailto:help@example.com', 'mailto:help@example.com'],
  ])('resolves the link %s to %s', (href, expected) => {
    expect(render(`[x](${href})`)).toContain(`href="${expected}"`);
  });

  it('keeps links within the content, e.g. footnotes', () => {
    expect(render('Note[^1]\n\n[^1]: Text.')).toContain('href="#user-content-fn-1"');
  });

  it('keeps rel on links to other sites', () => {
    expect(render('[x](https://example.com)')).toContain('rel="nofollow ugc noopener noreferrer"');
  });

  it('shows task items as characters', () => {
    const html = render('- [x] done\n- [ ] open');
    expect(html).not.toContain('<input');
    expect(html).toContain('☑ done');
    expect(html).toContain('☐ open');
  });

  it('styles elements inline and highlights no code', () => {
    const html = render('# Title\n\n```ts\nconst a = 1;\n```\n\n[x](/a)');
    expect(html).toContain(
      '<h1 style="margin:16px 0 8px;font-size:20px;font-weight:700">Title</h1>',
    );
    expect(html).toContain('<pre style=');
    expect(html).toContain('<code style="font-family:');
    expect(html).not.toMatch(/class=|hljs/);
    expect(html).toContain(
      '<a href="https://trybun.example.com/a" style="color:#2563eb;text-decoration:underline">x</a>',
    );
  });

  it('renders an empty text as nothing', () => {
    expect(render('')).toBe('');
  });
});
