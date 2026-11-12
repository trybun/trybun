// The record descriptors select every field the rules and restrictions read (§18.3), so the
// in-memory check of a record never sees a missing field.
import { accessibleBy } from '@casl/prisma/runtime';
import { describe, expect, it } from 'vitest';
import { buildPrincipal, PRINCIPAL_FIXTURES } from '../test/factories/principal.factory.js';
import { ABILITY_DEFINITIONS } from './ability-definitions.js';
import type { Transaction } from './platform/database/prisma.service.js';
import { AbilityFactory } from './platform/authorization/ability-factory.js';
import { FixedClock } from '../test/fixed-clock.js';

/** The Prisma operators of a condition: they are no fields of the record. */
const LOGICAL = new Set(['AND', 'OR', 'NOT']);
const RELATION = new Set(['some', 'every', 'none', 'is', 'isNot']);

type Select = Record<string, unknown>;

/** The field paths a condition reads that its `select` does not, e.g. `members.role`. */
function missingFields(condition: unknown, select: Select, path = ''): string[] {
  if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
    return [];
  }
  return Object.entries(condition).flatMap(([key, value]) => {
    if (LOGICAL.has(key)) {
      return [value].flat().flatMap((part) => missingFields(part, select, path));
    }
    if (RELATION.has(key)) {
      return missingFields(value, select, path);
    }
    const selected = select[key];
    if (selected === undefined || selected === false) {
      return [`${path}${key}`];
    }
    if (typeof selected === 'object' && selected !== null && 'select' in selected) {
      return missingFields(value, selected.select as Select, `${path}${key}.`);
    }
    return [];
  });
}

/** The `select` a record descriptor loads for a principal, captured from its Prisma call. */
async function selectOf(
  descriptor: (typeof ABILITY_DEFINITIONS.records)[number],
  principal: ReturnType<typeof buildPrincipal>,
): Promise<Select> {
  let select: Select = {};
  const capture = {
    findFirst: (args: { select: Select }) => {
      select = args.select;
      return Promise.resolve(null);
    },
  };
  const delegates = {
    project: capture,
    organization: capture,
    invitation: capture,
    user: capture,
    ticket: capture,
    comment: capture,
    attachment: capture,
  };
  await descriptor.find(delegates as unknown as Transaction, {}, principal);
  return select;
}

const abilities = new AbilityFactory(
  ABILITY_DEFINITIONS.rules,
  ABILITY_DEFINITIONS.restrictions,
  new FixedClock(),
);

describe('record descriptors', () => {
  it.each(PRINCIPAL_FIXTURES)(
    'select every field the conditions read for the principal %s',
    async (fixture) => {
      const principal = buildPrincipal(fixture);
      const ability = abilities.forPrincipal(principal);

      for (const descriptor of ABILITY_DEFINITIONS.records) {
        const select = await selectOf(descriptor, principal);
        const missing = ability.rules
          .filter((rule) => rule.subject === descriptor.subject)
          .flatMap((rule) => missingFields(rule.conditions, select));

        expect(missing, descriptor.subject).toEqual([]);
      }
    },
  );

  it('finds a missing field', () => {
    expect(
      missingFields(
        { members: { some: { userId: 'u', role: { in: ['developer'] } } } },
        {
          members: { select: { userId: true } },
        },
      ),
    ).toEqual(['members.role']);
  });
});

/** The to-one relation conditions of a filter: `accessibleBy` writes each as its own join. */
function toOneJoins(condition: unknown): number {
  if (typeof condition !== 'object' || condition === null) {
    return 0;
  }
  return Object.entries(condition).reduce(
    (count, [key, value]) =>
      count +
      (key === 'is' || key === 'isNot' ? 1 : 0) +
      [value]
        .flat()
        .map(toOneJoins)
        .reduce((a, b) => a + b, 0),
    0,
  );
}

/**
 * The most to-one joins the `read` filter of a record may need (#321): the planning time of a
 * query grows with its joins, and one rule per combination of conditions once wrote the filter of
 * an end user's attachment with over a hundred joins – 250 ms of planning for 4 ms of execution.
 */
const MAX_TO_ONE_JOINS = 16;

describe('read filters', () => {
  it.each(PRINCIPAL_FIXTURES)(
    `stay within ${MAX_TO_ONE_JOINS} to-one joins per subject for the principal %s`,
    (fixture) => {
      const ability = abilities.forPrincipal(buildPrincipal(fixture));

      for (const { subject } of ABILITY_DEFINITIONS.records) {
        const joins = toOneJoins(accessibleBy(ability, 'read').ofType(subject));

        expect(joins, subject).toBeLessThanOrEqual(MAX_TO_ONE_JOINS);
      }
    },
  );

  it('counts the to-one joins of a filter', () => {
    expect(
      toOneJoins({
        OR: [{ ticket: { is: { project: { is: {} } } } }, { comment: { isNot: null } }],
      }),
    ).toBe(3);
  });
});
