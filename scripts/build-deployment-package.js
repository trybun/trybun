// Deployment package of a release (§15.4): everything an Administrator needs to install and run
// Trybun from the published images, without the source code.
// Usage: node scripts/build-deployment-package.js <version> <output directory>
// Writes `trybun-<version>.tar.gz` with the folder `trybun-<version>/`.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVersion } from './release.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Files of the package besides `compose.yaml` and the files it mounts, by their path in the
 * repository and in the package.
 */
const FILES = [
  { from: '.env.example', to: '.env.example' },
  { from: 'deploy/INSTALL.md', to: 'INSTALL.md' },
  // The command of the package (`./trybun install`); the copy keeps its executable bit.
  { from: 'deploy/trybun', to: 'trybun' },
  { from: 'LICENSE', to: 'LICENSE' },
];

const BUILD = /^(\s*)build:/;
const BIND_MOUNT = /^\s*-\s*['"]?\.\/([^:\s'"]+):/;
const VERSION_DEFAULT = /\$\{TRYBUN_VERSION:-latest\}/g;

/**
 * The `compose.yaml` of the package: the images of the release instead of `latest`, and without
 * the `build:` sections, so Compose only pulls the published images (§15.4).
 * @param {string} compose content of the repository's `compose.yaml`
 * @param {string} version
 */
export function packageCompose(compose, version) {
  const lines = [];
  let buildIndent = -1;
  for (const line of compose.split('\n')) {
    const indent = line.length - line.trimStart().length;
    if (buildIndent >= 0 && line.trim() !== '' && indent > buildIndent) {
      continue;
    }
    buildIndent = -1;
    const build = BUILD.exec(line);
    if (build) {
      buildIndent = build[1].length;
      continue;
    }
    lines.push(line);
  }
  const result = lines.join('\n').replace(VERSION_DEFAULT, `\${TRYBUN_VERSION:-${version}}`);
  if (/:-latest\}/.test(result)) {
    throw new Error('compose.yaml refers to a `latest` image the package cannot pin');
  }
  return result;
}

/**
 * Files and folders that `compose.yaml` mounts from its own folder (e.g. the Caddy and Keycloak
 * configuration); the package must contain them.
 * @param {string} compose
 * @returns {string[]} paths relative to the folder of `compose.yaml`
 */
export function bindMounts(compose) {
  return [
    ...new Set(
      compose
        .split('\n')
        .map((line) => BIND_MOUNT.exec(line)?.[1])
        .filter((path) => path !== undefined),
    ),
  ];
}

/**
 * Writes the package folder and its archive.
 * @param {string} version
 * @param {string} output
 * @returns {string} path of the archive
 */
export function buildDeploymentPackage(version, output) {
  if (!parseVersion(version) || version.startsWith('v')) {
    throw new Error(`Not a version: ${version}`);
  }
  const name = `trybun-${version}`;
  const folder = join(output, name);
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  const compose = readFileSync(join(ROOT, 'compose.yaml'), 'utf8');
  writeFileSync(join(folder, 'compose.yaml'), packageCompose(compose, version));
  const files = [...FILES, ...bindMounts(compose).map((path) => ({ from: path, to: path }))];
  for (const { from, to } of files) {
    cpSync(join(ROOT, from), join(folder, to), { recursive: true });
  }
  const archive = join(output, `${name}.tar.gz`);
  execFileSync('tar', ['-czf', archive, '-C', output, name]);
  return archive;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, output] = process.argv.slice(2);
  if (!version || !output) {
    process.stderr.write('Usage: node scripts/build-deployment-package.js <version> <output>\n');
    process.exit(2);
  }
  process.stdout.write(`${buildDeploymentPackage(version, resolve(output))}\n`);
}
