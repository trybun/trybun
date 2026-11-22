// Turns on the Git hooks of the repository (`.githooks/`, §2.14) by pointing `core.hooksPath` at
// them; run by the `prepare` script of `pnpm install`. The relative path resolves in every linked
// worktree to that worktree's own `.githooks/`. Without Git or outside a work tree (the Docker
// build context has no `.git`) there is nothing to turn on. The developer's own hooks win: a
// `core.hooksPath` set to another directory, or active hooks in `.git/hooks/` (which the setting
// would switch off silently), are kept, and the developer calls `.githooks/` from them.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOOKS_PATH = '.githooks';

/** The hooks Git runs, by name (githooks(5)). */
const GIT_HOOKS = new Set([
  'applypatch-msg',
  'pre-applypatch',
  'post-applypatch',
  'pre-commit',
  'pre-merge-commit',
  'prepare-commit-msg',
  'commit-msg',
  'post-commit',
  'pre-rebase',
  'post-checkout',
  'post-merge',
  'pre-push',
  'pre-receive',
  'update',
  'proc-receive',
  'post-receive',
  'post-update',
  'reference-transaction',
  'push-to-checkout',
  'pre-auto-gc',
  'post-rewrite',
  'sendemail-validate',
  'fsmonitor-watchman',
  'p4-changelist',
  'p4-prepare-changelist',
  'p4-post-changelist',
  'p4-pre-submit',
  'post-index-change',
]);

/**
 * Sets `core.hooksPath` in the repository's local configuration.
 * @param {(args: string[]) => string} git runs Git and returns its stdout, throws on failure
 * @param {(dir: string) => string[]} listExecutables names of the executable files in a directory,
 * none if it is missing
 * @returns {'installed' | 'no-work-tree' | {kept: string}} the outcome; `kept` names the
 * developer's hooks directory that stays in use
 */
export function installGitHooks(git, listExecutables) {
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
    // Git's default hooks directory: Git runs an executable file there with a hook's name; the
    // samples it creates (`*.sample`) and other files are inactive.
    const hooks = git(['rev-parse', '--git-path', 'hooks']).trim();
    if (listExecutables(hooks).some((name) => GIT_HOOKS.has(name))) {
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
  const listExecutables = (dir) => {
    let names = [];
    try {
      names = readdirSync(dir);
    } catch {
      // No hooks directory.
    }
    return names.filter((name) => {
      // A broken link is not run either.
      const stats = statSync(join(dir, name), { throwIfNoEntry: false });
      // Windows has no executable bit; Git for Windows runs any hook file.
      return (
        stats !== undefined &&
        stats.isFile() &&
        (process.platform === 'win32' || (stats.mode & 0o111) !== 0)
      );
    });
  };
  const outcome = installGitHooks(git, listExecutables);
  if (outcome === 'no-work-tree') {
    process.stdout.write('Git hooks not installed: no Git work tree.\n');
  } else if (typeof outcome === 'object') {
    process.stderr.write(
      `Git hooks not installed: your hooks in ${outcome.kept} stay in use. Call the hooks of ` +
        `${HOOKS_PATH}/ from them (CONTRIBUTING.md).\n`,
    );
  }
}
