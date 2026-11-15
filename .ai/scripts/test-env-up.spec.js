import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
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

// Runs `.ai/scripts/test-env-up.sh` in a throwaway Git checkout, with stubs of docker, curl and
// pnpm on PATH (#352): only `--reset` removes the data volumes of the Compose project `trybun-test`.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPTS = ['test-env-up.sh', 'test-env-down.sh'];

// Each stub logs its arguments; `docker volume ls` answers from STUB_VOLUMES ("<project>_<volume>").
const STUBS = {
  docker: `#!/bin/sh
echo "docker $*" >>"$STUB_LOG"
case "$*" in
  "volume ls -q --filter label=com.docker.compose.project="*" --filter label=com.docker.compose.volume="*)
    project=\${5#label=com.docker.compose.project=}
    volume=\${7#label=com.docker.compose.volume=}
    for name in $STUB_VOLUMES; do
      if [ "$name" = "\${project}_$volume" ]; then echo "$name"; fi
    done ;;
  "volume rm "*) ;;
  "ps --filter publish="*) ;;
  "compose -p trybun-test -f compose.yaml -f compose.dev.yaml "*) ;;
  *) echo "unexpected: docker $*" >&2; exit 99 ;;
esac
`,
  // A port answers while a stubbed application holds it (a file "serving-<port>"); the health
  // checks pass once the boot has started the applications.
  curl: `#!/bin/sh
for arg in "$@"; do url=$arg; done
case "$url" in
  */health/ready | */api/health) exit 0 ;;
  */api/v1/users/me) printf 401 ;;
  http://localhost:3000/) [ -e "$STUB_DIR/serving-3000" ] || exit 7 ;;
  http://localhost:3001/) [ -e "$STUB_DIR/serving-3001" ] || exit 7 ;;
  *) exit 7 ;;
esac
`,
  // The API, the Worker and the web application run until test-env-down.sh stops them; like the
  // API's shutdown hooks, they keep their port for a moment after SIGTERM.
  pnpm: `#!/bin/sh
echo "pnpm $*" >>"$STUB_LOG"
case "$*" in
  "--filter @trybun/server start") port=3001 ;;
  "--filter @trybun/web exec next start --port 3000") port=3000 ;;
  "--filter "*) port=none ;;
  *) exit 0 ;;
esac
echo "$$" >>"$STUB_DIR/pids"
touch "$STUB_DIR/serving-$port"
trap 'sleep 1; rm -f "$STUB_DIR/serving-$port"; exit 0' TERM
while :; do sleep 1; done
`,
};

let folder;
let checkout;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'trybun-test-env-'));
  checkout = join(folder, 'checkout');
  mkdirSync(join(checkout, '.ai/scripts'), { recursive: true });
  for (const script of SCRIPTS) {
    copyFileSync(join(ROOT, '.ai/scripts', script), join(checkout, '.ai/scripts', script));
  }
  writeFileSync(join(checkout, '.ai/scripts/test-env-browser.sh'), 'echo "agent-browser 0.0.0"\n');
  writeFileSync(join(checkout, '.env.example'), '');
  writeFileSync(join(checkout, '.gitignore'), '.ai/qa/\n.env\n');
  mkdirSync(join(folder, 'bin'));
  for (const [name, script] of Object.entries(STUBS)) {
    writeFileSync(join(folder, 'bin', name), script);
    chmodSync(join(folder, 'bin', name), 0o755);
  }
  const git = (...args) => execFileSync('git', args, { cwd: checkout, stdio: 'ignore' });
  git('init', '-q');
  git('add', '.');
  git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.org',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-qm',
    'test',
  );
});

afterEach(() => {
  // Stops the stubbed applications of the last boot (their process groups).
  spawnSync('sh', ['.ai/scripts/test-env-down.sh'], { cwd: checkout, env: environment() });
  // And any of them a failed boot did not record.
  for (const pid of readLines(join(folder, 'pids'))) {
    try {
      process.kill(-Number(pid), 'SIGKILL');
    } catch {
      // Already stopped.
    }
  }
  rmSync(folder, { recursive: true, force: true });
});

