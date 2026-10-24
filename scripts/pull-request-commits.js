// The commits of a pull request, shared by the commit checks of `.github/workflows/commitlint.yml`
// (DCO §16.3, commit messages §2.14).
import { execFileSync } from 'node:child_process';

/**
 * Authors exempt from the per-commit checks, by e-mail address. Dependabot is GitHub's service:
 * its commits carry no `Signed-off-by` and it chooses the case of the subject itself ("Bump …").
 * The release app `trybun-release` commits the release pull requests of release-please without a
 * `Signed-off-by` (ADR 0006); the user ID in its address is assigned by GitHub. Their pull
 * requests are reviewed by a code owner like any other, and their title – the squash commit on
 * `main` – is still checked (§16.3, §2.14).
 */
const EXEMPT_AUTHORS = [
  /^49699333\+dependabot\[bot\]@users\.noreply\.github\.com$/,
  /^\d+\+trybun-release\[bot\]@users\.noreply\.github\.com$/,
];

const FIELD = '\x00';
const RECORD = '\x1e';

/**
 * @typedef {object} Commit
 * @property {string} sha
 * @property {string[]} parents
 * @property {string} authorName
 * @property {string} authorEmail
 * @property {string} message
 */

/**
 * Whether the commit's author is exempt from the per-commit checks.
 * @param {Commit} commit
 */
export function isExemptAuthor({ authorEmail }) {
  const email = authorEmail.toLowerCase();
  return EXEMPT_AUTHORS.some((author) => author.test(email));
}

/**
 * Commits of `git log` output in the format of {@link readCommits}.
 * @param {string} output
 * @returns {Commit[]}
 */
export function parseLog(output) {
  return output
    .split(RECORD)
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record !== '')
    .map((record) => {
      const [sha, parents, authorName, authorEmail, message] = record.split(FIELD);
      return { sha, parents: parents.split(' ').filter(Boolean), authorName, authorEmail, message };
    });
}

/**
 * The commits reachable from `head` but not from `base`.
 * @param {string} base
 * @param {string} head
 * @returns {Commit[]}
 */
export function readCommits(base, head) {
  const format = ['%H', '%P', '%an', '%ae', '%B'].join('%x00') + '%x1e';
  return parseLog(
    execFileSync('git', ['log', `--format=${format}`, `${base}..${head}`], { encoding: 'utf8' }),
  );
}
