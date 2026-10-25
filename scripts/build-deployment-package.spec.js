import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { bindMounts, buildDeploymentPackage, packageCompose } from './build-deployment-package.js';

const COMPOSE = `services:
  web:
    image: ghcr.io/trybun/web:\${TRYBUN_VERSION:-latest}
    build:
      # The image of the web application.
      context: .
      dockerfile: docker/web/Dockerfile

    environment:
      TRYBUN_DOMAIN: \${TRYBUN_DOMAIN}
  postgres:
    image: ghcr.io/trybun/postgres:\${TRYBUN_VERSION:-latest}
    build: docker/postgres
    volumes:
      - postgres-data:/var/lib/postgresql
  caddy:
    volumes:
      - ./docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - './docker/keycloak/realm:/config/realm:ro'
`;

describe('packageCompose', () => {
  it('pins the images to the release and drops the build sections', () => {
    expect(packageCompose(COMPOSE, '1.4.0')).toBe(`services:
  web:
    image: ghcr.io/trybun/web:\${TRYBUN_VERSION:-1.4.0}

    environment:
      TRYBUN_DOMAIN: \${TRYBUN_DOMAIN}
  postgres:
    image: ghcr.io/trybun/postgres:\${TRYBUN_VERSION:-1.4.0}
    volumes:
      - postgres-data:/var/lib/postgresql
  caddy:
    volumes:
      - ./docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - './docker/keycloak/realm:/config/realm:ro'
`);
  });

  it('refuses a latest image it cannot pin', () => {
    expect(() => packageCompose('    image: valkey:${VALKEY_VERSION:-latest}\n', '1.4.0')).toThrow(
      'latest',
    );
  });
});

describe('bindMounts', () => {
  it('lists the files mounted from the folder of compose.yaml', () => {
    expect(bindMounts(COMPOSE)).toEqual(['docker/caddy/Caddyfile', 'docker/keycloak/realm']);
  });
});

describe('buildDeploymentPackage', () => {
  const output = mkdtempSync(join(tmpdir(), 'trybun-package-'));
  afterAll(() => rmSync(output, { recursive: true, force: true }));

  it('packs compose.yaml with everything it mounts, .env.example, INSTALL.md and trybun (§15.4)', () => {
    const archive = buildDeploymentPackage('0.1.0', output);

    expect(archive).toBe(join(output, 'trybun-0.1.0.tar.gz'));
    const files = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).split('\n');
    expect(files).toEqual(
      expect.arrayContaining([
        'trybun-0.1.0/compose.yaml',
        'trybun-0.1.0/.env.example',
        'trybun-0.1.0/INSTALL.md',
        'trybun-0.1.0/trybun',
        'trybun-0.1.0/LICENSE',
        'trybun-0.1.0/docker/caddy/Caddyfile',
        'trybun-0.1.0/docker/keycloak/apply-config.sh',
        'trybun-0.1.0/docker/keycloak/realm/trybun.yaml',
        'trybun-0.1.0/docker/keycloak/themes/trybun/login/theme.properties',
      ]),
    );
    expect(files.filter((file) => file.includes('/dev/'))).toEqual([]);
    expect(statSync(join(output, 'trybun-0.1.0', 'trybun')).mode & 0o111).toBe(0o111);
    const compose = readFileSync(join(output, 'trybun-0.1.0', 'compose.yaml'), 'utf8');
    expect(compose).not.toMatch(/^\s*build:/m);
    expect(compose).toContain('ghcr.io/trybun/server:${TRYBUN_VERSION:-0.1.0}');
    expect(compose).not.toContain(':-latest}');
  });

  it('refuses a tag instead of a version', () => {
    expect(() => buildDeploymentPackage('v0.1.0', output)).toThrow('Not a version');
  });
});
