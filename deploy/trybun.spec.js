import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Runs `deploy/trybun` in a copy of the deployment package, with stubs of docker, ss, getent, ip
// and curl on PATH and a fake /proc/meminfo (§15.5, §15.7, §15.10).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_EXAMPLE = readFileSync(join(ROOT, '.env.example'), 'utf8');

const SECRETS = [
  'TRYBUN_POSTGRES_PASSWORD',
  'TRYBUN_KEYCLOAK_DB_PASSWORD',
  'TRYBUN_KEYCLOAK_ADMIN_PASSWORD',
  'TRYBUN_VALKEY_PASSWORD',
  'TRYBUN_S3_ACCESS_KEY_ID',
  'TRYBUN_S3_SECRET_ACCESS_KEY',
  'AUTH_SECRET',
  'TRYBUN_KEYCLOAK_WEB_CLIENT_SECRET',
  'TRYBUN_KEYCLOAK_SERVER_CLIENT_SECRET',
  'TRYBUN_BACKUP_PASSPHRASE',
];

// Each stub answers from an environment variable and logs its arguments.
const STUBS = {
  docker: `#!/bin/sh
echo "docker $*" >>"$STUB_LOG"
case "$*" in
  "version --format {{.Server.Version}}") echo "$STUB_DOCKER_VERSION" ;;
  "compose version --short") echo "$STUB_COMPOSE_VERSION" ;;
  "volume ls -q --filter label=com.docker.compose.project="*) printf '%b' "$STUB_VOLUMES" ;;
  "compose ps --status running --services") [ -e .env ] || exit 1; printf '%s' "$STUB_RUNNING" ;;
  "compose up -d --wait") exit "$STUB_UP_EXIT" ;;
  "compose exec -T api node dist/cli.js setup-token") echo "$STUB_SETUP_OUTPUT"; exit "$STUB_SETUP_EXIT" ;;
  "compose run --rm -T backup backup "*) printf '%b' "$STUB_BACKUP_OUTPUT"; exit "$STUB_BACKUP_EXIT" ;;
  "compose run --rm -T --no-deps backup list") echo 'Backups on the local backup volume:' ;;
  "compose stop") ;;
  "compose run --rm -T --no-deps backup fetch "*) exit "$STUB_FETCH_EXIT" ;;
  "compose run --rm -T --no-deps backup configuration") cat "$STUB_CONFIGURATION" ;;
  "compose run --rm -T backup storage-owner" | "compose run --rm -T backup storage-owner "*) echo "$STUB_STORAGE_OWNER"; exit "$STUB_STORAGE_OWNER_EXIT" ;;
  "compose up -d --wait postgres") ;;
  "compose exec -T postgres "*) cat >"$STUB_STDIN" ;;
  "compose run --rm -T backup restore-data" | "compose run --rm -T backup restore-data --replace-foreign-objects") exit "$STUB_RESTORE_EXIT" ;;
  "compose -f "*" --project-directory . config --images") printf 'ghcr.io/trybun/server:0.3.0\nvalkey:9\nghcr.io/trybun/server:0.3.0\n' ;;
  "image inspect "*) case " $STUB_PRESENT_IMAGES " in *" $3 "*) ;; *) exit 1 ;; esac ;;
  "ps -aq --filter label=com.docker.compose.project="*) printf '%b' "$STUB_CONTAINERS" ;;
  "network ls -q --filter label=com.docker.compose.project="*) printf '%b' "$STUB_NETWORKS" ;;
  "compose config --images") printf '%b' "$STUB_IMAGES" ;;
  "inspect --format {{.Config.Image}} "*) echo "$STUB_CONTAINER_IMAGE" ;;
  "compose down --volumes --remove-orphans") exit "$STUB_DOWN_EXIT" ;;
  "rm -f "* | "volume rm "* | "network rm "*) ;;
  "image rm "*) case " $STUB_USED_IMAGES " in *" $3 "*) exit 1 ;; esac ;;
  "pull --quiet "*) exit "$STUB_PULL_EXIT" ;;
  "compose up -d --wait --remove-orphans") exit "$STUB_UP_EXIT" ;;
  *) echo "unexpected: docker $*" >&2; exit 99 ;;
esac
`,
  ss: `#!/bin/sh
case "$*" in
  -Hltn) printf '%s' "$STUB_SS_TCP" ;;
  -Hlun) printf '%s' "$STUB_SS_UDP" ;;
  *) exit 99 ;;
esac
`,
  getent: `#!/bin/sh
[ -n "$STUB_DOMAIN_ADDRESS" ] || exit 2
echo "$STUB_DOMAIN_ADDRESS STREAM $2"
echo "$STUB_DOMAIN_ADDRESS DGRAM"
`,
  ip: `#!/bin/sh
echo "2: eth0    inet 203.0.113.10/24 brd 203.0.113.255 scope global eth0"
echo "2: eth0    inet6 2001:db8::10/64 scope global"
`,
  hostname: `#!/bin/sh
exit 1
`,
  // Serves the releases from a folder: curl -fsSL -o <file> <url>.
  curl: `#!/bin/sh
echo "curl $*" >>"$STUB_LOG"
file="$STUB_RELEASES/\${4#"$TRYBUN_RELEASES_URL"/download/}"
[ -f "$file" ] || exit 22
cp "$file" "$3"
`,
};

const GIB_7_5 = 7_864_320; // kB of a server sold as "8 GB": 8.05 × 10⁹ bytes
const GIB_16 = 16_777_216;

const ANSWERS = 'Trybun.Example.com\n\nEurope/Warsaw\nstored\n';

let folder;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'trybun-install-'));
  for (const [path, content] of [
    ['package/.env.example', ENV_EXAMPLE],
    ['zoneinfo/Europe/Warsaw', ''],
    ['zoneinfo/UTC', ''],
    ['log', ''],
    ...Object.entries(STUBS).map(([name, script]) => [`bin/${name}`, script]),
  ]) {
    mkdirSync(dirname(join(folder, path)), { recursive: true });
    writeFileSync(join(folder, path), content);
  }
  mkdirSync(join(folder, 'etc'));
  for (const name of Object.keys(STUBS)) {
    chmodSync(join(folder, 'bin', name), 0o755);
  }
  copyFileSync(join(ROOT, 'deploy/trybun'), join(folder, 'package/trybun'));
});

afterEach(() => rmSync(folder, { recursive: true, force: true }));

function meminfo(kilobytes) {
  writeFileSync(join(folder, 'meminfo'), `MemTotal:       ${kilobytes} kB\nMemFree: 1 kB\n`);
}

/**
 * Runs `./trybun` with the stubs. `terminal` runs it in a pseudo-terminal of `script`
 * (util-linux), which merges stderr into stdout.
 */
