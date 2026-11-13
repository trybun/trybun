// Daily advisory audit of the default branch (§2.10, §15.4), used by
// `.github/workflows/advisory-audit.yml`: turns the output of `pnpm audit --audit-level low --json`
// into a report and keeps one tracking issue current – opened or reopened while advisories remain
// that are not accepted in `auditConfig.ignoreGhsas`, or exceptions of `pnpm-workspace.yaml` are
// stale (`minimumReleaseAgeExclude` older than `minimumReleaseAge` or not in the lockfile, an
// accepted advisory with a fix or withdrawn, an `overrides` key no dependency asks for), closed when
// both are gone.
// Usage:
//   node scripts/advisory-audit.js sync <audit.json> <config.json> <lockfile.json>
//     <config.json> is `pnpm config list --json`, <lockfile.json> is
//     `pnpm list -r --depth Infinity --lockfile-only --json`; job summary, and the tracking issue on
//     a run of the default branch (GITHUB_*, GH_TOKEN)
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ISSUE_TITLE = 'Vulnerability advisories on main';
export const ISSUE_LABELS = ['security', 'dependencies'];
/** GitHub's limit is 65,536 characters; the margin keeps multi-byte counting differences safe. */
export const BODY_LIMIT = 60_000;
const MAX_PATHS = 5;
const INVALID = '(invalid)';

const SEVERITIES = ['critical', 'high', 'moderate', 'low', 'info'];
// Allowlists, not escaping (spec): a field that fails its pattern is never rendered, so advisory
// data cannot add Markdown, HTML, links, mentions or cross-references to the issue.
const GHSA = /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/;
// Lowercase, except for legacy npm names with capitals (e.g. `JSONStream`).
const PACKAGE = /^(@[a-z0-9~-][a-z0-9._~-]*\/)?[A-Za-z0-9~-][A-Za-z0-9._~-]{0,213}$/;
const RANGE = /^[0-9A-Za-z.*+<>=~^| -]{1,256}$/;
// A dependency path, e.g. `.>@nestjs/core>multer`: the root `.`, workspace folders and packages.
const PATH_SEGMENT =
  /^([0-9A-Za-z._-]{1,214}|(@[a-z0-9~-][a-z0-9._~-]*\/)[a-z0-9~-][a-z0-9._~-]{0,213})$/;
const MAX_PATH = 1000;
const MARKER = /<!-- advisory-audit: ([^>]*) -->/;
const STALE_MARKER = /<!-- stale-exceptions: ([^>]*) -->/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
/** An exact semver version, as an exclusion pins it and the advisory API reports a fix. */
const VERSION = /^\d{1,9}\.\d{1,9}\.\d{1,9}(-[0-9A-Za-z.-]{1,64})?(\+[0-9A-Za-z.-]{1,64})?$/;
const SCOPE = /^@[a-z0-9~-][a-z0-9._~-]*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/;
const MINUTES_PER_DAY = 1440;

/**
 * @typedef {object} Advisory an advisory of the audit, as reported by pnpm (not yet validated)
 * @property {unknown} ghsa
 * @property {unknown} severity
 * @property {unknown} package
 * @property {unknown} vulnerable vulnerable versions
 * @property {unknown} patched patched versions, `null` when there is no fix
 * @property {unknown[]} paths dependency paths, e.g. `.>glob>minimatch`
 */

/**
 * The advisories of `pnpm audit --json`. pnpm leaves the accepted `ignoreGhsas` out of
 * `advisories` but still counts them in `metadata.vulnerabilities`, so the list comes from
 * `advisories` only. A failed audit prints nothing to standard output (pnpm 12.13), so anything
 * that is not the audit object throws and fails the run.
 * @param {string} text
 * @returns {Advisory[]}
 */
export function parseAudit(text) {
  if (text.trim() === '') {
    throw new Error('pnpm audit printed no result; its error is in the log above');
  }
  let audit;
  try {
    audit = JSON.parse(text);
  } catch {
    throw new Error('pnpm audit printed no valid JSON');
  }
  if (!isObject(audit) || !isObject(audit.advisories) || !isObject(audit.metadata)) {
    throw new Error('pnpm audit printed JSON without `advisories` and `metadata`');
  }
  return Object.values(audit.advisories).map((advisory) => {
    if (!isObject(advisory)) {
      throw new Error('pnpm audit printed an advisory that is not an object');
    }
    const findings = Array.isArray(advisory.findings) ? advisory.findings : [];
    return {
      ghsa: advisory.github_advisory_id,
      severity: advisory.severity,
      package: advisory.module_name,
      vulnerable: advisory.vulnerable_versions,
      patched: advisory.patched_versions ?? null,
      paths: [
        ...new Set(findings.flatMap((finding) => (isObject(finding) ? finding.paths : []) ?? [])),
      ],
    };
  });
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const valid = (pattern, value) => typeof value === 'string' && pattern.test(value);
const validGhsa = (value) => valid(GHSA, value);
const validPath = (value) =>
  typeof value === 'string' &&
  value.length <= MAX_PATH &&
  value.split('>').every((segment) => PATH_SEGMENT.test(segment));
const validSeverity = (value) => typeof value === 'string' && SEVERITIES.includes(value);

/** A field in a code span of a table cell; `|` written as `\|`, which a GFM cell needs even there. */
const code = (pattern, value) =>
  valid(pattern, value) ? `\`${value.replaceAll('|', '\\|')}\`` : INVALID;
/** A field in a code span outside a table, where a backslash would be shown. */
const span = (pattern, value) => (valid(pattern, value) ? `\`${value}\`` : INVALID);
/** Comment lines beyond this are cut, so a comment stays far below GitHub's body limit. */
const MAX_COMMENT_LINES = 200;
const capped = (lines) =>
  lines.length <= MAX_COMMENT_LINES
    ? lines
    : [
        ...lines.slice(0, MAX_COMMENT_LINES),
        `- and ${lines.length - MAX_COMMENT_LINES} more; the issue body lists the current set.`,
      ];
const advisoryLink = (ghsa) => `[${ghsa}](https://github.com/advisories/${ghsa})`;
const ghsaCell = (ghsa) => (validGhsa(ghsa) ? advisoryLink(ghsa) : INVALID);
const hasPatch = (advisory) => advisory.patched !== null && advisory.patched !== '';

/** Advisories by severity, most severe first, then by GHSA. */
function sorted(advisories) {
  const rank = (severity) => {
    const index = SEVERITIES.indexOf(String(severity));
    return index === -1 ? SEVERITIES.length : index;
  };
  return [...advisories].sort(
    (a, b) =>
      rank(a.severity) - rank(b.severity) || String(a.ghsa).localeCompare(String(b.ghsa), 'en'),
  );
}

/**
 * The fields of the advisories that fail their allowlist, for the log – never the values.
 * @param {Advisory[]} advisories
 * @returns {string[]}
 */
export function invalidFields(advisories) {
  return advisories.flatMap((advisory, index) => {
    const name = validGhsa(advisory.ghsa) ? advisory.ghsa : `advisory ${index + 1}`;
    const fields = [
      ['GHSA id', validGhsa(advisory.ghsa)],
      ['severity', validSeverity(advisory.severity)],
      ['package', valid(PACKAGE, advisory.package)],
      ['vulnerable versions', valid(RANGE, advisory.vulnerable)],
      ['patched versions', !hasPatch(advisory) || valid(RANGE, advisory.patched)],
      ...advisory.paths.map((path, number) => [`path ${number + 1}`, validPath(path)]),
    ];
    return fields.filter(([, ok]) => !ok).map(([field]) => `${name}: ${field} fails its allowlist`);
  });
}

/**
 * The hidden marker of the issue body: the sorted set of validated GHSA ids, each with whether a
 * patched version exists – how the next run detects a change of the set.
 * @param {Advisory[]} advisories
 */
export function marker(advisories) {
  // A GHSA of several packages counts as patched only when every one of them has a fix.
  const patched = new Map();
  for (const advisory of advisories.filter((entry) => validGhsa(entry.ghsa))) {
    patched.set(advisory.ghsa, (patched.get(advisory.ghsa) ?? true) && hasPatch(advisory));
  }
  const entries = [...patched]
    .map(([ghsa, fixed]) => `${ghsa}:${fixed ? 'patched' : 'none'}`)
    .sort();
  return `<!-- advisory-audit: ${entries.join(',')} -->`;
}

/**
 * The advisory set recorded in an issue body, GHSA id → whether a patched version exists.
 * @param {string} body
 * @returns {Map<string, boolean>}
 */
export function readMarker(body) {
  const set = new Map();
  for (const entry of MARKER.exec(body)?.[1].split(',') ?? []) {
    const [ghsa, patched] = entry.split(':');
    if (validGhsa(ghsa) && (patched === 'patched' || patched === 'none')) {
      set.set(ghsa, patched === 'patched');
    }
  }
  return set;
}

/**
 * @typedef {object} Config the settings of `pnpm-workspace.yaml` the audit checks
 * @property {number} minimumReleaseAge minutes
 * @property {string[]} minimumReleaseAgeExclude
 * @property {string[]} ignoreGhsas `auditConfig.ignoreGhsas`, reported by pnpm as `audit.ignore`
 * @property {string[]} overrides the keys of `overrides`, e.g. `multer@2.4.0`
 * @property {string} registry
 * @property {Map<string, string>} scopes npm scope → its registry
 */

const httpsUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};
const stringList = (value, name) => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(`pnpm config list printed \`${name}\` that is not a list of strings`);
  }
  return value;
};

