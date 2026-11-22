// Turns on the Git hooks of the repository (`.githooks/`, §2.14) by pointing `core.hooksPath` at
// them; run by the `prepare` script of `pnpm install`. The relative path resolves in every linked
// worktree to that worktree's own `.githooks/`. Without Git or outside a work tree (the Docker
// build context has no `.git`) there is nothing to turn on; a `core.hooksPath` the developer set
// to another directory is kept.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HOOKS_PATH = '.githooks';

/**
 * Sets `core.hooksPath` in the repository's local configuration.
 * @param {(args: string[]) => string} git runs Git and returns its stdout, throws on failure
 * @returns {'installed' | 'no-work-tree' | {kept: string}} the outcome; `kept` names the other
 * hooks directory already configured
 */
export function installGitHooks(git) {
  try {
    if (git(['rev-parse', '--is-inside-work-tree']).trim() !== 'true') {
      return 'no-work-tree';
    }
  } catch {
    // No Git binary, or no repository.
    return 'no-work-tree';
  }
  let current = '';
  try {
    current = git(['config', 'core.hooksPath']).trim();
  } catch {
    // Not set: `git config` exits with 1.
  }
  if (current !== '' && current !== HOOKS_PATH) {
    return { kept: current };
  }
  git(['config', '--local', 'core.hooksPath', HOOKS_PATH]);
  return 'installed';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const git = (args) =>
    execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const outcome = installGitHooks(git);
  if (outcome === 'no-work-tree') {
    process.stdout.write('Git hooks not installed: no Git work tree.\n');
  } else if (typeof outcome === 'object') {
    process.stderr.write(
      `Git hooks not installed: core.hooksPath is already ${outcome.kept}. Run the hooks of ` +
        `${HOOKS_PATH}/ from there, or unset it and run pnpm install again (CONTRIBUTING.md).\n`,
    );
  }
}
