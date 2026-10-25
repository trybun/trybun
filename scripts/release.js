// Versions of a release (§2.11, §15.4), used by `.github/workflows/release.yml` and
// `.github/workflows/image-scan.yml`.
// Usage:
//   node scripts/release.js metadata <tag>      outputs of the release with the tag (GITHUB_OUTPUT)
//   node scripts/release.js candidate <version> the next release candidate of the version
//   node scripts/release.js set-version <version> writes the version into the package.json files
//   node scripts/release.js supported-series <releases.json> image tags of the supported series
//                                               (GITHUB_OUTPUT) from `gh release list --json`
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const CANDIDATE = /^rc\.(\d+)$/;

/**
 * @typedef {object} Version
 * @property {number} major
 * @property {number} minor
 * @property {number} patch
 * @property {string | undefined} prerelease e.g. `rc.1`
 */

/**
 * A Semantic Versioning number, with or without the `v` of its tag.
 * @param {string} text
 * @returns {Version | undefined}
 */
export function parseVersion(text) {
  const match = VERSION.exec(text);
  if (!match) {
    return undefined;
  }
  const [, major, minor, patch, prerelease] = match;
  return { major: Number(major), minor: Number(minor), patch: Number(patch), prerelease };
}

/**
 * Orders two versions by precedence; a release candidate precedes its release.
 * @param {Version} a
 * @param {Version} b
 */
export function compareVersions(a, b) {
  const core = a.major - b.major || a.minor - b.minor || a.patch - b.patch;
  if (core !== 0 || a.prerelease === b.prerelease) {
    return core;
  }
  if (a.prerelease === undefined || b.prerelease === undefined) {
    return a.prerelease === undefined ? 1 : -1;
  }
  return candidateNumber(a.prerelease) - candidateNumber(b.prerelease);
}

function candidateNumber(prerelease) {
  return Number(CANDIDATE.exec(prerelease)?.[1] ?? 0);
}

function format({ major, minor, patch, prerelease }) {
  return `${major}.${minor}.${patch}${prerelease === undefined ? '' : `-${prerelease}`}`;
}

/** The released versions, parsed from tags; other tags are ignored. */
function parseAll(versions) {
  return versions.map(parseVersion).filter((version) => version !== undefined);
}

function isHighest(version, versions) {
  return versions.every((other) => compareVersions(version, other) >= 0);
}

/**
 * Tags of the images of a release (§2.11): `X.Y.Z`, plus the moving tags `X.Y` and `X` while the
 * release is the highest one of their series – a PATCH release of a maintenance branch does not
 * take `X` from a newer MINOR release. A release candidate gets only its own tag.
 * @param {string} version
 * @param {string[]} releasedVersions versions or tags of the existing releases
 * @returns {string[]}
 */
export function imageTags(version, releasedVersions) {
  const release = parseVersion(version);
  if (!release) {
    throw new Error(`Not a version: ${version}`);
  }
  if (release.prerelease !== undefined) {
    return [format(release)];
  }
  const stable = parseAll(releasedVersions).filter((other) => other.prerelease === undefined);
  const sameMajor = stable.filter((other) => other.major === release.major);
  const sameMinor = sameMajor.filter((other) => other.minor === release.minor);
  const tags = [format(release)];
  if (isHighest(release, sameMinor)) {
    tags.push(`${release.major}.${release.minor}`);
  }
  if (isHighest(release, sameMajor)) {
    tags.push(`${release.major}`);
  }
  return tags;
}

/**
 * Whether the GitHub Release becomes the latest release: never for a release candidate (§2.11),
 * and not for a PATCH release of an older series.
 * @param {string} version
 * @param {string[]} releasedVersions
 */
export function isLatestRelease(version, releasedVersions) {
  const release = parseVersion(version);
  if (!release || release.prerelease !== undefined) {
    return false;
  }
  return isHighest(
    release,
    parseAll(releasedVersions).filter((other) => other.prerelease === undefined),
  );
}

/**
 * The next release candidate `X.Y.Z-rc.N` of the version proposed by the release pull request.
 * @param {string} version
 * @param {string[]} releasedVersions
 */