/**
 * The settings of `pnpm config list --json` (pnpm 12.13): `minimumReleaseAge`,
 * `minimumReleaseAgeExclude`, `audit.ignore` (`auditConfig.ignoreGhsas`), `overrides`, `registry`
 * and the per-scope `registries`. Anything unexpected throws and fails the run.
 * @param {string} text
 * @returns {Config}
 */
export function parseConfig(text) {
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    throw new Error('pnpm config list printed no valid JSON');
  }
  if (!isObject(config)) {
    throw new Error('pnpm config list printed JSON that is not an object');
  }
  const age = config.minimumReleaseAge ?? 0;
  if (!Number.isInteger(age) || age < 0) {
    throw new Error('pnpm config list printed `minimumReleaseAge` that is not a whole number');
  }
  if (config.audit !== undefined && !isObject(config.audit)) {
    throw new Error('pnpm config list printed `audit` that is not an object');
  }
  if (typeof config.registry !== 'string' || !httpsUrl(config.registry)) {
    throw new Error('pnpm config list printed `registry` that is not an https URL');
  }
  const overrides = config.overrides ?? {};
  if (
    !isObject(overrides) ||
    !Object.values(overrides).every((replacement) => typeof replacement === 'string')
  ) {
    throw new Error('pnpm config list printed `overrides` that is not an object of strings');
  }
  const scopes = new Map();
  const registries = config.registries ?? {};
  if (!isObject(registries)) {
    throw new Error('pnpm config list printed `registries` that is not an object');
  }
  for (const [url, settings] of Object.entries(registries)) {
    if (!httpsUrl(url) || !isObject(settings)) {
      throw new Error('pnpm config list printed a registry that is not an https URL');
    }
    for (const scope of stringList(settings.scopes, 'registries.scopes')) {
      if (scope === '@') {
        continue; // the registry of unscoped packages, `registry`
      }
      if (!SCOPE.test(scope)) {
        throw new Error('pnpm config list printed a registry scope that is not an npm scope');
      }
      scopes.set(scope, url);
    }
  }
  return {
    minimumReleaseAge: age,
    minimumReleaseAgeExclude: stringList(
      config.minimumReleaseAgeExclude,
      'minimumReleaseAgeExclude',
    ),
    ignoreGhsas: stringList(config.audit?.ignore, 'audit.ignore'),
    overrides: Object.keys(overrides),
    registry: config.registry,
    scopes,
  };
}

/**
 * @typedef {{ kind: 'package', name: string, version: string } | { kind: 'project', path: string }} Dependent
 *   a package of the registry, or a workspace project by the folder of its `package.json`
 */

/**
 * @typedef {object} Lockfile the dependency tree of the committed lockfile
 * @property {{ has: (entry: string) => boolean }} present every `name@version` it resolves
 * @property {Map<string, Dependent[]>} dependents package name → the packages and projects that
 *   depend on it
 */

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'];

/**
 * The output of `pnpm list -r --depth Infinity --lockfile-only --json` (pnpm 12.13): one entry per
 * workspace project with its dependency tree. Only `name`, `version` and `path` of a project and the
 * keys and `version` of the nested dependencies are read; the nested `path` and `resolved` fields
 * (under `node_modules/.pnpm`, which the job never installs) are ignored. A `link:` dependency is a
 * workspace project, nested with its own tree, whose ranges come from its `package.json`. A project
 * outside `root` or anything unexpected throws and fails the run.
 * @param {string} text
 * @param {string} root the checkout
 * @returns {Lockfile}
 */
