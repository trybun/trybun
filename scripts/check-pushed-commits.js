// Commit checks before a push, run by `.githooks/pre-push`: the same checks as the CI jobs
// `Commit messages and title` (§2.14, `scripts/check-commit-messages.js`) and `DCO sign-off`
// (§16.3, `scripts/check-dco.js`), for the commits the push adds, so a wrong message or a missing
// sign-off is fixed locally instead of rewritten after the push. Git passes the pushed refs on
// stdin, one `<local ref> <local sha> <remote ref> <remote sha>` line each.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lintCommits } from './check-commit-messages.js';
import { reportDcoProblems } from './check-dco.js';
import { readUnpublishedCommits } from './pull-request-commits.js';

const DELETED = /^0+$/;

/**
 * The local commits of the pushed refs, without the refs the push deletes.
 * @param {string} input the stdin of the pre-push hook
 * @returns {string[]} unique commit SHAs
 */
export function parsePushedHeads(input) {
  const heads = input
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((fields) => fields.length === 4)
    .map(([, localSha]) => localSha)
    .filter((sha) => !DELETED.test(sha));
  return [...new Set(heads)];
}

/**
 * The commits the push adds, each once even when several pushed refs contain it.
 * @param {string[]} heads
 * @param {(head: string) => import('./pull-request-commits.js').Commit[]} read
 */
export function collectPushedCommits(heads, read = readUnpublishedCommits) {
  const commits = new Map();
  for (const head of heads) {
    for (const commit of read(head)) {
      commits.set(commit.sha, commit);
    }
  }
  return [...commits.values()];
}

/**
 * How to fix the commits the checks reported, or `null` when both passed.
 * @param {{ invalidMessages: number, unsigned: number }} failures
 * @returns {string | null}
 */
export function pushStoppedHint({ invalidMessages, unsigned }) {
  const fixes = [];
  if (invalidMessages > 0) {
    fixes.push(
      'reword the commits above (§2.14) – `git commit --amend` for the last one, ' +
        '`git rebase -i` with `reword` for an earlier one',
    );
  }
  if (unsigned > 0) {
    fixes.push(
      'sign off the commits above (§16.3) – `git commit --amend --no-edit --signoff` for the ' +
        'last one, `git rebase --signoff <base>` for all of them',
    );
  }
  return fixes.length === 0 ? null : `Push stopped: ${fixes.join('; ')} – and push again.\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const commits = collectPushedCommits(parsePushedHeads(readFileSync(0, 'utf8')));
  const hint = pushStoppedHint({
    invalidMessages: lintCommits(commits),
    unsigned: reportDcoProblems(commits),
  });
  if (hint) {
    process.stderr.write(hint);
    process.exitCode = 1;
  }
}
