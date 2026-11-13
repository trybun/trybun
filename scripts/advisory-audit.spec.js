import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ABBREVIATED,
  BODY_LIMIT,
  ISSUE_LABELS,
  ISSUE_TITLE,
  applyPlan,
  checkExceptions,
  findIssue,
  githubAdvisory,
  invalidFields,
  marker,
  parseAudit,
  parseConfig,
  parseLockfile,
  planSync,
  readMarker,
  readStaleMarker,
  registryJson,
  renderReport,
  satisfies,
  specKind,
  staleMarker,
  sync,
  withRetries,
} from './advisory-audit.js';

// Captured from pnpm 12.13: a scratch project with `minimatch` 10.2.6 and `glob` 11.0.3, the clean
// output of this repository (its accepted GHSA-gcqx-w48m-w2h4 counted only in `metadata`) and the
// empty standard output of a failed audit (no lockfile).
const fixture = (name) =>
  readFileSync(new URL(`./fixtures/advisory-audit/${name}`, import.meta.url), 'utf8');
const ADVISORIES = parseAudit(fixture('advisories.json'));

/** @returns {import('./advisory-audit.js').Advisory} */
const advisory = (fields = {}) => ({
  ghsa: 'GHSA-g3hv-75wg-m249',
  severity: 'moderate',
  package: 'minimatch',
  vulnerable: '>=7.0.0 <11.0.1',
  patched: '>=11.0.1',
  paths: ['.>minimatch'],
  ...fields,
});

describe('parseAudit', () => {
  it('reads the advisories of real pnpm output, with their paths', () => {
    expect(ADVISORIES).toHaveLength(3);
    expect(ADVISORIES).toContainEqual({
      ghsa: 'GHSA-g3hv-75wg-m249',
      severity: 'moderate',
      package: 'minimatch',
      vulnerable: '>=7.0.0 <11.0.1',
      patched: '>=11.0.1',
      paths: ['.>glob>minimatch', '.>minimatch'],
    });
  });

  it('takes the list from `advisories`, not from the counts of `metadata`', () => {
    const clean = fixture('clean.json');
    expect(JSON.parse(clean).metadata.vulnerabilities.low).toBe(1);
    expect(parseAudit(clean)).toEqual([]);
  });

  it('fails on the empty output of a failed audit and on anything but the audit object', () => {
    expect(() => parseAudit(fixture('failed.json'))).toThrow('no result');
    expect(() => parseAudit('{"advisories"')).toThrow('no valid JSON');
    expect(() => parseAudit('{"error":{"code":"ERR"}}')).toThrow('without `advisories`');
    expect(() => parseAudit('{"advisories":[],"metadata":{}}')).toThrow('without `advisories`');
    expect(() => parseAudit('{"advisories":{"1":"x"},"metadata":{}}')).toThrow('not an object');
  });

  it('keeps a missing fix as null', () => {
    const text = JSON.stringify({
      advisories: { 1: { github_advisory_id: 'GHSA-gcqx-w48m-w2h4', patched_versions: null } },
      metadata: {},
    });
    expect(parseAudit(text)[0]).toMatchObject({ patched: null, paths: [] });
  });
});

describe('renderReport', () => {
  it('lists every advisory by severity, then GHSA, with the hidden marker first', () => {
    const body = renderReport(ADVISORIES);
    expect(body.split('\n')[0]).toBe(
      '<!-- advisory-audit: GHSA-3g3m-2fjr-6pw4:patched,GHSA-5j98-mcp5-4vw2:patched,GHSA-g3hv-75wg-m249:patched -->',
    );
    const rows = body.split('\n').filter((line) => line.startsWith('| [GHSA'));
    expect(rows.map((line) => line.slice(3, 22))).toEqual([
      'GHSA-5j98-mcp5-4vw2',
      'GHSA-3g3m-2fjr-6pw4',
      'GHSA-g3hv-75wg-m249',
    ]);
    expect(rows[2]).toBe(
      '| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | moderate | `minimatch` | `>=7.0.0 <11.0.1` | `>=11.0.1` | `.>glob>minimatch`<br>`.>minimatch` |',
    );
    expect(body).toContain('**3 advisories**');
    expect(body).toContain('`auditConfig.ignoreGhsas`');
    expect(body).toContain('Do not rename or relabel');
  });

  it('renders a missing fix as none', () => {
    expect(renderReport([advisory({ patched: null })])).toContain('| `>=7.0.0 <11.0.1` | none |');
    expect(marker([advisory({ patched: null })])).toBe(
      '<!-- advisory-audit: GHSA-g3hv-75wg-m249:none -->',
    );
  });

  it('keeps the table row of a range with alternatives intact', () => {
    const body = renderReport([advisory({ vulnerable: '<1.2.3 || >=2.0.0 <2.0.1' })]);
    const row = body.split('\n').find((line) => line.startsWith('| [GHSA'));
    expect(row).toContain('`<1.2.3 \\|\\| >=2.0.0 <2.0.1`');
    expect(row.split(/(?<!\\)\|/)).toHaveLength(8);
  });

  it('shortens the paths to the first five', () => {
    const paths = Array.from({ length: 8 }, (_, index) => `.>a${index}>minimatch`);
    const body = renderReport([advisory({ paths })]);
    expect(body).toContain('`.>a4>minimatch`<br>and 3 more |');
    expect(body).not.toContain('a5');
  });

  const hostile = [
    '**bold** [link](https://evil.example)',
    '<img src=x onerror=alert(1)>',
    '@maintainer',
    '#1',
    'trybun/trybun#1',
    'x --> <!-- advisory-audit: GHSA-xxxx -->',
    'x --!> <!-- advisory-audit: GHSA-xxxx --!>',
    'a`b',
  ];
  const fields = ['ghsa', 'severity', 'package', 'vulnerable', 'patched', 'paths'];

  it.each(fields)('never renders a %s that fails its allowlist', (field) => {
    for (const value of hostile) {
      const body = renderReport([advisory({ [field]: field === 'paths' ? [value] : value })]);
      const lines = body.split('\n');
      const row = lines[lines.indexOf('|---|---|---|---|---|---|') + 1];
      const [, ...rest] = lines;
      expect(row).not.toContain(value);
      expect(rest.join('\n')).not.toContain(value);
      expect(row).toContain('(invalid)');
      // A comment ends with `-->` or `--!>`; only the marker's own end may appear.
      expect(body.match(/--!?>/g)).toHaveLength(1);
    }
  });

  it('builds the marker only from valid GHSA ids', () => {
    expect(marker([advisory({ ghsa: 'GHSA-xxxx --> @x' }), advisory()])).toBe(
      '<!-- advisory-audit: GHSA-g3hv-75wg-m249:patched -->',
    );
  });

  it('stays under the body limit by cutting paths first, then advisories', () => {
    const paths = Array.from(
      { length: 5 },
      (_, index) => `.>${Array(8).fill('p'.repeat(100)).join('>')}${index}`,
    );
    const many = Array.from({ length: 40 }, () => advisory({ paths }));
    const cutPaths = renderReport(many);
    expect(cutPaths.length).toBeLessThanOrEqual(BODY_LIMIT);
    expect(cutPaths).toContain('and 4 more');
    expect(cutPaths).not.toContain('more not listed');

    const huge = Array.from({ length: 200 }, () => advisory({ paths }));
    const cutRows = renderReport(huge);
    expect(cutRows.length).toBeLessThanOrEqual(BODY_LIMIT);
    expect(cutRows).toMatch(/\n\d+ more not listed here \(size limit\); the job summary/);
    expect(renderReport(huge, { limit: Infinity })).not.toContain('more not listed');
  });
});

describe('invalidFields', () => {
  it('names the failing fields, never their values', () => {
    const messages = invalidFields([advisory({ package: '<b>x</b>', paths: ['ok', '@x #1'] })]);
    expect(messages).toEqual([
      'GHSA-g3hv-75wg-m249: package fails its allowlist',
      'GHSA-g3hv-75wg-m249: path 2 fails its allowlist',
    ]);
    expect(invalidFields(ADVISORIES)).toEqual([]);
    expect(
      invalidFields([advisory({ paths: ['.>@nestjs/core>multer', 'apps__web>next'] })]),
    ).toEqual([]);
    expect(invalidFields([advisory({ ghsa: 'x' })])).toEqual([
      'advisory 1: GHSA id fails its allowlist',
    ]);
  });
});