export function nextCandidate(version, releasedVersions) {
  const release = parseVersion(version);
  if (!release || release.prerelease !== undefined) {
    throw new Error(`Not a release version: ${version}`);
  }
  if (parseAll(releasedVersions).some((other) => compareVersions(other, release) === 0)) {
    throw new Error(`${format(release)} is already released`);
  }
  const numbers = parseAll(releasedVersions)
    .filter((other) => compareVersions({ ...other, prerelease: undefined }, release) === 0)
    .map((other) => Number(CANDIDATE.exec(other.prerelease ?? '')?.[1] ?? 0));
  return `${format(release)}-rc.${Math.max(0, ...numbers) + 1}`;
}

/**
 * What the release workflow needs to know about the release with the tag.
 * @param {string} tag e.g. `v1.4.0`
 * @param {string[]} releasedVersions
 */
export function releaseMetadata(tag, releasedVersions) {
  const release = parseVersion(tag);
  if (!release) {
    throw new Error(`Not a release tag: ${tag}`);
  }
  const version = format(release);
  return {
    version,
    prerelease: release.prerelease !== undefined,
    latest: isLatestRelease(version, releasedVersions),
    'image-tags': imageTags(version, releasedVersions),
  };
}

/**
 * @typedef {object} PublishedRelease a GitHub Release, as listed by `gh release list --json`
 * @property {string} tagName
 * @property {string} publishedAt
 * @property {boolean} isDraft
 * @property {boolean} isPrerelease
 */

/** How long the last release of the previous MAJOR series stays supported (§2.11). */
const PREVIOUS_SERIES_MONTHS = 6;

/**
 * The supported series whose published images the daily image scan checks (§2.10, §2.11): the
 * `X.Y` tag of the highest release, and for 6 months after the first release of a new MAJOR
 * version the `X.Y` tag of the last release of the previous series. Drafts and pre-releases are
 * not published images.
 * @param {PublishedRelease[]} releases
 * @param {Date} now
 * @returns {{ current: string, previous: string }} image tags, empty when there is none
 */
export function supportedSeries(releases, now) {
  const published = releases
    .filter((release) => !release.isDraft && !release.isPrerelease)
    .map((release) => ({ ...release, version: parseVersion(release.tagName) }))
    .filter(({ version }) => version !== undefined && version.prerelease === undefined)
    .sort((a, b) => compareVersions(a.version, b.version));
  const highest = published.at(-1);
  if (!highest) {
    return { current: '', previous: '' };
  }
  const series = ({ major, minor }) => `${major}.${minor}`;
  const firstOfMajor = published.find(({ version }) => version.major === highest.version.major);
  const lastOfPrevious = published.findLast(({ version }) => version.major < highest.version.major);
  const supportEnds = new Date(firstOfMajor.publishedAt);
  supportEnds.setUTCMonth(supportEnds.getUTCMonth() + PREVIOUS_SERIES_MONTHS);
  return {
    current: series(highest.version),
    previous: lastOfPrevious && now < supportEnds ? series(lastOfPrevious.version) : '',
  };
}

/**
 * The package.json files whose version release-please updates (`release-please-config.json`).
 * @returns {string[]} paths relative to the repository root
 */
export function versionedPackageFiles() {
  const config = JSON.parse(readFileSync(join(ROOT, 'release-please-config.json'), 'utf8'));
  return [
    'package.json',
    ...config.packages['.']['extra-files'].map((/** @type {{ path: string }} */ file) => file.path),
  ];
}

function releasedTags() {
  return execFileSync('git', ['tag', '--list', 'v*'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

function setVersion(version) {
  if (!parseVersion(version)) {
    throw new Error(`Not a version: ${version}`);
  }
  for (const path of versionedPackageFiles()) {
    const file = join(ROOT, path);
    const packageJson = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, `${JSON.stringify({ ...packageJson, version }, null, 2)}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, argument] = process.argv.slice(2);
  if (command === 'metadata' && argument) {
    const metadata = releaseMetadata(argument, releasedTags());
    process.stdout.write(
      Object.entries(metadata)
        .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(' ') : value}`)
        .join('\n') + '\n',
    );
  } else if (command === 'candidate' && argument) {
    process.stdout.write(`${nextCandidate(argument, releasedTags())}\n`);
  } else if (command === 'set-version' && argument) {
    setVersion(argument);
  } else if (command === 'supported-series' && argument) {
    const series = supportedSeries(JSON.parse(readFileSync(argument, 'utf8')), new Date());
    process.stdout.write(`current=${series.current}\nprevious=${series.previous}\n`);
  } else {
    process.stderr.write(
      'Usage: node scripts/release.js metadata <tag> | candidate <version> | set-version <version>' +
        ' | supported-series <releases.json>\n',
    );
    process.exit(2);
  }
}
