import { spawnSync } from 'node:child_process';
import {
  chmodSync,
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

// Runs `docker/backup/backup.sh` with stubs of rclone, restic and the PostgreSQL tools on PATH
// (§15.10). The rclone stub keeps the buckets of the storage as folders of `s3/`: a missing
// folder is a missing bucket (exit code 3), and it creates a bucket on a write only without
// RCLONE_CONFIG_OBJECTS_NO_CHECK_BUCKET, as a storage without automatic buckets.

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'backup.sh');
const SERVER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const MARKER = '.trybun-installation';
const EXTERNAL = 'https://s3.example.com/bucket/trybun';

const STUBS = {
  rclone: `#!/bin/sh
echo "rclone $* provider=$RCLONE_CONFIG_OBJECTS_PROVIDER no_check_bucket=\${RCLONE_CONFIG_OBJECTS_NO_CHECK_BUCKET:-} endpoint=$RCLONE_CONFIG_OBJECTS_ENDPOINT" >>"$STUB_LOG"
# objects:bucket/path or objects,option=value:bucket/path → the folder in $STUB_S3.
path() { printf '%s' "$STUB_S3/\${1#*:}"; }
bucket() { b=\${1#*:}; printf '%s' "$STUB_S3/\${b%%/*}"; }
remote() { case $1 in objects*:*) return 0 ;; *) return 1 ;; esac; }
writable() {
  [ -d "$(bucket "$1")" ] && return 0
  [ "\${RCLONE_CONFIG_OBJECTS_NO_CHECK_BUCKET:-}" != true ] || { echo 'NoSuchBucket' >&2; exit 1; }
  mkdir -p "$(bucket "$1")"
}
command=$1
shift
case $command in
  cat)
    [ -d "$(bucket "$1")" ] || exit 3
    [ ! -f "$(path "$1")" ] || cat "$(path "$1")"
    ;;
  rcat)
    writable "$1"
    mkdir -p "$(dirname "$(path "$1")")"
    cat >"$(path "$1")"
    ;;
  lsf)
    for target; do :; done
    [ -d "$(bucket "$target")" ] || exit 3
    [ -d "$(path "$target")" ] || exit 0
    (cd "$(path "$target")" && find . -type f ! -path "./${MARKER}" | sed 's|^\\./||')
    ;;
  mkdir) mkdir -p "$(bucket "$1")" ;;
  sync)
    if remote "$1"; then
      [ -d "$(bucket "$1")" ] || exit 3
      rm -rf "$2"
      mkdir -p "$2" "$(path "$1")"
      cp -R "$(path "$1")/." "$2"
      rm -f "$2/${MARKER}"
    else
      writable "$2"
      target=$(path "$2")
      mkdir -p "$target"
      [ ! -f "$target/${MARKER}" ] || mv "$target/${MARKER}" "$STUB_S3/.marker"
      rm -rf "$target"
      mkdir -p "$target"
      cp -R "$1/." "$target"
      [ ! -f "$STUB_S3/.marker" ] || mv "$STUB_S3/.marker" "$target/${MARKER}"
    fi
    ;;
  *) echo "unexpected: rclone $command $*" >&2; exit 99 ;;
esac
`,
  restic: `#!/bin/sh
echo "restic $*" >>"$STUB_LOG"
case "$*" in
  *" cat config") ;;
  *" backup --json "*) echo '{"message_type":"summary","snapshot_id":"1a2b3c4d5e6f"}' ;;
  *" forget "* | *" init "*) ;;
  *) echo "unexpected: restic $*" >&2; exit 99 ;;
esac
`,
  pg_dump: `#!/bin/sh
for argument; do case $argument in --file=*) : >"\${argument#--file=}" ;; esac; done
`,
  psql: `#!/bin/sh
echo "psql $*" >>"$STUB_LOG"
`,
  pg_restore: `#!/bin/sh
echo "pg_restore $*" >>"$STUB_LOG"
`,
  // The service waits for the next backup with `sleep &`; the stub ends the service instead.
  sleep: `#!/bin/sh
kill -TERM "$PPID"
`,
};

