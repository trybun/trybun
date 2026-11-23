import { execFileSync, spawn, spawnSync } from 'node:child_process';
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
  # The infrastructure counts as already running (not started by the boot) while this file exists.
  "compose -p trybun-test -f compose.yaml -f compose.dev.yaml ps -q postgres")
    [ ! -e "$STUB_DIR/compose-running" ] || echo postgres-container ;;
  # \`down\` fails as Compose does without the .env of compose.yaml while this file exists (#449).
  # ... and hangs while "compose-down-blocks" exists, so a test can cut a stop off during it.
  "compose -p trybun-test -f compose.yaml -f compose.dev.yaml down")
    if [ -e "$STUB_DIR/compose-down-blocks" ]; then
      sleep 300 &
      echo "$!" >>"$STUB_DIR/grandchildren"
      wait
    fi
    if [ -e "$STUB_DIR/compose-down-fails" ]; then
      echo 'required variable TRYBUN_S3_ACCESS_KEY_ID is missing a value' >&2
      exit 1
    fi ;;
  "compose -p trybun-test -f compose.yaml -f compose.dev.yaml "*) ;;
  *) echo "unexpected: docker $*" >&2; exit 99 ;;
esac
`,
  // A port answers while a stubbed application holds it (a file "serving-<port>"); the health
  // checks pass once the boot has started the applications, unless the file "unhealthy" exists.
  curl: `#!/bin/sh
for arg in "$@"; do url=$arg; done
case "$url" in
  */health/ready | */api/health) [ ! -e "$STUB_DIR/unhealthy" ] || exit 7 ;;
  */api/v1/users/me) printf 401 ;;
  http://localhost:3000/) [ -e "$STUB_DIR/serving-3000" ] || exit 7 ;;
  http://localhost:3001/) [ -e "$STUB_DIR/serving-3001" ] || exit 7 ;;
  *) exit 7 ;;
esac
`,
  // The API, the Worker and the web application run until test-env-down.sh stops them; like the
  // API's shutdown hooks, they keep their port for a moment after SIGTERM (STUB_STOP_SECONDS, 1 by
  // default). The boot step named by STUB_BLOCK (e.g. "build") hangs with a grandchild process,
  // so a test can interrupt the boot while that step runs.
  pnpm: `#!/bin/sh
echo "pnpm $*" >>"$STUB_LOG"
if [ -n "\${STUB_BLOCK:-}" ] && [ "$*" = "$STUB_BLOCK" ]; then
  sleep 300 &
  echo "$!" >>"$STUB_DIR/grandchildren"
  touch "$STUB_DIR/blocked"
  wait
  exit 0
fi
case "$*" in
  "--filter @trybun/server start") port=3001 ;;
  "--filter @trybun/web exec next start --port 3000") port=3000 ;;
  "--filter "*) port=none ;;
  *) exit 0 ;;
