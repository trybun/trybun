import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findStaleFiles,
  readCatalogues,
  renderTheme,
  THEME_DIR,
  toJavaMessageFormat,
} from './generate-keycloak-theme.js';

describe('toJavaMessageFormat', () => {
  it.each([
    ['Sign in to Trybun', 'Sign in to Trybun'],
    ['Sign in to {0}', 'Sign in to {0}'],
    ["Don't wait", "Don''t wait"],
    ["Use '{'braces'}'", "Use '{'braces'}'"],
  ])('%s → %s', (message, expected) => {
    expect(toJavaMessageFormat(message)).toBe(expected);
  });

  it.each(['Hello {name}', '{count, plural, one {#} other {#}}', '<b>bold</b>'])(
    'rejects %s, which Keycloak cannot format',
    (message) => {
      expect(() => toJavaMessageFormat(message)).toThrow(/Only text and positional arguments/);
    },
  );
});

describe('renderTheme', () => {
  it('writes the theme and one ASCII message file per locale', () => {
    const files = renderTheme({
      pl: { keycloak: { loginAccountTitle: 'Zaloguj się', b: ' x\\y\nz' } },
      en: { keycloak: { loginAccountTitle: 'Sign in' } },
    });

    expect([...files.keys()]).toEqual([
      'theme.properties',
      'messages/messages_en.properties',
      'messages/messages_pl.properties',
    ]);
    expect(files.get('theme.properties')).toMatch(/\nparent=keycloak\.v2\nlocales=en,pl\n$/);
    expect(files.get('messages/messages_pl.properties')).toMatch(
      /\nb=\\ x\\\\y\\nz\nloginAccountTitle=Zaloguj si\\u0119\n$/,
    );
  });

  it.each([
    [{ en: { keycloak: { nested: { key: 'x' } } } }],
    [{ en: { keycloak: { 'not a key': 'x' } } }],
  ])('rejects a message Keycloak cannot read: %j', (catalogues) => {
    expect(() => renderTheme(catalogues)).toThrow(/must be a message with a Keycloak key/);
  });
});

describe('findStaleFiles', () => {
  it('lists changed, missing and extra files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'keycloak-theme-'));
    mkdirSync(join(dir, 'messages'));
    writeFileSync(join(dir, 'theme.properties'), 'same');
    writeFileSync(join(dir, 'messages/messages_en.properties'), 'old');
    writeFileSync(join(dir, 'messages/messages_de.properties'), 'removed language');
    const files = new Map([
      ['theme.properties', 'same'],
      ['messages/messages_en.properties', 'new'],
      ['messages/messages_pl.properties', 'added language'],
    ]);

    expect(findStaleFiles(files, dir)).toEqual([
      'messages/messages_de.properties',
      'messages/messages_en.properties',
      'messages/messages_pl.properties',
    ]);
  });

  it('finds the committed theme up to date with the catalogues', () => {
    expect(findStaleFiles(renderTheme(readCatalogues()), THEME_DIR)).toEqual([]);
  });
});