export function parseLockfile(text, root) {
  let projects;
  try {
    projects = JSON.parse(text);
  } catch {
    throw new Error('pnpm list printed no valid JSON');
  }
  if (!Array.isArray(projects)) {
    throw new Error('pnpm list printed JSON that is not a list of projects');
  }
  const present = new Set();
  const dependents = new Map();
  const add = (name, key, dependent) => {
    if (!dependents.has(name)) {
      dependents.set(name, new Map());
    }
    dependents.get(name).set(key, dependent);
  };
  const base = resolve(root);
  const inside = (folder) => {
    if (folder !== base && !folder.startsWith(`${base}${sep}`)) {
      throw new Error('pnpm list printed a project outside the checkout');
    }
    return folder;
  };
  const walk = (node, key, dependent, folder) => {
    for (const field of DEPENDENCY_FIELDS) {
      const children = node[field] ?? {};
      if (!isObject(children)) {
        throw new Error(`pnpm list printed \`${field}\` that is not an object`);
      }
      for (const [name, child] of Object.entries(children)) {
        if (!PACKAGE.test(name) || !isObject(child) || typeof child.version !== 'string') {
          throw new Error('pnpm list printed a dependency that fails its allowlist');
        }
        add(name, key, dependent);
        if (child.version.startsWith('link:')) {
          // A workspace project, nested with its own tree: its ranges are in its package.json.
          const linked = inside(resolve(folder, child.version.slice('link:'.length)));
          walk(child, `project:${linked}`, { kind: 'project', path: linked }, linked);
          continue;
        }
        if (!VERSION.test(child.version)) {
          continue; // no registry version (e.g. `file:`), so no registry range to read
        }
        const entry = `${name}@${child.version}`;
        present.add(entry);
        // Every occurrence is walked: the children of one version can differ between places (its
        // peers), and the walk is linear in the size of the printed tree.
        walk(child, `package:${entry}`, { kind: 'package', name, version: child.version }, folder);
      }
    }
  };
  for (const project of projects) {
    if (!isObject(project) || typeof project.path !== 'string') {
      throw new Error('pnpm list printed a project without a path');
    }
    const folder = inside(resolve(project.path));
    walk(project, `project:${folder}`, { kind: 'project', path: folder }, folder);
  }
  return {
    present,
    dependents: new Map([...dependents].map(([name, parents]) => [name, [...parents.values()]])),
  };
}

/**
 * @typedef {object} StaleException an exception of `pnpm-workspace.yaml` that is no longer needed;
 *   every field but `reason` holds only validated values
 * @property {'release-age' | 'ignore-ghsa' | 'override'} setting
 * @property {string | null} entry `name[@version]` or a GHSA id; `null` when it fails its allowlist
 * @property {'aged' | 'not-pinned' | 'not-on-registry' | 'not-in-lockfile' | 'unused' | 'patched' | 'withdrawn' | 'unknown' | 'invalid'} reason
 * @property {string} [date] `YYYY-MM-DD` of the publication or the withdrawal
 * @property {string} [cooldown] `minimumReleaseAge` in words, e.g. `7 days`
 * @property {{ package: string, version: string }[]} [fixes] the fixed version of each npm package
 */

/** `name@version`, a bare name, or `null` for anything that fails the allowlists. */
function parseExclusion(entry) {
  const at = entry.lastIndexOf('@');
  const [name, version] = at > 0 ? [entry.slice(0, at), entry.slice(at + 1)] : [entry, undefined];
  if (!PACKAGE.test(name) || (version !== undefined && !VERSION.test(version))) {
    return null;
  }
  return { name, version };
}

/** `major.minor.patch-prerelease` of an exact version; build metadata is ignored, as semver does. */
function parseSemver(text) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(text);
  if (!match) {
    return null;
  }
  return {
    tuple: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] === undefined ? [] : match[4].split('.'),
  };
}

function compareIdentifiers(a, b) {
  const numeric = /^\d+$/;
  if (numeric.test(a) && numeric.test(b)) {
    return Number(a) - Number(b);
  }
  if (numeric.test(a) !== numeric.test(b)) {
    return numeric.test(a) ? -1 : 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareSemver(a, b) {
  for (let index = 0; index < 3; index += 1) {
    if (a.tuple[index] !== b.tuple[index]) {
      return a.tuple[index] - b.tuple[index];
    }
  }
  // A version without a prerelease is higher than the same version with one.
  if (a.pre.length === 0 || b.pre.length === 0) {
    return b.pre.length - a.pre.length;
  }
  for (let index = 0; index < Math.max(a.pre.length, b.pre.length); index += 1) {
    if (a.pre[index] === undefined || b.pre[index] === undefined) {
      return a.pre[index] === undefined ? -1 : 1;
    }
    const order = compareIdentifiers(a.pre[index], b.pre[index]);
    if (order !== 0) {
      return order;
    }
  }
  return 0;
}

const semver = (major, minor, patch, pre = []) => ({ tuple: [major, minor, patch], pre });
/** The lowest version of a release, used for exclusive upper bounds (`<2.0.0-0`), as semver does. */
const floor = (major, minor, patch) => semver(major, minor, patch, ['0']);
const PARTIAL =
  /^(<=|>=|<|>|=|~>|~|\^)?v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const isWild = (part) => part === undefined || /^[xX*]$/.test(part);

/** One comparator of a range as primitive comparators `[operator, version]`; `[]` matches any. */
function expandComparator(text) {
  const match = PARTIAL.exec(text);
  if (!match) {
    return null;
  }
  const [, op = '', ...rest] = match;
  const [majorText, minorText, patchText, preText] = rest;
  const pre = preText === undefined ? [] : preText.split('.');
  if (isWild(majorText)) {
    // `*`, `x`, `>=*`: any version; `<*` and `>*` match nothing.
    return op === '<' || op === '>' ? [['<', semver(0, 0, 0, ['0'])]] : [];
  }
  const major = Number(majorText);
  const minor = isWild(minorText) ? null : Number(minorText);
  const patch = minor === null || isWild(patchText) ? null : Number(patchText);
  const low = semver(major, minor ?? 0, patch ?? 0, patch === null ? [] : pre);
  // The first version above the partial version: 1 → 2.0.0, 1.2 → 1.3.0, 1.2.3 → none.
  const next = () => (minor === null ? floor(major + 1, 0, 0) : floor(major, minor + 1, 0));
  switch (op) {
    case '^': {
      let high;
      if (major > 0 || minor === null) {
        high = floor(major + 1, 0, 0);
      } else if (minor > 0 || patch === null) {
        high = floor(0, minor + 1, 0);
      } else {
        high = floor(0, 0, patch + 1);
      }
      return [
        ['>=', low],
        ['<', high],
      ];
    }
    case '~':
    case '~>':
      return [
        ['>=', low],
        ['<', next()],
      ];
    case '>':
      // `>1` is `>=2.0.0`: no `-0` here, so a prerelease of 2.0.0 stays outside, as in semver.
      return patch === null ? [['>=', { ...next(), pre: [] }]] : [['>', low]];
    case '>=':
      return [['>=', low]];
    case '<':
      return [['<', patch === null ? floor(...low.tuple) : low]];
    case '<=':
      return patch === null ? [['<', next()]] : [['<=', low]];
    default:
      return patch === null
        ? [
            ['>=', low],
            ['<', next()],
          ]
        : [['=', low]];
  }
}

const OPERATORS = {
  '<': (order) => order < 0,
  '<=': (order) => order <= 0,
  '>': (order) => order > 0,
  '>=': (order) => order >= 0,
  '=': (order) => order === 0,
};
/** A declared spec with a protocol, an alias, a URL or a path: no semver range. */
const NOT_A_RANGE = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\.{0,2}\/|~\/)/;
/** A dist-tag, e.g. `latest`; tried only after the spec failed to read as a range (`x.x` is one). */
const DIST_TAG = /^[A-Za-z][A-Za-z0-9._-]*$/;

/**
 * Whether an exact version satisfies a declared npm range, as node-semver does without options:
 * `||`, hyphen ranges, x-ranges, `~`, `^`, the comparators, and the prerelease rule (a prerelease
 * version only satisfies a range with a prerelease on the same `major.minor.patch`). A spec that is
 * no range (`npm:` alias, `workspace:`, a URL, a git or file spec, a dist-tag) never matches, as in
 * pnpm; a spec of range characters it cannot read throws, so a gap never flags an entry by mistake.
 * @param {string} version
 * @param {string} range
 * @returns {boolean}
 */
export function satisfies(version, range) {
  const target = parseSemver(version);
  if (!target) {
    throw new Error('Not an exact version');
  }
  const spec = range.trim();
  if (NOT_A_RANGE.test(spec)) {
    return false;
  }
  try {
    if (!RANGE.test(spec) && spec !== '') {
      throw new Error('A declared range that cannot be read');
    }
    return matchesRange(target, spec);
  } catch (error) {
    if (DIST_TAG.test(spec)) {
      return false;
    }
    throw error;
  }
}

function matchesRange(target, spec) {
  return spec.split('||').some((part) => {
    const set = part.trim();
    let comparators;
    const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(set);
    if (hyphen) {
      const [low, high] = [expandComparator(`>=${hyphen[1]}`), expandComparator(`<=${hyphen[2]}`)];
      if (!low || !high) {
        throw new Error('A declared range that cannot be read');
      }
      comparators = [...low, ...high];
    } else {
      comparators = set
        .replace(/(<=|>=|<|>|=|~>|~|\^)\s+/g, '$1')
        .split(/\s+/)
        .filter(Boolean)
        .flatMap((text) => {
          const expanded = expandComparator(text);
          if (!expanded) {
            throw new Error('A declared range that cannot be read');
          }
          return expanded;
        });
    }
    if (!comparators.every(([op, bound]) => OPERATORS[op](compareSemver(target, bound)))) {
      return false;
    }
    if (target.pre.length === 0) {
      return true;
    }
    // A prerelease version only satisfies a set with a prerelease on the same release.
    return comparators.some(
      ([, bound]) =>
        bound.pre.length > 0 && bound.tuple.every((part, index) => part === target.tuple[index]),
    );
  });
}

const isoDay = (value) =>
  typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))
    ? value.slice(0, 10)
    : null;

