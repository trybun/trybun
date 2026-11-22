import { describe, expect, it } from 'vitest';
import { collectPushedCommits, parsePushedHeads, pushStoppedHint } from './check-pushed-commits.js';

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

describe('pushStoppedHint', () => {
  it('lets the push through when both checks pass', () => {
    expect(pushStoppedHint({ invalidMessages: 0, unsigned: 0 })).toBeNull();
  });

  it('explains how to reword the messages', () => {
    const hint = pushStoppedHint({ invalidMessages: 1, unsigned: 0 });
    expect(hint).toContain('Push stopped: reword the commits above (§2.14)');
    expect(hint).not.toContain('sign off');
  });

  it('explains how to add the sign-off', () => {
    const hint = pushStoppedHint({ invalidMessages: 0, unsigned: 2 });
    expect(hint).toContain('Push stopped: sign off the commits above (§16.3)');
    expect(hint).toContain('`git commit --amend --no-edit --signoff`');
    expect(hint).toContain('`git rebase --signoff <base>`');
    expect(hint).not.toContain('reword');
  });

  it('explains both fixes when both checks fail', () => {
    const hint = pushStoppedHint({ invalidMessages: 1, unsigned: 1 });
    expect(hint).toContain('reword the commits above');
    expect(hint).toContain('sign off the commits above');
  });
});
