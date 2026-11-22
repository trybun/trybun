import { describe, expect, it, vi } from 'vitest';
import { HOOKS_PATH, installGitHooks } from './install-git-hooks.js';

/** A fake Git: `rev-parse` answers `workTree`, `config core.hooksPath` answers `hooksPath`. */
function fakeGit({ workTree = 'true', hooksPath } = {}) {
  return vi.fn((args) => {
    if (args[0] === 'rev-parse') {
      return `${workTree}\n`;
    }
    if (args.length === 2) {
      if (hooksPath === undefined) {
        throw new Error('exit 1');
      }
      return `${hooksPath}\n`;
    }
    return '';
  });
}

describe('installGitHooks', () => {
  it('points core.hooksPath at the hooks of the repository in a work tree', () => {
    const git = fakeGit();
    expect(installGitHooks(git)).toBe('installed');
    expect(git).toHaveBeenLastCalledWith(['config', '--local', 'core.hooksPath', HOOKS_PATH]);
  });

  it('sets it again when it already points there', () => {
    const git = fakeGit({ hooksPath: HOOKS_PATH });
    expect(installGitHooks(git)).toBe('installed');
  });

  it('keeps another hooks directory the developer configured', () => {
    const git = fakeGit({ hooksPath: '/home/ada/hooks' });
    expect(installGitHooks(git)).toEqual({ kept: '/home/ada/hooks' });
    expect(git).not.toHaveBeenCalledWith(['config', '--local', 'core.hooksPath', HOOKS_PATH]);
  });

  it('does nothing without Git or outside a repository', () => {
    const git = vi.fn(() => {
      throw new Error('fatal: not a git repository');
    });
    expect(installGitHooks(git)).toBe('no-work-tree');
    expect(git).toHaveBeenCalledTimes(1);
  });

  it('does nothing inside the .git directory of a repository', () => {
    const git = fakeGit({ workTree: 'false' });
    expect(installGitHooks(git)).toBe('no-work-tree');
    expect(git).toHaveBeenCalledTimes(1);
  });
});
