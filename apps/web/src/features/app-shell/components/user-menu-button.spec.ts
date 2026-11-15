import { describe, expect, it } from 'vitest';
import { accountNameOf, initialsOf } from './user-menu-button.js';

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

describe('accountNameOf', () => {
  it.each([
    [{ displayName: 'Dorota Developer', email: 'developer@example.com' }, 'Dorota Developer'],
    [{ displayName: null, email: 'developer@example.com' }, 'developer@example.com'],
    [{ displayName: null, email: null }, undefined],
    [undefined, undefined],
  ])('%o → %s', (account, name) => {
    expect(accountNameOf(account)).toBe(name);
  });
});
