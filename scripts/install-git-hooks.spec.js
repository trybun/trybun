import { describe, expect, it, vi } from 'vitest';
import { HOOKS_PATH, installGitHooks } from './install-git-hooks.js';

const DEFAULT_HOOKS = '/repo/.git/hooks';
const INSTALL = ['config', '--local', 'core.hooksPath', HOOKS_PATH];

/** A fake Git: `rev-parse` answers `workTree`, `config core.hooksPath` answers `hooksPath`. */
function fakeGit({ workTree = 'true', hooksPath } = {}) {
  return vi.fn((args) => {
    if (args[0] === 'rev-parse') {
      return args[1] === '--is-inside-work-tree' ? `${workTree}\n` : `${DEFAULT_HOOKS}\n`;
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

const samples = () => ['pre-commit.sample', 'commit-msg.sample'];

describe('installGitHooks', () => {
  it('points core.hooksPath at the hooks of the repository in a work tree', () => {
    const git = fakeGit();
    const listFiles = vi.fn(samples);
    expect(installGitHooks(git, listFiles)).toBe('installed');
    expect(listFiles).toHaveBeenCalledWith(DEFAULT_HOOKS);
    expect(git).toHaveBeenLastCalledWith(INSTALL);
  });

  it('sets it again when it already points there', () => {
    expect(installGitHooks(fakeGit({ hooksPath: HOOKS_PATH }), samples)).toBe('installed');
  });

  it('keeps another hooks directory the developer configured', () => {
    const git = fakeGit({ hooksPath: '/home/ada/hooks' });
    expect(installGitHooks(git, samples)).toEqual({ kept: '/home/ada/hooks' });
    expect(git).not.toHaveBeenCalledWith(INSTALL);
  });

  it('keeps active hooks in the default hooks directory, which the setting would switch off', () => {
    const git = fakeGit();
    expect(installGitHooks(git, () => [...samples(), 'pre-commit'])).toEqual({
      kept: DEFAULT_HOOKS,
    });
    expect(git).not.toHaveBeenCalledWith(INSTALL);
  });

  it('installs over files Git does not run as hooks', () => {
    expect(installGitHooks(fakeGit(), () => ['pre-commit.bak', '.DS_Store', 'notes'])).toBe(
      'installed',
    );
  });

  it('does nothing without Git or outside a repository', () => {
    const git = vi.fn(() => {
      throw new Error('fatal: not a git repository');
    });
    expect(installGitHooks(git, samples)).toBe('no-work-tree');
    expect(git).toHaveBeenCalledTimes(1);
  });

  it('does nothing inside the .git directory of a repository', () => {
    const git = fakeGit({ workTree: 'false' });
    expect(installGitHooks(git, samples)).toBe('no-work-tree');
    expect(git).toHaveBeenCalledTimes(1);
  });
});
