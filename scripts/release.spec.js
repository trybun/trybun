import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  imageTags,
  isLatestRelease,
  nextCandidate,
  parseVersion,
  releaseMetadata,
  supportedSeries,
  versionedPackageFiles,
} from './release.js';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

describe('parseVersion', () => {
  it('reads a version with or without the v of its tag', () => {
    expect(parseVersion('v1.4.0')).toEqual({ major: 1, minor: 4, patch: 0, prerelease: undefined });
    expect(parseVersion('1.4.0-rc.2')).toEqual({
      major: 1,
      minor: 4,
      patch: 0,
      prerelease: 'rc.2',
    });
  });

  it('rejects other tags', () => {
    expect(parseVersion('v1.4')).toBeUndefined();
    expect(parseVersion('latest')).toBeUndefined();
  });
});

describe('compareVersions', () => {
  const sorted = (versions) =>
    versions
      .map(parseVersion)
      .sort(compareVersions)
      .map(
        (version) =>
          `${version.major}.${version.minor}.${version.patch}${version.prerelease ? `-${version.prerelease}` : ''}`,
      );

  it('orders release candidates before their release and numerically', () => {
    expect(sorted(['1.0.0', '1.0.0-rc.10', '0.9.1', '1.0.0-rc.2', '0.10.0'])).toEqual([
      '0.9.1',
      '0.10.0',
      '1.0.0-rc.2',
      '1.0.0-rc.10',
      '1.0.0',
    ]);
  });
});

describe('imageTags', () => {
  it('tags the first release with X.Y.Z, X.Y and X', () => {
    expect(imageTags('0.1.0', ['v0.1.0'])).toEqual(['0.1.0', '0.1', '0']);
  });

  it('moves X.Y and X to the newest release', () => {
    expect(imageTags('1.4.1', ['v1.3.0', 'v1.4.0', 'v1.4.1'])).toEqual(['1.4.1', '1.4', '1']);
  });

  it('keeps X on the newer MINOR release for a PATCH release of a maintenance branch', () => {
    expect(imageTags('1.4.2', ['v1.4.1', 'v1.5.0', 'v1.4.2'])).toEqual(['1.4.2', '1.4']);
  });

  it('gives a release candidate only its own tag', () => {
    expect(imageTags('1.5.0-rc.1', ['v1.4.0'])).toEqual(['1.5.0-rc.1']);
  });

  it('ignores release candidates and other tags when moving the tags', () => {
    expect(imageTags('1.5.0', ['v1.5.1-rc.1', 'nightly', 'v1.5.0'])).toEqual(['1.5.0', '1.5', '1']);
  });
});

describe('isLatestRelease', () => {
  it('marks the newest release as the latest', () => {
    expect(isLatestRelease('1.5.0', ['v1.4.2', 'v1.5.0'])).toBe(true);
  });

  it('never marks a release candidate or an older series as the latest', () => {
    expect(isLatestRelease('1.6.0-rc.1', ['v1.5.0'])).toBe(false);
    expect(isLatestRelease('1.4.3', ['v1.4.2', 'v1.5.0'])).toBe(false);
  });
});

describe('nextCandidate', () => {
  it('starts with rc.1', () => {
    expect(nextCandidate('1.5.0', ['v1.4.0', 'v1.4.1-rc.3'])).toBe('1.5.0-rc.1');
  });

  it('continues after the highest candidate of the version', () => {
    expect(nextCandidate('1.5.0', ['v1.5.0-rc.1', 'v1.5.0-rc.9', 'v1.5.0-rc.10'])).toBe(
      '1.5.0-rc.11',
    );
  });

  it('refuses a released version and a candidate as the base', () => {
    expect(() => nextCandidate('1.5.0', ['v1.5.0'])).toThrow('already released');
    expect(() => nextCandidate('1.5.0-rc.1', [])).toThrow('Not a release version');
  });
});

describe('releaseMetadata', () => {
  it('describes a release for the release workflow', () => {
    expect(releaseMetadata('v0.2.0', ['v0.1.0', 'v0.2.0'])).toEqual({
      version: '0.2.0',
      prerelease: false,
      latest: true,
      'image-tags': ['0.2.0', '0.2', '0'],
    });
  });

  it('describes a release candidate', () => {
    expect(releaseMetadata('v0.2.0-rc.1', ['v0.1.0', 'v0.2.0-rc.1'])).toEqual({
      version: '0.2.0-rc.1',
      prerelease: true,
      latest: false,
      'image-tags': ['0.2.0-rc.1'],
    });
  });

  it('rejects a tag that is not a version', () => {
    expect(() => releaseMetadata('nightly', [])).toThrow('Not a release tag');
  });
});

