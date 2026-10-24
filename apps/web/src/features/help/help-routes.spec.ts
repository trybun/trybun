import { describe, expect, it } from 'vitest';
import { helpHref, helpPageOfPath, resolveHelpLink } from './help-routes.js';

const VIEWS = {
  '/': 'team/tutorials/getting-started',
  '/help': 'end-user/how-to/search-the-help',
  '/tickets/[id]': 'team/how-to/handle-a-ticket',
  '/tickets/new': 'end-user/how-to/report-a-ticket',
};

describe('helpHref', () => {
  it.each([
    [undefined, '/help'],
    ['end-user/how-to/change-language', '/help/end-user/how-to/change-language'],
  ])('%s → %s', (slug, expected) => {
    expect(helpHref(slug)).toBe(expected);
  });
});

describe('helpPageOfPath', () => {
  it.each([
    ['/', 'team/tutorials/getting-started'],
    ['/help', 'end-user/how-to/search-the-help'],
    // The exact route comes before a route with parameters.
    ['/tickets/new', 'end-user/how-to/report-a-ticket'],
    ['/tickets/ERP-123', 'team/how-to/handle-a-ticket'],
    ['/tickets/ERP-123/history', undefined],
    ['/help/end-user/how-to/change-language', undefined],
    ['/settings', undefined],
  ])('%s → %s', (pathname, expected) => {
    expect(helpPageOfPath(VIEWS, pathname)).toBe(expected);
  });
});

describe('resolveHelpLink', () => {
  it.each([
    ['../how-to/change-language.md', '/help/end-user/how-to/change-language'],
    ['search-the-help.md', '/help/end-user/tutorials/search-the-help'],
    [
      '../../team/explanation/help-for-end-users.md#roles',
      '/help/team/explanation/help-for-end-users#roles',
    ],
    ['https://example.com/guide.md', 'https://example.com/guide.md'],
    ['mailto:support@example.com', 'mailto:support@example.com'],
    ['/tickets', '/tickets'],
    ['#sign-in', '#sign-in'],
    ['../images/header.png', '../images/header.png'],
  ])('%s → %s', (url, expected) => {
    expect(resolveHelpLink(url, 'end-user/tutorials/getting-started')).toBe(expected);
  });
});
