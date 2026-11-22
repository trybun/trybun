import { describe, expect, it } from 'vitest';
import { collectPushedCommits, parsePushedHeads } from './check-pushed-commits.js';

const ZERO = '0'.repeat(40);
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

describe('parsePushedHeads', () => {
  it('reads the local commit of each pushed ref', () => {
    expect(
      parsePushedHeads(
        `refs/heads/fix/x ${A} refs/heads/fix/x ${ZERO}\nrefs/heads/y ${B} refs/heads/y ${A}\n`,
      ),
    ).toEqual([A, B]);
  });

  it('skips the refs the push deletes', () => {
    expect(parsePushedHeads(`(delete) ${ZERO} refs/heads/old ${A}\n`)).toEqual([]);
  });

  it('lists a commit pushed to several refs once', () => {
    expect(
      parsePushedHeads(`refs/heads/x ${A} refs/heads/x ${ZERO}\nHEAD ${A} refs/heads/y ${ZERO}\n`),
    ).toEqual([A]);
  });

  it('reads nothing from an empty push', () => {
    expect(parsePushedHeads('')).toEqual([]);
  });
});

describe('collectPushedCommits', () => {
  it('collects the commits of every pushed ref once', () => {
    const commit = (sha) => ({
      sha,
      parents: [],
      authorName: 'a',
      authorEmail: 'a@b',
      message: '',
    });
    const read = (head) => (head === A ? [commit('1'), commit('2')] : [commit('2'), commit('3')]);
    expect(collectPushedCommits([A, B], read).map(({ sha }) => sha)).toEqual(['1', '2', '3']);
  });
});
