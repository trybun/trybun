import { describe, expect, it } from 'vitest';
import { findDcoProblems, parseLog } from './check-dco.js';

const AUTHOR = { authorName: 'Ada Lovelace', authorEmail: 'ada@example.com' };

function commit(message, overrides = {}) {
  return { sha: '0123456789abcdef', parents: ['fedcba'], ...AUTHOR, message, ...overrides };
}

describe('findDcoProblems', () => {
  it('accepts a commit signed off by its author', () => {
    expect(
      findDcoProblems([
        commit('feat(web): add the ticket list\n\nSigned-off-by: Ada Lovelace <ada@example.com>\n'),
      ]),
    ).toEqual([]);
  });

  it('compares the name and the e-mail address case-insensitively', () => {
    expect(
      findDcoProblems([commit('fix: x\n\nSigned-off-by: ada lovelace <Ada@Example.com>')]),
    ).toEqual([]);
  });

  it('finds the sign-off among other trailers', () => {
    expect(
      findDcoProblems([
        commit(
          'fix: x\n\nCo-authored-by: Bob <bob@example.com>\nSigned-off-by: Ada Lovelace <ada@example.com>',
        ),
      ]),
    ).toEqual([]);
  });

  it('reports a commit without sign-off', () => {
    expect(findDcoProblems([commit('feat(web): add the ticket list\n')])).toEqual([
      '0123456789ab "feat(web): add the ticket list": no "Signed-off-by: Ada Lovelace <ada@example.com>"',
    ]);
  });

  it('reports a sign-off by someone else than the author', () => {
    expect(
      findDcoProblems([commit('fix: x\n\nSigned-off-by: Bob <bob@example.com>')]),
    ).toHaveLength(1);
    expect(
      findDcoProblems([commit('fix: x\n\nSigned-off-by: Ada Lovelace <other@example.com>')]),
    ).toHaveLength(1);
  });

  it('reports a sign-off that is not a trailer line', () => {
    expect(
      findDcoProblems([commit('fix: x\n\nSee Signed-off-by: Ada Lovelace <ada@example.com>')]),
    ).toHaveLength(1);
  });

  it('skips merge commits and Dependabot', () => {
    expect(
      findDcoProblems([
        commit("Merge branch 'main' into S0-16", { parents: ['a', 'b'] }),
        commit('chore(deps): bump vitest from 5.0.4 to 5.0.5', {
          authorName: 'dependabot[bot]',
          authorEmail: '49699333+dependabot[bot]@users.noreply.github.com',
        }),
      ]),
    ).toEqual([]);
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