/** The registry document URL of a validated package name. */
function packageUrl(config, name) {
  const scope = name.startsWith('@') ? name.split('/')[0] : '';
  const base = config.scopes.get(scope) ?? config.registry;
  // The npm convention (npm-registry-fetch): only the `/` of a scoped name is escaped; the name
  // passed its allowlist, so it holds no other character a URL path would change.
  return new URL(name.replaceAll('/', '%2F'), base.endsWith('/') ? base : `${base}/`).href;
}

/** The abbreviated package document: `dependencies` and the like of each version, no `time`. */
export const ABBREVIATED = 'application/vnd.npm.install-v1+json';
const RANGE_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies'];

/**
 * Whether any dependent declares a range for `name` that `version` satisfies – then pnpm applies
 * an `overrides` key `name@version` to it (pnpm 12.13 matches intersecting ranges). A dependent
 * whose range cannot be read from the registry counts as asking for it, with a line in the log, so
 * an entry is reported as needed rather than guessed unneeded.
 */
async function isRequested(config, name, version, io, documents) {
  for (const dependent of io.lockfile.dependents.get(name) ?? []) {
    let declared;
    if (dependent.kind === 'project') {
      const manifest = io.manifest(dependent.path);
      if (!isObject(manifest)) {
        throw new Error('A package.json of the workspace is not an object');
      }
      declared = ['dependencies', 'devDependencies', 'optionalDependencies'].map(
        (field) => manifest[field],
      );
    } else {
      if (!documents.has(dependent.name)) {
        documents.set(
          dependent.name,
          await io.registryJson(packageUrl(config, dependent.name), ABBREVIATED),
        );
      }
      const document = documents.get(dependent.name);
      if (document !== null && (!isObject(document) || !isObject(document.versions))) {
        throw new Error(`The registry answered an unexpected document for ${dependent.name}`);
      }
      const release = document?.versions[dependent.version];
      if (!isObject(release)) {
        io.log(
          `${dependent.name}@${dependent.version} is not on the registry; it counts as asking for ${name}@${version}`,
        );
        return true;
      }
      declared = RANGE_FIELDS.map((field) => release[field]);
    }
    for (const ranges of declared) {
      const range = isObject(ranges) ? ranges[name] : undefined;
      if (typeof range === 'string' && satisfies(version, range)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * The stale exceptions of the settings. Entries are validated before they are used in a URL or an
 * argument; one that fails is listed as `invalid` and never sent anywhere. A lookup that fails
 * (after its retries) throws, so the run fails and the issue is left untouched.
 * @param {Config} config
 * @param {{
 *   now: number,
 *   registryJson: (url: string, accept?: string) => Promise<unknown>,
 *   advisory: (ghsa: string) => Promise<unknown>,
 *   lockfile: Lockfile,
 *   manifest: (folder: string) => unknown,
 *   log?: (text: string) => void,
 * }} io `registryJson` and `advisory` answer `null` for a 404; `manifest` reads the `package.json`
 *   of a workspace project
 * @returns {Promise<StaleException[]>}
 */
export async function checkExceptions(config, io) {
  const { now, registryJson, advisory, lockfile } = io;
  const stale = [];
  for (const entry of config.minimumReleaseAgeExclude) {
    const exclusion = parseExclusion(entry);
    if (!exclusion) {
      stale.push({ setting: 'release-age', entry: null, reason: 'invalid' });
      continue;
    }
    if (exclusion.version === undefined) {
      stale.push({ setting: 'release-age', entry, reason: 'not-pinned' });
      continue;
    }
    if (!lockfile.present.has(entry)) {
      stale.push({ setting: 'release-age', entry, reason: 'not-in-lockfile' });
      continue;
    }
    const document = await registryJson(packageUrl(config, exclusion.name));
    const published =
      isObject(document) && isObject(document.time) ? document.time[exclusion.version] : undefined;
    if (document === null || published === undefined) {
      stale.push({ setting: 'release-age', entry, reason: 'not-on-registry' });
      continue;
    }
    const day = isoDay(published);
    if (day === null) {
      throw new Error(`The registry answered an invalid publish time for ${entry}`);
    }
    const age = now - Date.parse(published);
    if (config.minimumReleaseAge > 0 && age >= config.minimumReleaseAge * 60_000) {
      const cooldown =
        config.minimumReleaseAge % MINUTES_PER_DAY === 0
          ? `${config.minimumReleaseAge / MINUTES_PER_DAY} days`
          : `${config.minimumReleaseAge} minutes`;
      stale.push({ setting: 'release-age', entry, reason: 'aged', date: day, cooldown });
    }
  }
  for (const ghsa of config.ignoreGhsas) {
    if (!validGhsa(ghsa)) {
      stale.push({ setting: 'ignore-ghsa', entry: null, reason: 'invalid' });
      continue;
    }
    const data = await advisory(ghsa);
    if (data === null) {
      stale.push({ setting: 'ignore-ghsa', entry: ghsa, reason: 'unknown' });
      continue;
    }
    if (!isObject(data) || !Array.isArray(data.vulnerabilities)) {
      throw new Error(`The advisory API answered an unexpected shape for ${ghsa}`);
    }
    if (data.withdrawn_at !== null && data.withdrawn_at !== undefined) {
      const day = isoDay(data.withdrawn_at);
      if (day === null) {
        throw new Error(`The advisory API answered an invalid withdrawal date for ${ghsa}`);
      }
      stale.push({ setting: 'ignore-ghsa', entry: ghsa, reason: 'withdrawn', date: day });
      continue;
    }
    const npm = data.vulnerabilities.filter(
      (vulnerability) => isObject(vulnerability) && vulnerability.package?.ecosystem === 'npm',
    );
    if (npm.length === 0) {
      stale.push({ setting: 'ignore-ghsa', entry: ghsa, reason: 'unknown' });
      continue;
    }
    // A GHSA of several packages is stale only when every one of them has a fix.
    if (npm.every((vulnerability) => typeof vulnerability.first_patched_version === 'string')) {
      stale.push({
        setting: 'ignore-ghsa',
        entry: ghsa,
        reason: 'patched',
        fixes: npm.map((vulnerability) => ({
          package: valid(PACKAGE, vulnerability.package.name)
            ? vulnerability.package.name
            : INVALID,
          version: valid(VERSION, vulnerability.first_patched_version)
            ? vulnerability.first_patched_version
            : INVALID,
        })),
      });
    }
  }
  const documents = new Map();
  const lookups = { ...io, log: io.log ?? (() => {}) };
  for (const key of config.overrides) {
    const override = parseExclusion(key);
    if (!override || override.version === undefined) {
      // Only a key pinned to the exact vulnerable version can be checked; a range or a parent
      // selector (`a>b`) fails the allowlist and is shown as `(invalid)`.
      stale.push({ setting: 'override', entry: override ? key : null, reason: 'not-pinned' });
      continue;
    }
    if (!(await isRequested(config, override.name, override.version, lookups, documents))) {
      stale.push({ setting: 'override', entry: key, reason: 'unused' });
    }
  }
  return stale;
}

const SETTING_NAMES = {
  'release-age': 'minimumReleaseAgeExclude',
  'ignore-ghsa': 'auditConfig.ignoreGhsas',
  override: 'overrides',
};
const REASONS = {
  'release-age': ['aged', 'not-pinned', 'not-on-registry', 'not-in-lockfile'],
  'ignore-ghsa': ['patched', 'withdrawn', 'unknown'],
  override: ['unused', 'not-pinned'],
};

/**
 * A token of the stale marker, `<setting>:<entry>:<reason>`, validated as strictly as the entries
 * it is built from – the issue body can be edited by hand, and a gone token is rendered into a
 * comment – or `null`. Validated entries hold no `,`, `:` or `>`, so the first and last `:` split it.
 * @param {string} token
 * @returns {{ setting: 'release-age' | 'ignore-ghsa', entry: string, reason: string } | null}
 */
function parseToken(token) {
  const first = token.indexOf(':');
  const last = token.lastIndexOf(':');
  if (first <= 0 || last <= first) {
    return null;
  }
  const setting = token.slice(0, first);
  const entry = token.slice(first + 1, last);
  const reason = token.slice(last + 1);
  if (!Object.hasOwn(REASONS, setting) || !REASONS[setting].includes(reason)) {
    return null;
  }
  if (setting === 'ignore-ghsa') {
    return validGhsa(entry) ? { setting, entry, reason } : null;
  }
  const exclusion = parseExclusion(entry);
  // `not-pinned` exactly when the entry has no version.
  if (!exclusion || (reason === 'not-pinned') !== (exclusion.version === undefined)) {
    return null;
  }
  return { setting, entry, reason };
}
const staleToken = (exception) =>
  exception.entry === null ? null : `${exception.setting}:${exception.entry}:${exception.reason}`;

/**
 * The hidden marker of the stale exceptions: the sorted tokens of the validated entries.
 * @param {StaleException[]} stale
 */
export function staleMarker(stale) {
  const tokens = [...new Set(stale.map(staleToken).filter((token) => token !== null))].sort();
  return `<!-- stale-exceptions: ${tokens.join(',')} -->`;
}

/**
 * The stale set recorded in an issue body; a body without the marker reads as an empty set.
 * @param {string} body
 * @returns {Set<string>}
 */
export function readStaleMarker(body) {
  const tokens = STALE_MARKER.exec(body)?.[1].split(',') ?? [];
  return new Set(tokens.filter((token) => parseToken(token) !== null));
}

function entryCell(exception) {
  if (exception.entry === null) {
    return INVALID;
  }
  return exception.setting === 'ignore-ghsa'
    ? advisoryLink(exception.entry)
    : `\`${exception.entry}\``;
}

function staleReason(exception) {
  switch (exception.reason) {
    case 'aged':
      return `published ${exception.date}, older than ${exception.cooldown}`;
    case 'not-pinned':
      return 'not pinned to an exact version';
    case 'not-on-registry':
      return 'version not on the registry';
    case 'not-in-lockfile':
      return 'version not in the lockfile';
    case 'unused':
      return 'no dependency asks for this version';
    case 'patched':
      return `patched: ${exception.fixes
        .map(
          (fix) =>
            `${fix.version === INVALID ? INVALID : `\`${fix.version}\``} (${fix.package === INVALID ? INVALID : `\`${fix.package}\``})`,
        )
        .join(', ')}`;
    case 'withdrawn':
      return `withdrawn ${exception.date}`;
    case 'unknown':
      return 'unknown advisory';
    default:
      return 'fails its allowlist';
  }
}

/** One line of a comment, e.g. `minimumReleaseAgeExclude`: `x@1.0.0` – published …. */
const summarizeStale = (exception) =>
  `\`${SETTING_NAMES[exception.setting]}\`: ${entryCell(exception)} – ${staleReason(exception)}`;

/** A gone token, rendered from the token alone; only tokens `parseToken` accepts reach it. */
function summarizeToken(token) {
  const { setting, entry } = parseToken(token);
  return `\`${SETTING_NAMES[setting]}\`: ${setting === 'ignore-ghsa' ? advisoryLink(entry) : `\`${entry}\``}`;
}

const STALE_FOOTER = [
  'Remove each entry from `pnpm-workspace.yaml`. For a patched GHSA, first update the dependency or force the fixed version with an `overrides` entry, so the vulnerability audit of pull requests stays green. For an `overrides` entry, check that `pnpm install` and `pnpm audit --audit-level high` stay clean after removing it.',
].join('\n');

function staleSection(stale) {
  if (stale.length === 0) {
    return [];
  }
  // By setting, then by entry, invalid entries last.
  const rank = { 'ignore-ghsa': 0, 'release-age': 1, override: 2 };
  const rows = [...stale]
    .sort(
      (a, b) =>
        rank[a.setting] - rank[b.setting] ||
        (a.entry === null) - (b.entry === null) ||
        (a.entry ?? '').localeCompare(b.entry ?? '', 'en'),
    )
    .map(
      (exception) =>
        `| \`${SETTING_NAMES[exception.setting]}\` | ${entryCell(exception)} | ${staleReason(exception)} |`,
    );
  return [
    '### Stale exceptions',
    '',
    `${stale.length === 1 ? '1 exception' : `${stale.length} exceptions`} of \`pnpm-workspace.yaml\` ${stale.length === 1 ? 'is' : 'are'} no longer needed.`,
    '',
    '| Setting | Entry | Why it is stale |',
    '|---|---|---|',
    ...rows,
    '',
    STALE_FOOTER,
    '',
  ];
}

function row(advisory, maxPaths) {
  const paths = advisory.paths
    .slice(0, maxPaths)
    .map((path) => (validPath(path) ? `\`${path}\`` : INVALID));
  const more = advisory.paths.length - paths.length;
  if (more > 0) {
    paths.push(`and ${more} more`);
  }
  const severity = validSeverity(advisory.severity) ? advisory.severity : INVALID;
  const patched = hasPatch(advisory) ? code(RANGE, advisory.patched) : 'none';
  return `| ${ghsaCell(advisory.ghsa)} | ${severity} | ${code(PACKAGE, advisory.package)} | ${code(RANGE, advisory.vulnerable)} | ${patched} | ${paths.join('<br>') || '–'} |`;
}

const FOOTER = [
  '### What to do',
  '',
  '- **Fix** – update the dependency, or force a fixed version with an `overrides` entry in `pnpm-workspace.yaml`.',
  '- **Accept** – only when no fixed version exists: add the GHSA with its reason to `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml` (§2.10).',
  '',
  'The daily workflow `advisory-audit.yml` keeps this issue current: it closes the issue when the audit is clean and no exception is stale, and reopens it on the next finding. Do not rename or relabel the issue – the workflow finds it by its title and the `security` label.',
].join('\n');

/**
 * The report: the hidden markers, a table of the advisories ordered by severity and GHSA, the stale
 * exceptions of `pnpm-workspace.yaml`, and what to do. Paths are shortened to the first few; when
 * the body exceeds the limit, the paths are cut to one per advisory first, then advisories are left
 * out with a note. The stale exceptions, a short hand-kept list, are always rendered in full.
 * @param {Advisory[]} advisories
 * @param {{ limit?: number, stale?: StaleException[] }} [options]
 * @returns {string}
 */
export function renderReport(advisories, { limit = BODY_LIMIT, stale = [] } = {}) {
  const ordered = sorted(advisories);
  const count = ordered.length === 1 ? '1 advisory' : `${ordered.length} advisories`;
  const exceptions = staleSection(stale);
  const render = (shown, maxPaths) => {
    const cut = ordered.length - shown;
    const table =
      ordered.length === 0
        ? [
            '`pnpm audit --audit-level low` finds no advisory in the committed lockfile that is not accepted in `auditConfig.ignoreGhsas`.',
            '',
          ]
        : [
            `\`pnpm audit --audit-level low\` finds **${count}** in the committed lockfile that ${ordered.length === 1 ? 'is' : 'are'} not accepted in \`auditConfig.ignoreGhsas\`.`,
            '',
            '| Advisory | Severity | Package | Vulnerable | Patched | Paths |',
            '|---|---|---|---|---|---|',
            ...ordered.slice(0, shown).map((advisory) => row(advisory, maxPaths)),
            ...(cut > 0
              ? [
                  '',
                  `${cut} more not listed here (size limit); the job summary of the run lists all.`,
                ]
              : []),
            '',
          ];
    return [
      marker(ordered),
      ...(stale.length > 0 ? [staleMarker(stale)] : []),
      '',
      ...table,
      ...exceptions,
      FOOTER,
      '',
    ].join('\n');
  };
  for (const maxPaths of [MAX_PATHS, 1]) {
    const body = render(ordered.length, maxPaths);
    if (body.length <= limit) {
      return body;
    }
  }
  for (let shown = ordered.length - 1; shown > 0; shown -= 1) {
    const body = render(shown, 1);
    if (body.length <= limit) {
      return body;
    }
  }
  return render(0, 1);
}

/**
 * @typedef {object} TrackingIssue
 * @property {number} number
 * @property {'open' | 'closed'} state
 * @property {string} body
 */

/**
 * @typedef {object} SyncPlan
 * @property {'open' | 'reopen' | 'update' | 'update+comment' | 'close' | 'none'} action
 * @property {string} [body] the new issue body
 * @property {string} [comment] the comment to add
 */

const unique = (list) => [...new Map(list.map((advisory) => [advisory.ghsa, advisory])).values()];

function summarize(advisory) {
  const severity = validSeverity(advisory.severity) ? advisory.severity : INVALID;
  return `${advisoryLink(advisory.ghsa)} – ${severity}, ${span(PACKAGE, advisory.package)}`;
}

/**
 * What the run does with the tracking issue. The issue is open while advisories or stale
 * exceptions remain. A comment is added only when either set changed – a new or gone GHSA, a GHSA
 * that gained a patched version, a new or gone stale exception – and on reopening and closing, so
 * every notification means something new; an unchanged body is `none`.
 * @param {Advisory[]} advisories
 * @param {TrackingIssue | undefined} issue the oldest tracking issue, open or closed
 * @param {{ limit?: number, stale?: StaleException[] }} [options]
 * @returns {SyncPlan}
 */
export function planSync(advisories, issue, options = {}) {
  const stale = options.stale ?? [];
  if (advisories.length === 0 && stale.length === 0) {
    return issue?.state === 'open'
      ? {
          action: 'close',
          comment:
            'The advisory audit is clean: no advisory remains that is not accepted in `auditConfig.ignoreGhsas`, and no exception of `pnpm-workspace.yaml` is stale. Closing; the next finding reopens this issue.',
        }
      : { action: 'none' };
  }
  const body = renderReport(advisories, options);
  const current = sorted(advisories).filter((advisory) => validGhsa(advisory.ghsa));
  if (!issue) {
    return { action: 'open', body };
  }
  if (issue.state === 'closed') {
    return {
      action: 'reopen',
      body,
      comment: [
        'Reopened: the advisory audit finds advisories or stale exceptions again.',
        '',
        ...capped([
          ...unique(current).map((advisory) => `- ${summarize(advisory)}`),
          ...stale.map((exception) => `- Stale: ${summarizeStale(exception)}`),
        ]),
      ].join('\n'),
    };
  }
  const previous = readMarker(issue.body);
  const ids = new Set(current.map((advisory) => advisory.ghsa));
  const added = current.filter((advisory) => !previous.has(advisory.ghsa));
  const gone = [...previous.keys()].filter((ghsa) => !ids.has(ghsa)).sort();
  const fixed = readMarker(marker(current));
  const patched = current.filter(
    (advisory) => previous.get(advisory.ghsa) === false && fixed.get(advisory.ghsa) === true,
  );
  const advisoryChanges = [
    ...unique(added).map((advisory) => `- New: ${summarize(advisory)}`),
    ...gone.map((ghsa) => `- Gone: ${advisoryLink(ghsa)}`),
    ...unique(patched).map(
      (advisory) =>
        `- Patched version now: ${summarize(advisory)} – ${span(RANGE, advisory.patched)}`,
    ),
  ];
  const previousStale = readStaleMarker(issue.body);
  const currentStale = readStaleMarker(staleMarker(stale));
  const staleChanges = [
    ...stale
      .filter((exception) => {
        const token = staleToken(exception);
        return token !== null && !previousStale.has(token);
      })
      .map((exception) => `- New stale exception: ${summarizeStale(exception)}`),
    ...[...previousStale]
      .filter((token) => !currentStale.has(token))
      .sort()
      .map((token) => `- Stale exception gone: ${summarizeToken(token)}`),
  ];
  const changes = capped([...advisoryChanges, ...staleChanges]);
  if (changes.length > 0) {
    const heading =
      staleChanges.length === 0
        ? 'The advisory set changed:'
        : advisoryChanges.length === 0
          ? 'The stale exceptions changed:'
          : 'The advisories and stale exceptions changed:';
    return {
      action: 'update+comment',
      body,
      comment: [heading, '', ...changes].join('\n'),
    };
  }
  return body === issue.body.replaceAll('\r\n', '\n')
    ? { action: 'none' }
    : { action: 'update', body };
}

/**
 * Runs `gh` with an argument array – never a shell string – and returns its standard output.
 * @callback Gh
 * @param {string[]} args
 * @param {string} [input] standard input, e.g. the JSON request of `gh api --input -`
 * @returns {string}
 */

/**
 * The oldest issue with the exact tracking title among the issues the workflow opened, found
 * through REST, which has no search-index lag; pull requests are left out.
 * @param {Gh} gh
 * @param {string} repository
 * @returns {TrackingIssue | undefined}
 */
export function findIssue(gh, repository) {
  const lines = gh([
    'api',
    '--paginate',
    `repos/${repository}/issues?state=all&labels=security&creator=${encodeURIComponent('github-actions[bot]')}&per_page=100`,
    '--jq',
    '.[] | select(.pull_request == null) | {number, state, title, body}',
  ]);
  return lines
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((issue) => issue.title === ISSUE_TITLE)
    .sort((a, b) => a.number - b.number)
    .map(({ number, state, body }) => ({ number, state, body: body ?? '' }))[0];
}

/**
 * Applies the plan to the tracking issue.
 * @param {Gh} gh
 * @param {string} repository
 * @param {TrackingIssue | undefined} issue
 * @param {SyncPlan} plan
 * @returns {number | undefined} the number of the tracking issue
 */
export function applyPlan(gh, repository, issue, plan) {
  const request = (method, path, fields) =>
    gh(
      ['api', '-X', method, `repos/${repository}/${path}`, '--input', '-'],
      JSON.stringify(fields),
    );
  const comment = (number) => {
    if (plan.comment) {
      request('POST', `issues/${number}/comments`, { body: plan.comment });
    }
  };
  switch (plan.action) {
    case 'open': {
      const created = request('POST', 'issues', {
        title: ISSUE_TITLE,
        body: plan.body,
        labels: ISSUE_LABELS,
      });
      return JSON.parse(created).number;
    }
    case 'reopen':
      request('PATCH', `issues/${issue.number}`, { state: 'open', body: plan.body });
      comment(issue.number);
      return issue.number;
    case 'update':
    case 'update+comment':
      request('PATCH', `issues/${issue.number}`, { body: plan.body });
      comment(issue.number);
      return issue.number;
    case 'close':
      comment(issue.number);
      request('PATCH', `issues/${issue.number}`, { state: 'closed', state_reason: 'completed' });
      return issue.number;
    default:
      return issue?.number;
  }
}

const RETRIES = 2;

/**
 * Runs a lookup with two retries and a growing pause on a transient failure: an error marked
 * `retriable` (a network error, 429 or 5xx). Anything else is thrown at once.
 * @template T
 * @param {() => Promise<T>} lookup
 * @param {(ms: number) => Promise<void>} sleep
 * @returns {Promise<T>}
 */
export async function withRetries(lookup, sleep) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await lookup();
    } catch (error) {
      if (!error?.retriable || attempt >= RETRIES) {
        throw error;
      }
      await sleep(1000 * 2 ** attempt);
    }
  }
}

