// Turns on the Git hooks of the repository (`.githooks/`, §2.14) by pointing `core.hooksPath` at
// them; run by the `prepare` script of `pnpm install`. The relative path resolves in every linked
// worktree to that worktree's own `.githooks/`. Without Git or outside a work tree (the Docker
// build context has no `.git`) there is nothing to turn on. The developer's own hooks win: a
// `core.hooksPath` set to another directory, or active hooks in `.git/hooks/` (which the setting
// would switch off silently), are kept, and the developer calls `.githooks/` from them.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const HOOKS_PATH = '.githooks';

/**
 * Sets `core.hooksPath` in the repository's local configuration.
 * @param {(args: string[]) => string} git runs Git and returns its stdout, throws on failure
 * @param {(dir: string) => string[]} listFiles names of the files in a directory, none if missing
 * @returns {'installed' | 'no-work-tree' | {kept: string}} the outcome; `kept` names the
 * developer's hooks directory that stays in use
 */
export function installGitHooks(git, listFiles) {
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
  if (current === '') {
    // Git's default hooks directory; the samples Git creates there are inactive.
    const hooks = git(['rev-parse', '--path-format=absolute', '--git-path', 'hooks']).trim();
    if (listFiles(hooks).some((name) => !name.endsWith('.sample'))) {
      return { kept: hooks };
    }
  } else if (current !== HOOKS_PATH) {
    return { kept: current };
  }
  git(['config', '--local', 'core.hooksPath', HOOKS_PATH]);
  return 'installed';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const git = (args) =>
    execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const listFiles = (dir) => {
    try {
      return readdirSync(dir);
    } catch {
      return [];
    }
  };
  const outcome = installGitHooks(git, listFiles);
  if (outcome === 'no-work-tree') {
    process.stdout.write('Git hooks not installed: no Git work tree.\n');
  } else if (typeof outcome === 'object') {
    process.stderr.write(
      `Git hooks not installed: your hooks in ${outcome.kept} stay in use. Call the hooks of ` +
        `${HOOKS_PATH}/ from them (CONTRIBUTING.md).\n`,
    );
  }
}
