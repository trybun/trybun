import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_ATTACHMENT_ID,
  IMAGE_CASES,
  MENTION_CASES,
  MENTIONED_PEOPLE,
  MENTIONED_USER_ID,
  mentionHtml,
  UNKNOWN_USER_ID,
  unsafeHtmlFindings,
  XSS_CASES,
} from '../test/markdown-cases.js';
import {
  attachmentContentPath,
  isExternalUrl,
  markdownRehypePlugins,
  markdownRemarkRehypeOptions,
  MENTION_TOKEN_PATTERN,
  mentionIdsOf,
  parseAttachmentContentPath,
  type MarkdownRuleOptions,
} from './index.js';

function render(source: string, options: MarkdownRuleOptions = {}): string {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, markdownRemarkRehypeOptions(options))
    .use(markdownRehypePlugins({ allowedIds: [ALLOWED_ATTACHMENT_ID], ...options }))
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
    expect(render(IMAGE_CASES[0]!.source, { allowedIds: [] })).not.toContain('<img');
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

describe('footnote IDs', () => {
  const source = 'Note[^1]\n\n[^1]: Footnote.';

  it('keeps the IDs of remark-rehype without a prefix', () => {
    const html = render(source);
    expect(html).toContain('href="#user-content-fn-1"');
    expect(html).toContain('id="footnote-label"');
    expect(html).toContain('aria-describedby="footnote-label"');
  });

  it('gives every footnote ID and its references the prefix of the text', () => {
    const html = render(source, { idPrefix: 'c1' });
    expect(html).toContain('href="#user-content-c1-fn-1"');
    expect(html).toContain('id="user-content-c1-fn-1"');
    expect(html).toContain('id="user-content-c1-fnref-1"');
    expect(html).toContain('href="#user-content-c1-fnref-1"');
    expect(html).toContain('<h2 class="sr-only" id="user-content-c1-footnote-label">');
    expect(html).toContain('aria-describedby="user-content-c1-footnote-label"');
    expect(html).not.toMatch(/"footnote-label"|user-content-user-content/);
  });

  it('gives two texts different IDs', () => {
    const ids = (html: string) => [...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
    const first = ids(render(source, { idPrefix: 'a' }));
    const second = ids(render(source, { idPrefix: 'b' }));
    expect(first).toHaveLength(3);
    expect(first.filter((id) => second.includes(id))).toEqual([]);
  });
});

describe('mentions', () => {
  it.each(MENTION_CASES)('renders: $name', ({ source, mentions, text }) => {
    const html = render(source, { mentions: MENTIONED_PEOPLE });
    expect([...html.matchAll(/<span class="mention">@([^<]*)<\/span>/g)].map(([, n]) => n)).toEqual(
      mentions,
    );
    if (text !== undefined) {
      expect(html).toContain(text);
    }
  });

  it('renders a mention as a span, not a link', () => {
    expect(render(`Hi @{${MENTIONED_USER_ID}}.`, { mentions: MENTIONED_PEOPLE })).toBe(
      `<p>Hi ${mentionHtml('Anna Nowak')}.</p>`,
    );
  });

  it('renders every token as text without people', () => {
    expect(render(`Hi @{${MENTIONED_USER_ID}}`)).toBe(`<p>Hi @{${MENTIONED_USER_ID}}</p>`);
  });

  it('writes a display name as text, never as HTML', () => {
    const html = render('@{customer}', {
      mentions: [{ id: 'customer', displayName: '<img src=x onerror=alert(1)>' }],
    });
    expect(html).toBe(`<p>${mentionHtml('&#x3C;img src=x onerror=alert(1)>')}</p>`);
    expect(unsafeHtmlFindings(html)).toEqual([]);
  });
});

describe('MENTION_TOKEN_PATTERN', () => {
  it.each([
    [`@{${MENTIONED_USER_ID}}`, MENTIONED_USER_ID],
    ['@{customer}', 'customer'],
    ['@{Customer}', undefined],
    ['@{3f2a1b4c}', undefined],
    [`@${MENTIONED_USER_ID}`, undefined],
    [`@{ ${MENTIONED_USER_ID} }`, undefined],
  ])('%s → %s', (token, id) => {
    expect(MENTION_TOKEN_PATTERN.exec(token)?.[1]).toBe(id);
  });
});

describe('mentionIdsOf', () => {
  const user = MENTIONED_USER_ID;
  const other = UNKNOWN_USER_ID;
  it.each([
    ['no token', 'Hello @anna', []],
    ['one token', `Hi @{${user}}`, [user]],
    ['distinct, in order of first appearance', `@{${other}} @{${user}} @{${other}}`, [other, user]],
    ['tokens next to each other', `@{${user}}@{${other}}`, [user, other]],
    [
      'in emphasis, a list and a table',
      `- **@{${user}}**\n\n| a |\n|---|\n| @{${other}} |`,
      [user, other],
    ],
    ['in a quote and a footnote', `> @{${user}}[^1]\n\n[^1]: @{${other}}`, [user, other]],
    ['not the customer', 'Ask @{customer}', []],
    ['not in inline code', `\`@{${user}}\` and @{${other}}`, [other]],
    ['not in a fenced code block', `\`\`\`\n@{${user}}\n\`\`\``, []],
    ['not in an indented code block', `Text\n\n    @{${user}}`, []],
    ['not in a link destination', `[profile](/users/@{${user}})`, []],
    ['not in link text', `[@{${user}}](/users)`, []],
    ['not in an autolink', `https://example.com/@{${user}}`, []],
    ['not in an image', `![@{${user}}](/a.png)`, []],
    ['between raw HTML tags, as rendered', `<span>@{${user}}</span>`, [user]],
    ['not in a raw HTML block', `<div>\n@{${user}}\n</div>`, []],
    ['not an upper-case ID', `@{${user.toUpperCase()}}`, []],
  ])('%s', (_, source, ids) => {
    expect(mentionIdsOf(source)).toEqual(ids);
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