describe('readMarker', () => {
  it('reads the set of the issue body and ignores anything else', () => {
    const body = `${marker([advisory(), advisory({ ghsa: 'GHSA-gcqx-w48m-w2h4', patched: null })])}\ntext`;
    expect(readMarker(body)).toEqual(
      new Map([
        ['GHSA-g3hv-75wg-m249', true],
        ['GHSA-gcqx-w48m-w2h4', false],
      ]),
    );
    expect(readMarker('<!-- advisory-audit: x:patched,GHSA-g3hv-75wg-m249:maybe -->')).toEqual(
      new Map(),
    );
    expect(readMarker('no marker')).toEqual(new Map());
  });
});

describe('planSync', () => {
  const open = (advisories) => ({ number: 7, state: 'open', body: renderReport(advisories) });
  const other = advisory({ ghsa: 'GHSA-3g3m-2fjr-6pw4', package: 'glob' });

  it('opens the issue on a finding without one', () => {
    expect(planSync([advisory()], undefined)).toEqual({
      action: 'open',
      body: renderReport([advisory()]),
    });
  });

  it('reopens a closed issue with a comment listing the current set', () => {
    const plan = planSync([advisory()], { number: 7, state: 'closed', body: 'old' });
    expect(plan.action).toBe('reopen');
    expect(plan.body).toBe(renderReport([advisory()]));
    expect(plan.comment).toContain(
      '- [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) – moderate, `minimatch`',
    );
  });

  it('changes nothing when the result is unchanged', () => {
    expect(planSync([advisory()], open([advisory()]))).toEqual({ action: 'none' });
    const crlf = {
      ...open([advisory()]),
      body: renderReport([advisory()]).replaceAll('\n', '\r\n'),
    };
    expect(planSync([advisory()], crlf)).toEqual({ action: 'none' });
  });

  it('updates the body without a comment when only the content changed', () => {
    const plan = planSync([advisory({ paths: ['.>glob>minimatch'] })], open([advisory()]));
    expect(plan).toEqual({
      action: 'update',
      body: renderReport([advisory({ paths: ['.>glob>minimatch'] })]),
    });
  });

  it('comments on an added GHSA', () => {
    const plan = planSync([advisory(), other], open([advisory()]));
    expect(plan.action).toBe('update+comment');
    expect(plan.comment).toBe(
      'The advisory set changed:\n\n- New: [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) – moderate, `glob`',
    );
  });

  it('comments on a gone GHSA', () => {
    const plan = planSync([advisory()], open([advisory(), other]));
    expect(plan.action).toBe('update+comment');
    expect(plan.comment).toContain(
      '- Gone: [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)',
    );
  });

  it('comments on a GHSA that gained a patched version', () => {
    const plan = planSync([advisory()], open([advisory({ patched: null })]));
    expect(plan.action).toBe('update+comment');
    expect(plan.comment).toContain('- Patched version now: [GHSA-g3hv-75wg-m249]');
    expect(plan.comment).toContain('– `>=11.0.1`');
  });

  it('closes an open issue when the audit is clean, and otherwise does nothing', () => {
    expect(planSync([], open([advisory()]))).toMatchObject({ action: 'close' });
    expect(planSync([], open([advisory()])).comment).toContain('is clean');
    expect(planSync([], { number: 7, state: 'closed', body: '' })).toEqual({ action: 'none' });
    expect(planSync([], undefined)).toEqual({ action: 'none' });
  });
});

/** A fake `gh` answering from a table, recording every call. */
function fakeGh({ defaultBranch = 'main', issues = [], created = 9, advisories = {} } = {}) {
  const calls = [];
  const gh = (args, input) => {
    calls.push({ args, input: input === undefined ? undefined : JSON.parse(input) });
    if (args[0] === 'api' && args[1] === 'repos/trybun/trybun') {
      return `${defaultBranch}\n`;
    }
    if (args[0] === 'api' && args[1].startsWith('/advisories/')) {
      const answer = advisories[args[1].slice('/advisories/'.length)];
      if (answer === undefined) {
        throw Object.assign(new Error('gh failed'), { stderr: 'gh: Not Found (HTTP 404)' });
      }
      return answer;
    }
    if (args[1] === '--paginate') {
      return issues.map((issue) => `${JSON.stringify(issue)}\n`).join('');
    }
    if (args.includes('POST') && args[3] === 'repos/trybun/trybun/issues') {
      return JSON.stringify({ number: created });
    }
    return '{}';
  };
  return { gh, calls, writes: () => calls.filter((call) => call.input !== undefined) };
}

describe('findIssue', () => {
  it('takes the oldest issue with the exact title, through REST', () => {
    const { gh, calls } = fakeGh({
      issues: [
        { number: 12, state: 'open', title: ISSUE_TITLE, body: 'b' },
        { number: 5, state: 'closed', title: ISSUE_TITLE, body: null },
        { number: 3, state: 'open', title: `${ISSUE_TITLE} (old)`, body: '' },
      ],
    });
    expect(findIssue(gh, 'trybun/trybun')).toEqual({ number: 5, state: 'closed', body: '' });
    expect(calls[0].args).toEqual([
      'api',
      '--paginate',
      'repos/trybun/trybun/issues?state=all&labels=security&creator=github-actions%5Bbot%5D&per_page=100',
      '--jq',
      '.[] | select(.pull_request == null) | {number, state, title, body}',
    ]);
    expect(findIssue(fakeGh().gh, 'trybun/trybun')).toBeUndefined();
  });
});

describe('applyPlan', () => {
  const issue = { number: 7, state: 'open', body: '' };
  const run = (plan, target) => {
    const fake = fakeGh();
    const number = applyPlan(fake.gh, 'trybun/trybun', target, plan);
    return { number, writes: fake.writes().map(({ args, input }) => [args[2], args[3], input]) };
  };

  it('opens the issue with its title and labels', () => {
    expect(run({ action: 'open', body: 'B' })).toEqual({
      number: 9,
      writes: [
        [
          'POST',
          'repos/trybun/trybun/issues',
          { title: ISSUE_TITLE, body: 'B', labels: ISSUE_LABELS },
        ],
      ],
    });
  });

  it('reopens, updates and closes the existing issue', () => {
    expect(run({ action: 'reopen', body: 'B', comment: 'C' }, issue).writes).toEqual([
      ['PATCH', 'repos/trybun/trybun/issues/7', { state: 'open', body: 'B' }],
      ['POST', 'repos/trybun/trybun/issues/7/comments', { body: 'C' }],
    ]);
    expect(run({ action: 'update', body: 'B' }, issue).writes).toEqual([
      ['PATCH', 'repos/trybun/trybun/issues/7', { body: 'B' }],
    ]);
    expect(run({ action: 'update+comment', body: 'B', comment: 'C' }, issue).writes).toEqual([
      ['PATCH', 'repos/trybun/trybun/issues/7', { body: 'B' }],
      ['POST', 'repos/trybun/trybun/issues/7/comments', { body: 'C' }],
    ]);
    expect(run({ action: 'close', comment: 'C' }, issue).writes).toEqual([
      ['POST', 'repos/trybun/trybun/issues/7/comments', { body: 'C' }],
      ['PATCH', 'repos/trybun/trybun/issues/7', { state: 'closed', state_reason: 'completed' }],
    ]);
    expect(run({ action: 'none' }, issue)).toEqual({ number: 7, writes: [] });
    expect(run({ action: 'none' })).toEqual({ number: undefined, writes: [] });
  });

  it('passes every request as an argument array with the body on standard input', () => {
    const fake = fakeGh();
    applyPlan(fake.gh, 'trybun/trybun', issue, { action: 'update', body: '$(rm -rf /) `x`' });
    expect(fake.calls[0].args).toEqual([
      'api',
      '-X',
      'PATCH',
      'repos/trybun/trybun/issues/7',
      '--input',
      '-',
    ]);
    expect(fake.calls[0].input).toEqual({ body: '$(rm -rf /) `x`' });
  });
});