let folder;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'trybun-backup-'));
  for (const name of ['bin', 'data', 'install', 's3', 'tmp']) {
    mkdirSync(join(folder, name));
  }
  for (const [name, script] of Object.entries(STUBS)) {
    writeFileSync(join(folder, 'bin', name), script);
    chmodSync(join(folder, 'bin', name), 0o755);
  }
  writeFileSync(join(folder, 'install/.env'), 'TRYBUN_DOMAIN=trybun.example.com\n');
  writeFileSync(join(folder, 'data/server-id'), `${SERVER}\n`);
  writeFileSync(join(folder, 'log'), '');
});

afterEach(() => rmSync(folder, { recursive: true, force: true }));

/** Runs backup.sh with the arguments and the environment of the service. */
function backupSh(args, env = {}) {
  const result = spawnSync('sh', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: {
      PATH: `${join(folder, 'bin')}:${process.env.PATH}`,
      TRYBUN_BACKUP_DATA: join(folder, 'data'),
      TRYBUN_BACKUP_INSTALL: join(folder, 'install'),
      TMPDIR: join(folder, 'tmp'),
      STUB_LOG: join(folder, 'log'),
      STUB_S3: join(folder, 's3'),
      TRYBUN_S3_ACCESS_KEY_ID: 'key',
      TRYBUN_S3_SECRET_ACCESS_KEY: 'secret',
      ...env,
    },
  });
  return { ...result, log: readFileSync(join(folder, 'log'), 'utf8') };
}

/** Writes the files into the folder `s3/` of the storage stub. */
function storage(files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(folder, 's3', path)), { recursive: true });
    writeFileSync(join(folder, 's3', path), content);
  }
}

const stored = (path) =>
  existsSync(join(folder, 's3', path)) ? readFileSync(join(folder, 's3', path), 'utf8') : null;

/** A fetched backup with the `.env` $1, as `fetch` leaves it in the restore folder. */
function fetched(env, { layout = true, objects = {} } = {}) {
  const restored = join(folder, 'data/restored');
  const files = {
    'configuration/.env': env,
    'databases/trybun.dump': '',
    'databases/keycloak.dump': '',
    ...(layout ? { layout: 'objects=folder\n' } : {}),
    ...Object.fromEntries(Object.entries(objects).map(([path, data]) => [`objects/${path}`, data])),
  };
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(restored, path)), { recursive: true });
    writeFileSync(join(restored, path), content);
  }
}

describe('the storage folder of TRYBUN_S3_URL', () => {
  it('uses provider SeaweedFS only for the SeaweedFS of Compose', () => {
    storage({ 'trybun/available/a': 'a', 'bucket/trybun/available/b': 'b' });

    const compose = backupSh(['backup']);
    expect(compose.status).toBe(0);
    expect(compose.log).toContain('rclone sync objects:trybun ');
    expect(compose.log).toMatch(
      /provider=SeaweedFS no_check_bucket= endpoint=http:\/\/seaweedfs:8333/,
    );

    writeFileSync(join(folder, 'log'), '');
    // Another storage, even with the profile `seaweedfs` on.
    const external = backupSh(['backup'], {
      TRYBUN_S3_URL: EXTERNAL,
      COMPOSE_PROFILES: 'seaweedfs',
    });
    expect(external.status).toBe(0);
    expect(external.log).toContain('rclone sync objects:bucket/trybun ');
    expect(external.log).not.toContain('provider=SeaweedFS');
    expect(external.log).toContain(
      'provider=Other no_check_bucket=true endpoint=https://s3.example.com',
    );
  });

  it.each([
    [
      'HTTPS://S3.Example.com:443/bucket/trybun',
      'https://s3.example.com:443',
      'objects:bucket/trybun',
    ],
    ['http://s3.example.com/bucket//folder/', 'http://s3.example.com', 'objects:bucket/folder'],
    ['http://my_minio:9000/bucket/trybun', 'http://my_minio:9000', 'objects:bucket/trybun'],
  ])('reads %s like the server', (url, endpoint, remote) => {
    storage({ 'bucket/x': 'x' });
    const result = backupSh(['rclone', 'lsf', 'objects:'], { TRYBUN_S3_URL: url });

    expect(result.log).toContain(`endpoint=${endpoint}`);
    const marker = backupSh(['backup'], { TRYBUN_S3_URL: url });
    expect(marker.log).toContain(`rclone sync ${remote} `);
  });

  it.each([
    ['https://key:secret@s3.example.com/bucket/trybun', 'https://***@s3.example.com/bucket/trybun'],
    ['https://s3.example.com/bucket/../trybun', 'https://s3.example.com/bucket/../trybun'],
    ['https://s3.example.com/bucket/%2E%2E/trybun', 'https://s3.example.com/bucket/%2E%2E/trybun'],
    ['https://s3.example.com/bucket/trybun?x=1', 'https://s3.example.com/bucket/trybun?x=1'],
    ['https://s3.example.com/', 'https://s3.example.com/'],
    ['s3://bucket/trybun', 's3://bucket/trybun'],
  ])('refuses %s without putting credentials into the log', (url, shown) => {
    const result = backupSh(['backup'], { TRYBUN_S3_URL: url });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`TRYBUN_S3_URL "${shown}" is not the URL of a storage folder.`);
    expect(result.stderr).not.toContain('secret');
    expect(result.log).not.toContain('rclone');
  });
});