describe('supportedSeries', () => {
  const release = (tagName, publishedAt, flags = {}) => ({
    tagName,
    publishedAt: `${publishedAt}T12:00:00Z`,
    isDraft: false,
    isPrerelease: false,
    ...flags,
  });
  const now = new Date('2027-06-15T00:00:00Z');

  it('has nothing to scan before the first release', () => {
    expect(supportedSeries([], now)).toEqual({ current: '', previous: '' });
  });

  it('scans the series of the highest release, also when it is not the newest (§2.11)', () => {
    const releases = [
      release('v1.4.2', '2027-05-01'),
      release('v1.5.0', '2027-04-01'),
      release('v1.3.0', '2027-02-01'),
    ];
    expect(supportedSeries(releases, now)).toEqual({ current: '1.5', previous: '' });
  });

  it('ignores drafts, pre-releases and other tags', () => {
    const releases = [
      release('v0.3.0', '2027-06-01'),
      release('v0.4.0', '2027-06-10', { isDraft: true }),
      release('v0.4.0-rc.1', '2027-06-09', { isPrerelease: true }),
      release('nightly', '2027-06-11'),
    ];
    expect(supportedSeries(releases, now)).toEqual({ current: '0.3', previous: '' });
  });

  it('keeps the last release of the previous series for 6 months after a new MAJOR', () => {
    const releases = [
      release('v1.9.3', '2027-02-01'),
      release('v1.9.4', '2027-03-01'),
      release('v2.0.0', '2027-01-15'),
      release('v2.1.0', '2027-05-01'),
    ];
    expect(supportedSeries(releases, new Date('2027-07-15T11:59:59Z'))).toEqual({
      current: '2.1',
      previous: '1.9',
    });
    expect(supportedSeries(releases, new Date('2027-07-15T12:00:00Z'))).toEqual({
      current: '2.1',
      previous: '',
    });
  });
});

describe('release-please configuration', () => {
  const config = readJson('release-please-config.json');
  const maintenance = readJson('release-please-config.maintenance.json');

  it('follows the pre-1.0.0 rule: feat and breaking changes increase MINOR (§2.11)', () => {
    expect(config['bump-minor-pre-major']).toBe(true);
    expect(config['bump-patch-for-minor-pre-major']).toBeUndefined();
    expect(config['initial-version']).toBe('0.1.0');
  });

  it('prepares only PATCH releases on maintenance branches and is otherwise the same', () => {
    const { versioning, ...rest } = maintenance;
    expect(versioning).toBe('always-bump-patch');
    expect(rest).toEqual(config);
  });

  it('versions every package of the monorepo with the product (§2.11)', () => {
    const packageFiles = versionedPackageFiles();
    const workspacePackages = globSync('{apps,packages}/*/package.json').sort();
    expect([...packageFiles].sort()).toEqual(['package.json', ...workspacePackages].sort());
    for (const path of workspacePackages) {
      expect(readJson(path).version).toBe(readJson('.release-please-manifest.json')['.']);
    }
  });
});

describe('accepted risks of the image scan (.trivyignore.yaml)', () => {
  const entries = readFileSync('.trivyignore.yaml', 'utf8')
    .split(/^\s*- id: /m)
    .slice(1);

  it('give every accepted vulnerability a reason and an expiry date (§2.10)', () => {
    for (const entry of entries) {
      expect(entry).toMatch(/^\s*statement: \S/m);
      const expiry = /^\s*expired_at: (\d{4}-\d{2}-\d{2})$/m.exec(entry)?.[1];
      expect(expiry, entry).toBeDefined();
    }
  });
});

describe('daily image scan (.github/workflows/image-scan.yml)', () => {
  const workflow = readFileSync('.github/workflows/image-scan.yml', 'utf8');

  it('has no access to secrets and only reads, apart from uploading its results (§2.10)', () => {
    expect(workflow).not.toMatch(/\bsecrets\./);
    expect(workflow).not.toMatch(/^\s*environment:/m);
    expect(workflow).toMatch(/^permissions: \{\}$/m);
    const permissions = [...workflow.matchAll(/^\s+([a-z-]+): (read|write)$/gm)].map(
      ([, scope, access]) => `${scope}: ${access}`,
    );
    expect(new Set(permissions)).toEqual(
      new Set(['contents: read', 'packages: read', 'security-events: write']),
    );
  });

  it('applies the accepted risks of the release scan', () => {
    expect(workflow).toMatch(/^\s+trivyignores: \.trivyignore\.yaml$/m);
  });
});