const EMPTY_CONFIG = JSON.stringify({ registry: 'https://registry.npmjs.org/' });
const EMPTY_LOCKFILE = '[]';
const noNetwork = () => {
  throw new Error('no network in this test');
};

describe('sync', () => {
  const env = (fields) => ({ GITHUB_REPOSITORY: 'trybun/trybun', ...fields });
  const io = (fake, fields, extra = {}) => {
    const summary = [];
    const log = [];
    return {
      summary,
      log,
      io: {
        env: env(fields),
        gh: fake.gh,
        summary: (line) => summary.push(line),
        log: (line) => log.push(line),
        now: Date.parse('2026-11-20T00:00:00Z'),
        fetch: noNetwork,
        sleep: async () => {},
        root: '/workspace/trybun',
        readText: noNetwork,
        ...extra,
      },
    };
  };
  const run = async (text, fields, options, config = EMPTY_CONFIG, extra = {}) => {
    const fake = fakeGh(options);
    const { summary, log, io: deps } = io(fake, fields, extra);
    const result = await sync(text, config, EMPTY_LOCKFILE, deps);
    return { result, summary: summary.join(''), log, writes: fake.writes() };
  };

  it('is a dry run on another branch: the job summary only', async () => {
    const outcome = await run(fixture('advisories.json'), {
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_REF: 'refs/heads/test/advisory',
    });
    expect(outcome.result).toBe('dry-run');
    expect(outcome.writes).toEqual([]);
    expect(outcome.summary).toContain('GHSA-g3hv-75wg-m249');
    expect(outcome.summary).toContain('`.>glob>minimatch`');
    expect(outcome.summary).toContain('Dry run outside the default branch');
  });

  it('writes the issue on a run of the default branch and on a scheduled run', async () => {
    const dispatched = await run(fixture('advisories.json'), {
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_REF: 'refs/heads/main',
    });
    expect(dispatched.result).toBe('open');
    expect(dispatched.summary).toContain('Tracking issue: #9 (open).');
    expect(dispatched.writes).toHaveLength(1);

    const scheduled = await run(
      fixture('advisories.json'),
      {
        GITHUB_EVENT_NAME: 'schedule',
        GITHUB_REF: 'refs/heads/main',
      },
      { defaultBranch: 'trunk' },
    );
    expect(scheduled.result).toBe('open');
  });

  it('closes the open issue on a clean audit', async () => {
    const outcome = await run(
      fixture('clean.json'),
      { GITHUB_EVENT_NAME: 'schedule' },
      {
        issues: [
          { number: 4, state: 'open', title: ISSUE_TITLE, body: renderReport([advisory()]) },
        ],
      },
    );
    expect(outcome.result).toBe('close');
    expect(outcome.summary).toContain('No advisory that is not accepted');
    expect(outcome.summary).toContain('Tracking issue: #4 (close).');
  });

  it('reports a clean audit without an issue', async () => {
    const outcome = await run(fixture('clean.json'), { GITHUB_EVENT_NAME: 'schedule' });
    expect(outcome.result).toBe('none');
    expect(outcome.summary).toContain(
      'No tracking issue: the audit is clean and no exception is stale.',
    );
  });

  it('fails a failed audit or unreadable settings before touching anything', async () => {
    const fake = fakeGh();
    await expect(
      sync(
        fixture('failed.json'),
        EMPTY_CONFIG,
        EMPTY_LOCKFILE,
        io(fake, { GITHUB_EVENT_NAME: 'schedule' }).io,
      ),
    ).rejects.toThrow('no result');
    await expect(
      sync(
        fixture('clean.json'),
        '',
        EMPTY_LOCKFILE,
        io(fake, { GITHUB_EVENT_NAME: 'schedule' }).io,
      ),
    ).rejects.toThrow('no valid JSON');
    await expect(
      sync(fixture('clean.json'), EMPTY_CONFIG, '', io(fake, { GITHUB_EVENT_NAME: 'schedule' }).io),
    ).rejects.toThrow('pnpm list printed no valid JSON');
    expect(fake.calls).toEqual([]);
  });

  it('logs the fields that fail their allowlist and rejects a malformed repository', async () => {
    const text = JSON.stringify({
      advisories: {
        1: {
          github_advisory_id: 'GHSA-g3hv-75wg-m249',
          severity: 'moderate',
          module_name: '@x #1',
          vulnerable_versions: '<1',
          patched_versions: null,
          findings: [],
        },
      },
      metadata: {},
    });
    const outcome = await run(text, {
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_REF: 'refs/heads/x',
    });
    expect(outcome.log).toContain('GHSA-g3hv-75wg-m249: package fails its allowlist');
    const bad = io(fakeGh(), {});
    await expect(
      sync(fixture('clean.json'), EMPTY_CONFIG, EMPTY_LOCKFILE, {
        ...bad.io,
        env: { GITHUB_REPOSITORY: 'a/b c' },
      }),
    ).rejects.toThrow('GITHUB_REPOSITORY');
  });
});

describe('review follow-ups', () => {
  const open = (advisories) => ({ number: 7, state: 'open', body: renderReport(advisories) });

  it('writes a range with alternatives unescaped outside the table', () => {
    const plan = planSync(
      [advisory({ patched: '^1.2.3 || >=2.0.1' })],
      open([advisory({ patched: null })]),
    );
    expect(plan.comment).toContain('– `^1.2.3 || >=2.0.1`');
  });

  it('accepts legacy package names with capitals and the info severity', () => {
    expect(invalidFields([advisory({ package: 'JSONStream', severity: 'info' })])).toEqual([]);
  });

  it('caps the comment lines', () => {
    const distinct = 'cfghjmpqrvwx23456789'
      .split('')
      .flatMap((a) =>
        'cfghjmpqrvwx23456789'
          .split('')
          .map((b) => advisory({ ghsa: `GHSA-g3hv-75wg-m2${a}${b}` })),
      );
    const plan = planSync(distinct, { number: 7, state: 'closed', body: '' });
    expect(plan.comment.split('\n').filter((line) => line.startsWith('- '))).toHaveLength(201);
    expect(plan.comment).toContain(`- and ${distinct.length - 200} more`);
  });

  it('counts a GHSA of several packages as patched only when all have a fix', () => {
    const mixed = [advisory(), advisory({ package: 'glob', patched: null })];
    expect(marker(mixed)).toBe('<!-- advisory-audit: GHSA-g3hv-75wg-m249:none -->');
    const plan = planSync([advisory(), advisory({ package: 'glob' })], open(mixed));
    expect(plan.action).toBe('update+comment');
    expect(plan.comment).toContain('Patched version now');
  });
});

