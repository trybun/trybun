// The Git hooks of `.githooks/` end to end (#438): a real repository with the hooks turned on by
// `scripts/install-git-hooks.js`, commits through `git commit` and `git merge`, pushes to a bare
// remote. The verdicts match the CI job `Commit messages and title`.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const DEPENDABOT = {
  GIT_AUTHOR_NAME: 'dependabot[bot]',
  GIT_AUTHOR_EMAIL: '49699333+dependabot[bot]@users.noreply.github.com',
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

function commit(message, { env, verify = true } = {}) {
  return run(
    'git',
    ['commit', '--allow-empty', '-m', message, ...(verify ? [] : ['--no-verify'])],
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

  it("keeps the developer's own hooks of .git/hooks/", () => {
    const other = join(dir, 'other');
    run('git', ['init', '-q', other]);
    mkdirSync(join(other, '.git', 'hooks'), { recursive: true });
    writeFileSync(join(other, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\n', { mode: 0o755 });
    const { status, output } = run(
      process.execPath,
      [join(work, 'scripts', 'install-git-hooks.js')],
      {
        cwd: other,
      },
    );
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
  it('pushes valid commits and merge commits', () => {
    const { status, output } = git('push', 'origin', 'main');
    expect(output).toContain('valid');
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
    git('commit', '--amend', '--allow-empty', '-q', '-m', 'fix(web): keep the rows');
    expect(git('push', 'origin', 'fix/long').status).toBe(0);
    expect(remoteHead('fix/long')).toContain(head());
  });

  it("pushes Dependabot's commits, as CI does", () => {
    git('switch', '-q', '-c', 'dependabot/x', 'main');
    commit('fix(deps): Bump x from 1 to 2', { env: DEPENDABOT, verify: false });
    expect(git('push', 'origin', 'dependabot/x').status).toBe(0);
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
  });

  it('deletes a remote branch', () => {
    expect(git('push', 'origin', '--delete', 'old').status).toBe(0);
    expect(remoteHead('old')).toBe('');
  });
});
