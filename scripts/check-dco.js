// DCO check of pull requests (§16.3): every commit of the pull request has a `Signed-off-by` line
// with the name and e-mail address of its author. Usage: node scripts/check-dco.js <base> <head>.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Authors that cannot sign off, by e-mail address. Dependabot is GitHub's service and its commits
 * carry no `Signed-off-by`; its pull requests are reviewed by a code owner like any other (§16.3).
 */
const EXEMPT_AUTHORS = new Set(['49699333+dependabot[bot]@users.noreply.github.com']);

const SIGN_OFF = /^Signed-off-by:\s*(.+?)\s*<([^>]+)>\s*$/gm;
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
 * Commits without the sign-off of their author.
 * @param {Commit[]} commits
 * @returns {string[]} one message per commit
 */
export function findDcoProblems(commits) {
  const problems = [];
  for (const { sha, parents, authorName, authorEmail, message } of commits) {
    // A merge commit (e.g. "Update branch") adds no change of its own.
    if (parents.length > 1 || EXEMPT_AUTHORS.has(authorEmail.toLowerCase())) {
      continue;
    }
    const signedOff = [...message.matchAll(SIGN_OFF)].some(
      ([, name, email]) =>
        name.toLowerCase() === authorName.toLowerCase() &&
        email.toLowerCase() === authorEmail.toLowerCase(),
    );
    if (!signedOff) {
      const subject = message.split('\n', 1)[0];
      problems.push(
        `${sha.slice(0, 12)} "${subject}": no "Signed-off-by: ${authorName} <${authorEmail}>"`,
      );
    }
  }
  return problems;
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

/** The commits reachable from `head` but not from `base`. */
function readCommits(base, head) {
  const format = ['%H', '%P', '%an', '%ae', '%B'].join('%x00') + '%x1e';
  return parseLog(
    execFileSync('git', ['log', `--format=${format}`, `${base}..${head}`], { encoding: 'utf8' }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) {
    process.stderr.write('Usage: node scripts/check-dco.js <base> <head>\n');
    process.exit(2);
  }
  const commits = readCommits(base, head);
  const problems = findDcoProblems(commits);
  for (const problem of problems) {
    process.stderr.write(`${problem}\n`);
  }
  process.stdout.write(
    problems.length === 0
      ? `DCO: all ${commits.length} commits signed off.\n`
      : `DCO: ${problems.length} commits without sign-off. Add it with ` +
          '`git rebase --signoff <base>` and push again (CONTRIBUTING.md).\n',
  );
  process.exitCode = problems.length === 0 ? 0 : 1;
}