// Captured from `pnpm config list --json` of this repository (pnpm 12.13), before the withdrawn
// GHSA-vfj7-8cjw-p6xm was removed, and from `gh api /advisories/…`.
const CONFIG = fixture('config.json');
const ADVISORY_API = Object.fromEntries(
  ['GHSA-g3hv-75wg-m249', 'GHSA-gcqx-w48m-w2h4', 'GHSA-vfj7-8cjw-p6xm'].map((ghsa) => [
    ghsa,
    fixture(`advisory-${ghsa}.json`),
  ]),
);
const NOW = Date.parse('2026-11-20T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

/** A lockfile that resolves every version, for the checks that come after the lockfile check. */
const ANY_LOCKFILE = { present: { has: () => true }, dependents: new Map() };

/** Lookups answering from tables, recording what was asked. */
function lookups({
  times = {},
  advisories = {},
  documents = {},
  lockfile = ANY_LOCKFILE,
  manifests = {},
} = {}) {
  const asked = [];
  const logged = [];
  return {
    asked,
    logged,
    now: NOW,
    lockfile,
    // A project without an entry declares nothing.
    manifest: (folder) => {
      asked.push(folder);
      return manifests[folder] ?? {};
    },
    registryJson: async (url, accept) => {
      asked.push(accept ? `${url} (${accept})` : url);
      const name = decodeURIComponent(new URL(url).pathname.split('/').pop());
      if (accept) {
        return name in documents ? documents[name] : null;
      }
      return name in times ? { time: times[name] } : null;
    },
    log: (line) => logged.push(line),
    advisory: async (ghsa) => {
      asked.push(ghsa);
      return ghsa in advisories ? advisories[ghsa] : null;
    },
  };
}
const config = (fields = {}) => ({
  ...parseConfig(JSON.stringify({ registry: 'https://registry.npmjs.org/' })),
  ...fields,
});
const vulnerability = (name, fixed) => ({
  package: { ecosystem: 'npm', name },
  first_patched_version: fixed,
});

describe('parseConfig', () => {
  it('reads the settings of real pnpm output', () => {
    const parsed = parseConfig(CONFIG);
    expect(parsed).toMatchObject({
      minimumReleaseAge: 10080,
      minimumReleaseAgeExclude: ['eslint-plugin-import-x@4.18.1'],
      ignoreGhsas: ['GHSA-vfj7-8cjw-p6xm', 'GHSA-gcqx-w48m-w2h4'],
      overrides: ['multer@2.4.0', 'minimatch@10.2.6', 'glob@10.5.0', 'glob@13.0.6'],
      registry: 'https://registry.npmjs.org/',
    });
    expect(parsed.scopes).toEqual(new Map([['@jsr', 'https://npm.jsr.io/']]));
  });

  it('reads absent settings as none', () => {
    expect(parseConfig(EMPTY_CONFIG)).toEqual({
      minimumReleaseAge: 0,
      minimumReleaseAgeExclude: [],
      ignoreGhsas: [],
      overrides: [],
      registry: 'https://registry.npmjs.org/',
      scopes: new Map(),
    });
  });

  it('fails on anything unexpected', () => {
    const registry = 'https://registry.npmjs.org/';
    const bad = [
      ['[]', 'not an object'],
      [{ registry, minimumReleaseAge: -1 }, 'minimumReleaseAge'],
      [{ registry, minimumReleaseAge: '10080' }, 'minimumReleaseAge'],
      [{ registry, minimumReleaseAgeExclude: 'x' }, 'minimumReleaseAgeExclude'],
      [{ registry, audit: { ignore: [1] } }, 'audit.ignore'],
      [{ registry, audit: [] }, '`audit`'],
      [{ registry, overrides: ['x'] }, '`overrides`'],
      [{ registry, overrides: { 'x@1.0.0': { y: '1' } } }, '`overrides`'],
      [{ registry: 'http://registry.npmjs.org/' }, '`registry`'],
      [{}, '`registry`'],
      [{ registry, registries: { 'http://x.example/': { scopes: ['@x'] } } }, 'https URL'],
      [{ registry, registries: { 'https://x.example/': { scopes: ['x'] } } }, 'npm scope'],
    ];
    for (const [value, message] of bad) {
      expect(() => parseConfig(typeof value === 'string' ? value : JSON.stringify(value))).toThrow(
        message,
      );
    }
  });
});

describe('checkExceptions', () => {
  const cooldown = { minimumReleaseAge: 10080 };

  it('flags an exclusion older than minimumReleaseAge, not a younger one', async () => {
    const io = lookups({
      times: {
        old: { '1.0.0': new Date(NOW - 8 * DAY).toISOString() },
        young: { '1.0.0': new Date(NOW - 6 * DAY).toISOString() },
        edge: { '1.0.0': new Date(NOW - 7 * DAY).toISOString() },
      },
    });
    const stale = await checkExceptions(
      config({ ...cooldown, minimumReleaseAgeExclude: ['old@1.0.0', 'young@1.0.0', 'edge@1.0.0'] }),
      io,
    );
    expect(stale).toEqual([
      {
        setting: 'release-age',
        entry: 'old@1.0.0',
        reason: 'aged',
        date: '2026-11-12',
        cooldown: '7 days',
      },
      {
        setting: 'release-age',
        entry: 'edge@1.0.0',
        reason: 'aged',
        date: '2026-11-13',
        cooldown: '7 days',
      },
    ]);
  });

  it('flags no exclusion by age when minimumReleaseAge is 0', async () => {
    const io = lookups({ times: { old: { '1.0.0': '2020-01-01T00:00:00.000Z' } } });
    expect(await checkExceptions(config({ minimumReleaseAgeExclude: ['old@1.0.0'] }), io)).toEqual(
      [],
    );
  });

  it('flags unpinned, unpublished and invalid exclusions, never sending an invalid one', async () => {
    const io = lookups({ times: { known: { '1.0.0': '2026-11-19T00:00:00.000Z' } } });
    const stale = await checkExceptions(
      config({
        ...cooldown,
        minimumReleaseAgeExclude: [
          'bare',
          'missing@1.0.0',
          'known@2.0.0',
          '@scope/*',
          'x@^1.0.0',
          'evil@1.0.0 #1 @maintainer',
          '../../x@1.0.0',
        ],
      }),
      io,
    );
    expect(stale.map(({ entry, reason }) => [entry, reason])).toEqual([
      ['bare', 'not-pinned'],
      ['missing@1.0.0', 'not-on-registry'],
      ['known@2.0.0', 'not-on-registry'],
      [null, 'invalid'],
      [null, 'invalid'],
      [null, 'invalid'],
      [null, 'invalid'],
    ]);
    expect(io.asked).toEqual([
      'https://registry.npmjs.org/missing',
      'https://registry.npmjs.org/known',
    ]);
  });

  it('asks the registry of the scope, with the name encoded', async () => {
    const io = lookups();
    await checkExceptions(
      config({
        scopes: new Map([['@jsr', 'https://npm.jsr.io/']]),
        minimumReleaseAgeExclude: ['@jsr/std__fs@1.0.0', '@nestjs/core@12.2.0'],
      }),
      io,
    );
    expect(io.asked).toEqual([
      'https://npm.jsr.io/@jsr%2Fstd__fs',
      'https://registry.npmjs.org/@nestjs%2Fcore',
    ]);
  });

  it('flags accepted advisories that are patched, withdrawn or unknown (real API answers)', async () => {
    const io = lookups({
      advisories: Object.fromEntries(
        Object.entries(ADVISORY_API).map(([ghsa, text]) => [ghsa, JSON.parse(text)]),
      ),
    });
    const stale = await checkExceptions(
      config({
        ignoreGhsas: [
          'GHSA-g3hv-75wg-m249',
          'GHSA-gcqx-w48m-w2h4',
          'GHSA-vfj7-8cjw-p6xm',
          'GHSA-2222-3333-4444',
          'not-a-ghsa',
        ],
      }),
      io,
    );
    expect(stale).toEqual([
      {
        setting: 'ignore-ghsa',
        entry: 'GHSA-g3hv-75wg-m249',
        reason: 'patched',
        fixes: [{ package: 'minimatch', version: '11.0.1' }],
      },
      {
        setting: 'ignore-ghsa',
        entry: 'GHSA-vfj7-8cjw-p6xm',
        reason: 'withdrawn',
        date: '2026-10-23',
      },
      { setting: 'ignore-ghsa', entry: 'GHSA-2222-3333-4444', reason: 'unknown' },
      { setting: 'ignore-ghsa', entry: null, reason: 'invalid' },
    ]);
    expect(io.asked).not.toContain('not-a-ghsa');
  });

  it('flags a GHSA of several packages only when all are patched, and one without npm packages as unknown', async () => {
    const answers = {
      'GHSA-2222-3333-4444': {
        withdrawn_at: null,
        vulnerabilities: [vulnerability('a', '1.0.1'), vulnerability('b', null)],
      },
      'GHSA-2222-3333-5555': {
        withdrawn_at: null,
        vulnerabilities: [{ package: { ecosystem: 'pip', name: 'x' }, first_patched_version: '1' }],
      },
      'GHSA-2222-3333-6666': {
        withdrawn_at: null,
        vulnerabilities: [vulnerability('a', '1.0.1'), vulnerability('b', '2.0.0')],
      },
    };
    const stale = await checkExceptions(
      config({ ignoreGhsas: Object.keys(answers) }),
      lookups({ advisories: answers }),
    );
    expect(stale.map(({ entry, reason }) => [entry, reason])).toEqual([
      ['GHSA-2222-3333-5555', 'unknown'],
      ['GHSA-2222-3333-6666', 'patched'],
    ]);
  });

  it('never keeps a hostile package name or version of the advisory API', async () => {
    const answers = {
      'GHSA-2222-3333-4444': {
        withdrawn_at: null,
        vulnerabilities: [vulnerability('<img src=x>', '1.0.0 @maintainer')],
      },
    };
    const [exception] = await checkExceptions(
      config({ ignoreGhsas: Object.keys(answers) }),
      lookups({ advisories: answers }),
    );
    expect(exception.fixes).toEqual([{ package: '(invalid)', version: '(invalid)' }]);
  });

  it('fails on an unexpected answer and passes a lookup error on', async () => {
    await expect(
      checkExceptions(
        config({ ignoreGhsas: ['GHSA-2222-3333-4444'] }),
        lookups({
          advisories: { 'GHSA-2222-3333-4444': { withdrawn_at: '@x', vulnerabilities: [] } },
        }),
      ),
    ).rejects.toThrow('withdrawal date');
    await expect(
      checkExceptions(
        config({ ...cooldown, minimumReleaseAgeExclude: ['x@1.0.0'] }),
        lookups({ times: { x: { '1.0.0': 'yesterday' } } }),
      ),
    ).rejects.toThrow('publish time');
    await expect(
      checkExceptions(config({ ignoreGhsas: ['GHSA-2222-3333-4444'] }), {
        ...lookups(),
        advisory: async () => {
          throw new Error('API down');
        },
      }),
    ).rejects.toThrow('API down');
  });
});

describe('stale exceptions in the report', () => {
  const aged = {
    setting: 'release-age',
    entry: '@nestjs/core@12.2.0',
    reason: 'aged',
    date: '2026-11-09',
    cooldown: '7 days',
  };
  const withdrawn = {
    setting: 'ignore-ghsa',
    entry: 'GHSA-vfj7-8cjw-p6xm',
    reason: 'withdrawn',
    date: '2026-10-23',
  };
  const patched = {
    setting: 'ignore-ghsa',
    entry: 'GHSA-g3hv-75wg-m249',
    reason: 'patched',
    fixes: [{ package: 'minimatch', version: '11.0.1' }],
  };
  const invalid = { setting: 'release-age', entry: null, reason: 'invalid' };

  it('keeps the body of advisories alone unchanged', () => {
    expect(renderReport([advisory()], { stale: [] })).toBe(renderReport([advisory()]));
    expect(renderReport([advisory()])).not.toContain('stale-exceptions');
  });

  it('lists the stale exceptions in their own section, after the advisories', () => {
    const body = renderReport([advisory()], { stale: [aged, withdrawn, patched, invalid] });
    const lines = body.split('\n');
    expect(lines[1]).toBe(
      '<!-- stale-exceptions: ignore-ghsa:GHSA-g3hv-75wg-m249:patched,ignore-ghsa:GHSA-vfj7-8cjw-p6xm:withdrawn,release-age:@nestjs/core@12.2.0:aged -->',
    );
    expect(body.indexOf('### Stale exceptions')).toBeGreaterThan(body.indexOf('| [GHSA'));
    expect(body).toContain('4 exceptions of `pnpm-workspace.yaml` are no longer needed.');
    expect(body).toContain(
      '| `auditConfig.ignoreGhsas` | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | patched: `11.0.1` (`minimatch`) |',
    );
    expect(body).toContain(
      '| `auditConfig.ignoreGhsas` | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | withdrawn 2026-10-23 |',
    );
    expect(body).toContain(
      '| `minimumReleaseAgeExclude` | `@nestjs/core@12.2.0` | published 2026-11-09, older than 7 days |',
    );
    expect(body).toContain('| `minimumReleaseAgeExclude` | (invalid) | fails its allowlist |');
    expect(body).toContain('no exception is stale');
  });

  it('says so in one line when only stale exceptions remain', () => {
    const body = renderReport([], { stale: [aged] });
    expect(body).toContain('finds no advisory in the committed lockfile');
    expect(body).not.toContain('| Advisory |');
    expect(body.split('\n')[0]).toBe('<!-- advisory-audit:  -->');
  });

  it('round-trips the stale marker, scoped names included, and ignores anything else', () => {
    const notPinned = { setting: 'release-age', entry: '@scope/name', reason: 'not-pinned' };
    expect(readStaleMarker(staleMarker([aged, notPinned, withdrawn, invalid]))).toEqual(
      new Set([
        'ignore-ghsa:GHSA-vfj7-8cjw-p6xm:withdrawn',
        'release-age:@nestjs/core@12.2.0:aged',
        'release-age:@scope/name:not-pinned',
      ]),
    );
    expect(
      readStaleMarker('<!-- stale-exceptions: release-age:x:maybe,ignore-ghsa:GHSA-x:patched -->'),
    ).toEqual(new Set());
    expect(readStaleMarker('no marker')).toEqual(new Set());
  });

  it('counts the stale section inside the size limit and never cuts it', () => {
    const paths = Array.from(
      { length: 5 },
      (_, index) => `.>${Array(8).fill('p'.repeat(100)).join('>')}${index}`,
    );
    const huge = Array.from({ length: 200 }, () => advisory({ paths }));
    const body = renderReport(huge, { stale: [aged, withdrawn] });
    expect(body.length).toBeLessThanOrEqual(BODY_LIMIT);
    expect(body).toContain('more not listed here');
    expect(body).toContain('`@nestjs/core@12.2.0`');
    expect(body).toContain('withdrawn 2026-10-23');
  });

  describe('planSync', () => {
    const open = (advisories, stale) => ({
      number: 7,
      state: 'open',
      body: renderReport(advisories, { stale }),
    });

    it('opens the issue for stale exceptions alone and closes it only when both sets are empty', () => {
      expect(planSync([], undefined, { stale: [aged] })).toMatchObject({ action: 'open' });
      expect(planSync([], open([], [aged]), { stale: [aged] })).toEqual({ action: 'none' });
      const close = planSync([], open([], [aged]), { stale: [] });
      expect(close.action).toBe('close');
      expect(close.comment).toContain('no exception of `pnpm-workspace.yaml` is stale');
    });

    it('reopens with both lists', () => {
      const plan = planSync(
        [advisory()],
        { number: 7, state: 'closed', body: '' },
        { stale: [withdrawn] },
      );
      expect(plan.action).toBe('reopen');
      expect(plan.comment).toContain('finds advisories or stale exceptions again');
      expect(plan.comment).toContain('- [GHSA-g3hv-75wg-m249]');
      expect(plan.comment).toContain(
        '- Stale: `auditConfig.ignoreGhsas`: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) – withdrawn 2026-10-23',
      );
    });

    it('comments on a new and a gone stale exception, e.g. an exclusion replaced by a newer version', () => {
      const newer = { ...aged, entry: '@nestjs/core@12.2.1' };
      const plan = planSync([advisory()], open([advisory()], [aged]), { stale: [newer] });
      expect(plan.action).toBe('update+comment');
      expect(plan.comment).toBe(
        [
          'The stale exceptions changed:',
          '',
          '- New stale exception: `minimumReleaseAgeExclude`: `@nestjs/core@12.2.1` – published 2026-11-09, older than 7 days',
          '- Stale exception gone: `minimumReleaseAgeExclude`: `@nestjs/core@12.2.0`',
        ].join('\n'),
      );
    });

    it('names both kinds of change together, and comments once on a body from before this change', () => {
      const both = planSync([], open([advisory()], []), { stale: [aged] });
      expect(both.comment.split('\n')[0]).toBe('The advisories and stale exceptions changed:');
      const legacy = { number: 7, state: 'open', body: renderReport([advisory()]) };
      const first = planSync([advisory()], legacy, { stale: [withdrawn] });
      expect(first.action).toBe('update+comment');
      expect(first.comment).toContain('- New stale exception:');
    });

    it('updates without a comment when only an invalid entry appears', () => {
      const plan = planSync([advisory()], open([advisory()], [aged]), { stale: [aged, invalid] });
      expect(plan.action).toBe('update');
    });
  });
});

describe('lookups', () => {
  const sleeps = [];
  const sleep = async (ms) => {
    sleeps.push(ms);
  };
  const response = (status, body = {}) => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });

  it('retries a transient failure twice, then gives up', async () => {
    let calls = 0;
    const flaky = async () => {
      calls += 1;
      if (calls < 3) {
        throw Object.assign(new Error('x'), { retriable: true });
      }
      return 'ok';
    };
    expect(await withRetries(flaky, sleep)).toBe('ok');
    expect(sleeps).toEqual([1000, 2000]);
    calls = -10;
    await expect(withRetries(flaky, sleep)).rejects.toThrow('x');
    await expect(
      withRetries(async () => {
        throw new Error('final');
      }, sleep),
    ).rejects.toThrow('final');
  });

  it('reads the registry: 404 as null, retries 5xx, 429 and network errors, refuses redirects', async () => {
    const options = [];
    const answers = [response(503), response(429), response(200, { time: {} })];
    const fetch = async (url, init) => {
      options.push(init);
      return answers.shift();
    };
    expect(await registryJson('https://registry.npmjs.org/x', { fetch, sleep })).toEqual({
      time: {},
    });
    expect(options[0].redirect).toBe('error');
    expect(
      await registryJson('https://registry.npmjs.org/x', {
        fetch: async () => response(404),
        sleep,
      }),
    ).toBeNull();
    await expect(
      registryJson('https://registry.npmjs.org/x', { fetch: async () => response(403), sleep }),
    ).rejects.toThrow('403');
    await expect(
      registryJson('https://registry.npmjs.org/x', {
        fetch: async () => {
          throw new TypeError('fetch failed');
        },
        sleep,
      }),
    ).rejects.toThrow('could not be reached');
  });

  it('reads an advisory through gh: 404 as null, other client errors fail at once', async () => {
    const { gh, calls } = fakeGh({ advisories: { 'GHSA-g3hv-75wg-m249': '{"ghsa_id":"x"}' } });
    expect(await githubAdvisory(gh, 'GHSA-g3hv-75wg-m249', sleep)).toEqual({ ghsa_id: 'x' });
    expect(calls[0].args).toEqual(['api', '/advisories/GHSA-g3hv-75wg-m249']);
    expect(await githubAdvisory(gh, 'GHSA-2222-3333-4444', sleep)).toBeNull();
    const forbidden = () => {
      throw Object.assign(new Error('gh failed'), { stderr: 'gh: Forbidden (HTTP 403)' });
    };
    await expect(githubAdvisory(forbidden, 'GHSA-2222-3333-4444', sleep)).rejects.toThrow(
      'refused',
    );
    expect(() => githubAdvisory(gh, '../x', sleep)).toThrow('Not a GHSA id');
  });
});

