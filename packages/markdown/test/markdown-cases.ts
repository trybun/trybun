// The test tables every Markdown renderer runs (§6.2, §13.5): the web renderer of @trybun/ui, the
// e-mail renderer of the server and the plain processor of this package.

/** An allowed attachment of the image cases. */
export const ALLOWED_ATTACHMENT_ID = '0b9c3f6e-2d1a-4e8b-9c7d-5a6f1e2d3c4b';
/** An attachment that is not in the allowed set, e.g. of another ticket. */
export const OTHER_ATTACHMENT_ID = '7e1d2c3b-4a5f-4e6d-8c9b-0a1f2e3d4c5b';

export interface XssCase {
  name: string;
  source: string;
}

/** Cases from the OWASP XSS Filter Evasion Cheat Sheet, written as links, images and raw HTML. */
export const XSS_CASES: XssCase[] = [
  { name: 'script element', source: '<script>alert(1)</script>' },
  { name: 'script element inline', source: 'Text <script>alert(1)</script> more' },
  { name: 'image with onerror', source: '<img src=x onerror="alert(1)">' },
  { name: 'svg with onload', source: '<svg onload=alert(1)></svg>' },
  { name: 'iframe', source: '<iframe src="javascript:alert(1)"></iframe>' },
  { name: 'object', source: '<object data="javascript:alert(1)"></object>' },
  { name: 'style element', source: '<style>body{background:url(javascript:alert(1))}</style>' },
  {
    name: 'anchor with entity-encoded protocol',
    source: '<a href="&#106;avascript:alert(1)">x</a>',
  },
  { name: 'anchor with event handler', source: '<a href="/" onclick="alert(1)">x</a>' },
  { name: 'javascript link', source: '[x](javascript:alert(1))' },
  { name: 'mixed-case javascript link', source: '[x](JaVaScRiPt:alert(1))' },
  { name: 'entity-encoded javascript link', source: '[x](&#106;avascript:alert(1))' },
  { name: 'hex-entity javascript link', source: '[x](&#x6A;avascript:alert(1))' },
  { name: 'javascript link with a tab', source: '[x](java&#9;script:alert(1))' },
  { name: 'javascript link with leading spaces', source: '[x]( javascript:alert(1))' },
  { name: 'javascript reference link', source: '[x][a]\n\n[a]: javascript:alert(1)' },
  { name: 'javascript autolink', source: '<javascript:alert(1)>' },
  { name: 'vbscript link', source: '[x](vbscript:msgbox(1))' },
  { name: 'data link', source: '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)' },
  { name: 'javascript image', source: '![x](javascript:alert(1))' },
  { name: 'data image', source: '![x](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)' },
  {
    name: 'image with a quote in the URL',
    source: '![x](https://example.com/a.png"onerror="alert(1))',
  },
  {
    name: 'link with a title breaking out',
    source: '[x](https://example.com "a\\" onmouseover=\\"alert(1)")',
  },
  { name: 'protocol-relative link', source: '[x](//evil.example)' },
  { name: 'backslash link', source: '[x](/\\evil.example)' },
  { name: 'protocol-relative image', source: '![x](//evil.example/a.png)' },
  { name: 'backslash image', source: '![x](/\\evil.example/a.png)' },
  { name: 'html in a table cell', source: '| a |\n|---|\n| <img src=x onerror=alert(1)> |' },
  { name: 'html in a code span stays text', source: '`<script>alert(1)</script>`' },
];

