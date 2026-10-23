import { describe, expect, it } from 'vitest';
import { selectCommits } from './check-commit-messages.js';

function commit(message, overrides = {}) {
  return {
    sha: '0123456789abcdef',
    parents: ['fedcba'],
    authorName: 'Ada Lovelace',
    authorEmail: 'ada@example.com',
    message,
    ...overrides,
  };
}

describe('selectCommits', () => {
  it('checks the commits of people and agents', () => {
    const commits = [
      commit('feat(web): add the ticket list'),
      commit('fix(deps): Bump x', { authorName: 'dtk7c2-claude[bot]' }),
    ];
    expect(selectCommits(commits)).toEqual(commits);
  });

  it('skips the commits of Dependabot', () => {
    expect(
      selectCommits([
        commit('fix(deps): Bump adorsys/keycloak-config-cli', {
          authorName: 'dependabot[bot]',
          authorEmail: '49699333+dependabot[bot]@users.noreply.github.com',
        }),
      ]),
    ).toEqual([]);
  });

  it('does not skip a commit that only names Dependabot as its author', () => {
    expect(
      selectCommits([commit('fix(deps): Bump x', { authorName: 'dependabot[bot]' })]),
    ).toHaveLength(1);
  });
});