describe('sync with stale exceptions', () => {
  const run = async (fields, options = {}) => {
    const fake = fakeGh({ advisories: ADVISORY_API, ...options });
    const summary = [];
    const result = await sync(fixture('clean.json'), CONFIG, fixture('lockfile.json'), {
      env: { GITHUB_REPOSITORY: 'trybun/trybun', ...fields },
      gh: fake.gh,
      summary: (text) => summary.push(text),
      log: () => {},
      now: NOW,
      fetch: async (url, init) => ({
        status: 200,
        ok: true,
        json: async () =>
          init.headers.accept === ABBREVIATED
            ? REGISTRY_PARENTS[decodeURIComponent(new URL(url).pathname.slice(1))]
            : { time: { '4.18.1': '2026-11-09T05:09:07.668Z' } },
      }),
      sleep: async () => {},
      root: '/workspace/trybun',
      readText: (path) => MANIFESTS[path] ?? '{}',
    });
    return { result, summary: summary.join(''), writes: fake.writes() };
  };

  it('lists the stale exceptions of the real settings in a dry run', async () => {
    const outcome = await run({
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_REF: 'refs/heads/x',
    });
    expect(outcome.result).toBe('dry-run');
    expect(outcome.writes).toEqual([]);
    expect(outcome.summary).toContain(
      '`eslint-plugin-import-x@4.18.1` | published 2026-11-09, older than 7 days',
    );
    expect(outcome.summary).toContain('withdrawn 2026-10-23');
    expect(outcome.summary).not.toContain('GHSA-gcqx-w48m-w2h4');
    expect(outcome.summary).toContain(
      '| `overrides` | `multer@2.4.0` | no dependency asks for this version |',
    );
    expect(outcome.summary).not.toContain('`minimatch@10.2.6`');
    expect(outcome.summary).not.toContain('`glob@');
  });

  it('opens the tracking issue for stale exceptions on main', async () => {
    const outcome = await run({ GITHUB_EVENT_NAME: 'schedule' });
    expect(outcome.result).toBe('open');
    expect(outcome.writes[0].input.body).toContain('### Stale exceptions');
  });
});

