// Commit message check before a push (§2.14), run by `.githooks/pre-push`: the same check as the
// CI job `Commit messages and title` (`scripts/check-commit-messages.js`), for the commits the push
// adds, so a wrong message is reworded locally instead of rewritten after the push. Git passes the
// pushed refs on stdin, one `<local ref> <local sha> <remote ref> <remote sha>` line each.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lintCommits } from './check-commit-messages.js';
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const commits = collectPushedCommits(parsePushedHeads(readFileSync(0, 'utf8')));
  if (lintCommits(commits) > 0) {
    process.stderr.write(
      'Push stopped: reword the commits above (§2.14) – `git commit --amend` for the last one, ' +
        '`git rebase -i` with `reword` for an earlier one – and push again.\n',
    );
    process.exitCode = 1;
  }
}