function trybun(command, { input = ANSWERS, memory = GIB_16, terminal = false, ...stubs } = {}) {
  meminfo(memory);
  const args = [join(folder, 'package/trybun'), ...(Array.isArray(command) ? command : [command])];
  const [program, programArgs] = terminal
    ? ['script', ['-qec', `sh ${args.map((arg) => `'${arg}'`).join(' ')}`, '/dev/null']]
    : ['sh', args];
  const result = spawnSync(program, programArgs, {
    input,
    encoding: 'utf8',
    env: {
      PATH: `${join(folder, 'bin')}:${process.env.PATH}`,
      TRYBUN_MEMINFO: join(folder, 'meminfo'),
      TRYBUN_ZONEINFO: join(folder, 'zoneinfo'),
      TRYBUN_ETC: join(folder, 'etc'),
      STUB_LOG: join(folder, 'log'),
      STUB_DOCKER_VERSION: '27.3.1',
      STUB_COMPOSE_VERSION: '2.29.7',
      STUB_RUNNING: '',
      STUB_VOLUMES: '',
      STUB_CONTAINERS: '',
      STUB_NETWORKS: '',
      STUB_IMAGES: '',
      STUB_CONTAINER_IMAGE: '',
      STUB_PRESENT_IMAGES: 'valkey:9',
      STUB_USED_IMAGES: '',
      STUB_DOWN_EXIT: '0',
      STUB_SS_TCP: 'LISTEN 0 128 0.0.0.0:22 0.0.0.0:*\n',
      STUB_SS_UDP: 'UNCONN 0 0 127.0.0.53%lo:53 0.0.0.0:*\n',
      STUB_DOMAIN_ADDRESS: '203.0.113.10',
      STUB_UP_EXIT: '0',
      STUB_SETUP_OUTPUT:
        'https://trybun.example.com/setup#token=abc (valid until 2026-10-26 12:00 UTC)',
      STUB_SETUP_EXIT: '0',
      STUB_BACKUP_OUTPUT: 'local 1a2b3c4d\\ns3 5e6f7a8b\\n',
      STUB_BACKUP_EXIT: '0',
      STUB_FETCH_EXIT: '0',
      STUB_RESTORE_EXIT: '0',
      STUB_STORAGE_OWNER: 'own http://seaweedfs:8333/trybun',
      STUB_STORAGE_OWNER_EXIT: '0',
      STUB_PULL_EXIT: '0',
      STUB_CONFIGURATION: join(folder, 'configuration.tar'),
      STUB_STDIN: join(folder, 'stdin'),
      STUB_RELEASES: join(folder, 'releases'),
      TRYBUN_RELEASES_URL: 'https://releases.example.com/trybun',
      ...stubs,
    },
  });
  return { ...result, log: readFileSync(join(folder, 'log'), 'utf8') };
}

const envPath = () => join(folder, 'package/.env');

/** Values of the variables set in an env file. */
function variables(content) {
  return Object.fromEntries(
    content
      .split('\n')
      .map((line) => /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line))
      .filter(Boolean)
      .map(([, name, value]) => [name, value]),
  );
}

function expectNothingChanged(result) {
  expect(result.status).not.toBe(0);
  expect(existsSync(envPath())).toBe(false);
  expect(result.log).not.toContain('compose up');
}

