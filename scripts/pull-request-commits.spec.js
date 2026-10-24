import { describe, expect, it } from 'vitest';
import { isExemptAuthor, parseLog } from './pull-request-commits.js';

describe('isExemptAuthor', () => {
  it('exempts Dependabot by its e-mail address, case-insensitively', () => {
    expect(
      isExemptAuthor({ authorEmail: '49699333+Dependabot[bot]@users.noreply.github.com' }),
    ).toBe(true);
  });

  it('exempts the release app with the user ID GitHub assigned to it', () => {
    expect(
      isExemptAuthor({ authorEmail: '123456789+trybun-release[bot]@users.noreply.github.com' }),
    ).toBe(true);
    expect(isExemptAuthor({ authorEmail: 'trybun-release[bot]@users.noreply.github.com' })).toBe(
      false,
    );
  });

  it('does not exempt anyone else', () => {
    expect(isExemptAuthor({ authorEmail: 'ada@example.com' })).toBe(false);
  });
});

describe('parseLog', () => {
  it('reads the records of git log', () => {
    const output =
      'abc\x00p1 p2\x00Ada Lovelace\x00ada@example.com\x00fix: x\n\nSigned-off-by: Ada\n\x1e\n' +
      'def\x00\x00Bob\x00bob@example.com\x00feat: y\n\x1e\n';
    expect(parseLog(output)).toEqual([
      {
        sha: 'abc',
        parents: ['p1', 'p2'],
        authorName: 'Ada Lovelace',
        authorEmail: 'ada@example.com',
        message: 'fix: x\n\nSigned-off-by: Ada\n',
      },
      {
        sha: 'def',
        parents: [],
        authorName: 'Bob',
        authorEmail: 'bob@example.com',
        message: 'feat: y\n',
      },
    ]);
  });

  it('returns no commits for an empty range', () => {
    expect(parseLog('')).toEqual([]);
  });
});
