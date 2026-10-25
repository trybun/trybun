import { spawnSync } from 'node:child_process';
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

// Runs `deploy/trybun` in a copy of the deployment package, with stubs of docker, ss, getent and
// ip on PATH and a fake /proc/meminfo (§15.5).

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
  const result = spawnSync('sh', [join(folder, 'package/trybun'), command], {
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
    const result = trybun('update');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown command "update"');
  });
});
