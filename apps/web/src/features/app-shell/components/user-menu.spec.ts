import { describe, expect, it, vi } from 'vitest';

// The Server Action of the language switch reads the server environment.
vi.mock('../../../lib/i18n/change-language.js', () => ({ changeLanguage: vi.fn() }));

const { initialsOf } = await import('./user-menu.js');

describe('initialsOf', () => {
  it.each([
    ['Dorota Developer', 'DD'],
    ['ada', 'A'],
    ['Jan Maria Rokita', 'JM'],
    ['  łucja   żak ', 'ŁŻ'],
    ['dorota@example.com', 'D'],
  ])('%s → %s', (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});
