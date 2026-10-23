// DCO check of pull requests (§16.3): every commit of the pull request has a `Signed-off-by` line
// with the name and e-mail address of its author. Usage: node scripts/check-dco.js <base> <head>.
import { fileURLToPath } from 'node:url';
import { isExemptAuthor, readCommits } from './pull-request-commits.js';

const SIGN_OFF = /^Signed-off-by:\s*(.+?)\s*<([^>]+)>\s*$/gm;

/**
 * Commits without the sign-off of their author.
 * @param {import('./pull-request-commits.js').Commit[]} commits
 * @returns {string[]} one message per commit
 */
export function findDcoProblems(commits) {
  const problems = [];
  for (const commit of commits) {
    const { sha, parents, authorName, authorEmail, message } = commit;
    // A merge commit (e.g. "Update branch") adds no change of its own.
    if (parents.length > 1 || isExemptAuthor(commit)) {
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
