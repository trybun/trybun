// The Git hooks of `.githooks/` end to end (#438, #445): a real repository with the hooks turned on
// by `scripts/install-git-hooks.js`, commits through `git commit` and `git merge`, pushes to a bare
// remote. The verdicts match the CI jobs `Commit messages and title` and `DCO sign-off`.
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const DEPENDABOT = {
  GIT_AUTHOR_NAME: 'dependabot[bot]',
  GIT_AUTHOR_EMAIL: '49699333+dependabot[bot]@users.noreply.github.com',
};
const RELEASE_APP = {
  GIT_AUTHOR_NAME: 'trybun-release[bot]',
  GIT_AUTHOR_EMAIL: '123456789+trybun-release[bot]@users.noreply.github.com',
};
const TOO_LONG = `fix(web): ${'x'.repeat(101 - 'fix(web): '.length)}`;

let dir;
let work;

function run(command, args, { env = {}, cwd = work } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      // Only the scratch repository and its own configuration and hooks: no GIT_DIR,
      // GIT_WORK_TREE or GIT_CONFIG_* of a calling Git process.
      ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Ada Lovelace',
      GIT_AUTHOR_EMAIL: 'ada@example.com',
      GIT_COMMITTER_NAME: 'Ada Lovelace',
      GIT_COMMITTER_EMAIL: 'ada@example.com',
      ...env,
    },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const git = (...args) => run('git', args);

function commit(message, { env, verify = true, signOff = true } = {}) {
  return run(
    'git',
    [
      'commit',
      '--allow-empty',
      '-m',
      message,
      ...(signOff ? ['--signoff'] : []),
      ...(verify ? [] : ['--no-verify']),
    ],
    { env },
  );
}

