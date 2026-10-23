// Commit message check of pull requests (§2.14): commitlint for every commit of the pull request
// except those of exempt authors (Dependabot); the pull request title is checked separately.
// Usage: node scripts/check-commit-messages.js <base> <head>.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { isExemptAuthor, readCommits } from './pull-request-commits.js';

/**
 * The commits whose messages are checked.
 * @param {import('./pull-request-commits.js').Commit[]} commits
 */
export function selectCommits(commits) {
  return commits.filter((commit) => !isExemptAuthor(commit));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) {
    process.stderr.write('Usage: node scripts/check-commit-messages.js <base> <head>\n');
    process.exit(2);
  }
  const commitlint = createRequire(import.meta.url).resolve('@commitlint/cli/cli.js');
  const commits = readCommits(base, head);
  const selected = selectCommits(commits);
  let failed = 0;
  for (const { sha, message } of selected) {
    process.stdout.write(`${sha.slice(0, 12)}:\n`);
    const { status } = spawnSync(process.execPath, [commitlint, '--verbose'], {
      input: message,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    if (status !== 0) {
      failed += 1;
    }
  }
  process.stdout.write(
    `Commit messages: ${selected.length - failed} of ${selected.length} valid` +
      `, ${commits.length - selected.length} by exempt authors skipped.\n`,
  );
  process.exitCode = failed === 0 ? 0 : 1;
}
