import { describe, expect, it } from 'vitest';
import {
  acceptancePathOf,
  clearPendingAcceptance,
  invitationTokenOf,
  readPendingAcceptance,
  writePendingAcceptance,
} from './acceptance-state.js';

/** The `sessionStorage` of a tab, in memory. */
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('invitationTokenOf', () => {
  it('reads the token from the fragment of the link', () => {
    expect(invitationTokenOf('#token=abc_DEF-123')).toBe('abc_DEF-123');
  });

  it.each(['', '#', '#token=', '#other=1'])('finds no token in %j', (hash) => {
    expect(invitationTokenOf(hash)).toBeUndefined();
  });

  it('is the inverse of the path that shows a link again', () => {
    const path = acceptancePathOf('abc_DEF-123');

    expect(path).toBe('/invitations#token=abc_DEF-123');
    expect(invitationTokenOf(path.slice(path.indexOf('#')))).toBe('abc_DEF-123');
  });
});

describe('pending acceptance', () => {
  it('keeps the step of the tab until it is cleared', () => {
    const storage = memoryStorage();
    writePendingAcceptance(storage, { step: 'accept', token: 't', provider: 'github', signIns: 0 });

    expect(readPendingAcceptance(storage)).toEqual({
      step: 'accept',
      token: 't',
      provider: 'github',
      signIns: 0,
    });
    clearPendingAcceptance(storage);
    expect(readPendingAcceptance(storage)).toBeUndefined();
  });

  it.each(['not json', '{"step":"verify","landingPath":"//evil.example","signIns":0}', '{}'])(
    'ignores an unreadable or foreign value %s',
    (value) => {
      const storage = memoryStorage();
      storage.setItem('trybun.invitation', value);

      expect(readPendingAcceptance(storage)).toBeUndefined();
    },
  );
});
