import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Runs `.ai/scripts/test-env-pages.sh` in a throwaway Git checkout, with stubs of docker and pnpm
// on PATH (#440): the QA page records reach only the PostgreSQL of the Compose project
// `trybun-test`.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

// Each stub logs its arguments; `docker ps --filter publish=5432` answers the Compose project in
// STUB_HOLDER (none when empty) or fails with STUB_DOCKER_FAILS, and pnpm exits with STUB_PNPM_STATUS.
const STUBS = {
  docker: `#!/bin/sh
echo "docker $*" >>"$STUB_LOG"
case "$*" in
  "ps --filter publish=5432 --format {{.Label \\"com.docker.compose.project\\"}}")
    [ -z "\${STUB_DOCKER_FAILS:-}" ] || exit 1
    [ -z "$STUB_HOLDER" ] || echo "$STUB_HOLDER" ;;
  *) echo "unexpected: docker $*" >&2; exit 99 ;;
esac
`,
  pnpm: `#!/bin/sh
echo "pnpm $*" >>"$STUB_LOG"
exit "\${STUB_PNPM_STATUS:-0}"
`,
};

let folder;
let checkout;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'trybun-test-env-pages-'));
  checkout = join(folder, 'checkout');
  mkdirSync(join(checkout, '.ai/scripts'), { recursive: true });
  copyFileSync(
    join(ROOT, '.ai/scripts/test-env-pages.sh'),
    join(checkout, '.ai/scripts/test-env-pages.sh'),
  );
  mkdirSync(join(folder, 'bin'));
  for (const [name, script] of Object.entries(STUBS)) {
    writeFileSync(join(folder, 'bin', name), script);
    chmodSync(join(folder, 'bin', name), 0o755);
  }
  execFileSync('git', ['init', '-q'], { cwd: checkout, stdio: 'ignore' });
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

function run(args, environment = {}) {
  return spawnSync('sh', ['.ai/scripts/test-env-pages.sh', ...args], {
    cwd: checkout,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${join(folder, 'bin')}:${process.env.PATH}`,
      STUB_LOG: join(folder, 'calls.log'),
      STUB_HOLDER: 'trybun-test',
      ...environment,
    },
  });
}

function calls() {
  const log = join(folder, 'calls.log');
  return existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
}

const PNPM =
  'pnpm --filter @trybun/server exec tsx --env-file-if-exists=../../.env prisma/qa-pages.ts';

describe('test-env-pages.sh', () => {
  it.each(['add', 'remove'])('runs "%s" against the database of trybun-test', (action) => {
    const result = run([action]);

    expect(result.status).toBe(0);
    expect(calls()).toContain(`${PNPM} ${action}`);
  });

  it.each([
    ['pnpm dev or an installation', 'trybun'],
    ['no container', ''],
  ])('refuses while the port 5432 is published by %s', (_, holder) => {
    const result = run(['add'], { STUB_HOLDER: holder });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('start the test environment first');
    expect(calls().filter((call) => call.startsWith('pnpm'))).toEqual([]);
  });

  it.each([[[]], [['reset']], [['add', 'remove']]])('rejects the arguments %j', (args) => {
    const result = run(args);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Usage:');
    expect(calls()).toEqual([]);
  });

  it('refuses when the containers cannot be listed', () => {
    const result = run(['add'], { STUB_DOCKER_FAILS: '1' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('listing the containers failed');
    expect(calls().filter((call) => call.startsWith('pnpm'))).toEqual([]);
  });

  it('fails when adding the records fails', () => {
    const result = run(['add'], { STUB_PNPM_STATUS: '1' });

    expect(result.status).toBe(1);
  });
});