const head = () => git('rev-parse', 'HEAD').output.trim();
const remoteHead = (branch) =>
  git('ls-remote', '../remote.git', `refs/heads/${branch}`).output.trim();

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'trybun-git-hooks-'));
  work = join(dir, 'work');
  mkdirSync(join(work, 'scripts'), { recursive: true });
  cpSync(join(ROOT, '.githooks'), join(work, '.githooks'), { recursive: true });
  cpSync(join(ROOT, 'commitlint.config.js'), join(work, 'commitlint.config.js'));
  cpSync(join(ROOT, 'package.json'), join(work, 'package.json'));
  for (const script of [
    'check-commit-messages.js',
    'check-dco.js',
    'check-pushed-commits.js',
    'install-git-hooks.js',
    'pull-request-commits.js',
  ]) {
    cpSync(join(ROOT, 'scripts', script), join(work, 'scripts', script));
  }
  symlinkSync(join(ROOT, 'node_modules'), join(work, 'node_modules'));
  writeFileSync(join(work, '.gitignore'), 'node_modules\n');
  run('git', ['init', '--bare', '-q', '-b', 'main', join(dir, 'remote.git')]);
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', '../remote.git');
  expect(run(process.execPath, ['scripts/install-git-hooks.js']).status).toBe(0);
  git('add', '.');
  expect(commit('chore: start').status).toBe(0);
  expect(git('push', '-q', 'origin', 'main').status).toBe(0);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('scripts/install-git-hooks.js', () => {
  it('turns on the hooks of .githooks/', () => {
    expect(git('config', '--local', 'core.hooksPath').output.trim()).toBe('.githooks');
  });

  it("keeps the developer's own hooks of .git/hooks/ and nothing else", () => {
    const other = join(dir, 'other');
    run('git', ['init', '-q', other]);
    // Not run by Git: not executable, or not a hook's name.
    writeFileSync(join(other, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\n', { mode: 0o644 });
    writeFileSync(join(other, '.git', 'hooks', 'pre-push.bak'), '#!/bin/sh\n', { mode: 0o755 });
    mkdirSync(join(other, '.git', 'hooks', 'commit-msg.d'));
    const script = join(work, 'scripts', 'install-git-hooks.js');
    expect(run(process.execPath, [script], { cwd: other }).status).toBe(0);
    expect(run('git', ['config', 'core.hooksPath'], { cwd: other }).output.trim()).toBe(
      '.githooks',
    );
    run('git', ['config', '--unset', 'core.hooksPath'], { cwd: other });
    // Run by Git.
    chmodSync(join(other, '.git', 'hooks', 'pre-commit'), 0o755);
    const { status, output } = run(process.execPath, [script], { cwd: other });
    expect(status).toBe(0);
    expect(output).toContain('stay in use');
    expect(run('git', ['config', 'core.hooksPath'], { cwd: other }).output).toBe('');
  });
});

describe('.githooks/commit-msg', () => {
  it('rejects a header over 100 characters', () => {
    const before = head();
    const { status, output } = commit(TOO_LONG);
    expect(status).not.toBe(0);
    expect(output).toContain('header-max-length');
    expect(head()).toBe(before);
  });

  it('rejects a scope outside the list of §2.14', () => {
    const { status, output } = commit('docs(specs): propose the ticket list');
    expect(status).not.toBe(0);
    expect(output).toContain('scope-enum');
  });

  it('accepts a valid message', () => {
    expect(commit('feat(web): add the ticket list').status).toBe(0);
  });

  it("accepts a merge commit with Git's default subject", () => {
    git('switch', '-q', '-c', 'topic');
    commit('fix(server): keep the order');
    git('switch', '-q', 'main');
    const { status } = git('merge', '--no-ff', '--no-edit', 'topic');
    expect(status).toBe(0);
    expect(git('log', '-1', '--format=%s').output.trim()).toBe("Merge branch 'topic'");
  });

  it('rejects a custom merge subject', () => {
    git('switch', '-q', '-c', 'other', 'main~1');
    commit('fix(ui): align the button');
    git('switch', '-q', 'main');
    const { status, output } = git('merge', '--no-ff', '-m', 'merge: other into main', 'other');
    expect(status).not.toBe(0);
    expect(output).toContain('type-enum');
    git('merge', '--abort');
  });
});

describe('.githooks/pre-push', () => {
  it('pushes valid, signed-off commits and merge commits', () => {
    const { status, output } = git('push', 'origin', 'main');
    expect(output).toContain('valid');
    expect(output).toContain('signed off');
    expect(git('log', '-1', '--format=%P').output.trim().split(' ')).toHaveLength(2);
    expect(git('log', '-1', '--format=%B').output).not.toContain('Signed-off-by');
    expect(status).toBe(0);
    expect(remoteHead('main')).toContain(head());
  });

  it('stops a push with a wrong message before it reaches the remote', () => {
    git('switch', '-q', '-c', 'fix/long', 'main');
    commit(TOO_LONG, { verify: false });
    const { status, output } = git('push', 'origin', 'fix/long');
    expect(status).not.toBe(0);
    expect(output).toContain('header-max-length');
    expect(output).toContain('Push stopped');
    expect(remoteHead('fix/long')).toBe('');
  });

  it('pushes once the message is reworded, without a force push', () => {
    git('commit', '--amend', '--allow-empty', '-q', '--signoff', '-m', 'fix(web): keep the rows');
    expect(git('push', 'origin', 'fix/long').status).toBe(0);
    expect(remoteHead('fix/long')).toContain(head());
  });

  it('stops a push with a commit without the sign-off of its author', () => {
    git('switch', '-q', '-c', 'fix/unsigned', 'main');
    commit('fix(web): keep the filter', { signOff: false });
    const sha = head().slice(0, 12);
    const { status, output } = git('push', 'origin', 'fix/unsigned');
    expect(status).not.toBe(0);
    expect(output).toContain(`${sha} "fix(web): keep the filter": no "Signed-off-by: Ada Lovelace`);
    expect(output).toContain('git rebase --signoff <base>');
    expect(output).toContain('Push stopped');
    expect(remoteHead('fix/unsigned')).toBe('');
  });

  it('stops a push with the sign-off of someone else than the author', () => {
    git('commit', '--amend', '--allow-empty', '--no-edit', '-q', '--signoff', '--no-verify');
    // Signed off by the committer, not by the author.
    git(
      'commit',
      '--amend',
      '--allow-empty',
      '--no-edit',
      '-q',
      '--no-verify',
      '--author=Bob <bob@example.com>',
    );
    expect(git('push', 'origin', 'fix/unsigned').status).not.toBe(0);
    expect(remoteHead('fix/unsigned')).toBe('');
  });

  it('pushes once the commit is signed off, without a force push', () => {
    git('commit', '--amend', '--allow-empty', '--no-edit', '-q', '--reset-author', '--signoff');
    const { status, output } = git('push', 'origin', 'fix/unsigned');
    expect(output).toContain('DCO: all 1 commits signed off');
    expect(status).toBe(0);
    expect(remoteHead('fix/unsigned')).toContain(head());
  });

  it('reports a wrong message and a missing sign-off together', () => {
    git('switch', '-q', '-c', 'fix/both', 'main');
    commit(TOO_LONG, { verify: false, signOff: false });
    const { status, output } = git('push', 'origin', 'fix/both');
    expect(status).not.toBe(0);
    expect(output).toContain('header-max-length');
    expect(output).toContain('DCO: 1 commits without sign-off');
    expect(output).toContain('reword the commits above');
    expect(output).toContain('sign off the commits above');
    expect(remoteHead('fix/both')).toBe('');
  });

  it("pushes Dependabot's commits, as CI does", () => {
    git('switch', '-q', '-c', 'dependabot/x', 'main');
    commit('fix(deps): Bump x from 1 to 2', { env: DEPENDABOT, verify: false, signOff: false });
    expect(git('push', 'origin', 'dependabot/x').status).toBe(0);
  });

  it("pushes the release app's commits, as CI does", () => {
    git('switch', '-q', '-c', 'release-please--branches--main', 'main');
    commit('chore(main): release 1.2.0', { env: RELEASE_APP, signOff: false });
    expect(git('push', 'origin', 'release-please--branches--main').status).toBe(0);
  });

  it('checks only the commits the push adds', () => {
    git('switch', '-q', 'main');
    git('push', '-q', '--no-verify', 'origin', 'main');
    git('switch', '-q', '-c', 'old', 'main');
    commit('Wrong message', { verify: false });
    git('push', '-q', '--no-verify', 'origin', 'old');
    commit('fix(web): next step');
    const { status, output } = git('push', 'origin', 'old');
    expect(status).toBe(0);
    expect(output).toContain('1 of 1 valid');
    expect(output).toContain('DCO: all 1 commits signed off');
  });

  it('deletes a remote branch', () => {
    expect(git('push', 'origin', '--delete', 'old').status).toBe(0);
    expect(remoteHead('old')).toBe('');
  });
});