describe('review follow-ups of the stale exceptions', () => {
  const sleep = async () => {};

  it('never renders a hostile token of an edited issue body into a comment', () => {
    const hostile = [
      'release-age:x`@octocat_[click](//evil.example)_owner/repo#1`:aged',
      'release-age:x@1.0.0 #1:aged',
      'release-age:<b>x</b>@1.0.0:aged',
      'release-age:x@1.0.0:not-pinned',
      'release-age:x:aged',
      'ignore-ghsa:GHSA-xxxx-xxxx-xxxx:patched',
      'other:x@1.0.0:aged',
    ];
    const body = `${renderReport([advisory()])}\n<!-- stale-exceptions: ${hostile.join(',')} -->`;
    expect(readStaleMarker(body)).toEqual(new Set());
    const plan = planSync([advisory()], { number: 7, state: 'open', body }, { stale: [] });
    expect(plan.action).toBe('update');
    expect(readStaleMarker('<!-- stale-exceptions: release-age:x@1.0.0:aged -->')).toEqual(
      new Set(['release-age:x@1.0.0:aged']),
    );
  });

  it('retries a timeout while the registry sends the document', async () => {
    let calls = 0;
    const fetch = async () => {
      calls += 1;
      return {
        status: 200,
        ok: true,
        json: async () => {
          if (calls < 2) {
            throw Object.assign(new Error('aborted'), { name: 'TimeoutError' });
          }
          return { time: {} };
        },
      };
    };
    expect(await registryJson('https://registry.npmjs.org/x', { fetch, sleep })).toEqual({
      time: {},
    });
    expect(calls).toBe(2);
    await expect(
      registryJson('https://registry.npmjs.org/x', {
        fetch: async () => ({ status: 200, ok: true, json: async () => JSON.parse('{') }),
        sleep,
      }),
    ).rejects.toThrow('no valid JSON');
  });

  it('retries gh on 5xx, 429, a rate limit or a timeout, and keeps its error for the log', async () => {
    for (const stderr of [
      'gh: Server Error (HTTP 502)',
      'gh: Too Many Requests (HTTP 429)',
      'gh: API rate limit exceeded (HTTP 403)',
      '',
    ]) {
      let calls = 0;
      const gh = () => {
        calls += 1;
        if (calls < 3) {
          throw Object.assign(new Error('spawnSync gh ETIMEDOUT'), { stderr });
        }
        return '{"ghsa_id":"x"}';
      };
      expect(await githubAdvisory(gh, 'GHSA-2222-3333-4444', sleep)).toEqual({ ghsa_id: 'x' });
      expect(calls).toBe(3);
    }
    const down = () => {
      throw Object.assign(new Error('gh failed'), { stderr: 'gh: Server Error (HTTP 503)\nmore' });
    };
    await expect(githubAdvisory(down, 'GHSA-2222-3333-4444', sleep)).rejects.toThrow(
      'could not be reached for GHSA-2222-3333-4444: gh: Server Error (HTTP 503)',
    );
    await expect(githubAdvisory(() => 'not json', 'GHSA-2222-3333-4444', sleep)).rejects.toThrow(
      'no valid JSON',
    );
  });
});

