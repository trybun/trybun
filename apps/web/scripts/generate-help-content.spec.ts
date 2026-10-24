import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTENT_DIR,
  parsePage,
  readDocumentation,
  renderHelpContent,
} from './generate-help-content.ts';

function page(title: string, views: string[] = [], body = 'Body text.') {
  return `---\ntitle: ${title}\ndescription: About ${title}.\nviews: ${JSON.stringify(views)}\n---\n\n${body}\n`;
}

describe('parsePage', () => {
  it('reads the front matter, the body and the text of a page', () => {
    const { page: parsed, text } = parsePage(
      'end-user/how-to/change-language.md',
      page('Change the language', ['/'], '1. Select **Language**.\n2. Select `Polski`.'),
    );

    expect(parsed).toEqual({
      slug: 'end-user/how-to/change-language',
      audience: 'end-user',
      category: 'how-to',
      title: 'Change the language',
      description: 'About Change the language.',
      views: ['/'],
      body: '1. Select **Language**.\n2. Select `Polski`.',
    });
    expect(text.split(/\s+/).filter(Boolean)).toEqual([
      'Select',
      'Language',
      '.',
      'Select',
      'Polski',
      '.',
    ]);
  });

  it.each([
    ['customer/how-to/a.md', page('A'), 'unknown audience'],
    ['team/guides/a.md', page('A'), 'unknown category'],
    ['team/how-to/Some_Page.md', page('A'), 'kebab-case'],
    ['team/how-to/nested/a.md', page('A'), 'kebab-case'],
    ['team/how-to/a.md', 'No front matter.', 'front matter'],
    ['team/how-to/a.md', '---\ntitle: A\n---\n', 'invalid front matter'],
    ['team/how-to/a.md', page('A', ['tickets']), 'invalid front matter'],
    ['team/how-to/a.md', page('A', [], '# A\n\nText.'), 'level-1 heading'],
  ])('rejects %s (%#)', (path, source, message) => {
    expect(() => parsePage(path, source)).toThrow(message);
  });
});

describe('renderHelpContent', () => {
  const documentation = {
    en: {
      'end-user/tutorials/start.md': page('Start', ['/']),
      'team/tutorials/start.md': page('Team start', ['/'], 'Set up the authenticator.'),
    },
    pl: {
      'end-user/tutorials/start.md': page('Start', ['/']),
      'team/tutorials/start.md': page('Start zespołu', ['/'], 'Skonfiguruj aplikację.'),
    },
  };

  it('maps a view to the page of the most specific audience of each account kind', () => {
    const content = JSON.parse(renderHelpContent(documentation).get('help-content.json') ?? '') as {
      views: unknown;
    };

    expect(content.views).toEqual({
      end_user: { '/': 'end-user/tutorials/start' },
      team: { '/': 'team/tutorials/start' },
    });
  });

  it('builds an index per language and account kind with the pages the kind receives', () => {
    const indexes = JSON.parse(
      renderHelpContent(documentation).get('search-indexes.json') ?? '',
    ) as Record<'en' | 'pl', Record<'end_user' | 'team', { documentCount: number }>>;

    expect(indexes.en.end_user.documentCount).toBe(1);
    expect(indexes.en.team.documentCount).toBe(2);
    expect(JSON.stringify(indexes.pl.end_user)).not.toContain('skonfiguruj');
    expect(JSON.stringify(indexes.pl.team)).toContain('skonfiguruj');
  });

  it('rejects a page without a translation', () => {
    expect(() =>
      renderHelpContent({ ...documentation, pl: { 'end-user/tutorials/start.md': page('Start') } }),
    ).toThrow('pl/team/tutorials/start.md is missing');
    expect(() =>
      renderHelpContent({
        ...documentation,
        pl: { ...documentation.pl, 'team/reference/extra.md': page('Extra') },
      }),
    ).toThrow('en/team/reference/extra.md is missing');
  });

  it('rejects views that differ between the languages', () => {
    expect(() =>
      renderHelpContent({
        ...documentation,
        pl: { ...documentation.pl, 'end-user/tutorials/start.md': page('Start', ['/help']) },
      }),
    ).toThrow('the views differ');
  });

  it('rejects a view claimed twice by one audience', () => {
    expect(() =>
      renderHelpContent({
        en: { ...documentation.en, 'team/how-to/other.md': page('Other', ['/']) },
      }),
    ).toThrow('the view / is already the help of team/how-to/other');
  });
});

describe('the generated help content', () => {
  it('matches the user documentation (`pnpm help:generate`)', () => {
    for (const [name, content] of renderHelpContent(readDocumentation())) {
      expect(readFileSync(join(CONTENT_DIR, name), 'utf8')).toBe(content);
    }
  });
});
