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
  "compose ps --status running --services") [ -e .env ] || exit 1; printf '%s' "$STUB_RUNNING" ;;
  "compose up -d --wait") exit "$STUB_UP_EXIT" ;;
  "compose exec -T api node dist/cli.js setup-token") echo "$STUB_SETUP_OUTPUT"; exit "$STUB_SETUP_EXIT" ;;
  "compose run --rm -T backup backup "*) printf '%b' "$STUB_BACKUP_OUTPUT"; exit "$STUB_BACKUP_EXIT" ;;
  "compose run --rm -T --no-deps backup list") echo 'Backups on the local backup volume:' ;;
  "compose stop") ;;
  "compose run --rm -T --no-deps backup fetch "*) exit "$STUB_FETCH_EXIT" ;;
  "compose run --rm -T --no-deps backup configuration") cat "$STUB_CONFIGURATION" ;;
  "compose up -d --wait postgres") ;;
  "compose exec -T postgres "*) cat >"$STUB_STDIN" ;;
  "compose run --rm -T backup restore-data") exit "$STUB_RESTORE_EXIT" ;;
  "compose -f "*" --project-directory . config --images") printf 'ghcr.io/trybun/server:0.3.0\nvalkey:9\nghcr.io/trybun/server:0.3.0\n' ;;
  "image inspect valkey:9") ;;
  "image inspect "*) exit 1 ;;
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

function trybun(command, { input = ANSWERS, memory = GIB_16, ...stubs } = {}) {
  meminfo(memory);
  const args = Array.isArray(command) ? command : [command];
  const result = spawnSync('sh', [join(folder, 'package/trybun'), ...args], {
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
