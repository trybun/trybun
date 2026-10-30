import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGUES } from '@trybun/i18n/catalogues';
import { describe, expect, it } from 'vitest';
import {
  CLIENT_NAMESPACES,
  type ClientMessagesRoute,
  getWebMessages,
  pickClientMessages,
} from './messages.js';

describe('getWebMessages', () => {
  it.each(['en', 'pl'] as const)(
    'returns the %s messages without the server namespaces',
    (locale) => {
      const messages = getWebMessages(locale);

      expect(Object.keys(messages)).not.toContain('emails');
      expect(Object.keys(messages)).not.toContain('keycloak');
      expect(messages.signIn).toEqual(CATALOGUES[locale].signIn);
    },
  );
});

describe('pickClientMessages', () => {
  it.each(['en', 'pl'] as const)('passes the %s texts of the route only', (locale) => {
    const messages = pickClientMessages(getWebMessages(locale), 'projects');

    expect(Object.keys(messages).sort()).toEqual([...CLIENT_NAMESPACES.projects].sort());
    expect(messages.projects).toEqual(CATALOGUES[locale].projects);
  });

  it('passes no texts of a feature to the sign-in and the empty shell', () => {
    for (const route of ['root', 'signIn', 'team'] as const) {
      expect(Object.keys(pickClientMessages(getWebMessages('en'), route))).not.toContain(
        'projects',
      );
    }
  });
});

const SOURCES = join(import.meta.dirname, '../..');
const UI_COMPONENTS = join(SOURCES, '../../../packages/ui/src/components');

/** The routes whose layouts render the components of a feature (`features/<feature>`). */
const ROUTES_OF_FEATURE: Record<string, ClientMessagesRoute[]> = {
  administration: ['administration'],
  'app-shell': ['team'],
  help: ['team'],
  invitations: ['accounts', 'invitations', 'projects'],
  organizations: ['organizations'],
  'product-tours': ['team'],
  projects: ['projects'],
  sessions: ['signIn'],
  setup: ['setup'],
  users: ['accounts', 'settings'],
};

/** The source files of a folder, without tests and stories. */
function sourcesOf(folder: string): string[] {
  return readdirSync(folder, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !/\.(spec|stories)\.tsx?$/.test(file))
    .map((file) => join(folder, file));
}

/** The namespaces the hooks of `next-intl` read in the files, as client components can. */
function namespacesOf(files: string[]): Set<string> {
  const namespaces = new Set<string>();
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const [, namespace] of source.matchAll(/useTranslations\(\s*'([A-Za-z]+)/g)) {
      namespaces.add(namespace!);
    }
    if (source.includes('useErrorMessage()')) {
      namespaces.add('errors');
    }
  }
  return namespaces;
}

describe('CLIENT_NAMESPACES', () => {
  it('contain the namespaces of their parent layouts', () => {
    const { root, team, ...routes } = CLIENT_NAMESPACES;
    for (const namespaces of [team, ...Object.values(routes)]) {
      expect(namespaces).toEqual(expect.arrayContaining([...root]));
    }
    expect(routes.administration).toEqual(expect.arrayContaining([...team]));
    expect(routes.projects).toEqual(expect.arrayContaining([...team]));
    expect(routes.organizations).toEqual(expect.arrayContaining([...routes.administration]));
    expect(routes.accounts).toEqual(expect.arrayContaining([...routes.administration]));
    expect(routes.settings).toEqual(expect.arrayContaining([...team]));
  });

  it('provide the namespaces of the components of @trybun/ui on every route', () => {
    expect([...CLIENT_NAMESPACES.root]).toEqual(
      expect.arrayContaining([...namespacesOf(sourcesOf(UI_COMPONENTS))]),
    );
  });

  it.each(readdirSync(join(SOURCES, 'features')))(
    'provide the namespaces the feature %s uses on its routes',
    (feature) => {
      const routes = ROUTES_OF_FEATURE[feature];

      expect(routes, `add the routes of the feature ${feature}`).toBeDefined();
      const used = namespacesOf(sourcesOf(join(SOURCES, 'features', feature)));
      for (const route of routes!) {
        expect([...CLIENT_NAMESPACES[route]]).toEqual(expect.arrayContaining([...used]));
      }
    },
  );
});
