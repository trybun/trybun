import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BODY_LIMIT,
  ISSUE_LABELS,
  ISSUE_TITLE,
  applyPlan,
  findIssue,
  invalidFields,
  marker,
  parseAudit,
  planSync,
  readMarker,
  renderReport,
  sync,
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
      expect(body.match(/-->/g)).toHaveLength(1);
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
function fakeGh({ defaultBranch = 'main', issues = [], created = 9 } = {}) {
  const calls = [];
  const gh = (args, input) => {
    calls.push({ args, input: input === undefined ? undefined : JSON.parse(input) });
    if (args[0] === 'api' && args[1] === 'repos/trybun/trybun') {
      return `${defaultBranch}\n`;
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

describe('sync', () => {
  const env = (fields) => ({ GITHUB_REPOSITORY: 'trybun/trybun', ...fields });
  const run = (text, fields, options) => {
    const fake = fakeGh(options);
    const summary = [];
    const log = [];
    const result = sync(text, {
      env: env(fields),
      gh: fake.gh,
      summary: (line) => summary.push(line),
      log: (line) => log.push(line),
    });
    return { result, summary: summary.join(''), log, writes: fake.writes() };
  };

  it('is a dry run on another branch: the job summary only', () => {
    const outcome = run(fixture('advisories.json'), {
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_REF: 'refs/heads/test/advisory',
    });
    expect(outcome.result).toBe('dry-run');
    expect(outcome.writes).toEqual([]);
    expect(outcome.summary).toContain('GHSA-g3hv-75wg-m249');
    expect(outcome.summary).toContain('`.>glob>minimatch`');
    expect(outcome.summary).toContain('Dry run outside the default branch');
  });

  it('writes the issue on a run of the default branch and on a scheduled run', () => {
    const dispatched = run(fixture('advisories.json'), {
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_REF: 'refs/heads/main',
    });
    expect(dispatched.result).toBe('open');
    expect(dispatched.summary).toContain('Tracking issue: #9 (open).');
    expect(dispatched.writes).toHaveLength(1);

    const scheduled = run(
      fixture('advisories.json'),
      {
        GITHUB_EVENT_NAME: 'schedule',
        GITHUB_REF: 'refs/heads/main',
      },
      { defaultBranch: 'trunk' },
    );
    expect(scheduled.result).toBe('open');
  });

  it('closes the open issue on a clean audit', () => {
    const outcome = run(
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

  it('reports a clean audit without an issue', () => {
    const outcome = run(fixture('clean.json'), { GITHUB_EVENT_NAME: 'schedule' });
    expect(outcome.result).toBe('none');
    expect(outcome.summary).toContain('No tracking issue: the audit is clean.');
  });

  it('fails a failed audit before touching anything', () => {
    const fake = fakeGh();
    expect(() =>
      sync(fixture('failed.json'), {
        env: env({ GITHUB_EVENT_NAME: 'schedule' }),
        gh: fake.gh,
        summary: () => {},
        log: () => {},
      }),
    ).toThrow('no result');
    expect(fake.calls).toEqual([]);
  });

  it('logs the fields that fail their allowlist and rejects a malformed repository', () => {
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
    const outcome = run(text, {
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_REF: 'refs/heads/x',
    });
    expect(outcome.log).toContain('GHSA-g3hv-75wg-m249: package fails its allowlist');
    expect(() =>
      sync(fixture('clean.json'), {
        env: { GITHUB_REPOSITORY: 'a/b c' },
        gh: fakeGh().gh,
        summary: () => {},
        log: () => {},
      }),
    ).toThrow('GITHUB_REPOSITORY');
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