describe('a backup repository and the storage folder', () => {
  it.each([
    's3.example.com/bucket/trybun/backups',
    's3:https://S3.EXAMPLE.com:443/bucket',
    'https://s3.example.com/bucket/trybun',
  ])('refuses a backup with TRYBUN_BACKUP_S3_URL %s, which overlaps the folder', (repository) => {
    storage({ 'bucket/trybun/available/a': 'a' });
    const result = backupSh(['backup'], {
      TRYBUN_S3_URL: EXTERNAL,
      TRYBUN_BACKUP_S3_URL: repository,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `The storage folder ${EXTERNAL} (TRYBUN_S3_URL) and the backup repository ${repository} (TRYBUN_BACKUP_S3_URL) overlap`,
    );
    expect(result.log).not.toMatch(/rclone|restic/);
  });

  it.each([
    'https://s3.example.com/bucket/trybun-backups',
    'https://s3.example.com:8443/bucket/trybun',
    'https://backups.example.com/bucket/trybun',
  ])('backs up with TRYBUN_BACKUP_S3_URL %s outside the folder', (repository) => {
    storage({ 'bucket/trybun/available/a': 'a' });
    const result = backupSh(['backup'], {
      TRYBUN_S3_URL: EXTERNAL,
      TRYBUN_BACKUP_S3_URL: repository,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('local 1a2b3c4d\ns3 1a2b3c4d\n');
  });

  it('stops the service at its start', () => {
    const result = backupSh(['schedule'], {
      TRYBUN_S3_URL: EXTERNAL,
      TRYBUN_BACKUP_S3_URL: `${EXTERNAL}/backups`,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('overlap');
    expect(existsSync(join(folder, 'tmp/trybun-backup.ready'))).toBe(false);
  });
});

describe('the daily backup of the service', () => {
  // The first wait returns, so the service runs one daily backup; the second ends the service.
  const SLEEP = `#!/bin/sh
if [ -e "$STUB_S3/../slept" ]; then kill -TERM "$PPID"; else : >"$STUB_S3/../slept"; fi
`;
  // Writes a part of the dump and fails, as when the database restarts during the dump.
  const FAILING_PG_DUMP = `#!/bin/sh
for argument; do case $argument in --file=*) printf 'part' >"\${argument#--file=}" ;; esac; done
echo 'pg_dump: error: connection to server lost' >&2
exit 1
`;

  function stub(name, script) {
    writeFileSync(join(folder, 'bin', name), script);
    chmodSync(join(folder, 'bin', name), 0o755);
  }

  beforeEach(() => {
    stub('sleep', SLEEP);
    storage({ 'trybun/available/a': 'a' });
  });

  it('stores the set', () => {
    const result = backupSh(['schedule']);

    expect(result.status).toBe(0);
    expect(result.log).toMatch(/restic .* backup --json .*--tag daily /);
    expect(result.stderr).not.toContain('the daily backup failed');
  });

  it('stops at a failing pg_dump, stores nothing and runs on', () => {
    stub('pg_dump', FAILING_PG_DUMP);
    const result = backupSh(['schedule']);

    expect(result.status).toBe(0);
    expect(existsSync(join(folder, 'data/set/databases/trybun.dump'))).toBe(false);
    expect(result.stderr).not.toContain('Dumping the database keycloak');
    expect(result.log).not.toMatch(/rclone sync|restic .* backup /);
    expect(result.stderr.match(/Error: the daily backup failed/g)).toHaveLength(1);
    // The service waits for the next backup.
    expect(result.stderr.match(/Next backup at 03:00 UTC/g)).toHaveLength(2);
  });
});

describe('the marker of the storage folder', () => {
  it('is written by a backup into an unmarked folder', () => {
    storage({ 'bucket/trybun/available/a': 'a' });
    const result = backupSh(['backup'], { TRYBUN_S3_URL: EXTERNAL });

    expect(result.status).toBe(0);
    expect(stored(`bucket/trybun/${MARKER}`)).toBe(`${SERVER}\n`);
    // The marker is not part of the backup.
    expect(existsSync(join(folder, 'data/set/objects', MARKER))).toBe(false);
    expect(readFileSync(join(folder, 'data/set/objects/available/a'), 'utf8')).toBe('a');
  });

  it('naming another server is left by the backup, with an error in the log', () => {
    storage({ [`bucket/trybun/${MARKER}`]: `${OTHER}\n`, 'bucket/trybun/available/a': 'a' });
    const result = backupSh(['backup'], { TRYBUN_S3_URL: EXTERNAL });

    expect(result.status).toBe(0);
    expect(stored(`bucket/trybun/${MARKER}`)).toBe(`${OTHER}\n`);
    expect(result.stderr).toContain(
      `Error: the marker of the storage folder ${EXTERNAL} names another Trybun server, so this server leaves it unchanged.`,
    );
    expect(result.log).not.toContain('rclone rcat');
  });

  it('stops a backup that cannot write it', () => {
    // No bucket, and rclone creates none on an external storage.
    const result = backupSh(['backup'], { TRYBUN_S3_URL: EXTERNAL });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `Cannot write to the storage folder ${EXTERNAL}. Check that its bucket exists`,
    );
  });

  it.each([
    ['an unmarked folder', {}, SERVER],
    ['a folder of another server', { [`bucket/trybun/${MARKER}`]: `${OTHER}\n` }, OTHER],
  ])('is claimed by the service at its start in %s, never taken over', (_, files, expected) => {
    storage({ 'bucket/trybun/available/a': 'a', ...files });
    const result = backupSh(['schedule'], { TRYBUN_S3_URL: EXTERNAL });

    expect(result.status).toBe(0);
    expect(existsSync(join(folder, 'tmp/trybun-backup.ready'))).toBe(true);
    expect(stored(`bucket/trybun/${MARKER}`)).toBe(`${expected}\n`);
    expect(result.stderr).toContain('Next backup at 03:00 UTC');
  });

  it('does not stop the service at its start when it cannot be written', () => {
    const result = backupSh(['schedule'], { TRYBUN_S3_URL: EXTERNAL });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      'Warning: the marker of the storage folder could not be written; the daily backup writes it.',
    );
  });
});

describe('storage-owner', () => {
  const BACKUP_ENV = `TRYBUN_S3_URL=${EXTERNAL}\nTRYBUN_S3_ACCESS_KEY_ID=production-key\n`;

  it.each([
    ['own', { [`bucket/trybun/${MARKER}`]: `${SERVER}\n`, 'bucket/trybun/available/a': 'a' }],
    ['foreign', { [`bucket/trybun/${MARKER}`]: `${OTHER}\n` }],
    // Q26: objects without a marker may belong to another application or server.
    ['unmarked', { 'bucket/trybun/available/a': 'a' }],
    ['none', { 'bucket/other/available/a': 'a' }],
    // No bucket: nothing in it.
    ['none', {}],
  ])('reports %s for the folder of the backup', (state, files) => {
    storage(files);
    fetched(BACKUP_ENV);
    const result = backupSh(['storage-owner']);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${state} ${EXTERNAL}\n`);
    // With the credentials of the backup's .env.
    expect(result.log).not.toContain('rclone rcat');
  });

  it.each([
    ['export TRYBUN_S3_URL=https://s3.example.com/bucket/trybun # production\n'],
    ['  TRYBUN_S3_URL = "https://s3.example.com/bucket/trybun" # production\n'],
    ["TRYBUN_S3_URL='https://s3.example.com/bucket/trybun'\r\n"],
    [
      'TRYBUN_S3_URL=https://s3.example.com/bucket/old\nTRYBUN_S3_URL: https://s3.example.com/bucket/trybun   \n',
    ],
  ])("reads the backup's .env as Docker Compose does: %j", (env) => {
    fetched(`# TRYBUN_S3_URL=http://seaweedfs:8333/commented\n${env}`);
    const result = backupSh(['storage-owner']);

    expect(result.stdout).toBe(`none ${EXTERNAL}\n`);
  });

  it('reads the folder of the SeaweedFS of Compose when the backup sets none', () => {
    storage({ [`trybun/${MARKER}`]: `${SERVER}\n` });
    fetched('TRYBUN_DOMAIN=trybun.example.com\n');
    const result = backupSh(['storage-owner']);

    expect(result.stdout).toBe('own http://seaweedfs:8333/trybun\n');
  });

  describe('with a URL', () => {
    it.each([
      'https://s3.example.com/bucket',
      'https://s3.example.com/bucket/trybun',
      'https://s3.example.com/bucket/trybun/inside',
      'HTTPS://S3.Example.com:443/bucket/trybun/',
    ])('reports an overlap with the folder of the backup for %s', (url) => {
      fetched(BACKUP_ENV);
      const result = backupSh(['storage-owner', url]);

      expect(result.stdout).toBe(`overlap ${EXTERNAL}\n`);
      expect(result.log).not.toContain('rclone');
    });

    it.each([
      'https://s3.example.com/bucket/trybun-test',
      'https://s3.example.com:8443/bucket/trybun',
      'https://s3.example.com/other-bucket/trybun',
    ])('reads the marker of %s, outside the folder of the backup', (url) => {
      fetched(BACKUP_ENV);
      const result = backupSh(['storage-owner', url]);

      expect(result.stdout).toBe(`none ${url}\n`);
    });

    it.each([
      ['of this server', { TRYBUN_BACKUP_S3_URL: 's3.example.com/bucket/test/backups' }, ''],
      ["of the backup's .env", {}, 'TRYBUN_BACKUP_S3_URL=s3:https://s3.example.com/bucket/test\n'],
    ])('reports an overlap with the backup repository %s', (_, env, backupEnv) => {
      fetched(`${BACKUP_ENV}${backupEnv}`);
      const result = backupSh(['storage-owner', 'https://s3.example.com/bucket/test'], env);

      expect(result.stdout).toMatch(/^repository https:\/\/s3\.example\.com\/bucket\/test \S+\n$/);
      expect(result.log).not.toContain('rclone');
    });
  });

  describe('with --test', () => {
    it('reports a backup on an external storage, which needs --storage-url', () => {
      fetched(BACKUP_ENV);
      const result = backupSh(['storage-owner', '--test']);

      expect(result.stdout).toBe(`external ${EXTERNAL}\n`);
    });

    it.each([
      ['TRYBUN_DOMAIN=trybun.example.com\n'],
      ['TRYBUN_S3_URL=http://seaweedfs:8333/trybun\n'],
    ])('reads the folder of a backup on the SeaweedFS of Compose: %j', (env) => {
      fetched(env);
      const result = backupSh(['storage-owner', '--test']);

      expect(result.stdout).toBe('none http://seaweedfs:8333/trybun\n');
    });

    it('reads the folder of the URL', () => {
      fetched(BACKUP_ENV);
      const url = 'https://s3.example.com/bucket/trybun-test';
      const result = backupSh(['storage-owner', '--test', url]);

      expect(result.stdout).toBe(`none ${url}\n`);
    });
  });
});

describe('restore-data', () => {
  const BACKUP_ENV = `TRYBUN_S3_URL=${EXTERNAL}\n`;

  it('replaces the objects of the folder and marks it', () => {
    storage({ [`bucket/trybun/${MARKER}`]: `${SERVER}\n`, 'bucket/trybun/available/later': 'x' });
    fetched(BACKUP_ENV, { objects: { 'available/a': 'a' } });
    const result = backupSh(['restore-data'], { TRYBUN_S3_URL: EXTERNAL });

    expect(result.status).toBe(0);
    expect(stored('bucket/trybun/available/a')).toBe('a');
    expect(stored('bucket/trybun/available/later')).toBeNull();
    expect(stored(`bucket/trybun/${MARKER}`)).toBe(`${SERVER}\n`);
    expect(result.log).toContain('pg_restore');
    expect(existsSync(join(folder, 'data/restored'))).toBe(false);
  });

  it.each([
    ['foreign', { [`bucket/trybun/${MARKER}`]: `${OTHER}\n` }, 'belongs to another Trybun server'],
    ['unmarked', { 'bucket/trybun/available/b': 'b' }, 'holds objects but no Trybun marker'],
  ])('refuses a %s folder without --replace-foreign-objects', (_, files, message) => {
    storage(files);
    fetched(BACKUP_ENV, { objects: { 'available/a': 'a' } });
    const result = backupSh(['restore-data'], { TRYBUN_S3_URL: EXTERNAL });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(result.stderr).toContain('The databases and the storage folder were not changed.');
    expect(result.log).not.toMatch(/psql|pg_restore|rclone sync/);

    const replaced = backupSh(['restore-data', '--replace-foreign-objects'], {
      TRYBUN_S3_URL: EXTERNAL,
    });
    expect(replaced.status).toBe(0);
    expect(stored('bucket/trybun/available/a')).toBe('a');
    expect(stored(`bucket/trybun/${MARKER}`)).toBe(`${SERVER}\n`);
  });

  it('creates a missing bucket of an external storage', () => {
    fetched(BACKUP_ENV, { objects: { 'available/a': 'a' } });
    const url = 'https://s3.example.com/new-bucket/trybun';
    const result = backupSh(['restore-data'], { TRYBUN_S3_URL: url });

    expect(result.status).toBe(0);
    expect(result.log).toContain('rclone mkdir objects,no_check_bucket=false:new-bucket');
    expect(stored('new-bucket/trybun/available/a')).toBe('a');
  });

  it('refuses a folder that overlaps the folder of the backup, whatever Compose read', () => {
    storage({ 'bucket/trybun/available/b': 'b' });
    fetched(`export TRYBUN_S3_URL=${EXTERNAL} # production\n`, { objects: { 'available/a': 'a' } });
    const result = backupSh(['restore-data', '--replace-foreign-objects'], {
      TRYBUN_S3_URL: `${EXTERNAL}/test`,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `The storage folder ${EXTERNAL}/test overlaps the storage folder ${EXTERNAL} of the backup.`,
    );
    expect(stored('bucket/trybun/available/b')).toBe('b');
    expect(result.log).not.toMatch(/psql|rclone/);
  });

  it('refuses a folder that overlaps the backup repository', () => {
    fetched(BACKUP_ENV, { objects: { 'available/a': 'a' } });
    const result = backupSh(['restore-data'], {
      TRYBUN_S3_URL: EXTERNAL,
      TRYBUN_BACKUP_S3_URL: 's3.example.com/bucket',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('overlap');
    expect(result.log).not.toMatch(/psql|rclone/);
  });

  describe('a set of an earlier release without `layout`', () => {
    it('restores the folder from its path in the SeaweedFS of Compose', () => {
      storage({ [`trybun/${MARKER}`]: `${SERVER}\n`, 'trybun/available/later': 'x' });
      fetched('TRYBUN_DOMAIN=trybun.example.com\n', {
        layout: false,
        objects: { 'trybun/available/a': 'a', 'other/b': 'b' },
      });
      const result = backupSh(['restore-data']);

      expect(result.status).toBe(0);
      expect(stored('trybun/available/a')).toBe('a');
      expect(stored('trybun/available/later')).toBeNull();
      expect(stored('trybun/other/b')).toBeNull();
    });

    it('empties a folder that set does not hold', () => {
      storage({ [`bucket/trybun/${MARKER}`]: `${SERVER}\n`, 'bucket/trybun/available/later': 'x' });
      fetched(BACKUP_ENV, { layout: false, objects: { 'trybun/available/a': 'a' } });
      const result = backupSh(['restore-data'], { TRYBUN_S3_URL: EXTERNAL });

      expect(result.status).toBe(0);
      expect(stored('bucket/trybun/available/later')).toBeNull();
      expect(stored('bucket/trybun/available/a')).toBeNull();
      expect(stored(`bucket/trybun/${MARKER}`)).toBe(`${SERVER}\n`);
    });
  });
});