// Captured on 2026-11-13: `pnpm list -r --depth Infinity --lockfile-only --json` of this repository,
// trimmed to the paths to `multer`, `minimatch`, `glob` and `eslint-plugin-import-x` (project paths
// under `/workspace/trybun`), and the abbreviated registry documents of their parents, trimmed to
// the locked versions.
const ROOT = '/workspace/trybun';
const LOCKFILE = parseLockfile(fixture('lockfile.json'), ROOT);
const REGISTRY_PARENTS = JSON.parse(fixture('registry-parents.json'));
const MANIFESTS = {
  [`${ROOT}/apps/server/package.json`]: JSON.stringify({ dependencies: { multer: '^2.5.0' } }),
};
const SERVER = { [`${ROOT}/apps/server`]: { dependencies: { multer: '^2.5.0' } } };

describe('satisfies', () => {
  // node-semver's documented examples (README, "Advanced Range Syntax"); `pnpm exec node` with
  // semver 7.8.5 agrees on every row.
  const table = [
    ['1.2.3', '^1.2.3', true],
    ['1.9.9', '^1.2.3', true],
    ['2.0.0', '^1.2.3', false],
    ['0.2.9', '^0.2.3', true],
    ['0.3.0', '^0.2.3', false],
    ['0.0.3', '^0.0.3', true],
    ['0.0.4', '^0.0.3', false],
    ['0.0.9', '^0.0.x', true],
    ['0.1.0', '^0.0', false],
    ['1.2.9', '~1.2.3', true],
    ['1.3.0', '~1.2.3', false],
    ['1.9.0', '~1', true],
    ['2.3.4', '1.2.3 - 2.3.4', true],
    ['2.3.5', '1.2.3 - 2.3.4', false],
    ['2.3.9', '1.2.3 - 2.3', true],
    ['2.9.9', '1.2.3 - 2', true],
    ['1.0.0', '1.x', true],
    ['1.2.9', '1.2.x', true],
    ['1.3.0', '1.2.x', false],
    ['3.0.0', '*', true],
    ['3.0.0', '', true],
    ['1.2.0', 'X.x', true],
    ['1.3.0', '>1.2', true],
    ['1.2.9', '>1.2', false],
    ['1.1.9', '<1.2', true],
    ['1.2.0', '<1.2', false],
    ['1.2.9', '<=1.2', true],
    ['1.2.3', '=1.2.3', true],
    ['1.2.3', 'v1.2.3', true],
    ['1.9.0', '>= 1.2.3 < 2', true],
    ['2.0.0', '>=1.2.3 <2.0.0', false],
    ['2.5.0', '^1.2.3 || ^2.0.0', true],
    ['10.2.6', '^9.0.3 || ^10.1.2 || ^11.0.1', true],
    ['10.2.6', '^10.2.4', true],
    ['10.2.6', '10.2.6', true],
    ['2.4.0', '2.5.0', false],
    ['2.4.0', '^2.5.0', false],
  ];
  it.each(table)('%s in %j is %s', (version, range, expected) => {
    expect(satisfies(version, range)).toBe(expected);
  });

  it('follows the prerelease rule', () => {
    expect(satisfies('1.2.3-beta.4', '^1.2.3-beta.2')).toBe(true);
    expect(satisfies('3.4.5-alpha.9', '^1.2.3-beta.2')).toBe(false);
    expect(satisfies('1.2.3-alpha.7', '>1.2.3-alpha.3')).toBe(true);
    expect(satisfies('1.5.0-beta', '^1.2.3')).toBe(false);
    expect(satisfies('2.0.0-alpha', '>1')).toBe(false);
    expect(satisfies('1.0.0-0', '>=1.0.0-0')).toBe(true);
    // pnpm matches intersecting ranges: without the rule, `*` takes a prerelease too.
    expect(satisfies('1.0.0-beta.1', '*')).toBe(false);
    expect(satisfies('1.0.0-beta.1', '*', { includePrerelease: true })).toBe(true);
    expect(satisfies('1.0.0-beta.1', '^1.0.0', { includePrerelease: true })).toBe(false);
  });

  it('tells ranges, workspace specs and other specs apart', () => {
    expect(['^1.2.3', '', 'x', 'X.x', '>= 1 < 2 || 3'].map(specKind)).toEqual(
      Array(5).fill('range'),
    );
    expect(['workspace:*', 'link:../x', 'file:../x', 'portal:../x'].map(specKind)).toEqual(
      Array(4).fill('local'),
    );
    expect(
      [
        'catalog:',
        'npm:glob@^10',
        'user/repo',
        'user/repo#v1',
        'latest',
        'https://x.example/a.tgz',
      ].map(specKind),
    ).toEqual(Array(6).fill('other'));
    expect(() => specKind('* || >>1')).toThrow('cannot be read');
  });

  it('never matches a spec that is no range, and throws on one it cannot read', () => {
    for (const spec of [
      'latest',
      'next',
      'npm:multer@2.4.0',
      'workspace:*',
      'link:../x',
      'file:../x',
      'https://x.example/a.tgz',
      'git+https://x.example/y.git',
      'github:a/b',
      'user/repo',
      'user/repo#v1.0.0',
      '../x',
      './x',
    ]) {
      expect(satisfies('2.4.0', spec)).toBe(false);
    }
    for (const spec of ['1.2.3.4', '>>1', '^^1', '1.2.3 -', '=>1', '1.2.3 <b>']) {
      expect(() => satisfies('1.2.3', spec)).toThrow('cannot be read');
    }
  });
});

describe('parseLockfile', () => {
  it('reads the versions and the dependents of real pnpm output', () => {
    expect(LOCKFILE.present.has('minimatch@11.0.4')).toBe(true);
    expect(LOCKFILE.present.has('eslint-plugin-import-x@4.18.1')).toBe(true);
    expect(LOCKFILE.present.has('multer@2.5.0')).toBe(true);
    // The override replaced it: the key version itself is never in the lockfile.
    expect(LOCKFILE.present.has('minimatch@10.2.6')).toBe(false);
    expect(LOCKFILE.dependents.get('multer')).toEqual([
      { kind: 'package', name: '@nestjs/platform-express', version: '12.3.3' },
      { kind: 'project', path: `${ROOT}/apps/server` },
    ]);
    expect(LOCKFILE.dependents.get('glob').map((dependent) => dependent.name)).toEqual([
      'archiver-utils',
      '@joshwooding/vite-plugin-react-docgen-typescript',
    ]);
  });

  it('reads a nested workspace link as a project and fails on anything unexpected', () => {
    const tree = (dependencies, path = `${ROOT}/apps/web`) =>
      JSON.stringify([{ name: 'web', path, dependencies }]);
    const linked = parseLockfile(
      tree({
        '@trybun/ui': {
          version: 'link:../../packages/ui',
          dependencies: { glob: { version: '14.0.3' }, local: { version: 'file:../x' } },
        },
      }),
      ROOT,
    );
    expect(linked.present.has('glob@14.0.3')).toBe(true);
    expect(linked.dependents.get('glob')).toEqual([
      { kind: 'project', path: `${ROOT}/packages/ui` },
    ]);
    expect([...linked.present]).toEqual(['glob@14.0.3']);
    expect(() => parseLockfile(tree({ x: { version: 'link:../../../elsewhere' } }), ROOT)).toThrow(
      'outside the checkout',
    );
    expect(() => parseLockfile('{}', ROOT)).toThrow('not a list of projects');
    expect(() => parseLockfile(JSON.stringify([{ name: 'x' }]), ROOT)).toThrow('without a path');
    for (const path of ['/elsewhere', `${ROOT}/../x`, `${ROOT}-evil`]) {
      expect(() => parseLockfile(tree({}, path), ROOT)).toThrow('outside the checkout');
    }
    expect(() => parseLockfile(tree({ '../x': { version: '1.0.0' } }), ROOT)).toThrow(
      'fails its allowlist',
    );
    expect(() => parseLockfile(tree([]), ROOT)).toThrow('not an object');
  });
});

