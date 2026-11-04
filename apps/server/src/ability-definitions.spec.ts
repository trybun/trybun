// The record descriptors select every field the rules and restrictions read (§18.3), so the
// in-memory check of a record never sees a missing field.
import { describe, expect, it } from 'vitest';
import { buildPrincipal, PRINCIPAL_FIXTURES } from '../test/factories/principal.factory.js';
import { ABILITY_DEFINITIONS } from './ability-definitions.js';
import type { Transaction } from './platform/database/prisma.service.js';
import { AbilityFactory } from './platform/authorization/ability-factory.js';

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
  const delegates = { project: capture, organization: capture, invitation: capture, user: capture };
  await descriptor.find(delegates as unknown as Transaction, {}, principal);
  return select;
}

const abilities = new AbilityFactory(ABILITY_DEFINITIONS.rules, ABILITY_DEFINITIONS.restrictions);

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
