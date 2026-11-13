// Daily advisory audit of the default branch (§2.10, §15.4), used by
// `.github/workflows/advisory-audit.yml`: turns the output of `pnpm audit --audit-level low --json`
// into a report and keeps one tracking issue current – opened or reopened while advisories remain
// that are not accepted in `auditConfig.ignoreGhsas`, closed when the audit is clean.
// Usage:
//   node scripts/advisory-audit.js sync <audit.json>   job summary, and the tracking issue on a run
//                                                      of the default branch (GITHUB_*, GH_TOKEN)
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ISSUE_TITLE = 'Vulnerability advisories on main';
export const ISSUE_LABELS = ['security', 'dependencies'];
/** GitHub's limit is 65,536 characters; the margin keeps multi-byte counting differences safe. */
export const BODY_LIMIT = 60_000;
const MAX_PATHS = 5;
const INVALID = '(invalid)';

const SEVERITIES = ['critical', 'high', 'moderate', 'low'];
// Allowlists, not escaping (spec): a field that fails its pattern is never rendered, so advisory
// data cannot add Markdown, HTML, links, mentions or cross-references to the issue.
const GHSA = /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/;
const PACKAGE = /^(@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]{0,213}$/;
const RANGE = /^[0-9A-Za-z.*+<>=~^| -]{1,256}$/;
// A dependency path, e.g. `.>@nestjs/core>multer`: the root `.`, workspace folders and packages.
const PATH_SEGMENT =
  /^([0-9A-Za-z._-]{1,214}|(@[a-z0-9~-][a-z0-9._~-]*\/)[a-z0-9~-][a-z0-9._~-]{0,213})$/;
const MAX_PATH = 1000;
const MARKER = /<!-- advisory-audit: ([^>]*) -->/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

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

/** A field in a code span; `|` written as `\|`, which a GFM table cell needs even there. */
const code = (pattern, value) =>
  valid(pattern, value) ? `\`${value.replaceAll('|', '\\|')}\`` : INVALID;
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
  const entries = [
    ...new Set(
      advisories
        .filter((advisory) => validGhsa(advisory.ghsa))
        .map((advisory) => `${advisory.ghsa}:${hasPatch(advisory) ? 'patched' : 'none'}`),
    ),
  ].sort();
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
  'The daily workflow `advisory-audit.yml` keeps this issue current: it closes the issue when the audit is clean and reopens it on the next finding. Do not rename or relabel the issue – the workflow finds it by its title and the `security` label.',
].join('\n');

/**
 * The report of the advisories: the hidden marker, a table ordered by severity and GHSA, and what
 * to do. Paths are shortened to the first few; when the body exceeds the limit, the paths are cut
 * to one per advisory first, then advisories are left out with a note.
 * @param {Advisory[]} advisories
 * @param {{ limit?: number }} [options]
 * @returns {string}
 */