/** Problems of rendered HTML: executable elements, event handlers and unsafe URL protocols. */
export function unsafeHtmlFindings(html: string): string[] {
  const findings: string[] = [];
  for (const tag of ['script', 'iframe', 'object', 'embed', 'svg', 'style', 'form']) {
    if (new RegExp(`<${tag}[\\s>/]`, 'i').test(html)) {
      findings.push(`<${tag}> element`);
    }
  }
  // Attribute values are removed first: a quoted value is text, not an attribute.
  // `[^<>]` keeps the match linear: a tag never contains another `<`.
  const tags = html.match(/<[a-z][^<>]*>/gi) ?? [];
  if (tags.some((tag) => /\son[a-z]+\s*=/i.test(tag.replace(/"[^"]*"|'[^']*'/g, '""')))) {
    findings.push('event-handler attribute');
  }
  const urls = html.matchAll(
    /\s(?:href|src|action|formaction|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
  );
  for (const [, quoted = ''] of urls) {
    const url = quoted
      .replace(/^["']|["']$/g, '')
      .replace(/&#(x?)([0-9a-f]+);?/gi, (_, hex: string, code: string) =>
        String.fromCodePoint(Number.parseInt(code, hex === '' ? 10 : 16)),
      )
      .replaceAll(/\s/g, '')
      .toLowerCase();
    if (/^(javascript|data|vbscript):/.test(url)) {
      findings.push(`unsafe URL ${url}`);
    }
  }
  return findings;
}

export interface ImageCase {
  name: string;
  source: string;
  /** Whether a view that allows {@link ALLOWED_ATTACHMENT_ID} shows an `<img>`; e-mails never do. */
  isImage: boolean;
  /** The target of the link the image renders as, when it is not an image. */
  linkHref?: string;
  /** The text the image renders as. */
  text?: string;
}

/** The image rule of §6.2 and §13.3 (Q4). */
export const IMAGE_CASES: ImageCase[] = [
  {
    name: 'allowed attachment',
    source: `![Screenshot](/api/v1/attachments/${ALLOWED_ATTACHMENT_ID}/content)`,
    isImage: true,
  },
  {
    name: 'external image',
    source: '![Logo](https://example.com/logo.png)',
    isImage: false,
    linkHref: 'https://example.com/logo.png',
    text: 'Logo',
  },
  {
    name: 'external image without alt text',
    source: '![](https://example.com/logo.png)',
    isImage: false,
    linkHref: 'https://example.com/logo.png',
    text: 'https://example.com/logo.png',
  },
  {
    name: "another ticket's attachment",
    source: `![Other](/api/v1/attachments/${OTHER_ATTACHMENT_ID}/content)`,
    isImage: false,
    linkHref: `/api/v1/attachments/${OTHER_ATTACHMENT_ID}/content`,
    text: 'Other',
  },
  {
    name: 'unknown ID',
    source: '![Unknown](/api/v1/attachments/not-a-uuid/content)',
    isImage: false,
    linkHref: '/api/v1/attachments/not-a-uuid/content',
    text: 'Unknown',
  },
  {
    name: 'path with a suffix',
    source: `![Suffix](/api/v1/attachments/${ALLOWED_ATTACHMENT_ID}/content/../../users)`,
    isImage: false,
    text: 'Suffix',
  },
  {
    name: 'absolute URL of an allowed attachment',
    source: `![Absolute](https://evil.example/api/v1/attachments/${ALLOWED_ATTACHMENT_ID}/content)`,
    isImage: false,
    linkHref: `https://evil.example/api/v1/attachments/${ALLOWED_ATTACHMENT_ID}/content`,
    text: 'Absolute',
  },
  {
    name: 'source removed by the sanitizer',
    source: '![Removed](javascript:alert(1))',
    isImage: false,
    text: 'Removed',
  },
  {
    name: 'external image inside a link',
    source: '[![Badge](https://example.com/badge.svg)](https://example.com)',
    isImage: false,
    linkHref: 'https://example.com',
    text: 'Badge',
  },
];

/** A team member of the mention cases. */
export const MENTIONED_USER_ID = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';
/** A user who is not among the people a view knows, e.g. one removed from the team. */
export const UNKNOWN_USER_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

/** The people the views of the mention cases know (S1-12); the customer is a hidden person. */
export const MENTIONED_PEOPLE = [
  { id: MENTIONED_USER_ID, displayName: 'Anna Nowak' },
  { id: 'customer', displayName: 'Customer' },
];

export interface MentionCase {
  name: string;
  source: string;
  /** The names rendered as mentions, in order, each as `<span class="mention">@Name</span>`. */
  mentions: string[];
  /** Text rendered as written, e.g. a token that is no mention. */
  text?: string;
}

/** The rendering of mention tokens (S1-12) with {@link MENTIONED_PEOPLE}. */
export const MENTION_CASES: MentionCase[] = [
  { name: 'known user', source: `Thanks @{${MENTIONED_USER_ID}}!`, mentions: ['Anna Nowak'] },
  { name: 'hidden customer', source: 'Ask @{customer} first', mentions: ['Customer'] },
  {
    name: 'two tokens in one text node',
    source: `@{${MENTIONED_USER_ID}} and @{customer}`,
    mentions: ['Anna Nowak', 'Customer'],
  },
  {
    name: 'unknown user stays text',
    source: `Hi @{${UNKNOWN_USER_ID}}`,
    mentions: [],
    text: `@{${UNKNOWN_USER_ID}}`,
  },
  {
    name: 'inline code stays text',
    source: `\`@{${MENTIONED_USER_ID}}\``,
    mentions: [],
    text: `@{${MENTIONED_USER_ID}}`,
  },
  {
    name: 'code block stays text',
    source: `\`\`\`\n@{${MENTIONED_USER_ID}}\n\`\`\``,
    mentions: [],
    text: `@{${MENTIONED_USER_ID}}`,
  },
  {
    name: 'link text stays text',
    source: `[@{${MENTIONED_USER_ID}}](/profile)`,
    mentions: [],
    text: `@{${MENTIONED_USER_ID}}`,
  },
  {
    name: 'upper-case ID stays text',
    source: `@{${MENTIONED_USER_ID.toUpperCase()}}`,
    mentions: [],
    text: `@{${MENTIONED_USER_ID.toUpperCase()}}`,
  },
  { name: 'inside emphasis', source: `**@{${MENTIONED_USER_ID}}**`, mentions: ['Anna Nowak'] },
];

/** The rendered mention of a person, as every web renderer writes it. */
export function mentionHtml(displayName: string): string {
  return `<span class="mention">@${displayName}</span>`;
}