describe('checkExceptions with the lockfile', () => {
  const real = (fields = {}) =>
    lookups({
      lockfile: LOCKFILE,
      documents: REGISTRY_PARENTS,
      manifests: SERVER,
      ...fields,
    });
  const overrides = (keys) => config({ overrides: keys });

  it('flags the override no dependency asks for, and keeps those still asked for (real data)', async () => {
    const io = real();
    const stale = await checkExceptions(
      overrides(['multer@2.4.0', 'minimatch@10.2.6', 'glob@10.5.0', 'glob@13.0.6']),
      io,
    );
    expect(stale).toEqual([{ setting: 'override', entry: 'multer@2.4.0', reason: 'unused' }]);
    // One abbreviated document per parent name, never the full one.
    const documents = io.asked.filter((entry) => entry.includes(ABBREVIATED));
    expect(new Set(documents).size).toBe(documents.length);
    expect(documents).toContain(
      `https://registry.npmjs.org/@nestjs%2Fplatform-express (${ABBREVIATED})`,
    );
  });

  it('counts the range of a workspace project, and an override of a package gone from the tree', async () => {
    const io = real({
      manifests: { [`${ROOT}/apps/server`]: { devDependencies: { multer: '2.4.0' } } },
    });
    expect(await checkExceptions(overrides(['multer@2.4.0', 'left-pad@1.3.0']), io)).toEqual([
      { setting: 'override', entry: 'left-pad@1.3.0', reason: 'unused' },
    ]);
  });

  it('counts a parent unknown to the registry as asking for the version, with a log line', async () => {
    const io = real({ documents: {} });
    expect(await checkExceptions(overrides(['multer@2.4.0']), io)).toEqual([]);
    expect(io.logged).toEqual([
      '@nestjs/platform-express@12.3.3 is not on the registry; it counts as asking for multer@2.4.0',
    ]);
    const missingVersion = real({
      documents: { '@nestjs/platform-express': { versions: {} } },
    });
    expect(await checkExceptions(overrides(['multer@2.4.0']), missingVersion)).toEqual([]);
  });

  it('counts a peer range, a prerelease key matched by `*`, and a spec that is no range as asking', async () => {
    const parent = (ranges) =>
      real({
        documents: {
          '@nestjs/platform-express': { versions: { '12.3.3': ranges } },
        },
      });
    expect(
      await checkExceptions(
        overrides(['multer@2.4.0']),
        parent({ peerDependencies: { multer: '^2.4.0' } }),
      ),
    ).toEqual([]);
    expect(
      await checkExceptions(
        overrides(['multer@2.6.0-beta.1']),
        parent({ dependencies: { multer: '*' } }),
      ),
    ).toEqual([]);
    const aliased = parent({ dependencies: { multer: 'npm:@x/multer@2' } });
    expect(await checkExceptions(overrides(['multer@2.4.0']), aliased)).toEqual([]);
    expect(aliased.logged).toEqual([
      '@nestjs/platform-express declares multer with a spec that is no range; it counts as asking for multer@2.4.0',
    ]);
    const catalog = real({
      manifests: { [`${ROOT}/apps/server`]: { dependencies: { multer: 'catalog:' } } },
      documents: { '@nestjs/platform-express': { versions: { '12.3.3': {} } } },
    });
    expect(await checkExceptions(overrides(['multer@2.4.0']), catalog)).toEqual([]);
    const workspace = real({
      manifests: { [`${ROOT}/apps/server`]: { dependencies: { multer: 'workspace:*' } } },
      documents: { '@nestjs/platform-express': { versions: { '12.3.3': {} } } },
    });
    expect(await checkExceptions(overrides(['multer@2.4.0']), workspace)).toEqual([
      { setting: 'override', entry: 'multer@2.4.0', reason: 'unused' },
    ]);
  });

  it('lists keys that are not pinned, never sending one anywhere', async () => {
    const io = real();
    const stale = await checkExceptions(
      overrides(['multer', 'glob@^10', 'archiver-utils>glob', 'x@1.0.0 #1']),
      io,
    );
    expect(stale).toEqual([
      { setting: 'override', entry: 'multer', reason: 'not-pinned' },
      { setting: 'override', entry: null, reason: 'not-pinned' },
      { setting: 'override', entry: null, reason: 'not-pinned' },
      { setting: 'override', entry: null, reason: 'not-pinned' },
    ]);
    expect(io.asked).toEqual([]);
  });

  it('fails on a package.json that is not an object', async () => {
    await expect(
      checkExceptions(
        overrides(['multer@2.4.0']),
        real({ manifests: { [`${ROOT}/apps/server`]: [] } }),
      ),
    ).rejects.toThrow('not an object');
  });

  it('fails on a range it cannot read and on an unexpected document', async () => {
    const odd = (range) =>
      real({
        documents: {
          ...REGISTRY_PARENTS,
          '@nestjs/platform-express': {
            versions: { '12.3.3': { dependencies: { multer: range } } },
          },
        },
      });
    await expect(checkExceptions(overrides(['multer@2.4.0']), odd('>>2'))).rejects.toThrow(
      'cannot be read',
    );
    await expect(
      checkExceptions(
        overrides(['multer@2.4.0']),
        real({ documents: { '@nestjs/platform-express': [] } }),
      ),
    ).rejects.toThrow('unexpected document');
  });

  it('flags an exclusion whose version is not in the lockfile, without asking the registry', async () => {
    const io = real({
      times: { 'eslint-plugin-import-x': { '4.18.1': new Date(NOW - DAY).toISOString() } },
    });
    const stale = await checkExceptions(
      config({
        minimumReleaseAge: 10080,
        minimumReleaseAgeExclude: ['minimatch@11.0.1', 'eslint-plugin-import-x@4.18.1'],
      }),
      io,
    );
    expect(stale).toEqual([
      { setting: 'release-age', entry: 'minimatch@11.0.1', reason: 'not-in-lockfile' },
    ]);
    expect(io.asked).toEqual(['https://registry.npmjs.org/eslint-plugin-import-x']);
  });
});

describe('unneeded overrides and exclusions outside the lockfile in the report', () => {
  const unused = { setting: 'override', entry: 'multer@2.4.0', reason: 'unused' };
  const bare = { setting: 'override', entry: 'multer', reason: 'not-pinned' };
  const ranged = { setting: 'override', entry: null, reason: 'not-pinned' };
  const absent = { setting: 'release-age', entry: '@scope/x@1.2.3', reason: 'not-in-lockfile' };

  it('lists the new rows after the others and keeps invalid keys out of the marker', () => {
    const body = renderReport([], { stale: [unused, bare, ranged, absent] });
    expect(body.split('\n')[1]).toBe(
      '<!-- stale-exceptions: override:multer:not-pinned,override:multer@2.4.0:unused,release-age:@scope/x@1.2.3:not-in-lockfile -->',
    );
    const rows = body.split('\n').filter((line) => line.startsWith('| `'));
    expect(rows).toEqual([
      '| `minimumReleaseAgeExclude` | `@scope/x@1.2.3` | version not in the lockfile |',
      '| `overrides` | `multer` | not pinned to an exact version |',
      '| `overrides` | `multer@2.4.0` | no dependency asks for this version |',
      '| `overrides` | (invalid) | not pinned to an exact version |',
    ]);
    expect(body).toContain('For an `overrides` entry, check that `pnpm install`');
  });

  it('round-trips the new tokens and rejects malformed ones', () => {
    expect(readStaleMarker(staleMarker([unused, bare, ranged, absent]))).toEqual(
      new Set([
        'override:multer:not-pinned',
        'override:multer@2.4.0:unused',
        'release-age:@scope/x@1.2.3:not-in-lockfile',
      ]),
    );
    expect(
      readStaleMarker(
        '<!-- stale-exceptions: override:multer:unused,override:multer@2.4.0:not-pinned,override:a>b@1.0.0:unused,override:x@^1:unused -->',
      ),
    ).toEqual(new Set());
  });

  it('comments when an override becomes unneeded and when it is removed', () => {
    const before = { number: 7, state: 'open', body: renderReport([], { stale: [absent] }) };
    const plan = planSync([], before, { stale: [absent, unused] });
    expect(plan.comment).toBe(
      [
        'The stale exceptions changed:',
        '',
        '- New stale exception: `overrides`: `multer@2.4.0` – no dependency asks for this version',
      ].join('\n'),
    );
    const removed = planSync([], { ...before, body: plan.body }, { stale: [absent] });
    expect(removed.comment).toContain('- Stale exception gone: `overrides`: `multer@2.4.0`');
  });
});