describe('./trybun install – prerequisites', () => {
  it('refuses a server with 7.9 × 10⁹ bytes of memory', () => {
    const result = trybun('install', { memory: 7_714_843 });

    expectNothingChanged(result);
    expect(result.stderr).toContain('The server has 7.9 GB of memory; Trybun needs at least 8 GB');
  });

  it('accepts a server sold as 8 GB and warns below 16 GB', () => {
    const result = trybun('install', { memory: GIB_7_5 });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      'Warning: The server has 8.1 GB of memory; 16 GB are recommended',
    );
  });

  it('refuses a taken TCP port 443', () => {
    const result = trybun('install', { STUB_SS_TCP: 'LISTEN 0 511 *:443 *:*\n' });

    expectNothingChanged(result);
    expect(result.stderr).toContain('Port(s) TCP 443 already in use');
  });

  it('refuses taken ports 80 and UDP 443', () => {
    const result = trybun('install', {
      STUB_SS_TCP: 'LISTEN 0 511 0.0.0.0:80 0.0.0.0:*\nLISTEN 0 511 [::]:80 [::]:*\n',
      STUB_SS_UDP: 'UNCONN 0 0 0.0.0.0:443 0.0.0.0:*\n',
    });

    expectNothingChanged(result);
    expect(result.stderr).toContain('Port(s) TCP 80, UDP 443 already in use');
  });

  it("accepts ports held by the installation's own caddy", () => {
    expect(trybun('install').status).toBe(0);

    const result = trybun('install', {
      input: '',
      STUB_RUNNING: 'api\ncaddy\nweb\n',
      STUB_SS_TCP: 'LISTEN 0 4096 0.0.0.0:80 0.0.0.0:*\nLISTEN 0 4096 0.0.0.0:443 0.0.0.0:*\n',
      STUB_SS_UDP: 'UNCONN 0 0 0.0.0.0:443 0.0.0.0:*\n',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('setup#token=');
  });

  it('refuses Docker Engine older than 25.0', () => {
    const result = trybun('install', { STUB_DOCKER_VERSION: '24.0.9' });

    expectNothingChanged(result);
    expect(result.stderr).toContain('Docker Engine 24.0.9 is too old; Trybun needs 25.0 or newer');
  });

  it('refuses Docker Compose older than 2.20.2', () => {
    const result = trybun('install', { STUB_COMPOSE_VERSION: 'v2.20.1' });

    expectNothingChanged(result);
    expect(result.stderr).toContain('Docker Compose v2.20.1 is too old; Trybun needs 2.20.2');
  });
});

describe('./trybun install – .env', () => {
  it('writes .env readable only by its owner, without development values', () => {
    const result = trybun('install');

    expect(result.status).toBe(0);
    expect(statSync(envPath()).mode & 0o777).toBe(0o600);
    const content = readFileSync(envPath(), 'utf8');
    const written = variables(content);
    const development = variables(ENV_EXAMPLE);
    for (const name of SECRETS) {
      expect(development[name], name).toBeTruthy();
      expect(written[name], name).toMatch(/^[0-9a-f]{64}$/);
    }
    const developmentSecrets = new Set(SECRETS.map((name) => development[name]));
    for (const [name, value] of Object.entries(written)) {
      if (SECRETS.includes(name) || name.endsWith('PASSWORD') || name.endsWith('SECRET')) {
        expect(developmentSecrets.has(value), name).toBe(false);
      }
    }
    expect(new Set(SECRETS.map((name) => written[name])).size).toBe(SECRETS.length);
    expect(written).toMatchObject({
      TRYBUN_DOMAIN: 'trybun.example.com',
      TRYBUN_DEFAULT_LANGUAGE: 'en',
      TRYBUN_DEFAULT_TIME_ZONE: 'Europe/Warsaw',
    });
    // Comments are kept.
    expect(content).toContain('# Default language of the system');
    expect(content).toContain('# TRYBUN_SMTP_HOST=');
    expect(result.stdout).toContain(written.TRYBUN_BACKUP_PASSPHRASE);
    expect(result.log).toContain('docker compose up -d --wait');
    expect(result.stdout).toContain('https://trybun.example.com/setup#token=abc');
  });

  it('leaves an existing .env byte for byte unchanged on a second run', () => {
    expect(trybun('install').status).toBe(0);
    const before = readFileSync(envPath());

    const result = trybun('install', { input: '' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('.env exists: keeping it unchanged');
    expect(readFileSync(envPath()).equals(before)).toBe(true);
    expect(statSync(envPath()).mode & 0o777).toBe(0o600);
  });

  it('stops before the questions when data of an earlier installation exists without .env', () => {
    const result = trybun('install', {
      STUB_VOLUMES: 'trybun_backup-data\\ntrybun_postgres-data\\n',
    });

    expectNothingChanged(result);
    expect(result.stdout).not.toContain('Backup passphrase');
    expect(result.stderr).toContain(
      'Data of an earlier installation of Trybun is on this server (Docker volumes: trybun_backup-data trybun_postgres-data), but .env is missing',
    );
    expect(result.stderr).toContain('docker volume rm trybun_backup-data trybun_postgres-data');
  });

  it('writes nothing until the backup passphrase is confirmed', () => {
    const result = trybun('install', { input: 'trybun.example.com\npl\nUTC\nok\n' });

    expectNothingChanged(result);
    expect(result.stdout).toContain('Backup passphrase');
    expect(readFileSync(join(folder, 'package/.env.example'), 'utf8')).toBe(ENV_EXAMPLE);
  });

  it('asks again after an answer that is not valid and defaults to the server time zone', () => {
    writeFileSync(join(folder, 'etc/timezone'), 'Europe/Warsaw\n');
    const result = trybun('install', {
      input: 'https://trybun.example.com\ntrybun.example.com\nde\npl\nMars/Olympus\n\nstored\n',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('"https://trybun.example.com" is not a domain name');
    expect(result.stderr).toContain('"de" is not supported');
    expect(result.stderr).toContain('"Mars/Olympus" is not an IANA time zone');
    expect(variables(readFileSync(envPath(), 'utf8'))).toMatchObject({
      TRYBUN_DEFAULT_LANGUAGE: 'pl',
      TRYBUN_DEFAULT_TIME_ZONE: 'Europe/Warsaw',
    });
  });

  it('warns when the domain does not point to the server and stops without confirmation', () => {
    const result = trybun('install', {
      input: 'trybun.example.com\n\n\nn\n',
      STUB_DOMAIN_ADDRESS: '198.51.100.7',
    });

    expectNothingChanged(result);
    expect(result.stderr).toContain(
      'trybun.example.com resolves to 198.51.100.7, not to an address of this server',
    );
  });

  it('continues after confirmation when the domain does not resolve', () => {
    const result = trybun('install', {
      input: 'trybun.example.com\n\n\ny\nstored\n',
      STUB_DOMAIN_ADDRESS: '',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('trybun.example.com does not resolve to any address');
    expect(existsSync(envPath())).toBe(true);
  });

  it('keeps .env and explains when Trybun does not start', () => {
    const result = trybun('install', { STUB_UP_EXIT: '1' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Trybun did not start');
    expect(existsSync(envPath())).toBe(true);
    expect(result.log).not.toContain('setup-token');
  });
});

describe('./trybun install on a system that is set up', () => {
  it('ends successfully with the message of the setup-token command', () => {
    writeFileSync(envPath(), 'TRYBUN_DOMAIN=trybun.example.com\n');
    const result = trybun('install', {
      STUB_RUNNING: 'caddy\n',
      STUB_SETUP_OUTPUT: 'Trybun is already set up.',
      STUB_SETUP_EXIT: '3',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Trybun is already set up.');
  });

  it('fails when the setup-token command fails', () => {
    writeFileSync(envPath(), 'TRYBUN_DOMAIN=trybun.example.com\n');
    const result = trybun('install', { STUB_RUNNING: 'caddy\n', STUB_SETUP_EXIT: '1' });

    expect(result.status).toBe(1);
  });
});

describe('./trybun setup-token', () => {
  it('passes the output and the exit code of the setup-token command through', () => {
    const result = trybun('setup-token', {
      STUB_SETUP_OUTPUT: 'Trybun is already set up.',
      STUB_SETUP_EXIT: '3',
    });

    expect(result.status).toBe(3);
    expect(result.stdout).toBe('Trybun is already set up.\n');
    expect(result.log).toBe('docker compose exec -T api node dist/cli.js setup-token\n');
  });
});

describe('./trybun --help', () => {
  it('lists the commands', () => {
    const result = trybun('--help');

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/install .*\n[\s\S]*setup-token /);
    expect(result.stdout).toContain(
      'restore [<backup>] [--test [--storage-url <url>]] [--replace-foreign-objects]',
    );
  });

  it('refuses an unknown command', () => {
    const result = trybun('upgrade');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown command "upgrade"');
  });
});

/** Writes the files of an object `{ path: content }` into a folder. */
function writeFiles(base, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(base, path)), { recursive: true });
    writeFileSync(join(base, path), content);
  }
}

const composeOf = (version) =>
  `x-server: &server\n  image: ghcr.io/trybun/server:\${TRYBUN_VERSION:-${version}}\n`;

const INSTALLED_ENV = 'TRYBUN_DOMAIN=trybun.example.com\nTRYBUN_POSTGRES_PASSWORD=current\n';

/** An installation of version 0.2.0 with its .env. */
function installed() {
  writeFiles(join(folder, 'package'), {
    'compose.yaml': composeOf('0.2.0'),
    'docker/caddy/Caddyfile': 'old',
    'docker/obsolete.txt': 'old',
    '.env': INSTALLED_ENV,
  });
  chmodSync(envPath(), 0o600);
}

const order = (log, ...commands) => commands.map((command) => log.indexOf(command));

describe('./trybun backup', () => {
  beforeEach(installed);

  it('backs up and says where each backup is stored', () => {
    const result = trybun('backup');

    expect(result.status).toBe(0);
    expect(result.log).toContain('docker compose run --rm -T backup backup manual');
    expect(result.stdout).toContain('Backup 1a2b3c4d stored on this server.');
    expect(result.stdout).toContain('Backup 5e6f7a8b stored on the external S3 storage.');
  });

  it('fails when the backup fails', () => {
    const result = trybun('backup', { STUB_BACKUP_EXIT: '1' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('The backup failed');
  });

  it('lists the backups', () => {
    const result = trybun(['backup', 'list']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Backups on the local backup volume:');
  });
});

describe('./trybun restore', () => {
  const RESTORED_ENV =
    "TRYBUN_DOMAIN=trybun.example.com\nTRYBUN_POSTGRES_PASSWORD=it's-old\nTRYBUN_KEYCLOAK_DB_PASSWORD=keycloak-old\n";

  beforeEach(() => {
    installed();
    const backup = join(folder, 'backup');
    writeFiles(backup, {
      '.env': RESTORED_ENV,
      'compose.yaml': composeOf('0.1.0'),
      'docker/caddy/Caddyfile': 'restored',
      trybun: '#!/bin/sh\n',
    });
    execFileSync('tar', ['-cf', join(folder, 'configuration.tar'), '-C', backup, '.']);
  });

  it('restores the configuration and the data of the backup and starts its version', () => {
    const result = trybun(['restore', '1a2b3c4d'], { input: 'y\n' });

    expect(result.status).toBe(0);
    expect(readFileSync(envPath(), 'utf8')).toBe(RESTORED_ENV);
    expect(statSync(envPath()).mode & 0o777).toBe(0o600);
    expect(readFileSync(join(folder, 'package/compose.yaml'), 'utf8')).toBe(composeOf('0.1.0'));
    expect(readFileSync(join(folder, 'package/docker/caddy/Caddyfile'), 'utf8')).toBe('restored');
    expect(existsSync(join(folder, 'package/docker/obsolete.txt'))).toBe(false);
    const steps = order(
      result.log,
      'compose stop',
      'backup fetch 1a2b3c4d',
      'backup storage-owner',
      'compose up -d --wait postgres',
      'compose exec -T postgres',
      'backup restore-data',
      'compose up -d --wait\n',
    );
    expect(steps.every((index) => index >= 0)).toBe(true);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    // The passwords of the restored .env, through stdin only.
    expect(readFileSync(join(folder, 'stdin'), 'utf8')).toBe(
      "ALTER ROLE trybun PASSWORD 'it''s-old';\nALTER ROLE keycloak PASSWORD 'keycloak-old';\n",
    );
    expect(result.log).not.toContain('old');
    // The folder of the backup's .env: storage-owner without a URL.
    expect(result.log).toContain('backup storage-owner\n');
    expect(result.stdout).toContain('Restored the backup 1a2b3c4d.');
  });

  it('restores the newest backup by default', () => {
    const result = trybun('restore', { input: 'y\n' });

    expect(result.status).toBe(0);
    expect(result.log).toContain('backup fetch latest');
  });

  it('changes nothing without confirmation', () => {
    const result = trybun('restore', { input: 'n\n' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Restore stopped. Nothing was changed.');
    expect(result.log).not.toContain('compose stop');
    expect(readFileSync(envPath(), 'utf8')).toBe(INSTALLED_ENV);
  });

  it('changes nothing when the backup cannot be read', () => {
    const result = trybun('restore', { input: 'y\n', STUB_FETCH_EXIT: '1' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('The backup latest could not be read. Nothing was changed');
    expect(readFileSync(envPath(), 'utf8')).toBe(INSTALLED_ENV);
    expect(result.log).not.toContain('restore-data');
  });

  it('refuses an argument that is not a backup ID', () => {
    const result = trybun(['restore', '../backup'], { input: 'y\n' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('"../backup" is not a backup');
    expect(result.log).toBe('');
  });

  it('refuses an unknown option and a second backup ID', () => {
    for (const [args, message] of [
      [['restore', '--replace-foreign'], 'Unknown option "--replace-foreign"'],
      [['restore', '1a2b3c4d', '5e6f7a8b'], 'Name one backup, not "1a2b3c4d" and "5e6f7a8b"'],
    ]) {
      const result = trybun(args, { input: 'y\n' });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(message);
      expect(result.log).toBe('');
    }
  });

  it.each(['own', 'none'])(
    'replaces a storage folder marked by this server or not at all (%s) without a second question',
    (state) => {
      const result = trybun('restore', {
        input: 'y\n',
        STUB_STORAGE_OWNER: `${state} http://seaweedfs:8333/trybun`,
      });

      expect(result.status).toBe(0);
      expect(result.stderr).not.toContain('belongs to another Trybun server');
      expect(result.log).toContain('compose run --rm -T backup restore-data\n');
    },
  );

  describe('a storage folder of another Trybun server', () => {
    const FOREIGN = { STUB_STORAGE_OWNER: 'foreign https://s3.example.com/bucket/trybun' };
    const QUESTION =
      'The storage folder https://s3.example.com/bucket/trybun belongs to another Trybun server. Replace its content? [y/N]: ';

    it('is refused without a terminal, before anything is changed', () => {
      const result = trybun('restore', { input: 'y\ny\n', ...FOREIGN });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'The storage folder https://s3.example.com/bucket/trybun belongs to another Trybun server',
      );
      expect(result.stderr).toContain(
        '--replace-foreign-objects. To test a restore while that server runs, add --test (and --storage-url <url> for an external storage). Nothing was changed',
      );
      expect(result.stderr).not.toContain(QUESTION);
      expect(readFileSync(envPath(), 'utf8')).toBe(INSTALLED_ENV);
      expect(result.log).not.toMatch(/backup configuration|restore-data/);
    });

    // A successful restore replaces ./trybun with the one of the backup, so one run per case.
    it.each([
      [['restore', '--replace-foreign-objects']],
      [['restore', '--replace-foreign-objects', '1a2b3c4d']],
      [['restore', '1a2b3c4d', '--replace-foreign-objects']],
    ])('is replaced with %j after the first confirmation', (args) => {
      const result = trybun(args, { input: 'y\n', ...FOREIGN });

      expect(result.status).toBe(0);
      expect(result.stderr).toContain('Continue? [y/N]: ');
      expect(result.stderr).not.toContain(QUESTION);
      expect(result.log).toContain('backup restore-data --replace-foreign-objects\n');
    });

    it('still needs the first confirmation with --replace-foreign-objects', () => {
      const result = trybun(['restore', '--replace-foreign-objects'], { input: 'n\n', ...FOREIGN });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Restore stopped. Nothing was changed.');
      expect(result.log).toBe(
        'docker version --format {{.Server.Version}}\ndocker compose version --short\n',
      );
    });

    it('is replaced in a terminal after the second question', () => {
      const result = trybun('restore', { input: 'y\ny\n', terminal: true, ...FOREIGN });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(QUESTION);
      expect(result.log).toContain('backup restore-data --replace-foreign-objects\n');
      expect(readFileSync(envPath(), 'utf8')).toBe(RESTORED_ENV);
    });

    it('is kept in a terminal unless the second question is confirmed', () => {
      for (const input of ['y\nn\n', 'y\n\n']) {
        const result = trybun('restore', { input, terminal: true, ...FOREIGN });

        expect(result.status).toBe(1);
        expect(result.stdout).toContain(QUESTION);
        expect(result.stdout).toContain('Restore stopped. Nothing was changed');
        expect(readFileSync(envPath(), 'utf8')).toBe(INSTALLED_ENV);
        expect(result.log).not.toMatch(/backup configuration|restore-data/);
      }
    });
  });

  describe('a storage folder with objects but without a Trybun marker (Q26)', () => {
    const UNMARKED = { STUB_STORAGE_OWNER: 'unmarked https://s3.example.com/bucket/trybun' };

    it('is refused without a terminal, before anything is changed', () => {
      const result = trybun('restore', { input: 'y\ny\n', ...UNMARKED });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'The storage folder https://s3.example.com/bucket/trybun holds objects but no Trybun marker, so it may belong to another application or server; the restore would replace its content. Run ./trybun restore latest in a terminal to confirm, or add --replace-foreign-objects.',
      );
      expect(readFileSync(envPath(), 'utf8')).toBe(INSTALLED_ENV);
      expect(result.log).not.toMatch(/backup configuration|restore-data/);
    });

    it('is replaced in a terminal after the second question', () => {
      const result = trybun('restore', { input: 'y\ny\n', terminal: true, ...UNMARKED });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(
        'The storage folder https://s3.example.com/bucket/trybun holds objects but no Trybun marker. Replace its content? [y/N]: ',
      );
      expect(result.log).toContain('backup restore-data --replace-foreign-objects\n');
    });

    it('is replaced with --replace-foreign-objects', () => {
      const result = trybun(['restore', '--replace-foreign-objects'], {
        input: 'y\n',
        ...UNMARKED,
      });

      expect(result.status).toBe(0);
      expect(result.log).toContain('backup restore-data --replace-foreign-objects\n');
    });
  });

  describe('--test and --storage-url', () => {
    const TEST_FOLDER = 'https://s3.example.com/bucket/trybun-test';
    const BACKUP_FOLDER = 'https://s3.example.com/bucket/trybun';
    const BACKUP_ENV = `${RESTORED_ENV}TRYBUN_S3_URL=${BACKUP_FOLDER}\nTRYBUN_S3_ACCESS_KEY_ID=production-key\n# TRYBUN_S3_REGION=\n`;
    const NEW_FOLDER = { STUB_STORAGE_OWNER: `none ${TEST_FOLDER}` };

    /** The backup's configuration with the .env $1. */
    function backupWithEnv(env) {
      const backup = join(folder, 'backup');
      writeFileSync(join(backup, '.env'), env);
      execFileSync('tar', ['-cf', join(folder, 'configuration.tar'), '-C', backup, '.']);
    }

    // A successful restore replaces ./trybun with the one of the backup, so one run per case.
    it.each([
      [['restore', '--test', '--storage-url', TEST_FOLDER]],
      [['restore', '--storage-url', TEST_FOLDER, '1a2b3c4d', '--test']],
      [['restore', '1a2b3c4d', '--test', '--storage-url', TEST_FOLDER]],
      [['restore', `--storage-url=${TEST_FOLDER}`, '--test', '1a2b3c4d']],
    ])('restores the attachments into that folder with %j', (args) => {
      backupWithEnv(BACKUP_ENV);
      const result = trybun(args, { input: 'y\n', ...NEW_FOLDER });

      expect(result.status).toBe(0);
      // The guard checks the new folder; an empty one asks no second question.
      expect(result.log).toContain(`backup storage-owner --test ${TEST_FOLDER}\n`);
      expect(result.stderr).not.toContain('belongs to another Trybun server');
      expect(result.log).toContain('compose run --rm -T backup restore-data\n');
      expect(result.stdout).toContain(
        `The attachments are restored into ${TEST_FOLDER}, which replaces TRYBUN_S3_URL of the backup's .env; the storage folder of the backup stays unchanged.`,
      );
      expect(result.stdout).toContain(
        `The attachments are in ${TEST_FOLDER} (TRYBUN_S3_URL of .env).`,
      );
      // Only TRYBUN_S3_URL of the restored .env changes; the credentials stay those of the backup.
      expect(readFileSync(envPath(), 'utf8')).toBe(
        BACKUP_ENV.replace(`TRYBUN_S3_URL=${BACKUP_FOLDER}`, `TRYBUN_S3_URL=${TEST_FOLDER}`),
      );
      expect(statSync(envPath()).mode & 0o777).toBe(0o600);
      // No off-site backups were configured, so nothing to say about them.
      expect(result.stdout).not.toContain('was emptied');
    });

    describe('with backups on an external S3 storage', () => {
      const BACKUP_REPOSITORY = 'https://backups.example.com/bucket/trybun';
      const OFF_SITE_ENV = `${BACKUP_ENV}TRYBUN_BACKUP_S3_URL=${BACKUP_REPOSITORY}\nTRYBUN_BACKUP_S3_ACCESS_KEY_ID=backup-key\nTRYBUN_BACKUP_S3_SECRET_ACCESS_KEY=backup-secret\n`;
      const NOTICE = `TRYBUN_BACKUP_S3_URL of .env was emptied, so this test server makes no backups on the external S3 storage and leaves the backups of ${BACKUP_REPOSITORY} untouched. To back it up off-site, set TRYBUN_BACKUP_S3_URL to a repository of its own, not that one.`;

      it('empties TRYBUN_BACKUP_S3_URL of the restored .env and says so', () => {
        backupWithEnv(OFF_SITE_ENV);
        const result = trybun(['restore', '--test', '--storage-url', TEST_FOLDER], {
          input: 'y\n',
          ...NEW_FOLDER,
        });

        expect(result.status).toBe(0);
        // The line stays with an empty value; the unused credentials stay unchanged.
        expect(readFileSync(envPath(), 'utf8')).toBe(
          OFF_SITE_ENV.replace(
            `TRYBUN_S3_URL=${BACKUP_FOLDER}`,
            `TRYBUN_S3_URL=${TEST_FOLDER}`,
          ).replace(`TRYBUN_BACKUP_S3_URL=${BACKUP_REPOSITORY}`, 'TRYBUN_BACKUP_S3_URL='),
        );
        expect(result.stdout).toContain(NOTICE);
      });

      it('keeps TRYBUN_BACKUP_S3_URL without --test', () => {
        backupWithEnv(OFF_SITE_ENV);
        const result = trybun('restore', { input: 'y\n' });

        expect(result.status).toBe(0);
        expect(readFileSync(envPath(), 'utf8')).toBe(OFF_SITE_ENV);
        expect(result.stdout).not.toContain('TRYBUN_BACKUP_S3_URL');
      });

      it('empties TRYBUN_BACKUP_S3_URL with --test alone for a backup on the SeaweedFS of Compose', () => {
        const env = `${RESTORED_ENV}TRYBUN_BACKUP_S3_URL=${BACKUP_REPOSITORY}\n`;
        backupWithEnv(env);
        const result = trybun(['restore', '--test', '1a2b3c4d'], {
          input: 'y\n',
          STUB_STORAGE_OWNER: 'none http://seaweedfs:8333/trybun',
        });

        expect(result.status).toBe(0);
        // storage-owner --test refuses a backup on an external storage without --storage-url.
        expect(result.log).toContain('backup storage-owner --test\n');
        expect(readFileSync(envPath(), 'utf8')).toBe(
          env.replace(`TRYBUN_BACKUP_S3_URL=${BACKUP_REPOSITORY}`, 'TRYBUN_BACKUP_S3_URL='),
        );
        expect(result.stdout).toContain(
          'A test restore: the restored .env gets no TRYBUN_BACKUP_S3_URL, so the backups of the backed-up server stay untouched.',
        );
        expect(result.stdout).toContain(NOTICE);
        expect(result.stdout).not.toContain('The attachments are');
      });

      it('rewrites the lines as Docker Compose reads them', () => {
        backupWithEnv(
          `${RESTORED_ENV}export TRYBUN_S3_URL=${BACKUP_FOLDER} # production\n  TRYBUN_BACKUP_S3_URL = "${BACKUP_REPOSITORY}" # off-site\n# TRYBUN_BACKUP_S3_URL=commented\n`,
        );
        const result = trybun(['restore', '--test', '--storage-url', TEST_FOLDER], {
          input: 'y\n',
          ...NEW_FOLDER,
        });

        expect(result.status).toBe(0);
        expect(readFileSync(envPath(), 'utf8')).toBe(
          `${RESTORED_ENV}TRYBUN_S3_URL=${TEST_FOLDER}\nTRYBUN_BACKUP_S3_URL=\n# TRYBUN_BACKUP_S3_URL=commented\n`,
        );
        expect(result.stdout).toContain(NOTICE);
      });
    });

    it('is refused without --test before anything is changed', () => {
      for (const args of [
        ['restore', '--storage-url', TEST_FOLDER],
        ['restore', '1a2b3c4d', `--storage-url=${TEST_FOLDER}`, '--replace-foreign-objects'],
      ]) {
        const result = trybun(args, { input: 'y\n' });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
          'A restore into another folder is a test restore: add --test, e.g. ./trybun restore --test --storage-url <url>.',
        );
        expect(result.log).toBe('');
      }
    });

    it('is required by --test for a backup on an external storage', () => {
      backupWithEnv(BACKUP_ENV);
      const result = trybun(['restore', '--test'], {
        input: 'y\n',
        STUB_STORAGE_OWNER: `external ${BACKUP_FOLDER}`,
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        `The attachments of the backup are on the external storage ${BACKUP_FOLDER}, which the backed-up installation may still use. Restore them into an empty folder for the test with --storage-url <url>, e.g. ./trybun restore latest --test --storage-url https://s3.example.com/bucket-restore-test. Nothing was changed`,
      );
      expect(readFileSync(envPath(), 'utf8')).toBe(INSTALLED_ENV);
      expect(result.log).not.toMatch(/backup configuration|restore-data/);
    });

    it('refuses a folder that overlaps a backup repository before anything is changed', () => {
      backupWithEnv(BACKUP_ENV);
      const result = trybun(['restore', '--test', '--storage-url', TEST_FOLDER], {
        input: 'y\n',
        STUB_STORAGE_OWNER: `repository ${TEST_FOLDER} s3.example.com/bucket/trybun-test/backups`,
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        `The storage folder ${TEST_FOLDER} overlaps the backup repository s3.example.com/bucket/trybun-test/backups (TRYBUN_BACKUP_S3_URL), so the restore would delete backups.`,
      );
      expect(readFileSync(envPath(), 'utf8')).toBe(INSTALLED_ENV);
      expect(result.log).not.toMatch(/backup configuration|restore-data/);
    });

    it('accepts the scheme in any case, as the server', () => {
      const url = 'HTTPS://S3.Example.com/bucket/trybun-test';
      const result = trybun(['restore', '--test', '--storage-url', url], {
        input: 'y\n',
        STUB_STORAGE_OWNER: `none ${url}`,
      });

      expect(result.status).toBe(0);
      expect(variables(readFileSync(envPath(), 'utf8')).TRYBUN_S3_URL).toBe(url);
    });

    it('sets TRYBUN_S3_URL in a restored .env that uses the default folder', () => {
      const result = trybun(
        ['restore', '--test', '--storage-url', 'http://seaweedfs:8333/trybun-test'],
        {
          input: 'y\n',
          STUB_STORAGE_OWNER: 'none http://seaweedfs:8333/trybun-test',
        },
      );

      expect(result.status).toBe(0);
      expect(readFileSync(envPath(), 'utf8')).toBe(
        `${RESTORED_ENV}TRYBUN_S3_URL=http://seaweedfs:8333/trybun-test\n`,
      );
    });

    it('keeps one TRYBUN_S3_URL when the restored .env sets it twice', () => {
      backupWithEnv(
        `TRYBUN_S3_URL=${BACKUP_FOLDER}\n${RESTORED_ENV}TRYBUN_S3_URL=${BACKUP_FOLDER}\n`,
      );
      const result = trybun(['restore', '--test', '--storage-url', TEST_FOLDER], {
        input: 'y\n',
        ...NEW_FOLDER,
      });

      expect(result.status).toBe(0);
      expect(readFileSync(envPath(), 'utf8')).toBe(`TRYBUN_S3_URL=${TEST_FOLDER}\n${RESTORED_ENV}`);
    });

    it('asks the second question for a new folder of another Trybun server', () => {
      backupWithEnv(BACKUP_ENV);
      const result = trybun(['restore', '--test', '--storage-url', TEST_FOLDER], {
        input: 'y\ny\n',
        STUB_STORAGE_OWNER: `foreign ${TEST_FOLDER}`,
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        `The storage folder ${TEST_FOLDER} belongs to another Trybun server; the restore would replace its content.`,
      );
      expect(result.stderr).not.toContain('restore the attachments into another folder');
      expect(readFileSync(envPath(), 'utf8')).toBe(INSTALLED_ENV);
      expect(result.log).not.toMatch(/backup configuration|restore-data/);
    });

    it('replaces a new folder of another Trybun server with --replace-foreign-objects', () => {
      backupWithEnv(BACKUP_ENV);
      const result = trybun(
        ['restore', '--test', '--replace-foreign-objects', '--storage-url', TEST_FOLDER],
        { input: 'y\n', STUB_STORAGE_OWNER: `foreign ${TEST_FOLDER}` },
      );

      expect(result.status).toBe(0);
      expect(result.log).toContain('backup restore-data --replace-foreign-objects\n');
      expect(variables(readFileSync(envPath(), 'utf8')).TRYBUN_S3_URL).toBe(TEST_FOLDER);
    });

    it.each([`${BACKUP_FOLDER}`, 'https://s3.example.com/bucket', `${BACKUP_FOLDER}/test`])(
      'refuses %s, which overlaps the folder of the backup, before anything is changed',
      (url) => {
        backupWithEnv(BACKUP_ENV);
        const result = trybun(['restore', '--test', '--storage-url', url], {
          input: 'y\n',
          STUB_STORAGE_OWNER: `overlap ${BACKUP_FOLDER}`,
        });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
          `The folder ${url} of --storage-url overlaps the storage folder ${BACKUP_FOLDER} of the backup, which the restore leaves untouched. Name a folder outside it, e.g. another bucket. Nothing was changed`,
        );
        expect(readFileSync(envPath(), 'utf8')).toBe(INSTALLED_ENV);
        expect(result.log).not.toMatch(/backup configuration|restore-data/);
      },
    );

    it.each([
      ['https://key:secret@s3.example.com/bucket/trybun-test', 'credentials'],
      ['https://s3.example.com/bucket/trybun-test?versionId=1', 'a query'],
      ['https://s3.example.com/bucket/trybun-test#part', 'a fragment'],
      ['https://s3.example.com/', 'no bucket'],
      ['https://s3.example.com/My_Bucket', 'a bucket name S3 does not allow'],
      ['s3://bucket/trybun-test', 'another protocol'],
      ['https://s3.example.com/bucket/../trybun', 'a parent folder'],
      ['https://s3.example.com/bucket/%2E%2E/trybun', 'an encoded parent folder'],
      ['https://s3.example.com/bucket/$HOME', 'a character that needs quoting in .env'],
    ])('refuses %s (%s) before anything is changed', (url) => {
      const result = trybun(['restore', '--storage-url', url], { input: 'y\n' });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`"${url}" is not the URL of a storage folder.`);
      expect(result.log).toBe('');
    });

    it('refuses a missing URL and a second --storage-url', () => {
      for (const [args, message] of [
        [['restore', '--storage-url'], 'Name the folder after --storage-url'],
        [
          ['restore', '--storage-url', TEST_FOLDER, `--storage-url=${TEST_FOLDER}`],
          'Name one folder with --storage-url, not two.',
        ],
      ]) {
        const result = trybun(args, { input: 'y\n' });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(message);
        expect(result.log).toBe('');
      }
    });
  });

  it('changes nothing when the storage folder of the backup cannot be read', () => {
    const result = trybun('restore', { input: 'y\n', STUB_STORAGE_OWNER_EXIT: '1' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'The storage folder of the backup latest could not be read. See the messages above. Nothing was changed',
    );
    expect(readFileSync(envPath(), 'utf8')).toBe(INSTALLED_ENV);
    expect(result.log).not.toContain('restore-data');
  });

  it('explains how to restore onto a new server without .env', () => {
    rmSync(envPath());
    const result = trybun('restore', { input: 'y\n' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('copy the .env of the installation');
  });
});

describe('./trybun update', () => {
  const CHANGELOG = `# Changelog

## [0.3.0](https://github.com/trybun/trybun/compare/v0.2.0...v0.3.0) (2026-11-15)

* the feature of 0.3.0

## [0.2.0](https://github.com/trybun/trybun/compare/v0.1.0...v0.2.0) (2026-11-01)

* the feature of 0.2.0
`;

  /** Publishes the deployment package of a release in the stub's release folder. */
  function release(version, { checksum } = {}) {
    const name = `trybun-${version}`;
    const source = join(folder, 'source');
    rmSync(source, { recursive: true, force: true });
    writeFiles(join(source, name), {
      'compose.yaml': composeOf(version),
      trybun: '#!/bin/sh\necho new\n',
      '.env.example': 'TRYBUN_DOMAIN=\n',
      'CHANGELOG.md': `# Changelog\n\n## [${version}](https://example.com) (2026-12-01)\n\n* the feature of ${version}\n\n${CHANGELOG.slice(13)}`,
      'docker/caddy/Caddyfile': 'new',
    });
    const download = join(folder, 'releases', `v${version}`);
    mkdirSync(download, { recursive: true });
    const archive = join(download, `${name}.tar.gz`);
    execFileSync('tar', ['-czf', archive, '-C', source, name]);
    const sum = checksum ?? createHash('sha256').update(readFileSync(archive)).digest('hex');
    writeFileSync(join(download, 'SHA256SUMS'), `${sum}  ${name}.tar.gz\n`);
  }

  beforeEach(installed);

  it('backs up, then installs and starts the new release and keeps .env', () => {
    release('0.3.0');
    const result = trybun(['update', '0.3.0']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('* the feature of 0.3.0');
    expect(result.stdout).not.toContain('the feature of 0.2.0');
    expect(readFileSync(join(folder, 'package/compose.yaml'), 'utf8')).toBe(composeOf('0.3.0'));
    expect(readFileSync(join(folder, 'package/trybun'), 'utf8')).toBe('#!/bin/sh\necho new\n');
    expect(readFileSync(join(folder, 'package/docker/caddy/Caddyfile'), 'utf8')).toBe('new');
    expect(existsSync(join(folder, 'package/docker/obsolete.txt'))).toBe(false);
    expect(readFileSync(envPath(), 'utf8')).toBe(INSTALLED_ENV);
    const steps = order(
      result.log,
      'curl -fsSL -o',
      'docker pull --quiet ghcr.io/trybun/server:0.3.0',
      'backup backup pre-update',
      'compose up -d --wait --remove-orphans',
    );
    // Images on the server are not pulled again, each image only once.
    expect(result.log).not.toContain('pull --quiet valkey');
    expect(result.log.split('docker pull').length).toBe(2);
    expect(steps.every((index) => index >= 0)).toBe(true);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    expect(result.stdout).toContain('Updated Trybun from 0.2.0 to 0.3.0');
    expect(result.stdout).toContain('1a2b3c4d');
  });

  it('names the one command that returns to the previous version when the update fails', () => {
    release('0.3.0');
    const result = trybun(['update', '0.3.0'], { STUB_UP_EXIT: '1' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'To return to version 0.2.0 with the data from before the update, run: ./trybun restore 1a2b3c4d',
    );
  });

  it('changes nothing when the download does not match its checksum', () => {
    release('0.3.0', { checksum: '0'.repeat(64) });
    const result = trybun(['update', '0.3.0']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('does not match its checksum');
    expect(result.log).not.toContain('backup');
    expect(readFileSync(join(folder, 'package/compose.yaml'), 'utf8')).toBe(composeOf('0.2.0'));
  });

  it('changes nothing when the images cannot be pulled', () => {
    release('0.3.0');
    const result = trybun(['update', '0.3.0'], { STUB_PULL_EXIT: '1' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('could not be pulled');
    expect(result.log).not.toContain('backup');
    expect(readFileSync(join(folder, 'package/compose.yaml'), 'utf8')).toBe(composeOf('0.2.0'));
  });

  it('changes nothing when the backup before the update fails', () => {
    release('0.3.0');
    const result = trybun(['update', '0.3.0'], { STUB_BACKUP_EXIT: '1' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('The backup before the update failed, so nothing was changed');
    expect(result.log).not.toContain('compose up');
    expect(readFileSync(join(folder, 'package/compose.yaml'), 'utf8')).toBe(composeOf('0.2.0'));
  });

  it('asks before a new MAJOR version and changes nothing without confirmation', () => {
    release('1.0.0');
    const result = trybun(['update', '1.0.0'], { input: 'n\n' });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('1.0.0 is a new MAJOR version');
    expect(result.stdout).toContain('* the feature of 1.0.0');
    expect(result.log).not.toContain('backup');
  });

  it('updates to a new MAJOR version after confirmation', () => {
    release('1.0.0');
    const result = trybun(['update', '1.0.0'], { input: 'y\n' });

    expect(result.status).toBe(0);
    expect(readFileSync(join(folder, 'package/compose.yaml'), 'utf8')).toBe(composeOf('1.0.0'));
  });

  it('accepts a release candidate of the next version', () => {
    release('0.3.0-rc.1');
    const result = trybun(['update', '0.3.0-rc.1']);

    expect(result.status).toBe(0);
  });

  it.each([
    ['', 'Name the version to update to'],
    ['v0.3.0', '"v0.3.0" is not a version'],
    ['0.1.9', '0.1.9 is older than the installed 0.2.0'],
    ['0.2.0-rc.1', '0.2.0-rc.1 is older than the installed 0.2.0'],
  ])('refuses the version "%s"', (version, message) => {
    const result = trybun(['update', version]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(result.log).toBe('');
  });

  it('does nothing when the version is installed', () => {
    const result = trybun(['update', '0.2.0']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Trybun 0.2.0 is already installed.');
    expect(result.log).toBe('');
  });

  it('refuses a TRYBUN_VERSION in .env, which would keep the old images', () => {
    writeFileSync(envPath(), `${INSTALLED_ENV}TRYBUN_VERSION=0.2.0\n`);
    const result = trybun(['update', '0.3.0']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('TRYBUN_VERSION is set in .env');
  });
});

describe('./trybun uninstall', () => {
  // A running installation: its containers, volumes, network and images.
  const RUNNING = {
    STUB_CONTAINERS: 'c1\\nc2\\n',
    STUB_VOLUMES: 'trybun_postgres-data\\ntrybun_backup-data\\n',
    STUB_NETWORKS: 'n1\\n',
    STUB_IMAGES: 'ghcr.io/trybun/server:0.2.0\\ncaddy:2\\nclamav/clamav:1\\n',
    STUB_CONTAINER_IMAGE: 'ghcr.io/trybun/server:0.2.0',
    STUB_PRESENT_IMAGES: 'ghcr.io/trybun/server:0.2.0 caddy:2',
  };
  const CONFIRMED = 'trybun.example.com\n';

  beforeEach(installed);

  const withS3 = () =>
    writeFileSync(envPath(), `${INSTALLED_ENV}TRYBUN_BACKUP_S3_URL=s3:https://s3.example.com/b\n`);

  it('deletes the containers, data, networks and images after the domain is typed', () => {
    const result = trybun('uninstall', { input: CONFIRMED, ...RUNNING });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('no backup of Trybun will remain anywhere');
    expect(result.log).not.toContain('backup backup');
    const steps = order(
      result.log,
      'compose down --volumes --remove-orphans',
      'docker rm -f c1 c2',
      'docker volume rm trybun_postgres-data trybun_backup-data',
      'docker network rm n1',
      'docker image rm caddy:2',
      'docker image rm ghcr.io/trybun/server:0.2.0',
    );
    expect(steps.every((index) => index >= 0)).toBe(true);
    // An image that is not on the server is not deleted.
    expect(result.log).not.toContain('image rm clamav');
    // The folder and .env stay.
    expect(readFileSync(envPath(), 'utf8')).toBe(INSTALLED_ENV);
    expect(result.stdout).toContain('Trybun is deleted from this server.');
    expect(result.stdout).toContain(`rm -rf '${join(folder, 'package')}'`);
  });

  it('changes nothing unless the domain of the installation is typed', () => {
    for (const input of ['y\n', 'trybun.example.org\n', '']) {
      const result = trybun('uninstall', { input, ...RUNNING });

      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/Uninstall stopped. Nothing was changed.|Nothing was changed./);
      expect(result.log).not.toMatch(/compose down|docker rm|volume rm|image rm/);
    }
  });

  it('backs up to the S3 storage first when one is configured', () => {
    withS3();

    const result = trybun('uninstall', { input: CONFIRMED, ...RUNNING });

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('no backup of Trybun will remain');
    const [backup, down] = order(result.log, 'backup backup uninstall', 'compose down');
    expect(backup).toBeGreaterThanOrEqual(0);
    expect(down).toBeGreaterThan(backup);
    expect(result.stdout).toContain('Backup 5e6f7a8b stored on the external S3 storage.');
    expect(result.stdout).toContain('run ./trybun restore');
  });

  it('deletes nothing when the last backup fails', () => {
    withS3();

    const result = trybun('uninstall', { input: CONFIRMED, ...RUNNING, STUB_BACKUP_EXIT: '1' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('The last backup failed, so nothing was deleted.');
    expect(result.log).not.toMatch(/compose down|docker rm|volume rm|image rm/);
  });

  it('keeps an image another container uses and says so', () => {
    const result = trybun('uninstall', {
      input: CONFIRMED,
      ...RUNNING,
      STUB_USED_IMAGES: 'caddy:2',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      'Kept the image caddy:2: another container on this server uses it.',
    );
    expect(result.log).toContain('docker image rm ghcr.io/trybun/server:0.2.0');
  });

  it('asks to run it again when deleting fails', () => {
    const result = trybun('uninstall', { input: CONFIRMED, ...RUNNING, STUB_DOWN_EXIT: '1' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('run ./trybun uninstall again');
  });

  it('reports that nothing is installed when nothing is left', () => {
    const result = trybun('uninstall', { input: '' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Trybun is not installed on this server');
    expect(result.log).not.toMatch(/compose down|image rm/);
  });

  it('needs the .env of the installation', () => {
    rmSync(envPath());

    const result = trybun('uninstall', { input: CONFIRMED, ...RUNNING });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.env is missing');
    expect(result.log).not.toContain('compose down');
  });
});
