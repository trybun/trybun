import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_ATTACHMENT_ID,
  IMAGE_CASES,
  unsafeHtmlFindings,
  XSS_CASES,
} from '../test/markdown-cases.js';
import {
  attachmentContentPath,
  isExternalUrl,
  markdownRehypePlugins,
  parseAttachmentContentPath,
} from './index.js';

function render(source: string, allowedIds: string[] = [ALLOWED_ATTACHMENT_ID]): string {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(markdownRehypePlugins({ allowedIds }))
    .use(rehypeStringify)
    .processSync(source)
    .toString();
}

describe('markdownRehypePlugins', () => {
  it.each(XSS_CASES)('removes the attack: $name', ({ source }) => {
    expect(unsafeHtmlFindings(render(source))).toEqual([]);
  });

  it.each(IMAGE_CASES)('applies the image rule: $name', ({ source, isImage, linkHref, text }) => {
    const html = render(source);
    expect(html.includes('<img')).toBe(isImage);
    if (linkHref !== undefined) {
      expect(html).toContain(`href="${linkHref}"`);
    }
    if (text !== undefined) {
      expect(html).toContain(text);
    }
  });

  it('shows no image when no attachment is allowed', () => {
    expect(render(IMAGE_CASES[0]!.source, [])).not.toContain('<img');
  });

  it('keeps an allowed attachment image with its alt text', () => {
    expect(render(`![Shot](${attachmentContentPath(ALLOWED_ATTACHMENT_ID)})`)).toBe(
      `<p><img src="/api/v1/attachments/${ALLOWED_ATTACHMENT_ID}/content" alt="Shot"></p>`,
    );
  });

  it.each([
    ['https://example.com', true],
    ['http://example.com', true],
    ['//evil.example', true],
  ])('adds rel to a link to another site: %s', (href) => {
    expect(render(`[x](${href})`)).toContain('rel="nofollow ugc noopener noreferrer"');
  });

  it.each(['/projects', 'relative/path', '#section', 'mailto:help@example.com'])(
    'keeps a link without rel: %s',
    (href) => {
      const html = render(`[x](${href})`);
      expect(html).toContain('<a href=');
      expect(html).not.toContain('rel=');
    },
  );

  it('encodes a backslash, so /\\host stays a path of the site', () => {
    expect(render('[x](/\\evil.example)')).toBe('<p><a href="/%5Cevil.example">x</a></p>');
  });

  it('renders a link with an unsafe target as plain text', () => {
    expect(render('[click](javascript:alert(1))')).toBe('<p>click</p>');
  });

  it('does not render raw HTML', () => {
    expect(render('<kbd>Ctrl</kbd> and <details>x</details>')).not.toMatch(/<kbd|<details/);
  });

  it('renders GFM: task lists read-only, tables, strikethrough, footnotes', () => {
    const html = render('- [x] done\n\n| a |\n|---|\n| b |\n\n~~old~~ note[^1]\n\n[^1]: Footnote.');
    expect(html).toContain('<input type="checkbox" checked disabled aria-label="done">');
    expect(html).toContain('<table>');
    expect(html).toContain('<del>old</del>');
    expect(html).toContain('id="user-content-fn-1"');
  });
});

describe('task-list labels', () => {
  it('names a checkbox by its item text without nested lists', () => {
    expect(render('- [ ] Fix **the** export\n  - [x] nested')).toContain(
      'aria-label="Fix the export"',
    );
  });

  it('names a checkbox in a loose list', () => {
    expect(render('- [ ] one\n\n- [x] two')).toContain('aria-label="two"');
  });
});

describe('attachment paths', () => {
  it('parses the stable path it builds', () => {
    expect(parseAttachmentContentPath(attachmentContentPath(ALLOWED_ATTACHMENT_ID))).toBe(
      ALLOWED_ATTACHMENT_ID,
    );
  });

  it.each([
    `https://trybun.example/api/v1/attachments/${ALLOWED_ATTACHMENT_ID}/content`,
    `/api/v1/attachments/${ALLOWED_ATTACHMENT_ID}/content?x=1`,
    `/api/v1/attachments/${ALLOWED_ATTACHMENT_ID.toUpperCase()}/content`,
    '/api/v1/attachments/123/content',
  ])('rejects any other URL: %s', (url) => {
    expect(parseAttachmentContentPath(url)).toBeUndefined();
  });
});

describe('isExternalUrl', () => {
  it.each([
    ['https://example.com', true],
    ['HTTP://example.com', true],
    ['//example.com', true],
    ['\\\\example.com', true],
    ['mailto:a@example.com', false],
    ['/path', false],
    ['path', false],
    ['#top', false],
  ])('%s → %s', (url, expected) => {
    expect(isExternalUrl(url)).toBe(expected);
  });
});