function environment() {
  return {
    ...process.env,
    PATH: `${join(folder, 'bin')}:${process.env.PATH}`,
    STUB_LOG: join(folder, 'log'),
    STUB_DIR: folder,
    TEST_ENV_LOCK_DIR: join(folder, 'test-env.lock'),
    STUB_VOLUMES:
      'trybun-test_postgres-data trybun-test_valkey-data trybun-test_seaweedfs-data ' +
      'trybun-test_clamav-data trybun-dev_postgres-data trybun_postgres-data',
  };
}

function readLines(path) {
  try {
    return readFileSync(path, 'utf8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/** Runs test-env-up.sh and returns the log of the stubs written during this run. */
function up(...flags) {
  writeFileSync(join(folder, 'log'), '');
  const result = spawnSync('sh', ['.ai/scripts/test-env-up.sh', ...flags], {
    cwd: checkout,
    encoding: 'utf8',
    env: environment(),
    timeout: 60_000,
  });
  const log = readLines(join(folder, 'log'));
  return { ...result, log };
}

const removed = (log) =>
  log.filter((line) => line.startsWith('docker volume rm ')).map((line) => line.slice(17));
const indexOf = (log, prefix) => log.findIndex((line) => line.startsWith(prefix));

describe('test-env-up.sh', () => {
  it('keeps the data of earlier runs on a boot without --reset', () => {
    const { status, log, stderr } = up();

    expect(status, stderr).toBe(0);
    expect(removed(log)).toEqual([]);
    expect(log).not.toContain(
      'docker compose -p trybun-test -f compose.yaml -f compose.dev.yaml down',
    );
    expect(log).toContain('pnpm db:seed');
  });

  it('removes the data volumes of trybun-test before the infrastructure and the seed start', () => {
    const { status, log, stdout, stderr } = up('--reset');

    expect(status, stderr).toBe(0);
    expect(stdout).toContain('TEST_ENV_REUSED=0');
    expect(removed(log)).toEqual([
      'trybun-test_postgres-data',
      'trybun-test_valkey-data',
      'trybun-test_seaweedfs-data',
    ]);
    const down = indexOf(
      log,
      'docker compose -p trybun-test -f compose.yaml -f compose.dev.yaml down',
    );
    const removal = indexOf(log, 'docker volume rm ');
    const start = indexOf(
      log,
      'docker compose -p trybun-test -f compose.yaml -f compose.dev.yaml up',
    );
    expect(down).toBeGreaterThanOrEqual(0);
    expect(down).toBeLessThan(removal);
    expect(removal).toBeLessThan(start);
    expect(start).toBeLessThan(indexOf(log, 'pnpm db:migrate'));
    expect(readFileSync(join(checkout, '.ai/qa/test-env.json'), 'utf8')).toContain(
      'data reset: true',
    );
  });

  it('reuses a running environment without touching its data', () => {
    expect(up().status).toBe(0);

    const { status, log, stdout, stderr } = up();

    expect(status, stderr).toBe(0);
    expect(stdout).toContain('TEST_ENV_REUSED=1');
    expect(log.filter((line) => line.startsWith('docker ') || line.startsWith('pnpm '))).toEqual(
      [],
    );
  });

  it('replaces a running environment on --reset once its applications have released their ports', () => {
    expect(up().status).toBe(0);
    const before = JSON.parse(readFileSync(join(checkout, '.ai/qa/test-env.json'), 'utf8'));

    const { status, log, stdout, stderr } = up('--reset');

    expect(status, stderr).toBe(0);
    expect(stdout).toContain('TEST_ENV_REUSED=0');
    expect(removed(log)).toHaveLength(3);
    const after = JSON.parse(readFileSync(join(checkout, '.ai/qa/test-env.json'), 'utf8'));
    expect(after.app.apiPid).not.toBe(before.app.apiPid);
    expect(() => process.kill(Number(before.app.apiPid), 0)).toThrow();
  });
});