esac
echo "$$" >>"$STUB_DIR/pids"
touch "$STUB_DIR/serving-$port"
trap 'sleep "\${STUB_STOP_SECONDS:-1}"; rm -f "$STUB_DIR/serving-$port"; exit 0' TERM
while :; do sleep 1; done
`,
};

let folder;
let checkout;
/** Variables a test adds to the environment of the script (e.g. STUB_BLOCK). */
let extraEnvironment;
/** The scripts start() ran, stopped after each test. */
let started;

beforeEach(() => {
  extraEnvironment = {};
  started = [];
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
  // Ends the scripts a test left attached (their process groups), before their own handlers can
  // act on what follows.
  for (const child of started) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // Already exited.
    }
  }
  // Stops the stubbed applications of the last boot (their process groups).
  spawnSync('sh', ['.ai/scripts/test-env-down.sh'], { cwd: checkout, env: environment() });
  // And any of them a failed boot did not record (applications by group, blocked steps by PID).
  const targets = [
    ...readLines(join(folder, 'pids')).map((pid) => -Number(pid)),
    ...readLines(join(folder, 'grandchildren')).map(Number),
  ];
  for (const target of targets) {
    try {
      process.kill(target, 'SIGKILL');
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
function up(...args) {
  const { timeout = 60_000 } = typeof args.at(-1) === 'object' ? args.pop() : {};
  writeFileSync(join(folder, 'log'), '');
  const result = spawnSync('sh', ['.ai/scripts/test-env-up.sh', ...args], {
    cwd: checkout,
    encoding: 'utf8',
    env: { ...environment(), ...extraEnvironment },
    timeout,
  });
  const log = readLines(join(folder, 'log'));
  return { ...result, log };
}

/**
 * Starts test-env-up.sh in the background in its own process group, as a terminal tab runs it.
 * `output(pattern)` waits until stdout or stderr matches; `exit` settles with the exit code or
 * signal. Every wait is bounded.
 */
function start(...args) {
  writeFileSync(join(folder, 'log'), '');
  const child = spawn('sh', ['.ai/scripts/test-env-up.sh', ...args], {
    cwd: checkout,
    env: { ...environment(), ...extraEnvironment },
    detached: true,
  });
  started.push(child);
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (data) => (stdout += data));
  child.stderr.on('data', (data) => (stderr += data));
  const exit = new Promise((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });
  return {
    child,
    exit,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
    /** Sends a signal to the whole process group, like a closed terminal (`SIGHUP`). */
    signalGroup(signal) {
      process.kill(-child.pid, signal);
    },
    async output(pattern, timeout = 30_000) {
      await until(
        () => pattern.test(stdout) || pattern.test(stderr),
        timeout,
        () => `no ${pattern} in\n${stdout}\n${stderr}`,
      );
    },
    async exited(timeout = 30_000) {
      return Promise.race([
        exit,
        sleep(timeout).then(() => {
          throw new Error(`still running after ${timeout} ms\n${stdout}\n${stderr}`);
        }),
      ]);
    },
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(condition, timeout, message) {
  const deadline = Date.now() + timeout;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(message());
    await sleep(100);
  }
}

const alive = (pid) => {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
};
const descriptor = () => JSON.parse(readFileSync(join(checkout, '.ai/qa/test-env.json'), 'utf8'));
const lockExists = () => existsSync(join(folder, 'test-env.lock'));

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

  it('returns after the boot and after a reuse, leaving the bootstrap lock free', () => {
    const boot = up();
    expect(boot.status, boot.stderr).toBe(0);
    expect(boot.stdout).toMatch(/TEST_ENV_STATUS=running\n(.*\n)*TEST_ENV_REUSED=0\n/);
    expect(lockExists()).toBe(false);

    const reuse = up();
    expect(reuse.status, reuse.stderr).toBe(0);
    expect(reuse.stdout).toContain('TEST_ENV_REUSED=1');
    expect(lockExists()).toBe(false);
  });

  it('prints the run id of the environment it booted or reused', () => {
    const boot = up();
    const { runId } = descriptor();
    expect(boot.stdout).toContain(`TEST_ENV_RUN_ID=${runId}\n`);

    expect(up().stdout).toContain(`TEST_ENV_RUN_ID=${runId}\n`);
  });

  it("waits for a bootstrap of another user's process instead of taking its lock", () => {
    // PID 1 exists but belongs to root: `kill -0` fails with EPERM for it, `ps -p` finds it.
    mkdirSync(join(folder, 'test-env.lock'));
    writeFileSync(join(folder, 'test-env.lock/owner.json'), '{ "pid": "1" }\n');

    const { signal, stderr, log } = up({ timeout: 3_000 });

    expect(signal).toBe('SIGTERM');
    expect(stderr).not.toContain('removing the stale lock');
    expect(log).toEqual([]);
  });

  it('takes over the lock of a bootstrap that no longer runs', () => {
    const gone = spawnSync('sh', ['-c', 'echo $$']).stdout.toString().trim();
    mkdirSync(join(folder, 'test-env.lock'));
    writeFileSync(join(folder, 'test-env.lock/owner.json'), `{ "pid": "${gone}" }\n`);

    const { status, stderr } = up();

    expect(status, stderr).toBe(0);
    expect(stderr).toContain(`removing the stale lock of PID ${gone}`);
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

// The scripts boot, signal and stop real processes: more time than Vitest's default of 5 s, also
// under the load of the coverage run.
const PROCESS_TESTS = { timeout: 60_000 };

describe('an interrupted boot (#383)', PROCESS_TESTS, () => {
  const compose = 'docker compose -p trybun-test -f compose.yaml -f compose.dev.yaml';

  async function interruptedClean() {
    // The cleanup runs in its own session: wait until it has released the lock.
    await until(
      () => !lockExists(),
      20_000,
      () => 'the lock is still held',
    );
    for (const pid of readLines(join(folder, 'grandchildren'))) expect(alive(pid), pid).toBe(false);
    for (const pid of readLines(join(folder, 'pids'))) expect(alive(pid), pid).toBe(false);
    expect(existsSync(join(folder, 'serving-3000'))).toBe(false);
    expect(existsSync(join(checkout, '.ai/qa/test-env.json'))).toBe(false);
  }

  it.each(['build', 'db:migrate'])(
    'stops the running %s step with its children, the infrastructure and the lock on SIGTERM to its PID',
    async (step) => {
      extraEnvironment = { STUB_BLOCK: step };
      const run = start();
      await until(
        () => existsSync(join(folder, 'blocked')),
        20_000,
        () => run.stderr,
      );

      run.child.kill('SIGTERM');

      expect((await run.exited()).code).toBe(143);
      await interruptedClean();
      const log = readLines(join(folder, 'log'));
      expect(log).toContain(`${compose} down`);
    },
  );

  it('logs a failed compose down of its cleanup instead of reporting it cleaned up (#449)', async () => {
    extraEnvironment = { STUB_BLOCK: 'build' };
    writeFileSync(join(folder, 'compose-down-fails'), '');
    const run = start();
    await until(
      () => existsSync(join(folder, 'blocked')),
      20_000,
      () => run.stderr,
    );

    run.child.kill('SIGTERM');

    expect((await run.exited()).code).toBe(143);
    await interruptedClean();
    const log = readFileSync(join(checkout, '.ai/qa/logs/boot-interrupt.log'), 'utf8');
    expect(log).toContain('TRYBUN_S3_ACCESS_KEY_ID is missing a value');
    expect(log).toContain('stopping the infrastructure failed');
    expect(log).not.toContain('interrupted boot cleaned up');
  });

  it('finishes its cleanup when a closed terminal keeps hanging up its group', async () => {
    extraEnvironment = { STUB_BLOCK: 'build' };
    const run = start();
    await until(
      () => existsSync(join(folder, 'blocked')),
      20_000,
      () => run.stderr,
    );

    const deadline = Date.now() + 500;
    while (Date.now() < deadline) {
      try {
        run.signalGroup('SIGHUP');
      } catch {
        break; // The group has exited.
      }
      await sleep(2);
    }

    expect((await run.exited()).code).toBe(129);
    await interruptedClean();
    expect(readLines(join(folder, 'log'))).toContain(`${compose} down`);
  });

  it('stops the started applications while it waits for their health', async () => {
    writeFileSync(join(folder, 'unhealthy'), '');
    const run = start();
    await until(
      () => existsSync(join(folder, 'serving-3000')),
      20_000,
      () => run.stderr,
    );

    run.child.kill('SIGTERM');

    expect((await run.exited()).code).toBe(143);
    await interruptedClean();
  });

  it('finishes its cleanup when the process group gets SIGKILL after SIGTERM', async () => {
    writeFileSync(join(folder, 'unhealthy'), '');
    // The applications need 4 s to stop, longer than the caller waits before SIGKILL.
    extraEnvironment = { STUB_STOP_SECONDS: '4' };
    const run = start();
    await until(
      () => existsSync(join(folder, 'serving-3000')),
      20_000,
      () => run.stderr,
    );

    run.signalGroup('SIGTERM');
    await sleep(2_000);
    run.signalGroup('SIGKILL');

    expect((await run.exited()).signal).toBe('SIGKILL');
    await interruptedClean();
    expect(readLines(join(folder, 'log'))).toContain(`${compose} down`);
  });

  it('records each application as the leader of its own process group', () => {
    expect(up().status).toBe(0);
    for (const pid of [descriptor().app.apiPid, descriptor().app.webPid]) {
      // Each application leads its own process group, which test-env-down.sh stops (#410).
      const group = execFileSync('ps', ['-o', 'pgid=', '-p', pid], { encoding: 'utf8' }).trim();
      expect(group).toBe(pid);
    }
    expect(descriptor().status).toBe('running');
  });
});

describe('--foreground (#383)', PROCESS_TESTS, () => {
  const composeDown = 'docker compose -p trybun-test -f compose.yaml -f compose.dev.yaml down';
  const downs = () => readLines(join(folder, 'log')).filter((line) => line === composeDown).length;
  const applications = () => {
    const { apiPid, workerPid, webPid } = descriptor().app;
    return [apiPid, workerPid, webPid];
  };
  const owner = /attached in the foreground as the owner/;
  const viewer = /attached in the foreground as a viewer/;

  async function stopped(pids) {
    await until(
      () => descriptor().status === 'stopped' && pids.every((pid) => !alive(pid)),
      20_000,
      () => `status ${descriptor().status}`,
    );
  }

  describe('as the owner of the environment it booted', () => {
    it.each([
      ['SIGTERM to its PID', (run) => run.child.kill('SIGTERM')],
      ['SIGHUP to its process group (a closed terminal)', (run) => run.signalGroup('SIGHUP')],
    ])('stops the environment on %s', async (_, send) => {
      const run = start('--foreground');
      await run.output(owner);
      expect(run.stdout).toContain('TEST_ENV_REUSED=0');
      const pids = applications();

      send(run);

      expect((await run.exited()).code).toBe(0);
      await stopped(pids);
      expect(downs()).toBe(1);
    });

    it('stops the environment when a closed terminal delivers SIGHUP more than once', async () => {
      // A closed terminal tab can hang up the group and then signal it again; the second signal
      // must not kill the handler's own reads of the descriptor (#383, QA of #417).
      const run = start('--foreground');
      await run.output(owner);
      const pids = applications();

      // Keep hanging up the group for half a second, as a terminal that closes and then loses its
      // session leader does, so a signal lands while the handler's own commands run.
      const deadline = Date.now() + 500;
      while (Date.now() < deadline) {
        try {
          run.signalGroup('SIGHUP');
        } catch {
          break; // The group has exited.
        }
        await sleep(2);
      }

      expect((await run.exited()).code).toBe(0);
      await stopped(pids);
      expect(downs()).toBe(1);
    });

    it('exits 1 and leaves the environment not stopped when the compose down fails (#449)', async () => {
      const run = start('--foreground');
      await run.output(owner);
      const pids = applications();
      writeFileSync(join(folder, 'compose-down-fails'), '');

      run.child.kill('SIGTERM');

      expect((await run.exited()).code).toBe(1);
      expect(descriptor().status).toBe('stop-failed');
      for (const pid of pids) expect(alive(pid), pid).toBe(false);
      const log = readFileSync(join(checkout, '.ai/qa/logs/foreground.log'), 'utf8');
      expect(log).toContain('stopping the infrastructure failed, see .ai/qa/logs/down.log');
      expect(log).toMatch(/stopping environment \S+ failed/);
    });

    it('exits 1 and names the failed stop when an application crashes and the compose down fails (#449)', async () => {
      const run = start('--foreground');
      await run.output(owner);
      const pids = applications();
      writeFileSync(join(folder, 'compose-down-fails'), '');

      process.kill(-Number(descriptor().app.webPid), 'SIGKILL');

      expect((await run.exited()).code).toBe(1);
      expect(run.stderr).toMatch(
        /stopping environment \S+ failed; see \.ai\/qa\/logs\/foreground\.log/,
      );
      expect(descriptor().status).toBe('stop-failed');
      for (const pid of pids) expect(alive(pid), pid).toBe(false);
    });

    it('leaves the infrastructure running when its boot did not start it', async () => {
      writeFileSync(join(folder, 'compose-running'), '');
      const run = start('--foreground');
      await run.output(owner);
      const pids = applications();

      run.child.kill('SIGTERM');

      expect((await run.exited()).code).toBe(0);
      await stopped(pids);
      expect(downs()).toBe(0);
    });

    it('holds no bootstrap lock while attached', async () => {
      const run = start('--foreground');
      await run.output(owner);

      expect(lockExists()).toBe(false);
    });

    it('stops the rest and exits 1 when an application crashes', async () => {
      const run = start('--foreground');
      await run.output(owner);
      const pids = applications();

      process.kill(-Number(descriptor().app.webPid), 'SIGKILL');

      expect((await run.exited()).code).toBe(1);
      await stopped(pids);
    });

    it('keeps exit code 1 when a signal arrives during the teardown after a crash', async () => {
      // The remaining applications need 4 s to stop, so the signal lands during the teardown.
      extraEnvironment = { STUB_STOP_SECONDS: '4' };
      const run = start('--foreground');
      await run.output(owner);
      const pids = applications();

      process.kill(-Number(descriptor().app.webPid), 'SIGKILL');
      await run.output(/an application of environment .* exited/);
      run.child.kill('SIGTERM');

      expect((await run.exited()).code).toBe(1);
      await stopped(pids);
      expect(downs()).toBe(1);
    });

    it('detaches without a second teardown when the environment is stopped by hand', async () => {
      const run = start('--foreground');
      await run.output(owner);

      expect(
        spawnSync('sh', ['.ai/scripts/test-env-down.sh'], { cwd: checkout, env: environment() })
          .status,
      ).toBe(0);

      expect((await run.exited()).code).toBe(0);
      expect(run.stderr).toMatch(/stopped elsewhere/);
      expect(downs()).toBe(1);
    });

    it('detaches and leaves its successor alone when another start replaces the environment', async () => {
      const run = start('--foreground');
      await run.output(owner);
      const before = descriptor().runId;

      const reset = up('--reset');
      expect(reset.status, reset.stderr).toBe(0);

      expect((await run.exited()).code).toBe(0);
      // Its poll sees the old run stopping, stopped, or already replaced, depending on timing.
      expect(run.stderr).toMatch(/was stopped elsewhere \((stopping|stopped)\)|was replaced by /);
      expect(descriptor().runId).not.toBe(before);
      expect(descriptor().status).toBe('running');
      for (const pid of applications()) expect(alive(pid), pid).toBe(true);
    });

    it('stops the environment for a signal as soon as the boot result is printed', async () => {
      const run = start('--foreground');
      await run.output(/TEST_ENV_RUN_ID=/);

      run.child.kill('SIGTERM');

      expect((await run.exited()).code).toBe(0);
      expect(descriptor().status).toBe('stopped');
      expect(downs()).toBe(1);
    });

    it('leaves the cleanup of an interrupted boot to the boot itself', async () => {
      extraEnvironment = { STUB_BLOCK: 'build' };
      const run = start('--foreground');
      await until(
        () => existsSync(join(folder, 'blocked')),
        20_000,
        () => run.stderr,
      );

      run.child.kill('SIGTERM');

      expect((await run.exited()).code).toBe(143);
      await until(
        () => !lockExists(),
        20_000,
        () => 'the lock is still held',
      );
      for (const pid of readLines(join(folder, 'grandchildren')))
        expect(alive(pid), pid).toBe(false);
      expect(existsSync(join(checkout, '.ai/qa/test-env.json'))).toBe(false);
      expect(downs()).toBe(1);
    });

    it('finishes the teardown when its process group gets SIGKILL after SIGTERM', async () => {
      // The applications need 4 s to stop, longer than sv-prepare-qa-tests waits before SIGKILL.
      extraEnvironment = { STUB_STOP_SECONDS: '4' };
      const run = start('--foreground');
      await run.output(owner);
      const pids = applications();

      run.signalGroup('SIGTERM');
      await sleep(2_000);
      run.signalGroup('SIGKILL');

      expect((await run.exited()).signal).toBe('SIGKILL');
      await stopped(pids);
    });
  });

  describe('as a viewer of a running environment', () => {
    it('stops nothing when its terminal closes', async () => {
      expect(up().status).toBe(0);
      const run = start('--foreground');
      await run.output(viewer);
      expect(run.stdout).toContain('TEST_ENV_REUSED=1');
      // The viewer says how the environment is stopped, since closing it does not (QA of #417).
      expect(run.stderr).toContain(
        "to stop the environment, close the owner's terminal or run: sh .ai/scripts/test-env-down.sh",
      );

      run.signalGroup('SIGHUP');

      expect((await run.exited()).code).toBe(0);
      expect(descriptor().status).toBe('running');
      for (const pid of applications()) expect(alive(pid), pid).toBe(true);
      expect(downs()).toBe(0);
    });

    it('detaches when the environment is stopped elsewhere', async () => {
      expect(up().status).toBe(0);
      const run = start('--foreground');
      await run.output(viewer);

      expect(
        spawnSync('sh', ['.ai/scripts/test-env-down.sh'], { cwd: checkout, env: environment() })
          .status,
      ).toBe(0);

      expect((await run.exited()).code).toBe(0);
      expect(run.stderr).toMatch(/stopped elsewhere \((stopping|stopped)\)/);
    });
  });

  it('refuses, stopping nothing, when another checkout or pnpm dev serves port 3000', () => {
    writeFileSync(join(folder, 'serving-3000'), '');

    const run = up('--foreground');

    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
      'port 3000 is already served – by the test environment of another checkout or by pnpm dev. This checkout never stops it',
    );
    expect(run.log.filter((line) => line.endsWith(' down'))).toEqual([]);
    expect(existsSync(join(folder, 'serving-3000'))).toBe(true);
  });

  it('refuses --force', () => {
    const { status, stderr } = up('--foreground', '--force');

    expect(status).toBe(2);
    expect(stderr).toContain('--foreground cannot be combined with --force');
  });
});

describe('test-env-down.sh', PROCESS_TESTS, () => {
  /** Process groups of other programs, as the kernel may start them under a recorded PID. */
  let unrelated;

  beforeEach(() => {
    unrelated = [];
  });

  afterEach(() => {
    for (const pid of unrelated) {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        // Already stopped.
      }
    }
  });

  /**
   * Simulates the reuse of the recorded PIDs once the applications have exited (#452): each of
   * them now leads the process group of an unrelated program running `command`. Returns those
   * programs' PIDs.
   */
  function reuseRecordedPids(command = 'sleep 300') {
    let text = readFileSync(join(checkout, '.ai/qa/test-env.json'), 'utf8');
    const pids = [];
    for (const key of ['apiPid', 'workerPid', 'webPid']) {
      // Started by a shell that exits at once, so the program is not a child of this test, whose
      // event loop – blocked in spawnSync – would leave it a zombie, still "alive", once signalled.
      const pid = execFileSync('sh', ['-c', `setsid ${command} >/dev/null 2>&1 & echo $!`], {
        encoding: 'utf8',
      }).trim();
      unrelated.push(Number(pid));
      pids.push(pid);
      // It leads its own group, as an application of the environment did under that PID.
      expect(execFileSync('ps', ['-o', 'pgid=', '-p', pid], { encoding: 'utf8' }).trim()).toBe(pid);
      text = text.replace(new RegExp(`"${key}": "\\d+"`), `"${key}": "${pid}"`);
    }
    writeFileSync(join(checkout, '.ai/qa/test-env.json'), text);
    expect(descriptor().app).toMatchObject({
      apiPid: pids[0],
      workerPid: pids[1],
      webPid: pids[2],
    });
    return pids;
  }

  const down = () =>
    spawnSync('sh', ['.ai/scripts/test-env-down.sh'], {
      cwd: checkout,
      encoding: 'utf8',
      env: environment(),
    });

  const groupAlive = (pid) => alive(-Number(pid));
  const members = (group) =>
    execFileSync('ps', ['-e', '-o', 'pid=', '-o', 'pgid='], { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim().split(/\s+/))
      .filter(([, pgid]) => pgid === String(group))
      .map(([pid]) => pid);

  /**
   * Ends the applications without a stop, as a crash with no --foreground owner or a reboot does
   * (#453): the descriptor still says "running", and nothing holds their ports any more.
   */
  async function endWithoutStop() {
    const { apiPid, workerPid, webPid } = descriptor().app;
    for (const pid of [apiPid, workerPid, webPid]) process.kill(-Number(pid), 'SIGKILL');
    await until(
      () => [apiPid, workerPid, webPid].every((pid) => !groupAlive(pid)),
      10_000,
      () => 'the applications still run',
    );
    for (const port of [3000, 3001]) rmSync(join(folder, `serving-${port}`), { force: true });
    expect(descriptor().status).toBe('running');
  }

  describe('of a running descriptor whose applications ended without a stop (#453)', () => {
    it('signals none of the other programs that now lead the recorded process groups', async () => {
      expect(up().status).toBe(0);
      await endWithoutStop();
      const pids = reuseRecordedPids();

      const { status, stdout, stderr } = down();

      expect(status).toBe(0);
      expect(stdout).toContain('TEST_ENV_STATUS=stopped');
      for (const pid of pids) expect(alive(pid), pid).toBe(true);
      expect(stderr).toContain(`process group ${pids[0]} (apiPid) is not an application`);
      expect(descriptor().status).toBe('stopped');
    });

    it('signals none of them when the next boot restarts the stale environment', async () => {
      expect(up().status).toBe(0);
      await endWithoutStop();
      const pids = reuseRecordedPids();
      // The stubbed health checks still pass, so the reuse check finds the environment stale by its
      // age instead of by its health, as after a reboot; the restart runs the same down.
      extraEnvironment = { TEST_ENV_CACHE_TTL_SECONDS: '0' };

      const boot = up();

      expect(boot.status, boot.stderr).toBe(0);
      expect(boot.stderr).toContain('the recorded environment is stale; restarting it');
      for (const pid of pids) expect(alive(pid), pid).toBe(true);
      expect(descriptor().status).toBe('running');
      expect(descriptor().app.webPid).not.toBe(pids[2]);
    });

    it("signals none of them when they carry another boot's run id", async () => {
      expect(up().status).toBe(0);
      await endWithoutStop();
      // E.g. the environment of another checkout, whose run id starts like this one's.
      const pids = reuseRecordedPids(`env TEST_ENV_RUN_ID=${descriptor().runId}0 sleep 300`);

      expect(down().status).toBe(0);

      for (const pid of pids) expect(alive(pid), pid).toBe(true);
    });
  });

  /**
   * Sets startedAt of the descriptor to now (plus `seconds`), as a boot does when it records its
   * applications.
   */
  function recordNow(seconds = 0) {
    const at = new Date(Date.now() + seconds * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
    const text = readFileSync(join(checkout, '.ai/qa/test-env.json'), 'utf8').replace(
      /"startedAt": "[^"]*"/,
      `"startedAt": "${at}"`,
    );
    writeFileSync(join(checkout, '.ai/qa/test-env.json'), text);
  }

  /** Makes the descriptor one of a boot before #453, without app.runIdInEnvironment. */
  function untagged() {
    const text = readFileSync(join(checkout, '.ai/qa/test-env.json'), 'utf8');
    writeFileSync(
      join(checkout, '.ai/qa/test-env.json'),
      text.replace('"runIdInEnvironment": true, ', ''),
    );
    expect(descriptor().app.runIdInEnvironment).toBeUndefined();
  }

  it('signals no recorded group without the run id, even one older than the boot (#453)', async () => {
    expect(up().status).toBe(0);
    await endWithoutStop();
    const pids = reuseRecordedPids();
    // Older than startedAt, as after a backward step of the clock: no proof for a boot since #453.
    await sleep(2_100);
    recordNow();

    expect(down().status).toBe(0);

    for (const pid of pids) expect(alive(pid), pid).toBe(true);
  });

  describe('of an environment booted before #453, whose applications carry no run id', () => {
    it('stops them, waiting for a process that outlives the leader of its group', async () => {
      expect(up().status).toBe(0);
      await endWithoutStop();
      // Such a boot's applications: a leader `sh -c` that SIGTERM ends at once, and a process of
      // its group that runs 3 s of shutdown hooks, like the API – started before the boot recorded
      // them, which is seconds later (the health wait).
      writeFileSync(
        join(folder, 'lingering.sh'),
        'trap "sleep 3; exit 0" TERM\nwhile :; do sleep 1; done\n',
      );
      const leaders = reuseRecordedPids(`sh -c "sh ${join(folder, 'lingering.sh')}"`);
      await sleep(2_100);
      recordNow();
      untagged();
      const processes = leaders.flatMap(members);
      expect(processes.length).toBeGreaterThan(leaders.length);

      const { status, stdout } = down();

      expect(status).toBe(0);
      expect(stdout).toContain('TEST_ENV_STATUS=stopped');
      // Gone when the down returns: it waited for them, not only for the leaders.
      for (const pid of processes) expect(alive(pid), pid).toBe(false);
    });

    it('signals none of the programs that started after the boot recorded them', async () => {
      expect(up().status).toBe(0);
      await endWithoutStop();
      let text = readFileSync(join(checkout, '.ai/qa/test-env.json'), 'utf8');
      text = text.replace('"runIdInEnvironment": true, ', '');
      writeFileSync(join(checkout, '.ai/qa/test-env.json'), text);
      const pids = reuseRecordedPids();

      expect(down().status).toBe(0);

      for (const pid of pids) expect(alive(pid), pid).toBe(true);
    });

    it('signals none of the programs that started long before the boot recorded them', async () => {
      expect(up().status).toBe(0);
      await endWithoutStop();
      untagged();
      const pids = reuseRecordedPids();
      // Longer before than any boot takes (its health wait gives up after 180 s).
      recordNow(400);

      expect(down().status).toBe(0);

      for (const pid of pids) expect(alive(pid), pid).toBe(true);
    });

    it('finishes the stop when processes of a group exit while it lists them', async () => {
      expect(up().status).toBe(0);
      await endWithoutStop();
      // Many short-lived processes: some exit between `ps` and the read of their /proc entry.
      writeFileSync(
        join(folder, 'churning.sh'),
        'for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do\n' +
          '  (while :; do sleep 0.01; done) &\n' +
          'done\nwait\n',
      );
      const leaders = reuseRecordedPids(`sh ${join(folder, 'churning.sh')}`);
      await sleep(2_100);
      recordNow();
      untagged();

      const { status, stdout, stderr } = down();

      expect(status, stderr).toBe(0);
      expect(stdout).toContain('TEST_ENV_STATUS=stopped');
      expect(descriptor().status).toBe('stopped');
      for (const leader of leaders) expect(groupAlive(leader), leader).toBe(false);
    });
  });

  it('stops an application whose group leader has already exited (#453)', () => {
    expect(up().status).toBe(0);
    const { webPid } = descriptor().app;
    const [member] = members(webPid).filter((pid) => pid !== webPid);
    expect(member).toBeDefined();
    // The leader `sh -c` ends first, as on SIGTERM; the web application keeps its group and port.
    process.kill(Number(webPid), 'SIGKILL');
    expect(existsSync(join(folder, 'serving-3000'))).toBe(true);

    expect(down().status).toBe(0);

    expect(alive(member)).toBe(false);
    expect(existsSync(join(folder, 'serving-3000'))).toBe(false);
  });

  it('signals no process group on a second down after the applications have stopped (#452)', () => {
    expect(up().status).toBe(0);
    expect(down().status).toBe(0);
    const pids = reuseRecordedPids();

    const { status, stdout } = down();

    expect(status).toBe(0);
    expect(stdout).toContain('TEST_ENV_STATUS=stopped');
    for (const pid of pids) expect(alive(pid), pid).toBe(true);
  });

  it('marks the environment stopping before it signals the applications, stopped once they exit', async () => {
    // The stubbed applications keep their port for 3 s after SIGTERM, as the API does.
    extraEnvironment = { STUB_STOP_SECONDS: '3' };
    expect(up().status).toBe(0);

    const down = spawn('sh', ['.ai/scripts/test-env-down.sh'], {
      cwd: checkout,
      env: { ...environment(), ...extraEnvironment },
    });
    const exited = new Promise((resolve) => down.on('exit', resolve));
    await until(
      () => descriptor().status === 'stopping',
      5_000,
      () => `status ${descriptor().status}`,
    );
    expect(existsSync(join(folder, 'serving-3000'))).toBe(true);

    expect(await exited).toBe(0);
    expect(descriptor().status).toBe('stopped');
    expect(existsSync(join(folder, 'serving-3000'))).toBe(false);
  });

  describe('when the compose down fails (#449)', () => {
    beforeEach(() => {
      expect(up().status).toBe(0);
      writeFileSync(join(folder, 'compose-down-fails'), '');
    });

    it('exits 1, names the log and marks the environment stop-failed, not stopped', () => {
      // The issue's case: the .env the boot created is gone before the stop.
      rmSync(join(checkout, '.env'));

      const { status, stdout, stderr } = down();

      expect(status).toBe(1);
      expect(stdout).toContain('TEST_ENV_STATUS=stop-failed');
      expect(stdout).not.toContain('TEST_ENV_STATUS=stopped');
      expect(stderr).toContain('stopping the infrastructure failed, see .ai/qa/logs/down.log');
      expect(stderr).toContain('there is no .env in');
      expect(descriptor().status).toBe('stop-failed');
      expect(readFileSync(join(checkout, '.ai/qa/logs/down.log'), 'utf8')).toContain(
        'TRYBUN_S3_ACCESS_KEY_ID is missing a value',
      );
      expect(existsSync(join(folder, 'serving-3000'))).toBe(false);
    });

    it('names no missing .env when the checkout has one', () => {
      const { status, stderr } = down();

      expect(status).toBe(1);
      expect(stderr).not.toContain('there is no .env');
    });

    it('keeps the infrastructure a failed stop left running as its own on the next boot', () => {
      expect(down().status).toBe(1);
      // The infrastructure still runs; the boot finds it, as after any failed stop.
      writeFileSync(join(folder, 'compose-running'), '');
      rmSync(join(folder, 'compose-down-fails'));

      expect(up().status).toBe(0);
      expect(descriptor().servicesStartedByScript).toBe(true);
      writeFileSync(join(folder, 'log'), '');
      expect(down().status).toBe(0);
      expect(readLines(join(folder, 'log'))).toContain(
        'docker compose -p trybun-test -f compose.yaml -f compose.dev.yaml down',
      );
    });

    it('stops the environment on the next down once compose down succeeds, then stays a no-op', () => {
      expect(down().status).toBe(1);
      rmSync(join(folder, 'compose-down-fails'));

      for (let attempt = 0; attempt < 2; attempt++) {
        const { status, stdout } = down();
        expect(status).toBe(0);
        expect(stdout).toContain('TEST_ENV_STATUS=stopped');
        expect(descriptor().status).toBe('stopped');
      }
    });

    it('retries only the compose down, signalling no process group (#452)', () => {
      expect(down().status).toBe(1);
      rmSync(join(folder, 'compose-down-fails'));
      const pids = reuseRecordedPids();
      writeFileSync(join(folder, 'log'), '');

      expect(down().status).toBe(0);

      for (const pid of pids) expect(alive(pid), pid).toBe(true);
      expect(readLines(join(folder, 'log'))).toContain(
        'docker compose -p trybun-test -f compose.yaml -f compose.dev.yaml down',
      );
      expect(descriptor().status).toBe('stopped');
    });

    it('keeps stop-failed while a retry runs the compose down, so a cut-off retry is retried alike (#452)', async () => {
      const composeDown = 'docker compose -p trybun-test -f compose.yaml -f compose.dev.yaml down';
      expect(down().status).toBe(1);
      rmSync(join(folder, 'compose-down-fails'));
      writeFileSync(join(folder, 'compose-down-blocks'), '');
      writeFileSync(join(folder, 'log'), '');
      const retry = spawn('sh', ['.ai/scripts/test-env-down.sh'], {
        cwd: checkout,
        env: environment(),
        detached: true,
        stdio: 'ignore',
      });
      const retryExited = new Promise((resolve) => retry.on('exit', resolve));
      await until(
        () => readLines(join(folder, 'log')).includes(composeDown),
        10_000,
        () => 'the retry did not reach the compose down',
      );

      const statusDuringRetry = descriptor().status;
      // Cut off, as a closed terminal or a SIGKILL of the caller would.
      process.kill(-retry.pid, 'SIGKILL');
      await retryExited;
      rmSync(join(folder, 'compose-down-blocks'));
      expect(statusDuringRetry).toBe('stop-failed');
      expect(descriptor().status).toBe('stop-failed');

      const pids = reuseRecordedPids();
      expect(down().status).toBe(0);
      for (const pid of pids) expect(alive(pid), pid).toBe(true);
      expect(descriptor().status).toBe('stopped');
    });
  });
});