export function renderReport(advisories, { limit = BODY_LIMIT } = {}) {
  const ordered = sorted(advisories);
  const count = ordered.length === 1 ? '1 advisory' : `${ordered.length} advisories`;
  const render = (shown, maxPaths) => {
    const cut = ordered.length - shown;
    return [
      marker(ordered),
      '',
      `\`pnpm audit --audit-level low\` finds **${count}** in the committed lockfile that ${ordered.length === 1 ? 'is' : 'are'} not accepted in \`auditConfig.ignoreGhsas\`.`,
      '',
      '| Advisory | Severity | Package | Vulnerable | Patched | Paths |',
      '|---|---|---|---|---|---|',
      ...ordered.slice(0, shown).map((advisory) => row(advisory, maxPaths)),
      ...(cut > 0
        ? ['', `${cut} more not listed here (size limit); the job summary of the run lists all.`]
        : []),
      '',
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
  return `${advisoryLink(advisory.ghsa)} – ${severity}, ${code(PACKAGE, advisory.package)}`;
}

/**
 * What the run does with the tracking issue. A comment is added only when the advisory set
 * changed – a new or gone GHSA, or a GHSA that gained a patched version – and on reopening and
 * closing, so every notification means something new; an unchanged body is `none`.
 * @param {Advisory[]} advisories
 * @param {TrackingIssue | undefined} issue the oldest tracking issue, open or closed
 * @param {{ limit?: number }} [options]
 * @returns {SyncPlan}
 */
export function planSync(advisories, issue, options = {}) {
  if (advisories.length === 0) {
    return issue?.state === 'open'
      ? {
          action: 'close',
          comment:
            'The advisory audit is clean: no advisory remains that is not accepted in `auditConfig.ignoreGhsas`. Closing; the next finding reopens this issue.',
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
        'Reopened: the advisory audit finds advisories again.',
        '',
        ...unique(current).map((advisory) => `- ${summarize(advisory)}`),
      ].join('\n'),
    };
  }
  const previous = readMarker(issue.body);
  const ids = new Set(current.map((advisory) => advisory.ghsa));
  const added = current.filter((advisory) => !previous.has(advisory.ghsa));
  const gone = [...previous.keys()].filter((ghsa) => !ids.has(ghsa)).sort();
  const patched = current.filter(
    (advisory) => previous.get(advisory.ghsa) === false && hasPatch(advisory),
  );
  const changes = [
    ...unique(added).map((advisory) => `- New: ${summarize(advisory)}`),
    ...gone.map((ghsa) => `- Gone: ${advisoryLink(ghsa)}`),
    ...unique(patched).map(
      (advisory) =>
        `- Patched version now: ${summarize(advisory)} – ${code(RANGE, advisory.patched)}`,
    ),
  ];
  if (changes.length > 0) {
    return {
      action: 'update+comment',
      body,
      comment: ['The advisory set changed:', '', ...changes].join('\n'),
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

/**
 * The run: the job summary always; the tracking issue only on the default branch. A scheduled run
 * always runs on the default branch; **Run workflow** on another branch is a dry run, so testing a
 * branch never touches the tracking issue of `main`.
 * @param {string} auditText the output of `pnpm audit --audit-level low --json`
 * @param {{ env: Record<string, string | undefined>, gh: Gh, summary: (text: string) => void, log: (text: string) => void }} io
 * @returns {SyncPlan['action'] | 'dry-run'}
 */
export function sync(auditText, { env, gh, summary, log }) {
  const advisories = parseAudit(auditText);
  for (const message of invalidFields(advisories)) {
    log(message);
  }
  const repository = env.GITHUB_REPOSITORY ?? '';
  if (!REPOSITORY.test(repository)) {
    throw new Error('GITHUB_REPOSITORY is not an owner/name');
  }
  const report =
    advisories.length === 0
      ? 'No advisory that is not accepted in `auditConfig.ignoreGhsas`.\n'
      : renderReport(advisories, { limit: Infinity });
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
  const plan = planSync(advisories, issue);
  const number = applyPlan(gh, repository, issue, plan);
  const outcome =
    number === undefined
      ? 'No tracking issue: the audit is clean.'
      : `Tracking issue: #${number} (${plan.action}).`;
  summary([...lines, '', outcome, ''].join('\n'));
  log(outcome);
  return plan.action;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, file] = process.argv.slice(2);
  if (command === 'sync' && file) {
    sync(readFileSync(file, 'utf8'), {
      env: process.env,
      gh: (args, input) =>
        execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 }),
      summary: (text) => {
        if (process.env.GITHUB_STEP_SUMMARY) {
          appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
        } else {
          process.stdout.write(text);
        }
      },
      log: (text) => process.stdout.write(`${text}\n`),
    });
  } else {
    process.stderr.write('Usage: node scripts/advisory-audit.js sync <audit.json>\n');
    process.exit(2);
  }
}
