import { describe, expect, it } from 'vitest';
import { collectSections, findBrokenReferences } from './check-spec-references.js';

// Built from parts, so that the references of the test cases do not fail the check of this file.
const S = '§';

const sections = collectSections(
  new Map([
    ['docs/spec/02-agent-rules.md', '# 2 – Rules\n\n## 2.14 Agent workflow\n\n### Gates\n'],
    ['docs/spec/14-architecture.md', '# 14 – Architecture\n\n## 14.6 Monorepo structure\n'],
  ]),
);

describe('collectSections', () => {
  it('maps every numbered heading to its file', () => {
    expect(sections).toEqual(
      new Map([
        ['2', 'docs/spec/02-agent-rules.md'],
        ['2.14', 'docs/spec/02-agent-rules.md'],
        ['14', 'docs/spec/14-architecture.md'],
        ['14.6', 'docs/spec/14-architecture.md'],
      ]),
    );
  });
});

describe('findBrokenReferences', () => {
  it.each([
    ['a reference in text', `See ${S}2.14.`],
    ['a chapter reference', `See ${S}14.`],
    ['a link to the file of the section', `See [${S}2.14](docs/spec/02-agent-rules.md).`],
    [
      'a link with a heading',
      `See [${S}14.6](docs/spec/14-architecture.md#146-monorepo-structure).`,
    ],
    ['a link outside the specification', `See [${S}2.14](https://example.com/rules).`],
    ['a code comment', `// Lint rules (${S}2.14, ${S}14.6).`],
  ])('accepts %s', (_case, content) => {
    expect(findBrokenReferences('README.md', content, sections)).toEqual([]);
  });

  it('accepts an anchor link inside the file of the section', () => {
    expect(
      findBrokenReferences(
        'docs/spec/02-agent-rules.md',
        `[${S}2.14](#214-agent-workflow)`,
        sections,
      ),
    ).toEqual([]);
  });

  it.each([
    ['a missing section', `Text\nSee ${S}2.99.`, [`README.md:2: ${S}2.99 does not exist`]],
    ['a missing chapter', `See ${S}99.`, [`README.md:1: ${S}99 does not exist`]],
    [
      'a link to another file of the specification',
      `See [${S}2.14](docs/spec/14-architecture.md).`,
      [
        `README.md:1: ${S}2.14 links to docs/spec/14-architecture.md, but is defined in docs/spec/02-agent-rules.md`,
      ],
    ],
  ])('reports %s', (_case, content, problems) => {
    expect(findBrokenReferences('README.md', content, sections)).toEqual(problems);
  });

  it('resolves links relative to the referring file', () => {
    expect(
      findBrokenReferences(
        '.ai/specs/2026-10-21-change.md',
        `[${S}14.6](../../docs/spec/02-agent-rules.md)`,
        sections,
      ),
    ).toEqual([
      `.ai/specs/2026-10-21-change.md:1: ${S}14.6 links to docs/spec/02-agent-rules.md, but is defined in docs/spec/14-architecture.md`,
    ]);
  });
});