const retriable = (message) => Object.assign(new Error(message), { retriable: true });

/**
 * The JSON document of a registry URL, `null` for a 404. Redirects are refused; a network error,
 * 429 or 5xx is retried. `accept` selects the full document (`application/json`, with `time`) or
 * the abbreviated one (`ABBREVIATED`, much smaller, without `time`).
 * @param {string} url
 * @param {{ fetch: typeof fetch, sleep: (ms: number) => Promise<void>, accept?: string }} io
 * @returns {Promise<unknown>}
 */
export function registryJson(url, { fetch, sleep, accept = 'application/json' }) {
  return withRetries(async () => {
    let response;
    try {
      response = await fetch(url, {
        redirect: 'error',
        headers: { accept },
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw retriable(`The registry could not be reached for ${url}`);
    }
    if (response.status === 404) {
      return null;
    }
    if (response.status === 429 || response.status >= 500) {
      throw retriable(`The registry answered ${response.status} for ${url}`);
    }
    if (!response.ok) {
      throw new Error(`The registry answered ${response.status} for ${url}`);
    }
    try {
      return await response.json();
    } catch (error) {
      // The timeout covers reading the body too; a large package document can run into it.
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw retriable(`The registry timed out sending the document for ${url}`);
      }
      throw new Error(`The registry answered no valid JSON for ${url}`);
    }
  }, sleep);
}

/**
 * A global GitHub advisory through `gh api`, `null` for a 404 (an unknown GHSA). Only a validated
 * GHSA id reaches the argument array.
 * @param {Gh} gh
 * @param {string} ghsa
 * @param {(ms: number) => Promise<void>} sleep
 * @returns {Promise<unknown>}
 */
export function githubAdvisory(gh, ghsa, sleep) {
  if (!validGhsa(ghsa)) {
    throw new Error('Not a GHSA id');
  }
  return withRetries(async () => {
    let text;
    try {
      text = gh(['api', `/advisories/${ghsa}`]);
    } catch (error) {
      const stderr = String(error?.stderr || error?.message || '');
      if (/HTTP 404/.test(stderr)) {
        return null;
      }
      // The first line of gh's error (no token is ever in it), so a failed run can be diagnosed.
      const detail = (stderr.split('\n').find((line) => line.trim()) ?? '').trim().slice(0, 200);
      if (/HTTP 4\d\d/.test(stderr) && !/HTTP 429/.test(stderr) && !/rate limit/i.test(stderr)) {
        throw new Error(`The advisory API refused the request for ${ghsa}: ${detail}`);
      }
      throw retriable(`The advisory API could not be reached for ${ghsa}: ${detail}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`The advisory API answered no valid JSON for ${ghsa}`);
    }
  }, sleep);
}

/**
 * The run: the job summary always; the tracking issue only on the default branch. A scheduled run
 * always runs on the default branch; **Run workflow** on another branch is a dry run, so testing a
 * branch never touches the tracking issue of `main`. Both inputs are parsed and every exception is
 * checked before anything is written, so a failure leaves the issue untouched.
 * @param {string} auditText the output of `pnpm audit --audit-level low --json`
 * @param {string} configText the output of `pnpm config list --json`
 * @param {string} lockfileText the output of `pnpm list -r --depth Infinity --lockfile-only --json`
 * @param {{
 *   env: Record<string, string | undefined>,
 *   gh: Gh,
 *   summary: (text: string) => void,
 *   log: (text: string) => void,
 *   now: number,
 *   fetch: typeof fetch,
 *   sleep: (ms: number) => Promise<void>,
 *   root: string,
 *   readText: (path: string) => string,
 * }} io `root` is the checkout; `readText` reads a `package.json` of the workspace
 * @returns {Promise<SyncPlan['action'] | 'dry-run'>}
 */
export async function sync(auditText, configText, lockfileText, io) {
  const { env, gh, summary, log, now, fetch, sleep, root, readText } = io;
  const advisories = parseAudit(auditText);
  const config = parseConfig(configText);
  const lockfile = parseLockfile(lockfileText, root);
  for (const message of invalidFields(advisories)) {
    log(message);
  }
  const repository = env.GITHUB_REPOSITORY ?? '';
  if (!REPOSITORY.test(repository)) {
    throw new Error('GITHUB_REPOSITORY is not an owner/name');
  }
  const stale = await checkExceptions(config, {
    now,
    registryJson: (url, accept) => registryJson(url, { fetch, sleep, accept }),
    advisory: (ghsa) => githubAdvisory(gh, ghsa, sleep),
    lockfile,
    // The folder passed parseLockfile's check: a workspace project inside the checkout.
    manifest: (folder) => {
      try {
        return JSON.parse(readText(join(folder, 'package.json')));
      } catch {
        throw new Error('A package.json of the workspace could not be read');
      }
    },
    log,
  });
  for (const exception of stale.filter((entry) => entry.entry === null)) {
    log(`An entry of ${SETTING_NAMES[exception.setting]} fails its allowlist`);
  }
  const report =
    advisories.length === 0 && stale.length === 0
      ? 'No advisory that is not accepted in `auditConfig.ignoreGhsas`, and no exception of `pnpm-workspace.yaml` is stale.\n'
      : renderReport(advisories, { limit: Infinity, stale });
  const defaultBranch = gh(['api', `repos/${repository}`, '--jq', '.default_branch']).trim();
  const writes =
    env.GITHUB_EVENT_NAME === 'schedule' || env.GITHUB_REF === `refs/heads/${defaultBranch}`;
  const lines = ['## Advisory audit', '', report];
  if (!writes) {
    summary(
      [
        ...lines,
        '',
        'Dry run outside the default branch: the tracking issue is not written.',
        '',
      ].join('\n'),
    );
    log('Dry run outside the default branch: the tracking issue is not written.');
    return 'dry-run';
  }
  const issue = findIssue(gh, repository);
  const plan = planSync(advisories, issue, { stale });
  const number = applyPlan(gh, repository, issue, plan);
  const outcome =
    number === undefined
      ? 'No tracking issue: the audit is clean and no exception is stale.'
      : `Tracking issue: #${number} (${plan.action}).`;
  summary([...lines, '', outcome, ''].join('\n'));
  log(outcome);
  return plan.action;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, auditFile, configFile, lockfileFile] = process.argv.slice(2);
  if (command === 'sync' && auditFile && configFile && lockfileFile) {
    const read = (file) => readFileSync(file, 'utf8');
    await sync(read(auditFile), read(configFile), read(lockfileFile), {
      root: process.cwd(),
      readText: read,
      env: process.env,
      gh: (args, input) =>
        execFileSync('gh', args, {
          encoding: 'utf8',
          input,
          maxBuffer: 64 * 1024 * 1024,
          // A hung call fails (and is retried for an advisory lookup) instead of holding the job.
          timeout: 120_000,
          stdio: ['pipe', 'pipe', 'pipe'],
        }),
      summary: (text) => {
        if (process.env.GITHUB_STEP_SUMMARY) {
          appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
        } else {
          process.stdout.write(text);
        }
      },
      log: (text) => process.stdout.write(`${text}\n`),
      now: Date.now(),
      fetch: globalThis.fetch,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    });
  } else {
    process.stderr.write(
      'Usage: node scripts/advisory-audit.js sync <audit.json> <config.json> <lockfile.json>\n',
    );
    process.exit(2);
  }
}
