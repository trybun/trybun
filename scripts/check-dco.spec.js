import { afterEach, describe, expect, it, vi } from 'vitest';
import { findDcoProblems, reportDcoProblems } from './check-dco.js';

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

describe('reportDcoProblems', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function report(commits) {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const count = reportDcoProblems(commits);
    return {
      count,
      stdout: stdout.mock.calls.map(([text]) => text).join(''),
      stderr: stderr.mock.calls.map(([text]) => text).join(''),
    };
  }

  it('reports signed-off commits', () => {
    expect(report([commit('fix: x\n\nSigned-off-by: Ada Lovelace <ada@example.com>')])).toEqual({
      count: 0,
      stdout: 'DCO: all 1 commits signed off.\n',
      stderr: '',
    });
  });

  it('names each commit without sign-off and how to add it', () => {
    const { count, stdout, stderr } = report([commit('fix: x'), commit('fix: y')]);
    expect(count).toBe(2);
    expect(stderr.split('\n').filter(Boolean)).toHaveLength(2);
    expect(stdout).toContain('DCO: 2 commits without sign-off');
    expect(stdout).toContain('`git rebase --signoff <base>`');
  });
});
